/**
 * Second pass: e2e-flow-test.mjs runs against the REAL seeded accounts
 * (QX Industry / Prime HVAC), so its test artifacts ("E2E Test Tower",
 * "E2E AC repair") aren't scoped to a throwaway org/provider - each run
 * left another copy behind under the real accounts.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({ where: { title: { contains: 'E2E AC repair' } }, select: { id: true } });
  const contractIds = contracts.map((c) => c.id);
  const srs = await prisma.serviceRequest.findMany({ where: { title: 'E2E AC repair' }, select: { id: true } });
  const srIds = srs.map((s) => s.id);
  const buildings = await prisma.building.findMany({ where: { name: 'E2E Test Tower' }, select: { id: true } });
  const buildingIds = buildings.map((b) => b.id);
  const floors = await prisma.floor.findMany({ where: { buildingId: { in: buildingIds } }, select: { id: true } });
  const floorIds = floors.map((f) => f.id);
  const jobs = await prisma.job.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } });
  const jobIds = jobs.map((j) => j.id);

  console.log(`Removing ${buildingIds.length} buildings, ${srIds.length} service requests, ${contractIds.length} contracts, ${jobIds.length} jobs.`);

  await prisma.$transaction([
    prisma.reworkRequest.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.approval.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.proofOfWork.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.jobChecklistResult.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.jobSla.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.workerAssignment.deleteMany({ where: { jobId: { in: jobIds } } }),
    prisma.job.deleteMany({ where: { id: { in: jobIds } } }),

    prisma.payment.deleteMany({ where: { invoice: { contractId: { in: contractIds } } } }),
    prisma.invoice.deleteMany({ where: { contractId: { in: contractIds } } }),
    prisma.contractVersion.deleteMany({ where: { contractId: { in: contractIds } } }),
    prisma.contractSchedule.deleteMany({ where: { contractId: { in: contractIds } } }),
    prisma.contract.deleteMany({ where: { id: { in: contractIds } } }),

    prisma.quotation.deleteMany({ where: { serviceRequestId: { in: srIds } } }),
    prisma.serviceRequestAttachment.deleteMany({ where: { serviceRequestId: { in: srIds } } }),
    prisma.serviceRequest.deleteMany({ where: { id: { in: srIds } } }),

    prisma.area.deleteMany({ where: { floorId: { in: floorIds } } }),
    prisma.floor.deleteMany({ where: { id: { in: floorIds } } }),
    prisma.building.deleteMany({ where: { id: { in: buildingIds } } }),
  ]);

  console.log('Cleanup complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
