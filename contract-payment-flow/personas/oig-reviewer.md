# Persona: OIG Reviewer (Office of Inspector General)

- **Role id:** `oig_reviewer`
- **Class:** external · cross-tenant · human · trusted
- **Regulatory basis:** IG Act of 1978 (5 USC App. 3); FedRAMP AU-2/AU-6 (audit event review); GSA OIG A210064 Contract Administration Audit pattern

## Summary
The OIG Reviewer is a GSA Office of Inspector General auditor who operates outside the contracting agency's normal chain of command. This role carries cross-tenant read access and exclusive access to the audit log and findings tracker, allowing it to independently monitor contract administration integrity, open formal findings against contracts, vendors, or the platform itself, and track remediation to closure.

## What they can do
- Search and export the Audit Log (`/admin/audit`) by actor, action, object ID, correlation ID, and date range
- View and open findings in the OIG Findings Tracker (`/admin/findings`): open/in-remediation/closed/overdue KPIs, evidence request fulfillment, and due dates
- Open new audit findings against contracts, vendors, or the platform itself, setting severity (CRITICAL/HIGH/MODERATE/LOW/INFORMATIONAL) and finding type
- Access the Reports Hub (`/reports`)
- Access contract admin (`/contracts/:id/admin`) in read context
- Invoke `POST /api/findings` to persist findings with actor identity captured via `X-User` header
- Query `GET /api/findings` filtered by remediation status, and `GET /api/findings/contract/{contractId}` for per-contract scope
- Every finding opened is audit-logged via `EvalAuditLogger.recordAsync("FINDING_OPEN", ...)`

## What they cannot do
- Cannot access User and Role Admin (`/admin/users`) or System Config (`/admin/config`) -- those routes are `sys_admin` only
- Cannot access the Invoice Queue (`/invoiceReviews`) -- restricted to `contracting_officer`, `cor`, `dcaa_auditor`
- Cannot access the Dashboard (`/dashboard`) -- restricted to CO/COR/CS/PM/SSA/sys_admin
- Cannot access contract modifications (create, edit, or list)
- Cannot access the Contractor Directory, CPAR Reviews, or Corpus Upload
- Cannot certify payments, sign SF-30 modifications, or obligate funds -- no write path to invoice or modification state exists for this role
- Cannot provision users or rotate system keys

## Constraints / authority limits
- `agencyId` is fixed to `GSA-OIG`, a distinct organizational tenant separate from contracting agency tenants such as `GSA-FAS` -- `frontend/src/app/models/roles.ts:88`
- `authorityNote` explicitly scopes this role to "Read-only across tenants; open findings" -- `frontend/src/app/models/roles.ts:89`
- Route access is enforced by Angular `roleGuard` at the client; the backend `FindingController` has no `@PreAuthorize` or Spring Security annotation, making server-side role enforcement absent
- Identity is passed as the `X-User` header; JWT signature validation is noted as skipped (Debt Item 1) -- `frontend/src/app/models/roles.ts:9-10`
- OIG Findings Tracker and Audit Log Search routes are restricted to `oig_reviewer` and `sys_admin` only -- `frontend/src/app/app.routes.ts:134-141`
- Finding `scope` may target `CONTRACT`, `VENDOR`, or `PLATFORM` (the system itself) -- `frontend/src/app/models/finding.ts:24`
- Finding lifecycle states: OPEN, EVIDENCE_REQUESTED, IN_REMEDIATION, CLOSED, ACCEPTED_RISK -- `frontend/src/app/models/finding.ts:9`

## Impact on the system
The OIG Reviewer is the system's independent oversight layer. It is the only non-admin role with cross-tenant read access and the only external authority that can formally record platform-level findings (scope = PLATFORM) against the system itself. If this role's access boundaries are collapsed or merged into a regular auditor role during migration, independent oversight is lost: OIG findings would be subject to the same agency-tenant silo as the data being audited, destroying separation of duties.

## Pain points
- The backend `FindingController` has no server-side role enforcement -- any authenticated caller who can reach `/api/findings` can open findings or read all findings across tenants; the role boundary exists only in the Angular guard
- JWT signature validation is disabled on public routes (Debt Item 1), meaning the `X-User` actor header is unvalidated at the service layer
- Audit log search has a known race-gap producing missing rows (Debt Item 2) and a correlation-ID mismatch (Debt Item 6) breaking cross-service queries -- these are the primary investigative tools for this role
- The `openFinding()` method in the Angular component hardcodes `openedBy: 'oig-park'` instead of reading from the active session -- actor attribution in the UI is a stub -- `frontend/src/app/components/findings-tracker/findings-tracker.component.ts:135`
- Evidence request fulfillment is display-only with no backend mutation path; the OIG cannot mark a request fulfilled through the UI

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:19` -- `oig_reviewer` declared in the `Role` union type
- `frontend/src/app/models/roles.ts:86-90` -- `RoleProfile` entry: `agencyId: 'GSA-OIG'`, `authorityNote: 'Read-only across tenants; open findings'`
- `frontend/src/app/shell/sidebar-nav.component.ts:46` -- `oig_reviewer` granted DCAA Audit Trail nav access
- `frontend/src/app/shell/sidebar-nav.component.ts:60` -- `oig_reviewer` granted Reports nav access
- `frontend/src/app/shell/sidebar-nav.component.ts:74-75` -- `oig_reviewer` granted Audit Log Search and OIG Findings Tracker exclusively in the Admin nav group
- `frontend/src/app/components/findings-tracker/findings-tracker.component.ts:6-17` -- component scoped to `oig_reviewer + sys_admin`; references GSA OIG A210064
- `frontend/src/app/components/findings-tracker/findings-tracker.component.ts:135` -- `openedBy` hardcoded stub in `openFinding()`
- `frontend/src/app/components/audit-search/audit-search.component.ts:7-16` -- component scoped to `sys_admin + oig_reviewer`; FedRAMP AU-2/AU-6 cited
- `frontend/src/app/app.routes.ts:40-42` -- `oig_reviewer` in `roleGuard` for `/reports`
- `frontend/src/app/app.routes.ts:117-119` -- `oig_reviewer` in `roleGuard` for `/contracts/:id/admin`
- `frontend/src/app/app.routes.ts:134-136` -- `oig_reviewer` in `roleGuard` for `/admin/audit`
- `frontend/src/app/app.routes.ts:138-141` -- `oig_reviewer` in `roleGuard` for `/admin/findings`
- `frontend/src/app/models/finding.ts:8-9` -- `FindingSeverity` and `FindingStatus` type definitions
- `frontend/src/app/models/finding.ts:19-33` -- `Finding` interface with `scope: 'CONTRACT' | 'VENDOR' | 'PLATFORM'`, `openedBy`, `evidenceRequests`
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/controller/FindingController.java:11-13` -- controller backs `/admin/findings` view
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/controller/FindingController.java:33-35` -- `open()` accepts `X-User` header as actor identity
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/model/Finding.java:18-32` -- `Finding` document with `agencyId`, `openedBy`, `remediationStatus`, `evidenceRequests`
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/service/FindingService.java:25-32` -- `open()` records `FINDING_OPEN` audit event via `EvalAuditLogger`

## Reviewer lens
You are an OIG Reviewer from GSA-OIG (role key `oig_reviewer`, `frontend/src/app/models/roles.ts:86-90`). Your authority is cross-tenant read access plus the exclusive right to open formal findings against contracts, vendors, and the platform itself. You are blocked from every write path in the contracting workflow. You reach exactly four surfaces: DCAA Audit Trail, Reports Hub, Audit Log Search, and OIG Findings Tracker.

The migration must preserve: (1) cross-tenant read scope -- `agencyId: 'GSA-OIG'` must not be siloed into a contracting agency tenant; (2) OIG Findings Tracker and Audit Log Search routes gated to `oig_reviewer` and `sys_admin` only -- no other roles may be added; (3) the `POST /api/findings` endpoint with `X-User` actor header attribution and the `FINDING_OPEN` audit trail it produces (`FindingService.java:30-32`); (4) the `Finding` model's `scope: PLATFORM` capability so the OIG can open findings against the system itself; (5) server-side enforcement of this role's boundaries -- the current Angular-only guard gap must be closed in the new stack, not carried forward.

Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| IG Act of 1978 (5 USC App. 3) | Independent OIG oversight authority across agency programs |
| FedRAMP AU-2 / AU-6 | Audit event generation and audit review requirements |
| GSA OIG A210064 | Contract administration audit pattern modeled by FindingsTracker and Finding scopes |
