import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Approval and rework workflow. Preserves all prior proof-of-work history.
 */
@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  private async loadJob(user: AuthUser, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: { include: { organization: true } }, proofOfWork: true } });
    if (!job) throw new NotFoundException("Job not found");
    if (user.role === "HIRING_ORG" && job.contract.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    return job;
  }

  async list(user: AuthUser, jobId: string) {
    const job = await this.loadJob(user, jobId);
    return this.prisma.approval.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } });
  }

  async approve(user: AuthUser, jobId: string, notes?: string) {
    const job = await this.loadJob(user, jobId);
    if (job.status !== "COMPLETED" && job.status !== "AWAITING_APPROVAL") throw new BadRequestException("Job must be awaiting approval");
    if (!job.proofOfWork) throw new BadRequestException("No proof of work submitted");
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { status: "AWAITING_APPROVAL" } });
      await tx.approval.create({ data: { jobId: job.id, decision: "APPROVED", approvedByUserId: user.userId, notes } });
      // generate an invoice for the approved job's contract
      const contract = await tx.contract.findUnique({ where: { id: job.contractId }, select: { id: true, price: true, providerId: true, organizationId: true } });
      const existingInvoice = await tx.invoice.findFirst({ where: { jobId: job.id } });
      if (contract && !existingInvoice) {
        const number = `INV-${contract.id.slice(0, 8).toUpperCase()}-${job.id.slice(0, 8).toUpperCase()}`;
        await tx.invoice.create({
          data: {
            invoiceNumber: number,
            providerId: contract.providerId,
            organizationId: contract.organizationId,
            contractId: contract.id,
            jobId: job.id,
            amount: contract.price,
            tax: 0,
            discount: 0,
            total: contract.price,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "ISSUED",
            issuedById: user.userId,
          },
        });
        void this.notifications.notify({ userId: user.userId, type: "INVOICE_ISSUED", title: "Invoice issued", message: "An invoice was issued for the approved job." });
      }
    });
    void this.audit.log({ actorId: user.userId, action: "JOB_APPROVED", entityType: "Job", entityId: jobId, details: { notes } });
    await this.notifications.notifyProvider(job.contract.providerId, { type: "JOB_APPROVED", title: "Job approved", message: `"${job.title ?? "Job"}" was approved by the client. An invoice was issued.` });
    return { jobId, decision: "APPROVED" };
  }

  async requestRework(user: AuthUser, jobId: string, reason?: string) {
    const job = await this.loadJob(user, jobId);
    if (job.status !== "COMPLETED" && job.status !== "AWAITING_APPROVAL") throw new BadRequestException("Job must be awaiting approval");
    if (!job.proofOfWork) throw new BadRequestException("No proof of work submitted");
    const maxAttempt = await this.prisma.reworkRequest.aggregate({ where: { jobId: job.id }, _max: { attemptNumber: true } });
    const attempt = (maxAttempt?._max?.attemptNumber ?? 0) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { status: "REWORK" } });
      await tx.approval.create({ data: { jobId: job.id, decision: "REWORK_REQUESTED", approvedByUserId: user.userId, notes: reason } });
      await tx.reworkRequest.create({ data: { jobId: job.id, reason: reason ?? '', requestedById: user.userId, attemptNumber: attempt } });
    });
    void this.audit.log({ actorId: user.userId, action: "REWORK_REQUESTED", entityType: "Job", entityId: jobId, details: { reason, attempt } });
    await this.notifications.notifyProvider(job.contract.providerId, { type: "REWORK_REQUESTED", title: "Rework requested", message: `Rework requested for "${job.title ?? "job"}": ${reason ?? ""}` });
    void this.notifications.notify({ userId: user.userId, type: "REWORK_REQUESTED", title: "Rework requested", message: `Rework requested: ${reason ?? ""}` });
    return { jobId, status: "REWORK", attempt };
  }
}
