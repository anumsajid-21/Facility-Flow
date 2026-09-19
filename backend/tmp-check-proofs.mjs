import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = 'http://localhost:3001/api/v1';
async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  return j.data?.access_token;
}
const provTok = await login('primehvac@facilityflow.app', 'Provide@12345');
const orgTok = await login('hiring@facilityflow.app', 'Hire@12345');
const meR = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${provTok}` } })).json();
console.log('me raw:', JSON.stringify(meR).slice(0, 400));
const provId = meR.data?.providerId ?? meR.providerId;
const proofs = await (await fetch(`${API}/jobs/proof/by-provider/${provId}`, { headers: { Authorization: `Bearer ${provTok}` } })).json();
console.log('provider portfolio count:', proofs.data?.length ?? proofs);
const orgProofs = await (await fetch(`${API}/jobs/proof/by-provider/${provId}`, { headers: { Authorization: `Bearer ${orgTok}` } })).json();
console.log('org view count:', orgProofs.data?.length ?? JSON.stringify(orgProofs).slice(0, 200));
// provider names
const provs = await prisma.provider.findMany({ select: { id: true, name: true } });
console.log(provs);
await prisma.$disconnect();
