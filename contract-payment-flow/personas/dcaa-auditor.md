# Persona: DCAA Auditor (Defense Contract Audit Agency)

- **Role id:** `dcaa_auditor`
- **Class:** external · single-agency (DCAA) · human · trusted
- **Regulatory basis:** FAR 31.205 (unallowable costs), FAR 42.1 (contract audit services), FAR 42.7 (indirect cost rates)

## Summary
The DCAA Auditor is an external federal auditor employed by the Defense Contract Audit Agency who reviews cost-type invoices and incurred-cost submissions against awarded contracts. Within this system the role is scoped to the invoice-review and audit-trail surfaces; it has no authority to certify payment or execute contract modifications.

## What they can do
- Access the Invoice Queue (`/invoiceReviews`) to inspect pending cost-type invoices — `sidebar-nav.component.ts:45`.
- Access the DCAA Audit Trail (`/admin/audit`) to review audit history — `sidebar-nav.component.ts:46`.
- View `dcaaFlags` attached to individual InvoiceReview records (e.g. `unit_price_variance`, `cost_type_audit_pending`) — `invoice-review-panel.component.ts:68`.
- Receive `DCAA_FLAG_RAISED` notifications routed specifically to `recipientRole: 'dcaa_auditor'` — `notification.service.ts:84`.
- Land directly on `/invoiceReviews` after role switch, confirming invoice review as the primary workflow entry point — `role-switcher.component.ts:44`.

## What they cannot do
- Cannot access Modifications Index or create SF-30 modifications — those routes are restricted to `contracting_officer`, `cor`, `contract_specialist` — `sidebar-nav.component.ts:38-39`.
- Cannot certify invoices for payment (CO authority under FAR 1.602-1 / 42.302) — no `certified` write path is exposed to this role.
- Cannot access Contract Admin, CPAR Reviews, or Award Record — those routes exclude `dcaa_auditor` — `sidebar-nav.component.ts:51-54`.
- Cannot access All Reports — restricted to `contracting_officer`, `cor`, `program_manager`, `sys_admin`, `oig_reviewer` — `sidebar-nav.component.ts:60`.
- Cannot access User & Role Admin, System Config, or OIG Findings Tracker — `sidebar-nav.component.ts:72-75`.
- Cannot access the Contractor Directory — `sidebar-nav.component.ts:66`.
- Cannot access Dashboard or Contractor Portal — `sidebar-nav.component.ts:31-32`.

## Constraints / authority limits
- Agency identity is fixed to `agencyId: 'DCAA'` — the role does not share a tenant with the contracting agency (GSA-FAS) — `roles.ts:63`.
- Authority is narrowly scoped to auditing cost-type invoices: flagging unallowable costs (FAR 31.205) and defective pricing (FAR 42.1) — `roles.ts:64`.
- Role is defined in the frontend mock role-switcher; production RBAC is intended to resolve from a validated JWT at the API gateway (Debt Item 1 notes JWT signature-skip on `/api/public/*`) — `roles.ts:9-10`.
- `dcaaFlags` on InvoiceReview is a list — the DCAA Auditor consumes flags but the write path (which service node populates `dcaaFlags`) is not visible in the frontend; populate authority is implied by the domain model, not confirmed in a backend write route within the traced evidence.

## Impact on the system
The DCAA Auditor role is the sole external cost-audit gatekeeper for cost-type invoice lines. If its route guards, `dcaaFlags` field, or audit-trail access are dropped or merged into a broader role during migration, the separation between payment certification (CO) and cost allowability review (DCAA) collapses — a direct violation of FAR 31.205 and FAR 42.1 audit independence. The `dcaaFlags` list on `InvoiceReview` is the primary data carrier for this separation; removing or loosening it eliminates the audit evidence trail that a migration must preserve for regulatory compliance.

## Pain points
- The `dcaaFlags` write path is not surfaced in a traceable backend controller within the reviewed evidence — there is no confirmed API endpoint or service method that sets flags; the DCAA Auditor may have no in-system way to assert a flag, only to read them (inference — write path not traced).
- Notification routing (`DCAA_FLAG_RAISED`) is in a mock fixture service; it is not backed by a real event bus in the current implementation, meaning DCAA auditors would not receive live alerts in production as-is — `notification.service.ts:80-87`.
- The DCAA Auditor has no access to Reports, CPAR, or Contract Admin, which limits cross-reference visibility when evaluating indirect cost rates (FAR 42.7) against contract performance data (inference from nav exclusions at `sidebar-nav.component.ts:51-61`).
- Debt Item 1 (JWT signature-skip on `/api/public/*`) means DCAA identity is not cryptographically enforced today, creating a gap between the role's trust posture and the actual enforcement boundary — `roles.ts:9-10`.

## Evidence (file:line)
- `frontend/src/app/models/roles.ts:17` — `dcaa_auditor` declared in the `Role` union type with comment "DCAA — cost-type invoice audit"
- `frontend/src/app/models/roles.ts:61-65` — `RoleProfile` for `dcaa_auditor`: `agencyId: 'DCAA'`, `authorityNote` cites FAR 31.205 (unallowable cost) and FAR 42.1 (defective pricing)
- `frontend/src/app/shell/sidebar-nav.component.ts:45` — Invoice Queue nav link includes `dcaa_auditor` in allowed roles
- `frontend/src/app/shell/sidebar-nav.component.ts:46` — DCAA Audit Trail nav link restricted to `dcaa_auditor`, `oig_reviewer`, `contracting_officer`
- `frontend/src/app/shell/role-switcher.component.ts:44` — `dcaa_auditor` default landing route is `/invoiceReviews`
- `frontend/src/app/components/invoice-review-panel/invoice-review-panel.component.ts:68` — template renders `<strong>DCAA flags:</strong>` conditional on `inv.dcaaFlags.length`
- `frontend/src/app/models/invoice-review.ts:66-67` — TypeScript model: `dcaaFlags: string[]` with JSDoc "DCAA cost-type audit flags (FAR 31.205 unallowable, defective pricing)"
- `services/invoice-review-service/src/main/java/com/karsunfde/contractflow/invoicereview/model/InvoiceReview.java:64-66` — `dcaaFlags` field Javadoc: "DCAA cost-type audit flags (e.g. unallowable cost FAR 31.205, defective pricing)"; declared as `List<String>`
- `frontend/src/app/services/mock-fixtures.ts:251` — fixture invoice with `dcaaFlags: ['unit_price_variance']`
- `frontend/src/app/services/mock-fixtures.ts:272` — fixture invoice with `dcaaFlags: ['cost_type_audit_pending']`
- `frontend/src/app/services/notification.service.ts:81-84` — `DCAA_FLAG_RAISED` notification event routed to `recipientRole: 'dcaa_auditor'`
- `data/seed/far-part-42-43-32/far-42-overview.md:20-22` — seed FAR reference: "DCAA provides contract audit services, including evaluation of cost-type vouchers and incurred-cost submissions, and flags unallowable costs (FAR 31.205) and defective pricing"

## Reviewer lens
> You are a DCAA Auditor reviewing a modernization plan for the contract-payment-flow system. Your authority is: audit cost-type invoices, flag unallowable costs (FAR 31.205), flag defective pricing (FAR 42.1), and access the DCAA Audit Trail — all grounded in `roles.ts:61-65` and `sidebar-nav.component.ts:45-46`. You are external to the contracting agency (agencyId 'DCAA', not 'GSA-FAS'). You cannot certify payment, execute modifications, or access contract performance or reporting surfaces.
>
> For every migration claim, demand proof that: (1) the `dcaaFlags` field on `InvoiceReview` is preserved with its full write-and-read path intact; (2) the DCAA Audit Trail route remains restricted to `dcaa_auditor`, `oig_reviewer`, and `contracting_officer`; (3) audit-independence separation between cost allowability review (DCAA) and payment certification (CO) is maintained as a hard RBAC boundary, not a UI convention; (4) the `DCAA_FLAG_RAISED` notification event is backed by a real event pathway in the migrated system, not only a mock fixture; (5) Debt Item 1 (JWT signature-skip) is resolved so DCAA identity is cryptographically enforced before production.
>
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| FAR 31.205 | Unallowable costs — defines cost elements DCAA must flag on cost-type invoices |
| FAR 42.1 | Contract audit services — DCAA authority to audit vouchers and flag defective pricing |
| FAR 42.7 | Indirect cost rates — DCAA reviews incurred-cost submissions for cost-reimbursement contracts |
| FAR 32.905 | Proper-invoice requirements — checklist the system enforces; DCAA flags supplement this check |
