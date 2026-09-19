import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const KEEP_PROVIDER_NAMES = new Set(['TotalCare', 'SparkleClean', 'Prime HVAC']);
const LEGACY_PROVIDER_NAMES = new Set(['Demo Maintenance Pros', 'Prime HVAC Services', 'SparkleClean Facility Care', 'Metro Electrical Group', 'GreenLeaf Landscapes']);

async function removeProvider(id) {
  const contracts = await prisma.contract.findMany({ where: { providerId: id }, select: { id: true } });
  const contractIds = contracts.map(({ id }) => id);
  const jobs = contractIds.length ? await prisma.job.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } }) : [];
  const jobIds = jobs.map(({ id }) => id);
  const invoices = await prisma.invoice.findMany({ where: { providerId: id }, select: { id: true } });
  const invoiceIds = invoices.map(({ id }) => id);
  const quotationIds = (await prisma.quotation.findMany({ where: { providerId: id }, select: { id: true } })).map(({ id }) => id);
  const userIds = (await prisma.user.findMany({ where: { providerId: id }, select: { id: true } })).map(({ id }) => id);

  await prisma.$transaction(async (tx) => {
    if (invoiceIds.length) await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    if (jobIds.length) {
      await tx.jobChecklistResult.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.workerAssignment.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.approval.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.reworkRequest.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.jobSla.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.proofOfWork.deleteMany({ where: { jobId: { in: jobIds } } });
      await tx.job.deleteMany({ where: { id: { in: jobIds } } });
    }
    if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    if (contractIds.length) {
      await tx.contractSchedule.deleteMany({ where: { contractId: { in: contractIds } } });
      await tx.contractVersion.deleteMany({ where: { contractId: { in: contractIds } } });
      await tx.messageThread.deleteMany({ where: { contractId: { in: contractIds } } });
      await tx.contract.deleteMany({ where: { id: { in: contractIds } } });
    }
    await tx.messageThread.deleteMany({ where: { providerId: id } });
    if (quotationIds.length) await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } });
    if (userIds.length) {
      await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
      await tx.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
      await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
      await tx.message.deleteMany({ where: { senderId: { in: userIds } } });
      await tx.auditLog.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } });
    }
    await tx.review.deleteMany({ where: { providerId: id } });
    await tx.verificationDocument.deleteMany({ where: { providerId: id } });
    await tx.providerDocument.deleteMany({ where: { providerId: id } });
    await tx.slaPolicy.deleteMany({ where: { providerId: id } });
    await tx.worker.deleteMany({ where: { providerId: id } });
    await tx.providerServiceArea.deleteMany({ where: { providerId: id } });
    await tx.providerService.deleteMany({ where: { providerId: id } });
    await tx.user.deleteMany({ where: { providerId: id } });
    await tx.provider.delete({ where: { id } });
  });
}

async function main() {
  const legacyOrg = await prisma.organization.findFirst({ where: { name: 'Demo Facilities Co' }, select: { id: true } });
  if (legacyOrg) await prisma.organization.update({ where: { id: legacyOrg.id }, data: { name: 'QX Industry' } });

  const legacyProviders = await prisma.provider.findMany({ where: { name: { in: [...LEGACY_PROVIDER_NAMES] } }, select: { id: true, name: true } });
  for (const provider of legacyProviders) {
    if (!KEEP_PROVIDER_NAMES.has(provider.name)) await removeProvider(provider.id);
  }

  console.table(await prisma.provider.findMany({ select: { name: true, users: { select: { email: true } } }, orderBy: { name: 'asc' } }));
  console.table(await prisma.organization.findMany({ select: { name: true, users: { select: { email: true } } }, orderBy: { name: 'asc' } }));
  console.log('Credentials:');
  console.table([
    { account: 'SparkleClean', email: 'sparkleclean@facilityflow.app', password: 'Provide@12345' },
    { account: 'Prime HVAC', email: 'primehvac@facilityflow.app', password: 'Provide@12345' },
    { account: 'Metro Healthcare Group', email: 'ops@metrohealth.app', password: 'Hire@12345' },
    { account: 'QX Industry', email: 'hiring@facilityflow.app', password: 'Hire@12345' },
  ]);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
