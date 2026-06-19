# Persona: System Administrator (sys_admin)

**Authority level:** Platform-wide, cross-tenant. Highest-privilege role — and the top spoofing target.

## Role
Maintains operational integrity across all tenant agencies: keeps the FAR/DFARS corpus current,
manages user accounts and roles cross-tenant, and monitors the full system audit trail.

## What they can do
- Write the **unscoped global FAR corpus** — the corpus every tenant retrieves for SF-30 drafting
  (the only role allowed to do this).
- Provision users cross-agency; assign/revoke roles; force MFA resets for any user.
- Search and export the full cross-agency audit trail (`/admin/audit`).
- Operate without a mandatory `agency_id` constraint (only role for which blank agency is legal).

## Impact
- Sole writer of the global corpus — a tenant-isolation boundary depends on this staying restricted.
- Cross-tenant visibility into users and audit is intentional and must be preserved for this role only.
- Because of its power, the `sys_admin` role token is the single highest-value spoofing vector;
  the gateway strips and re-asserts identity headers specifically to defend it.

## Key constraints
- Blank-`agency_id` is legal *only* for sys_admin global-corpus writes; non-sys_admin blank-agency
  writes fail closed (403).
- Identity propagation must stay in the gateway, never the app layer (anti-spoofing).
- Cross-tenant user list and audit views must not leak to non-sys_admin roles.

## Pain points
- Header-spoofing is the highest-privilege attack surface aimed at this role.
- BCrypt cost=4 debt weakens the user-provisioning path.
- Async audit-write race gaps cause silent under-reporting in the cross-tenant audit view.

> Full evidence + reviewer prompt: see "Persona: System Administrator (sys_admin)" in `.claude/personas.md`.
> Note: HTTP-layer enforcement of `/api/admin/*` is labeled sys_admin-only in comments but the
> Spring Security gate is unconfirmed — treat as a required invariant.
