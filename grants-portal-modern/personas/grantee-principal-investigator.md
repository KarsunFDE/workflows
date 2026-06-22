# Persona: Grantee / Principal Investigator

- **Role id:** `vendor`
- **Class:** external · single-agency · human · untrusted
- **Regulatory basis:** 2 CFR 200 Subparts C–D (pre-award application), 2 CFR 200.328–329 (post-award reporting), FAR 42.1503(d) (CPAR rebuttal)

## Summary
The Grantee / Principal Investigator is the external applicant organization (and its named project director) seeking a federal financial-assistance award. They submit the SF-424 application package against an open Notice of Funding Opportunity (NOFO), file post-award performance reports, and exercise the 60-day CPAR rebuttal right. They have no internal-agency identity: `agencyId` is `null` on their role profile and their tenant boundary is their own SAM UEI / legacy DUNS.

## What they can do
- Access `/vendor/proposals` exclusively — the single route guarded solely to `vendor` (`app.routes.ts:routes`; `role.guard.ts:roleGuard`).
- Browse public funding opportunities at `/public/opportunities` (unguarded, available to all roles including `vendor`; `app.routes.ts:routes`).
- View their own draft and submitted proposals and their amendment-acknowledgement state via `VendorPortalComponent` (`vendor-portal.component.ts:VendorPortalComponent`).
- Acknowledge posted amendments on their active proposals (`VendorPortalComponent`).
- Submit an SF-424 application carrying `principalInvestigatorName`, `applicantOrg`, `applicantUei`, `applicantSsn`, `requestedAmountFederal`, `costShareMatch`, `opportunityNumber`, `assistanceListingNumber`, and `fundingInstrument` fields (`GrantApplicationCreateRequest.java:principalInvestigatorName`; `GrantApplicationService.java:create`).
- Withdraw (cancel) an application before `AWARD_DECISION` (`GrantApplicationService.java:cancel`).
- Submit a CPAR rebuttal narrative when CPAR status is `AWAITING_VENDOR_REVIEW`, surfaced in `CparReviewComponent` only when `role.currentRole === 'vendor'` (`cpar-review.component.ts:CparReviewComponent`); backend endpoint `POST /api/contracts/{id}/cpars/{cparId}/rebuttal` (`ContractController.java:recordRebuttal`).

## What they cannot do
- Access the officer dashboard (`/dashboard`) — `roleGuard` there lists `contracting_officer`, `contract_specialist`, `program_manager`, `ssa`, `sys_admin` and excludes `vendor` (`app.routes.ts:routes`).
- Create or modify grant applications through the wizard (`/grant-applications/new`) — guard excludes `vendor` (`app.routes.ts:routes`).
- Issue amendments (`/grant-applications/:id/amendments`) — guarded to `contracting_officer`, `contract_specialist`, `program_manager` (`app.routes.ts:routes`).
- Access QnA triage or proposal-intake management routes (`app.routes.ts:routes`).
- View the vendor directory or another vendor's detail (`/vendors`, `/vendors/:id`) — guard excludes `vendor` (`app.routes.ts:routes`).
- Access the evaluator workspace, consensus/SSDD surfaces, contract-admin, reports hub, or any admin/audit routes (`app.routes.ts:routes`).
- Sign or certify the federal award — authority is reserved to `contracting_officer` (`roles.ts:ROLE_PROFILES`).

## Constraints / authority limits
- Identity is external: `agencyId: null` in `RoleProfile` (`roles.ts:RoleProfile`); the role is resolved from a JWT claim in production — the mock role-switcher is instructor-demo only (`roles.ts:ROLE_PROFILES`).
- Organizational boundary is the `vendorDuns` field (the only role-profile field carrying this key; `roles.ts:RoleProfile`) and the `applicantUei` stored on the application (`GrantApplication.java:applicantUei`). Neither field is cross-checked against the JWT's agency claim today (Item 10 debt — `GrantApplicationService.java:listAll`).
- Reachable workflow states: `INTAKE → SCREENING` (via `publish`); `WITHDRAWN` reachable from any pre-`AWARD_DECISION` state (`GrantApplicationService.java:publish`, `GrantApplicationService.java:cancel`). Post-award status (`POST_AWARD_REPORTING`, `CLOSEOUT`) is advanced by agency staff, not the grantee directly.
- CPAR rebuttal window is 60 days (FAR 42.1503(d)), enforced via `rebuttalDeadline` field (`mock-fixtures.ts:FIXTURE_SOLICITATIONS`); the rebuttal route has no server-side role check — `X-User` header is passed but no authorization is enforced on `ContractController.recordRebuttal`.
- PII (PI name + SSN last-4) submitted on `GrantApplicationCreateRequest` is currently logged at INFO level — a pair-unique brownfield debt item (`obs-pii-in-info-logs`) scheduled for remediation in W5 (`GrantApplicationService.java:create`).

## Impact on the system
The `vendor` role is the entry point for all grant applications; removing or misrouting it stops every SF-424 submission from ever reaching `SCREENING`. Its narrow route access (`/vendor/proposals` only) is the primary UI separation-of-duties control that prevents grantees from seeing each other's data or advancing award state. In a migration, if this role's guard is collapsed into a broader "authenticated user" principal — or if the `agencyId: null` / `vendorDuns` identity contract is dropped — Item 10's cross-tenant retrieval flaw becomes exploitable, exposing all applications across all awarding agencies to any authenticated external user.

## Pain points
- The `VendorPortalComponent` resolves vendor identity by hardcoding `'vnd-acme'` regardless of the active `vendorDuns` (`VendorPortalComponent`), meaning all vendor sessions see the same fixture proposals — a pre-migration demo shortcut that would allow data cross-contamination if carried into production.
- `agencyId` on `GrantApplicationCreateRequest` is not validated against the JWT's agency claim; a grantee can submit an application claiming any agency tenant.
- PI name and SSN are accepted in the same DTO that feeds an INFO-level log line (`GrantApplicationService.java:create`) — a FedRAMP MP-6 / AU-2 violation that remains unfixed until W5.
- The CPAR rebuttal endpoint (`ContractController.java:recordRebuttal`) has no role-based authorization check server-side; the 60-day window constraint is UI-only.
- No amendment-acknowledgement deadline enforcement exists server-side; the `needsAck` check lives entirely in the Angular component (`VendorPortalComponent`).

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `vendor` enum key maps to "Grantee / Principal Investigator (external applicant)"
- `frontend/src/app/models/roles.ts:RoleProfile` — `vendorDuns` optional field present only on `vendor` role profile
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `vendor` entry: `agencyId: null`, `vendorDuns: '123456789'`, authority note cites SF-424 + 2 CFR 200.328–329
- `frontend/src/app/app.routes.ts:routes` — `/vendor/proposals` guarded exclusively to `roleGuard('vendor')`
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory; redirects non-matching roles to `/dashboard` or `/public/opportunities`
- `frontend/src/app/components/vendor-portal/vendor-portal.component.ts:VendorPortalComponent` — vendor views own proposals, acknowledges amendments
- `frontend/src/app/components/cpar-review/cpar-review.component.ts:CparReviewComponent` — rebuttal textarea shown only when `role.currentRole === 'vendor'` and CPAR is `AWAITING_VENDOR_REVIEW`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/ContractController.java:recordRebuttal` — `POST /api/contracts/{id}/cpars/{cparId}/rebuttal` endpoint; no role guard, actor from `X-User` header only
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/GrantApplication.java:principalInvestigator` — `principalInvestigator` field on the MongoDB document
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/GrantApplication.java:applicantOrg` — `applicantOrg` field that models external applicant organization
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/GrantApplication.java:applicantUei` — SAM UEI anchoring the external organization
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/service/GrantApplicationService.java:create` — maps `principalInvestigatorName` from DTO to document; PII log at INFO level (debt `obs-pii-in-info-logs`)
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/service/GrantApplicationService.java:publish` — advances status from `INTAKE` to `SCREENING`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/service/GrantApplicationService.java:cancel` — sets status to `WITHDRAWN`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/dto/GrantApplicationCreateRequest.java:principalInvestigatorName` — PI name field on the create DTO; source for PII log
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/dto/GrantApplicationCreateRequest.java:applicantSsn` — SSN field whose suffix is logged at INFO (debt `obs-pii-in-info-logs`)
- `frontend/src/app/services/mock-fixtures.ts:FIXTURE_SOLICITATIONS` — fixture grant application showing `applicantOrg`, `applicantUei`, `principalInvestigator` for external nonprofit applicant

## Reviewer lens
> This persona is the `vendor` role (`roles.ts:Role`, `roles.ts:ROLE_PROFILES`). Its authority is narrow and external: submit SF-424 applications (`GrantApplicationCreateRequest.java:principalInvestigatorName`), view own proposals at `/vendor/proposals` (`app.routes.ts:routes`), acknowledge amendments (`VendorPortalComponent`), and file a CPAR rebuttal within the 60-day window (`CparReviewComponent`; `ContractController.java:recordRebuttal`). Its identity boundary is `agencyId: null` + `vendorDuns` (`roles.ts:RoleProfile`), never an internal agency. It is explicitly excluded from dashboard, wizard, amendment issuance, evaluator workspace, and all admin/audit routes (`app.routes.ts:routes`). The migration must preserve the `vendor`-exclusive guard on `/vendor/proposals`, the `agencyId: null` sentinel that prevents internal-tenant escalation, and the separation between proposal submission and award decision. The debt-era CPAR rebuttal endpoint (`ContractController.java:recordRebuttal`) has no server-side role check — any authenticated actor can call it; the migration must add authorization here. The PII logging debt (`GrantApplicationService.java:create`) must not be carried forward.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200 Subpart C (200.204–205) | NOFO / funding-opportunity requirements; merit review |
| 2 CFR 200 Subpart D (200.211, 200.308) | Federal award terms; amendment / prior approval |
| 2 CFR 200.328–329 | Post-award performance and financial reporting obligations |
| FAR 42.1503(d) | CPAR 60-day vendor rebuttal window |
| FedRAMP MP-6 / AU-2 | Media sanitation / audit event logging — triggered by PII-in-logs debt |
