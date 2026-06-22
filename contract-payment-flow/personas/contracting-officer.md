# Persona: Contracting Officer (CO)

- **Role id:** `contracting_officer`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** FAR 1.602-1 (warrant authority), FAR 42.302 (CO contract-administration duties), FAR 43.103 (modification types and signer)

## Summary
The Contracting Officer is the sole warranted federal official authorized to obligate funds, sign SF-30 contract modifications, certify invoices for payment, and terminate contracts on behalf of the acquiring agency. In this system the CO holds the highest non-cross-tenant authority in the post-award workflow and is the mandatory final signer before any modification or RAG corpus change takes legal effect.

## What they can do
- Sign (approve) SF-30 contract modifications — both unilateral (CO signature only, FAR 43.103(b)) and bilateral (contractor + CO, FAR 43.103(a)) — as the sole authorized signer per the `authorityNote` in ROLE_PROFILES and the "PUBLISHED (CO only)" state option in the modification editor.
- Certify invoices for payment and act on the Invoice Queue (`/invoiceReviews`) — route gated as `contracting_officer` in the sidebar nav.
- Access the DCAA Audit Trail (`/admin/audit`) alongside DCAA and OIG — sidebar nav grants this to `contracting_officer`.
- Create new SF-30 modifications via the wizard (`/contractModifications/new`) — `roleGuard('contracting_officer', 'cor', 'contract_specialist')` in `app.routes.ts`.
- Access and edit modifications under Q&A triage (`/contractModifications/:id/qa`) and proposal intake (`/contractModifications/:id/proposals`) — guarded for `contracting_officer` and `contract_specialist` only.
- Access contract amendments (`/contractModifications/:id/amendments`) — guarded for `contracting_officer`, `contract_specialist`, `program_manager`.
- Access the Dashboard KPI view showing "Mods pending CO signature", "Invoices awaiting certification", and other post-award metrics.
- Upload and approve-for-ingestion FAR/DFARS/WAWF source documents into the retrieval corpus (`/corpus/upload`) — CO is the sole non-sys_admin role permitted, implementing the HITL ingestion gate from ADR-0005.
- View all reports (`/reports`), vendor directory (`/vendors`), contract admin (`/contracts/:id/admin`), CPAR reviews, award record, and evaluator workspace.
- Access source-selection consensus/SSDD surface (`/invoiceReview/:solId/consensus`) retained from inherited pre-award routes.

## What they cannot do
- Access system-level user provisioning (`/admin/users`) or system config (`/admin/config`) — both guarded to `sys_admin` only.
- Access the OIG Findings Tracker (`/admin/findings`) — guarded to `sys_admin` and `oig_reviewer` only.
- Access the audit log search at `/admin/audit` through the Admin nav section — that nav entry is restricted to `sys_admin` and `oig_reviewer`; the CO reaches audit trail only via the "Invoices & Payment" nav group which routes the same component.
- Submit SF-30 modifications on behalf of a different agency (`agencyId` is fixed to the CO's own agency, scoped in ROLE_PROFILES; cross-tenant authority belongs to `sys_admin`).
- Obligate funds without a warrant — the role model notes production RBAC resolves from a validated JWT in the API gateway; the frontend role is a demo mock.

## Constraints / authority limits
- Agency-scoped: `agencyId` is set to a non-null value (e.g., `'GSA-FAS'`) in ROLE_PROFILES; `sys_admin` carries `agencyId: null` (cross-tenant). The CO's modifications and corpus uploads are tenant-scoped by `agencyId` throughout the wizard and clause-library RAG (Item 10 surface in the modification editor).
- The ROLE_PROFILES `authorityNote` is a display-only tooltip; actual RBAC enforcement happens at the API gateway via JWT (Debt Item 1: JWT signature-skip on `/api/public/*` is an open risk).
- The "PUBLISHED" state transition in the modification editor is labeled "CO only" in the UI (`contract-modification-editor.component.ts` line 79) but the route guard for `/contractModifications/:id/edit` has no role restriction — state-level enforcement must be server-side.
- Corpus ingestion at `/corpus/upload` is the CO's HITL gate: only `contracting_officer` or `sys_admin` can approve document batches into the vector store.
- Modification requests submitted via the wizard transition to `MODIFICATION_REQUEST` status, explicitly noting "CO sign-off required before the SF-30 is issued."

## Impact on the system
The CO is the only role that can legally bind the government to contract changes, certify payment obligations, and gate RAG corpus content. If CO authority checks are removed or misconfigured during a migration — particularly the route guard on `/contractModifications/new`, the corpus-upload gate at `/corpus/upload`, and the server-side state-transition check for `PUBLISHED` — any authenticated user could submit modification requests or inject unauthorized documents into the retrieval corpus. Loss of the agency-scoping constraint (`agencyId`) would also collapse cross-tenant separation, allowing a CO from one agency to act on another agency's contracts.

## Pain points
- The "PUBLISHED (CO only)" state transition in the modification editor is enforced only by a UI label, not a route guard — the backend must enforce it, but Debt Item 2 (audit-log race condition on state transitions) means a concurrent transition could bypass the CO gate without detection. (Code evidence: `contract-modification-editor.component.ts:79,83`.)
- The route `/contractModifications/:id/edit` has no `canMatch` role guard, so any authenticated role can reach the editor UI; the CO-only publish step relies entirely on the server. This is a gap a migration could widen.
- The corpus upload HITL flow is CO-gated but the staged-batch approval is client-driven — there is no server-side re-verification of the CO's role on the ingest call beyond whatever the API gateway enforces (currently weakened by Debt Item 1).
- The invoice-review route (`/invoiceReviews`) has no `canMatch` guard in `app.routes.ts` (line 101), so while the sidebar limits visibility the route itself is open to any authenticated user — a CO could inadvertently certify invoices they are not the warranted officer for. (Inference: no guard at `app.routes.ts:101`.)
- Dashboard KPI tiles pull from fixture data (`FIXTURE_CONTRACT_MODIFICATIONS`, `FIXTURE_INVOICES`) rather than live backend counts, so the "Mods pending CO signature" figure does not reflect actual pending items in production.

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:13` — `contracting_officer` union member with inline comment "signs SF-30 mods, certifies payment"
- `frontend/src/app/models/roles.ts:37-41` — ROLE_PROFILES entry: `agencyId: 'GSA-FAS'`, `authorityNote` citing FAR 1.602-1 / 42.302
- `frontend/src/app/shell/sidebar-nav.component.ts:31` — Dashboard nav restricted to `contracting_officer` (and COR/CS/PM)
- `frontend/src/app/shell/sidebar-nav.component.ts:38-39` — Modifications Index and New SF-30 nav entries include `contracting_officer`
- `frontend/src/app/shell/sidebar-nav.component.ts:45-46` — Invoice Queue and DCAA Audit Trail nav entries include `contracting_officer`
- `frontend/src/app/shell/sidebar-nav.component.ts:52-54` — Contract Admin, CPAR Reviews, Award Record nav entries include `contracting_officer`
- `frontend/src/app/shell/sidebar-nav.component.ts:60` — All Reports nav includes `contracting_officer`
- `frontend/src/app/components/officer-dashboard/officer-dashboard.component.ts:9-12` — Dashboard comment: "Post-award KPI tiles: invoices awaiting certification, modifications pending CO signature"
- `frontend/src/app/components/officer-dashboard/officer-dashboard.component.ts:43-45` — "Mods pending CO signature" KPI tile
- `frontend/src/app/app.routes.ts:36` — `/dashboard` route guard includes `contracting_officer`
- `frontend/src/app/app.routes.ts:56-57` — `/contractModifications/new` guard: `contracting_officer`, `cor`, `contract_specialist`
- `frontend/src/app/app.routes.ts:64-65` — `/contractModifications/:id/amendments` guard includes `contracting_officer`
- `frontend/src/app/app.routes.ts:68-71` — `/contractModifications/:id/qa` and `/proposals` guards: `contracting_officer`, `contract_specialist`
- `frontend/src/app/app.routes.ts:101` — `/invoiceReviews` has no `canMatch` guard (open route)
- `frontend/src/app/app.routes.ts:104-106` — `/invoiceReview/workspace` guard includes `contracting_officer`
- `frontend/src/app/app.routes.ts:109-111` — `/invoiceReview/:solId/consensus` guard includes `contracting_officer`
- `frontend/src/app/app.routes.ts:117-119` — `/contracts/:id/admin` guard includes `contracting_officer`
- `frontend/src/app/app.routes.ts:122-127` — `/corpus/upload` guard: `contracting_officer`, `sys_admin` only
- `frontend/src/app/components/contract-modification-editor/contract-modification-editor.component.ts:79` — "PUBLISHED (CO only)" state transition label
- `frontend/src/app/components/contract-modification-wizard/contract-modification-wizard.component.ts:148-149` — Review step states "CO sign-off required before the SF-30 is issued"
- `frontend/src/app/components/corpus-upload/corpus-upload.component.ts:19-25` — CO-facing HITL ingestion gate description; "staged for CO approval before ingestion"
- `data/seed/far-part-42-43-32/far-42-overview.md:14-15` — FAR Part 42 stub: CO retains authority to obligate funds, sign modifications, make final contract decisions
- `data/seed/far-part-42-43-32/far-43-103-types.md:15-18` — FAR 43.103(b): unilateral modification signed only by the contracting officer
- `frontend/src/app/services/role.guard.ts:15-25` — `roleGuard` factory that enforces all CO route restrictions

## Reviewer lens
> You are reviewing a migration plan from the perspective of the Contracting Officer (CO), role key `contracting_officer` (roles.ts:13), the sole warranted official authorized to sign SF-30 modifications, certify payment, and approve RAG corpus ingestion.
>
> The CO's authority constraints the migration must preserve:
> 1. Route guard on `/contractModifications/new` (app.routes.ts:56-57) must keep `contracting_officer` as an allowed role — removing it lets any authenticated user initiate SF-30 modifications without warrant authority.
> 2. The corpus upload HITL gate (app.routes.ts:122-127, corpus-upload.component.ts:19-25) must remain CO-or-sys_admin-only — weakening it allows unreviewed documents into the RAG vector store that CO-authored modifications then cite.
> 3. State-transition enforcement for `PUBLISHED` (contract-modification-editor.component.ts:79) is currently UI-only; the migration must add or preserve a server-side check — losing it lets any role publish modifications without CO signature.
> 4. `agencyId` scoping on the CO profile (roles.ts:39) must be preserved as a non-null single-agency value; if the migration collapses it to null (the `sys_admin` pattern) the CO gains cross-tenant write access.
> 5. The open `/invoiceReviews` route (app.routes.ts:101) is a pre-existing gap; the migration must not widen it and should ideally close it.
>
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 1.602-1 | Contracting Officer warrant authority — only CO may execute binding contracts |
| FAR 42.302 | CO contract-administration duties, including payment certification and designation of COR |
| FAR 43.103(a) | Bilateral modifications — signed by contractor and CO |
| FAR 43.103(b) | Unilateral modifications — signed only by the contracting officer |
| FAR 32.905 | Proper-invoice checklist and payment certification timeline |
