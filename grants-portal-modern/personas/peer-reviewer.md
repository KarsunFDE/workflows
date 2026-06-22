# Persona: Peer Reviewer

- **Role id:** `evaluator`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.205 (merit review of proposals); 2 CFR 200.112 (conflict of interest)

## Summary
The Peer Reviewer is an internal subject-matter expert assigned to a merit-review panel for a specific grant application. They score applications criterion-by-criterion against published NOFO merit criteria, attest to the absence of a conflict of interest before touching any assigned application, and produce a scoring narrative that feeds the panel's funding recommendation. Their output is advisory — they hold no award authority.

## What they can do
- Score assigned applications against published merit criteria, with per-criterion rating and narrative, via `EvaluatorWorkspaceComponent` (`EvaluatorWorkspaceComponent.scoreFor`)
- Access the `peer-review/workspace` route (guarded to `evaluator`, `contracting_officer`, `sys_admin`) (`app.routes.ts:routes`)
- Read vendor/grantee directory entries via the `vendors` and `vendors/:id` routes (`app.routes.ts:routes`)
- Accept or act on AI-generated factor suggestions at GATE_3 (decisions: ACCEPT, EDIT, REJECT) as `HUMAN_REVIEWER` (`hitl.py:GATE_OWNER_ROLES`, `hitl.py:GATE_ALLOWED_DECISIONS`)
- Appear as a candidate in the ranked reviewer-assignment output produced by `run_reviewer_assignment` (`agents.py:run_reviewer_assignment`)

## What they cannot do
- Cannot access applications not assigned to their panel (`EvaluatorWorkspaceComponent` — workspace scoped to assigned panel only)
- Cannot advance or reject a grant application — scoring is advisory; the award decision is reserved for `GRANTS_OFFICER` at GATE_4 (`hitl.py:GATE_OWNER_ROLES`)
- Cannot resolve their own conflict of interest — COI resolution belongs to `REVIEW_LEAD` at GATE_2 (`hitl.py:GATE_OWNER_ROLES`; `agents.py:run_coi_check`)
- Cannot reach the consensus/SSDD view — that route is guarded to `ssa` and `contracting_officer` only (`app.routes.ts:routes`)
- Cannot access award records, amendments, QA triage, or proposal intake routes (`app.routes.ts:routes`)
- Cannot reach officer dashboard, reports hub, or admin surfaces (`app.routes.ts:routes`)

## Constraints / authority limits
- Agency-scoped: `agencyId` is non-null and single-agency (e.g., `HHS-ACF`) (`roles.ts:ROLE_PROFILES`); cross-tenant access is not permitted
- COI attestation is a hard gate: `conflictOfInterestAttested` must be true on the `PeerReview` document before scoring is valid (`PeerReview.java:PeerReview.conflictOfInterestAttested`)
- Panel membership is explicitly enumerated in `PeerReview.panelMembers`; access is scoped to that list (`PeerReview.java:PeerReview`)
- GATE_3 SLA is 3 business days; breach auto-escalates and creates an `EscalationRecord`
- GATE_3 grounding thresholds apply: confidence block 0.70, faithfulness block 0.70; low-confidence AI outputs must be flagged before being presented (`grounding.py:GATE_CONFIDENCE_THRESHOLDS`)
- Role is resolved from a validated JWT at the API Gateway in production; the frontend role-switcher is a demo fixture only (`roles.ts:ROLE_PROFILES`)
- Scores against `meritCriteriaIds` anchored to published NOFO criteria (2 CFR 200.204); scoring outside those criteria is structurally prevented by the model (`PeerReview.java:PeerReview`)

## Impact on the system
Peer Reviewer scores are the only mechanism by which merit criteria ratings enter `PeerReview.meritCriteriaScores` and produce the `overallScore` and `recommendation` that Program Officers and Grants Officers rely on at GATE_4. If the evaluator role's route guard, COI enforcement, or GATE_3 ownership are loosened or removed during a migration, any authenticated user could submit scores, a flagged reviewer could self-clear their own COI, and award decisions would rest on unchecked panel composition — invalidating the 2 CFR 200.205 merit-review record and exposing every affected award to audit findings or de-obligation.

## Pain points
- No blind-review enforcement in the current data model: `meritCriteriaScores` is a shared map on the `PeerReview` document with no per-reviewer isolation, meaning the scoring workspace relies entirely on UI-level discipline rather than a server-side access control (`PeerReview.java:PeerReview` — inference from flat map structure)
- The reviewer workspace calls grant-application-service for application text without a circuit breaker (Item 3), creating a hot-loop risk under load that directly affects reviewers trying to access their scoring queue (`EvaluatorWorkspaceComponent` — Item 3 circuit-breaker note in component comment)
- COI attestation is a boolean flag with no timestamp or per-reviewer granularity — a panel-level flag does not distinguish which panel members have attested (`PeerReview.java:PeerReview.conflictOfInterestAttested` — inference)
- GATE_3 factor suggestions require the reviewer to manually decide ACCEPT / EDIT / REJECT with no inline diff view; the workspace UI provides only a plain narrative textarea (`EvaluatorWorkspaceComponent.scoreFor`)
- The `peer-reviews` listing route has no `canMatch` guard, making the panel list surface reachable without the `evaluator` role (`app.routes.ts:routes`)

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `evaluator` is one of nine role union-type literals; maps to Peer Reviewer persona
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `evaluator` entry: `agencyId: 'HHS-ACF'`, `authorityNote` citing 2 CFR 200.205 and COI attestation requirement
- `frontend/src/app/app.routes.ts:routes` — `/peer-review/workspace` guards to `evaluator`, `contracting_officer`, `sys_admin`; `/vendors` and `/vendors/:id` include `evaluator`; consensus/SSDD route explicitly excludes `evaluator`; award/admin/QA routes exclude it
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory that enforces allow-lists; unauthorized redirect to `/dashboard`
- `frontend/src/app/components/evaluator-workspace/evaluator-workspace.component.ts:EvaluatorWorkspaceComponent` — criterion-by-criterion scoring UI; component doc cites 2 CFR 200.205; Item 3 circuit-breaker note
- `frontend/src/app/components/evaluator-workspace/evaluator-workspace.component.ts:EvaluatorWorkspaceComponent.scoreFor` — per-criterion score cache with mandatory narrative field
- `services/ai-orchestrator/app/schemas/hitl.py:GateOwnerRole` — `HUMAN_REVIEWER` enum member maps to GATE_3 owner
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_OWNER_ROLES` — `GateId.GATE_3: [GateOwnerRole.HUMAN_REVIEWER]` routing table
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_ALLOWED_DECISIONS` — GATE_3 allows `ACCEPT`, `EDIT`, `REJECT`
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord._validate_decision_allowed` — enforces decision is in the allowed set at model-validation time
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord._validate_tenant_binding` — every evidence reference's `tenant_id` must equal the gate's `tenant_id`
- `services/ai-orchestrator/app/workflow/agents.py:run_reviewer_assignment` — Bedrock-backed agent builds ranked `ReviewerCandidate` list for the panel
- `services/ai-orchestrator/app/workflow/agents.py:run_coi_check` — deterministic four-rule COI screen; module docstring: "none may self-resolve COI"
- `services/ai-orchestrator/app/workflow/agents.py:run_panel_confirmation` — creates audit record after GATE_2 resolution
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/model/PeerReview.java:PeerReview` — domain record holding `panelMembers`, `meritCriteriaScores`, `conflictOfInterestAttested`, `recommendation`
- `services/peer-review-service/src/main/java/com/karsunfde/grantsportal/peerreview/model/PeerReview.java:PeerReview.conflictOfInterestAttested` — boolean COI attestation field (2 CFR 200.112)
- `docs/specs/agentic-workflow/design-reference.md` — GATE_3 gate table: stage PEER_REVIEW, owner HUMAN_REVIEWER, SLA 3 business days

## Reviewer lens
> This persona is the `evaluator` role (JWT claim, production source: API Gateway) mapped to `GateOwnerRole.HUMAN_REVIEWER` in `hitl.py:GATE_OWNER_ROLES`. Authority is strictly scoped to GATE_3 (Factor Suggest Acceptance) within the `PEER_REVIEW` workflow stage. The evaluator scores applications against published merit criteria in `EvaluatorWorkspaceComponent` and must attest absence of COI via `PeerReview.conflictOfInterestAttested` before scoring counts. Route access is enforced by `roleGuard` in `app.routes.ts`; the evaluator is excluded from all award-creation, QA-triage, admin, and audit routes. Any migration plan must demonstrate: (1) GATE_3 still has exactly one human owner role; (2) `conflictOfInterestAttested` and the four deterministic COI rules in `run_coi_check` survive as a hard precondition to panel confirmation; (3) tenant isolation via `GateDecisionRecord._validate_tenant_binding` is preserved end-to-end; (4) the evaluator's route access set — workspace and vendor-directory read — is neither expanded nor collapsed. Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.205 | Merit review of proposals — required process and criteria |
| 2 CFR 200.112 | Conflict of interest — disclosure and attestation obligations |
| 2 CFR 200.204 | Notice of Funding Opportunity — published merit criteria that reviewers score against |
