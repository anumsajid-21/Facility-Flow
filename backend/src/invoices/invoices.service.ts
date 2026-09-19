import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { Prisma } from "@prisma/client";

/**
 * Invoice management with manual payment recording. The payment layer is an
 * abstraction — a real payment gateway can be wired into addPayment later.
 */
@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  private async load(user: AuthUser, id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id }, include: { contract: true, job: true, provider: true, organization: true } });
    if (!inv) throw new NotFoundException("Invoice not found");
    const isProvider = user.role === "PROVIDER" && user.providerId === inv.providerId;
    const isHiring = user.role === "HIRING_ORG" && user.hiringOrgId === inv.organizationId;
    if (!isProvider && !isHiring && user.role !== "ADMIN") throw new ForbiddenException("Access denied");
    return inv;
  }

  async list(user: AuthUser, q: PaginationDto) {
    const where: any = {};
    if (user.role === "PROVIDER" && user.providerId) where.providerId = user.providerId;
    else if (user.role === "HIRING_ORG" && user.hiringOrgId) where.organizationId = user.hiringOrgId;
    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async get(user: AuthUser, id: string) {
    const inv = await this.load(user, id);
    const payments = await this.prisma.payment.findMany({ where: { invoiceId: inv.id } });
    const totalPaid = payments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.max(0, Number(inv.total) - totalPaid);
    const status = inv.status === "PAID" && balance > 0 ? "ISSUED" : inv.status;
    return { ...inv, status, payments, totalPaid, balance };
  }

  /** Provider manually issues an invoice tied to a completed job. */
  async createFromJob(user: AuthUser, jobId: string) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers");
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { contract: { include: { provider: true, organization: true } } } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.contract.providerId !== user.providerId) throw new ForbiddenException("Not your job");
    if (job.status !== "AWAITING_APPROVAL") throw new BadRequestException("Job must be awaiting approval");
    const existing = await this.prisma.invoice.findFirst({ where: { jobId: job.id } });
    if (existing) throw new ConflictException("Invoice already exists for this job");
    const number = `INV-${job.contract.id.slice(0, 8).toUpperCase()}-${job.id.slice(0, 8).toUpperCase()}`;
    const inv = await this.prisma.invoice.create({
      data: {
        invoiceNumber: number,
        providerId: job.contract.providerId,
        organizationId: job.contract.organizationId,
        contractId: job.contractId,
        jobId: job.id,
        amount: job.contract.price,
        tax: 0,
        discount: 0,
        total: job.contract.price,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ISSUED",
        issuedById: user.userId,
      },
    });
    void this.audit.log({ actorId: user.userId, action: "INVOICE_ISSUED", entityType: "Invoice", entityId: inv.id, details: { jobId } });
    void this.notifications.notify({ userId: user.userId, type: "INVOICE_ISSUED", title: "Invoice issued", message: "An invoice was issued." });
    return inv;
  }

  async updateStatus(user: AuthUser, id: string, status: string) {
    const inv = await this.load(user, id);
    if (user.role !== "PROVIDER" || user.providerId !== inv.providerId) throw new ForbiddenException("Not your invoice");
    if (status === "PAID") throw new BadRequestException("Paid status is set automatically after recording the full payment");
    const valid = ["DRAFT", "ISSUED", "PENDING", "OVERDUE", "CANCELLED"];
    if (!valid.includes(status)) throw new BadRequestException("Invalid status");
    const updated = await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: status as any } });
    void this.audit.log({ actorId: user.userId, action: "INVOICE_STATUS_CHANGE", entityType: "Invoice", entityId: id, details: { status } });
    return updated;
  }

  async payments(user: AuthUser, id: string) {
    await this.load(user, id);
    return this.prisma.payment.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "desc" } });
  }

  /** Hiring org records a manual/bank-transfer payment against an invoice. */
  async addPayment(user: AuthUser, id: string, dto: any) {
    const inv = await this.load(user, id);
    if (user.role === "HIRING_ORG" && user.hiringOrgId !== inv.organizationId) throw new ForbiddenException("Not your invoice");
    let finalStatus = inv.status as string;
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${inv.id} FOR UPDATE`);
      const total = Number(inv.total);
      const aggregate = await tx.payment.aggregate({ where: { invoiceId: inv.id, status: "COMPLETED" }, _sum: { amount: true } });
      const totalPaid = Number(aggregate._sum.amount ?? 0);
      if (Math.round(Number(dto.amount) * 100) > Math.round((total - totalPaid) * 100)) throw new BadRequestException("Payment exceeds outstanding balance");
      const p = await tx.payment.create({
        data: { invoiceId: inv.id, amount: dto.amount, date: dto.date ? new Date(dto.date) : new Date(), paymentMethod: dto.paymentMethod, status: "COMPLETED", recordedById: user.userId },
      });
      const paymentReference = `PAY-${p.id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      const recordedPayment = await tx.payment.update({ where: { id: p.id }, data: { paymentReference } });
      const newTotal = await tx.payment.aggregate({ where: { invoiceId: inv.id }, _sum: { amount: true } });
      const paid = Number(newTotal._sum.amount ?? 0);
      const newStatus = paid >= Number(inv.total) ? "PAID" : inv.status;
      finalStatus = newStatus;
      await tx.invoice.update({ where: { id: inv.id }, data: { status: newStatus } });
      return recordedPayment;
    });
    void this.audit.log({ actorId: user.userId, action: "PAYMENT_RECORDED", entityType: "Payment", entityId: payment.id, details: { invoiceId: id, amount: dto.amount } });
    await this.notifications.notifyProvider(inv.providerId, { type: "PAYMENT_RECORDED", title: "Payment recorded", message: `Payment of ${dto.amount} was recorded against invoice ${inv.invoiceNumber}.` });
    if (finalStatus === "PAID") {
      await this.notifications.notifyProvider(inv.providerId, { type: "INVOICE_PAID", title: "Invoice paid", message: `Invoice ${inv.invoiceNumber} is now fully paid.` });
    }
    void this.notifications.notify({ userId: user.userId, type: "PAYMENT_RECORDED", title: "Payment recorded", message: `Payment of ${dto.amount} recorded against invoice.` });
    return payment;
  }

  /** Org/provider-scoped payment history across all invoices, filterable. */
  async paymentHistory(user: AuthUser, filters: { from?: string; to?: string; providerId?: string; category?: string }) {
    const where = this.paymentWhere(user, filters);
    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        invoice: {
          include: {
            provider: { select: { id: true, name: true } },
            organization: { select: { id: true, name: true } },
            contract: {
              select: {
                id: true, serviceName: true, title: true,
                quotation: { select: { serviceRequest: { select: { category: { select: { name: true } } } } } },
              },
            },
          },
        },
        recordedBy: { select: { id: true, name: true } },
      },
    });
    const rows = payments.map((p) => ({
      id: p.id,
      date: p.date,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.invoiceNumber,
      invoiceStatus: p.invoice.status,
      providerId: p.invoice.provider.id,
      providerName: p.invoice.provider.name,
      organizationId: p.invoice.organization.id,
      organizationName: p.invoice.organization.name,
      category: p.invoice.contract?.quotation?.serviceRequest?.category?.name ?? p.invoice.contract?.serviceName ?? "General",
      amount: Number(p.amount),
      method: p.paymentMethod ?? "—",
      reference: p.paymentReference ?? "—",
      status: p.status,
    }));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { data: rows, total, count: rows.length };
  }

  /** CSV stream of the same payment history dataset. */
  async paymentHistoryCsv(user: AuthUser, filters: { from?: string; to?: string; providerId?: string; category?: string }, res: any) {
    const { data } = await this.paymentHistory(user, filters);
    const esc = (v: any) => {
      const s = v instanceof Date ? v.toISOString() : String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Date,Invoice #,Provider,Organization,Category,Amount,Method,Reference,Status";
    const lines = data.map((r) =>
      [new Date(r.date).toISOString().slice(0, 10), r.invoiceNumber, r.providerName, r.organizationName, r.category, r.amount.toFixed(2), r.method, r.reference, r.status].map(esc).join(","),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payment-history-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send([header, ...lines].join("\n"));
  }

  private paymentWhere(user: AuthUser, filters: { from?: string; to?: string; providerId?: string; category?: string }) {
    const invWhere: any = {};
    if (user.role === "PROVIDER" && user.providerId) invWhere.providerId = user.providerId;
    else if (user.role === "HIRING_ORG" && user.hiringOrgId) invWhere.organizationId = user.hiringOrgId;
    if (filters.providerId) invWhere.providerId = filters.providerId;
    if (filters.category) {
      invWhere.contract = {
        OR: [
          { serviceName: { contains: filters.category, mode: "insensitive" } },
          { quotation: { serviceRequest: { category: { name: { contains: filters.category, mode: "insensitive" } } } } },
        ],
      };
    }
    const where: any = { invoice: invWhere };
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(`${filters.to}T23:59:59.999Z`);
    }
    return where;
  }

  async generatePdf(user: AuthUser, id: string, res: any) {

    const inv = await this.get(user, id);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 50 });
    const money = (value: unknown) => `PKR ${Number(value ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${inv.invoiceNumber}.pdf"`);

    doc.pipe(res);

    doc.fontSize(22).fillColor("#1F2937").text("FacilityFlow", 50, 45);
    doc.fontSize(10).fillColor("#6B7280").text("Facility Services Marketplace", 50, 72);

    doc.fontSize(18).fillColor("#111827").text("INVOICE", 400, 45, { align: "right" });
    doc.fontSize(10).fillColor("#6B7280").text(`#${inv.invoiceNumber}`, 400, 68, { align: "right" });
    doc.text(`Status: ${inv.status}`, 400, 82, { align: "right" });
    doc.text(`Due Date: ${new Date(inv.dueDate).toLocaleDateString()}`, 400, 96, { align: "right" });

    doc.moveTo(50, 120).lineTo(550, 120).strokeColor("#E5E7EB").stroke();

    doc.fontSize(11).fillColor("#374151").text("Provider:", 50, 140, { underline: true });
    doc.fontSize(10).fillColor("#1F2937").text(inv.provider?.name || "N/A", 50, 158);

    doc.fontSize(11).fillColor("#374151").text("Billed To:", 300, 140, { underline: true });
    doc.fontSize(10).fillColor("#1F2937").text(inv.organization?.name || "N/A", 300, 158);

    doc.moveTo(50, 200).lineTo(550, 200).strokeColor("#E5E7EB").stroke();

    doc.fontSize(12).fillColor("#1F2937").text("Summary", 50, 220);
    doc.fontSize(10).fillColor("#4B5563");
    doc.text("Subtotal:", 50, 245);
    doc.text(money(inv.amount), 450, 245, { align: "right" });

    doc.text("Tax:", 50, 265);
    doc.text(money(inv.tax ?? 0), 450, 265, { align: "right" });

    doc.text("Discount:", 50, 285);
    doc.text(`-${money(inv.discount ?? 0)}`, 450, 285, { align: "right" });

    doc.moveTo(50, 310).lineTo(550, 310).strokeColor("#1F2937").stroke();

    doc.fontSize(13).fillColor("#059669").text("Total:", 50, 325);
    doc.fontSize(13).fillColor("#059669").text(money(inv.total), 450, 325, { align: "right" });

    doc.fontSize(10).fillColor("#6B7280").text("Total Paid:", 50, 355);
    doc.text(money(inv.totalPaid ?? 0), 450, 355, { align: "right" });

    doc.text("Remaining Balance:", 50, 375);
    doc.text(money(inv.balance ?? 0), 450, 375, { align: "right" });

    doc.fontSize(9).fillColor("#9CA3AF").text("Thank you for choosing FacilityFlow.", 50, 440, { align: "center" });

    doc.end();
  }
}
