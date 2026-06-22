# Persona: Inspector General (OIG Reviewer)

- **Role id:** `oig_reviewer`
- **Class:** external · cross-tenant · human · trusted
- **Regulatory basis:** 2 CFR 200.337 (Access to records)

## Summary
The OIG Reviewer is an external auditor from HHS-OIG whose authority spans all awarding agencies within the portal. This role operates in a read-only posture across grant application data and audit trails, while holding the unique write privilege to open and track formal audit findings against awardees and programs.

## What they can do
- Access the Reports Hub (`/reports`), providing cross-program visibility into pipeline and spend data across awarding agencies. (`app.routes.ts:routes`)
- View contract administration records (`/contracts/:id/admin`) for post-award audit inspection. (`app.routes.ts:routes`)
- Search the full audit event log (`/admin/audit`) backed by `AuditEvent` records that capture actor, action, resource, before/after state, and correlation ID. (`app.routes.ts:routes`, `AuditEvent.java:AuditEvent`)
- Access and manage the Findings Tracker (`/admin/findings`), the primary OIG workflow surface. (`app.routes.ts:routes`)
- Open new audit findings via `POST /api/findings`, setting `openedBy`, `findingType`, `severity`, `evidenceRequests`, `remediationStatus`, and due date. (`FindingController.java:open`, `Finding.java:Finding`)
- List findings by remediation status (`OPEN / IN_PROGRESS / REMEDIATED / WAIVED`) and query findings by contract ID. (`FindingController.java:list`, `FindingController.java:forContract`, `FindingService.java:open`)

## What they cannot do
- Cannot create, edit, or submit grant applications — `grant-applications/new` guards exclude `oig_reviewer`. (`app.routes.ts:routes`)
- Cannot author or sign amendments — `grant-applications/:id/amendments` guard excludes `oig_reviewer`. (`app.routes.ts:routes`)
- Cannot access QA triage or proposal intake surfaces. (`app.routes.ts:routes`)
- Cannot access the officer dashboard (`/dashboard`) — guard explicitly excludes `oig_reviewer`. (`app.routes.ts:routes`)
- Cannot access the vendor directory or vendor detail pages. (`app.routes.ts:routes`)
- Cannot access the evaluator workspace or merit consensus surfaces. (`app.routes.ts:routes`)
- Cannot access user admin or system config panels — `admin/users` and `admin/config` are `sys_admin`-only. (`app.routes.ts:routes`)

## Constraints / authority limits
- Agency scope is fixed to `agencyId: 'HHS-OIG'` in the role profile, but the `authorityNote` establishes read-only access "across awarding agencies," making this the only external role with cross-tenant read reach. (`roles.ts:ROLE_PROFILES`)
- Role identity is resolved from JWT claims at the API gateway; the mock role-switcher in `roles.ts` is for demo use only — production auth flows through Spring Security OAuth2. (`roles.ts:ROLE_PROFILES`, `SecurityConfig.java:springSecurityFilterChain`)
- The `AuditEvent` entity is append-only — `AuditLogger` is the sole writer; OIG reads but does not mutate the audit log directly. (`AuditEvent.java:AuditEvent`)
- Findings opened via `POST /api/findings` record the actor from the `X-User` request header with a fallback of `"anonymous"` — backend does not enforce role-based write restriction at the HTTP layer today. (`FindingController.java:open`)
- `correlationId` on `AuditEvent` is frequently blank across service hops due to inconsistent MDC key naming (Item 6), limiting cross-service audit trail traceability for this role. (`AuditEvent.java:correlationId`)
- `AuditEvent.beforeJson` / `afterJson` are populated asynchronously; a mid-flush service crash drops them, creating gaps in the audit evidence the OIG role depends on (Item 2). (`AuditLogger.java:recordAsync`)

## Impact on the system
The OIG Reviewer is the only role with legitimate cross-agency read access and the exclusive owner of the Finding lifecycle — removing or weakening its route guards would either lock auditors out entirely or (if guards are misconfigured to be more permissive) allow non-OIG roles to write findings, undermining separation of duties. In a migration, the `Finding` entity's `openedBy` attribution, the `AuditEvent` append-only guarantee, and the four `canMatch` route guards (`/reports`, `/contracts/:id/admin`, `/admin/audit`, `/admin/findings`) must all survive intact. Loss of the audit-search surface would break the 2 CFR 200.337 access-to-records obligation the system is built to satisfy.

## Pain points
- The `correlationId` field on `AuditEvent` is often blank when tracing an event across services, forcing auditors to correlate records manually by timestamp and resource ID. (`AuditEvent.java:correlationId` — Item 6 debt, not fixed until W5)
- `AuditEvent.beforeJson` and `afterJson` fields are populated asynchronously and can be lost on service crash, creating evidentiary gaps in audit records. (`AuditLogger.java:recordAsync` — Item 2 debt)
- The `FindingController` identifies the opening actor via a plain `X-User` header with no role enforcement at the HTTP layer, meaning finding attribution depends entirely on correct header injection rather than validated JWT claims. (`FindingController.java:open` — inference: RBAC gap)
- The `Finding` entity uses a `contractId` field rather than a `grantApplicationId`, reflecting an acquisition-era data model that does not map cleanly onto the grants lifecycle, requiring auditors to manually cross-reference award records. (`Finding.java:Finding` — inference based on domain mismatch)
- The JWT signature-skip on `/api/public/**` (Item 1) means a forged JWT with elevated `oig_reviewer` claims could access guarded routes on that path before the fix lands in W4. (`SecurityConfig.java:springSecurityFilterChain`)

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `oig_reviewer` key maps to the OIG audit persona
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `oig_reviewer` entry: `agencyId: 'HHS-OIG'`, authority note citing 2 CFR 200.337, read-only cross-agency posture
- `frontend/src/app/app.routes.ts:routes` — `/reports`, `/contracts/:id/admin`, `/admin/audit`, `/admin/findings` route guards include `oig_reviewer`; dashboard, grant-application creation, and amendment editor guards exclude `oig_reviewer`
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory; unauthorized access redirects to dashboard or public opportunities
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/AuditEvent.java:AuditEvent` — append-only audit log, expanded for OIG-style search
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/AuditEvent.java:correlationId` — often blank cross-hop (Item 6)
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/audit/AuditLogger.java:recordAsync` — before/after JSON populated async; losable on crash (Item 2)
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/model/Finding.java:Finding` — `Finding` document: `openedBy`, `evidenceRequests`, `remediationStatus`, `dueAt`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/model/Finding.java:evidenceRequests` — list of evidence request strings the OIG attaches to a finding
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/FindingController.java:FindingController` — class comment identifies this as "OIG-style findings tracker"
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/FindingController.java:open` — `POST /api/findings`; actor from `X-User` header, no `@PreAuthorize`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/FindingController.java:list` — list findings by `remediationStatus`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/FindingController.java:forContract` — list findings by `contractId`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/service/FindingService.java:open` — sets `openedAt`, defaults status to `OPEN`, fires async audit log
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/SecurityConfig.java:springSecurityFilterChain` — JWT signature skip on `/api/public/**` (Item 1 brownfield debt)

## Reviewer lens
> This persona is `oig_reviewer` (`roles.ts:ROLE_PROFILES`), an external HHS-OIG auditor with cross-agency read authority under 2 CFR 200.337. The role is granted access to exactly four guarded routes: `/reports`, `/contracts/:id/admin`, `/admin/audit`, and `/admin/findings` (`app.routes.ts:routes`). It is explicitly excluded from the officer dashboard, grant application creation, amendment authoring, evaluator workspaces, vendor directory, and all `sys_admin`-only panels. The role's primary write action is opening `Finding` documents via `POST /api/findings` (`FindingController.java:open`), with actor attribution via `X-User` header — not JWT-enforced at the HTTP layer today. The `AuditEvent` append-only log (`AuditEvent.java:AuditEvent`) is the evidence base for audit search, but `correlationId` gaps (Item 6) and async before/after-JSON loss (Item 2) create current evidentiary weaknesses. Any migration must (1) preserve all four `canMatch` route guards exactly as scoped, (2) maintain the append-only `AuditEvent` contract, (3) ensure `Finding.openedBy` is populated from a validated identity (not a spoofable header), and (4) carry the cross-agency read scope without collapsing it to a single-tenant boundary.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.337 | Federal agency and pass-through entity access to records for audit and inspection |
| 2 CFR 200.205 | Merit review — referenced in portal RBAC to delimit non-OIG roles' authority |
| 2 CFR 200.521 | Audit findings and resolution |
| Inspector General Act of 1978 | OIG independence |
