# Persona: System Administrator

- **Role id:** `sys_admin`
- **Class:** internal · cross-tenant · human · trusted
- **Regulatory basis:** FedRAMP AC-2 (account management), AC-5 (separation of duties)

## Summary
The System Administrator is the platform-level operator who manages user accounts, role assignments, MFA enforcement, system configuration, and infrastructure observability across all tenant agencies. Unlike every other role, `sys_admin` carries a null `agencyId`, granting it unconditional access to all routes and data regardless of agency boundary. It is the only role that can provision or deprovision other users and rotate MFA credentials.

## What they can do
- Provision new users with any role and any `agencyId` across tenants (`admin-users.component.ts:93-103`, `AdminUserController.java:37-39`)
- Deprovision existing users (`admin-users.component.ts:109-111`)
- Assign and update role lists for any user (`AdminUserController.java:42-49`)
- Force MFA reset on any user (`admin-users.component.ts:105-107`, `AdminUserController.java:52-58`)
- Access every nav route unconditionally -- the sidebar filter short-circuits for `sys_admin` (`sidebar-nav.component.ts:118`)
- View and mutate System Configuration: vector store selection, clause library refresh, container image pin status (`admin-config.component.ts:1-82`, `app.routes.ts:131`)
- Access Audit Log Search and OIG Findings Tracker alongside `oig_reviewer` (`app.routes.ts:133-141`)
- Access Reports Hub, Vendor Directory, Invoice Review Workspace, and corpus upload (`app.routes.ts:40-42, 87-92, 105-111, 126-128`)

## What they cannot do
- Submit invoices or SF-30 acceptance -- those actions are scoped to `vendor` and `contracting_officer` respectively; `sys_admin` has no operational contracting authority under FAR
- Sign SF-30 modifications -- guarded exclusively to `contracting_officer` (`app.routes.ts:55-57`)
- Access the Vendor Portal (`/vendor/proposals`) -- guarded exclusively to the `vendor` role (`app.routes.ts:93-97`)
- Be provisioned with an `agencyId` -- the model sets this to `null` by design, preventing the role from being silently scoped to a single tenant (`roles.ts:29, 92-96`)

## Constraints / authority limits
- `agencyId` is always `null`; the cross-tenant scope is non-negotiable by model definition (`roles.ts:29, 92-96`)
- Route guard enforcement is client-side only in the current implementation -- `roleGuard` redirects unauthorized users but the backend `AdminUserController` relies on the `X-User` header with `defaultValue = "anonymous"`, meaning backend authorization is not validated server-side (`AdminUserController.java:38, 46, 54`)
- Debt Item 1 (JWT signature-skip on `/api/public/**`) bleeds into ops trust assumptions; an attacker exploiting Item 1 may bypass the downstream trust chain the admin endpoints rely on (`AdminUserController.java:13-18`)
- Actions taken through `AdminUserController` are actor-logged via the `X-User` header, which is caller-supplied and not cryptographically verified today (`AdminUserController.java:38, 46, 54`)

## Impact on the system
This role is the root of the RBAC trust hierarchy. Removing or misconfiguring `sys_admin` in a migration would break user provisioning, role assignment, and MFA enforcement -- effectively preventing new users from being onboarded and existing users from having credentials rotated. Because the sidebar bypass (`current === 'sys_admin'`) is a hard-coded unconditional grant, any migration that renames the role key without updating this predicate silently strips the administrator of all nav access. The backend controller's reliance on an unauthenticated `X-User` header means that if the migration introduces real JWT enforcement without migrating this controller, all admin provisioning calls break. FedRAMP AC-2 compliance depends on this role being functional and auditable.

## Pain points
- The `X-User` header is caller-supplied with no signature verification -- the audit trail for provisioning and MFA reset actions is untrustworthy until the backend enforces JWT identity (`AdminUserController.java:38, 46, 54`)
- Debt Item 1's JWT-skip creates an ambiguous trust boundary that `AdminUserController` explicitly acknowledges but does not fix, leaving the admin surface partially exposed to downstream trust contamination (`AdminUserController.java:13-18`)
- The admin-config screen lists Pinecone as an available vector store even though `import pinecone` is absent from all service code -- the sys_admin sees a config option that cannot work (`admin-config.component.ts:35-39`)
- Four of six container image pins show `:latest` in the sys_admin config view with no mechanism to update them from the UI -- the admin can observe the debt but cannot remediate it from within the application (`admin-config.component.ts:54-65`)
- Client-side-only route guards mean the sys_admin role boundary is enforced in the browser, not the API -- a migration adding real server-side RBAC must be coordinated across the frontend guard and every backend controller simultaneously or the admin will be either locked out or left without enforcement

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:20` -- `sys_admin` declared in the `Role` union type
- `frontend/src/app/models/roles.ts:29` -- `agencyId: string | null`; null means cross-tenant scope
- `frontend/src/app/models/roles.ts:92-96` -- `sys_admin` profile: `agencyId: null`, `authorityNote: 'Cross-tenant admin; provisioning + key rotation'`
- `frontend/src/app/shell/sidebar-nav.component.ts:118` -- `current === 'sys_admin'` short-circuit grants all nav links unconditionally
- `frontend/src/app/shell/sidebar-nav.component.ts:71-77` -- Admin nav group: User & Role Admin, System Config, Audit Log Search, OIG Findings Tracker -- exclusively or jointly `sys_admin`
- `frontend/src/app/components/admin-users/admin-users.component.ts:15-21` -- component doc: `sys_admin only`, FedRAMP AC-2, Debt Item 1 + Item 10 cross-tenant note
- `frontend/src/app/components/admin-users/admin-users.component.ts:93-111` -- `provision()`, `forceMfaReset()`, `deprovision()` methods
- `frontend/src/app/components/admin-config/admin-config.component.ts:5-16` -- component doc: `sys_admin only`, surfaces Debt Item 7 (phantom Pinecone) and Item 11 (image pins)
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:17-21` -- `@RestController`, `@RequestMapping("/api/admin/users")`, sys_admin scope doc
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:37-39` -- `provision()` endpoint
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:42-49` -- `updateRoles()` endpoint
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:52-58` -- `forceMfaReset()` endpoint
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/AdminUserController.java:38` -- `X-User` header `defaultValue = "anonymous"` -- actor identity unverified
- `frontend/src/app/app.routes.ts:130-131` -- `/admin/users` and `/admin/config` guarded exclusively by `roleGuard('sys_admin')`
- `frontend/src/app/app.routes.ts:133-141` -- audit and findings routes shared with `oig_reviewer`
- `frontend/src/app/services/role.guard.ts:15-25` -- `roleGuard` factory; unauthorized redirects to `/dashboard`

## Reviewer lens
The System Administrator (`sys_admin`) holds the only cross-tenant, null-`agencyId` role in the system (`roles.ts:92-96`). It bypasses all nav-link role filters unconditionally (`sidebar-nav.component.ts:118`) and is the exclusive gatekeeper for user provisioning, role assignment, and MFA reset (`AdminUserController.java:37-58`; `admin-users.component.ts:93-111`). The migration must preserve: (1) the `sys_admin` role key exactly as spelled -- the sidebar bypass predicate is a string comparison (`sidebar-nav.component.ts:118`); (2) the cross-tenant null-`agencyId` contract (`roles.ts:29, 92-96`); (3) the `/api/admin/users` endpoints and their FedRAMP AC-2 audit trail (`AdminUserController.java:17-21`); (4) exclusive route guard on `/admin/users` and `/admin/config` (`app.routes.ts:130-131`). Any server-side JWT enforcement added during migration must not silently block the `X-User`-based actor logging without a replacement audit mechanism -- otherwise provisioning actions become unattributable. The Debt Item 1 JWT-skip must not be resolved in isolation without simultaneously hardening `AdminUserController`'s trust assumptions (`AdminUserController.java:13-18`). Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FedRAMP AC-2 | Account management -- provisioning, deprovision, role assignment, MFA enforcement |
| FedRAMP AC-5 | Separation of duties -- sys_admin cannot simultaneously hold contracting authority |
