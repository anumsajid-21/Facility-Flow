import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/user.decorator";

@Injectable()
export class AnalyticsService {
  private readonly cache = new Map<string, { expiresAt: number; value: any }>();
  constructor(private prisma: PrismaService) {}

  async hiringDashboard(user: AuthUser) {
    const orgId = user.hiringOrgId!;
    const [requests, pendingQuotations, activeContracts, upcomingJobs, overdueInvoices, completedJobs, invoices] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { organizationId: orgId, isArchived: false, status: { in: ["OPEN", "QUOTATIONS_RECEIVED", "UNDER_REVIEW", "PROVIDER_SELECTED"] } } }),
      this.prisma.quotation.count({ where: { serviceRequest: { organizationId: orgId }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } } }),
      this.prisma.contract.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
      this.prisma.job.count({ where: { contract: { organizationId: orgId }, date: { gte: new Date() }, status: { in: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] } } }),
      this.prisma.invoice.count({ where: { organizationId: orgId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: new Date() } } }),
      this.prisma.job.count({ where: { contract: { organizationId: orgId }, status: "COMPLETED" } }),
      this.prisma.invoice.findMany({ where: { organizationId: orgId } }),
    ]);

    const completedJobIds = await this.prisma.job.findMany({ where: { contract: { organizationId: orgId }, status: "COMPLETED" }, select: { id: true } });
    const approvedCount = await this.prisma.approval.count({ where: { jobId: { in: completedJobIds.map(j => j.id) }, decision: "APPROVED" } });
    const pendingApprovals = completedJobIds.length - approvedCount;

    const totalSpending = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const paidSpending = invoices.filter((i) => i.status === "PAID" || i.status === "ISSUED").reduce((sum, inv) => sum + Number(inv.total), 0);
    return {
      activeServiceRequests: requests,
      pendingQuotations,
      activeContracts,
      upcomingJobs,
      pendingApprovals,
      overdueInvoices,
      completedJobs,
      totalSpending: Number(totalSpending.toFixed(2)),
      paidSpending: Number(paidSpending.toFixed(2)),
    };
  }

  async providerDashboard(user: AuthUser) {
    if (!user.providerId) return {};
    const pId = user.providerId;
    const [requestsReceived, quotationsSubmitted, activeContracts, upcomingJobs, completedJobs, invoices] = await Promise.all([
      this.prisma.serviceRequest.count({ where: { status: "OPEN", isArchived: false, category: { providers: { some: { providerId: pId } } } } }),
      this.prisma.quotation.count({ where: { providerId: pId } }),
      this.prisma.contract.count({ where: { providerId: pId, status: "ACTIVE" } }),
      this.prisma.job.count({ where: { contract: { providerId: pId }, date: { gte: new Date() }, status: { in: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] } } }),
      this.prisma.job.count({ where: { contract: { providerId: pId }, status: "COMPLETED" } }),
      this.prisma.invoice.findMany({ where: { providerId: pId } }),
    ]);
    const revenue = invoices.filter((i) => i.status === "PAID" || i.status === "ISSUED").reduce((sum, inv) => sum + Number(inv.total), 0);
    const avg = await this.prisma.review.aggregate({ where: { providerId: pId }, _avg: { overallRating: true } });
    const totalReviews = await this.prisma.review.count({ where: { providerId: pId } });
    return {
      requestsReceived,
      quotationsSubmitted,
      activeContracts,
      upcomingJobs,
      completedJobs,
      revenue: Number(revenue.toFixed(2)),
      averageRating: avg._avg?.overallRating ? Number(avg._avg.overallRating) : 0,
      totalReviews,
    };
  }

  async spend(user: AuthUser, from?: string, to?: string) {
    const cacheKey = `${user.role}:${user.hiringOrgId ?? ""}:${user.providerId ?? ""}:${from ?? ""}:${to ?? ""}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const where: any = { status: { in: ["ISSUED", "PENDING", "PAID", "OVERDUE"] } };
    if (user.role === "HIRING_ORG") where.organizationId = user.hiringOrgId;
    const start = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 365));
    const end = to ? new Date(to) : new Date();
    if (!isNaN(start.getTime())) where.createdAt = { gte: start };
    if (!isNaN(end.getTime())) where.createdAt = { ...(where.createdAt ?? {}), lte: end };
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { provider: { select: { id: true, name: true } }, contract: { select: { serviceName: true } } },
      orderBy: { createdAt: "asc" },
    });
    const byMonth = new Map<string, number>();
    const byProvider = new Map<string, { name: string; amount: number }>();
    const byCategory = new Map<string, number>();
    for (const invoice of invoices) {
      const amount = Number(invoice.total);
      const month = invoice.createdAt.toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
      const provider = byProvider.get(invoice.providerId) ?? { name: invoice.provider.name, amount: 0 };
      provider.amount += amount;
      byProvider.set(invoice.providerId, provider);
      const category = invoice.contract.serviceName ?? "Other";
      byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
    }
    const scorecards = await this.providerScorecards(user);
    const result = {
      from: start.toISOString(),
      to: end.toISOString(),
      monthly: [...byMonth.entries()].map(([period, amount]) => ({ period, amount: Number(amount.toFixed(2)) })),
      byProvider: [...byProvider.entries()].map(([id, value]) => ({ id, ...value, amount: Number(value.amount.toFixed(2)) })),
      byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) })),
      scorecards,
    };
    this.cache.set(cacheKey, { expiresAt: Date.now() + 30_000, value: result });
    return result;
  }

  async providerScorecards(user: AuthUser) {
    const where: any = user.role === "HIRING_ORG" ? { organizationId: user.hiringOrgId } : {};
    const providers = await this.prisma.provider.findMany({ where: user.role === "HIRING_ORG" && user.hiringOrgId ? { contracts: { some: { organizationId: user.hiringOrgId } } } : {}, select: { id: true, name: true } });
    return Promise.all(providers.map(async (provider) => {
      const [rating, jobs, rework, sla] = await Promise.all([
        this.prisma.review.aggregate({ where: { providerId: provider.id, ...(where.organizationId ? { organizationId: where.organizationId } : {}) }, _avg: { overallRating: true } }),
        this.prisma.job.count({ where: { contract: { providerId: provider.id, ...(where.organizationId ? { organizationId: where.organizationId } : {}) } } }),
        this.prisma.reworkRequest.count({ where: { job: { contract: { providerId: provider.id, ...(where.organizationId ? { organizationId: where.organizationId } : {}) } } } }),
        this.prisma.jobSla.count({ where: { job: { contract: { providerId: provider.id, ...(where.organizationId ? { organizationId: where.organizationId } : {}) } }, status: "BREACHED" } }),
      ]);
      return { ...provider, averageRating: Number((rating._avg.overallRating ?? 0).toFixed(1)), jobs, rework, slaBreaches: sla, reworkRate: jobs ? Number(((rework / jobs) * 100).toFixed(1)) : 0 };
    }));
  }

  async exportCsv(user: AuthUser, from?: string, to?: string) {
    const data = await this.spend(user, from, to);
    const rows = [["period", "amount"], ...data.monthly.map((row: { period: string; amount: number }) => [row.period, String(row.amount)])];
    return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  }
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
