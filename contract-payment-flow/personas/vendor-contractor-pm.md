# Persona: Vendor (Contractor Program Manager)

- **Role id:** `vendor`
- **Class:** external · single-agency · human · untrusted
- **Regulatory basis:** FAR 42.1503(d) (CPAR rebuttal); DFARS 252.232-7003 (WAWF electronic payment submission)

## Summary
The Vendor role represents an external contractor organization's program manager who holds an active
federal contract. This role is the sole external human actor in the system: it submits invoices and
payment requests, acknowledges SF-30 contract modifications, and exercises the 60-day FAR-mandated
rebuttal right on Contractor Performance Assessment Reports (CPARs). The role is identity-scoped by
SAM.gov entity identifiers (DUNS / UEI / CAGE).

## What they can do
- Access the Contractor Portal (`/vendor/proposals`) to view and manage their own proposals and
  acknowledge solicitation amendments (`sidebar-nav.component.ts:32`, `vendor-portal.component.ts:57-79`).
- View CPAR Reviews (`/contracts/ctr-0001/cpars`) and submit a free-text rebuttal narrative when a
  CPAR is in `AWAITING_VENDOR_REVIEW` status (`sidebar-nav.component.ts:53`,
  `cpar-review.component.ts:57-68`).
- View the Award Record (`/awards/aw-2026-001`) (`sidebar-nav.component.ts:54`).
- Submit payment requests and receiving reports via WAWF (DFARS 252.232-7003 electronic submission
  path; `dfars-252-232-7003-wawf.md:12-14`).
- Self-register and retrieve their own proposal list via the backend vendor portal endpoint
  (`VendorController.java:51-55`).
- Carry SAM.gov identifiers (DUNS, UEI, CAGE) and socioeconomic set-aside designations that gate
  competition eligibility (`vendor.ts:16-27`).

## What they cannot do
- Access the government-side Dashboard, Modifications Index, SF-30 drafting, Invoice Queue, DCAA
  Audit Trail, Contract Admin, Contractor Directory, Reports, or any Admin surfaces
  (`sidebar-nav.component.ts:31-78` — `vendor` is absent from all those `roles` arrays).
- Sign or obligate SF-30 modifications (only `contracting_officer`, `cor`, `contract_specialist`
  have that nav link; `roles.ts:13-15`).
- Certify or approve invoices for payment (Invoice Queue restricted to CO/COR/DCAA;
  `sidebar-nav.component.ts:45`).
- Access any other vendor's proposal data in principle (though Debt Item 10 means the backend
  currently leaks cross-vendor data; `VendorController.java:33-34`, `VendorController.java:53-54`).
- Initiate or publish a CPAR — only government roles draft and publish; the vendor role is limited
  to the rebuttal panel (`cpar-review.component.ts:57`).

## Constraints / authority limits
- Identity is scoped by `vendorDuns` on the `RoleProfile`; no `agencyId` is set (value is `null`),
  meaning the role carries no government-agency tenancy (`roles.ts:67-72`).
- Production RBAC is expected to resolve the role from a validated JWT in the API gateway; today
  the mock role-switcher is used for demo purposes (`roles.ts:9-10`).
- Rebuttal panel renders only when `role === 'vendor'` AND CPAR status is
  `AWAITING_VENDOR_REVIEW` — both conditions must hold (`cpar-review.component.ts:57`).
- Rebuttal text is currently unsanitized (Debt Item 9); the field is rendered raw in the published
  CPAR (`cpar-review.component.ts:59-61`).
- The backend vendor-portal endpoint (`/api/vendors/{id}/proposals`) currently relies on vendorId
  match alone with no agency cross-check — Debt Item 10 (`VendorController.java:53-54`).

## Impact on the system
The Vendor role is the external payment-initiation and CPAR-rebuttal actor mandated by FAR 42.1503
and DFARS 252.232-7003. If its separation from government roles is lost in a migration — for
example if role-gate enforcement is not replicated in a new API gateway or the JWT claim is
dropped — contractors could gain access to the Invoice Queue, other vendors' proposals, or
government-internal contract administration surfaces. Conversely, if the rebuttal gate
(`role === 'vendor'` check) is lost, the 60-day FAR-mandated rebuttal window becomes unreachable,
creating a regulatory compliance break. Debt Item 10 (cross-vendor data leak) must be closed
during migration before the vendor portal goes to production.

## Pain points
- Debt Item 10: the `/api/vendors` list endpoint and `/api/vendors/{id}/proposals` proposal
  endpoint currently leak data across agencies and vendors; the portal's `vendorDuns` filter is
  client-side only (`VendorController.java:33-34`, `VendorController.java:53-54`). (Code-grounded)
- Debt Item 9: the CPAR rebuttal textarea accepts unsanitized free-text that is rendered raw in the
  published CPAR — an XSS surface the vendor must rely on without any input-validation feedback
  (`cpar-review.component.ts:59-61`). (Code-grounded)
- The Contractor Portal currently shows proposals by hard-coded fixture vendorId (`'vnd-acme'`)
  rather than the authenticated vendor's actual DUNS/UEI, so the self-service portal does not
  correctly scope to the signed-in vendor (`vendor-portal.component.ts:58`). (Code-grounded)
- No invoice-submission UI exists in the frontend for the vendor role; WAWF integration is
  documented only as a seed stub, meaning the vendor cannot initiate payment requests inside the
  application today (`dfars-252-232-7003-wawf.md:stub: true`). (Inference from stub state)

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:18` — role key `'vendor'` defined as "contractor program manager"
- `frontend/src/app/models/roles.ts:67-72` — `RoleProfile` for vendor: `agencyId: null`, `vendorDuns: '123456789'`, `authorityNote` citing FAR 42.1503(d)
- `frontend/src/app/models/roles.ts:30` — `vendorDuns` is vendor-only field on `RoleProfile`
- `frontend/src/app/shell/sidebar-nav.component.ts:32` — Contractor Portal nav link scoped exclusively to `['vendor']`
- `frontend/src/app/shell/sidebar-nav.component.ts:53-54` — CPAR Reviews and Award Record include `'vendor'` in allowed roles
- `frontend/src/app/components/cpar-review/cpar-review.component.ts:57-68` — rebuttal panel gated on `role.currentRole === 'vendor'` AND `AWAITING_VENDOR_REVIEW` status
- `frontend/src/app/components/cpar-review/cpar-review.component.ts:59-61` — rebuttal text unsanitized (Debt Item 9)
- `frontend/src/app/components/vendor-portal/vendor-portal.component.ts:57-79` — vendor self-portal: proposal listing, amendment-acknowledgement
- `frontend/src/app/components/vendor-portal/vendor-portal.component.ts:58` — hard-coded `'vnd-acme'` vendorId instead of authenticated DUNS
- `frontend/src/app/models/vendor.ts:16-27` — `Vendor` interface: DUNS, UEI, CAGE, NAICS codes, set-asides, `pastPerformanceAvg`
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/VendorController.java:31-35` — `/api/vendors` list leaks cross-agency (Debt Item 10)
- `services/contract-modification-service/src/main/java/com/karsunfde/contractflow/contractmodification/controller/VendorController.java:51-55` — `/api/vendors/{id}/proposals` self-portal endpoint, no agency cross-check
- `data/seed/far-part-42-43-32/dfars-252-232-7003-wawf.md:12-14` — contractor named as submitter of payment requests and receiving reports under WAWF

## Reviewer lens
> You are reviewing a migration plan as the Vendor (Contractor Program Manager). Your authority is
> strictly external and scoped: you may submit invoices, acknowledge SF-30 modifications, view your
> own proposals, and exercise the FAR 42.1503(d) 60-day CPAR rebuttal right — nothing more. You
> carry no government agency tenancy (`agencyId: null`, `roles.ts:67-72`) and your only nav
> access is Contractor Portal, CPAR Reviews, and Award Record (`sidebar-nav.component.ts:32,53-54`).
> The migration plan must preserve: (1) the role gate that restricts the rebuttal panel to
> `role === 'vendor'` AND `AWAITING_VENDOR_REVIEW` (`cpar-review.component.ts:57`); (2) separation
> from government-side surfaces (Invoice Queue, Modifications, DCAA Audit, etc.); (3) resolution of
> Debt Item 10 before any production vendor-portal exposure, so cross-vendor data leakage does not
> become a live vulnerability (`VendorController.java:53-54`). If the plan does not explicitly show
> how JWT-scoped vendor identity replaces the current mock role-switcher, assume it does not.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 42.1503(d) | Vendor 60-day rebuttal right on Contractor Performance Assessment Reports |
| FAR 32.905 | Proper-invoice determination; three-way match (contract / invoice / receiving report) |
| DFARS 252.232-7003 | Electronic submission of payment requests and receiving reports via WAWF |
| FAR 1.602-1 / 42.302 | CO authority to sign SF-30 mods and certify payment — contrasted boundary for vendor |
