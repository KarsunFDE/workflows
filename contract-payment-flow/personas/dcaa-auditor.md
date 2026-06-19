# Persona: DCAA Auditor (Defense Contract Audit Agency Auditor)

**Authority level:** After-the-fact accountability consumer. **Not an interactive system user in Phase 1.**

## Role
Reconstructs who authorized every modification and payment, under what authority — by replaying
the audit trail. Verifies AI never substituted for a required human gate. Examines cost-type
invoices for unallowable costs and defective pricing.

## What they can do
- Replay workflow runs via `correlation_id` against the `workflow_audit` collection.
- Inspect `dcaaFlags` on InvoiceReview records (unallowable cost FAR 31.205, defective pricing).
- Verify reserved actions (`modification_execution`, `payment_certification`) were never auto-processed.
- Confirm high-consequence events carry actor_id + actor_role + package_hash.
- Cross-check unit-price-variance flags against payment dispositions.

## Impact
- The mandate is explicit: no OIG/DCAA auditor should ever be able to say the system authorized a
  payment or executed a mod a human was supposed to. The whole HITL + audit design serves this.
- The append-only, fail-closed `workflow_audit` collection is the *sole* reconstruction artifact.
- Every disposition in every lane (auto-approve included) must be auditable: who/what/under-which-authority/which-lane/why.

## Key constraints
- Audit writes must stay synchronous/fail-closed — no async, best-effort, or silent error swallowing.
- High-consequence events must keep actor_id, actor_role, package_hash.
- `correlation_id` threading must allow end-to-end run reconstruction.
- `dcaaFlags` field and the `UNIT_PRICE_VARIANCE_LIMIT = 0.10` trigger must not be dropped/loosened
  without an audit record.
- 5+ year retention is a stated NFR (retention implementation unconfirmed).

## Pain points
- No interactive UI or query API in Phase 1 (DCAA audit-response workflows out of scope).
- **Item 2** — async audit race can silently drop pre-workflow entries.
- **Item 6** — inconsistent cross-service correlation IDs block reliable run-level log joins.

> Full evidence + reviewer prompt: see "Persona: DCAA Auditor" in `.claude/personas.md`.
> Note: named stakeholder + data-model target, but no implemented `DCAA_AUDITOR` auth role in Phase 1.
