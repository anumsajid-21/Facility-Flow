const fs = require('fs');
const p = 'C:\\Users\\Admin\\Desktop\\ANUM\\Facility Service App\\backend\\src\\analytics\\analytics.service.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('decision: { not: "PENDING" }', 'decision: { not: "PENDING" as any }');
fs.writeFileSync(p, c, 'utf8');
console.log('Fixed');


import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/user.decorator";

@Injectable()
export class AnalyticsService {
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
    const approvedCount = await this.prisma.approval.count({ where: { jobId: { in: completedJobIds.map(j => j.id) }, decision: { not: "PENDING" } } });
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
      this.prisma.serviceRequest.count({ where: { category: { providers: { some: { providerId: pId } } } } }),
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
}
`;

fs.writeFileSync(p, newContent, 'utf8');
console.log('Analytics service fixed, wrote', newContent.length, 'bytes');
