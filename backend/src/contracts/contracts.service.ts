import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";

/**
 * Contracts are created from an accepted quotation and generate jobs.
 * Includes versioning: every change is snapshotted as a ContractVersion.
 */
@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  async list(user: AuthUser, q: PaginationDto) {
    const where: any = {};
    if (user.role === "HIRING_ORG") {
      where.organizationId = user.hiringOrgId;
    } else if (user.role === "PROVIDER" && user.providerId) {
      where.providerId = user.providerId;
    }
    const [total, items] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
          building: { select: { id: true, name: true, city: true, address: true } },
          jobs: { select: { id: true, status: true, title: true, date: true } },
        },
      }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async get(user: AuthUser, id: string) {
    const c = await this.prisma.contract.findUnique({ where: { id }, include: { organization: true, provider: true, quotation: true, building: true, contractVersions: { orderBy: { version: "asc" } }, jobs: true } });
    if (!c) throw new NotFoundException("Contract not found");
    if (user.role === "HIRING_ORG" && c.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    if (user.role === "PROVIDER" && c.providerId !== user.providerId) throw new ForbiddenException("Access denied");
    return { ...c, versions: c.contractVersions ?? [] };
  }

  async versions(user: AuthUser, id: string) {
    await this.get(user, id);
    return this.prisma.contractVersion.findMany({ where: { contractId: id }, orderBy: { version: "desc" } });
  }

  /** Create a contract from an accepted quotation. */
  async createFromQuotation(user: AuthUser, dto: any) {
    if (user.role !== "HIRING_ORG" || !user.hiringOrgId) throw new ForbiddenException("Only hiring organizations can create contracts");
    const q = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
      include: { serviceRequest: true, provider: true },
    });
    if (!q) throw new NotFoundException("Quotation not found");
    if (q.serviceRequest.organizationId !== user.hiringOrgId) throw new ForbiddenException("Not your quotation");
    if (q.status !== "ACCEPTED") throw new BadRequestException("Quotation must be accepted to create a contract");

    const building = await this.prisma.building.findUnique({ where: { id: dto.buildingId }, select: { id: true, organizationId: true } });
    if (!building || building.organizationId !== user.hiringOrgId) throw new ForbiddenException("Building not accessible");

    const existing = await this.prisma.contract.findFirst({ where: { quotationId: dto.quotationId } });
    if (existing) throw new ConflictException("Contract already exists for this quotation");

    const contract = await this.prisma.$transaction(async (tx) => {
      const c = await tx.contract.create({
        data: {
          organizationId: user.hiringOrgId!,
          providerId: q.providerId,
          quotationId: dto.quotationId,
          buildingId: dto.buildingId,
          serviceName: dto.serviceName,
          price: dto.price,
          startDate: dto.startDate,
          endDate: dto.endDate,
          frequency: dto.frequency,
          occurrencesLimit: dto.occurrencesLimit,
          customRecurrence: dto.customRecurrence,
          sla: dto.sla,
          paymentTerms: dto.paymentTerms,
          cancellationTerms: dto.cancellationTerms,
          responsibilities: dto.responsibilities,
          renewalTerms: dto.renewalTerms,
          title: dto.title,
          status: "ACTIVE",
        },
      });
      await tx.contractVersion.create({
        data: { contractId: c.id, version: 1, creatorId: user.userId, snapshot: JSON.stringify(c) },
      });
      // update quotation status to reflect contract creation
      await tx.quotation.update({ where: { id: dto.quotationId }, data: { status: "UNDER_REVIEW" } });
      return c;
    });

    void this.audit.log({ actorId: user.userId, action: "CONTRACT_CREATED", entityType: "Contract", entityId: contract.id, details: { quotationId: dto.quotationId } });
    void this.notifications.notify({ userId: user.userId, type: "CONTRACT_ACTIVATED", title: "Contract created", message: "A contract has been created from an accepted quotation." });
    return await this.get(user, contract.id);
  }

  /** Snapshot the current contract state as a new version (audit trail). */
  async snapshot(user: AuthUser, id: string) {
    const c = await this.get(user, id);
    const latest = await this.prisma.contractVersion.findFirst({ where: { contractId: id }, orderBy: { version: "desc" } });
    const nextVersion = (latest?.version ?? 0) + 1;
    const snap = await this.prisma.contractVersion.create({
      data: { contractId: id, version: nextVersion, creatorId: user.userId, snapshot: JSON.stringify(c) },
    });
    void this.audit.log({ actorId: user.userId, action: "CONTRACT_VERSIONED", entityType: "ContractVersion", entityId: snap.id, details: { version: nextVersion } });
    return snap;
  }

  /** Chronological activity timeline for a contract (audit logs + derived events). */
  async activity(user: AuthUser, id: string) {
    await this.get(user, id);
    const [invoices, versions, payments] = await Promise.all([
      this.prisma.invoice.findMany({ where: { contractId: id }, select: { id: true, invoiceNumber: true, createdAt: true } }),
      this.prisma.contractVersion.findMany({ where: { contractId: id }, orderBy: { version: "asc" } }),
      this.prisma.payment.findMany({ where: { invoice: { contractId: id } }, include: { recordedBy: { select: { name: true } } } }),
    ]);
    const invoiceIds = invoices.map((i) => i.id);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Contract", entityId: id },
          { entityType: "ContractVersion", entityId: { in: versions.map((v) => v.id) } },
          { entityType: "Invoice", entityId: { in: invoiceIds } },
          { entityType: "Payment", entityId: { in: payments.map((p) => p.id) } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { name: true } } },
    });
    const events: { type: string; description: string; actor: string | null; timestamp: Date }[] = [
      ...auditLogs.map((l) => ({
        type: l.action,
        description: humanizeAction(l.action),
        actor: l.actor?.name ?? null,
        timestamp: l.createdAt,
      })),
      ...versions.map((v) => ({
        type: "CONTRACT_VERSIONED",
        description: `Contract version ${v.version} saved`,
        actor: null,
        timestamp: v.createdAt,
      })),
      ...invoices.map((i) => ({
        type: "INVOICE_ISSUED",
        description: `Invoice ${i.invoiceNumber} issued`,
        actor: null,
        timestamp: i.createdAt,
      })),
      ...payments.map((p) => ({
        type: "PAYMENT_RECORDED",
        description: `Payment of ${Number(p.amount).toFixed(2)} recorded`,
        actor: p.recordedBy?.name ?? null,
        timestamp: p.date,
      })),
    ];
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async update(user: AuthUser, id: string, dto: any) {

    const c = await this.get(user, id);
    if (user.role === "HIRING_ORG" && c.organizationId !== user.hiringOrgId) throw new ForbiddenException("Access denied");
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.contract.update({ where: { id }, data: { ...dto } });
      const latestVersion = await tx.contractVersion.findFirst({ where: { contractId: id }, orderBy: { version: "desc" } });
      await tx.contractVersion.create({ data: { contractId: id, version: await nextVersion(latestVersion), creatorId: user.userId, snapshot: JSON.stringify(rec) } });
      return rec;
    });
    void this.audit.log({ actorId: user.userId, action: "CONTRACT_UPDATED", entityType: "Contract", entityId: id, details: dto });
    return updated;
  }
}

async function nextVersion(latest: { version: number } | null): Promise<number> {
  return (latest?.version ?? 0) + 1;
}

function humanizeAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

