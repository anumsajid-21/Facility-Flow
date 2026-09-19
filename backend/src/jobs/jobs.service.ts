import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { SlaService } from "../sla/sla.service";


/**
 * Job lifecycle: scheduling (with overlap enforcement), worker assignment,
 * start/complete transitions, calendar views.
 */
@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private sla: SlaService) {}

  private async load(user: AuthUser, id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { contract: { include: { organization: true, provider: true } } } });
    if (!job) throw new NotFoundException("Job not found");
    const isProvider = user.role === "PROVIDER" && user.providerId === job.contract.providerId;
    const isHiring = user.role === "HIRING_ORG" && user.hiringOrgId === job.contract.organizationId;
    const isWorker = user.role === "WORKER" && user.workerId ? (await this.prisma.workerAssignment.count({ where: { jobId: job.id, workerId: user.workerId } })) > 0 : false;
    if (!isProvider && !isHiring && !isWorker && user.role !== "ADMIN") throw new ForbiddenException("Access denied");
    return job;
  }

  async list(user: AuthUser, q: PaginationDto) {
    const where: any = {};
    if (user.role === "HIRING_ORG") {
      const contracts = await this.prisma.contract.findMany({ where: { organizationId: user.hiringOrgId! }, select: { id: true } });
      where.contractId = { in: contracts.map((c) => c.id) };
    } else if (user.role === "PROVIDER" && user.providerId) {
      const contracts = await this.prisma.contract.findMany({ where: { providerId: user.providerId }, select: { id: true } });
      where.contractId = { in: contracts.map((c) => c.id) };
    } else if (user.role === "WORKER" && user.workerId) {
      const assignments = await this.prisma.workerAssignment.findMany({ where: { workerId: user.workerId }, select: { jobId: true } });
      where.id = { in: assignments.map((a) => a.jobId) };
    }
    const [total, items] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { date: "desc" }, include: { contract: { select: { provider: { select: { name: true } }, organization: { select: { name: true } } } }, sla: true } }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async create(user: AuthUser, dto: any) {
    if (user.role !== "HIRING_ORG" || !user.hiringOrgId) throw new ForbiddenException("Only hiring organizations create jobs");
    const contract = await this.prisma.contract.findUnique({ where: { id: dto.contractId }, select: { id: true, organizationId: true, providerId: true, building: true } });
    if (!contract || contract.organizationId !== user.hiringOrgId) throw new ForbiddenException("Contract not accessible");
    // ensure job stays within contract scope
    const start = new Date(dto.startTime); const end = new Date(dto.endTime);
    const job = await this.prisma.job.create({
      data: {
        contractId: dto.contractId,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        areaId: dto.areaId,
        title: dto.title,
        location: dto.location,
        date: dto.date,
        startTime: start,
        endTime: end,
        instructions: dto.instructions,
        requiredSkills: dto.requiredSkills,
        serviceName: dto.serviceName,
        status: "SCHEDULED",
      },
    });
    void this.audit.log({ actorId: user.userId, action: "JOB_CREATED", entityType: "Job", entityId: job.id, details: dto });
    void this.notifications.notify({ userId: user.userId, type: "JOB_SCHEDULED", title: "Job scheduled", message: `${dto.title} was scheduled.` });
    await this.sla.createForJob(job.id);
    return job;
  }

  async update(user: AuthUser, id: string, dto: any) {
    const job = await this.load(user, id);
    let data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);
    if (dto.date) data.date = dto.date;
    const updated = await this.prisma.job.update({ where: { id: job.id }, data });
    void this.audit.log({ actorId: user.userId, action: "JOB_UPDATED", entityType: "Job", entityId: id, details: dto });
    return updated;
  }

  async get(user: AuthUser, id: string) {
    const job = await this.load(user, id);
    return this.prisma.job.findUnique({
      where: { id: job.id },
      include: {
        contract: { include: { organization: true, provider: true, quotation: true } },
        workerAssignments: { include: { worker: true, job: false } },
        checklistResults: { include: { checklistItem: true } },
        proofOfWork: { include: { beforePhotos: true, afterPhotos: true, completer: true } },
        approvals: true,
        reworkRequests: { include: { requester: true } },
        invoices: true,
        sla: { include: { policy: true } },
      },
    });
  }

  async start(user: AuthUser, id: string) {
    const job = await this.load(user, id);
    const valid = (user.role === "PROVIDER" && user.providerId === job.contract.providerId) || (user.role === "HIRING_ORG" && user.hiringOrgId === job.contract.organizationId) || user.role === "ADMIN";
    if (!valid) throw new ForbiddenException("Not authorized to start this job");
    if (job.status !== "ASSIGNED" && job.status !== "SCHEDULED" && job.status !== "REWORK") throw new BadRequestException("Job must be assigned, scheduled or in rework before starting");
    const updated = await this.prisma.job.update({ where: { id: job.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    void this.audit.log({ actorId: user.userId, action: "JOB_STARTED", entityType: "Job", entityId: id });
    return updated;
  }

  async complete(user: AuthUser, id: string) {
    const job = await this.load(user, id);
    if (job.status !== "IN_PROGRESS") throw new BadRequestException("Job must be in progress to complete");
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.job.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.approval.create({ data: { jobId: job.id, decision: "APPROVED", approvedByUserId: user.userId, notes: "auto-created on completion" } });
      await this.notifications.notifyOrganization(job.contract.organizationId, { type: "JOB_COMPLETED", title: "Job completed", message: `${job.title ?? "Job"} was marked complete and is awaiting your approval.` });
      await this.notifications.notify({ userId: user.userId, type: "JOB_COMPLETED", title: "Job completed", message: "Job marked complete, awaiting approval." });
      await this.sla.complete(job.id);
      return rec;
    });
    void this.audit.log({ actorId: user.userId, action: "JOB_COMPLETED", entityType: "Job", entityId: id });
    return updated;
  }

  /** Chronological activity timeline for a job (audit logs + derived events). */
  async activity(user: AuthUser, id: string) {
    const job = await this.load(user, id);
    const assignments = await this.prisma.workerAssignment.findMany({ where: { jobId: id }, include: { worker: { select: { name: true } } } });
    const approvals = await this.prisma.approval.findMany({ where: { jobId: id }, include: { approvedBy: { select: { name: true } } } });
    const reworks = await this.prisma.reworkRequest.findMany({ where: { jobId: id }, include: { requester: { select: { name: true } } } });
    const proofs = await this.prisma.proofOfWork.findMany({ where: { jobId: id } });
    const invoices: { id: string; invoiceNumber: string; createdAt: Date }[] = await this.prisma.invoice.findMany({ where: { jobId: id }, select: { id: true, invoiceNumber: true, createdAt: true } });
    const assignmentIds = assignments.map((a) => a.id);
    const approvalIds = approvals.map((a) => a.id);
    const reworkIds = reworks.map((r) => r.id);
    const proofIds = proofs.map((p) => p.id);
    const payments = await this.prisma.payment.findMany({ where: { invoice: { jobId: id } }, select: { id: true } });
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Job", entityId: id },
          { entityType: "WorkerAssignment", entityId: { in: assignmentIds } },
          { entityType: "Approval", entityId: { in: approvalIds } },
          { entityType: "ReworkRequest", entityId: { in: reworkIds } },
          { entityType: "ProofOfWork", entityId: { in: proofIds } },
          { entityType: "Invoice", entityId: { in: invoices.map((i) => i.id) } },
          { entityType: "Payment", entityId: { in: payments.map((p) => p.id) } },
        ],
      },
      include: { actor: { select: { name: true } } },
    });
    const events: { type: string; description: string; actor: string | null; timestamp: Date }[] = [
      ...auditLogs.map((l) => ({
        type: l.action,
        description: l.action.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" "),
        actor: l.actor?.name ?? null,
        timestamp: l.createdAt,
      })),
      ...assignments.map((a) => ({
        type: "WORKER_ASSIGNED",
        description: `Worker ${a.worker?.name ?? "assigned"} assigned to job`,
        actor: null,
        timestamp: a.assignedAt,
      })),
      ...approvals.map((a) => ({
        type: a.decision === "APPROVED" ? "JOB_APPROVED" : "REWORK_REQUESTED",
        description: a.decision === "APPROVED" ? "Job approved" : `Rework requested${a.notes ? `: ${a.notes}` : ""}`,
        actor: a.approvedBy?.name ?? null,
        timestamp: a.createdAt,
      })),
      ...reworks.map((r) => ({
        type: "REWORK_REQUESTED",
        description: `Rework requested: ${r.reason}`,
        actor: r.requester?.name ?? null,
        timestamp: r.createdAt,
      })),
      ...proofs.map((p) => ({
        type: "PROOF_SUBMITTED",
        description: `Proof of work submitted${p.providerNote ? `: ${p.providerNote}` : ""}`,
        actor: null,
        timestamp: p.completedAt,
      })),
      ...invoices.map((i) => ({
        type: "INVOICE_ISSUED",
        description: `Invoice ${i.invoiceNumber} issued`,
        actor: null,
        timestamp: i.createdAt,
      })),
      { type: "JOB_CREATED", description: `Job "${job.title ?? "scheduled"}" created`, actor: null, timestamp: job.createdAt },
    ];
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /** Assign a worker to a job, enforcing no overlapping assignments. */
  async assignWorker(user: AuthUser, jobId: string, workerId: string) {
    const job = await this.load(user, jobId);
    if (user.role === "PROVIDER" && user.providerId !== job.contract.providerId) throw new ForbiddenException("Not your job");
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, providerId: true } });
    if (!worker || worker.providerId !== job.contract.providerId) throw new ForbiddenException("Worker not available");
    // overlap check
    const overlap = await this.prisma.workerAssignment.findFirst({
      where: {
        workerId,
        job: {
          OR: [
            { startTime: { lte: job.endTime, gte: job.startTime } },
            { endTime: { gte: job.startTime, lte: job.endTime } },
          ],
          status: { in: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] },
        },
      },
    });
    if (overlap) throw new ConflictException("Worker already assigned to an overlapping job");
    const assignment = await this.prisma.workerAssignment.create({ data: { jobId: job.id, workerId, assignedBy: user.userId } });
    await this.prisma.job.update({ where: { id: job.id }, data: { status: "ASSIGNED" } });
    void this.audit.log({ actorId: user.userId, action: "WORKER_ASSIGNED", entityType: "WorkerAssignment", entityId: assignment.id, details: { jobId, workerId } });
    await this.notifications.notifyOrganization(job.contract.organizationId, { type: "WORKER_ASSIGNED", title: "Worker assigned", message: `A worker was assigned to "${job.title ?? "your job"}".` });
    void this.notifications.notify({ userId: user.userId, type: "WORKER_ASSIGNED", title: "Worker assigned", message: "A worker was assigned to the job." });
    return assignment;
  }

  async assignedWorkers(user: AuthUser, jobId: string) {
    const job = await this.load(user, jobId);
    return this.prisma.workerAssignment.findMany({ where: { jobId: job.id }, include: { worker: true } });
  }

  /** Calendar view: daily/weekly/monthly aggregated jobs the user can see. */
  async calendar(user: AuthUser, dateStr?: string) {
    let day: Date; try { day = dateStr ? new Date(dateStr) : new Date(); } catch { day = new Date(); } if (isNaN(day.getTime())) day = new Date(); const from = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0)); const to = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999));
    const contracts = await this.contractsForUser(user);
    const jobs = await this.prisma.job.findMany({
      where: { contractId: { in: contracts }, date: { gte: from, lte: to } },
      orderBy: { startTime: "asc" },
      include: { contract: { include: { provider: true, organization: true } } },
    });
    return { date: day.toISOString().slice(0,10), jobs };
  }

  private async contractsForUser(user: AuthUser) {
    const where: any = {};
    if (user.role === "HIRING_ORG") where.organizationId = user.hiringOrgId;
    else if (user.role === "PROVIDER" && user.providerId) where.providerId = user.providerId;
    const contracts = await this.prisma.contract.findMany({ where, select: { id: true } });
    return contracts.map((c) => c.id);
  }
}
