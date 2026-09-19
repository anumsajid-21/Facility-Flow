import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RecurrenceFrequency } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { SlaService } from "../sla/sla.service";

@Injectable()
export class RecurringService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private sla: SlaService) {}

  onModuleInit() {
    void this.generateDue();
    this.timer = setInterval(() => void this.generateDue(), 15 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async get(user: AuthUser, contractId: string) {
    const contract = await this.contract(user, contractId);
    return this.prisma.contractSchedule.findUnique({ where: { contractId: contract.id } });
  }

  async create(user: AuthUser, contractId: string, dto: { frequency: RecurrenceFrequency; startsAt: string; endsAt?: string; occurrencesLimit?: number }) {
    const contract = await this.contract(user, contractId);
    if (contract.status !== "ACTIVE") throw new BadRequestException("Only active contracts can be scheduled");
    if (!dto.startsAt || !Object.values(RecurrenceFrequency).includes(dto.frequency)) throw new BadRequestException("A valid frequency and startsAt are required");
    return this.prisma.contractSchedule.upsert({
      where: { contractId },
      update: { frequency: dto.frequency, startsAt: new Date(dto.startsAt), nextRunAt: new Date(dto.startsAt), endsAt: dto.endsAt ? new Date(dto.endsAt) : null, occurrencesLimit: dto.occurrencesLimit ?? null, paused: false },
      create: { contractId, frequency: dto.frequency, startsAt: new Date(dto.startsAt), nextRunAt: new Date(dto.startsAt), endsAt: dto.endsAt ? new Date(dto.endsAt) : null, occurrencesLimit: dto.occurrencesLimit },
    });
  }

  async pause(user: AuthUser, contractId: string, paused: boolean) {
    await this.contract(user, contractId);
    return this.prisma.contractSchedule.update({ where: { contractId }, data: { paused } });
  }

  async generateDue(now = new Date()) {
    const schedules = await this.prisma.contractSchedule.findMany({
      where: { paused: false, nextRunAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }], },
      include: { contract: { include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } } } },
      take: 100,
    });
    let generated = 0;
    for (const schedule of schedules) {
      if (schedule.occurrencesLimit !== null && schedule.occurrences >= schedule.occurrencesLimit) {
        await this.prisma.contractSchedule.update({ where: { id: schedule.id }, data: { paused: true } });
        continue;
      }
      const template = schedule.contract.jobs[0];
      const start = template ? new Date(schedule.nextRunAt.getTime() + (template.startTime.getTime() - template.date.getTime())) : new Date(schedule.nextRunAt);
      const end = template ? new Date(start.getTime() + (template.endTime.getTime() - template.startTime.getTime())) : new Date(start.getTime() + 3600000);
      let generatedJobId = "";
      await this.prisma.$transaction(async (tx) => {
        const generated = await tx.job.create({
          data: {
            contractId: schedule.contractId,
            buildingId: schedule.contract.buildingId,
            floorId: template?.floorId,
            areaId: template?.areaId,
            title: template?.title ?? schedule.contract.title ?? schedule.contract.serviceName ?? "Recurring service",
            location: template?.location,
            date: schedule.nextRunAt,
            startTime: start,
            endTime: end,
            instructions: template?.instructions,
            requiredSkills: template?.requiredSkills,
            serviceName: schedule.contract.serviceName,
            status: "SCHEDULED",
          },
        });
        generatedJobId = generated.id;
        const nextRunAt = nextOccurrence(schedule.nextRunAt, schedule.frequency);
        await tx.contractSchedule.update({ where: { id: schedule.id }, data: { occurrences: { increment: 1 }, lastGeneratedAt: now, nextRunAt, paused: schedule.occurrencesLimit !== null && schedule.occurrences + 1 >= schedule.occurrencesLimit } });
      });
      await this.sla.createForJob(generatedJobId);
      generated++;
    }
    return { generated };
  }

  private async contract(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id }, select: { id: true, organizationId: true, providerId: true, status: true, buildingId: true, serviceName: true, title: true } });
    if (!contract) throw new NotFoundException("Contract not found");
    if (user.role !== "ADMIN" && user.hiringOrgId !== contract.organizationId && user.providerId !== contract.providerId) throw new ForbiddenException("Access denied");
    return contract;
  }
}

function nextOccurrence(date: Date, frequency: RecurrenceFrequency) {
  const next = new Date(date);
  if (frequency === "DAILY") next.setDate(next.getDate() + 1);
  else if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3);
  else next.setDate(next.getDate() + 7);
  return next;
}
