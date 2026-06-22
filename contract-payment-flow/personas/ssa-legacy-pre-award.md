# Persona: Source Selection Authority (SSA) -- Legacy Pre-Award

- **Role id:** `ssa`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** FAR 15.303, FAR 15.308

## Summary
The SSA is the designated federal official with authority to make the source selection decision at the conclusion of a competitive acquisition. In this codebase the role is carried forward from an inherited pre-award IA: it is not surfaced in the default post-award sidebar navigation but retains a valid authenticated session and owns the single non-delegable gate -- signing the Source Selection Decision Document (SSDD) to convert an evaluated proposal set into an award record.

## What they can do
- Access the `/dashboard` route (read-only landing) -- `app.routes.ts:36`
- Access the `/reports` route -- `app.routes.ts:41`
- Access `/invoiceReview/:solId/consensus` -- the SSDD tradeoff + sign screen; this is the SSA's exclusive write surface -- `app.routes.ts:110`
- Invoke AI-drafted SSDD narrative via the "AI-draft SSDD narrative" button and edit it before signing -- `consensus-ssdd.component.ts:58-59`
- Execute `sign()` to record the award transition (state: `AWAITING_SSA_SIGNATURE` to `AWARDED`) -- `consensus-ssdd.component.ts:112-114`, `mock-fixtures.ts:403`

## What they cannot do
- Sign the SSDD when not in the `ssa` role -- the sign button is disabled and a guard message is shown (`consensus-ssdd.component.ts:61-65`); the `sign()` method returns early if `currentRole !== 'ssa'` (`consensus-ssdd.component.ts:113`)
- Access any post-award sidebar navigation links (Dashboard, Modifications, Invoices & Payment, Contract Performance, Reports, Contractors, Admin) -- none of those `roles` arrays include `ssa` (`sidebar-nav.component.ts:31-76`)
- Delegate signing authority -- the SSDD screen explicitly notes "SSA authority non-delegable (FAR 15.303(b)(6))" (`consensus-ssdd.component.ts:25`, `consensus-ssdd.component.ts:65`)
- Access the SF-30 modification wizard, amendment editor, Q&A triage, proposal intake, invoice queue, DCAA audit trail, contract admin, CPAR reviews, corpus upload, or admin routes -- none of those `canMatch` guards include `ssa` (`app.routes.ts:57-145`)
- Access vendor directory or vendor detail routes -- `app.routes.ts:84-92`

## Constraints / authority limits
- Agency-scoped: `agencyId` is `'GSA-FAS'`; there is no cross-tenant elevation -- `roles.ts:76`
- Role is resolved from a mock JWT switcher in the current brownfield baseline; production RBAC is expected to validate from a real JWT in the API gateway -- `roles.ts:9-10`, `role-switcher.component.ts:14-15`
- Pre-award surfaces (public opportunity search, source-selection consensus/SSDD, vendor proposals) are intentionally excluded from the default post-award nav; they "exist as routes/components but are intentionally NOT in the default nav per the post-award reshape" -- `sidebar-nav.component.ts:23-26`
- SSA redirect landing on role-switch is `/dashboard`, not the SSDD surface -- `role-switcher.component.ts:49`
- The SSDD sign action is a frontend-only state mutation in the current codebase; there is no backend persistence guard for the `ssa` role check

## Impact on the system
The SSA is the only role that can close the source selection lifecycle by signing the SSDD and transitioning the award to `AWARDED` state. If this role constraint is removed or the non-delegability guard is relaxed during migration, any authenticated role could sign an award decision -- violating FAR 15.303(b)(6) and undermining the competitive acquisition record. In a post-award modernization that retains inherited pre-award routes, losing the SSA gate at `/invoiceReview/:solId/consensus` would silently break the audit trail that ties `SSDD.SIGN` events to an accountable federal official.

## Pain points
- The SSA has no visible navigation to reach their only write surface (`/invoiceReview/:solId/consensus`) -- it is absent from the sidebar because the nav was reshaped for post-award IA; the SSA must know the direct URL or be linked there (`sidebar-nav.component.ts:23-26`) -- inferred friction from the code comment.
- The `/dashboard` and `/reports` routes are accessible but neither surface shows SSA-relevant pre-award data; the SSA lands on a post-award officer dashboard with no actionable content for their role -- `role-switcher.component.ts:49`, `app.routes.ts:36`.
- The SSDD sign action has no backend enforcement of the `ssa` role check in the current brownfield -- the guard is frontend-only, meaning a backend migration that omits this check would create a silent privilege escalation path -- `consensus-ssdd.component.ts:112-113`.
- AI-drafted SSDD narrative carries a debt footnote ("Item 4 (no Pydantic schema), Item 5 (legacy LLMChain)") -- the SSA reviews AI output produced by a known-debt pipeline -- `consensus-ssdd.component.ts:109`.

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:23` -- `'ssa'` declared as a valid `Role` union member
- `frontend/src/app/models/roles.ts:74-78` -- `ROLE_PROFILES` entry: `agencyId: 'GSA-FAS'`, `authorityNote: 'Legacy source-selection authority (FAR 15.303). Pre-award role retained for inherited surfaces.'`
- `frontend/src/app/shell/sidebar-nav.component.ts:19-21` -- `ssa` included in `ALL_AUTHENTICATED`; comment confirms pre-award surfaces intentionally excluded from default nav
- `frontend/src/app/app.routes.ts:36` -- `ssa` in `canMatch` for `/dashboard`
- `frontend/src/app/app.routes.ts:41` -- `ssa` in `canMatch` for `/reports`
- `frontend/src/app/app.routes.ts:110` -- `ssa` exclusively gates `/invoiceReview/:solId/consensus` alongside `contracting_officer` and `sys_admin`
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:25` -- subtitle "FAR 15.308 · SSA authority non-delegable"
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:61-65` -- sign button disabled when `currentRole !== 'ssa'`; inline message cites FAR 15.303(b)(6)
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:112-113` -- `sign()` guard: early return if `currentRole !== 'ssa'`
- `frontend/src/app/services/mock-fixtures.ts:403` -- audit event `SSDD.SIGN` with `actorId: 'ssa-whitfield'`; state transition `AWAITING_SSA_SIGNATURE` to `AWARDED`
- `frontend/src/app/shell/role-switcher.component.ts:49` -- SSA redirect landing is `/dashboard`

## Reviewer lens
The SSA holds the sole, non-delegable authority to sign the SSDD and record an award (FAR 15.303(b)(6)), enforced at `consensus-ssdd.component.ts:61-65` and `:112-113`. The role is scoped to `agencyId: 'GSA-FAS'` (`roles.ts:76`) and is intentionally excluded from the default post-award sidebar nav (`sidebar-nav.component.ts:23-26`), accessible only via direct route `/invoiceReview/:solId/consensus` guarded by `roleGuard('ssa', ...)` (`app.routes.ts:110`). The current enforcement is frontend-only -- no backend role check is present. Any migration plan must (1) carry the SSA role key and non-delegability constraint into the backend authorization layer, (2) preserve the SSDD route guard so no other role can execute the AWARDED state transition, and (3) ensure the pre-award surfaces are discoverable to SSA users even if the post-award nav omits them. Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 15.303 | Source Selection Authority designation and non-delegable responsibilities |
| FAR 15.303(b)(6) | SSA signing authority is explicitly non-delegable |
| FAR 15.308 | Source Selection Decision Document (SSDD) content and signing requirement |
