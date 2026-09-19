/**
 * FacilityFlow demo-data enrichment.
 *
 * Adds realistic, idempotent mock data across ALL functional areas for the
 * demo workspace so every page/screen has something to show:
 *   - Messaging (threads + messages between the demo org and its providers)
 *   - SLA tracking (policies per provider + JobSla rows for demo jobs)
 *   - Recurring schedules (ContractSchedule on demo contracts)
 *   - Jobs in every pipeline status (with worker assignments)
 *   - Invoices across statuses (with payments)
 *   - Reviews and notifications
 *
 * Safe to re-run: it resolves existing rows and skips/updates instead of
 * duplicating. Only touches the demo organization and the three demo providers.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 24 * 3600e3;
const HOUR = 3600e3;

function dayOffset(days, hour = 9) {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function findOne(model, where) {
  return prisma[model].findFirst({ where });
}

async function ensureSlaPolicy(providerId, name, opts = {}) {
  let policy = await findOne('slaPolicy', { providerId, name });
  if (!policy) {
    policy = await prisma.slaPolicy.create({
      data: { providerId, name, ...opts },
    });
  }
  return policy;
}

async function run() {
  const org = await findOne('organization', { name: 'QX Industry' });
  if (!org) {
    console.log('Demo org not found — run `npm run db:seed` first.');
    return;
  }
  const orgUser = await findOne('user', { hiringOrgId: org.id });

  const providers = [];
  const providerEmails = [
    'primehvac@facilityflow.app',
    'sparkleclean@facilityflow.app',
  ];
  for (const email of providerEmails) {
    const u = await prisma.user.findUnique({ where: { email }, include: { provider: true } });
    if (u && u.provider) providers.push({ user: u, provider: u.provider });
  }
  if (providers.length === 0) {
    console.log('Demo providers not found — run `npm run db:seed` first.');
    return;
  }
// Buildings / floors / areas for the demo org.
  const buildings = await prisma.building.findMany({ where: { organizationId: org.id }, include: { floors: true } });
  const hq = buildings.find((b) => b.name === 'HQ Tower');
  const hqGround = hq?.floors.find((f) => f.name === 'Ground Floor');
  const hqL1 = hq?.floors.find((f) => f.name === 'Level 1');

  // The demo org's contracts (only the three demo providers), kept recent.
  const demoProviderIds = providers.map((p) => p.provider.id);
  const contracts = (
    await prisma.contract.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      include: { jobs: true, provider: true },
    })
  ).filter((c) => demoProviderIds.includes(c.providerId));

  if (contracts.length === 0) {
    console.log('No demo contracts found for providers — run `npm run db:seed` first.');
    return;
  }

  const now = new Date();

  // 1. SLA policies for each demo provider.
  const policiesByProvider = {};
  for (const { provider } of providers) {
    const policy = await ensureSlaPolicy(
      provider.id,
      'Standard demo SLA',
      { responseHours: 4, resolutionHours: 48, warningHours: 8 }
    );
    if (provider.name.includes('Sparkle')) {
      await ensureSlaPolicy(provider.id, 'Premium SLA', { responseHours: 2, resolutionHours: 24, warningHours: 4 });
    }
    policiesByProvider[provider.id] = policy;
  }

  // 2. Jobs across all statuses + JobSla + worker assignments.
  const workersByProvider = new Map();
  for (const { provider } of providers) {
    const ws = await prisma.worker.findMany({ where: { providerId: provider.id }, take: 4 });
    workersByProvider.set(provider.id, ws);
  }
const jobTemplates = [
    { title: 'Lobby deep clean visit', location: 'HQ Tower - Main Lobby', floor: null, area: null, serviceName: 'Commercial Cleaning', status: 'SCHEDULED', days: 7 },
    { title: 'Restroom sanitation & floor care', location: 'HQ Tower - Ground Floor', floor: null, area: null, serviceName: 'Commercial Cleaning', status: 'ASSIGNED', days: 5 },
    { title: 'Office sanitization sweep', location: 'HQ Tower - Level 1', floor: 'L1', area: null, serviceName: 'Commercial Cleaning', status: 'IN_PROGRESS', days: 1 },
    { title: 'HVAC filter replacement', location: 'HQ Tower - Server Room', floor: 'L1', area: 'Server Room', serviceName: 'HVAC/AC', status: 'IN_PROGRESS', days: 0 },
    { title: 'AC unit deep service', location: 'HQ Tower - Server Room', floor: 'L1', area: 'Server Room', serviceName: 'HVAC/AC', status: 'AWAITING_APPROVAL', days: -2 },
    { title: 'Quarterly HVAC inspection', location: 'HQ Tower - Server Room', floor: 'L1', area: 'Server Room', serviceName: 'HVAC/AC', status: 'COMPLETED', days: -9 },
    { title: 'Electrical panel safety check', location: 'Riverside Annex - Floor 1', floor: null, area: null, serviceName: 'Electrical', status: 'REWORK', days: -3 },
  ];

  const floorByKey = (key) => (key === 'L1' ? hqL1 : hqGround);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const serverRoomArea = await findOne('area', { name: 'Server Room' });
  let jobCounter = 0;
  for (const t of jobTemplates) {
    const contract = contracts[jobCounter % contracts.length];
    jobCounter += 1;
    const building = hq ?? buildingById.get(contract.buildingId);
    const floor = floorByKey(t.floor);

    const jobDate = dayOffset(t.days, 9);
    const inProgressStatuses = ['IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED', 'REWORK'];
    let job = await prisma.job.findFirst({
      where: { contractId: contract.id, title: t.title },
      include: { workerAssignments: true },
    });
    if (!job) {
      job = await prisma.job.create({
        data: {
          contractId: contract.id,
          buildingId: building.id,
          floorId: floor?.id ?? null,
          areaId: t.area === 'Server Room' ? serverRoomArea?.id ?? null : null,
          title: t.title,
          location: t.location,
          date: jobDate,
          startTime: jobDate,
          endTime: new Date(jobDate.getTime() + 8 * HOUR),
          serviceName: t.serviceName,
          instructions: `${t.serviceName} service. Standard safety rules apply.`,
          status: t.status,
          startedAt: inProgressStatuses.includes(t.status) ? dayOffset(t.days, 8) : null,
          completedAt: ['AWAITING_APPROVAL', 'COMPLETED'].includes(t.status) ? new Date(jobDate.getTime() + 6 * HOUR) : null,
        },
      });
    }

    const policy = policiesByProvider[contract.providerId];
    const slaStatus = t.status === 'COMPLETED' ? 'COMPLETED' : t.status === 'REWORK' ? 'BREACHED' : 'ON_TRACK';
    const deadline = new Date(jobDate.getTime() + 48 * HOUR);
    await prisma.jobSla.upsert({
      where: { jobId: job.id },
      update: { status: slaStatus, completedAt: slaStatus === 'COMPLETED' ? job.completedAt : null },
      create: { jobId: job.id, policyId: policy?.id, deadline, status: slaStatus, completedAt: slaStatus === 'COMPLETED' ? job.completedAt : null },
    });

    const workers = workersByProvider.get(contract.providerId) || [];
    const assignedCount = job.workerAssignments?.length ?? 0;
    if (assignedCount === 0 && workers.length > 0 && t.status !== 'REWORK') {
      const worker = workers[jobCounter % workers.length];
      await prisma.workerAssignment.create({ data: { jobId: job.id, workerId: worker.id, assignedBy: orgUser?.id } });
    }
  }

  // 3. Recurring contract schedules.
  const freqByProvider = ['WEEKLY', 'MONTHLY', 'QUARTERLY'];
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    await prisma.contractSchedule.upsert({
      where: { contractId: c.id },
      update: {},
      create: {
        contractId: c.id,
        frequency: freqByProvider[i % freqByProvider.length],
        startsAt: dayOffset(1),
        nextRunAt: dayOffset(1),
        endsAt: new Date(Date.now() + 180 * DAY),
        occurrencesLimit: 24,
      },
    });
  }
// 4. Message threads between the demo org and each provider.
  const threadTemplates = [
    {
      subject: 'Demo contract coordination',
      contractMatch: /Commercial Cleaning/i,
      senderOrder: ['org', 'prov', 'prov', 'org'],
      msgs: [
        'Welcome! Please confirm the next lobby cleaning date.',
        'Confirmed. Our team will arrive at 9:00 AM.',
        "We'll send before/after photos once the visit is complete.",
        "Great — we're looking forward to it.",
      ],
    },
    {
      subject: 'Quarterly HVAC maintenance',
      contractMatch: /HVAC/i,
      senderOrder: ['org', 'prov', 'org'],
      msgs: [
        'Can you fit in the quarterly HVAC inspection before the summit?',
        'Yes, we can schedule it for next week at the server room.',
        'Perfect — please include a filter replacement.',
      ],
    },
    {
      subject: 'Invoice query',
      contractMatch: /./,
      senderOrder: ['org', 'prov', 'prov'],
      msgs: [
        'Please share a breakdown for the latest invoice.',
        'Sure — labour, materials and tax are itemised on the PDF.',
        'Let me know if you need the PO number on it.',
      ],
    },
  ];

  for (const t of threadTemplates) {
    const contract = contracts.find((c) => t.contractMatch.test(c.title || '')) || contracts[0];
    const provider = providers.find((p) => p.provider.id === contract.providerId) || providers[0];
    const existing = await findOne('messageThread', {
      organizationId: org.id,
      providerId: provider.provider.id,
      subject: t.subject,
    });
    if (existing) continue;
    const thread = await prisma.messageThread.create({
      data: {
        organizationId: org.id,
        providerId: provider.provider.id,
        contractId: contract.id,
        subject: t.subject,
        createdById: orgUser.id,
      },
    });
    const senders = { org: orgUser, prov: provider.user };
    for (let i = 0; i < t.msgs.length; i++) {
      const who = t.senderOrder[i % t.senderOrder.length];
      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: senders[who].id,
          body: t.msgs[i],
          createdAt: new Date(now.getTime() - (t.msgs.length - i) * HOUR),
        },
      });
    }
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(now.getTime() - HOUR) },
    });
  }

  // 5. Invoices across statuses + payments.
  const invoiceTemplates = [
    { subject: /Commercial Cleaning/i, status: 'ISSUED', number: 'DEMO-0001', amount: 750, tax: 75, total: 825, due: 14 },
    { subject: /HVAC/i, status: 'PENDING', number: 'DEMO-0002', amount: 2200, tax: 220, total: 2420, due: 21 },
    { subject: /Commercial Cleaning/i, status: 'PAID', number: 'DEMO-0003', amount: 1200, tax: 120, total: 1320, due: -8 },
    { subject: /HVAC/i, status: 'OVERDUE', number: 'DEMO-0004', amount: 640, tax: 64, total: 704, due: -40 },
  ];
  for (const t of invoiceTemplates) {
    const contract = contracts.find((c) => t.subject.test(c.title || '')) || contracts[0];
    const provider = providers.find((p) => p.provider.id === contract.providerId) || providers[0];
    const job = await prisma.job.findFirst({ where: { contractId: contract.id } });
    const existing = await findOne('invoice', { invoiceNumber: t.number });
    if (!existing) {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: t.number,
          providerId: provider.provider.id,
          organizationId: org.id,
          contractId: contract.id,
          jobId: job?.id ?? null,
          amount: t.amount,
          tax: t.tax,
          discount: 0,
          total: t.total,
          issuedById: orgUser?.id,
          dueDate: dayOffset(t.due),
          status: t.status,
        },
      });
      if (t.status === 'PAID') {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: t.total,
            paymentReference: `PAY-${t.number}`,
            date: dayOffset(-10),
            paymentMethod: 'Bank Transfer',
            recordedById: orgUser?.id,
            status: 'COMPLETED',
          },
        });
      } else if (t.status === 'OVERDUE') {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: 300,
            paymentReference: `PAY-PARTIAL-${t.number}`,
            date: dayOffset(-30),
            paymentMethod: 'Credit Card',
            recordedById: orgUser?.id,
            status: 'COMPLETED',
          },
        });
      }
    }
  }
// 6. Reviews for the demo providers — guarantee >= 2 reviews per provider so
  //    the provider "Reviews received" tab and the org Reviews table always
  //    have data. Prefers COMPLETED jobs but falls back to any job status.
  const reviewSeeds = [
    { quality: 5, timeliness: 4, professionalism: 5, value: 4, overall: 4.5, comments: 'Reliable team with excellent communication and finish quality.' },
    { quality: 4, timeliness: 5, professionalism: 4, value: 4, overall: 4.3, comments: 'Technicians were punctual and very knowledgeable about the systems they serviced.' },
    { quality: 5, timeliness: 5, professionalism: 5, value: 5, overall: 5.0, comments: 'Outstanding service quality — everything looked brand new afterwards.' },
  ];
  for (const { provider } of providers) {
    const jobs = await prisma.job.findMany({
      where: { contract: { providerId: provider.id } },
      orderBy: { createdAt: 'desc' },
    });
    const candidates = [
      ...jobs.filter((j) => j.status === 'COMPLETED'),
      ...jobs.filter((j) => j.status !== 'COMPLETED'),
    ];
    if (candidates.length === 0) continue;
    const existing = await prisma.review.findMany({
      where: { providerId: provider.id, organizationId: org.id },
      select: { jobId: true },
    });
    const reviewedJobIds = new Set(existing.map((r) => r.jobId));
    for (const s of reviewSeeds) {
      const job = candidates.find((j) => !reviewedJobIds.has(j.id));
      if (!job) break;
      reviewedJobIds.add(job.id);
      await prisma.review.upsert({
        where: {
          organizationId_providerId_jobId: {
            organizationId: org.id,
            providerId: provider.id,
            jobId: job.id,
          },
        },
        update: {},
        create: {
          providerId: provider.id,
          organizationId: org.id,
          jobId: job.id,
          quality: s.quality,
          timeliness: s.timeliness,
          professionalism: s.professionalism,
          value: s.value,
          overallRating: s.overall,
          comments: s.comments,
        },
      });
    }
  }

  // 7. Notifications for the demo users.
  const notifySeeds = [
    { user: orgUser, type: 'QUOTATION_RECEIVED', title: 'New quotation received', message: 'A provider submitted a quotation for the lobby deep cleaning request.' },
    { user: orgUser, type: 'JOB_APPROVAL', title: 'Job awaiting approval', message: 'A job has been completed and is awaiting your approval.' },
    { user: orgUser, type: 'INVOICE_ISSUED', title: 'Invoice issued', message: 'A new invoice has been issued for a completed job.' },
  ];
  for (const s of notifySeeds) {
    if (!s.user) continue;
    const existing = await findOne('notification', { userId: s.user.id, type: s.type, title: s.title });
    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: s.user.id,
          type: s.type,
          title: s.title,
          message: s.message,
          createdAt: new Date(now.getTime() - 2 * DAY),
        },
      });
    }
  }

  console.log(`Demo enrichment complete: ${providers.length} providers, ${contracts.length} contracts; jobs, invoices, threads, SLA, recurring, reviews, notifications updated.`);
}

run()
  .catch((e) => {
    console.error('Seed demo data failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());