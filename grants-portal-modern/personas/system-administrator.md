# Persona: System Administrator

- **Role id:** `sys_admin`
- **Class:** internal · cross-tenant · human · trusted
- **Regulatory basis:** FedRAMP AC-2 (Account Management), FedRAMP AU-2 (Audit Events)

## Summary
The System Administrator is the platform-level operations role that spans all tenant agencies. It holds exclusive write access to user provisioning, role assignment, and MFA credential management across every agency in the system, and is the only non-OIG role that can reach the `/admin/users` and `/admin/config` surfaces.

## What they can do
- List all users across every agency (cross-tenant `listAll()`) or filter by a specific `agencyId` via `GET /api/admin/users`. (`UserService.java:listAll`)
- Provision new user accounts, setting `createdAt` and persisting to MongoDB. (`AdminUserController.java:provision`; `UserService.java:UserService`)
- Update the roles list on any existing user account via `PUT /api/admin/users/{userId}/roles`. (`AdminUserController.java:updateRoles`)
- Force an MFA reset on any user (sets `mfaEnrolled = false`) via `POST /api/admin/users/{userId}/mfa-reset`. (`AdminUserController.java:mfaReset`)
- Access the Angular `/admin/users` route — guarded exclusively to `sys_admin`. (`app.routes.ts:routes`)
- Access the Angular `/admin/config` route — guarded exclusively to `sys_admin`. (`app.routes.ts:routes`)
- Access `/admin/audit` and `/admin/findings` alongside `oig_reviewer`. (`app.routes.ts:routes`)
- Access officer dashboard, reports hub, grant-application creation, vendor directory, peer-review workspace, consensus/SSDD, and contract admin surfaces. (`app.routes.ts:routes`)

## What they cannot do
- Is not the only role that can read audit/findings — `oig_reviewer` shares those routes; sys_admin does not have exclusive audit authority. (`app.routes.ts:routes`)
- Cannot sign the Federal award — that authority belongs solely to `contracting_officer`. (`roles.ts:ROLE_PROFILES`)
- Cannot submit a grant application as a grantee — the `/vendor/proposals` route is exclusive to `vendor`. (`app.routes.ts:routes`)
- Cannot initiate amendments — the amendment route excludes `sys_admin`. (`app.routes.ts:routes`)
- Cannot access Q&A triage or proposal intake routes, which are restricted to `contracting_officer`/`contract_specialist` only. (`app.routes.ts:routes`)

## Constraints / authority limits
- `agencyId` is `null` by definition — the role is structurally cross-tenant with no agency scoping. (`roles.ts:ROLE_PROFILES`)
- All provisioning, role-update, and MFA-reset actions are recorded via `AuditLogger.recordAsync` with the actor identity; the audit trail is mandatory. (`UserService.java:UserService`)
- Roles and `agencyId` are resolved from the MongoDB `users` collection, not from JWT claims — the User entity is the authoritative source. (`User.java:User`; `UserService.java:UserService`)
- The `AdminUserController` carries `@CrossOrigin` with no origin restriction, a known brownfield-debt surface (`AdminUserController.java:AdminUserController`; `sec-cors-wildcard-credentials`, unlock W4).
- Route guard enforcement is client-side (`role.guard.ts:roleGuard`); server-side enforcement relies on Spring Security + the OAuth2 resource server, which currently has the JWT-signature-skip debt on `/api/public/**`. (`SecurityConfig.java:springSecurityFilterChain`)
- The mock role-switcher in `ROLE_PROFILES` is for instructor demos only; production RBAC resolves role from a validated JWT at the API gateway. (`roles.ts:ROLE_PROFILES`)

## Impact on the system
The sys_admin role is the sole cross-tenant provisioning authority. If its route guards or backend restrictions are removed or mis-scoped during a migration, every other role's RBAC integrity collapses: any user could be promoted to any role by anyone, MFA could be stripped silently, and the agency isolation enforced by `agencyId` on every other role becomes meaningless. The audit trail for USER_PROVISION, USER_ROLE_UPDATE, and USER_MFA_RESET events (`UserService.java:34, 44, 54`) is the only accountability record for these operations — losing it breaks FedRAMP AC-2 compliance.

## Pain points
- The `@CrossOrigin` annotation on `AdminUserController` with no origin restriction (`AdminUserController.java:AdminUserController`) means the provisioning surface is reachable from any origin today — a real ops risk that is scheduled but not yet fixed (brownfield `sec-cors-wildcard-credentials`, W4). (Code-grounded)
- The JWT-signature-skip debt on `/api/public/**` (`SecurityConfig.java:springSecurityFilterChain`) weakens the downstream trust model that the user-management surface depends on; an operator cannot fully trust the actor identity recorded in audit events until W4. (Code-grounded)
- `auditLogger.recordAsync` is used for all three admin actions, but async logging means audit events can be dropped under failure conditions before they are persisted — no synchronous audit guarantee exists today. (Inference from `UserService.java:UserService` async pattern)
- The `X-User` header that populates the `actor` field in audit logs is a plain string with a default of `"anonymous"` (`AdminUserController.java:provision`, `updateRoles`, `mfaReset`) — no cryptographic binding to the authenticated JWT, making audit attribution weak until the identity chain is tightened.

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `sys_admin` declared as a valid `Role` union member
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `sys_admin` entry: `agencyId: null`, `authorityNote: 'Cross-tenant admin; provisioning + key rotation'`
- `frontend/src/app/app.routes.ts:routes` — `/admin/users` and `/admin/config` guarded exclusively to `sys_admin`; `/admin/audit` and `/admin/findings` shared with `oig_reviewer`; all major officer/workflow routes include `sys_admin`
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory; unauthorized requests redirect to `/dashboard` or `/public/opportunities`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/AdminUserController.java:AdminUserController` — controller comment: "sys_admin scope (cross-agency)"; `@CrossOrigin` with no origin restriction (brownfield debt)
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/AdminUserController.java:provision` — `POST /api/admin/users`; creates user, fires async audit
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/AdminUserController.java:updateRoles` — `PUT /api/admin/users/{userId}/roles`; replaces roles list, fires async audit
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/AdminUserController.java:mfaReset` — `POST /api/admin/users/{userId}/mfa-reset`; sets `mfaEnrolled=false`, fires async audit
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/model/User.java:User` — entity storing `roles` (List), `agencyId`, `mfaEnrolled`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/service/UserService.java:UserService` — business logic: `provision`, `updateRoles`, `forceMfaReset`, `listAll`
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/service/UserService.java:listAll` — intentionally crosses tenants; comment confirms by spec
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/SecurityConfig.java:SecurityConfig` — `permitAll()` on all requests (brownfield debt); service-layer gate for admin endpoints is absent today
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/SecurityConfig.java:springSecurityFilterChain` — JWT-signature-skip on `/api/public/**` weakens downstream trust (brownfield Item 1)

## Reviewer lens
> This persona holds role key `sys_admin` (`roles.ts:Role`, `roles.ts:ROLE_PROFILES`). It is the only role permitted to reach `/admin/users` and `/admin/config` (`app.routes.ts:routes`). It is structurally cross-tenant (`agencyId: null` in `ROLE_PROFILES`); `UserService.listAll` intentionally returns users across all agencies. It can provision accounts (`AdminUserController.java:provision`), update any user's roles list (`AdminUserController.java:updateRoles`), and force MFA reset (`AdminUserController.java:mfaReset`). Every mutation is audit-logged via `AuditLogger.recordAsync` with the `actor` identity. The migration plan MUST demonstrate: (1) the exclusive `canMatch: [roleGuard('sys_admin')]` constraint on `/admin/users` and `/admin/config` survives in the target routing layer; (2) cross-tenant list access is preserved only for this role and no other; (3) the audit trail for USER_PROVISION, USER_ROLE_UPDATE, and USER_MFA_RESET is synchronously guaranteed or a safe async fallback is proven; (4) the `@CrossOrigin` wildcard debt (`AdminUserController.java:AdminUserController`) is resolved at or before W4 as scheduled; (5) the actor attribution chain is strengthened beyond the plain `X-User` header.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FedRAMP AC-2 | Account management — provisioning, deprovisioning, role assignment audit |
| FedRAMP AU-2 | Audit events — USER_PROVISION, USER_ROLE_UPDATE, USER_MFA_RESET must be logged |
