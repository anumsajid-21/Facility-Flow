import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ProvidersService } from "../providers/providers.service";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private providersService: ProvidersService) {}

  async dashboard() {
    const [totalOrganizations, totalProviders, totalServiceRequests, activeContracts, recentOrgs, recentProviders, recentRequests] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.provider.count(),
      this.prisma.serviceRequest.count({ where: { isArchived: false } }),
      this.prisma.contract.count({ where: { status: "ACTIVE" } }),
      this.prisma.organization.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { members: { include: { user: { select: { name: true, email: true } } } } } }),
      this.prisma.provider.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.serviceRequest.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { organization: true, building: true } }),
    ]);
    return {
      totalOrganizations,
      totalProviders,
      totalServiceRequests,
      activeContracts,
      recentOrganizations: recentOrgs,
      recentProviders: recentProviders,
      recentServiceRequests: recentRequests,
    };
  }

  async recentActivity() {
    return this.audit.list({}, 20);
  }

  async providers() {
    return this.prisma.provider.findMany({
      orderBy: { verificationStatus: "asc" },
      include: {
        documents: { include: { file: true } },
        _count: { select: { quotations: true, contracts: true, reviews: true } },
      },
    });
  }

  async organizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
    });
  }

  async users() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { hiringOrg: { select: { id: true, name: true } }, provider: { select: { id: true, name: true } } },
    });
  }

  async serviceRequests(q: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { isArchived: false } }),
      this.prisma.serviceRequest.findMany({
        where: { isArchived: false },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: "desc" },
        include: { organization: true, building: true, category: true },
      }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async buildings(q: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.building.count({ where: { isArchived: false } }),
      this.prisma.building.findMany({
        where: { isArchived: false },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: "asc" },
        include: { organization: true, floors: { include: { areas: true } } },
      }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async verifyProvider(id: string, status: string, notes?: string) {
    const validStatuses = ["UNVERIFIED", "DOCUMENTS_SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"];
    if (!validStatuses.includes(status)) throw new BadRequestException("Invalid verification status");
    const provider = await this.prisma.provider.update({ where: { id }, data: { verificationStatus: status as any } });
    void this.audit.log({ action: "PROVIDER_VERIFICATION", entityType: "Provider", entityId: id, details: { status, notes } });
    const users = await this.prisma.user.findMany({ where: { providerId: id }, select: { id: true } });
    for (const u of users) {
      void this.notifications.notify({ userId: u.id, type: "PROVIDER_VERIFIED", title: "Verification status updated", message: `Your provider verification status: ${status}` });
    }
    return provider;
  }

  verificationQueue() {
    return this.providersService.verificationQueue();
  }

  bulkReviewDocuments(ids: string[], status: "APPROVED" | "REJECTED", notes: string | undefined, adminUserId: string) {
    return this.providersService.bulkReview(ids, status, notes, adminUserId);
  }
}