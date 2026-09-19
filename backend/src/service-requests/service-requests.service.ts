import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";

export type SRStatus = "DRAFT" | "OPEN" | "QUOTATIONS_RECEIVED" | "UNDER_REVIEW" | "PROVIDER_SELECTED" | "CANCELLED" | "CLOSED";

/**
 * Hiring-organization service-request lifecycle + tenant-isolated access.
 */
@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  async list(user: AuthUser, q: PaginationDto, onlyOpen: boolean) {
    const orgId = user.hiringOrgId!;
    const where: any = { organizationId: orgId, isArchived: false };
    if (onlyOpen) where.status = { in: ["OPEN", "QUOTATIONS_RECEIVED", "UNDER_REVIEW", "PROVIDER_SELECTED"] };
    const [total, items] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        include: { building: { select: { name: true } } },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async get(user: AuthUser, id: string) {
    const sr = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { building: true, floor: true, area: true, category: true, attachments: true, quotations: true },
    });
    if (!sr) throw new NotFoundException("Service request not found");
    if (sr.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    return sr;
  }

  async create(user: AuthUser, dto: any) {
    const orgId = user.hiringOrgId!;
    const building = await this.prisma.building.findUnique({ where: { id: dto.buildingId }, select: { id: true, organizationId: true } });
    if (!building || building.organizationId !== orgId) throw new ForbiddenException("Building not accessible");

    const categoryId = dto.categoryId && dto.categoryId.trim() ? dto.categoryId.trim() : undefined;
    const floorId = dto.floorId && dto.floorId.trim() ? dto.floorId.trim() : undefined;
    const areaId = dto.areaId && dto.areaId.trim() ? dto.areaId.trim() : undefined;
    const preferredDate = dto.preferredDate ? new Date(dto.preferredDate) : undefined;
    const budget = dto.budget !== undefined && dto.budget !== null && dto.budget !== "" ? Number(dto.budget) : undefined;

    const sr = await this.prisma.serviceRequest.create({
      data: {
        title: dto.title,
        description: dto.description,
        categoryId,
        buildingId: dto.buildingId,
        floorId,
        areaId,
        requirements: dto.requirements || undefined,
        preferredDate,
        frequency: dto.frequency || undefined,
        budget,
        priority: dto.priority || "NORMAL",
        organizationId: orgId,
        status: "DRAFT",
      },
    });
    void this.audit.log({ actorId: user.userId, action: "SERVICE_REQUEST_CREATED", entityType: "ServiceRequest", entityId: sr.id, details: dto });
    return sr;
  }

  async update(user: AuthUser, id: string, dto: any) {
    const sr = await this.get(user, id);
    const dataToUpdate: any = { ...dto, updatedAt: new Date() };
    if (dto.preferredDate) dataToUpdate.preferredDate = new Date(dto.preferredDate);
    if (dto.categoryId !== undefined) dataToUpdate.categoryId = dto.categoryId && dto.categoryId.trim() ? dto.categoryId.trim() : null;
    if (dto.floorId !== undefined) dataToUpdate.floorId = dto.floorId && dto.floorId.trim() ? dto.floorId.trim() : null;
    if (dto.areaId !== undefined) dataToUpdate.areaId = dto.areaId && dto.areaId.trim() ? dto.areaId.trim() : null;
    if (dto.budget !== undefined) dataToUpdate.budget = dto.budget !== "" && dto.budget !== null ? Number(dto.budget) : null;
    const updated = await this.prisma.serviceRequest.update({ where: { id: sr.id }, data: dataToUpdate });
    void this.audit.log({ actorId: user.userId, action: "SERVICE_REQUEST_UPDATED", entityType: "ServiceRequest", entityId: id, details: dto });
    return updated;
  }

  async submit(user: AuthUser, id: string) {
    const sr = await this.get(user, id);
    if (sr.status !== "DRAFT") throw new BadRequestException("Only drafts can be submitted");
    await this.prisma.serviceRequest.update({ where: { id: sr.id }, data: { status: "OPEN" } });
    void this.audit.log({ actorId: user.userId, action: "SERVICE_REQUEST_SUBMITTED", entityType: "ServiceRequest", entityId: id });
    void this.notifications.notify({ userId: user.userId, type: "SERVICE_REQUEST_CREATED", title: "Service request opened", message: `${sr.title} is now open for quotations.` });
    return { id, status: "OPEN" };
  }

  async archive(user: AuthUser, id: string) {
    const sr = await this.get(user, id);
    await this.prisma.serviceRequest.update({ where: { id: sr.id }, data: { isArchived: true, status: "CLOSED" } });
    void this.audit.log({ actorId: user.userId, action: "SERVICE_REQUEST_ARCHIVED", entityType: "ServiceRequest", entityId: id });
    return { id, archived: true };
  }
}
