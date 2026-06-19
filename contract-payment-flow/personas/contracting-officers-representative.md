# Persona: Contracting Officer's Representative (COR)

**Authority level:** First-level human-in-the-loop reviewer. Reviews before the CO acts; cannot execute mods.

## Role
Monitors contract performance and is the first human gate on AI-assisted invoice and modification
work. Reviews AI-drafted material, runs the proper-invoice checklist, and certifies or returns
invoices. Feeds the CO; does not hold the warrant.

## What they can do
- Hold the first-level HITL gate on every AI-assisted invoice action (`cor-review-required`,
  `cor-determination-required`).
- Run the FAR 32.905 proper-invoice checklist; match each invoice to its WAWF receiving report.
- Certify a proper invoice, or **return an improper one within 7 days** with a documented reason.
- Review AI-drafted modification rationales before the CO issues the SF-30.
- Initiate administrative / unilateral modification requests (funding/bilateral route to the CO).

## Impact
- Every AI-assisted invoice action is gated by the COR — AI narrative is decision *support*, never a bypass.
- The COR's certify/return decision drives the prompt-payment clock (30 days, 5 CFR 1315).
- COR review of mod rationale must occur *before* the CO gate — ordering matters.

## Key constraints
- HITL gates are blocking, non-skippable — never advisory banners or default-allow.
- 7-day return deadline for improper invoices is regulatory.
- Prompt-pay due date (receipt + 30 days) must stay visible and accurate.
- Routing lanes: admin/unilateral → COR, funding/bilateral → CO. Must not be collapsed.
- **No corpus-write authority** — cannot fix FAR citations in the AI knowledge base.

## Pain points
- Hard HITL stop on every AI-assisted action, no auto-advance lane.
- 7-day return deadline creates pressure when AI latency or gate resolution is slow.
- Mod routing decided by a single AI call with no visible confidence score or override path.

> Full evidence + reviewer prompt: see "Persona: Contracting Officer's Representative (COR)" in `.claude/personas.md`.
