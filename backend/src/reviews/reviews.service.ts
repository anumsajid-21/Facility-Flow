import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Provider reviews by hiring organizations. Prevents duplicate / premature /
 * unauthorized reviews. Ratings roll up from real reviews.
 */
@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  async byProvider(providerId: string) {
    const [total, items] = await Promise.all([
      this.prisma.review.count({ where: { providerId } }),
      this.prisma.review.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } }),
    ]);
    const avg = await this.prisma.review.aggregate({ where: { providerId }, _avg: { quality: true, timeliness: true, professionalism: true, value: true, overallRating: true } });
    return { providerId, total, items, average: avg._avg };
  }

  /** Reviews the org has written, for the Reviews table. */
  async listForOrg(user: AuthUser) {
    if (!user.hiringOrgId) throw new ForbiddenException("Only hiring organizations can list their reviews");
    return this.prisma.review.findMany({
      where: { organizationId: user.hiringOrgId },
      orderBy: { createdAt: "desc" },
      include: {
        provider: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async create(user: AuthUser, jobId: string, providerId: string, dto: any) {
    if (user.role !== "HIRING_ORG" || !user.hiringOrgId) throw new ForbiddenException("Only hiring organizations can review providers");
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: { include: { provider: true, organization: true } }, approvals: true } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.contract.organizationId !== user.hiringOrgId) throw new ForbiddenException("Not your job");
    if (job.contract.providerId !== providerId) throw new BadRequestException("Provider does not match the job");
    const hasApproved = job.approvals.some((a) => a.decision === "APPROVED");
    if (!hasApproved) throw new BadRequestException("Job must be approved before reviewing");
    const exists = await this.prisma.review.findFirst({ where: { providerId, organizationId: user.hiringOrgId, jobId } });
    if (exists) throw new ConflictException("You already reviewed this provider for this job");
    const review = await this.prisma.review.create({
      data: {
        providerId,
        organizationId: user.hiringOrgId,
        jobId,
        quality: dto.quality,
        timeliness: dto.timeliness,
        professionalism: dto.professionalism,
        value: dto.value,
        overallRating: dto.overallRating,
        comments: dto.comments,
      },
    });
    void this.audit.log({ actorId: user.userId, action: "REVIEW_CREATED", entityType: "Review", entityId: review.id, details: { providerId, jobId, overall: dto.overallRating } });
    void this.notifications.notify({ userId: user.userId, type: "REVIEW_CREATED", title: "Review submitted", message: "You submitted a provider review." });
    return review;
  }
}
