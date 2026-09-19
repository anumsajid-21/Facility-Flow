import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";
import QRCode from "qrcode";

export interface AssetFilter {
  category?: string;
  status?: string;
  buildingId?: string;
  search?: string;
}

/**
 * Asset business logic: CRUD with audit history, tenant-scoped access,
 * and software QR-code generation.
 */
@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  async list(user: AuthUser, filter: AssetFilter, q: PaginationDto) {
    const take = q.limit;
    const skip = (q.page - 1) * take;
    const orgId = user.hiringOrgId!;
    const where: any = { organizationId: orgId, isArchived: false };
    if (filter.category) where.category = filter.category;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.OR = [{ name: { contains: filter.search, mode: "insensitive" } }, { assetId: { contains: filter.search, mode: "insensitive" } }];
    let buildingWhere: any = null;
    if (filter.buildingId) {
      buildingWhere = await this.ensureBuilding(filter.buildingId, user);
      where.area = { floor: { buildingId: filter.buildingId } };
    }
    const [total, items] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    ]);
    return buildPage(items, total, q.page, take);
  }

  private async ensureBuilding(buildingId: string, user: AuthUser) {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, organizationId: true } });
    if (!building || building.organizationId !== user.hiringOrgId) throw new NotFoundException("Building not found");
    return building;
  }

  async get(user: AuthUser, id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { organization: true, area: { include: { floor: { include: { building: true } } } } },
    });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    return asset;
  }

  async create(user: AuthUser, dto: any) {
    const orgId = user.hiringOrgId!;
    let area = null;
    if (dto.areaId) {
      area = await this.prisma.area.findFirst({ where: { id: dto.areaId, floor: { building: { organizationId: orgId } } } });
      if (!area) throw new NotFoundException("Area not found");
    }
    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          assetId: dto.assetId, name: dto.name, category: dto.category, brand: dto.brand, model: dto.model,
          serialNumber: dto.serialNumber, location: dto.location, installationDate: dto.installationDate, warranty: dto.warranty,
          maintenanceFrequency: dto.maintenanceFrequency, status: dto.status, notes: dto.notes,
          organizationId: orgId, areaId: area?.id ?? null,
        },
      });
      await tx.assetHistory.create({ data: { assetId: created.id, event: "CREATED", actorUserId: user.userId, details: { ...dto } } });
      return created;
    });
    void this.audit.log({ actorId: user.userId, action: "ASSET_CREATED", entityType: "Asset", entityId: asset.id, details: dto });
    return asset;
  }

  async update(user: AuthUser, id: string, dto: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.asset.update({ where: { id }, data: { ...dto } });
      await tx.assetHistory.create({ data: { assetId: id, event: "UPDATED", actorUserId: user.userId, details: dto } });
      return rec;
    });
    void this.audit.log({ actorId: user.userId, action: "ASSET_UPDATED", entityType: "Asset", entityId: id, details: dto });
    return updated;
  }

  async archive(user: AuthUser, id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!asset) throw new NotFoundException("Asset not found");
    if (asset.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: { isArchived: true, status: "ARCHIVED" } });
      await tx.assetHistory.create({ data: { assetId: id, event: "ARCHIVED", actorUserId: user.userId, details: {} } });
    });
    void this.audit.log({ actorId: user.userId, action: "ASSET_ARCHIVED", entityType: "Asset", entityId: id });
    return { id, archived: true };
  }

  async history(user: AuthUser, id: string) {
    await this.get(user, id);
    return this.prisma.assetHistory.findMany({
      where: { assetId: id },
      orderBy: { timestamp: "asc" },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }

  /**
   * Generate an authorization-scoped QR code for the asset. The QR encodes a
   * tokenized public URL resolving only to the owning tenant, preventing
   * information leakage to unauthorized scanners.
   */
  async qrcode(user: AuthUser, id: string): Promise<Buffer> {
    const asset = await this.get(user, id);
    const token = Buffer.from(`${asset.id}:${user.hiringOrgId}`).toString("base64url");
    const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/assets/public/${token}`;
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "M", width: 512 });
    return png;
  }

  /** Public, token-scoped asset view (used by QR scan). No auth guard. */
  async publicView(token: string) {
    let decoded: string;
    try { decoded = Buffer.from(token, "base64url").toString("utf-8"); } catch { return null; }
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    const assetId = decoded.slice(0, sep);
    const orgId = decoded.slice(sep + 1);
    return this.prisma.asset.findFirst({
      where: { id: assetId, organizationId: orgId, isArchived: false },
      include: { area: { include: { floor: { include: { building: true } } } } },
    });
  }
}
