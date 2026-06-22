# Persona: AI Orchestrator (Non-Human Service Agent)

- **Role id:** (service — no JWT role key; identified by service name `ai-orchestrator`)
- **Class:** internal · single-agency · service · trusted
- **Regulatory basis:** 2 CFR 200 (Uniform Administrative Requirements), 45 CFR 75 (HHS supplement), 2 CFR 200.206

## Summary
The AI Orchestrator is a FastAPI service (version `0.1.0-brownfield`, port 8000) that occupies the "Programmatic" and "AI" responsibility lanes in the grants-portal workflow. It drives assistive drafting and reasoning via AWS Bedrock (Claude Sonnet) and enforces grounding, gate, and tenant-isolation rules before any AI output reaches a human decision-maker. It has no authority to make final grant decisions; every consequential transition requires a human gate decision recorded in the audit trail.

## What they can do
- Draft grant application narratives, amendments, Q&A responses, factor suggestions, and SSDD award packages by invoking `invoke_model()` against AWS Bedrock. (`bedrock_client.py:invoke_model`)
- Run the three-agent peer-review panel pipeline: suggest ranked reviewers (`run_reviewer_assignment`), apply deterministic COI rules (`run_coi_check`), and confirm final panel composition (`run_panel_confirmation`). (`agents.py:run_reviewer_assignment`, `run_coi_check`, `run_panel_confirmation`)
- Compute grounding status (`GROUNDED`, `LOW_CONFIDENCE`, `UNGROUNDED`) against gate-differentiated confidence/faithfulness thresholds before advancing to a gate owner. (`grounding.py:compute_grounding_status`, `grounding.py:GATE_CONFIDENCE_THRESHOLDS`)
- Block workflow advancement when grounding status is `UNGROUNDED`, `MISSING_CITATIONS`, or `CITATION_CONFLICT` and create an `EscalationRecord` for the named gate owner. (`gate_enforcer.py:GateEnforcer.create_escalation`, `grounding.py:should_advance`)
- Record human gate decisions via `GateEnforcer.record_decision()` after validating actor role, allowed decision set, and tenant binding. (`gate_enforcer.py:GateEnforcer.record_decision`)
- Check whether a gate has a passing human decision for a given `ai_run_id` before allowing downstream workflow steps to proceed. (`gate_enforcer.py:GateEnforcer`)
- Emit structured `GroundedResponse` payloads carrying `hitl_gate`, `escalation_owner`, `requires_human_review`, and citation references to downstream consumers. (`hitl.py:GroundedResponse`)
- Serve retrieval (RAG/clause-search) over the 2 CFR 200 and 45 CFR 75 corpus via Atlas vector search, with a static corpus fallback. (`main.py:app`)
- Detect citation conflicts (same section cited by multiple regulations) and FAR/DFARS conflicts and flag them in `HumanReviewReason`. (`grounding.py:compute_grounding_status`)

## What they cannot do
- Make final grant award, rejection, or return-for-fixes decisions — all four HITL gates require a human actor with an authorized `GateOwnerRole`. (`hitl.py:GATE_OWNER_ROLES`)
- Self-resolve a Conflict of Interest flag — the `run_coi_check` agent applies deterministic rules only; resolution is reserved for `REVIEW_LEAD` at Gate 2. (`agents.py:run_coi_check`, `hitl.py:GATE_ALLOWED_DECISIONS`)
- Advance a gate that has received a blocking decision (`REJECT`, `DO_NOT_AWARD`, `RETURN_FOR_FIXES`, `REMOVE_REVIEWER`, `RETURN_TO_REVIEW`). (`hitl.py:GATE_BLOCKING_DECISIONS`)
- Override a revision loop cap (maximum 3 retries per gate) without a supervisor `override_flag` on `GateDecisionRequest`. (`design-reference.md:1`)
- Serve origins other than `http://localhost:4200` — CORS middleware is locked to that single origin. (`main.py:app`)
- Accept gate decisions from actors whose `actor_role` is not in `GATE_OWNER_ROLES` for the given gate — the enforcer raises `ValueError`. (`gate_enforcer.py:GateEnforcer._validate_or_raise`)

## Constraints / authority limits
- Tenant binding is an invariant: every `EvidenceRef` in a gate decision request must carry the same `tenant_id` as the gate request itself; mismatches raise `ValueError` and abort the decision. (`gate_enforcer.py:GateEnforcer._validate_or_raise`)
- Gate-differentiated confidence block floors: Gate 1/2 = 0.65, Gate 3/4 = 0.70; faithfulness floors mirror these values — AI output below the floor is hard-blocked. (`grounding.py:GATE_CONFIDENCE_THRESHOLDS`)
- `GateDecisionRecord.rationale` requires a non-empty string by schema — there is no silent or automatic approval path. (`hitl.py:GateDecisionRecord`)
- COI check is explicitly not AI judgment — it is four deterministic rules (org match, co-author 48-month window, competing NOFO, relationship placeholder). (`agents.py:run_coi_check`)
- Bedrock InvokeModel falls back to a stub when AWS credentials are absent, but the full gate/grounding enforcement pipeline still executes. (`bedrock_client.py:invoke_model`)
- No correlation-ID is propagated in log records or Bedrock calls (deliberate brownfield Item 6 — unfixed until W5). (`main.py:app`)
- Streaming is not implemented; `invoke_model` is a blocking call (deliberate brownfield Item `ai-bedrock-streaming-unhandled` — unfixed until W3). (`bedrock_client.py:invoke_model`)

## Impact on the system
The AI Orchestrator is the sole enforcement point for grounding thresholds, gate sequencing, tenant isolation in AI outputs, and COI detection. If its gate-enforcement rules are removed or bypassed in a migration, there is no other component that blocks ungrounded AI content from reaching grant officers, prevents award decisions from proceeding without a recorded human rationale, or enforces the tenant-binding invariant on evidence references. The three-agent peer-review pipeline (reviewer assignment, COI check, panel confirmation) has no equivalent elsewhere in the stack; removing it eliminates the only automated COI screening layer before human review. Any migration must replicate all four gate contracts, the grounding threshold table, the revision-loop cap, the tenant-binding check, and the append-only `GateDecisionRecord` audit trail or it will silently weaken the compliance posture of the entire grant lifecycle.

## Pain points
- No streaming on Bedrock calls means multi-section grant draft endpoints (5-20 s generations) block the UI until the full payload returns — acknowledged brownfield debt item `ai-bedrock-streaming-unhandled`, unfixed until W3. (`bedrock_client.py:invoke_model`)
- No correlation-ID in log output makes cross-service trace reconstruction impossible without manual log correlation — brownfield Item 6, unfixed until W5 OTel work. (`main.py:app`)
- Four endpoints (`/draft-grant-application`, `/draft-amendment`, `/answer-qa`, `/eval/ssdd-draft`) return raw dicts with no Pydantic `response_model`, causing downstream Spring services to hit `NullPointerException` on null fields — brownfield Item 4, unfixed until W1 Fri. (`main.py:draft_grant_application`)
- Legacy `LLMChain(...).run(...)` pattern still active in `legacy_chain.py` and invoked from three entry points; creates dual-chain maintenance burden — brownfield Item 5, unfixed until W2. (`main.py:app`)
- Relationship-based COI rule (Rule 4) is a placeholder requiring external HR data that is not yet integrated, meaning potential relationship-based conflicts are silently skipped. (`agents.py:run_coi_check` — inference from placeholder comment)

## Evidence (file:symbol)
- `services/ai-orchestrator/app/main.py:app` — FastAPI app instantiated as `title="ai-orchestrator"`, `version="0.1.0-brownfield"`; CORS origin locked to `http://localhost:4200`; gates, retrieval-v2, and workflow routers registered
- `services/ai-orchestrator/app/main.py:draft_grant_application` — POST `/draft-grant-application`; deliberate raw-dict return, 1-in-3 null `clause_id` (brownfield Item 4)
- `services/ai-orchestrator/app/main.py:health` — shallow health check, always 200, no DB/Bedrock probe
- `services/ai-orchestrator/app/workflow/agents.py:run_reviewer_assignment` — decorated with LangSmith `traceable`, tags `["multi-agent", "reviewer-panel"]`
- `services/ai-orchestrator/app/workflow/agents.py:run_coi_check` — tagged `["multi-agent", "coi-deterministic"]`; docstring states "NOT AI judgment"; four deterministic rules
- `services/ai-orchestrator/app/workflow/agents.py:run_panel_confirmation` — tagged `["multi-agent", "panel-confirmation"]`; writes audit record; module docstring states no agent may self-resolve COI
- `services/ai-orchestrator/app/schemas/hitl.py:GroundedResponse` — schema: `hitl_gate`, `escalation_owner`, `requires_human_review`, `ai_run_id`
- `services/ai-orchestrator/app/schemas/hitl.py:GateDecisionRecord` — append-only audit record; `actor_role` typed as `GateOwnerRole`; `rationale` required (`min_length=1`); ADR 0009 §10 audit-replay fields
- `services/ai-orchestrator/app/schemas/hitl.py:GateOwnerRole` — enum of four human actor roles authorized to issue gate decisions
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_OWNER_ROLES` — routing table maps each gate to authorized human roles only
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_ALLOWED_DECISIONS` — allowed decision values per gate
- `services/ai-orchestrator/app/schemas/hitl.py:GATE_BLOCKING_DECISIONS` — decisions that block workflow advancement
- `services/ai-orchestrator/app/schemas/hitl.py:HumanReviewReason` — enum of escalation reason codes including `REVISION_LOOP_EXCEEDED`
- `services/ai-orchestrator/app/services/grounding.py:GATE_CONFIDENCE_THRESHOLDS` — per-gate hard-block confidence floors (Gate 1/2: 0.65, Gate 3/4: 0.70)
- `services/ai-orchestrator/app/services/grounding.py:compute_grounding_status` — tiered confidence/faithfulness evaluation per gate; returns `GroundingStatus` and reason list
- `services/ai-orchestrator/app/services/grounding.py:should_advance` — gate-block predicate; returns `False` for `UNGROUNDED`, `MISSING_CITATIONS`, `CITATION_CONFLICT`
- `services/ai-orchestrator/app/services/gate_enforcer.py:GateEnforcer` — main enforcer class; orchestrates gate validation and audit trail
- `services/ai-orchestrator/app/services/gate_enforcer.py:GateEnforcer.record_decision` — validates role, decision, tenant binding before persisting
- `services/ai-orchestrator/app/services/gate_enforcer.py:GateEnforcer._validate_or_raise` — rejects wrong role, wrong decision, and tenant-binding violations with `ValueError`
- `services/ai-orchestrator/app/services/gate_enforcer.py:GateEnforcer.create_escalation` — creates `EscalationRecord` routed to gate owner roles; no silent retries
- `services/ai-orchestrator/app/bedrock_client.py:invoke_model` — blocking InvokeModel wrapper; no streaming; stub fallback on missing creds (debt `ai-bedrock-streaming-unhandled`)
- `services/ai-orchestrator/app/bedrock_client.py:BEDROCK_MODEL_ID` — model pinned to `anthropic.claude-3-7-sonnet-20250219-v1:0`; overrideable via env var
- `docs/specs/agentic-workflow/design-reference.md:1` — Responsibility Lanes table: Programmatic = `ai-orchestrator` control plane; AI = Claude Sonnet, assistive only, no autonomous final decisions

## Reviewer lens
> This persona is the `ai-orchestrator` control-plane service (FastAPI, `version="0.1.0-brownfield"`, port 8000). Its authority is strictly programmatic: it enforces grounding thresholds (`GATE_CONFIDENCE_THRESHOLDS` in `grounding.py`), sequences four HITL gates (`GATE_OWNER_ROLES` / `GATE_ALLOWED_DECISIONS` in `hitl.py`), runs deterministic COI checks (`run_coi_check` in `agents.py`), and writes append-only `GateDecisionRecord` audit records (`GateEnforcer.record_decision` in `gate_enforcer.py`). It has zero authority to issue a final grant decision — every gate advance requires a human actor with a named `GateOwnerRole` and a non-empty rationale enforced by `GateEnforcer._validate_or_raise`. Tenant isolation is a hard invariant: mismatched `tenant_id` on any `EvidenceRef` raises an exception and aborts the decision. The revision-loop cap (3 per gate; supervisor `override_flag` required to exceed) and the COI self-resolution prohibition must survive the migration. The migration plan must demonstrate: (1) all four gate contracts and their blocking-decision tables are preserved; (2) grounding threshold floors are re-implemented at the same numeric values per gate; (3) the tenant-binding check is preserved on every gate decision; (4) COI deterministic rules remain non-AI; (5) the append-only audit record structure is maintained per 2 CFR 200.334.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200 | Uniform Administrative Requirements, Cost Principles, and Audit Requirements for Federal Awards — primary corpus for clause-search and citation grounding |
| 45 CFR 75 | HHS supplement to 2 CFR 200 — cross-regulation conflict detection in grounding service |
| 2 CFR 200.206 | Risk evaluation of applicants — referenced in eligibility check endpoint schema |
