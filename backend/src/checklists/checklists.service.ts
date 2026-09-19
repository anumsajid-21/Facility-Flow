import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";

/**
 * Configurable service checklists and per-job result capture.
 */
@Injectable()
export class ChecklistsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(user: AuthUser) {
    if (user.role === "PROVIDER" && user.providerId) {
      return this.prisma.checklist.findMany({ where: { providerId: user.providerId, isActive: true } });
    }
    return this.prisma.checklist.findMany({ where: { providerId: null, isActive: true } });
  }

  async byCategory(user: AuthUser, categoryId: string) {
    const where: any = { categoryId, isActive: true };
    if (user.role === "PROVIDER" && user.providerId) where.OR = [{ providerId: user.providerId }, { providerId: null }];
    return this.prisma.checklist.findMany({ where, include: { items: true } });
  }

  async get(user: AuthUser, id: string) {
    const c = await this.prisma.checklist.findUnique({ where: { id }, include: { items: true } });
    if (!c) throw new NotFoundException("Checklist not found");
    if (user.role === "PROVIDER" && c.providerId && c.providerId !== user.providerId) throw new ForbiddenException("Access denied");
    return c;
  }

  async create(user: AuthUser, dto: any, items: any[]) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers can create checklists");
    const c = await this.prisma.$transaction(async (tx) => {
      const checklist = await tx.checklist.create({ data: { ...dto, providerId: user.providerId, categoryId: dto.categoryId ?? null } });
      await tx.checklistItem.createMany({ data: items.map((i) => ({ checklistId: checklist.id, description: i.description, sortOrder: i.sortOrder ?? 0 })) });
      return checklist;
    });
    void this.audit.log({ actorId: user.userId, action: "CHECKLIST_CREATED", entityType: "Checklist", entityId: c.id, details: dto });
    return this.get(user, c.id);
  }

  async saveResults(user: AuthUser, jobId: string, results: { checklistItemId: string; isChecked: boolean; notes?: string }[]) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers can record results");
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: { select: { providerId: true } } } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.contract.providerId !== user.providerId) throw new ForbiddenException("Not your job");
    await this.prisma.$transaction(async (tx) => {
      for (const r of results) {
        await tx.jobChecklistResult.upsert({
          where: { jobId_checklistItemId: { jobId, checklistItemId: r.checklistItemId } },
          update: { isChecked: r.isChecked, notes: r.notes, checkedAt: new Date() },
          create: { jobId, checklistItemId: r.checklistItemId, isChecked: r.isChecked, notes: r.notes, checkedAt: new Date() },
        });
      }
    });
    void this.audit.log({ actorId: user.userId, action: "CHECKLIST_RESULTS_SAVED", entityType: "Job", entityId: jobId });
    return { jobId, saved: results.length };
  }

  async jobResults(user: AuthUser, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: { select: { providerId: true, organizationId: true } } } });
    if (!job) throw new NotFoundException("Job not found");
    const isProvider = user.role === "PROVIDER" && user.providerId === job.contract.providerId;
    const isHiring = user.role === "HIRING_ORG" && user.hiringOrgId === job.contract.organizationId;
    if (!isProvider && !isHiring && user.role !== "ADMIN") throw new ForbiddenException("Access denied");
    return this.prisma.jobChecklistResult.findMany({ where: { jobId }, include: { checklistItem: true } });
  }
}
