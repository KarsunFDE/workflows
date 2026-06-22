# Persona: Contract Specialist

- **Role id:** `contract_specialist`
- **Class:** internal · single-agency · human · trusted

## Summary
The Contract Specialist is an agency-scoped acquisition professional who prepares and drafts contract modifications (SF-30) for Contracting Officer review and signature. They sit directly below the Contracting Officer in the signing chain: they have full write access to the modification workflow but are explicitly barred from executing binding authority. The role is the system's default for new user provisioning, making it the widest-spread trusted-internal role.

## What they can do
- Access the Dashboard (`/dashboard`) (`sidebar-nav.component.ts:33`; `app.routes.ts:36`)
- View and navigate the Modifications Index (`/contractModifications`) (`sidebar-nav.component.ts:38`)
- Initiate and draft a New SF-30 Modification via the wizard (`/contractModifications/new`) (`sidebar-nav.component.ts:39`; `app.routes.ts:56`)
- Edit amendments on an existing modification (`/contractModifications/:id/amendments`) (`app.routes.ts:65`)
- Access Q&A triage on a modification (`/contractModifications/:id/qa`) (`app.routes.ts:70`)
- Access proposal intake on a modification (`/contractModifications/:id/proposals`) (`app.routes.ts:75`)
- Browse and view the Vendor/Contractor Directory (`/vendors`, `/vendors/:id`) (`sidebar-nav.component.ts:66`; `app.routes.ts:86, 91`)
- Receive system notifications about contract closeout events (`notification.service.ts:94`)
- Be provisioned as the default new-user role in the admin form (`admin-users.component.ts:91, 102`)

## What they cannot do
- Sign an SF-30 modification — binding signature authority is reserved for `contracting_officer` (`roles.ts:52`, citing FAR 1.603)
- Access the Invoice Queue (`/invoiceReviews`) — role absent from the nav entry and not in any roleGuard for that route (`sidebar-nav.component.ts:45`)
- Access the DCAA Audit Trail (`/admin/audit`) — restricted to `dcaa_auditor`, `oig_reviewer`, `contracting_officer` (`sidebar-nav.component.ts:46`; `app.routes.ts:134`)
- Access the Reports Hub (`/reports`) — `contract_specialist` not in the roleGuard list (`app.routes.ts:40`)
- Access Contract Admin (`/contracts/:id/admin`), CPAR Reviews, or Award Records — not in the sidebar role sets (`sidebar-nav.component.ts:52-54`)
- Access Corpus Upload (`/corpus/upload`) — restricted to `contracting_officer` and `sys_admin` (`app.routes.ts:127`)
- Access any Admin panel — all `/admin/*` routes restricted to `sys_admin` or `oig_reviewer` (`app.routes.ts:130-141`)

## Constraints / authority limits
- Scoped to a single agency (`agencyId: 'GSA-FAS'` in the role profile); cannot operate cross-tenant (`roles.ts:51`)
- Authority explicitly bounded by FAR 1.603: may draft but not sign modifications (`roles.ts:52`)
- Role is resolved from a JWT claim at the API gateway in production; current Debt Item 1 allows unsigned JWTs on `/api/public/*`, which indirectly affects downstream trust assumptions (`roles.ts:9-10`)
- MFA enrollment state is tracked at provisioning; new accounts start unenrolled (`admin-users.component.ts:98`)
- Role assignment is controlled exclusively by `sys_admin` via `/api/admin/users` (`AdminUserController.java:22, 42-49`)

## Impact on the system
The Contract Specialist is the primary author of the SF-30 modification workflow — the core post-award data object in the system. Because this role is also the default for new user provisioning, it is statistically the most common human actor. If the role's write access to `/contractModifications/new` and the amendment/QA/proposal sub-routes is broken during migration, the entire modification drafting pipeline halts. If the separation-of-duties wall between `contract_specialist` (draft) and `contracting_officer` (sign) collapses, the system would allow unsigned or self-signed modifications, violating FAR 1.603 and FedRAMP AC-5.

## Pain points
- The role has no access to the Reports Hub, Contract Admin, or CPAR surfaces — a specialist supporting closeout (as evidenced by the closeout notification at `notification.service.ts:94`) cannot view related CPAR or spend reports without a role upgrade, creating a handoff gap. (Inference from nav exclusion at `sidebar-nav.component.ts:52-54, 60`.)
- Being the default provisioned role means over-provisioned access for purely administrative staff who may not need modification drafting capability. (Inference from `admin-users.component.ts:91`.)
- Debt Item 1 (unsigned JWTs on `/api/public/*`) means the gateway trust boundary the specialist's session depends on is partially broken; role enforcement in production is partially circumventable until Item 1 is closed. (`roles.ts:9-10`.)

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:15` — `contract_specialist` declared in the `Role` union type
- `frontend/src/app/models/roles.ts:49-52` — `RoleProfile` entry: `agencyId: 'GSA-FAS'`, `authorityNote: 'Draft modifications; cannot sign SF-30 (FAR 1.603).'`
- `frontend/src/app/shell/sidebar-nav.component.ts:33` — included in Dashboard nav route roles
- `frontend/src/app/shell/sidebar-nav.component.ts:38` — included in Modifications Index nav route roles
- `frontend/src/app/shell/sidebar-nav.component.ts:39` — included in New SF-30 Modification nav route roles
- `frontend/src/app/shell/sidebar-nav.component.ts:45-46` — absent from Invoice Queue and DCAA Audit Trail route roles
- `frontend/src/app/shell/sidebar-nav.component.ts:66` — included in Contractor Directory nav route roles
- `frontend/src/app/app.routes.ts:36` — roleGuard on `/dashboard` includes `contract_specialist`
- `frontend/src/app/app.routes.ts:56` — roleGuard on `/contractModifications/new` includes `contract_specialist`
- `frontend/src/app/app.routes.ts:65` — roleGuard on `/contractModifications/:id/amendments` includes `contract_specialist`
- `frontend/src/app/app.routes.ts:70` — roleGuard on `/contractModifications/:id/qa` includes `contract_specialist`
- `frontend/src/app/app.routes.ts:75` — roleGuard on `/contractModifications/:id/proposals` includes `contract_specialist`
- `frontend/src/app/app.routes.ts:86-91` — roleGuard on `/vendors` and `/vendors/:id` includes `contract_specialist`
- `frontend/src/app/components/admin-users/admin-users.component.ts:91` — `newUser.role` defaults to `'contract_specialist'` in provision form
- `frontend/src/app/components/admin-users/admin-users.component.ts:98` — newly provisioned user starts with `mfaEnrolled: false`
- `frontend/src/app/components/admin-users/admin-users.component.ts:102` — form reset after provision restores default to `'contract_specialist'`
- `frontend/src/app/services/notification.service.ts:94` — `recipientRole: 'contract_specialist'` on a CLOSEOUT_INITIATED notification
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:22` — `/api/admin/users` endpoint declared; role assignment is sys_admin-scoped
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:42-49` — `PUT /{userId}/roles` endpoint controls role reassignment; actor header required

## Reviewer lens
> You are reviewing a modernization plan from the perspective of the Contract Specialist (`contract_specialist`), the primary drafter of SF-30 contract modifications.
>
> Authority (code-grounded):
> - May draft and submit new SF-30 modifications (`/contractModifications/new`, roleGuard at `app.routes.ts:56`).
> - May edit amendments, access Q&A triage, and intake proposals on existing modifications (`app.routes.ts:65, 70, 75`).
> - May browse the vendor directory (`app.routes.ts:86-91`).
> - Explicitly cannot sign modifications — FAR 1.603 separation encoded in `roles.ts:52`; the `contracting_officer` role is the sole signer.
>
> What the migration must preserve:
> 1. The write path to `/contractModifications/new` and all sub-routes (amendments, QA, proposals) must remain accessible to `contract_specialist` and blocked to roles not in the guard set.
> 2. The separation-of-duties wall between drafting (`contract_specialist`) and signing (`contracting_officer`) must survive any auth/gateway refactor. A migration that merges these roles or grants signing authority to drafters violates FAR 1.603 and FedRAMP AC-5.
> 3. Role provisioning default (`admin-users.component.ts:91, 102`) must remain `contract_specialist` unless the plan explicitly justifies a safer default — mass-defaulting to a higher-privilege role is a regression.
> 4. The `agencyId`-scoped trust boundary must be preserved; cross-tenant access is not in scope for this role (`roles.ts:51`).
> 5. Debt Item 1 (unsigned JWT bypass on `/api/public/*`, `roles.ts:9-10`) must not be widened by the migration; any new public surface that inherits Item 1's trust model extends the risk surface for all roles including this one.
>
> Flag any plan step that: removes or generalizes the roleGuard on modification routes; grants `contract_specialist` invoice or audit access without explicit FAR justification; collapses the CO/CS signing boundary; or introduces new public routes without closing Item 1.
>
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 1.603 | Contracting officer warrant — limits who may sign binding modifications; CS may only draft |
| FAR 43.102 | Modification execution authority — bilateral/unilateral mods require CO signature |
| FedRAMP AC-2 | Account management — provisioning and role-assignment controls |
| FedRAMP AC-5 | Separation of duties — draft vs. sign boundary enforcement |
