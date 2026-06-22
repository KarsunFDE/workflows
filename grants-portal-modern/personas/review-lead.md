# Persona: Review Lead

- **Role id:** `REVIEW_LEAD`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.205–200.206 (merit review and conflict-of-interest requirements)

## Summary
The Review Lead is the sole human authority for GATE_2, the Conflict of Interest gate in the PEER_REVIEW stage. This role sits between the AI-driven COI check and the panel-confirmation agent, and is the only role empowered to resolve flagged reviewer conflicts, remove reviewers, or override the COI check before the panel is confirmed.

## What they can do
- Issue any of the three GATE_2 decisions: `RESOLVE_AND_CONTINUE`, `REMOVE_REVIEWER`, or `OVERRIDE` against a flagged COI finding. (`hitl.py:GATE_ALLOWED_DECISIONS`)
- Block workflow advancement by issuing `REMOVE_REVIEWER`, which is classified as a blocking decision. (`hitl.py:GATE_BLOCKING_DECISIONS`)
- Receive escalated GATE_3 rejections — when a human reviewer rejects a factor-scoring narrative, the workflow escalates to the Review Lead. (`design-reference.md:8`)
- Approve the final panel composition record produced by the `panel-confirmation-agent` by supplying a `GateDecisionRecord` with `actor_role = REVIEW_LEAD`. (`hitl.py:GateDecisionRecord`, `agents.py:run_panel_confirmation`)
- Supply a mandatory written `rationale` (min_length=1) on every gate decision record. (`hitl.py:GateDecisionRecord`)
- Set `override_flag = True` on a `GateDecisionRequest` to release a workflow blocked by the revision-loop cap. (`design-reference.md:2`)

## What they cannot do
- Make decisions at GATE_1 (owned by `GRANTS_OFFICER` / `PROGRAM_OFFICER`), GATE_3 (owned by `HUMAN_REVIEWER`), or GATE_4 (owned by `GRANTS_OFFICER`) — the `_validate_decision_allowed` model validator will reject any attempt. (`hitl.py:GateDecisionRecord._validate_decision_allowed`)
- Self-resolve their own COI: the design spec states no agent (and by extension no gate owner) may self-resolve a COI finding. (`agents.py:run_coi_check`)
- Issue decisions outside `{RESOLVE_AND_CONTINUE, REMOVE_REVIEWER, OVERRIDE}` at GATE_2 — the schema validator raises `ValueError`. (`hitl.py:GateDecisionRecord._validate_decision_allowed`)
- Act on behalf of another tenant: every `GateDecisionRecord` carries a `tenant_id` and the `_validate_tenant_binding` validator enforces that all evidence refs share the same tenant. (`hitl.py:GateDecisionRecord._validate_tenant_binding`)
- Advance the workflow when the reviewer pool is fully exhausted — pool exhaustion escalates to `GRANTS_OFFICER`, bypassing the Review Lead. (`design-reference.md:8`)

## Constraints / authority limits
- 2-business-day SLA on GATE_2; breach triggers auto-escalation and an `EscalationRecord`. (`design-reference.md:2`)
- All decisions are append-only `GateDecisionRecord` entries; no correction or deletion path exists in the schema. (`hitl.py:GateDecisionRecord`)
- Evidence refs submitted with a decision must match the gate's `tenant_id` exactly. (`hitl.py:GateDecisionRecord._validate_tenant_binding`)
- The revision loop cap is 3 per gate; exceeding it requires a supervisor `override_flag`, not a standard Review Lead decision. (`design-reference.md:2`)
- Identity source is the auth principal; `tenant_id` is derived from the principal, not caller-supplied. (`design-reference.md:2`)
- GATE_2 confidence block threshold is 0.65 (floor only; GATE_2 is rule-based) — grounding failures at this gate still produce an `EscalationRecord` before the Review Lead is presented with the gate. (`design-reference.md:2`)

## Impact on the system
The Review Lead is the single control point that prevents a conflicted reviewer from participating in merit evaluation. If this role's constraints are removed or relaxed in a migration — for example by allowing any role to satisfy GATE_2, or by making `REMOVE_REVIEWER` non-blocking — COI flags raised by the deterministic `coi-check-agent` would either never be resolved or would be resolved by parties without the separation-of-duties authority required under 2 CFR 200.205. The panel-confirmation agent's output (`agents.py:240–248`) embeds the `gate_decision_id` from this gate, so any break in the GATE_2 chain would produce panel records with a dangling or absent audit link, corrupting the post-award audit trail sealed at GATE_4.

## Pain points
- The 2-business-day SLA with no in-system notification mechanism means breach detection depends on the external escalation path via `EscalationRecord` (`design-reference.md:2`); there is no proactive alert visible in the current design. (Inference: no notification endpoint found in `main.py` or `agents.py`.)
- `REMOVE_REVIEWER` is a blocking decision (`hitl.py:GATE_BLOCKING_DECISIONS`), but if all reviewers have COI the escalation bypasses the Review Lead entirely and goes to the Grants Officer (`design-reference.md:8`); the Review Lead has no visibility into this edge-case outcome.
- The written `rationale` field is enforced at schema level (`hitl.py:GateDecisionRecord`) but there is no free-text quality check — a single character satisfies the constraint, creating an audit-quality risk.
- GATE_3 rejections escalate back to the Review Lead (`design-reference.md:8`), but the Review Lead role has no GATE_3 decisions defined in `GATE_ALLOWED_DECISIONS` (`hitl.py:GATE_ALLOWED_DECISIONS`), meaning the escalation path described in the spec does not map to an executable gate decision — a likely gap between spec and implementation.

## Evidence (file:symbol)
- `services/ai-orchestrator/app/schemas/hitl.py:GateOwnerRole` — `REVIEW_LEAD` enum value in `GateOwnerRole`
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_OWNER_ROLES` — `GATE_2` maps exclusively to `[GateOwnerRole.REVIEW_LEAD]`; all other gates map to different roles
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_ALLOWED_DECISIONS` — `GATE_2` allowed decisions: `RESOLVE_AND_CONTINUE`, `REMOVE_REVIEWER`, `OVERRIDE`
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_BLOCKING_DECISIONS` — `REMOVE_REVIEWER` classified as a blocking decision for GATE_2
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord` — append-only audit model with `actor_role`, `rationale` (`min_length=1`), `override_flag`, `tenant_id`, `evidence_refs`
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord._validate_decision_allowed` — raises `ValueError` for out-of-scope decisions
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord._validate_tenant_binding` — enforces tenant isolation on evidence refs
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRequest` — request model for submitting a GATE_2 decision; mirrors `GateDecisionRecord` fields
- `services/ai-orchestrator/app/workflow/agents.py:run_panel_confirmation` — takes `gate_decision` and `gate_decision_id` from Review Lead's GATE_2 record; builds final panel audit record
- `services/ai-orchestrator/app/workflow/agents.py:run_coi_check` — deterministic four-rule COI screen; module docstring states no agent may self-resolve COI
- `docs/specs/agentic-workflow/design-reference.md:2` — GATE_2 SLA 2 business days, owner `REVIEW_LEAD`; SLA breach triggers auto-escalation and `EscalationRecord`
- `docs/specs/agentic-workflow/design-reference.md:8` — multi-agent panel flow; GATE_2 interrupt on non-empty `coi_flags`; GATE_3 `REJECT` escalation path; pool exhaustion escalates to Grants Officer

## Reviewer lens
> The Review Lead holds exclusive ownership of GATE_2 (Conflict of Interest, PEER_REVIEW stage), enforced by `GATE_OWNER_ROLES` (`hitl.py:GATE_OWNER_ROLES`). The only valid decisions are `RESOLVE_AND_CONTINUE`, `REMOVE_REVIEWER`, and `OVERRIDE` (`hitl.py:GATE_ALLOWED_DECISIONS`); the schema validator rejects any other decision at the model layer (`hitl.py:GateDecisionRecord._validate_decision_allowed`). `REMOVE_REVIEWER` is blocking (`hitl.py:GATE_BLOCKING_DECISIONS`). Every decision must carry a rationale and tenant-matched evidence refs (`hitl.py:GateDecisionRecord`, `hitl.py:GateDecisionRecord._validate_tenant_binding`). The panel-confirmation agent output is structurally dependent on the GATE_2 `gate_decision_id` (`agents.py:run_panel_confirmation`); without a valid GATE_2 record the panel audit chain is broken. A migration must preserve: (1) exclusive role assignment at GATE_2 with no substitution or bypass; (2) the blocking nature of `REMOVE_REVIEWER`; (3) tenant binding on all evidence refs; (4) the mandatory rationale field; (5) the append-only `GateDecisionRecord` shape required for post-award federal audit reconstruction under 2 CFR 200.334.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.205 | Federal agency review of risk posed by applicants — merit review and COI requirements |
| 2 CFR 200.206 | Federal agency suspension and debarment — reviewer eligibility |
| 2 CFR 200.334 | Retention requirements for federal grant records (3-year minimum; 7 years when audit pending) |
| 2 CFR 200.318(c) | Conflict of interest |
