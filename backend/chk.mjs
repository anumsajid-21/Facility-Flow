import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const org = await p.organization.findFirst({ where: { name: 'Metro Healthcare Group' } });
console.log('metro srs:', await p.serviceRequest.count({ where: { organizationId: org.id } }));
console.log('metro contracts:', (await p.contract.findMany({ where: { organizationId: org.id }, select: { title: true, status: true } })));
console.log('metro jobs:', await p.job.count({ where: { building: { organizationId: org.id } } }));
await p.$disconnect();
