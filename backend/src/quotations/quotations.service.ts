import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Quotation lifecycle with transactional state changes.
 * - Providers can only quote on OPEN requests.
 * - A service request may have at most ONE accepted quotation.
 */
@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  async list(user: AuthUser, providerId?: string, organizationId?: string, q: PaginationDto = new PaginationDto()) {
    const where: any = {};
    if (user.role === "PROVIDER" && user.providerId) {
      where.providerId = user.providerId;
    } else if (user.role === "HIRING_ORG" && user.hiringOrgId) {
      // Hiring orgs only ever see quotations belonging to their own requests.
      where.serviceRequest = { organizationId: user.hiringOrgId, isArchived: false };
    } else if (organizationId) {
      where.serviceRequest = { organizationId, isArchived: false };
    } else if (providerId) {
      where.providerId = providerId;
    }
    const [total, items] = await Promise.all([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: "desc" },
        include: { provider: true, serviceRequest: { select: { id: true, title: true, status: true, buildingId: true, budget: true, category: { select: { name: true } } } } },
      }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  /** Providers browse all OPEN service requests they can quote on. */
  async openRequests(user: AuthUser) {
    if (user.role !== "PROVIDER") throw new ForbiddenException("Only providers can browse open requests");
    return this.prisma.serviceRequest.findMany({
      where: { status: "OPEN", isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, title: true, description: true, budget: true, priority: true,
        preferredDate: true, createdAt: true, status: true,
        building: { select: { name: true, city: true } },
        category: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });
  }

  async forRequest(user: AuthUser, requestId: string) {
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true, organizationId: true, status: true } });
    if (!sr) throw new NotFoundException("Service request not found");
    if (sr.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    return this.prisma.quotation.findMany({
      where: { serviceRequestId: requestId },
      orderBy: { createdAt: "desc" },
      include: { provider: true },
    });
  }

  async get(user: AuthUser, id: string) {
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { serviceRequest: true, provider: true } });
    if (!q) throw new NotFoundException("Quotation not found");
    if (user.role === "PROVIDER") {
      if (q.providerId !== user.providerId) throw new ForbiddenException("Access denied");
    } else if (user.hiringOrgId) {
      if (q.serviceRequest.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    }
    return q;
  }

  async create(user: AuthUser, dto: { serviceRequestId: string; price: number; numberOfWorkers: number; [k: string]: any }) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers can create quotations");
    const sr = await this.prisma.serviceRequest.findUnique({ where: { id: dto.serviceRequestId }, select: { id: true, status: true } });
    if (!sr) throw new NotFoundException("Service request not found");
    if (sr.status !== "OPEN") throw new BadRequestException("Quotation can only be submitted for an OPEN request");
    const exists = await this.prisma.quotation.findFirst({ where: { serviceRequestId: dto.serviceRequestId, providerId: user.providerId } });
    if (exists) throw new ConflictException("You already have a quotation for this request");
    const q = await this.prisma.quotation.create({
      data: {
        serviceRequestId: dto.serviceRequestId,
        providerId: user.providerId,
        price: dto.price,
        laborCost: dto.laborCost,
        materialCost: dto.materialCost,
        numberOfWorkers: dto.numberOfWorkers,
        duration: dto.duration,
        equipment: dto.equipment,
        sla: dto.sla,
        warranty: dto.warranty,
        terms: dto.terms,
        expiryDate: dto.expiryDate,
        notes: dto.notes,
        status: "DRAFT",
      },
    });
    void this.audit.log({ actorId: user.userId, action: "QUOTATION_CREATED", entityType: "Quotation", entityId: q.id, details: dto });
    return q;
  }

  async submit(user: AuthUser, id: string) {
    const q = await this.get(user, id);
    if (q.providerId !== user.providerId) throw new ForbiddenException("Not your quotation");
    if (q.status !== "DRAFT") throw new BadRequestException("Only drafts can be submitted");
    const updated = await this.prisma.quotation.update({ where: { id }, data: { status: "SUBMITTED" } });
    await this.prisma.serviceRequest.updateMany({ where: { id: q.serviceRequestId, status: "OPEN" }, data: { status: "QUOTATIONS_RECEIVED" } });
    void this.audit.log({ actorId: user.userId, action: "QUOTATION_SUBMITTED", entityType: "Quotation", entityId: id });
    void this.notifications.notifyOrganization((q as any).serviceRequest.organizationId, { type: "QUOTATION_RECEIVED", title: "New quotation received", message: `A provider submitted a quotation of ${q.price}.` });
    void this.notifications.notify({ userId: user.userId, type: "QUOTATION_RECEIVED", title: "Quotation submitted", message: "Your quotation has been submitted." });
    return updated;
  }

  async update(user: AuthUser, id: string, dto: any) {
    const q = await this.get(user, id);
    const updated = await this.prisma.quotation.update({ where: { id }, data: { ...dto } });
    void this.audit.log({ actorId: user.userId, action: "QUOTATION_UPDATED", entityType: "Quotation", entityId: id, details: dto });
    return updated;
  }

  async withdraw(user: AuthUser, id: string) {
    const q = await this.get(user, id);
    if (q.providerId !== user.providerId) throw new ForbiddenException("Not your quotation");
    if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"].includes(q.status)) {
      throw new BadRequestException(`Cannot withdraw a quotation in ${q.status} status`);
    }
    const updated = await this.prisma.quotation.update({ where: { id }, data: { status: "WITHDRAWN" } });
    void this.audit.log({ actorId: user.userId, action: "QUOTATION_WITHDRAWN", entityType: "Quotation", entityId: id });
    return updated;
  }

  /** Hiring-org accepts a quotation. Transactional: prevents two accepts. */
  async accept(user: AuthUser, id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: { serviceRequest: { include: { organization: true, building: true, category: true } }, provider: true },
    });
    if (!q) throw new NotFoundException("Quotation not found");
    if (q.serviceRequest.organizationId !== user.hiringOrgId) throw new ForbiddenException("Not your quotation");
    if (q.serviceRequest.status === "PROVIDER_SELECTED") throw new BadRequestException("A provider has already been selected for this request");
    if (q.status !== "SUBMITTED" && q.status !== "SHORTLISTED") throw new BadRequestException(`Cannot accept quotation in ${q.status} status`);

    await this.prisma.$transaction(async (tx) => {
      const lockedRequest = await tx.serviceRequest.updateMany({
        where: { id: q.serviceRequest.id, status: { not: "PROVIDER_SELECTED" } },
        data: { status: "PROVIDER_SELECTED" },
      });
      if (lockedRequest.count !== 1) throw new BadRequestException("A provider has already been selected for this request");
      await tx.quotation.update({ where: { id }, data: { status: "ACCEPTED", shortlistedAt: new Date() } });
      await tx.quotation.updateMany({
        where: { serviceRequestId: q.serviceRequest.id, id: { not: id }, status: { in: ["SUBMITTED", "SHORTLISTED", "UNDER_REVIEW", "ACCEPTED"] } },
        data: { status: "REJECTED" },
      });

      // Auto-create the contract for the accepted quotation (one per quotation).
      const existingContract = await tx.contract.findUnique({ where: { quotationId: id } });
      if (!existingContract) {
        const start = new Date();
        const end = new Date();
        end.setFullYear(end.getFullYear() + 1);
        const contract = await tx.contract.create({
          data: {
            organizationId: q.serviceRequest.organizationId,
            providerId: q.providerId,
            serviceRequestId: q.serviceRequest.id,
            quotationId: id,
            buildingId: q.serviceRequest.buildingId,
            serviceName: q.serviceRequest.category?.name ?? q.serviceRequest.title,
            title: `${q.serviceRequest.category?.name ?? q.serviceRequest.title} - ${q.provider.name}`,
            price: q.price,
            startDate: start,
            endDate: end,
            sla: q.sla ?? null,
            status: "ACTIVE",
          },
        });
        const orgUser = await tx.user.findFirst({
          where: { hiringOrgId: q.serviceRequest.organizationId },
          select: { id: true },
        });
        await tx.contractVersion.create({
          data: { contractId: contract.id, version: 1, creatorId: orgUser?.id ?? user.userId, snapshot: JSON.stringify(contract) },
        });
      }
    });

    void this.audit.log({ actorId: user.userId, action: "QUOTATION_ACCEPTED", entityType: "Quotation", entityId: id, details: { requestId: q.serviceRequest.id } });
    const providerUser = await this.prisma.user.findFirst({ where: { providerId: q.providerId }, select: { id: true } });
    void this.notifications.notify({ userId: providerUser?.id ?? user.userId, type: "PROVIDER_SELECTED", title: "Quotation accepted", message: "Your quotation was accepted and a contract was created." });
    return { ...q, status: "ACCEPTED" };
  }
}
