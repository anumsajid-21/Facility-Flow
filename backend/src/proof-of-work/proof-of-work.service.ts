import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Proof-of-work management: before/after photos, notes, completion metadata.
 */
@Injectable()
export class ProofOfWorkService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  private async loadJob(user: AuthUser, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { contract: { include: { provider: true, organization: true } } },
    });
    if (!job) throw new NotFoundException("Job not found");
    const isProvider = user.role === "PROVIDER" && user.providerId === job.contract.providerId;
    const isHiring = user.role === "HIRING_ORG" && user.hiringOrgId === job.contract.organizationId;
    const isWorker = user.role === "WORKER" && user.workerId ? (await this.prisma.workerAssignment.count({ where: { jobId: job.id, workerId: user.workerId } })) > 0 : false;
    if (!isProvider && !isHiring && !isWorker && user.role !== "ADMIN") throw new ForbiddenException("Access denied");
    return { job, isProvider, isHiring, isWorker };
  }

  async add(user: AuthUser, jobId: string, dto: any, beforePhotoIds: string[], afterPhotoIds: string[]) {
    const { job, isProvider, isWorker } = await this.loadJob(user, jobId);
    if (!isProvider && !isWorker) throw new ForbiddenException("Only the assigned provider or worker can add proof of work");
    if (job.status !== "IN_PROGRESS" && job.status !== "REWORK") throw new BadRequestException("Job must be in progress to add proof");
    const photoIds = [...beforePhotoIds, ...afterPhotoIds];
    if (photoIds.length) {
      const photos = await this.prisma.file.findMany({ where: { id: { in: photoIds }, kind: "JOB_PHOTO", uploadedById: user.userId }, select: { id: true } });
      if (photos.length !== new Set(photoIds).size) throw new ForbiddenException("Each photo must be uploaded by you for this job");
    }
    const existing = await this.prisma.proofOfWork.findFirst({ where: { jobId } });
    const data: any = {
      jobId,
      providerNote: dto.providerNote,
      completionNote: dto.completionNote,
      completedById: user.userId,
      workerName: dto.workerName,
    };
    const txData: any = {};
    if (beforePhotoIds.length) txData.beforePhotos = { connect: beforePhotoIds.map((id) => ({ id })) };
    if (afterPhotoIds.length) txData.afterPhotos = { connect: afterPhotoIds.map((id) => ({ id })) };
    let proof;
    if (existing) {
      proof = await this.prisma.proofOfWork.update({ where: { id: existing.id }, data: { ...data, ...txData } });
    } else {
      proof = await this.prisma.proofOfWork.create({ data: { ...data, ...txData } });
    }
    void this.audit.log({ actorId: user.userId, action: "PROOF_OF_WORK_ADDED", entityType: "ProofOfWork", entityId: proof.id, details: { jobId } });
    void this.notifications.notify({ userId: user.userId, type: "JOB_COMPLETED", title: "Proof of work submitted", message: "Proof of work has been submitted for approval." });
    return proof;
  }

  async get(user: AuthUser, jobId: string) {
    const { job, isProvider, isHiring } = await this.loadJob(user, jobId);
    const proof = await this.prisma.proofOfWork.findFirst({ where: { jobId }, include: { beforePhotos: true, afterPhotos: true, completer: { select: { id: true, name: true, email: true } } } });
    if (!proof) throw new NotFoundException("No proof of work for this job");
    return proof;
  }

  async byProvider(providerId: string) {
    return this.prisma.proofOfWork.findMany({
      where: { job: { contract: { providerId } } },
      include: {
        beforePhotos: true,
        afterPhotos: true,
        job: {
          select: {
            id: true,
            title: true,
            serviceName: true,
            date: true,
            status: true,
            building: { select: { name: true } },
          },
        },
        completer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { completedAt: "desc" },
    });
  }
}
