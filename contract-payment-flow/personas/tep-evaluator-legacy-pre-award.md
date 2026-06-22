# Persona: Technical Evaluation Panel Evaluator -- Legacy Pre-Award

- **Role id:** `evaluator`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** FAR 15.305 (Proposal evaluation)

## Summary
The TEP Evaluator is a legacy pre-award source-selection role inherited from an earlier acquisition surface. Within the current post-award system the role is retained in the role type union and the ALL_AUTHENTICATED roster but receives no default sidebar navigation entries; its working surface (evaluator-workspace, consensus-ssdd) exists as orphaned routes that the W3 cohort may repurpose for a multi-agent review surface.

## What they can do
- Authenticate and hold a valid JWT `role` claim of `evaluator` within the single-agency boundary (agencyId `GSA-FAS`), granting membership in the ALL_AUTHENTICATED set (`roles.ts:18-21`).
- Access any route or component that permits the full authenticated set with an empty `roles: []` guard, because the sidebar filter treats an empty roles array as visible to all authenticated users (`sidebar-nav.component.ts:11`).
- Score proposals against Section M evaluation factors by populating `InvoiceReviewScore` (factorId, score, narrative) tied to `InvoiceReviewFactor` weights (`invoice-review.ts:77-94`), on whichever inherited evaluator-workspace routes still exist in the router.

## What they cannot do
- Access any named sidebar nav link in the current post-award IA: the evaluator role is absent from every `roles: Role[]` array in the NAV constant (`sidebar-nav.component.ts:27-78`), so `recompute()` produces an empty `visibleGroups` array and the evaluator sees no navigation at all.
- Reach Invoice Queue, DCAA Audit Trail, Contract Admin, CPAR Reviews, Award Record, or Reports routes, because those links restrict to explicit post-award roles that do not include `evaluator` (`sidebar-nav.component.ts:45-61`).
- Obligate funds, sign modifications, certify invoices, or perform any post-award payment action -- none of those capabilities are assigned in `authorityNote` and no route guard names the evaluator role for those surfaces (`roles.ts:80-84`).
- The `InvoiceReviewFactor` and `InvoiceReviewScore` interfaces it depends on are `@deprecated` and carry no runtime enforcement path in the current FAR 32 payment spine (`invoice-review.ts:77-94`).

## Constraints / authority limits
- Agency-scoped: `agencyId` is `GSA-FAS`; the role carries no cross-tenant flag (`roles.ts:80-84`).
- Authority is bounded to FAR 15.305 (proposal evaluation) -- the authorityNote explicitly marks it as a legacy pre-award retention, not a post-award grant (`roles.ts:83`).
- Identity source is the mock role-switcher in the demo harness; production authority resolves from a validated JWT at the API gateway (`roles.ts:8-10`).
- The evaluator-workspace surface is intentionally excluded from default nav per the post-award reshape decision documented in the sidebar comment (`sidebar-nav.component.ts:23-26`).
- No approval bindings exist in code for this role -- it has no write-path route guards in the current post-award spine.

## Impact on the system
The evaluator role is a structural dead-weight in the current system: it is declared in the `Role` union and included in ALL_AUTHENTICATED but has zero visible navigation and its data interfaces are deprecated. If the role and its associated interfaces (`InvoiceReviewFactor`, `InvoiceReviewScore`) are removed in a migration without first confirming that no W3 cohort repurposing has begun, the consensus-ssdd and evaluator-workspace routes (which the sidebar comment explicitly preserves for OQ-4 reuse) will lose their type contracts. The `evaluatorId` and `evaluatorName` fields on `InvoiceReviewScore` represent a person-binding that a future multi-agent surface may need for audit attribution -- stripping the interfaces breaks that lineage even if the routes are gone.

## Pain points
- The evaluator role sees a completely blank sidebar after login with no explanation -- there is no error message or redirect (`sidebar-nav.component.ts:113-121`). (Observed from nav filter logic; UX inference.)
- The pre-award data model (`InvoiceReviewFactor`, `InvoiceReviewScore`) is deprecated but still compiled; any future type-narrowing refactor of `invoice-review.ts` risks breaking evaluator-workspace components silently. (`invoice-review.ts:77-94`)
- Role is listed in the role-switcher tooltip surface with an authorityNote but that tooltip is the only visible affordance -- there is no landing page or guidance for an evaluator who authenticates. (Inference from `ROLE_PROFILES` at `roles.ts:80-84` and absent nav entries.)
- The boundary between "kept for cohort repurposing" and "safe to delete in migration" is undocumented beyond a single sidebar comment (`sidebar-nav.component.ts:23-26`), creating migration ambiguity.

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:24` -- `evaluator` declared in the `Role` union type
- `frontend/src/app/models/roles.ts:80-84` -- `RoleProfile` entry: agencyId `GSA-FAS`, authorityNote cites FAR 15.305, marks role as legacy pre-award retention
- `frontend/src/app/shell/sidebar-nav.component.ts:18-21` -- `evaluator` included in ALL_AUTHENTICATED constant
- `frontend/src/app/shell/sidebar-nav.component.ts:23-26` -- comment explicitly marks evaluator-workspace as inherited pre-award surface intentionally excluded from default nav (OQ-4)
- `frontend/src/app/shell/sidebar-nav.component.ts:27-78` -- NAV constant: zero nav links carry `evaluator` in their `roles` array
- `frontend/src/app/shell/sidebar-nav.component.ts:113-121` -- `recompute()` will yield empty `visibleGroups` for the evaluator role
- `frontend/src/app/models/invoice-review.ts:77-83` -- `InvoiceReviewFactor` marked `@deprecated`, retained for consensus-ssdd / evaluator-workspace
- `frontend/src/app/models/invoice-review.ts:85-94` -- `InvoiceReviewScore` marked `@deprecated`, carries `evaluatorId`/`evaluatorName` fields for attribution

## Reviewer lens
The TEP Evaluator (`evaluator`, `roles.ts:24`) holds a GSA-FAS-scoped, FAR 15.305 pre-award authority that is intentionally stranded in the post-award system. The role is authenticated (`sidebar-nav.component.ts:18-21`) but receives no navigation (`sidebar-nav.component.ts:27-78`). Its data contracts -- `InvoiceReviewFactor` and `InvoiceReviewScore` -- are deprecated but compiled and explicitly retained for a future cohort repurposing surface (`invoice-review.ts:77-94`, sidebar comment at `sidebar-nav.component.ts:23-26`). A migration plan must prove: (1) the deprecated interfaces are either preserved or their removal is coordinated with any W3 evaluator-workspace routes; (2) the `evaluator` role key is not silently dropped from the JWT claim space before the repurposing decision is made; (3) the blank-nav failure mode for an authenticated evaluator is either resolved or the role is formally retired with a documented decision. Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 15.305 | Proposal evaluation -- basis for TEP evaluator authority |
| FAR 15.303 | Source Selection Authority -- sister pre-award role (`ssa`) context |
