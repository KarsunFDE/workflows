# Human Reviewer (AI Gate Owner)

## Role
Generic gate authority at Gate 3 — typically a Program Officer or Peer Reviewer acting on AI-generated content.

## What They Do
- **Gate 3 owner**: accepts, edits, or rejects AI-generated evaluation factor suggestions
- Reviews AI narrative drafts for accuracy, grounding, and regulatory compliance
- Documents their decision (accept / edit / reject) before content enters the official record
- Ensures no AI output reaches award action without human sign-off

## What They Cannot Do
- Cannot bypass this gate — all AI factor suggestions must pass through human review
- Cannot accept AI output that is factually incorrect or ungrounded in application content

## Impact
- Last human checkpoint before AI-assisted content shapes merit scoring
- Accept-without-review is a compliance risk — OIG can challenge AI-sourced scoring rationale
- High volume role: every application with AI drafting triggers a Gate 3 review

## HITL Gate
Gate 3 — factor-suggest acceptance. The `hitl_gate` field returned by AI endpoints signals this review is required.

## Regulatory Anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.205 | Merit review process — human judgment required |

## Source
`docs/adrs/0005-hitl-gate-and-grounding-decision-contract.md:29`  
`services/ai-orchestrator/app/main.py` — all AI endpoints return `hitl_gate` field
