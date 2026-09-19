// End-to-end flow test against the running backend (http://localhost:3001)
const U = (j) => (j && j.data !== undefined ? j.data : j);
const P = (j) => { const d = U(j); return Array.isArray(d) ? d : (d?.data ?? []); };
const BASE = "http://localhost:3001/api/v1";
let failures = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} - ${name}${cond ? "" : " | " + extra}`);
  if (!cond) failures++;
}
async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  // 1. Weak password must be rejected on register
  let r = await req("POST", "/auth/register", { body: { email: `weak${Date.now()}@t.dev`, password: "weakpass", name: "T", companyName: "T Co", role: "HIRING_ORG" } });
  check("register rejects weak password", r.status === 400, JSON.stringify(U(r.json)).slice(0, 120));
  r = await req("POST", "/auth/register", { body: { email: `strong${Date.now()}@t.dev`, password: "Str0ng@Pass", name: "Strong User", companyName: "Strong Co", role: "HIRING_ORG" } });
  check("register accepts strong password", r.status === 201 || r.status === 200, r.status + JSON.stringify(U(r.json)).slice(0, 120));

  // 2. Login as seeded org + provider
  const org = await req("POST", "/auth/login", { body: { email: "hiring@facilityflow.app", password: "Hire@12345" } });
  check("org login", (org.status === 200 || org.status === 201) && U(org.json).access_token, JSON.stringify(org.json).slice(0, 100));
  const orgToken = U(org.json).access_token;
  const prov = await req("POST", "/auth/login", { body: { email: "primehvac@facilityflow.app", password: "Provide@12345" } });
  check("provider login", (prov.status === 200 || prov.status === 201) && U(prov.json).access_token, JSON.stringify(prov.json).slice(0, 100));
  const provToken = U(prov.json).access_token;

  // 3. Seeded buildings load
  r = await req("GET", "/facilities/buildings", { token: orgToken });
  const seededBuildings = P(r.json);
  check("seeded buildings visible (>=2)", Array.isArray(seededBuildings) && seededBuildings.length >= 2, JSON.stringify(U(r.json)).slice(0, 150));
  const hq = seededBuildings.find((b) => b.name === "HQ Tower");

  // 4. Create building -> appears in list
  r = await req("POST", "/facilities/buildings", { token: orgToken, body: { name: "E2E Test Tower", address: "1 Test St", city: "Austin" } });
  check("building created", r.status === 201 && U(r.json).id, JSON.stringify(U(r.json)).slice(0, 120));
  const bId = U(r.json).id;
  let lst = await req("GET", "/facilities/buildings", { token: orgToken });
  check("created building appears in list", JSON.stringify(lst.json).includes("E2E Test Tower"));

  // 5. Floors + areas on new building
  r = await req("POST", `/facilities/buildings/${bId}/floors`, { token: orgToken, body: { name: "Floor A" } });
  const floorId = U(r.json).id;
  check("floor created", !!floorId);
  r = await req("POST", `/facilities/floors/${floorId}/areas`, { token: orgToken, body: { name: "Lounge", category: "Office" } });
  const areaId = U(r.json).id;
  check("area created", !!areaId);

  // 6. Delete building (soft) -> disappears from list
  r = await req("DELETE", `/facilities/buildings/${bId}`, { token: orgToken });
  check("building deleted", r.status === 200);
  lst = await req("GET", "/facilities/buildings", { token: orgToken });
  check("deleted building gone from list", !JSON.stringify(lst.json).includes("E2E Test Tower"));

  // 7. Create service request with building, then submit -> OPEN, appears in list
  r = await req("POST", "/service-requests", { token: orgToken, body: { title: "E2E AC repair", description: "Fix AC", buildingId: hq.id, priority: "HIGH", budget: 900 } });
  check("service request created", r.status === 201 && U(r.json).id, JSON.stringify(U(r.json)).slice(0, 150));
  const srId = U(r.json).id;
  check("request saved buildingId", U(r.json).buildingId === hq.id);
  r = await req("POST", `/service-requests/${srId}/submit`, { token: orgToken });
  check("request submitted -> OPEN", U(r.json).status === "OPEN");
  lst = await req("GET", "/service-requests", { token: orgToken });
  check("request appears in list", JSON.stringify(lst.json).includes("E2E AC repair"));

  // 8. Provider submits quotation
  r = await req("POST", "/quotations", { token: provToken, body: { serviceRequestId: srId, price: 850, numberOfWorkers: 2, duration: "1 day" } });
  check("quotation created", r.status === 201 && U(r.json).id, JSON.stringify(U(r.json)).slice(0, 150));
  const quoteId = U(r.json).id;
  r = await req("POST", `/quotations/${quoteId}/submit`, { token: provToken });
  check("quotation submitted", U(r.json).status === "SUBMITTED", JSON.stringify(U(r.json)).slice(0, 100));

  // 9. Org sees quotation for request with provider info
  r = await req("GET", `/quotations/request/${srId}`, { token: orgToken });
  check("org sees quotations w/ provider name", Array.isArray(U(r.json)) && U(r.json).length === 1 && U(r.json)[0].provider?.name === "Prime HVAC", JSON.stringify(U(r.json)).slice(0, 150));

  // 10. Accept -> contract auto-created
  r = await req("POST", `/quotations/${quoteId}/accept`, { token: orgToken });
  check("quotation accepted", r.status === 201 || r.status === 200, JSON.stringify(U(r.json)).slice(0, 120));
  r = await req("GET", "/contracts", { token: orgToken });
  const contracts = P(r.json);
  const c = contracts.find((x) => x.quotationId === quoteId);
  check("contract auto-created from accept", !!c && c.status === "ACTIVE", JSON.stringify(contracts).slice(0, 250));
  check("contract has org/provider/building/price/dates", !!(c?.organization?.name && c?.provider?.name && c?.building?.name && c?.price && c?.startDate));

  // 11. Quotations list scoped + enriched
  r = await req("GET", "/quotations", { token: orgToken });
  const allQ = P(r.json);
  check("org quotation list has provider+request info", allQ.length >= 1 && allQ.every((q) => q.provider && q.serviceRequest), JSON.stringify(allQ).slice(0, 150));

  // 12. Provider blocked from org facilities endpoints
  r = await req("GET", "/facilities/buildings", { token: provToken });
  check("provider blocked from facilities", r.status === 403);

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
