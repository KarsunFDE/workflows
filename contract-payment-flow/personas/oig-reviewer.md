# Persona: OIG Reviewer (Inspector General Reviewer)

**Authority level:** Independent oversight. Read/investigate the audit trail and findings; does not gate transactions.

## Role
Conducts independent oversight by examining the append-only audit trail and OIG-style findings.
Detects irregularities (missing audit rows, gap patterns, cross-agency leakage) and tracks
remediation of findings to closure. Shares the `/admin/audit` view with sys_admin.

## What they can do
- Search and export audit events (`/admin/audit`) by actor, resource, correlationId, action, agency, date.
- Open, track, and resolve findings against contracts/agencies (`/admin/findings`).
- Monitor the `/api/reports/oig-findings-status` dashboard (findings × age × status, live data).
- Request evidence packages for open findings; escalate findings past their due date.

## Impact
- The audit trail and findings tracker are the OIG's evidence-reconstruction surfaces — schema or
  field loss directly breaks oversight capability.
- The findings lifecycle (OPEN → IN_PROGRESS → REMEDIATED → WAIVED) is the remediation-tracking chain.
- CSV export is the formal evidence-export mechanism; a UI-only view destroys evidentiary value.

## Key constraints
- `/admin/audit` and `/admin/findings` views must be preserved with identical semantics.
- Finding and AuditEvent fields (severity, findingType, remediationStatus, evidenceRequests, dueAt,
  beforeJson/afterJson, correlationId) must not be dropped or silently re-defaulted.
- The findings-status report must stay a **live query**, not cached/static.

## Pain points (known active debt)
- **Item 2** — audit-log async race drops rows on crash ("10 transitions, 8 audit rows").
- **Item 6** — inconsistent correlationId across services → `findByCorrelationId` returns half-empty.
- **Item 10** — findings-status report does not filter by agency claim → cross-agency exposure risk.
- No confirmed dedicated `AuditSearchController` — audit-search HTTP surface may be incomplete.

> Full evidence + reviewer prompt: see "Persona: OIG Reviewer" in `.claude/personas.md`.
> Note: role enforcement appears in Javadoc, not a `@PreAuthorize`/Security config — HTTP-layer gate unconfirmed.
