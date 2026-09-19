/**
 * One-off cleanup for junk data left behind by repeatedly running
 * e2e-test.mjs / e2e-flow-test.mjs against the persistent dev database
 * during development (those scripts register fresh throwaway orgs/
 * providers/workers on every run - "E2E Org", "E2E Pros", "Strong Co",
 * timestamped worker emails - rather than resetting afterward).
 *
 * Deletes only rows reachable from those specific junk organizations/
 * providers. Real seed data (QX Industry, Metro Healthcare Group,
 * Prime HVAC, SparkleClean and everything under them) is untouched.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const JUNK_ORG_NAMES = ['E2E Org', 'Strong Co'];
const JUNK_PROVIDER_NAMES = ['E2E Pros'];

async function main() {
  const junkOrgs = await prisma.organization.findMany({ where: { name: { in: JUNK_ORG_NAMES } } });
  const junkProviders = await prisma.provider.findMany({ where: { name: { in: JUNK_PROVIDER_NAMES } } });
  const orgIds = junkOrgs.map((o) => o.id);
  const providerIds = junkProviders.map((p) => p.id);

  console.log(`Found ${orgIds.length} junk organizations, ${providerIds.length} junk providers.`);
  if (!orgIds.length && !providerIds.length) {
    console.log('Nothing to clean up.');
    return;
  }

  const contracts = await prisma.contract.findMany({ where: { OR: [{ organizationId: { in: orgIds } }, { providerId: { in: providerIds } }] }, select: { id: true } });
  const contractIds = contracts.map((c) => c.id);
  const serviceRequests = await prisma.serviceRequest.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
  const srIds = serviceRequests.map((r) => r.id);
  const jobs = await prisma.job.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({ where: { OR: [{ organizationId: { in: orgIds } }, { providerId: { in: providerIds } }] }, select: { id: true } });
  const invoiceIds = invoices.map((i) => i.id);
  const threads = await prisma.messageThread.findMany({ where: { OR: [{ organizationId: { in: orgIds } }, { providerId: { in: providerIds } }] }, select: { id: true } });
  const threadIds = threads.map((t) => t.id);
  const users = await prisma.user.findMany({ where: { OR: [{ hiringOrgId: { in: orgIds } }, { providerId: { in: providerIds } }] }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const workers = await prisma.worker.findMany({ where: { providerId: { in: providerIds } }, select: { id: true } });
  const workerIds = workers.map((w) => w.id);
  const buildings = await prisma.building.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
  const buildingIds = buildings.map((b) => b.id);
  const floors = await prisma.floor.findMany({ where: { buildingId: { in: buildingIds } }, select: { id: true } });
  const floorIds = floors.map((f) => f.id);

  console.log(`Cascading: ${contractIds.length} contracts, ${srIds.length} service requests, ${jobIds.length} jobs, ${invoiceIds.length} invoices, ${threadIds.length} message threads, ${userIds.length} users, ${workerIds.length} workers.`);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { threadId: { in: threadIds } } }),
    prisma.messageThread.deleteMany({ where: { id: { in: threadIds } } }),

    prisma.reworkRequest.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.approval.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.proofOfWork.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.jobChecklistResult.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.jobSla.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.workerAssignment.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.job.deleteMany({ where: { id: { in: jobIds } } }),

    prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
    prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } }),

    prisma.contractVersion.deleteMany({ where: { contractId: { in: contractIds } } }),
    prisma.contractSchedule.deleteMany({ where: { contractId: { in: contractIds } } }),
    prisma.contract.deleteMany({ where: { id: { in: contractIds } } }),

    prisma.quotation.deleteMany({ where: { OR: [{ serviceRequestId: { in: srIds } }, { providerId: { in: providerIds } }] } }),
    prisma.serviceRequestAttachment.deleteMany({ where: { serviceRequestId: { in: srIds } } }),
    prisma.review.deleteMany({ where: { OR: [{ organizationId: { in: orgIds } }, { providerId: { in: providerIds } }] } }),
    prisma.serviceRequest.deleteMany({ where: { id: { in: srIds } } }),

    prisma.providerService.deleteMany({ where: { providerId: { in: providerIds } } }),
    prisma.providerServiceArea.deleteMany({ where: { providerId: { in: providerIds } } }),
    prisma.verificationDocument.deleteMany({ where: { providerId: { in: providerIds } } }),
    prisma.slaPolicy.deleteMany({ where: { providerId: { in: providerIds } } }),
    prisma.worker.deleteMany({ where: { id: { in: workerIds } } }),

    prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } }),
    prisma.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),

    prisma.area.deleteMany({ where: { floorId: { in: floorIds } } }),
    prisma.floor.deleteMany({ where: { id: { in: floorIds } } }),
    prisma.building.deleteMany({ where: { id: { in: buildingIds } } }),
    prisma.organization.deleteMany({ where: { id: { in: orgIds } } }),
    prisma.provider.deleteMany({ where: { id: { in: providerIds } } }),
  ]);

  console.log('Cleanup complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
