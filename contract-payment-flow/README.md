# Personas

Roles, not people. Each card is code-cited. Cards feed `/fde-analyze` corroboration and `/fde-plan` review.

Every persona was derived from code evidence (role keys, route guards, nav filters, model fields, service endpoints). Evidence citations follow the format `file:line`. No named accounts appear in any card. The reviewer lens in each card is a ready-to-use system prompt for `/fde-analyze` and `/fde-plan`.

---

## Active post-award roles

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [Contracting Officer (CO)](./contracting-officer.md) | `contracting_officer` | internal · single-agency · human · trusted | Sole warranted official; signs SF-30 mods, certifies invoices for payment, gates RAG corpus ingestion (FAR 1.602-1 / 42.302 / 43.103) |
| [Contracting Officer's Representative (COR)](./contracting-officers-representative.md) | `cor` | internal · single-agency · human · trusted | Accept deliverables and receiving reports, run FAR 32.905 proper-invoice checklist, recommend payment; cannot obligate funds (FAR 42.302 / 46.5) |
| [Contract Specialist](./contract-specialist.md) | `contract_specialist` | internal · single-agency · human · trusted | Drafts SF-30 modifications and accesses the full modification sub-workflow; explicitly cannot sign (FAR 1.603); default new-user role at provisioning |
| [Program Manager](./program-manager.md) | `program_manager` | internal · single-agency · human · trusted | Requirements owner and CPAR drafter (FAR 42.1503); no warrant, cannot obligate funds or sign SF-30 |
| [DCAA Auditor](./dcaa-auditor.md) | `dcaa_auditor` | external · single-agency (DCAA) · human · trusted | External DCAA auditor; reviews cost-type invoices, flags unallowable costs (FAR 31.205) and defective pricing (FAR 42.1); no payment-certification or modification authority |
| [Vendor (Contractor PM)](./vendor-contractor-pm.md) | `vendor` | external · single-agency · human · untrusted | External contractor PM -- submit invoices + WAWF payment requests, acknowledge SF-30 mods, 60-day CPAR rebuttal (FAR 42.1503(d)) |

## Cross-tenant / platform roles

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [OIG Reviewer](./oig-reviewer.md) | `oig_reviewer` | external · cross-tenant · human · trusted | GSA-OIG auditor; cross-tenant read + exclusive findings-open authority; gated to /admin/audit and /admin/findings |
| [System Administrator](./system-administrator.md) | `sys_admin` | internal · cross-tenant · human · trusted | Cross-tenant platform admin; exclusive provisioning, role assignment, MFA reset, and system config authority (FedRAMP AC-2) |
| [Public / Unauthenticated Visitor](./public-visitor.md) | `public` | external · cross-tenant · human · untrusted | Read-only on /public/opportunities (list + detail); no write surface; JWT signature validation bypassed on /api/public/** (Debt Item 1) |

## Legacy pre-award roles (inherited, intentionally nav-stranded)

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [Source Selection Authority (SSA)](./ssa-legacy-pre-award.md) | `ssa` | internal · single-agency · human · trusted | Non-delegable SSDD signing authority (FAR 15.303/15.308); gates AWAITING_SSA_SIGNATURE to AWARDED transition on the inherited pre-award surface |
| [TEP Evaluator](./tep-evaluator-legacy-pre-award.md) | `evaluator` | internal · single-agency · human · trusted | Legacy FAR 15.305 TEP evaluator; authenticated but zero post-award nav; deprecated data interfaces retained for cohort repurposing |

## Service / non-human actors

| Persona | Role id | Class | One-line authority |
|---------|---------|-------|--------------------|
| [AI Orchestrator](./ai-orchestrator-service.md) | (service) | internal · single-agency · service · trusted | Sole LLM/RAG/agent broker; enforces the CO hard gate before any irreversible contract-modification write |

---

## Ghost personas (evidence is README/comment-only -- verify before use)

None. All cards above carry direct code evidence (roles.ts union member, route guard, nav entry, or service endpoint). The `ssa` and `evaluator` cards are marked confidence 0.85 because their authority is frontend-only with no confirmed backend enforcement; treat their reviewer lenses as requiring server-side verification before migration sign-off.
