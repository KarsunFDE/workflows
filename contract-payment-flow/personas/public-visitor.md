# Persona: Public / Unauthenticated Visitor

- **Role id:** `public`
- **Class:** external · cross-tenant · human · untrusted

## Summary
An unauthenticated (or structurally-JWT-bearing) browser visitor with no agency affiliation. This role represents the general public browsing published federal contract opportunities in a SAM.gov-style surface. The system assigns `agencyId: null` and grants no write authority; the role is the sole principal that the frontend routes away from `/dashboard` and toward `/public/opportunities`.

## What they can do
- Browse the public opportunity listing at `/public/opportunities`, filtered by NAICS, set-aside, agency, notice type, and keyword -- spanning all tenants (`svc.listAll()` is unscoped to any `agencyId`). (`PublicOpportunitiesController.java:40-52`, `PublicOpportunitiesComponent.ts:97-104`)
- View full opportunity detail at `/public/opportunities/:id`, including Sections C/L/M, amendments timeline, and published Q&A answers. (`OpportunityDetailComponent.ts:98-128`, `PublicOpportunitiesController.java:55-64`)
- Submit a structurally-valid (but signature-unverified) Bearer JWT against `/api/public/**` and have it accepted by the gateway -- the `verifySignature` method is a confirmed no-op. (`JwtSignatureSkipFilter.java:34,61-64`)

## What they cannot do
- Access any route that carries a `roleGuard(...)` allow-list that does not include `'public'` -- every authenticated-only route (`/dashboard`, `/reports`, `/vendors`, `/contracts/:id/admin`, `/admin/**`, etc.) redirects them back to `/public/opportunities`. (`app.routes.ts:34-144`, `role.guard.ts:23`)
- Obligate funds, submit invoices, draft or sign contract modifications, or perform any write operation -- no POST/PUT/PATCH endpoint exists under `/api/public/**`.
- Access records with status `INTERNAL_REVIEW` or `DRAFT`; the frontend filter and backend status filter both exclude those statuses. (`PublicOpportunitiesComponent.ts:104`, `PublicOpportunitiesController.java:47-48`)
- Access records scoped to a single tenant in isolation -- the listing is intentionally cross-tenant (all `agencyId` values are visible). (`PublicOpportunitiesController.java:44-45`)
- Receive an `agencyId` claim -- the role profile hard-codes `agencyId: null`. (`roles.ts:29,98-102`)

## Constraints / authority limits
- The role is never resolved from a validated JWT in production; it is a mock role-switcher signal for demo purposes. Production RBAC is stated to resolve role from a validated gateway JWT, but that validation is skipped on `/api/public/**` today (Debt Item 1). (`roles.ts:6-11`, `JwtSignatureSkipFilter.java:10-22`)
- `agencyId` is `null` -- no agency boundary is enforced; the role has no tenant scope and cannot be narrowed to one. (`roles.ts:29`, `roles.ts:99-101`)
- Fallback redirect is hard-coded to `/public/opportunities` (not `/dashboard`) when the guard fires for `role === 'public'`. (`role.guard.ts:23`)
- Only `PUBLISHED` and `AMENDED` status records are surfaced from the backend list endpoint; the frontend additionally excludes `INTERNAL_REVIEW` and `DRAFT`. (`PublicOpportunitiesController.java:47-48`, `PublicOpportunitiesComponent.ts:104`)

## Impact on the system
The public surface is the system's anonymous read entry point and is the only path where JWT signature validation is deliberately bypassed (Debt Item 1 in `JwtSignatureSkipFilter`). If its access rules are relaxed during a migration -- for example by broadening the `/api/public/**` path match, dropping the status filters, or failing to carry the `roleGuard` redirect -- the effect is threefold: (1) draft and internally-reviewed records become visible to the general public, (2) any structurally-valid forged JWT is silently accepted on those paths, and (3) cross-tenant data exposure (Item 10) widens because no `agencyId` filter is applied. Conversely, if the JWT skip-filter is removed without simultaneously standing up real JWKS validation, all public-path calls break.

## Pain points
- The JWT signature-skip on `/api/public/**` means there is no way to distinguish a legitimately unauthenticated request from a forged one; a migration that fixes Item 1 must not break the anonymous read use-case. (`JwtSignatureSkipFilter.java:34,61-64`) (code-grounded)
- The cross-tenant listing (Item 10) is described as "intentional for public" but the controller comment acknowledges it reinforces the leak pattern that is the actual bug in private endpoints -- fixing it in isolation risks masking the real problem. (`PublicOpportunitiesController.java:44-45`) (code-grounded)
- The opportunity detail page stores and renders description content that the backend does not sanitize (Item 9); a public visitor is both a potential victim of stored prompt-injection and a vector for discovering the surface. (`OpportunityDetailComponent.ts:35-38`, `PublicOpportunitiesController.java:19`) (code-grounded)
- The role has no authentication path -- there is no login redirect for a visitor who wants to escalate to an authenticated role; the router catch-all sends unknown paths to `/dashboard`, which itself is guarded, producing a redirect loop for a `public` role user. (`app.routes.ts:144`, `role.guard.ts:23`) (inference)

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:21` -- `'public'` declared in the `Role` union type
- `frontend/src/app/models/roles.ts:29` -- `agencyId: null` for `public` role (no tenant scope)
- `frontend/src/app/models/roles.ts:98-102` -- `RoleProfile` entry: `role:'public'`, `agencyId:null`, `authorityNote:'Read-only on /public/* (Item 1 surface)'`
- `frontend/src/app/services/role.guard.ts:23` -- guard redirects `public` role to `/public/opportunities` instead of `/dashboard`
- `frontend/src/app/app.routes.ts:79-80` -- `/public/opportunities` and `/public/opportunities/:id` carry no `canMatch` guard (open to all roles including public)
- `frontend/src/app/app.routes.ts:34-36` -- `/dashboard` guard explicitly excludes `'public'` from its allow-list
- `frontend/src/app/components/public-opportunities/public-opportunities.component.ts:97-104` -- frontend filters out `INTERNAL_REVIEW` and `DRAFT` statuses
- `frontend/src/app/components/opportunity-detail/opportunity-detail.component.ts:35-38` -- comment documents Item 9 raw-render surface on description field
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/PublicOpportunitiesController.java:19-24` -- controller header documents Items 1, 9, 10 on this path
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/PublicOpportunitiesController.java:26` -- `@RequestMapping("/api/public/opportunities")` -- the unauthenticated API surface
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/PublicOpportunitiesController.java:47-48` -- status filter limits to `PUBLISHED` and `AMENDED`
- `services/api-gateway/src/main/java/com/karsunfde/contractflow/gateway/JwtSignatureSkipFilter.java:34` -- path predicate `path.startsWith("/api/public/")` triggers the skip logic
- `services/api-gateway/src/main/java/com/karsunfde/contractflow/gateway/JwtSignatureSkipFilter.java:61-64` -- `verifySignature` is a confirmed no-op (`return true`) -- Debt Item 1

## Reviewer lens
Authority (from code): Read-only access to `/public/opportunities` (list + detail) via `PublicOpportunitiesController` (`/api/public/opportunities`, `PublicOpportunitiesController.java:26`). No write surface exists on `/api/public/**`. Frontend enforces the boundary via `roleGuard` redirect to `/public/opportunities` for any `role === 'public'` request to a guarded route (`role.guard.ts:23`). JWT signature validation is currently bypassed for all `/api/public/**` paths -- `verifySignature` returns `true` unconditionally (`JwtSignatureSkipFilter.java:61-64`), so the gateway cannot distinguish forged from legitimate tokens on this surface.

Constraints the migration must preserve:
1. Status filter (`PUBLISHED` / `AMENDED` only) must remain on the public list endpoint -- removing it exposes `DRAFT` and `INTERNAL_REVIEW` records to the public (`PublicOpportunitiesController.java:47-48`).
2. The `agencyId: null` / cross-tenant read on the public surface is intentional; the migration must not accidentally restrict it to a single tenant while fixing the analogous bug in authenticated endpoints.
3. Closing Debt Item 1 (JWKS signature verification on `/api/public/**`) must not break anonymous access -- the anonymous read use-case must continue to work without a valid JWT.
4. The `roleGuard` redirect to `/public/opportunities` (not `/dashboard`) for `public` role must survive any frontend routing refactor (`role.guard.ts:23`, `app.routes.ts:79-80`).
5. Description content on detail pages must be sanitized before render to close Item 9 without removing the public read capability (`OpportunityDetailComponent.ts:35-38`).

Default to REFUTE -- if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 5.301-5.303 | Public notice of contract actions (synopses); underpins the SAM.gov-style public read surface |
| 41 USC 1708 | Statutory basis for public posting of contract opportunities above the simplified acquisition threshold |
