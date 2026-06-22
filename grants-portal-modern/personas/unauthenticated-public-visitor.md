# Persona: Unauthenticated Public Visitor

- **Role id:** `public`
- **Class:** external · cross-tenant · human · untrusted
- **Regulatory basis:** 5 USC 552 (FOIA), 2 CFR 200.204 (NOFO public publication requirement)

## Summary
The Unauthenticated Public Visitor is any browser session that has not presented (or has not been granted) a validated identity. The role exists to serve the Grants.gov-style public NOFO catalog — funding opportunities visible before an account is required. It carries no agency affiliation and no write authority anywhere in the system.

## What they can do
- Browse the list of open funding opportunities at `/public/opportunities`, filtered by assistance listing number, funding instrument, or agency — served by `GET /api/public/opportunities` which is `permitAll()` at the gateway and returns all grant applications in `SCREENING` or `PEER_REVIEW` status.
- View the full detail of a single funding opportunity, including amendments, at `/public/opportunities/:id` — served by `GET /api/public/opportunities/{id}`.
- Navigate those two Angular routes without a `canMatch` guard, because neither route in `app.routes.ts` attaches `roleGuard(...)`. (`app.routes.ts:routes`)

## What they cannot do
- Access any route that carries a `roleGuard(...)` — all authenticated routes redirect a `public` session back to `/public/opportunities` rather than `/dashboard`. (`role.guard.ts:roleGuard`)
- Submit, create, edit, or withdraw a grant application — all mutation endpoints require `authenticated()` at the gateway.
- Access peer-review workspaces, award records, amendment editors, Q&A triage, proposal intake, vendor directory/detail, officer dashboard, reports hub, admin surfaces, or audit/findings pages.
- Access any backend path outside `/api/public/**` or `/actuator/**`; all other exchanges require a validated identity per the gateway's `anyExchange().authenticated()` rule.

## Constraints / authority limits
- No agency binding: `agencyId` is `null` for the `public` profile — the role is explicitly cross-tenant in the sense that the listing endpoint crosses agency lines, but this is intentional for the public catalog surface. (`roles.ts:RoleProfile`, `roles.ts:ROLE_PROFILES`)
- No JWT required: the gateway's `permitAll()` on `/api/public/**` means the visitor needs no token at all. However, a structurally valid but signature-unverified JWT presented on this path is also accepted by `JwtSignatureSkipFilter` without JWKS check (Brownfield Debt Item 1 — unlock W4). (`SecurityConfig.java:springSecurityFilterChain`, `JwtSignatureSkipFilter.java:verifySignature`)
- Frontend fallback is hard-coded: `roleGuard` redirects `public` role to `/public/opportunities`, not `/dashboard`, ensuring the visitor never lands on authenticated surfaces. (`role.guard.ts:roleGuard`)
- The public listing is unfiltered by tenant at the data layer — `svc.listAll()` is called and filtered only by status, not by `agencyId`. This is an acknowledged cross-tenant data-exposure pattern (Item 10). (`PublicOpportunitiesController.java:list`)

## Impact on the system
This role is the primary anonymous entry point to the portal. Removing or tightening the `permitAll()` path at the gateway without a corresponding authentication flow would lock all pre-login users out of the NOFO catalog, breaking the public-facing grants-discovery requirement. In a migration, the guard fallback logic in `role.guard.ts` and the gateway `permitAll()` rule must be preserved (or replaced with an equivalent anonymous-read mechanism) before any auth scheme changes go live. Additionally, the `JwtSignatureSkipFilter` debt on this path means that any attacker can escalate claims on `/api/public/**` until Item 1 is fixed — removing the filter in migration without also requiring proper JWT validation for authenticated requests on this path would close the exploit cleanly.

## Pain points
- The public listing crosses tenant lines (`svc.listAll()` with no agency scope applied upstream) — a visitor sees opportunities from all agencies, which is intended for the public surface but mirrors the tenant-isolation bug present in private endpoints (Item 10 — inference from `PublicOpportunitiesController.java:list` comment).
- Opportunity detail description is rendered verbatim by the backend (Item 9 noted in `PublicOpportunitiesController.java:PublicOpportunitiesController` class comment), meaning unsanitized HTML/script in a NOFO description reaches the anonymous browser with no escaping layer.
- The `JwtSignatureSkipFilter` means any structurally valid JWT presented on the public path is accepted without signature or expiry check — a session whose token has since expired (or been forged) is indistinguishable from a fresh anonymous request until Item 1 is resolved. (`JwtSignatureSkipFilter.java:verifySignature`)
- There is no rate-limiting or pagination on `GET /api/public/opportunities` — a visitor can enumerate the entire cross-tenant grant catalog in a single call (inference from absence of pagination logic in `PublicOpportunitiesController.java:list`).

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `'public'` is a member of the `Role` union type
- `frontend/src/app/models/roles.ts:RoleProfile` — `agencyId: string | null` interface field; JSDoc notes `null` for `sys_admin` and `public`
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `public` entry: `role: 'public'`, `agencyId: null`, `authorityNote: 'Read-only on /public/* (Item 1 surface).'`
- `frontend/src/app/app.routes.ts:routes` — `/public/opportunities` and `/public/opportunities/:id` routes carry no `canMatch` guard
- `frontend/src/app/services/role.guard.ts:roleGuard` — guard fallback for `public` role redirects to `/public/opportunities` instead of `/dashboard`
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/SecurityConfig.java:springSecurityFilterChain` — `.pathMatchers("/api/public/**").permitAll()` bypasses authentication; `JwtSignatureSkipFilter` wired before the auth filter for this path
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/JwtSignatureSkipFilter.java:filter` — skips standard JWKS validation on `/api/public/` paths when a Bearer token is present
- `services/api-gateway/src/main/java/com/karsunfde/grantsportal/gateway/JwtSignatureSkipFilter.java:verifySignature` — deliberate no-op; always returns `true` (Debt Item 1)
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/PublicOpportunitiesController.java:PublicOpportunitiesController` — controller maps to `/api/public/opportunities`; no auth annotation; class comment calls out Items 1, 9, 10
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/PublicOpportunitiesController.java:list` — calls `svc.listAll()` unscoped then filters by status only
- `services/grant-application-service/src/main/java/com/karsunfde/grantsportal/grantapplication/controller/PublicOpportunitiesController.java:detail` — returns raw `grantApplication` and `amendments` with no role check
- `frontend/src/app/components/public-opportunities/public-opportunities.component.ts:PublicOpportunitiesComponent` — SAM.gov-style filter UI; reads from `FIXTURE_SOLICITATIONS`; `filtered()` excludes DRAFT and INTERNAL_REVIEW

## Reviewer lens
> This persona has read-only access to exactly two API surfaces — `GET /api/public/opportunities` and `GET /api/public/opportunities/{id}` — with no authentication requirement (`SecurityConfig.java:springSecurityFilterChain`). The Angular router enforces no `canMatch` guard on these routes (`app.routes.ts:routes`), and the role guard redirects any `public` session away from all other routes back to `/public/opportunities` (`role.guard.ts:roleGuard`). The persona carries no agency binding (`roles.ts:RoleProfile`, `roles.ts:ROLE_PROFILES`) and no write authority anywhere. Any migration plan must (1) preserve the anonymous-read path on `/api/public/**` or provide an equivalent unauthenticated discovery endpoint, (2) delete `JwtSignatureSkipFilter` entirely rather than carry the no-op `verifySignature` forward (`JwtSignatureSkipFilter.java:verifySignature`), and (3) keep the frontend guard fallback pointed at a reachable public landing page.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 5 USC 552 (FOIA) | Federal funding opportunity notices are public records; the public catalog surface fulfills the transparency disclosure obligation |
| 2 CFR 200.204 | Agencies must publish NOFOs publicly before accepting applications — the public opportunity listing is the portal's implementation of this requirement |
