/* FacilityFlow E2E workflow test: register/login -> quote -> accept -> contract -> job -> worker -> proof -> approve/rework */
const BASE = "http://localhost:3001/api/v1";
const stamp = Date.now();
let failures = 0;
function ok(name, cond, extra = "") {
  if (cond) console.log(`PASS ${name} ${extra}`);
  else { failures++; console.log(`FAIL ${name} ${extra}`); }
}
async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json;

// 1. weak password rejected on register
const weak = await req("POST", "/auth/register", { email: `weak${stamp}@t.com`, password: "abc", name: "W", companyName: "W", role: "HIRING_ORG" });
ok("register weak password rejected", weak.status === 400, `status=${weak.status}`);

// 2. register org + provider with strong passwords
const org = await req("POST", "/auth/register", { email: `org${stamp}@t.com`, password: "Str0ng!Pass1", name: "Org Manager", companyName: "E2E Org", role: "HIRING_ORG" });
ok("register org", org.status === 200 || org.status === 201, JSON.stringify(org.json?.message ?? ""));
const prov = await req("POST", "/auth/register", { email: `prov${stamp}@t.com`, password: "Str0ng!Pass1", name: "Prov Manager", companyName: "E2E Pros", role: "PROVIDER" });
ok("register provider", prov.status === 200 || prov.status === 201, JSON.stringify(prov.json?.message ?? ""));
const orgTok = data(org)?.access_token, provTok = data(prov)?.access_token;
ok("tokens issued", !!orgTok && !!provTok);

// 3. login works (and existing seeded account if present)
const login = await req("POST", "/auth/login", { email: `org${stamp}@t.com`, password: "Str0ng!Pass1" });
ok("login new org", [200, 201].includes(login.status) && !!data(login)?.access_token, `status=${login.status}`);
const seeded = await req("POST", "/auth/login", { email: "hiring@facilityflow.app", password: "Hire@12345" });
ok("login seeded account (existing accounts unbroken)", [200, 201].includes(seeded.status), `status=${seeded.status}`);
const badLogin = await req("POST", "/auth/login", { email: `org${stamp}@t.com`, password: "wrong" });
ok("wrong password rejected with correct error message", (badLogin.status === 401 || badLogin.status === 400) && badLogin.json?.message === "Incorrect password or username", `msg="${badLogin.json?.message}"`);

// 4. org creates building + open service request
const bld = await req("POST", "/facilities/buildings", { name: "E2E Tower", address: "1 Test St", city: "Testville", buildingType: "OFFICE", numberOfFloors: 1 }, orgTok);
ok("create building", bld.status === 200 || bld.status === 201, JSON.stringify(bld.json?.message ?? ""));
const buildingId = data(bld)?.id;
const flr = await req("POST", `/facilities/buildings/${buildingId}/floors`, { name: "Floor 1" }, orgTok);
const floorId = data(flr)?.id;
const ara = await req("POST", `/facilities/floors/${floorId}/areas`, { name: "Lobby Area" }, orgTok);
const areaId = data(ara)?.id;

const srFull = await req("POST", "/service-requests", {
  title: "E2E Full Service Request",
  description: "Deep clean lobby with all fields",
  buildingId,
  floorId,
  areaId,
  priority: "HIGH",
  budget: 2500,
  preferredDate: "2026-10-15",
}, orgTok);
ok("create full service request (all fields populated)", srFull.status === 200 || srFull.status === 201, JSON.stringify(srFull.json?.message ?? ""));

const sr = await req("POST", "/service-requests", { title: "E2E Cleaning", description: "Deep clean lobby", buildingId }, orgTok);
ok("create service request", sr.status === 200 || sr.status === 201, JSON.stringify(sr.json?.message ?? ""));
const srId = data(sr)?.id;
await req("POST", `/service-requests/${srId}/submit`, null, orgTok);

// 5. provider sees open requests
const open = await req("GET", "/quotations/open-requests", null, provTok);
ok("provider sees open requests", open.status === 200 && Array.isArray(data(open)) && data(open).some((r) => r.id === srId), `status=${open.status} count=${Array.isArray(data(open)) ? data(open).length : "?"}`);

// 6. provider submits quotation
const q = await req("POST", "/quotations", { serviceRequestId: srId, price: 1200, numberOfWorkers: 2, duration: "2 days", terms: "Net 30", notes: "e2e quote" }, provTok);
ok("provider creates quotation", q.status === 200 || q.status === 201, JSON.stringify(q.json?.message ?? ""));
const qId = data(q)?.id;
const qs2 = await req("POST", `/quotations/${qId}/submit`, null, provTok);
ok("provider submits quotation", qs2.status === 200 || qs2.status === 201, JSON.stringify(qs2.json?.message ?? ""));

// 7. org accepts -> contract created
const acc = await req("POST", `/quotations/${qId}/accept`, null, orgTok);
ok("org accepts quotation", acc.status === 200 || acc.status === 201, JSON.stringify(acc.json?.message ?? ""));
const contracts = await req("GET", "/contracts?limit=50", null, orgTok);
const contract = (data(contracts)?.data ?? data(contracts) ?? []).find?.((c) => c.quotationId === qId) ?? (data(contracts)?.data ?? []).find((c) => c.quotationId === qId);
ok("contract created for accepted quotation", !!contract);

// 8. org creates job on contract
const now = new Date();
const iso = (d) => d.toISOString().slice(0, 19) + "Z";
const job = await req("POST", "/jobs", { contractId: contract.id, buildingId, title: "E2E Job 1", date: iso(now), startTime: iso(now), endTime: iso(new Date(now.getTime() + 3600e3)), serviceName: "Cleaning" }, orgTok);
ok("org creates job", job.status === 200 || job.status === 201, JSON.stringify(job.json?.message ?? ""));
const jobId = data(job)?.id;

// 9. provider creates worker, assigns
const w = await req("POST", "/workers", { name: "E2E Worker", skills: "cleaning" }, provTok);
ok("provider creates worker", w.status === 200 || w.status === 201, JSON.stringify(w.json?.message ?? ""));
const workerId = data(w)?.id;
const asg = await req("POST", `/jobs/${jobId}/assign-worker`, { workerId }, provTok);
ok("worker assigned", asg.status === 200 || asg.status === 201, JSON.stringify(asg.json?.message ?? ""));

// 10. start + proof + complete
const st = await req("POST", `/jobs/${jobId}/start`, null, provTok);
ok("provider starts job", st.status === 200 || st.status === 201, `status=${st.status}`);
const pf = await req("POST", `/jobs/${jobId}/proof`, { providerNote: "done", completionNote: "all clean", workerName: "E2E Worker", beforePhotoIds: [], afterPhotoIds: [] }, provTok);
ok("provider uploads proof", pf.status === 200 || pf.status === 201, JSON.stringify(pf.json?.message ?? ""));
const proofGet = await req("GET", `/jobs/${jobId}/proof`, null, orgTok);
ok("org sees proof", proofGet.status === 200 && !!data(proofGet));
const cp = await req("POST", `/jobs/${jobId}/complete`, null, provTok);
ok("provider completes job", cp.status === 200 || cp.status === 201, `status=${cp.status}`);

// 11. org approves -> invoice issued
const ap = await req("POST", `/jobs/${jobId}/approve`, { type: "approve", notes: "great" }, orgTok);
ok("org approves job", ap.status === 200 || ap.status === 201, JSON.stringify(ap.json?.message ?? ap.json));
const invs = await req("GET", "/invoices?limit=50", null, orgTok);
const inv = ((Array.isArray(data(invs)) ? data(invs) : data(invs)?.data) ?? []).find((i) => i.jobId === jobId);
ok("invoice issued for approved job", !!inv, inv ? `tax=${inv.tax}` : "");

// 12. rework flow on second job
const job2 = await req("POST", "/jobs", { contractId: contract.id, buildingId, title: "E2E Job 2", date: iso(now), startTime: iso(new Date(now.getTime() + 7200e3)), endTime: iso(new Date(now.getTime() + 10800e3)), serviceName: "Cleaning" }, orgTok);
const job2Id = data(job2)?.id;
await req("POST", `/jobs/${job2Id}/start`, null, provTok);
await req("POST", `/jobs/${job2Id}/proof`, { providerNote: "done 2", completionNote: "ok", workerName: "E2E Worker", beforePhotoIds: [], afterPhotoIds: [] }, provTok);
await req("POST", `/jobs/${job2Id}/complete`, null, provTok);
const rw = await req("POST", `/jobs/${job2Id}/rework`, { type: "rework", notes: "missed corners" }, orgTok);
ok("org requests rework", rw.status === 200 || rw.status === 201, JSON.stringify(rw.json?.message ?? ""));
const appr = await req("GET", `/jobs/${jobId}/approvals`, null, orgTok);
ok("approval history retrievable", appr.status === 200 && Array.isArray(data(appr)));

// 13. reviews endpoint returns object with items (no crash)
const provMe = await req("GET", "/auth/me", null, provTok);
const providerId = data(provMe)?.providerId;
const rev = await req("GET", `/reviews/provider/${providerId}`, null, orgTok);
ok("reviews byProvider returns items object", rev.status === 200 && Array.isArray(data(rev)?.items));

// 14. dashboards load
const dashOrg = await req("GET", "/analytics", null, orgTok);
ok("org dashboard loads", dashOrg.status === 200 && data(dashOrg)?.activeServiceRequests !== undefined, `status=${dashOrg.status}`);
const dashProv = await req("GET", "/analytics", null, provTok);
ok("provider dashboard loads", dashProv.status === 200, `status=${dashProv.status} body=${JSON.stringify(dashProv.json?.message ?? "")}`);

// 15. authorization checks
const forbidden = await req("GET", "/facilities/buildings", null, provTok);
ok("RBAC blocks provider from org facilities", forbidden.status === 403, `status=${forbidden.status}`);
const anon = await req("GET", "/analytics", null, null);
ok("anonymous rejected", anon.status === 401, `status=${anon.status}`);

// 16. provider resubmits after rework: restart -> proof -> complete -> org approves
const st2 = await req("POST", `/jobs/${job2Id}/start`, null, provTok);
ok("provider re-starts rework job", st2.status === 200 || st2.status === 201, `status=${st2.status}`);
const pf2 = await req("POST", `/jobs/${job2Id}/proof`, { providerNote: "corners fixed", completionNote: "redone", workerName: "E2E Worker", beforePhotoIds: [], afterPhotoIds: [] }, provTok);
ok("provider resubmits proof after rework", pf2.status === 200 || pf2.status === 201, JSON.stringify(pf2.json?.message ?? ""));
await req("POST", `/jobs/${job2Id}/complete`, null, provTok);
const ap2 = await req("POST", `/jobs/${job2Id}/approve`, { type: "approve", notes: "fixed now" }, orgTok);
ok("org approves reworked job", ap2.status === 200 || ap2.status === 201, JSON.stringify(ap2.json?.message ?? ""));

// 17. invoice payment: record full payment -> status PAID
const inv2 = await req("GET", "/invoices?limit=50", null, orgTok);
const inv2rec = ((Array.isArray(data(inv2)) ? data(inv2) : data(inv2)?.data) ?? []).find((i) => i.jobId === job2Id);
ok("second invoice issued", !!inv2rec);
if (inv2rec) {
  const invDetail = await req("GET", `/invoices/${inv2rec.id}`, null, orgTok);
  ok("invoice detail has provider/organization/dueDate", !!data(invDetail)?.providerId && !!data(invDetail)?.organizationId && !!data(invDetail)?.dueDate);
  const pay = await req("POST", `/invoices/${inv2rec.id}/payments`, { amount: Number(inv2rec.total), paymentReference: `TRX-${stamp}`, paymentMethod: "BANK_TRANSFER" }, orgTok);
  ok("payment recorded", pay.status === 200 || pay.status === 201, JSON.stringify(pay.json?.message ?? ""));
  const invAfter = await req("GET", `/invoices/${inv2rec.id}`, null, orgTok);
  ok("invoice fully paid -> PAID status", data(invAfter)?.status === "PAID", `status=${data(invAfter)?.status}`);
  ok("payment list visible", Array.isArray(data(invAfter)?.payments) && data(invAfter).payments.length === 1);
}

// 18. reviews: org creates review for approved job 1, duplicate blocked, list shown
const rev2 = await req("POST", "/reviews", { jobId, providerId, quality: 5, timeliness: 5, professionalism: 4, value: 5, overallRating: 5, comments: "Excellent e2e work" }, orgTok);
ok("org submits review after approval", rev2.status === 200 || rev2.status === 201, JSON.stringify(rev2.json?.message ?? ""));
const revDup = await req("POST", "/reviews", { jobId, providerId, quality: 5, timeliness: 5, professionalism: 5, value: 5, overallRating: 5, comments: "dup" }, orgTok);
ok("duplicate review blocked", revDup.status === 400 || revDup.status === 409, `status=${revDup.status}`);
const revList = await req("GET", "/reviews", null, orgTok);
ok("org review list (Org|Provider|Rating|Comment|Date)", revList.status === 200 && Array.isArray(data(revList)) && data(revList).some((r) => r.provider?.name && r.organization?.name));
const provRev = await req("GET", "/reviews", null, provTok);
ok("provider blocked from org review list", provRev.status === 403, `status=${provRev.status}`);

// 19. notifications: org has notifications; mark read works
const notif = await req("GET", "/notifications", null, orgTok);
ok("org notifications exist (quotation/job/approval/invoice)", notif.status === 200 && (data(notif)?.notifications?.length ?? 0) > 0, `unread=${data(notif)?.unreadCount}`);
const notifProv = await req("GET", "/notifications", null, provTok);
ok("provider notifications exist (rework/approval/payment)", notifProv.status === 200 && (data(notifProv)?.notifications?.length ?? 0) > 0, `count=${data(notifProv)?.notifications?.length}`);
const firstUnread = (data(notif)?.notifications ?? []).find((n) => !n.isRead);
if (firstUnread) {
  const mr = await req("POST", `/notifications/${firstUnread.id}/read`, null, orgTok);
  ok("mark notification read", mr.status === 200 || mr.status === 201);
}
const mar = await req("POST", "/notifications/read-all", null, orgTok);
ok("mark all read", mar.status === 200 || mar.status === 201);

// 19.5 settings: profile fetch, update, password change, notification prefs
const settMe = await req("GET", "/settings/me", null, orgTok);
ok("settings fetch profile", settMe.status === 200 && !!data(settMe)?.email);
const settUpd = await req("PATCH", "/settings/profile", { name: "Updated Org Name", phone: "555-1234" }, orgTok);
ok("settings update profile", settUpd.status === 200 && data(settUpd)?.name === "Updated Org Name");
const settPass = await req("POST", "/settings/change-password", { currentPassword: "Str0ng!Pass1", newPassword: "Str0ng!Pass2" }, orgTok);
ok("settings change password", settPass.status === 200 || settPass.status === 201);
// revert password back so subsequent logins work
await req("POST", "/settings/change-password", { currentPassword: "Str0ng!Pass2", newPassword: "Str0ng!Pass1" }, orgTok);
const settNotif = await req("GET", "/settings/notifications", null, orgTok);
ok("settings fetch notification preferences", settNotif.status === 200 && data(settNotif)?.inApp === true);
const settNotifUpd = await req("PATCH", "/settings/notifications", { inApp: true, email: false }, orgTok);
ok("settings update notification preferences", settNotifUpd.status === 200 && data(settNotifUpd)?.email === false);

// 19.6 Phase 2 features: matching suggestions, PDF export, job checklists
const matchesRes = await req("GET", `/service-requests/${srId}/matches`, null, orgTok);
ok("matching suggestions endpoint", matchesRes.status === 200 && Array.isArray(data(matchesRes)?.providers));
if (inv) {
  const pdfRes = await fetch(BASE + `/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${orgTok}` } });
  ok("PDF invoice export endpoint", pdfRes.status === 200 && pdfRes.headers.get("content-type") === "application/pdf");
}
const checkResults = await req("GET", `/checklists/jobs/${jobId}/results`, null, orgTok);
ok("job checklists results endpoint", checkResults.status === 200 && Array.isArray(data(checkResults)));

// 19.7 Phase 3 features: Worker invitation, login, assigned jobs list, and proof of work submission
const inviteEmail = `worker1.e2e.${Date.now()}@facilityflow.app`;
const inviteRes = await req("POST", `/workers/${workerId}/invite`, { email: inviteEmail }, provTok);
ok("worker invitation created user account", inviteRes.status === 200 || inviteRes.status === 201, `status=${inviteRes.status}`);

const workerLogin = await req("POST", "/auth/login", { email: inviteEmail, password: "Worker123!" });
const workerTok = data(workerLogin)?.access_token;
ok("worker login succeeds", !!workerTok, `status=${workerLogin.status}`);

if (workerTok) {
  const workerJobs = await req("GET", "/jobs", null, workerTok);
  ok("worker list assigned jobs only", workerJobs.status === 200 && Array.isArray(data(workerJobs)), `count=${data(workerJobs)?.length}`);
  const workerStatusUpd = await req("PATCH", `/workers/${workerId}/status`, { status: "ACTIVE" }, provTok);
  ok("provider toggle worker status", workerStatusUpd.status === 200 && data(workerStatusUpd)?.status === "ACTIVE");
}

// 20. admin: dashboard, activity, lists; admin-only enforcement
const admLogin = await req("POST", "/auth/login", { email: "admin@facilityflow.app", password: "Admin@12345" });
const admTok = data(admLogin)?.access_token;
ok("admin login (seeded)", !!admTok, `status=${admLogin.status}`);
if (admTok) {
  const ad = await req("GET", "/admin/dashboard", null, admTok);
  ok("admin dashboard (real counts)", ad.status === 200 && data(ad)?.totalOrganizations !== undefined, JSON.stringify(data(ad)?.message ?? ""));
  const act = await req("GET", "/admin/activity", null, admTok);
  ok("admin recent activity", act.status === 200 && Array.isArray(data(act)));
  const adOrgs = await req("GET", "/admin/organizations", null, admTok);
  const adProv = await req("GET", "/admin/providers", null, admTok);
  const adSrs = await req("GET", "/admin/service-requests", null, admTok);
  const adBld = await req("GET", "/admin/buildings", null, admTok);
  ok("admin lists orgs/providers/requests/buildings", [adOrgs, adProv, adSrs, adBld].every((r) => r.status === 200));
  const adBlocked = await req("GET", "/admin/dashboard", null, orgTok);
  ok("admin endpoints blocked for hiring org", adBlocked.status === 403, `status=${adBlocked.status}`);
}

console.log(failures === 0 ? "\nALL E2E TESTS PASSED" : `\n${failures} E2E TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

