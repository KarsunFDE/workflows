# Persona: Vendor / Contractor Program Manager

**Authority level:** External party. Submits work into the system; subject to government review/approval.

## Role
The contractor-side manager who submits invoices, signs bilateral modifications, acknowledges
amendments, and rebuts performance ratings. Interacts through a vendor self-portal and an AI Q&A
surface. No internal role constant targets the vendor — the persona is inferred from domain semantics.

## What they can do
- Submit invoices against awarded contract CLINs (invoiceNumber, invoiceDate, invoiceAmount).
- View their own proposals via the vendor self-portal (scoped to their `vendorId`).
- Give explicit consent on bilateral supplemental modifications (FAR 43.103).
- Acknowledge scope-changing amendments before proposal deadlines (FAR 15.206).
- File vendor rebuttals to CPARS performance ratings within the rebuttal window (FAR 42.15).
- Query `/answer-qa` for FAR-cited answers (e.g. "why was invoice INV-204 returned?").
- Maintain SAM.gov identity (UEI, DUNS, CAGE, agencyVisibility).

## Impact
- The vendor is the entity that *initiates* the payment path — invoice shape drives the whole review flow.
- Bilateral consent is a required step that must precede modification submit.
- CPARS rebuttal is a time-bounded right; missing the window has real contractual consequence.

## Key constraints
- Self-portal must stay scoped to the vendor's own `vendorId` — never a shared list.
- Invoice form must keep all FAR 32.905 required fields.
- Bilateral consent must stay an explicit step — not a default-true/auto-advancing checkbox.
- Vendor entity identifiers (UEI/DUNS/CAGE/agencyVisibility) must not be silently dropped.

## Pain points
- **Item 4** — invoices returned as improper without machine-readable FAR clause citations (`cited_clauses` empty).
- **Item 10** — cross-agency vendor record leak risk on `/api/vendors` (could expose competitors).
- Bilateral consent is a bare boolean with no observed vendor-facing sign endpoint (may be out-of-band/WAWF).
- CPARS rebuttal deadline enforced only by data shape — no reminder/gate prevents a silent miss.
- **Item 9** — `/answer-qa` feeds unvalidated question text directly into the model prompt.

> Full evidence + reviewer prompt: see "Persona: Vendor / Contractor Program Manager" in `.claude/personas.md`.
> Note: no `vendor_pm` role enum or auth guard confirmed — distinct access level inferred, not proven.
