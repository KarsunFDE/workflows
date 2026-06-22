# Persona: Program Officer

- **Role id:** `program_manager`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.204–205 (NOFO publication requirements and pre-award risk review)

## Summary
The Program Officer is the internal agency subject-matter authority who owns the Notice of Funding Opportunity (NOFO) lifecycle and the pre-award merit-review process. Mapped to the `program_manager` JWT role key, this persona operates within a single agency tenancy (e.g., HHS-ACF) and is the default persona in the cohort demo role-switcher. The Program Officer cannot sign the Federal award — that authority belongs exclusively to the Grants Management Officer (`contracting_officer`).

## What they can do
- Access the Officer Dashboard (`/dashboard`) as a permitted role alongside `contracting_officer`, `contract_specialist`, `ssa`, and `sys_admin` (`app.routes.ts:routes`).
- Access the Reports Hub (`/reports`) for pipeline and spend visibility (`app.routes.ts:routes`).
- Initiate new grant applications via the wizard at `/grant-applications/new` (`app.routes.ts:routes`).
- Create and edit amendments at `/grant-applications/:id/amendments` (`app.routes.ts:routes`).
- Browse the vendor directory and vendor detail pages (`app.routes.ts:routes`).
- View and administer post-award contract records at `/contracts/:id/admin` (`app.routes.ts:routes`).
- Act as a co-owner of GATE_1 (Eligibility and Risk Review — Screening stage), able to issue `APPROVE`, `RETURN_FOR_FIXES`, or `REJECT` decisions on AI-drafted eligibility recommendations (`hitl.py:GATE_OWNER_ROLES`, `hitl.py:GATE_ALLOWED_DECISIONS`).
- Provide a mandatory written rationale (`rationale: str`, `min_length=1`) on every `GateDecisionRecord` they author (`hitl.py:GateDecisionRecord`).
- Release blocked UNGROUNDED AI responses at GATE_1 after reviewing escalation evidence (`hitl.py:GATE_OWNER_ROLES`, `hitl.py:EscalationRecord`).

## What they cannot do
- Sign the Federal award — the `authorityNote` in `ROLE_PROFILES` explicitly states "Cannot sign the Federal award." (`roles.ts:ROLE_PROFILES`). GATE_4 (`AWARD` stage) is owned exclusively by `GRANTS_OFFICER` and excludes `PROGRAM_OFFICER` (`hitl.py:GATE_OWNER_ROLES`).
- Access the Q&A triage route (`/grant-applications/:id/qa`) — that route is restricted to `contracting_officer` and `contract_specialist` only (`app.routes.ts:routes`).
- Access proposal intake (`/grant-applications/:id/proposals`) — restricted to `contracting_officer` and `contract_specialist` (`app.routes.ts:routes`).
- Access the evaluator workspace for merit scoring (`/peer-review/workspace`) — restricted to `evaluator`, `contracting_officer`, and `sys_admin` (`app.routes.ts:routes`).
- Access the consensus/SSDD surface (`/peer-review/:solId/consensus`) — restricted to `ssa` and `contracting_officer` (`app.routes.ts:routes`).
- Administer users or system configuration (`/admin/users`, `/admin/config`) — restricted to `sys_admin` only (`app.routes.ts:routes`).
- Search the audit log or track findings (`/admin/audit`, `/admin/findings`) — restricted to `sys_admin` and `oig_reviewer` (`app.routes.ts:routes`).
- Submit decisions at GATE_2 or GATE_3 — those gates are owned by `REVIEW_LEAD` and `HUMAN_REVIEWER` respectively (`hitl.py:GATE_OWNER_ROLES`).

## Constraints / authority limits
- **Single-agency scope:** `agencyId` is set to a non-null agency string (e.g., `'HHS-ACF'`), meaning the role is tenant-bound; cross-tenant access is structurally prevented by the `tenant_id` binding on all `GateDecisionRecord` and `EvidenceRef` objects (`hitl.py:GateDecisionRecord._validate_tenant_binding`).
- **JWT-derived identity:** in production, role is resolved from a validated JWT at the API gateway; the role-switcher in the frontend is a demo fixture only (`roles.ts:ROLE_PROFILES`).
- **Gate decision validation:** any `GateDecisionRecord` authored as `PROGRAM_OFFICER` at GATE_1 is validated by Pydantic against `GATE_ALLOWED_DECISIONS[GATE_1]` — decisions outside `{APPROVE, RETURN_FOR_FIXES, REJECT}` are rejected at schema level (`hitl.py:GateDecisionRecord._validate_decision_allowed`).
- **Tenant binding on evidence:** every `EvidenceRef` attached to a gate decision must carry the same `tenant_id` as the decision record; cross-tenant evidence is rejected at model validation (`hitl.py:GateDecisionRecord._validate_tenant_binding`).
- **Revision loop cap:** the AI revision loop is capped at 3 per gate; exceeding this cap requires a supervisor `override_flag`, not a Program Officer decision alone.
- **SLA:** GATE_1 decisions carry a 5-business-day SLA; breach triggers auto-escalation to supervisor and creates an `EscalationRecord` (`hitl.py:EscalationRecord`).
- **Audit trail immutability:** all `GateDecisionRecord` entries are append-only; the Program Officer cannot modify a prior decision (`hitl.py:GateDecisionRecord`).

## Impact on the system
The Program Officer is the primary internal authority for NOFO publication and the pre-award screening gate (GATE_1). If `PROGRAM_OFFICER` is removed from `GATE_OWNER_ROLES[GATE_1]` or from the `program_manager` route guards, the screening stage loses its domain-expert co-owner — all eligibility and risk determinations would fall solely to the Grants Officer, collapsing the two-person integrity principle at the earliest blocking gate. Downstream, AI-drafted eligibility recommendations that require domain expertise (2 CFR 200.205 risk assessment) would have no qualified human to release or reject them, causing every UNGROUNDED result to stall in escalation. The amendment workflow (`/grant-applications/:id/amendments`) would also lose its permitted initiator, blocking any post-award scope changes that originate from program-level decisions.

## Pain points
- The route guard for `/grant-applications/:id/qa` excludes `program_manager` (`app.routes.ts:routes`), meaning the Program Officer — who owns the NOFO and program scope — cannot directly access Q&A triage for their own grant applications. This is a likely workflow friction point requiring a workaround via another role. (Grounded in code.)
- The role-switcher maps `program_manager` to a display name in the fixture (`roles.ts:ROLE_PROFILES`), which conflates a role with an individual in cohort demos. In a migration that renames JWT claims (scheduled W4–W5 per `roles.ts:Role` comment), any mismatch between the legacy key and the new key would silently drop the Program Officer from all route guards and GATE_1 ownership simultaneously. (Grounded in code; migration-risk inference.)
- GATE_1 is co-owned by `GRANTS_OFFICER` and `PROGRAM_OFFICER` in the routing table (`hitl.py:GATE_OWNER_ROLES`) but the design reference lists both as co-owners without defining a tiebreak or quorum rule. If both reviewers disagree, there is no codified resolution path — a manual escalation gap. (Grounded in code; workflow inference.)
- The `program_manager` key is described as intentionally carrying an acquisition-era name that will be renamed in W4–W5 (`roles.ts:Role` comment). Until that rename lands, every occurrence of `'program_manager'` in route guards (`app.routes.ts:routes`) and the HITL enum (`hitl.py:GateOwnerRole`) must be updated atomically or the role loses access mid-cohort.

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `program_manager` member of the `Role` union type; inline comment maps it to "Program Officer (default; owns the program/NOFO)"
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `program_manager` entry: `agencyId: 'HHS-ACF'`, `authorityNote` cites 2 CFR 200.204-205, states "Cannot sign the Federal award"
- `frontend/src/app/models/roles.ts:RoleProfile` — interface defining `agencyId: string | null` (non-null = single-agency bound) and `authorityNote`
- `frontend/src/app/app.routes.ts:routes` — `roleGuard` applied to dashboard, reports, grant-applications/new, grant-applications/:id/amendments, vendors, contracts/:id/admin — all include `program_manager`; grant-applications/:id/qa, grant-applications/:id/proposals, peer-review/workspace, peer-review/:solId/consensus, admin/* — all exclude `program_manager`
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory producing `CanMatchFn`; unauthorized requests redirect to `/dashboard` or `/public/opportunities`
- `services/ai-orchestrator/app/schemas/hitl.py:GateOwnerRole` — `PROGRAM_OFFICER = "PROGRAM_OFFICER"` enum value
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_OWNER_ROLES` — `GateId.GATE_1` maps to `[GRANTS_OFFICER, PROGRAM_OFFICER]`; `GateId.GATE_4` maps to `[GRANTS_OFFICER]` only
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_ALLOWED_DECISIONS` — `GateId.GATE_1` allows `APPROVE`, `RETURN_FOR_FIXES`, `REJECT`
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord` — append-only audit model; `rationale` field min_length=1; `_validate_decision_allowed` validator; `_validate_tenant_binding` validator
- `services/ai-orchestrator/app/schemas/hitl.py:EscalationRecord` — created on SLA breach or UNGROUNDED result; `gate_owner_roles` links back to PROGRAM_OFFICER at GATE_1
- `docs/specs/agentic-workflow/design-reference.md` — responsibility lanes table: Program Officer listed as Human (HITL) lane owner; HITL gate table: GATE_1 owner includes `PROGRAM_OFFICER`, SLA 5 business days

## Reviewer lens
> The Program Officer holds role key `program_manager` (`roles.ts:Role`) mapped to `GateOwnerRole.PROGRAM_OFFICER` (`hitl.py:GateOwnerRole`). This persona is a co-owner of GATE_1 only (`hitl.py:GATE_OWNER_ROLES`) and is absent from GATE_4 (`hitl.py:GATE_OWNER_ROLES`), meaning they can approve, reject, or return applications during eligibility screening but can never issue the Federal award. Route guards in `app.routes.ts:routes` enforce access to dashboard, reports, grant-application creation, amendments, vendor directory, and contract admin, while Q&A triage, proposal intake, evaluator workspace, consensus surfaces, and all admin routes are blocked. All gate decisions must carry a non-empty written rationale and pass tenant-binding validation (`hitl.py:GateDecisionRecord`). The migration must preserve: (1) the `program_manager` role key atomically across `Role` union, `ROLE_PROFILES`, every route guard, and `GateOwnerRole` when the W4-W5 rename occurs; (2) co-ownership of GATE_1 with GRANTS_OFFICER; (3) explicit exclusion from GATE_4; (4) `agencyId` non-null single-agency scoping. Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.204 | NOFO publication requirements — Program Officer owns NOFO content |
| 2 CFR 200.205 | Pre-award risk review — merit review process owned by Program Officer |
| 2 CFR 200.334 | Records retention — 3-year minimum; 7 years when litigation or audit pending |
