import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/user.decorator";

@Injectable()
export class SlaService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService) {}
  onModuleInit() {
    const run = () => {
      void this.evaluateBreaches().catch((err) => {
        // Background SLA housekeeping must never take down the API.
        console.error('[Sla] evaluateBreaches failed:', err?.message || err);
      });
    };
    run();
    this.timer = setInterval(run, 15 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async createPolicy(user: AuthUser, dto: { name: string; responseHours?: number; resolutionHours: number; warningHours?: number }) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers manage SLA policies");
    if (!dto.name?.trim() || !dto.resolutionHours || dto.resolutionHours < 1) throw new BadRequestException("A positive resolutionHours is required");
    return this.prisma.slaPolicy.create({ data: { ...dto, name: dto.name.trim(), providerId: user.providerId } });
  }

  async policies(user: AuthUser) {
    const where: any = user.role === "PROVIDER" ? { providerId: user.providerId } : {};
    return this.prisma.slaPolicy.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  async createForJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: true } });
    if (!job) return null;
    const existing = await this.prisma.jobSla.findUnique({ where: { jobId } });
    if (existing) return existing;
    const policy = await this.prisma.slaPolicy.findFirst({ where: { providerId: job.contract.providerId, isActive: true }, orderBy: { createdAt: "desc" } });
    const hours = policy?.resolutionHours ?? parseSlaHours(job.contract.sla) ?? Math.max(1, Math.round((job.endTime.getTime() - job.startTime.getTime()) / 3600000));
    const deadline = new Date(job.startTime.getTime() + hours * 3600000);
    return this.prisma.jobSla.create({ data: { jobId, policyId: policy?.id, deadline } });
  }

  async getForJob(user: AuthUser, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: true } });
    if (!job) throw new NotFoundException("Job not found");
    this.assertAccess(user, job.contract.organizationId, job.contract.providerId);
    return this.prisma.jobSla.findUnique({ where: { jobId }, include: { policy: true } });
  }

  async complete(jobId: string) {
    return this.prisma.jobSla.updateMany({ where: { jobId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }

  async evaluateBreaches(now = new Date()) {
    const result = await this.prisma.jobSla.updateMany({
      where: { deadline: { lt: now }, status: { in: ["ON_TRACK", "WARNING"] } },
      data: { status: "BREACHED", breachedAt: now },
    });
    const warning = await this.prisma.jobSla.findMany({ where: { status: "ON_TRACK", deadline: { gte: now, lte: new Date(now.getTime() + 24 * 3600000) }, policy: { warningHours: { not: null } } }, select: { id: true, deadline: true, policy: { select: { warningHours: true } } } });
    let warnings = 0;
    for (const record of warning) {
      if (record.policy?.warningHours && record.deadline.getTime() - now.getTime() <= record.policy.warningHours * 3600000) {
        await this.prisma.jobSla.update({ where: { id: record.id }, data: { status: "WARNING" } });
        warnings++;
      }
    }
    return { breached: result.count, warnings };
  }

  async providerScore(providerId: string) {
    const records = await this.prisma.jobSla.findMany({ where: { job: { contract: { providerId } } }, select: { status: true } });
    const completed = records.filter((r) => r.status === "COMPLETED").length;
    const onTime = records.filter((r) => r.status === "COMPLETED" || r.status === "ON_TRACK" || r.status === "WARNING").length;
    return { total: records.length, breached: records.filter((r) => r.status === "BREACHED").length, complianceScore: records.length ? Number(((onTime / records.length) * 100).toFixed(1)) : 100 };
  }

  private assertAccess(user: AuthUser, organizationId: string, providerId: string) {
    if (user.role !== "ADMIN" && user.hiringOrgId !== organizationId && user.providerId !== providerId) throw new ForbiddenException("Access denied");
  }
}

export function parseSlaHours(value?: string | null) {
  if (!value) return undefined;
  const match = value.match(/(\d+(?:\.\d+)?)\s*(hour|hr|day|d)/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Math.max(1, Math.round(amount * (/day|d/i.test(match[2]) ? 24 : 1)));
}
