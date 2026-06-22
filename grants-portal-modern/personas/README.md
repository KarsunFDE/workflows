# Personas

Roles, not people. Each card is code-cited (Evidence sections point to `file:symbol` only — no raw line numbers). Cards feed `/fde-analyze` corroboration and `/fde-plan` review — the reviewer lens in each card is the default posture for plan evaluation (Default to REFUTE).

## Active Personas

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [Program Officer](./program-officer.md) | `program_manager` | internal · single-agency · human · trusted | Owns NOFO lifecycle and pre-award merit review; co-owns GATE_1; cannot sign the Federal award |
| [Grants Management Officer](./grants-management-officer.md) | `contracting_officer` | internal · single-agency · human · trusted | Signs the Federal award; sole GATE_4 owner; co-owns GATE_1; approves amendments (2 CFR 200.211/200.308) |
| [Peer Reviewer](./peer-reviewer.md) | `evaluator` | internal · single-agency · human · trusted | Scores assigned applications against NOFO merit criteria; owns GATE_3 as HUMAN_REVIEWER; COI attestation required |
| [Grantee / Principal Investigator](./grantee-principal-investigator.md) | `vendor` | external · single-agency · human · untrusted | External applicant: submits SF-424, views own proposals, acknowledges amendments, files CPAR rebuttal |
| [Inspector General (OIG Reviewer)](./oig-reviewer.md) | `oig_reviewer` | external · cross-tenant · human · trusted | Cross-agency read access; exclusive Finding-open authority (2 CFR 200.337) |
| [Grants Specialist](./grants-specialist.md) | `contract_specialist` | internal · single-agency · human · trusted | Drafts applications and award packages; no award signature authority; key rename pending W4–W5 |
| [Review Lead](./review-lead.md) | `REVIEW_LEAD` | internal · single-agency · human · trusted | Sole GATE_2 owner; resolves COI flags, removes reviewers, or overrides before panel confirmation |
| [Unauthenticated Public Visitor](./unauthenticated-public-visitor.md) | `public` | external · cross-tenant · human · untrusted | Read-only on `/api/public/opportunities`; no auth required; no write authority anywhere |

## Legacy / Cross-cutting Personas

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [Selecting Official (Legacy)](./selecting-official-legacy.md) | `ssa` | internal · single-agency · human · trusted | Non-delegable SSDD sign-off on merit-consensus surface; acquisition-baseline key scheduled for W4–W5 rename |
| [System Administrator](./system-administrator.md) | `sys_admin` | internal · cross-tenant · human · trusted | Cross-tenant user provisioning, role assignment, and MFA reset; exclusive `/admin/users` and `/admin/config` access |

## Service Personas

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [AI Orchestrator (Non-Human Service Agent)](./ai-orchestrator-service-agent.md) | (service — no JWT role key) | internal · single-agency · service · trusted | Programmatic control plane: enforces grounding thresholds, sequences four HITL gates, runs deterministic COI checks, writes append-only audit records — no authority to make final grant decisions |

## Ghost cards (verify)

The following files were present before the canonical schema migration. They are kept for reference but are superseded by the cards above. Verify that no feature code references these role descriptions before removing them.

| File | Status | Note |
|------|--------|------|
| [grants-officer.md](./grants-officer.md) | ghost — readme/comment-only evidence | Generic "Grants Officer" HITL gate concept; covered by `grants-management-officer.md` (role key `contracting_officer`) and `program-officer.md` (role key `program_manager`). Source: `docs/adrs/0005-*` only — no standalone role key in code. |
| [human-reviewer.md](./human-reviewer.md) | ghost — readme/comment-only evidence | Generic "Human Reviewer" GATE_3 concept; covered by `peer-reviewer.md` (role key `evaluator`) and the `HUMAN_REVIEWER` enum value in `hitl.py:38`. Source: `docs/adrs/0005-*` only — no standalone role key in code. |
| [grantee-pi.md](./grantee-pi.md) | superseded | Replaced by `grantee-principal-investigator.md` which carries canonical schema + full evidence. Old card had curated named-persona examples that have been removed per "roles not people" rule. |
| [selecting-official.md](./selecting-official.md) | superseded | Replaced by `selecting-official-legacy.md`. |
| [sys-admin.md](./sys-admin.md) | superseded | Replaced by `system-administrator.md`. |
| [public-visitor.md](./public-visitor.md) | superseded | Replaced by `unauthenticated-public-visitor.md`. |
