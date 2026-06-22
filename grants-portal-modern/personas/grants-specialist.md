# Persona: Grants Specialist

- **Role id:** `contract_specialist`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.204–205, 2 CFR 200.211, 2 CFR 200.308

## Summary
The Grants Specialist is an internal, agency-scoped support role (HHS-ACF) that drafts grant applications and award packages on behalf of the agency. The role carries no signature authority: all final award actions require a Grants Management Officer (`contracting_officer`). It is inherited from an acquisition baseline and explicitly flagged as having no first-class grants equivalent yet; enum key `contract_specialist` is scheduled for rename/repurpose in W4–W5.

## What they can do
- Access the officer dashboard (`/dashboard`) alongside other internal roles. (`app.routes.ts:routes`)
- Create new grant applications via the wizard (`/grant-applications/new`). (`app.routes.ts:routes`)
- Edit existing grant applications (`/grant-applications/:id/edit` — unguarded, available to authenticated users).
- Author and manage amendments (`/grant-applications/:id/amendments`). (`app.routes.ts:routes`)
- Triage Q&A responses on a grant application (`/grant-applications/:id/qa`), including answering questions with status transitions (e.g., `AWAITING_CO_APPROVAL` → `PUBLISHED`). (`app.routes.ts:routes`)
- Drive proposal intake (`/grant-applications/:id/proposals`). (`app.routes.ts:routes`)
- Browse the vendor/grantee directory and individual vendor detail pages (`/vendors`, `/vendors/:id`). (`app.routes.ts:routes`)

## What they cannot do
- Sign the Federal award — the `authorityNote` explicitly states "cannot sign the Federal award" and the `contracting_officer` role holds that authority. (`roles.ts:ROLE_PROFILES`)
- Access the reports hub (`/reports`) — `contract_specialist` is absent from that route's allow-list. (`app.routes.ts:routes`)
- Access post-award contract administration (`/contracts/:id/admin`).
- Enter the peer-review evaluator workspace (`/peer-review/workspace`) or sign the SSDD consensus document (`/peer-review/:solId/consensus`).
- Manage platform admin surfaces: user provisioning (`/admin/users`), config (`/admin/config`), audit search (`/admin/audit`), or findings tracker (`/admin/findings`). (`app.routes.ts:routes`)
- Access the vendor portal (`/vendor/proposals`) — that is reserved for the `vendor` role.

## Constraints / authority limits
- Scoped to a single agency (`agencyId: 'HHS-ACF'`); cannot act cross-tenant. (`roles.ts:ROLE_PROFILES`)
- Role resolved from validated JWT at the API gateway in production; the mock role-switcher is for cohort instructor demos only.
- Q&A answers the role publishes transition status to `PUBLISHED`, but the audit trail shows the prior state was `AWAITING_CO_APPROVAL`, indicating a GMO approval step is embedded in the workflow before publication. (`mock-fixtures.ts:FIXTURE_AUDIT_EVENTS`)
- The `contract_specialist` enum key is inherited from an acquisition baseline and will be renamed in W4–W5; route guards and role checks depend on the current key string remaining stable until that refactor.

## Impact on the system
The Grants Specialist is the primary drafting actor in the pre-award pipeline. Removing or misconfiguring this role would block the creation of new grant applications (`/grant-applications/new`), block amendment authoring, and block Q&A triage — all of which are gated behind `contract_specialist` in the route allow-list. Because the role key `contract_specialist` is shared across route guards and the audit log, a rename or removal without coordinating the W4–W5 enum migration would silently deny access to every guarded route, breaking the pre-award workflow without a visible error beyond a redirect to `/dashboard`.

## Pain points
- The role has no first-class grants identity: it is a relabeled acquisition role (`contract_specialist`) with a grants-facing display name, creating a mismatch between the JWT claim and the conceptual persona that must be resolved in W4–W5. (Code-grounded: `roles.ts:Role`)
- Q&A answers must pass through a `AWAITING_CO_APPROVAL` state before publication, adding a hand-off dependency on the Grants Management Officer for every Q&A response — a potential bottleneck in active grant cycles. (`mock-fixtures.ts:FIXTURE_AUDIT_EVENTS`)
- The role is absent from the reports hub, meaning a Grants Specialist who drafts applications has no direct access to pipeline or spend reports without escalating to another role. (Inferred from route guard omission in `app.routes.ts:routes`.)
- The enum key rename scheduled for W4–W5 is a latent breaking change: any hard-coded string comparison against `'contract_specialist'` in guards, interceptors, or backend JWT claims will silently break if the rename is partial.

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `contract_specialist` member of the `Role` union type; comment noting no first-class grants equivalent (relabeled support/legacy persona)
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `contract_specialist` entry: `agencyId: 'HHS-ACF'`, `authorityNote: 'Drafts applications + award packages; cannot sign the Federal award'`
- `frontend/src/app/models/roles.ts:RoleProfile` — `agencyId: string | null` interface field; non-null = single-agency bound
- `frontend/src/app/app.routes.ts:routes` — `contract_specialist` present in `canMatch` guards for: dashboard, grant-applications/new, amendments, Q&A triage, proposal intake, vendors, vendors/:id; absent from reports, peer-review/workspace, peer-review/consensus, contracts/:id/admin, and all admin/* routes
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory enforcing role allow-list; unauthorized roles redirect to `/dashboard`
- `frontend/src/app/services/mock-fixtures.ts:FIXTURE_AUDIT_EVENTS` — audit event `ae-003`: actor with role `contract_specialist` performs `QNA.ANSWER` transitioning status from `AWAITING_CO_APPROVAL` to `PUBLISHED`

## Reviewer lens
> This persona holds role key `contract_specialist` (`roles.ts:Role`). Its authority is strictly drafting: it can create applications, author amendments, triage Q&A, and drive proposal intake — each enforced by `roleGuard` on the corresponding entries in `app.routes.ts:routes`. It cannot sign awards (`roles.ts:ROLE_PROFILES`), cannot access reports (route guard omits the role in `app.routes.ts:routes`), and cannot reach admin or OIG surfaces. Any migration that renames the `contract_specialist` enum key, removes it from route guard allow-lists, or changes the JWT claim mapping must preserve all six guarded routes for this role or pre-award drafting breaks silently. The Q&A workflow embeds a GMO approval dependency (`mock-fixtures.ts:FIXTURE_AUDIT_EVENTS`); the migration must not flatten that state machine.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.204–205 | NOFO publication and pre-award merit review requirements |
| 2 CFR 200.211 | Award terms and conditions (signing authority belongs to GMO) |
| 2 CFR 200.308 | Prior approval requirements for amendments |
