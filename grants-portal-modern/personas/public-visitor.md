# Public / Unauthenticated Visitor

## Role Key
`public`

## What They Do
- Browses read-only content on `/public/*` routes
- Views published NOFOs and program announcements
- Accesses Section 508-compliant informational surfaces

## What They Cannot Do
- Cannot submit applications
- Cannot access any authenticated workflows
- Cannot see application data, awards, or reviews

## Impact
- Entry point for potential applicants — NOFO discoverability matters
- Section 508 compliance is a legal requirement on all public surfaces (Debt Item 1)
- Poor UX here reduces application volume and diversity

## Access Level
- Read-only on `/public/*` only
- No authentication required
- No PII collected or displayed

## Cares About
- Clear NOFO information — eligibility, deadlines, funding amounts
- Accessible design (screen reader compatible, keyboard navigable)
- Path to create an account and begin an application

## Notes
JWT signature verification is skipped for `/api/public/*` routes — Debt Item 1, brownfield baseline. Fix not scheduled until W2+.
