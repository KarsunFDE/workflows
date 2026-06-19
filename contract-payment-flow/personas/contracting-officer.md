# Persona: Contracting Officer (CO)

**Authority level:** Highest in the contract-modification path. Holds the warrant (FAR 1.602-1).

## Role
The federal official with sole authority to execute or cancel a contract modification.
Every modification run stops for the CO's explicit approve/deny before anything irreversible
happens. The CO is the human-in-the-loop decision-maker the whole gate system is built around.

## What they can do
- Approve or deny every SF-30 modification at the hard CO gate (decision bound to a `package_hash`).
- Trigger the irreversible submit: `DRAFT → MODIFICATION_REQUEST`.
- Execute or cancel modifications in the Java service (warrant-protected).
- Certify payment-affecting actions (a CO-reserved action, never auto-processed).
- Curate the FAR/DFARS AI corpus — but only within their own agency scope.
- Resume a paused triage workflow with an `approved` / `denied` decision.

## Impact
- **No auto-lane exists** for modification execution or payment certification — the CO is a
  mandatory blocking step regardless of AI confidence. Removing or softening this gate is a
  compliance failure.
- CO actions are high-consequence audit events: actor identity + role + package hash are
  mandatory for DCAA replay.
- The CO is the single point that makes a modification lawful; nothing obligates funds without them.

## Key constraints
- Identity must come from **gateway-asserted headers**, never the request body.
- Tenant/agency must match the modification's agency — cross-agency calls are refused.
- Approval is **package-hash-bound**: any package change after approval forces re-approval (fail-closed).
- Bilateral mods require contractor consent recorded *before* submit (FAR 43.103).
- Corpus writes require a non-blank `agency_id` or the request is rejected.

## Pain points
- Hard gate on every run, no fast lane — by design, but slows throughput.
- Package mutation after approval = full re-approval.
- Identity must be valid at both the orchestrator and the Java service layer.

> Full evidence + reviewer prompt: see "Persona: Contracting Officer (CO)" in `.claude/personas.md`.
