# Persona: Contracting Officer's Representative (COR)

- **Role id:** `cor`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** FAR 42.302, FAR 1.602-2(d), FAR 32.905, FAR 46.5, DFARS 252.232-7003, 5 CFR 1315

## Summary
The COR is the government's primary post-award technical monitor, designated in writing by the Contracting Officer to oversee contract performance at the agency level. In this system the COR is the default authenticated identity on app load, reflecting that most day-to-day post-award workflow actions belong to this role. The COR drives the invoice three-way match (contract / invoice / receiving report) that gates all vendor payments.

## What they can do
- Access the Invoice Queue (`/invoiceReviews`) and initiate invoice reviews against awarded contracts — `sidebar-nav.component.ts:45`
- Match incoming vendor invoices to WAWF receiving reports (`receivingReportRef` field) — `InvoiceReview.java:49-50`
- Execute the FAR 32.905 proper-invoice checklist (eight required elements stored in `properInvoiceChecks`) and determine proper/improper status — `InvoiceReview.java:57-58`, `invoice-review-panel.component.ts:57-64`
- Return an invoice as improper within 7 days with a `returnReason` — `InvoiceReview.java:63-65`
- Accept deliverables and receiving reports; review and recommend payment — `roles.ts:43-47`
- Access Dashboard, Modifications Index, New SF-30 Modification, Contract Admin, CPAR Reviews, Award Record, All Reports, and Contractor Directory — `sidebar-nav.component.ts:31-66`

## What they cannot do
- Obligate funds — explicitly prohibited by `authorityNote` in `roles.ts:46`
- Certify invoices for payment (that authority belongs to the Contracting Officer) — `roles.ts:37-40`
- Access DCAA Audit Trail (`/admin/audit`) — `sidebar-nav.component.ts:46` (route restricted to `dcaa_auditor`, `oig_reviewer`, `contracting_officer`)
- Access User & Role Admin, System Config, or OIG Findings Tracker — `sidebar-nav.component.ts:71-76`
- Make commitments or changes that affect price, quality, quantity, delivery, or other contract terms — `far-42-overview.md:19-20`

## Constraints / authority limits
- Scoped to a single `agencyId` (`GSA-FAS` in the fixture); cross-tenant access is not modeled for this role — `roles.ts:43-47`
- Role is resolved from a JWT `role` claim in production (gateway-enforced); in dev, the mock `X-Mock-Role` header is used — `role.service.ts:13-15`
- The COR is the default role when no stored session exists, meaning unauthenticated or unrecognized sessions fall back to COR scope — `role.service.ts:29-30`
- Authority is delegated in writing by the CO (FAR 1.602-2(d)); the system does not currently enforce a delegation record check
- Invoice improper-return must occur within 7 days; the `promptPayDueDate` (receipt + 30 days) is stored but no server-side enforcement of the 7-day return window is evident — `InvoiceReview.java:60-62`

## Impact on the system
The COR is the linchpin of the FAR 32 payment spine: without proper COR gating, vendor invoices cannot advance from `received` to `proper` to `certified`. If COR role constraints are removed or collapsed into the CO role in a migration, separation-of-duties between invoice recommendation and payment certification (FAR 42.302 / AC-5) is lost, creating audit findings and potential Prompt Payment Act violations. The COR is also the default fallback identity on app load — removing or misconfiguring this role would break the application's initial authenticated state for every new session.

## Pain points
- The 7-day improper-return clock (FAR 32.905(b)) is stored in the data model but no server-side enforcement or alerting exists; COR must manually track the deadline — `InvoiceReview.java:63-65` (inference: no timer/event observed in reviewed code)
- Invoice review panel operates on fixture data in dev; the live POST to `/api/invoice-reviews` has no idempotency key or circuit breaker (Debt Item 3), meaning a COR double-clicking "Start invoice review" can create duplicate records — `invoice-review-panel.component.ts:19`, `invoice-review-panel.component.ts:103`
- The three-way match (contract / invoice / receiving report) depends on fetching the contract/CLIN snapshot, which is the known no-circuit-breaker hot loop reproducer (Debt Item 3) — `InvoiceReview.java:26-29`
- DCAA flags surface in the invoice detail panel but the COR has no direct action path on them; escalation to DCAA auditor is implied but not enforced by a workflow gate — `invoice-review-panel.component.ts:68` (inference)
- Role is the session default, so any JWT misconfiguration silently downgrades a higher-privilege user to COR scope — `role.service.ts:29-30`

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:14` — `'cor'` defined as a Role union member with inline comment "Contracting Officer's Representative (default)"
- `frontend/src/app/models/roles.ts:43-47` — COR RoleProfile with `agencyId: 'GSA-FAS'` and `authorityNote` citing FAR 42.302 / 46.5; explicit "Cannot obligate funds"
- `frontend/src/app/services/role.service.ts:29-30` — COR is the fallback default when no stored role exists in localStorage
- `frontend/src/app/shell/sidebar-nav.component.ts:31-45` — COR included in Dashboard, Modifications Index, New SF-30 Modification, and Invoice Queue nav links
- `frontend/src/app/shell/sidebar-nav.component.ts:52-66` — COR included in Contract Admin, CPAR Reviews, Award Record, All Reports, Contractor Directory
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/model/InvoiceReview.java:19-21` — Javadoc states "The COR matches it to the receiving report, runs the proper-invoice checklist (FAR 32.905)"
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/model/InvoiceReview.java:49-65` — `receivingReportRef`, `properInvoiceChecks`, `paymentStatus`, `promptPayDueDate`, `returnReason` fields model the COR's three-way match workflow
- `frontend/src/app/components/invoice-review-panel/invoice-review-panel.component.ts:9-18` — Component doc explicitly names COR as the actor: "COR reviews incoming payment requests: matches each invoice to its WAWF receiving report"
- `frontend/src/app/components/invoice-review-panel/invoice-review-panel.component.ts:103` — Debt Item 3 comment: no idempotency key / circuit breaker on COR-initiated POST

## Reviewer lens
> This persona is the Contracting Officer's Representative (COR), role key `cor` (`roles.ts:14`), scoped to a single agency (`agencyId: 'GSA-FAS'`, `roles.ts:45`). The COR's authority is bounded by FAR 42.302 and 1.602-2(d): accept deliverables and receiving reports, review invoices, recommend payment — but explicitly cannot obligate funds (`roles.ts:46`). The COR drives the FAR 32.905 three-way match (contract / invoice / receiving report) that is the only path from invoice `received` to `certified`; this separation from the CO's payment-certification authority is an AC-5 separation-of-duties control. Any migration plan must demonstrate: (1) the `cor` role key and its nav-access set (`sidebar-nav.component.ts:31-66`) are preserved without privilege collapse into `contracting_officer`; (2) the `properInvoiceChecks` checklist and `receivingReportRef` match remain enforced before `paymentStatus` can advance to `certified`; (3) Debt Item 3 (no circuit breaker on POST `/api/invoice-reviews`, `invoice-review-panel.component.ts:103`) is either fixed or explicitly risk-accepted; (4) the COR-as-default-session fallback (`role.service.ts:29-30`) does not silently grant or deny access when JWT resolution fails in the migrated gateway. Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 42.302 | COR designation and delegated post-award duties |
| FAR 1.602-2(d) | Written COR designation requirement |
| FAR 32.905 | Proper-invoice required elements and 7-day improper-return rule |
| FAR 46.5 | Acceptance of supplies and services (receiving reports) |
| DFARS 252.232-7003 | Electronic submission via WAWF; three-way match requirement |
| 5 CFR 1315 | Prompt Payment Act — 30-day payment due date from receipt |
