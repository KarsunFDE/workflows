# Persona: Grants Management Officer

- **Role id:** `contracting_officer`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.211, 2 CFR 200.308, 2 CFR 200.205, 2 CFR 200.334

## Summary
The Grants Management Officer is the agency's warranted signing authority for federal financial assistance. This role holds the sole power to execute the award instrument, issue post-award amendments, and certify obligations under 2 CFR 200.211/200.308. Within the agentic workflow, the Grants Management Officer serves as the exclusive gate owner for GATE_4 (Award Decision) and co-owns GATE_1 (Eligibility and Risk Review) alongside the Program Officer.

## What they can do
- Sign and execute the federal award record via `POST /api/peerReviews/{id}/award` (`AwardController.java:recordAward`)
- Make final award decisions (AWARD, DO_NOT_AWARD, RETURN_TO_REVIEW) at GATE_4 as the sole `GRANTS_OFFICER` owner (`hitl.py:GATE_OWNER_ROLES`)
- Approve, reject, or return applications for fixes at GATE_1 alongside the Program Officer (`hitl.py:GATE_OWNER_ROLES`)
- Issue and approve post-award amendments via the amendment workflow with a 5-business-day SLA
- Access the officer dashboard, reports hub, amendment editor, QA triage, proposal intake, peer-review workspace, consensus/SSDD surface, contract admin, and award record routes (`app.routes.ts:routes`)
- Override blocked GATE_4 items when the revision loop cap (3) is exceeded by setting `override_flag` on `GateDecisionRequest` (`hitl.py:GateDecisionRequest`)
- Receive escalations when the reviewer pool is exhausted during multi-agent COI resolution
- Submit debrief requests on award records via `POST /awards/{id}/debrief-request` (`AwardController.java:requestDebrief`)

## What they cannot do
- Cannot perform cross-tenant operations; `agencyId` is bound to a single agency and `tenant_id` in every `GateDecisionRecord` must match all evidence refs (`roles.ts:ROLE_PROFILES`, `hitl.py:GateDecisionRecord._validate_tenant_binding`)
- Cannot resolve COI flags at GATE_2 — that gate is owned exclusively by `REVIEW_LEAD` (`hitl.py:GATE_OWNER_ROLES`)
- Cannot act as `sys_admin`; user provisioning and cross-tenant key rotation are restricted to `sys_admin` only (`app.routes.ts:routes`)
- Cannot access OIG audit search or findings tracker (`app.routes.ts:routes`)
- Cannot submit decisions outside the enumerated `GATE_ALLOWED_DECISIONS` set; the `GateDecisionRecord` validator raises `ValueError` on any non-allowed decision (`hitl.py:GateDecisionRecord._validate_decision_allowed`)
- Cannot use a cached evidence reference from a different tenant; `_validate_tenant_binding` enforces strict tenant equality (`hitl.py:GateDecisionRecord._validate_tenant_binding`)

## Constraints / authority limits
- Role identity is derived from the validated JWT `role` claim at the API gateway; the frontend role-switcher is a cohort demo mock only (`roles.ts:ROLE_PROFILES`)
- `agencyId` is non-null and single-agency; this role has no cross-tenant authority (`roles.ts:ROLE_PROFILES`)
- Every gate decision requires a non-empty `rationale` field (`hitl.py:GateDecisionRecord`)
- GATE_4 SLA is 10 business days; breach triggers automatic `EscalationRecord` creation
- Amendment approval SLA is 5 business days
- The revision loop cap is 3 per gate; exceeding cap requires explicit `override_flag` (`hitl.py:GateDecisionRequest`)
- All `GateDecisionRecord` entries are append-only and sealed at GATE_4 AWARD; records are subject to 2 CFR 200.334 retention (3-year minimum, 7 years when litigation/audit pending) (`hitl.py:GateDecisionRecord`)
- GATE_4 confidence/faithfulness thresholds are 0.70/0.70; AI output below these thresholds blocks advancement until the Grants Management Officer explicitly releases it (`grounding.py:GATE_CONFIDENCE_THRESHOLDS`)

## Impact on the system
The Grants Management Officer is the only human role that can commit federal funds — removing or weakening this role's gate ownership at GATE_4 would allow AI-generated award recommendations to execute without warranted human sign-off, violating 2 CFR 200.211. The `GateDecisionRecord` append-only audit chain is sealed by this role's AWARD decision; any migration that reroutes or skips GATE_4 ownership breaks the post-award audit replay required by ADR 0009 and the federal retention rule. Route guards for the amendment editor, QA triage, proposal intake, and contract admin surfaces all include `contracting_officer` explicitly; removing this role key without renaming the guard allowlists simultaneously would silently lock the Grants Management Officer out of every restricted surface.

## Pain points
- The `X-User` header on `AwardController` endpoints defaults to `"anonymous"` — no server-side role enforcement at the Java layer means the award actor claim in the audit record can be spoofed until gateway-level JWT enforcement replaces the header pattern (`AwardController.java:recordAward`)
- GATE_1 is co-owned with the Program Officer but the system has no tie-breaking or delegation rule when both owners disagree; the spec records only a single decision per gate (`hitl.py:GATE_OWNER_ROLES`)
- When the reviewer pool is exhausted and escalates to the Grants Management Officer, the escalation arrives outside the standard GATE_4 flow; there is no dedicated UI surface for this edge-case path (inferred from design spec — no corresponding route in `app.routes.ts:routes`)
- The amendment editor route allows `contract_specialist` and `program_manager` in addition to `contracting_officer` (`app.routes.ts:routes`), but only the Grants Management Officer can approve the amendment at the Amendment Review Gate — this asymmetry between edit access and approval authority may cause confusion about who owns the amendment

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `contracting_officer` declared as a valid `Role` union member; inline comment maps it to Grants Management Officer persona
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `contracting_officer` entry: `agencyId: 'HHS-ACF'`, authority note cites 2 CFR 200.211/200.308 signing and amendment authority
- `frontend/src/app/app.routes.ts:routes` — `roleGuard` confirms `contracting_officer` access to: dashboard, grant-applications/new, amendments, qa, proposals, peer-review/workspace, peer-review/:solId/consensus, contracts/:id/admin, reports, vendors
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory enforcing role allowlists on Angular routes; unauthorized users redirect to dashboard or public opportunities
- `services/ai-orchestrator/app/schemas/hitl.py:GateOwnerRole` — defines `GRANTS_OFFICER` as the enum value for the GMO in the HITL schema
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_OWNER_ROLES` — maps GATE_1 to `[GRANTS_OFFICER, PROGRAM_OFFICER]` and GATE_4 exclusively to `[GRANTS_OFFICER]`
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_ALLOWED_DECISIONS` — GATE_1 allows APPROVE/RETURN_FOR_FIXES/REJECT; GATE_4 allows AWARD/DO_NOT_AWARD/RETURN_TO_REVIEW
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord` — append-only audit model; `_validate_decision_allowed` enforces decision is in allowlist; `_validate_tenant_binding` enforces all evidence refs share the gate's `tenant_id`
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRequest` — requires non-empty `rationale`; `override_flag` available for revision-loop-exceeded cases
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/AwardController.java:recordAward` — `POST /api/peerReviews/{id}/award`; actor captured from `X-User` header defaulting to `"anonymous"`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/controller/AwardController.java:requestDebrief` — `POST /awards/{id}/debrief-request`; same `X-User` default
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/service/AwardService.java:recordAward` — persists Award, transitions PeerReview to AWARDED, logs async audit event
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/SecurityConfig.java:springSecurityFilterChain` — JWT signature-skip debt on `/api/public/**`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/SecurityConfig.java:corsConfig` — wildcard origin + allowCredentials=true (debt `sec-cors-wildcard-credentials`, W4 fix)
- `docs/specs/agentic-workflow/design-reference.md` — responsibility lane table: Grants Officer is a named HITL policy authority; GATE_1 owned by `GRANTS_OFFICER` + `PROGRAM_OFFICER`, 5-day SLA; GATE_4 owned exclusively by `GRANTS_OFFICER`, 10-day SLA; amendment workflow Amendment Review Gate owner is Grants Officer

## Reviewer lens
> This persona is the Grants Management Officer, identified by role key `contracting_officer` (`roles.ts:Role`) and mapped to `GateOwnerRole.GRANTS_OFFICER` (`hitl.py:GateOwnerRole`). The GMO is the sole owner of GATE_4 (AWARD stage) and co-owner of GATE_1 (SCREENING stage) per `hitl.py:GATE_OWNER_ROLES`. Every GATE_4 decision must carry `actor_role = GRANTS_OFFICER`, a non-empty `rationale`, and a `tenant_id` matching all evidence refs (`hitl.py:GateDecisionRecord._validate_tenant_binding`). Allowed GATE_4 decisions are strictly `AWARD | DO_NOT_AWARD | RETURN_TO_REVIEW` (`hitl.py:GATE_ALLOWED_DECISIONS`); no other decision passes schema validation. The migration must preserve: (1) exclusive GATE_4 gate ownership — no other role may submit a final award decision; (2) co-ownership of GATE_1 with Program Officer; (3) sole authority over the Amendment Review Gate; (4) the append-only `GateDecisionRecord` audit chain and its audit-replay fields required under 2 CFR 200.334; (5) tenant isolation enforced by `_validate_tenant_binding`; (6) all route guards in `app.routes.ts:routes` that include `contracting_officer`. The `X-User` header defaulting to `"anonymous"` in `AwardController.recordAward` is a known debt item; the migration must not regress it further or rely on it for identity.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.211 | Federal award instrument — contents and signing authority |
| 2 CFR 200.308 | Prior written approval for budget and program plan changes (amendments) |
| 2 CFR 200.205 | Pre-award risk review — eligibility and responsibility determination |
| 2 CFR 200.334 | Retention requirements for grant records (3-year minimum; 7-year litigation hold) |
