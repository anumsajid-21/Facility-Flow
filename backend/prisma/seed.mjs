/**
 * FacilityFlow database seed.
 *
 * Seeds platform infrastructure plus a realistic, repeatable demo workspace.
 * Passwords are hashed before persistence; the credential table printed at the
 * end is intended for local/demo environments only.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SERVICE_CATEGORIES = [
  { name: 'Commercial Cleaning', description: 'Regular professional cleaning of commercial facilities, offices and common areas.' },
  { name: 'Glass/Façade Cleaning', description: 'Interior and exterior glass and building façade cleaning services.' },
  { name: 'HVAC/AC', description: 'HVAC and air-conditioning installation, servicing, repair and maintenance.' },
  { name: 'Electrical', description: 'Electrical installations, repairs, preventive maintenance and safety checks.' },
  { name: 'Plumbing', description: 'Plumbing repair, maintenance and installation services.' },
  { name: 'Pest Control', description: 'Preventive and corrective pest control for commercial facilities.' },
  { name: 'Landscaping', description: 'Grounds maintenance and landscaping services for facilities.' },
  { name: 'General Facility Maintenance', description: 'Broad facility upkeep, repairs and maintenance services.' },
];

const CHECKLISTS = [
  {
    category: 'Glass Cleaning',
    name: 'Glass Cleaning Standard',
    description: 'Default checklist for glass and façade cleaning jobs.',
    items: ['Inspect glass', 'Clean exterior', 'Clean interior', 'Clean frames', 'Inspect damage', 'Final inspection'],
  },
  {
    category: 'HVAC/AC',
    name: 'HVAC Service Standard',
    description: 'Default checklist for HVAC and AC service jobs.',
    items: ['Check filter', 'Check electrical', 'Check drainage', 'Test cooling', 'Inspect outdoor unit'],
  },
  {
    category: 'Commercial Cleaning',
    name: 'Commercial Cleaning Standard',
    description: 'Default checklist for commercial cleaning jobs.',
    items: ['Inspect premises', 'Clean floors', 'Clean surfaces', 'Empty bins', 'Restroom sanitation', 'Final inspection'],
  },
  {
    category: 'Electrical',
    name: 'Electrical Service Standard',
    description: 'Default checklist for electrical service jobs.',
    items: ['Visual inspection', 'Test circuits', 'Check panel', 'Verify safety', 'Test lighting'],
  },
  {
    category: 'Plumbing',
    name: 'Plumbing Service Standard',
    description: 'Default checklist for plumbing jobs.',
    items: ['Inspect pipes', 'Check fixtures', 'Test water pressure', 'Check for leaks', 'Final inspection'],
  },
  {
    category: 'Pest Control',
    name: 'Pest Control Standard',
    description: 'Default checklist for pest control jobs.',
    items: ['Inspect premises', 'Identify infestation', 'Apply treatment', 'Safety checks', 'Final report'],
  },
  {
    category: 'Landscaping',
    name: 'Landscaping Standard',
    description: 'Default checklist for landscaping jobs.',
    items: ['Inspect grounds', 'Mowing / trimming', 'Irrigation check', 'Waste removal', 'Final inspection'],
  },
  {
    category: 'General Facility Maintenance',
    name: 'General Maintenance Standard',
    description: 'Default checklist for general facility maintenance jobs.',
    items: ['Walkthrough', 'Identify issues', 'Perform maintenance', 'Safety check', 'Final inspection'],
  },
];
// Hiring-org and admin seed accounts. Provider accounts live in DEMO_PROVIDERS
// below — keeping every account defined in exactly one place avoids the two
// lists silently fighting over the same email/company (previously both this
// list and DEMO_PROVIDERS created "Prime HVAC", which just meant the second
// pass always overwrote the first — harmless, but confusing and it produced
// a duplicate row in the printed credentials table).
const DEMO_USERS = [
  {
    email: 'hiring@facilityflow.app',
    password: 'Hire@12345',
    name: 'QX Industry Manager',
    role: 'HIRING_ORG',
    organization: 'QX Industry',
  },
  {
    email: 'admin@facilityflow.app',
    password: 'Admin@12345',
    name: 'FacilityFlow Admin',
    role: 'ADMIN',
  },
];

async function seedCategories() {
  const categories = new Map();
  for (const cat of SERVICE_CATEGORIES) {
    const existing = await prisma.serviceCategory.findUnique({ where: { name: cat.name } });
    const record =
      existing ||
      (await prisma.serviceCategory.create({
        data: { name: cat.name, description: cat.description },
      }));
    categories.set(cat.name, record.id);
  }
  return categories;
}

async function seedChecklists(categories) {
  for (const cl of CHECKLISTS) {
    const categoryId = categories.get(cl.category);
    if (!categoryId) continue;
    const existingChecklist = await prisma.checklist.findFirst({
      where: { name: cl.name, categoryId },
    });
    if (existingChecklist) continue;
    await prisma.checklist.create({
      data: {
        name: cl.name,
        categoryId,
        description: cl.description,
        items: {
          create: cl.items.map((description, idx) => ({ description, sortOrder: idx + 1 })),
        },
      },
    });
  }
}

async function seedDemoUsers() {
  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    const hashed = await bcrypt.hash(u.password, 12);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashed, name: u.name, role: u.role, isActive: true },
      });
      continue;
    }

    let hiringOrgId = null;

    if (u.role === 'HIRING_ORG' && u.organization) {
      const existingOrg = await prisma.organization.findFirst({ where: { name: u.organization } });
      const org = existingOrg ?? (await prisma.organization.create({ data: { name: u.organization } }));
      hiringOrgId = org.id;
    }

    const user = await prisma.user.create({
      data: {
        email: u.email,
        password: hashed,
        name: u.name,
        role: u.role,
        hiringOrgId,
      },
    });

    if (hiringOrgId) {
      await prisma.organizationMember.create({
        data: { organizationId: hiringOrgId, userId: user.id, role: 'ADMIN' },
      });
    }
  }
}

const DEMO_PROVIDERS = [
  { email: 'primehvac@facilityflow.app', password: 'Provide@12345', name: 'Prime HVAC Manager', company: 'Prime HVAC' },
  { email: 'sparkleclean@facilityflow.app', password: 'Provide@12345', name: 'SparkleClean Manager', company: 'SparkleClean' },
];

async function seedDemoProviders(categories) {
  const providers = [];
  for (const p of DEMO_PROVIDERS) {
    let provider = await prisma.provider.findFirst({ where: { name: p.company } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: p.company,
          description: `${p.company} — professional facility services.`,
          verificationStatus: p.verificationStatus ?? 'VERIFIED',
          workforceCapacity: 15,
        },
      });
    }
    const user = await prisma.user.findUnique({ where: { email: p.email } });
    if (!user) {
      await prisma.user.create({
        data: {
          email: p.email,
          password: await bcrypt.hash(p.password, 12),
          name: p.name,
          role: 'PROVIDER',
          providerId: provider.id,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(p.password, 12), name: p.name, role: 'PROVIDER', providerId: provider.id, isActive: true },
      });
    }
    for (const catName of ['HVAC/AC', 'Commercial Cleaning']) {
      const categoryId = categories.get(catName);
      if (categoryId) {
        await prisma.providerService.upsert({
          where: { providerId_categoryId: { providerId: provider.id, categoryId } },
          update: {},
          create: { providerId: provider.id, categoryId, priceNote: 'Competitive rates' },
        });
      }
    }
    providers.push(provider);
  }
  return providers;
}

/**
 * Demo business data for the hiring organization: buildings, floors, areas,
 * service requests, quotations, one accepted contract and scheduled jobs.
 * Idempotent: skipped if the org already has buildings/requests.
 */
async function seedBusinessData(org, providers, categories) {
  const hasDemoBuilding = await prisma.building.findFirst({ where: { organizationId: org.id, name: 'HQ Tower' } });
  if (hasDemoBuilding) return; // already seeded

  const hvac = categories.get('HVAC/AC');
  const cleaning = categories.get('Commercial Cleaning');
  const orgUser = await prisma.user.findFirst({ where: { hiringOrgId: org.id } });

  // --- Buildings / Floors / Areas ---
  const hq = await prisma.building.create({
    data: {
      organizationId: org.id,
      name: 'HQ Tower',
      address: '100 Downtown Blvd',
      city: 'Austin',
      buildingType: 'Office',
      numberOfFloors: 2,
    },
  });
  const hqGround = await prisma.floor.create({ data: { buildingId: hq.id, name: 'Ground Floor' } });
  const hqL1 = await prisma.floor.create({ data: { buildingId: hq.id, name: 'Level 1' } });
  const lobby = await prisma.area.create({ data: { floorId: hqGround.id, name: 'Main Lobby', category: 'Lobby' } });
  await prisma.area.create({ data: { floorId: hqGround.id, name: 'Reception Office', category: 'Office' } });
  await prisma.area.create({ data: { floorId: hqL1.id, name: 'Open Workspace', category: 'Office' } });
  const serverRoom = await prisma.area.create({ data: { floorId: hqL1.id, name: 'Server Room', category: 'Equipment room' } });

  const annex = await prisma.building.create({
    data: {
      organizationId: org.id,
      name: 'Riverside Annex',
      address: '42 River Rd',
      city: 'Austin',
      buildingType: 'Office',
      numberOfFloors: 1,
    },
  });
  const annexFloor = await prisma.floor.create({ data: { buildingId: annex.id, name: 'Floor 1' } });
  await prisma.area.create({ data: { floorId: annexFloor.id, name: 'Front Desk', category: 'Office' } });

  // --- Service Requests ---
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 864e5);
  const srHvac = await prisma.serviceRequest.create({
    data: {
      organizationId: org.id,
      createdById: orgUser?.id,
      categoryId: hvac,
      title: 'Quarterly HVAC maintenance',
      description: 'Full HVAC inspection and filter replacement for both floors before summer.',
      buildingId: hq.id,
      floorId: hqL1.id,
      areaId: serverRoom.id,
      requirements: 'Certified technicians, weekend availability.',
      preferredDate: inTwoWeeks,
      budget: 2500,
      priority: 'HIGH',
      status: 'OPEN',
    },
  });
  const srCleaning = await prisma.serviceRequest.create({
    data: {
      organizationId: org.id,
      createdById: orgUser?.id,
      categoryId: cleaning,
      title: 'Lobby deep cleaning',
      description: 'Deep clean of the main lobby including glass and floors.',
      buildingId: hq.id,
      floorId: hqGround.id,
      areaId: lobby.id,
      budget: 800,
      priority: 'NORMAL',
      status: 'OPEN',
    },
  });

  // --- Quotations (submitted, awaiting comparison) ---
  const quotes = [
    { p: providers[0], price: 2200, workers: 3, duration: '2 days' },
    { p: providers[1], price: 2450, workers: 2, duration: '1 day' },
  ];
  for (const q of quotes) {
    await prisma.quotation.create({
      data: {
        serviceRequestId: srHvac.id,
        providerId: q.p.id,
        price: q.price,
        numberOfWorkers: q.workers,
        duration: q.duration,
        sla: 'Response within 4 hours',
        warranty: '90 days',
        terms: '50% upfront, 50% on completion.',
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }
  await prisma.serviceRequest.update({ where: { id: srHvac.id }, data: { status: 'QUOTATIONS_RECEIVED' } });

  // --- Contract from an accepted quotation (on the cleaning request) ---
  const acceptedQuote = await prisma.quotation.create({
    data: {
      serviceRequestId: srCleaning.id,
      providerId: providers[1].id,
      price: 750,
      numberOfWorkers: 4,
      duration: '1 day',
      sla: 'Response within 2 hours',
      status: 'ACCEPTED',
      submittedAt: new Date(),
      shortlistedAt: new Date(),
    },
  });
  await prisma.serviceRequest.update({ where: { id: srCleaning.id }, data: { status: 'PROVIDER_SELECTED' } });

  const start = new Date();
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  const contract = await prisma.contract.create({
    data: {
      organizationId: org.id,
      providerId: providers[1].id,
      serviceRequestId: srCleaning.id,
      quotationId: acceptedQuote.id,
      buildingId: srCleaning.buildingId,
      serviceName: 'Commercial Cleaning',
      title: 'Commercial Cleaning - SparkleClean',
      price: 750,
      startDate: start,
      endDate: end,
      sla: 'Response within 2 hours',
      status: 'ACTIVE',
    },
  });
  await prisma.contractVersion.create({
    data: { contractId: contract.id, version: 1, creatorId: orgUser.id, snapshot: JSON.stringify(contract) },
  });

  // --- Jobs under the contract ---
  const jobDate = new Date(now.getTime() + 7 * 864e5);
  jobDate.setHours(9, 0, 0, 0);
  const jobEnd = new Date(jobDate.getTime() + 8 * 3600e3);
  await prisma.job.create({
    data: {
      contractId: contract.id,
      buildingId: srCleaning.buildingId,
      floorId: hqGround.id,
      areaId: lobby.id,
      title: 'Lobby deep clean visit',
      location: 'HQ Tower - Main Lobby',
      date: jobDate,
      startTime: jobDate,
      endTime: jobEnd,
      serviceName: 'Commercial Cleaning',
      status: 'SCHEDULED',
    },
  });

  console.log('Seed complete: demo buildings, requests, quotations, contract and jobs created.');
}

async function seedOpenDemoRequests(org, categories) {
  const building = await prisma.building.findFirst({ where: { organizationId: org.id, name: 'HQ Tower' } });
  const floor = building ? await prisma.floor.findFirst({ where: { buildingId: building.id }, orderBy: { name: 'asc' } }) : null;
  const area = floor ? await prisma.area.findFirst({ where: { floorId: floor.id } }) : null;
  if (!building || !floor) return;

  const requests = [
    ['Open HVAC filter replacement', 'HVAC/AC', 'Replace filters and inspect airflow in the main office.'],
    ['Open lobby cleaning request', 'Commercial Cleaning', 'Deep clean the lobby floors, glass and reception area.'],
    ['Open rooftop HVAC inspection', 'HVAC/AC', 'Inspect rooftop units and document any required repairs.'],
  ];
  for (const [title, categoryName, description] of requests) {
    const categoryId = categories.get(categoryName);
    if (!categoryId) continue;
    const existing = await prisma.serviceRequest.findFirst({ where: { organizationId: org.id, title } });
    if (!existing) {
      await prisma.serviceRequest.create({
        data: { organizationId: org.id, categoryId, title, description, buildingId: building.id, floorId: floor.id, areaId: area?.id, priority: 'NORMAL', status: 'OPEN' },
      });
    }
  }
}

async function seedReviewDemoJob(org) {
  const contract = await prisma.contract.findFirst({ where: { organizationId: org.id, status: 'ACTIVE' }, include: { provider: true } });
  if (!contract) return;
  const existing = await prisma.job.findFirst({ where: { contractId: contract.id, title: 'Completed review test job' } });
  if (existing) return;
  const building = await prisma.building.findUnique({ where: { id: contract.buildingId } });
  const floor = building ? await prisma.floor.findFirst({ where: { buildingId: building.id } }) : null;
  const area = floor ? await prisma.area.findFirst({ where: { floorId: floor.id } }) : null;
  const completedAt = new Date(Date.now() - 2 * 864e5);
  const job = await prisma.job.create({
    data: {
      contractId: contract.id, buildingId: building.id, floorId: floor?.id, areaId: area?.id,
      title: 'Completed review test job', location: `${building?.name ?? 'Demo facility'} - ${area?.name ?? 'Common area'}`,
      date: completedAt, startTime: new Date(completedAt.getTime() - 2 * 3600000), endTime: completedAt,
      serviceName: contract.serviceName, status: 'COMPLETED', startedAt: new Date(completedAt.getTime() - 2 * 3600000), completedAt,
    },
  });
  await prisma.proofOfWork.create({ data: { jobId: job.id, providerNote: 'Demo service completed and inspected.', completionNote: 'Completed for review testing.', completedAt, workerName: 'Demo Service Team' } });
  const orgUser = await prisma.user.findFirst({ where: { hiringOrgId: org.id } });
  await prisma.approval.create({ data: { jobId: job.id, approvedByUserId: orgUser?.id, decision: 'APPROVED', notes: 'Seeded approval for review testing.' } });
}

const DEMO_WORKERS = [
  { email: 'worker1@facilityflow.app', password: 'Worker123!', name: 'Alex Rivera', skills: 'Commercial cleaning, floor care', certifications: 'OSHA 10', providerIndex: 2 },
  { email: 'worker2@facilityflow.app', password: 'Worker123!', name: 'Jordan Lee', skills: 'HVAC, preventive maintenance', certifications: 'EPA 608', providerIndex: 1 },
  { email: 'worker3@facilityflow.app', password: 'Worker123!', name: 'Sam Patel', skills: 'Electrical, safety inspections', certifications: 'Licensed electrician', providerIndex: 0 },
  { email: 'worker4@facilityflow.app', password: 'Worker123!', name: 'Taylor Morgan', skills: 'Plumbing, general maintenance', certifications: 'OSHA 10', providerIndex: 0 },
  { email: 'worker5@facilityflow.app', password: 'Worker123!', name: 'Riley Chen', skills: 'Electrical installations, panel upgrades', certifications: 'Master electrician', providerIndex: 3 },
  { email: 'worker6@facilityflow.app', password: 'Worker123!', name: 'Morgan Diaz', skills: 'Landscaping, irrigation systems', certifications: 'Pesticide applicator', providerIndex: 4 },
];

async function seedWorkers(providers) {
  const workers = [];
  for (const w of DEMO_WORKERS) {
    const provider = providers[w.providerIndex % providers.length];
    let worker = await prisma.worker.findUnique({ where: { email: w.email } });
    if (!worker) {
      worker = await prisma.worker.create({
        data: { providerId: provider.id, name: w.name, email: w.email, skills: w.skills, certifications: w.certifications, availability: 'Mon-Fri 08:00-17:00', inviteStatus: 'ACCEPTED' },
      });
    }
    let user = await prisma.user.findUnique({ where: { email: w.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: w.email, password: await bcrypt.hash(w.password, 12), name: w.name, role: 'WORKER', providerId: provider.id, isActive: true },
      });
      await prisma.worker.update({ where: { id: worker.id }, data: { userId: user.id } });
    } else if (worker.userId !== user.id) {
      await prisma.worker.update({ where: { id: worker.id }, data: { userId: user.id } });
    }
    workers.push(worker);
  }
  return workers;
}

async function seedExtendedBusiness(org, providers, workers) {
  const contract = await prisma.contract.findFirst({ where: { organizationId: org.id, title: { contains: 'Commercial Cleaning' } }, include: { jobs: true } });
  if (!contract) return;
  const jobs = contract.jobs;
  const job = jobs[0];
  if (job && workers[0]) {
    await prisma.workerAssignment.upsert({
      where: { jobId_workerId: { jobId: job.id, workerId: workers[0].id } },
      update: {},
      create: { jobId: job.id, workerId: workers[0].id },
    });
  }
  const policyByProvider = new Map();
  for (const provider of providers) {
    let policy = await prisma.slaPolicy.findFirst({ where: { providerId: provider.id, name: 'Standard demo SLA' } });
    if (!policy) policy = await prisma.slaPolicy.create({ data: { providerId: provider.id, name: 'Standard demo SLA', responseHours: 4, resolutionHours: 48, warningHours: 8 } });
    policyByProvider.set(provider.id, policy);
  }
  for (const j of jobs) {
    const policy = policyByProvider.get(contract.providerId);
    await prisma.jobSla.upsert({ where: { jobId: j.id }, update: { policyId: policy?.id }, create: { jobId: j.id, policyId: policy?.id, deadline: new Date(j.startTime.getTime() + 48 * 3600000) } });
  }
  // A second provider contract gives the demo dashboard a useful comparison.
  const hvacRequest = await prisma.serviceRequest.findFirst({ where: { organizationId: org.id, title: 'Quarterly HVAC maintenance' } });
  if (hvacRequest && providers[0]) {
    const hvacQuote = await prisma.quotation.findFirst({ where: { serviceRequestId: hvacRequest.id, providerId: providers[0].id } });
    if (hvacQuote) {
      await prisma.quotation.update({ where: { id: hvacQuote.id }, data: { status: 'ACCEPTED' } });
      let hvacContract = await prisma.contract.findFirst({ where: { quotationId: hvacQuote.id } });
      if (!hvacContract) {
        hvacContract = await prisma.contract.create({ data: { organizationId: org.id, providerId: providers[0].id, serviceRequestId: hvacRequest.id, quotationId: hvacQuote.id, buildingId: hvacRequest.buildingId, serviceName: 'HVAC/AC', title: 'HVAC Preventive Maintenance - Demo', price: 2200, startDate: new Date(), endDate: new Date(Date.now() + 365 * 864e5), sla: 'Resolution within 48 hours', status: 'ACTIVE' } });
      }
      const hvacJob = await prisma.job.findFirst({ where: { contractId: hvacContract.id } }) || await prisma.job.create({ data: { contractId: hvacContract.id, buildingId: hvacRequest.buildingId, floorId: hvacRequest.floorId, areaId: hvacRequest.areaId, title: 'Quarterly HVAC inspection', location: 'HQ Tower - Server Room', date: new Date(Date.now() + 10 * 864e5), startTime: new Date(Date.now() + 10 * 864e5), endTime: new Date(Date.now() + 10 * 864e5 + 4 * 3600000), serviceName: 'HVAC/AC', status: 'SCHEDULED' } });
      const hvacPolicy = policyByProvider.get(providers[0].id);
      await prisma.jobSla.upsert({ where: { jobId: hvacJob.id }, update: { policyId: hvacPolicy?.id }, create: { jobId: hvacJob.id, policyId: hvacPolicy?.id, deadline: new Date(hvacJob.startTime.getTime() + 48 * 3600000) } });
      await prisma.invoice.upsert({ where: { invoiceNumber: 'DEMO-0002' }, update: {}, create: { invoiceNumber: 'DEMO-0002', providerId: providers[0].id, organizationId: org.id, contractId: hvacContract.id, jobId: hvacJob.id, amount: 2200, tax: 220, discount: 0, total: 2420, dueDate: new Date(Date.now() + 21 * 864e5), status: 'PENDING' } });
    }
  }
  await prisma.contractSchedule.upsert({
    where: { contractId: contract.id },
    update: {},
    create: { contractId: contract.id, frequency: 'MONTHLY', startsAt: new Date(Date.now() + 30 * 864e5), nextRunAt: new Date(Date.now() + 30 * 864e5), occurrencesLimit: 12 },
  });
  if (job) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: 'DEMO-0001' },
      update: {},
      create: { invoiceNumber: 'DEMO-0001', providerId: contract.providerId, organizationId: org.id, contractId: contract.id, jobId: job.id, amount: 750, tax: 75, discount: 0, total: 825, dueDate: new Date(Date.now() + 14 * 864e5), status: 'ISSUED' },
    });
    await prisma.review.upsert({
      where: { organizationId_providerId_jobId: { organizationId: org.id, providerId: contract.providerId, jobId: job.id } },
      update: {},
      create: { organizationId: org.id, providerId: contract.providerId, jobId: job.id, quality: 5, timeliness: 4, professionalism: 5, value: 4, overallRating: 4.5, comments: 'Reliable team with excellent communication and finish quality.' },
    });
  }

  const providerUser = await prisma.user.findFirst({ where: { providerId: contract.providerId, role: 'PROVIDER' } });
  const orgUser = await prisma.user.findFirst({ where: { hiringOrgId: org.id } });
  if (providerUser && orgUser) {
    const existing = await prisma.messageThread.findFirst({ where: { organizationId: org.id, providerId: contract.providerId, subject: 'Demo contract coordination' } });
    if (!existing) {
      await prisma.messageThread.create({
        data: { organizationId: org.id, providerId: contract.providerId, contractId: contract.id, subject: 'Demo contract coordination', createdById: orgUser.id, messages: { create: [{ senderId: orgUser.id, body: 'Welcome! Please confirm the next lobby cleaning date.' }, { senderId: providerUser.id, body: 'Confirmed. Our team will arrive at 9:00 AM.' }] } },
      });
    }
  }

  // --- Fill remaining coverage gaps so every core feature has >= 2 example records ---

  // Payments: settle the cleaning invoice in full and partially pay the HVAC one.
  const demoInvoice1 = await prisma.invoice.findUnique({ where: { invoiceNumber: 'DEMO-0001' } });
  if (demoInvoice1 && orgUser) {
    const existingPayment = await prisma.payment.findFirst({ where: { paymentReference: 'DEMO-PAY-0001' } });
    if (!existingPayment) {
      await prisma.payment.create({ data: { invoiceId: demoInvoice1.id, amount: demoInvoice1.total, paymentReference: 'DEMO-PAY-0001', paymentMethod: 'BANK_TRANSFER', date: new Date(), status: 'COMPLETED', recordedById: orgUser.id } });
      await prisma.invoice.update({ where: { id: demoInvoice1.id }, data: { status: 'PAID' } });
    }
  }
  const demoInvoice2 = await prisma.invoice.findUnique({ where: { invoiceNumber: 'DEMO-0002' } });
  if (demoInvoice2 && orgUser) {
    const existingPayment = await prisma.payment.findFirst({ where: { paymentReference: 'DEMO-PAY-0002' } });
    if (!existingPayment) {
      await prisma.payment.create({ data: { invoiceId: demoInvoice2.id, amount: Math.round(Number(demoInvoice2.total) * 0.4), paymentReference: 'DEMO-PAY-0002', paymentMethod: 'CARD', date: new Date(), status: 'COMPLETED', recordedById: orgUser.id } });
    }
  }

  // Reviews: a second review on the HVAC provider so this feature isn't a single row.
  const hvacProvider = providers[0];
  const hvacJobRow = await prisma.job.findFirst({ where: { title: 'Quarterly HVAC inspection' } });
  if (hvacProvider && hvacJobRow) {
    await prisma.review.upsert({
      where: { organizationId_providerId_jobId: { organizationId: org.id, providerId: hvacProvider.id, jobId: hvacJobRow.id } },
      update: {},
      create: { organizationId: org.id, providerId: hvacProvider.id, jobId: hvacJobRow.id, quality: 4, timeliness: 5, professionalism: 4, value: 4, overallRating: 4.25, comments: 'Prompt scheduling and thorough filter replacement.' },
    });
  }

  // Messages: a second conversation, this time with the HVAC provider.
  const hvacProviderUser = hvacProvider ? await prisma.user.findFirst({ where: { providerId: hvacProvider.id, role: 'PROVIDER' } }) : null;
  if (hvacProvider && hvacProviderUser && orgUser) {
    const existingThread = await prisma.messageThread.findFirst({ where: { organizationId: org.id, providerId: hvacProvider.id, subject: 'HVAC maintenance scheduling' } });
    if (!existingThread) {
      await prisma.messageThread.create({
        data: {
          organizationId: org.id, providerId: hvacProvider.id, subject: 'HVAC maintenance scheduling', createdById: orgUser.id,
          messages: { create: [
            { senderId: orgUser.id, body: 'Can your team do the quarterly inspection next Tuesday morning?' },
            { senderId: hvacProviderUser.id, body: 'Yes, we can be there at 9 AM. I will send the technician roster beforehand.' },
          ] },
        },
      });
    }
  }

  // Verification documents: gives the admin verification queue real rows to review.
  for (const [provider, docType] of [[providers[0], 'Business License'], [providers[1], 'Insurance Certificate']]) {
    if (!provider) continue;
    const existingDoc = await prisma.verificationDocument.findFirst({ where: { providerId: provider.id, documentType: docType } });
    if (existingDoc) continue;
    const file = await prisma.file.create({
      data: {
        originalName: `${provider.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${docType.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`,
        mimeType: 'application/pdf',
        size: 128_000,
        storageKey: `demo_files/verification_${provider.id}_${docType.replace(/\s+/g, '_')}.pdf`,
        kind: 'PROVIDER_DOCUMENT',
      },
    });
    await prisma.verificationDocument.create({ data: { providerId: provider.id, documentType: docType, fileId: file.id } });
  }

  // Checklist results: mark a couple of items complete on the lobby-clean job.
  if (job) {
    const checklist = await prisma.checklist.findFirst({ where: { name: 'Commercial Cleaning Standard' }, include: { items: { orderBy: { sortOrder: 'asc' }, take: 2 } } });
    for (const item of checklist?.items ?? []) {
      await prisma.jobChecklistResult.upsert({
        where: { jobId_checklistItemId: { jobId: job.id, checklistItemId: item.id } },
        update: {},
        create: { jobId: job.id, checklistId: checklist.id, checklistItemId: item.id, isChecked: true },
      });
    }
  }
}

async function seedSecondOrganization(categories) {
  const electricalId = categories.get('Electrical');
  const cleaningId = categories.get('Commercial Cleaning');
  const plumbingId = categories.get('Plumbing');
  let org = await prisma.organization.findFirst({ where: { name: 'Metro Healthcare Group' } });
  if (!org) org = await prisma.organization.create({ data: { name: 'Metro Healthcare Group', description: 'Regional healthcare facilities demo tenant', contactEmail: 'ops@metro-health.test' } });
  let user = await prisma.user.findUnique({ where: { email: 'ops@metrohealth.app' } });
  if (!user) {
    user = await prisma.user.create({ data: { email: 'ops@metrohealth.app', password: await bcrypt.hash('Hire@12345', 12), name: 'Metro Healthcare Operations Lead', role: 'HIRING_ORG', hiringOrgId: org.id } });
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: 'ADMIN' } });
  }
  const buildingsExist = await prisma.building.findFirst({ where: { organizationId: org.id, name: 'Metro General Hospital' } });
  if (buildingsExist) {
    const adminB = await prisma.building.findFirst({ where: { organizationId: org.id, name: 'Metro Administrative Center' } });
    return { org, user, categories: { electricalId, cleaningId, plumbingId }, hospital: buildingsExist, adminB,
      metroElectrical: await prisma.provider.findFirst({ where: { name: 'Prime HVAC' } }),
      demoProvider: await prisma.provider.findFirst({ where: { name: 'SparkleClean' } }) };
  }

  const metroElectrical = await prisma.provider.findFirst({ where: { name: 'Prime HVAC' } });
  const demoProvider = await prisma.provider.findFirst({ where: { name: 'SparkleClean' } });

  const hospital = await prisma.building.create({ data: { organizationId: org.id, name: 'Metro General Hospital', address: '1200 Wellness Ave', city: 'Dallas', buildingType: 'Hospital', numberOfFloors: 4 } });
  const adminB = await prisma.building.create({ data: { organizationId: org.id, name: 'Metro Administrative Center', address: '45 Care Blvd', city: 'Dallas', buildingType: 'Office', numberOfFloors: 2 } });
  const westsideB = await prisma.building.create({ data: { organizationId: org.id, name: 'Westside Industrial Park', address: '880 Logistics Way', city: 'Dallas', buildingType: 'Warehouse', numberOfFloors: 3 } });
  const techCampusB = await prisma.building.create({ data: { organizationId: org.id, name: 'Sunrise Tech Campus', address: '101 Innovation Dr', city: 'Dallas', buildingType: 'Data Center', numberOfFloors: 5 } });

  for (const [b, floors] of [
    [hospital, ['Level 1', 'Level 2', 'Level 3', 'Level 4']],
    [adminB, ['Ground Floor', 'Level 1']],
    [westsideB, ['Bay A - Ground', 'Bay B - Mezzanine', 'Bay C - Storage']],
    [techCampusB, ['Floor 1 - Reception', 'Floor 2 - Labs', 'Floor 3 - Server Room', 'Floor 4 - Executive', 'Floor 5 - Rooftop HVAC']],
  ]) {
    for (const fname of floors) {
      const floor = await prisma.floor.create({ data: { buildingId: b.id, name: fname } });
      await prisma.area.create({ data: { floorId: floor.id, name: `${fname} Common Area`, category: 'Common area' } });
      await prisma.area.create({ data: { floorId: floor.id, name: `${fname} Utility Room`, category: 'Equipment room' } });
    }
  }
  return { org, user, categories: { electricalId, cleaningId, plumbingId }, metroElectrical, demoProvider, hospital, adminB, westsideB, techCampusB };
}

async function seedMetroPipeline(ctx) {
  const { org, user, categories, metroElectrical, demoProvider, hospital, adminB } = ctx;
  const srSpecs = [
    { title: 'Emergency generator inspection', category: categories.electricalId, building: hospital, status: 'OPEN', priority: 'HIGH' },
    { title: 'Ward corridor deep cleaning', category: categories.cleaningId, building: hospital, status: 'QUOTATIONS_RECEIVED', priority: 'NORMAL' },
    { title: 'Admin center panel upgrade', category: categories.electricalId, building: adminB, status: 'UNDER_REVIEW', priority: 'NORMAL' },
    { title: 'Clinic plumbing leak repair', category: categories.plumbingId, building: hospital, status: 'PROVIDER_SELECTED', priority: 'HIGH' },
    { title: 'Old boiler room decommission quote', category: categories.plumbingId, building: adminB, status: 'CANCELLED', priority: 'LOW' },
    { title: 'Completed wing electrical refit', category: categories.electricalId, building: hospital, status: 'CLOSED', priority: 'NORMAL' },
    { title: 'Draft: pediatric wing lighting', category: categories.electricalId, building: hospital, status: 'DRAFT', priority: 'LOW' },
  ];
  const createdSRs = [];
  for (const spec of srSpecs) {
    let sr = await prisma.serviceRequest.findFirst({ where: { organizationId: org.id, title: spec.title } });
    if (!sr) {
      const floor = await prisma.floor.findFirst({ where: { buildingId: spec.building.id } });
      const area = await prisma.area.findFirst({ where: { floorId: floor.id } });
      sr = await prisma.serviceRequest.create({ data: { organizationId: org.id, createdById: user.id, categoryId: spec.category, title: spec.title, description: `${spec.title} — seeded demo request.`, buildingId: spec.building.id, floorId: floor.id, areaId: area.id, budget: 900, priority: spec.priority, status: spec.status } });
    }
    createdSRs.push({ sr, spec });
  }

  const quoteStatuses = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'];
  const providersForQuotes = [metroElectrical, demoProvider].filter(Boolean);
  let quoteIdx = 0;
  for (const { sr, spec } of createdSRs) {
    if (!['QUOTATIONS_RECEIVED', 'UNDER_REVIEW', 'PROVIDER_SELECTED'].includes(spec.status)) continue;
    const provider = providersForQuotes[quoteIdx % providersForQuotes.length];
    let status = quoteStatuses[quoteIdx % quoteStatuses.length];
    if (spec.status === 'PROVIDER_SELECTED') status = 'ACCEPTED';
    const existingQuote = await prisma.quotation.findFirst({ where: { serviceRequestId: sr.id, providerId: provider.id } });
    if (!existingQuote) {
      await prisma.quotation.create({ data: { serviceRequestId: sr.id, providerId: provider.id, price: 1500 + quoteIdx * 250, duration: `${10 + quoteIdx} days`, notes: `Seeded demo quotation (${status}).`, status, submittedAt: new Date() } });
    }
    quoteIdx++;
  }

  const acceptedQuote = await prisma.quotation.findFirst({ where: { serviceRequest: { organizationId: org.id }, status: 'ACCEPTED' }, include: { serviceRequest: true }, orderBy: { submittedAt: 'asc' } });
  if (acceptedQuote) {
    const existingContract = await prisma.contract.findUnique({ where: { quotationId: acceptedQuote.id } });
    if (!existingContract) {
      await prisma.contract.create({ data: { organizationId: org.id, providerId: acceptedQuote.providerId, serviceRequestId: acceptedQuote.serviceRequestId, quotationId: acceptedQuote.id, buildingId: acceptedQuote.serviceRequest.buildingId, serviceName: 'Electrical', title: 'Clinic Electrical Works - Metro Health', price: 1750, startDate: new Date(Date.now() - 30 * 864e5), endDate: new Date(Date.now() + 335 * 864e5), sla: 'Resolution within 24 hours', status: 'ACTIVE' } });
    }
  }
  const closedSR = createdSRs.find((c) => c.spec.status === 'CLOSED');
  if (closedSR && demoProvider) {
    let q = await prisma.quotation.findFirst({ where: { serviceRequestId: closedSR.sr.id, providerId: demoProvider.id } });
    if (!q) {
      q = await prisma.quotation.create({ data: { serviceRequestId: closedSR.sr.id, providerId: demoProvider.id, price: 2600, duration: '14 days', notes: 'Completed historical work.', status: 'ACCEPTED', submittedAt: new Date(Date.now() - 310 * 864e5) } });
    }
    const existingClosedContract = await prisma.contract.findUnique({ where: { quotationId: q.id } });
    if (!existingClosedContract) {
      await prisma.contract.create({ data: { organizationId: org.id, providerId: demoProvider.id, serviceRequestId: closedSR.sr.id, quotationId: q.id, buildingId: closedSR.spec.building.id, serviceName: 'Electrical', title: 'Wing Electrical Refit - Completed', price: 2600, startDate: new Date(Date.now() - 300 * 864e5), endDate: new Date(Date.now() - 30 * 864e5), status: 'TERMINATED' } });
    }
  }

  const activeContract = await prisma.contract.findFirst({ where: { organizationId: org.id, status: 'ACTIVE' }, include: { jobs: true } });
  if (activeContract) {
    await prisma.contract.update({
      where: { id: activeContract.id },
      data: { title: 'Electrical Maintenance Program - Metro Health', price: 17500 },
    });
    const hospitalFloor = await prisma.floor.findFirst({ where: { buildingId: hospital.id } });
    const hospitalArea = await prisma.area.findFirst({ where: { floorId: hospitalFloor.id } });
    const jobSpecs = [
      { title: 'Panel inspection - Level 2', daysOffset: -20, status: 'IN_PROGRESS', slaBreached: true },
      { title: 'HVAC Filter & Duct Sanitize', daysOffset: -2, status: 'IN_PROGRESS', slaBreached: false },
      { title: 'Outlet replacement - Level 1', daysOffset: -5, status: 'REWORK', slaBreached: false },
      { title: 'Fire Alarm Sensor Calibration', daysOffset: -1, status: 'REWORK', slaBreached: false },
      { title: 'Generator test run', daysOffset: 5, status: 'SCHEDULED', slaBreached: false },
      { title: 'Lighting retrofit - Level 3', daysOffset: 12, status: 'SCHEDULED', slaBreached: false },
      { title: 'Emergency Transformer Repair', daysOffset: -10, status: 'COMPLETED', slaBreached: false },
      { title: 'Main Switchboard Thermography', daysOffset: -8, status: 'COMPLETED', slaBreached: false },
      { title: 'Elevator Shaft Wiring Audit', daysOffset: -3, status: 'AWAITING_APPROVAL', slaBreached: false },
      { title: 'Chiller Water Line Inspection', daysOffset: -1, status: 'AWAITING_APPROVAL', slaBreached: false },
    ];
    const metroJobs = [];
    for (const spec of jobSpecs) {
      const date = new Date(Date.now() + spec.daysOffset * 864e5);
      const job = await prisma.job.findFirst({ where: { contractId: activeContract.id, title: spec.title } }) || await prisma.job.create({ data: { contractId: activeContract.id, buildingId: hospital.id, floorId: hospitalFloor.id, areaId: hospitalArea.id, title: spec.title, location: `Metro General Hospital - ${spec.title}`, date, startTime: date, endTime: new Date(date.getTime() + 4 * 3600000), serviceName: 'Electrical', status: spec.status } });
      metroJobs.push({ job, spec });
      const slaPolicy = await prisma.slaPolicy.findFirst({ where: { providerId: activeContract.providerId } });
      await prisma.jobSla.upsert({
        where: { jobId: job.id },
        update: { policyId: slaPolicy?.id, deadline: new Date(date.getTime() + (spec.slaBreached ? -12 : 48) * 3600000), breachedAt: spec.slaBreached ? new Date(date.getTime() + 60 * 3600000) : null },
        create: { jobId: job.id, policyId: slaPolicy?.id, deadline: new Date(date.getTime() + (spec.slaBreached ? -12 : 48) * 3600000), breachedAt: spec.slaBreached ? new Date(date.getTime() + 60 * 3600000) : null },
      });

      // Seed Proof of Work for completed, awaiting_approval, rework, and in_progress jobs
      if (['IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED', 'REWORK'].includes(spec.status)) {
        const existingProof = await prisma.proofOfWork.findFirst({ where: { jobId: job.id } });
        if (existingProof) continue;
        const slug = spec.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const beforeFile = await prisma.file.create({
          data: {
            originalName: `${slug}_before_inspection.jpg`,
            mimeType: 'image/jpeg',
            size: 185400,
            storageKey: `demo_files/${job.id}_before.jpg`,
            kind: 'JOB_PHOTO',
            uploadedById: user.id,
          },
        });
        const afterFile = await prisma.file.create({
          data: {
            originalName: `${slug}_after_completion.jpg`,
            mimeType: 'image/jpeg',
            size: 214900,
            storageKey: `demo_files/${job.id}_after.jpg`,
            kind: 'JOB_PHOTO',
            uploadedById: user.id,
          },
        });
        await prisma.proofOfWork.create({
          data: {
            jobId: job.id,
            providerNote: `Safety procedures & diagnostic checks initialized for ${spec.title}. Work zone isolated.`,
            completionNote: spec.status === 'REWORK'
              ? 'Re-inspected wiring connections and replaced faulty fuse blocks.'
              : `All task steps completed per standards for ${spec.title}. Final inspection verified.`,
            completedById: user.id,
            workerName: 'Certified Electrical Tech (Demo Provider)',
            beforePhotos: { connect: [{ id: beforeFile.id }] },
            afterPhotos: { connect: [{ id: afterFile.id }] },
          },
        });
      }
    }
    const reworkEntry = metroJobs.find((m) => m.spec.status === 'REWORK');
    if (reworkEntry) {
      const existingRework = await prisma.reworkRequest.findFirst({ where: { jobId: reworkEntry.job.id } });
      if (!existingRework) {
        await prisma.reworkRequest.create({ data: { jobId: reworkEntry.job.id, requestedById: user.id, reason: 'Two outlets failed post-inspection testing.' } });
      }
    }
    // 6+ months of payment history across invoices
    for (let m = 7; m >= 1; m--) {
      const invMonth = new Date(Date.now() - m * 30 * 864e5);
      const amount = 1400 + (m % 3) * 200;
      const paid = m > 1;
      const invNumber = `METRO-${String(1000 + m)}`;
      const invoice = await prisma.invoice.upsert({ where: { invoiceNumber: invNumber }, update: {}, create: { invoiceNumber: invNumber, providerId: activeContract.providerId, organizationId: org.id, contractId: activeContract.id, amount, tax: Math.round(amount * 0.1), discount: 0, total: Math.round(amount * 1.1), dueDate: new Date(invMonth.getTime() + 21 * 864e5), status: paid ? 'PAID' : 'PENDING' } });
      if (paid) {
        const paymentRef = `METRO-PAY-${m}`;
        const existingPayment = await prisma.payment.findFirst({ where: { paymentReference: paymentRef } });
        if (!existingPayment) {
          await prisma.payment.create({ data: { invoiceId: invoice.id, amount: invoice.total, paymentReference: paymentRef, paymentMethod: 'BANK_TRANSFER', date: new Date(invMonth.getTime() + 18 * 864e5), status: 'COMPLETED', recordedById: user.id } });
        }
      }
    }
    await prisma.review.upsert({ where: { organizationId_providerId_jobId: { organizationId: org.id, providerId: activeContract.providerId, jobId: metroJobs[0].job.id } }, update: {}, create: { organizationId: org.id, providerId: activeContract.providerId, jobId: metroJobs[0].job.id, quality: 4, timeliness: 2, professionalism: 4, value: 3, overallRating: 3.25, comments: 'Work complete but SLA deadline was missed.' } });
    const existingSeedNotification = await prisma.notification.findFirst({ where: { userId: user.id, type: 'SLA_BREACH', title: 'SLA breached' } });
    if (!existingSeedNotification) {
      await prisma.notification.createMany({ data: [
        { userId: user.id, type: 'SLA_BREACH', title: 'SLA breached', message: 'Panel inspection job breached its SLA deadline.', isRead: true },
        { userId: user.id, type: 'REWORK_REQUESTED', title: 'Rework requested', message: 'Outlet replacement job needs rework.', isRead: false },
        { userId: user.id, type: 'INVOICE_ISSUED', title: 'New invoice', message: 'A new invoice is awaiting your payment.', isRead: false },
      ] });
    }
    const existingSeedAudit = await prisma.auditLog.findFirst({ where: { entityType: 'Contract', entityId: activeContract.id, action: 'CONTRACT_CREATED' } });
    if (!existingSeedAudit) {
      await prisma.auditLog.createMany({ data: [
        { actorId: user.id, action: 'CONTRACT_CREATED', entityType: 'Contract', entityId: activeContract.id, details: 'Contract created via seed' },
        { actorId: user.id, action: 'JOB_CREATED', entityType: 'Job', entityId: metroJobs[0].job.id, details: 'Panel inspection job created' },
        { actorId: user.id, action: 'REWORK_REQUESTED', entityType: 'ReworkRequest', entityId: (reworkEntry?.job ?? metroJobs[1].job).id, details: 'Rework requested by org' },
      ] });
    }
  }
}
async function main() {
  const categories = await seedCategories();
  await seedChecklists(categories);
  await seedDemoUsers();
  const providers = await seedDemoProviders(categories);
  const workers = await seedWorkers(providers);
  // Attach demo business data to the demo hiring organization
  const org = await prisma.organization.findFirst({ where: { name: 'QX Industry' } });
  if (org) {
    await seedBusinessData(org, providers, categories);
    await seedOpenDemoRequests(org, categories);
    await seedReviewDemoJob(org);
    await seedExtendedBusiness(org, providers, workers);
  }
  const metroCtx = await seedSecondOrganization(categories);
  if (metroCtx && metroCtx.hospital) {
    await seedMetroPipeline(metroCtx);
  }
  console.log('\nDemo credentials');
  console.table([
    ...DEMO_USERS.map(({ email, password, role }) => ({ role, email, password })),
    { role: 'HIRING_ORG', email: 'ops@metrohealth.app', password: 'Hire@12345' },
    ...DEMO_PROVIDERS.map(({ email, password }) => ({ role: 'PROVIDER', email, password })),
    ...DEMO_WORKERS.map(({ email, password }) => ({ role: 'WORKER', email, password })),
  ]);
  console.log('Seed complete: categories, checklists, demo organizations/providers/workers and business workflows are ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

