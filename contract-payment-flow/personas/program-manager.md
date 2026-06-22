# Persona: Program Manager

- **Role id:** `program_manager`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** FAR 42.1503 (CPAR preparation and submission)

## Summary
The Program Manager is the government-side technical owner of a contract, sitting within a single agency (e.g., GSA-FAS). The PM oversees requirements definition, monitors deliverable compliance via CDRLs, and drafts Contractor Performance Assessment Reports (CPARs). The PM does not hold warrant authority and cannot sign or obligate.

## What they can do
- Access the payment-ops Dashboard (post-award KPI tiles including CDRLs overdue) — `sidebar-nav.component.ts:31`, `app.routes.ts:36`
- Browse the Modifications Index to monitor contract change pipeline — `sidebar-nav.component.ts:38`, `app.routes.ts:36`
- Edit amendment documents on a modification (`/contractModifications/:id/amendments`) — `app.routes.ts:65`
- View and navigate Contract Admin for a specific contract — `sidebar-nav.component.ts:52`, `app.routes.ts:118`
- Access CPAR Reviews to read and draft CPAR narratives — `sidebar-nav.component.ts:53`, `app.routes.ts:120` (unguarded route), `roles.ts:58`
- View Award Record — `sidebar-nav.component.ts:54`
- Run and browse All Reports — `sidebar-nav.component.ts:60`, `app.routes.ts:41`
- Look up vendors in the Contractor Directory — `sidebar-nav.component.ts:66`, `app.routes.ts:86`

## What they cannot do
- Create a new SF-30 modification (`/contractModifications/new` is restricted to `contracting_officer`, `cor`, `contract_specialist`) — `app.routes.ts:56`
- Certify invoices for payment or access the Invoice Queue (restricted to CO, COR, DCAA) — `sidebar-nav.component.ts:45`
- Access the DCAA Audit Trail — `sidebar-nav.component.ts:46`
- Submit or approve a vendor rebuttal on a CPAR (rebuttal panel is gated to `vendor` role only) — `cpar-review.component.ts:57`
- Access Admin routes (User & Role Admin, System Config, Audit Log Search, Findings Tracker) — `sidebar-nav.component.ts:71-76`, `app.routes.ts:130-141`
- Upload retrieval corpus documents (`/corpus/upload` is CO/sys_admin only) — `app.routes.ts:126`
- Perform Q&A triage or proposal intake on a modification — `app.routes.ts:69`, `app.routes.ts:73`

## Constraints / authority limits
- Scoped to a single agency (`agencyId: 'GSA-FAS'`); no cross-tenant visibility — `roles.ts:57`
- Authority limited to requirements ownership and CPAR drafting; cannot obligate funds or sign contract instruments — `roles.ts:58`
- Role resolved from JWT in production API gateway; current implementation is a mock role-switcher for demo — `roles.ts:9-10`
- CPAR route (`/contracts/:id/cpars`) carries no `canMatch` guard in the current routes table, meaning route-level enforcement relies solely on the nav filter and JWT validation at the API layer — `app.routes.ts:120`
- Amendment editing is shared with CO and CS but not with COR — `app.routes.ts:65`

## Impact on the system
The Program Manager is the principal source of CPAR data (FAR 42.1503) and CDRL oversight signals. If PM access to CPARs, Contract Admin, or the dashboard CDRLs-overdue KPI is broken or dropped during migration, past-performance records become ungoverned and the agency loses its primary mechanism for enforcing deliverable accountability. The unguarded `/contracts/:id/cpars` route is a latent risk: if route guards are added without including `program_manager`, PM CPAR drafting breaks silently.

## Pain points
- The CPAR route has no `canMatch` guard, so PM access depends entirely on nav-link filtering and downstream API enforcement — a migration that adds a guard without including `program_manager` would silently lock PMs out. (`app.routes.ts:120` — inference from absence)
- The dashboard CDRL overdue KPI is read-only; there is no direct link from the tile to the relevant CDRL list, requiring the PM to navigate manually. (`officer-dashboard.component.ts:47` — UX gap, inference)
- CPAR drafting has no save-draft or workflow state visible to the PM in the UI; the component renders fixture data and the narrative textarea is vendor-only, meaning the PM has read-only access to CPAR content in the current implementation. (`cpar-review.component.ts:57-68` — observed gap)
- Role is a mock switcher in the demo environment; PM identity is not validated until the API gateway JWT layer, creating a risk that demo assumptions about PM permissions diverge from production enforcement. (`roles.ts:9-10` — inference)

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:16` — `program_manager` declared as a valid `Role` union member
- `frontend/src/app/models/roles.ts:55-58` — `RoleProfile` entry: `agencyId: 'GSA-FAS'`, `authorityNote: 'Requirements + CPAR draft (FAR 42.1503)'`
- `frontend/src/app/shell/sidebar-nav.component.ts:31` — PM granted Dashboard nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:38` — PM granted Modifications Index nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:52` — PM granted Contract Admin nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:53` — PM granted CPAR Reviews nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:54` — PM granted Award Record nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:60` — PM granted All Reports nav link
- `frontend/src/app/shell/sidebar-nav.component.ts:66` — PM granted Contractor Directory nav link
- `frontend/src/app/app.routes.ts:36` — `roleGuard` includes `program_manager` for `/dashboard`
- `frontend/src/app/app.routes.ts:41` — `roleGuard` includes `program_manager` for `/reports`
- `frontend/src/app/app.routes.ts:65` — `roleGuard` includes `program_manager` for amendment editor
- `frontend/src/app/app.routes.ts:86` — `roleGuard` includes `program_manager` for `/vendors`
- `frontend/src/app/app.routes.ts:118` — `roleGuard` includes `program_manager` for `/contracts/:id/admin`
- `frontend/src/app/app.routes.ts:120` — `/contracts/:id/cpars` has NO `canMatch` guard
- `frontend/src/app/app.routes.ts:56` — `contractModifications/new` excludes `program_manager`
- `frontend/src/app/components/officer-dashboard/officer-dashboard.component.ts:47` — `cdrlsOverdue()` KPI tile driven by `FIXTURE_DELIVERABLES`; PM sees this as dashboard landing
- `frontend/src/app/components/cpar-review/cpar-review.component.ts:57` — vendor rebuttal panel gated to `role === 'vendor'`; PM has read-only CPAR access in current UI

## Reviewer lens
> The Program Manager (`program_manager`, `roles.ts:55-58`) holds single-agency authority scoped to GSA-FAS. The role's regulatory basis is FAR 42.1503 (CPAR preparation). The PM must retain read access to Dashboard (`app.routes.ts:36`), Modifications Index (`app.routes.ts:36`), Contract Admin (`app.routes.ts:118`), CPAR Reviews (`sidebar-nav.component.ts:53`), Award Record (`sidebar-nav.component.ts:54`), Reports (`app.routes.ts:41`), and Contractor Directory (`app.routes.ts:86`) after migration. The PM must NOT gain access to Invoice Queue, DCAA Audit Trail, corpus upload, or admin routes. The CPAR route currently has no route-level guard (`app.routes.ts:120`); any migration that adds a `canMatch` guard must explicitly include `program_manager` or PM CPAR access is silently broken. The CDRLs-overdue dashboard KPI (`officer-dashboard.component.ts:47`) is the PM's primary deliverable oversight signal; if that component or fixture is replaced, equivalent PM-visible data must survive. Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 42.1503 | CPAR preparation, submission, and 60-day vendor rebuttal window |
| FAR 42.1503(d) | Vendor rebuttal right — PM must not be granted vendor rebuttal authority |
