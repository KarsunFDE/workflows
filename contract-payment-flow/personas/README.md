# Personas

Stakeholder/role definitions for the **contract-payment-flow** project. Each file describes a **role** — its
authority, what it can and cannot do, its constraints, and its impact on the system — so Claude can load any one
as a review lens (`/fde-plan`) or corroborate it against discovered code (`/fde-analyze`).

These are **roles, not people**. No named accounts are recorded; the demo fixtures in
`frontend/src/app/models/roles.ts` attach example display names for the instructor role-switcher — those are
intentionally omitted. Each card cites `file:line` code evidence and carries a `## Reviewer lens`.

> **Authoritative source:** `frontend/src/app/models/roles.ts` (the `Role` union + `ROLE_PROFILES`).
> Capabilities/constraints are corroborated against the route guards (`app.routes.ts`), the sidebar nav, and the
> AI orchestrator service.

---

## Active post-award roles

| Persona | Role id | Class | One-line authority |
|---|---|---|---|
| [Contracting Officer (CO)](./contracting-officer.md) | `contracting_officer` | internal · single-agency · human · trusted | Sole warranted official: signs SF-30 modifications, certifies payment, gates RAG corpus ingestion. |
| [Contracting Officer's Representative (COR)](./contracting-officers-representative.md) | `cor` | internal · single-agency · human · trusted | Default authenticated identity; drives the invoice three-way match that gates vendor payment. |
| [Contract Specialist](./contract-specialist.md) | `contract_specialist` | internal · single-agency · human · trusted | Drafts SF-30 modifications for CO signature; default new-user role; no binding authority. |
| [Program Manager](./program-manager.md) | `program_manager` | internal · single-agency · human · trusted | Technical owner; monitors CDRLs, drafts CPARs; no warrant, cannot sign or obligate. |

## Oversight / external audit

| Persona | Role id | Class | One-line authority |
|---|---|---|---|
| [DCAA Auditor](./dcaa-auditor.md) | `dcaa_auditor` | external · single-agency (DCAA) · human · trusted | Reviews cost-type invoices + incurred-cost; scoped to invoice-review/audit surfaces; no certify/modify. |
| [OIG Reviewer](./oig-reviewer.md) | `oig_reviewer` | external · cross-tenant · human · trusted | Cross-tenant read; exclusive audit-log + findings-tracker access; opens/track findings to closure. |

## Platform

| Persona | Role id | Class | One-line authority |
|---|---|---|---|
| [System Administrator](./system-administrator.md) | `sys_admin` | internal · cross-tenant · human · trusted | Null `agencyId`; user provisioning, MFA, config, all routes regardless of agency boundary. |
| [AI Orchestrator (Bedrock / LangChain Service)](./ai-orchestrator-service.md) | — | internal · single-agency · service · trusted | Python/FastAPI microservice; RAG clause retrieval over the CO-approved corpus. |

## External / public

| Persona | Role id | Class | One-line authority |
|---|---|---|---|
| [Vendor (Contractor Program Manager)](./vendor-contractor-pm.md) | `vendor` | external · single-agency · human · untrusted | Contractor-org PM; external party to invoices/proposals; no government authority. |
| [Public / Unauthenticated Visitor](./public-visitor.md) | `public` | external · cross-tenant · human · untrusted | Browses published opportunities; `agencyId: null`, no write; routed away from `/dashboard`. |

## Legacy pre-award (inherited, retained but not in post-award nav)

| Persona | Role id | Class | One-line authority |
|---|---|---|---|
| [Source Selection Authority (SSA)](./ssa-legacy-pre-award.md) | `ssa` | internal · single-agency · human · trusted | Owns the non-delegable SSDD signature; carried forward from the inherited pre-award IA. |
| [TEP Evaluator](./tep-evaluator-legacy-pre-award.md) | `evaluator` | internal · single-agency · human · trusted | Legacy source-selection evaluator; orphaned evaluator-workspace/consensus routes, no default nav. |
