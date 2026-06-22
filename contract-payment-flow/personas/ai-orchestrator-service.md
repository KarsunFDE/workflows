# Persona: AI Orchestrator (AWS Bedrock / LangChain Service)

- **Class:** internal · single-agency · service · trusted

## Summary

The AI Orchestrator is a Python/FastAPI microservice (port 8000) that acts as the
sole LLM/RAG/agent broker for the contract-payment-flow system. It receives
synchronous REST calls from the two Java services (ContractModification :8081 and
InvoiceReview :8082), dispatches prompts to AWS Bedrock (Anthropic Claude), runs a
multi-agent LangGraph triage workflow with a MongoDB-checkpointed HITL gate, and
returns AI-drafted narratives that a human CO/COR must review before any
irreversible write.

## What they can do

- Accept SF-30 modification-rationale drafting requests via `POST /draft-contract-modification` and return a Pydantic-validated `DraftResponse` with a non-null `clause_id` (`services/ai-orchestrator/app/main.py:177-219`)
- Draft bilateral supplemental-agreement narratives via `POST /draft-amendment` (FAR 43.103) (`services/ai-orchestrator/app/main.py:222-249`)
- Answer contractor administration questions with clause-library RAG via `POST /answer-qa` (`services/ai-orchestrator/app/main.py:252-278`)
- Serve hybrid RAG clause search over the FAR/DFARS corpus (Atlas Vector Search) via `POST /rag/clause-search` (`services/ai-orchestrator/app/main.py:281-314`)
- Generate invoice-review summary narratives (FAR 32.905 proper-invoice determination) via `POST /eval/ssdd-draft`, called by `AiOrchestratorClient.draftSsdd` (`services/ai-orchestrator/app/main.py:342-373`; `services/invoice-review-service/.../AiOrchestratorClient.java:35-40`)
- Suggest COR invoice-review narrative for flagged line items via `POST /eval/factor-suggest`, called by `AiOrchestratorClient.factorSuggest` (`services/ai-orchestrator/app/main.py:317-339`; `services/invoice-review-service/.../AiOrchestratorClient.java:44-48`)
- Validate FAR 32.905 required invoice elements deterministically (no LLM) via `POST /validate-invoice` (`services/ai-orchestrator/app/main.py:406-437`)
- Run the multi-agent triage LangGraph workflow (classify to route to anomaly-escalate to CO gate to submit/supersede) via `POST /workflow/triage` and `POST /workflow/triage/{thread_id}/resume` (`services/ai-orchestrator/app/workflow/router.py:125-251`)
- Pause the triage workflow at the CO hard gate (LangGraph `interrupt()`) and resume only on a validated CO decision (`services/ai-orchestrator/app/workflow/nodes_gate.py:76-101`, `131-176`)
- Perform deterministic contract-of-record lookup for SF-30 autofill via `POST /workflow/contract-lookup` (`services/ai-orchestrator/app/workflow/router.py:112-122`)
- Draft AI SF-30 wizard sections (rationale / price-cost) via `POST /draft-section`, traced via LangSmith when env is set (`services/ai-orchestrator/app/main.py:537-578`)
- Generate prompt templates for SF-30 modification rationale using `build_draft_prompt()` (`services/ai-orchestrator/app/contract_modification_prompts.py:27-45`)
- Fall back to a deterministic stub for all Bedrock endpoints when AWS credentials are absent (`services/ai-orchestrator/app/bedrock_client.py:92-94`, `130-136`)

## What they cannot do

- Self-authorize or self-elevate: the resume endpoint reads identity exclusively from gateway-asserted headers (`X-User-Id`, `X-User-Role`, `X-Tenant-Id`) and rejects body-supplied identity values (`services/ai-orchestrator/app/workflow/router.py:158-200`)
- Submit a modification without a confirmed CO actor identity; anonymous or blank actors are rejected fail-closed before any irreversible write (`services/ai-orchestrator/app/workflow/nodes_gate.py:55-73`, `214-258`)
- Bypass the CO hard gate: any CO decision value outside `{"approved","denied"}` routes to the terminal `supersede` (blocked) state, never to submit (`services/ai-orchestrator/app/workflow/nodes_gate.py:104-128`)
- Submit a bilateral modification without recorded contractor consent; consent is re-derived from the classified `mod_type` via FAR rules, not from a caller-supplied flag alone (`services/ai-orchestrator/app/workflow/nodes_gate.py:241-257`)
- Proceed when a package hash mismatch is detected at consent gate or submit; mismatch forces `supersede` (fail-closed) (`services/ai-orchestrator/app/workflow/nodes_gate.py:132-159`, `235-239`)
- Enforce CO role or agency at the Python layer; that enforcement lives in the upstream Java service per the nodes_gate comment (`services/ai-orchestrator/app/workflow/nodes_gate.py:37-38`)
- Sanitize user input before interpolating into prompts: `build_draft_prompt()` has a documented OWASP LLM01 (prompt injection) debt item and interpolates unsanitized input directly (`services/ai-orchestrator/app/contract_modification_prompts.py:4-22`, `40-45`)
- Forward correlation IDs to Bedrock or downstream callers (Item 6 brownfield debt) (`services/ai-orchestrator/app/main.py:29`)

## Constraints / authority limits

- Runs at internal port 8000; all production traffic must route through the API Gateway (:8080) -- direct browser access is dev-only CORS (`services/ai-orchestrator/app/main.py:88-97`)
- All Bedrock invocations are capped at 1024 tokens by default (`services/ai-orchestrator/app/bedrock_client.py:71`)
- Primary LLM model id is env-configurable (`BEDROCK_MODEL_ID`), defaulting to `anthropic.claude-3-7-sonnet-20250219-v1:0`; a stronger fallback model is used only on confidence failure per ADR-0006 (`services/ai-orchestrator/app/bedrock_client.py:43-51`)
- Embedding model is Titan V2 512d (ADR-0005 section 3); vector retrieval is scoped per `agency_id` / `GLOBAL_TENANT_ID` (`services/ai-orchestrator/app/config.py:43`, `66`)
- Workflow checkpoint state is stored in MongoDB (`contract_payment_flow` db); tenant isolation enforced by `agency_id` field on resume (`services/ai-orchestrator/app/workflow/router.py:218-225`)
- All high-consequence audit events (co_decision, modification_submitted, package_superseded) are recorded synchronously and fail-closed per ADR-0006 (`services/ai-orchestrator/app/workflow/nodes_gate.py:94-101`, `269-279`)
- Health endpoint is a shallow 200-always stub with no DB or Bedrock ping (brownfield debt) (`services/ai-orchestrator/app/main.py:168-174`)

## Impact on the system

The AI Orchestrator is the only path by which LLM-generated content (SF-30 rationale,
invoice-review summaries, factor-suggest narratives, triage classification) enters the
system. Removing it or changing its API contract would silence all AI-assisted drafting
in both Java services and break the multi-agent triage workflow that gates contract
modifications. The CO hard gate (`interrupt()` + resume) is the single enforcement
point for human-in-the-loop approval before any DRAFT-to-MODIFICATION_REQUEST
transition; if that gate is removed or bypassed in a migration, unreviewed AI drafts
could be submitted as contract modifications with no CO sign-off. The package-hash
binding between CO approval and the submit node would also be lost, removing the
tamper-evidence guarantee.

## Pain points

- `build_draft_prompt()` interpolates user input directly into the prompt body with no sanitization (OWASP LLM01 prompt-injection debt; brownfield item `ai-prompt-template-user-controlled`); a migration must not silently fix this without also flipping the locked failing test (`services/ai-orchestrator/app/contract_modification_prompts.py:4-22`)
- No correlation ID is forwarded into Bedrock calls or logged at the gateway (Item 6); multi-hop traces across Java to Python are invisible in the audit log (`services/ai-orchestrator/app/main.py:29`; `services/invoice-review-service/.../AiOrchestratorClient.java:16`)
- `AiOrchestratorClient` (Java side) has no circuit breaker on the RestTemplate; a Bedrock outage or orchestrator restart causes cascading failures in InvoiceReview without backpressure (Item 3 reinforcement) (`services/invoice-review-service/.../AiOrchestratorClient.java:15`)
- Health endpoint always returns 200 regardless of DB or Bedrock state; operators cannot distinguish a healthy from a broken-Bedrock service (`services/ai-orchestrator/app/main.py:168-174`)
- Several endpoints return raw `dict` without Pydantic response models (Item 4 drift), leaving downstream Java callers vulnerable to `NullPointerException` on missing keys (`services/ai-orchestrator/app/main.py:5-11`)
- Stub fallback is transparent to callers (no error signal when real Bedrock is unavailable), which can silently degrade AI quality without alerting the operator (`services/ai-orchestrator/app/bedrock_client.py:130-136`) -- inferred risk

## Evidence (file:line)

- `services/ai-orchestrator/app/main.py:73-104` -- FastAPI entrypoint, dev-only CORS config, router mounts (ingestion, retrieval, workflow)
- `services/ai-orchestrator/app/main.py:177-219` -- `POST /draft-contract-modification`, DraftResponse Pydantic model, Bedrock wiring
- `services/ai-orchestrator/app/main.py:317-373` -- `POST /eval/factor-suggest` and `POST /eval/ssdd-draft` with `hitl_gate` fields
- `services/ai-orchestrator/app/main.py:440-480` -- `POST /agent/intake-triage` sequential multi-agent flow
- `services/ai-orchestrator/app/main.py:537-578` -- `POST /draft-section` LangSmith-traced SF-30 wizard drafting
- `services/ai-orchestrator/app/contract_modification_prompts.py:27-45` -- `build_draft_prompt()` direct f-string interpolation (OWASP LLM01 debt)
- `services/ai-orchestrator/app/bedrock_client.py:43-53` -- `BEDROCK_MODEL_ID` / fallback model env config, region
- `services/ai-orchestrator/app/bedrock_client.py:70-127` -- `invoke_model()` boto3 InvokeModel + stub fallback
- `services/ai-orchestrator/app/workflow/router.py:42-251` -- `/workflow/triage` start + resume, tenant mismatch guard, CoDecision enum
- `services/ai-orchestrator/app/workflow/router.py:155-200` -- resume endpoint header identity enforcement, anonymous rejection
- `services/ai-orchestrator/app/workflow/nodes_gate.py:55-73` -- `_require_actor()` fail-closed identity validation
- `services/ai-orchestrator/app/workflow/nodes_gate.py:76-128` -- `co_gate_node`, `route_after_co_gate` strict enum check
- `services/ai-orchestrator/app/workflow/nodes_gate.py:131-176` -- `consent_gate_node` package-hash re-verification
- `services/ai-orchestrator/app/workflow/nodes_gate.py:214-279` -- `submit_node` consent re-derivation + hash re-verify
- `services/ai-orchestrator/app/config.py:23-66` -- MongoDB db name, embedding model, tenant config, confidence threshold
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/client/AiOrchestratorClient.java:14-48` -- calls `/eval/ssdd-draft` and `/eval/factor-suggest`; no circuit breaker, no correlation-id
- `README.md:73-96` -- architecture diagram showing the orchestrator as central non-human actor receiving calls from both Java services; service inventory with port 8000

## Reviewer lens

The AI Orchestrator is the system's sole LLM broker and the only enforcer of the
CO hard gate before a contract modification is irreversibly submitted
(`nodes_gate.py:76-128`). Its authority is bounded: it may draft narratives and
classify/triage items, but it cannot submit a modification without a verified,
non-anonymous CO actor (`nodes_gate.py:55-73`) and a package-hash match
(`nodes_gate.py:235-239`). Resume requests carry identity exclusively from
gateway-asserted headers -- body-supplied identity is never trusted
(`workflow/router.py:155-200`). RAG retrieval is tenant-scoped by `agency_id`
so one agency's AI cannot surface another agency's contract corpus
(`config.py:66`). Any migration plan must prove: (1) the CO hard gate interrupt
survives in the new runtime; (2) gateway header propagation of `X-User-Id`,
`X-User-Role`, and `X-Tenant-Id` is preserved end-to-end; (3) package-hash
binding between approval and submit is maintained; (4) the `hitl_gate` field on
all AI-draft endpoints remains visible to downstream callers; (5) the stub
fallback does not silently disable LLM calls in production. The prompt
injection debt (`contract_modification_prompts.py:40-45`) must not be silently
remediated without also flipping the locked test.
Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors

| Reg | Topic |
|-----|-------|
| FAR Part 43 | Contract modifications (SF-30), Changes clause, bilateral consent |
| FAR 43.103 | Bilateral vs. unilateral modification types; contractor consent requirement |
| FAR 32.905 | Proper invoice required elements; payment determination |
| FAR 15.308 | Source selection tradeoff narrative (SSDD) |
| FAR 31.205 | Unallowable costs flagged by invoice-review factor-suggest |
| 5 CFR 1315 | Prompt payment; due-date calculation in validate-invoice |
