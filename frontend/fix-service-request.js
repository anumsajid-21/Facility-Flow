const fs = require('fs');
const p = 'C:\\Users\\Admin\\Desktop\\ANUM\\Facility Service App\\frontend\\src\\app\\(dashboard)\\service-requests\\page.tsx';
let c = fs.readFileSync(p, 'utf8');

const oldModal = `      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Create service request">
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="HVAC repair" /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what is needed" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Building"><Select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })}><option value="">Select</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} placeholder="id" /></Field>
            <Field label="Budget"><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="1500" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></div>
        </div>
      </Modal>`;

const newModal = `      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Create service request">
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="HVAC repair" required /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what is needed" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Building"><Select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required><option value="">Select</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} placeholder="id" /></Field>
            <Field label="Budget"><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="1500" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button><Button type="submit" loading={busy}>Create</Button></div>
        </form>
      </Modal>`;

if (c.includes(oldModal)) {
  c = c.replace(oldModal, newModal);
  fs.writeFileSync(p, c, 'utf8');
  console.log('Service request modal fixed');
} else {
  console.log('Modal text not found, trying partial match...');
  // Try to find and replace just the wrapper
  const startIdx = c.indexOf('Modal open={openCreate}');
  const endIdx = c.indexOf('</Modal>', startIdx) + '</Modal>'.length;
  if (startIdx > -1 && endIdx > startIdx) {
    c = c.substring(0, startIdx) + newModal + c.substring(endIdx);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Service request modal replaced by position');
  } else {
    console.log('ERROR: Could not find modal bounds');
  }
}
