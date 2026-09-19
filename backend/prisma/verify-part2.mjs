import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const providerNames = (await prisma.provider.findMany({ orderBy: { name: 'asc' }, select: { name: true } })).map((row) => row.name);
const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { name: true, users: { select: { email: true } } } });
const protectedUsers = await prisma.user.findMany({ where: { OR: [{ provider: { name: 'TotalCare' } }, { hiringOrg: { name: 'Folio3' } }] }, select: { id: true } });
const userIds = protectedUsers.map((row) => row.id);
const protectedOrgIds = (await prisma.organization.findMany({ where: { name: 'Folio3' }, select: { id: true } })).map((row) => row.id);
const protectedProviderIds = (await prisma.provider.findMany({ where: { name: 'TotalCare' }, select: { id: true } })).map((row) => row.id);
const [contracts, invoices, quotations, jobs] = await Promise.all([
  prisma.contract.count({ where: { OR: [{ organizationId: { in: protectedOrgIds } }, { providerId: { in: protectedProviderIds } }] } }),
  prisma.invoice.count({ where: { OR: [{ organizationId: { in: protectedOrgIds } }, { providerId: { in: protectedProviderIds } }] } }),
  prisma.quotation.count({ where: { providerId: { in: protectedProviderIds } } }),
  prisma.job.count({ where: { contract: { OR: [{ organizationId: { in: protectedOrgIds } }, { providerId: { in: protectedProviderIds } }] } } }),
]);
console.log(JSON.stringify({ providerNames, organizations, protectedUserCount: userIds.length, protectedTransactions: { contracts, invoices, quotations, jobs } }, null, 2));
await prisma.$disconnect();
