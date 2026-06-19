# System Administrator

## Role Key
`sys_admin`

## What They Do
- Cross-tenant provisioning — creates and manages user accounts across all agencies
- Key rotation and credential management
- Configures RBAC assignments (who gets which role in which agency)
- Platform-level configuration and maintenance
- No agency affiliation — operates at infrastructure level

## What They Cannot Do
- Cannot sign awards or make grant decisions (no agency role)
- Should not be used for normal grant workflow actions — admin-only

## Impact
- Controls who has access to what — highest privilege in the system
- Misconfiguration creates security exposure across all tenants
- Key rotation failures break authentication for all users

## Access Level
- Cross-tenant, all agencies
- Platform configuration and user management
- No grant application data access by design (separation of duties)

## Cares About
- Least-privilege assignments — users should have only what they need
- Audit trail on all provisioning actions
- JWT configuration correctness (flags debt: JWT signature-skip on `/api/public/*`)
- CORS and security headers

## Example Personas in System
Root — `roles.ts:93`
