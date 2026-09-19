# FacilityFlow — Core Workflow + Fixes

Continue from the CURRENT implementation. Implement ONLY the following. Reuse the existing architecture, DB, APIs, auth/RBAC and UI. No mocks or unrelated changes.

### Workflow

**Quotation**

* Provider views eligible/open requests and submits quotations.
* Organization views and compares quotations for its own requests.
* Organization accepts ONE quotation.
* Other quotations automatically become Rejected/Closed.
* Update request status.
* Enforce ownership, RBAC and atomic acceptance.

**Contracts**

* Create contract from accepted quotation.
* Store provider, organization, service, location, price, dates, frequency and terms.
* Status: Draft, Active, Completed, Cancelled, Expired.

**Jobs**

* Create jobs from active contracts.
* Fields: contract, service, location, date/time, instructions, status.
* Flow: Scheduled → In Progress → Completed → Approved.
* Allow Rework.

**Workers**

* Provider can add workers and assign them to jobs.
* Worker: name, phone, skills.
* Enforce provider ownership.

**Job Completion**

* Assigned worker/provider can start job, add notes, upload before/after photos and complete it.
* Organization can Approve or Request Rework with a reason.
* Reworked jobs can be resubmitted.

### FIX EXISTING BUG

Provider Account → **Reviews** currently causes **Unhandled Runtime Error**.

Find and fix the root cause. Reviews must:

* Load correctly
* Work with zero reviews
* Use real DB data
* Have proper loading/error/empty states
* Not break other provider pages

### UI

Keep the existing **Earth + Industrial** theme, but remove the generic "vibe-coded" white rounded-card look.

Use:

* Deep Pine `#173F38`
* Terracotta `#B9553D`
* Burnt Clay `#96432F`
* Warm Sand `#F3EFE7`
* Ivory `#FFFDF8`
* Muted Brass `#C9A66B`
* Charcoal `#172522`

Use more **structured panels, borders, dividers, typography and spacing** instead of everything being a floating white rounded card.

Use subtle **4–8px radius**, minimal shadows, stronger contrast and operational/B2B styling. No blue/purple, excessive gradients or glassmorphism.

Do not redesign unrelated pages.

### Verify

Test the full flow:

Quotation → Accept → Contract → Job → Worker → Start → Photos/Notes → Complete → Approve/Rework.

Also verify Reviews no longer crashes, refresh persists data, and unauthorized actions are blocked.

**STOP after these tasks. Do not implement Invoices, Payments, Notifications, Analytics or other features yet.**

Also in the end provide local host url to view the progress.

