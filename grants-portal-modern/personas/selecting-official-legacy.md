# Persona: Selecting Official (Legacy Merit-Consensus Authority)

- **Role id:** `ssa`
- **Class:** internal · single-agency · human · trusted
- **Regulatory basis:** 2 CFR 200.205 (merit review and funding recommendation approval)

## Summary
The Selecting Official is an internal agency human who holds the final approval authority over the merit-review panel's funding recommendation. The role is inherited from an acquisition (source-selection) baseline and has been retained unchanged on the grants portal pending a W4–W5 redesign that will repurpose or rename the role. Until that migration lands, the `ssa` key is the only role permitted to execute the SSDD sign-off that advances a peer review from `AWAITING_SSA_SIGNATURE` to `AWARDED`.

## What they can do
- Access the officer dashboard alongside other internal staff roles. (`app.routes.ts:routes`)
- Access the reports hub. (`app.routes.ts:routes`)
- Navigate to and interact with the merit-consensus/SSDD surface at `/peer-review/:solId/consensus` — the only role (other than `contracting_officer` and `sys_admin`) with route-level access. (`app.routes.ts:routes`)
- Invoke the AI-draft funding-recommendation narrative button inside `ConsensusSsddComponent`. (`ConsensusSsddComponent.aiDraft`)
- Execute the "Approve & record award decision" action (`sign()`) to advance a peer review to AWARDED state — the component enforces `role.currentRole !== 'ssa'` as a hard UI gate. (`ConsensusSsddComponent.sign`)
- Sign the SSDD document, recorded as audit action `SSDD.SIGN` transitioning peer-review state from `AWAITING_SSA_SIGNATURE` to `AWARDED`. (`mock-fixtures.ts:FIXTURE_AUDIT_EVENTS`)

## What they cannot do
- Create, edit, or submit grant applications: `/grant-applications/new` and `/grant-applications/:id/amendments` exclude `ssa`. (`app.routes.ts:routes`)
- Issue or draft Q&A answers or proposals: `/grant-applications/:id/qa` and `/grant-applications/:id/proposals` are restricted to `contracting_officer` and `contract_specialist`. (`app.routes.ts:routes`)
- Access the vendor directory or vendor detail pages: `ssa` is absent from those guards. (`app.routes.ts:routes`)
- Access the evaluator/peer-reviewer workspace: `/peer-review/workspace` is limited to `evaluator`, `contracting_officer`, and `sys_admin`. (`app.routes.ts:routes`)
- Access admin user provisioning, admin configuration, audit search, or findings tracker: all admin routes restrict to `sys_admin` (and `oig_reviewer` for audit/findings). (`app.routes.ts:routes`)
- Delegate the sign authority — the component comment explicitly states "this authority cannot be delegated." (`ConsensusSsddComponent`)

## Constraints / authority limits
- The `ssa` role key originates from an acquisition baseline; the code comment confirms it has "no first-class grants equivalent yet" and is scheduled for repurposing in W4–W5. (`roles.ts:Role`, `roles.ts:ROLE_PROFILES`)
- Agency scope is single-agency (`agencyId: 'HHS-ACF'`) — the role is not cross-tenant. (`roles.ts:ROLE_PROFILES`)
- Role is resolved from a mock role-switcher in the frontend for cohort demos; production RBAC resolves the `role` claim from a validated JWT in the API gateway. (`roles.ts:ROLE_PROFILES`)
- The HITL gate at the consensus surface is mandatory: AI drafts the recommendation narrative, but the Selecting Official must review and approve before the award decision is recorded — the LangGraph interrupt-before-node fires at "award decision ready." (`ConsensusSsddComponent`)
- The `sign()` method contains an explicit role check; calling it as any other role is a no-op. (`ConsensusSsddComponent.sign`)

## Impact on the system
The `ssa` role is the sole non-admin, non-GMO gatekeeper for advancing the merit-consensus surface from review to award. If the role key is renamed, removed, or its route guard is dropped without a corresponding migration, the `/peer-review/:solId/consensus` path becomes inaccessible to legitimate selecting officials and the SSDD sign-off step breaks entirely — no peer review can transition to `AWARDED` through that surface. Because the key is inherited from an acquisition baseline and is explicitly scheduled to be repurposed in W4–W5, any early or uncoordinated migration risks either orphaning existing SSDD workflows or silently granting the sign authority to a broader role than intended.

## Pain points
- The role key `ssa` carries acquisition semantics ("Source Selection Authority") on a grants portal, creating vocabulary confusion for grants staff who do not recognize the term. (`roles.ts:Role` — confirmed by code; scheduled for rename W4–W5.)
- The Selecting Official has no access to the evaluator workspace (`/peer-review/workspace`) but must approve the panel's recommendation — they see the consensus matrix but cannot drill into individual reviewer scores in their current surface. (Inferred from route guards in `app.routes.ts:routes`.)
- The AI-drafted recommendation narrative carries explicit debt annotations ("Item 4 (no Pydantic schema), Item 5 (legacy LLMChain)"), meaning the Selecting Official is reviewing output from a degraded AI pipeline until those items are resolved. (`ConsensusSsddComponent.aiDraft`)
- No route exists today for the SSA to view the award record directly from the consensus surface beyond the post-sign link; navigation breadcrumbs are minimal. (Inferred from `ConsensusSsddComponent` template structure.)

## Evidence (file:symbol)
- `frontend/src/app/models/roles.ts:Role` — `ssa` member of the `Role` union type; comment confirms no first-class grants equivalent (relabeled legacy/support persona)
- `frontend/src/app/models/roles.ts:ROLE_PROFILES` — `ssa` entry: `agencyId: 'HHS-ACF'`, `authorityNote: 'Legacy final-selection authority retained for inherited merit-consensus surface; W4–W5 repurposes'`
- `frontend/src/app/app.routes.ts:routes` — `ssa` present in `canMatch` guards for dashboard, reports, and `/peer-review/:solId/consensus` (alongside `contracting_officer`, `sys_admin`); absent from grant-application creation, amendments, Q&A, proposals, evaluator workspace, vendor directory, and all admin routes
- `frontend/src/app/services/role.guard.ts:roleGuard` — factory enforcing role allow-lists; unauthorized users redirect to `/dashboard`
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:ConsensusSsddComponent` — JSDoc states authority is non-delegable; identifies this as the W3 LangGraph HITL #5 surface; HITL banner confirms mandatory SSA review before award decision
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:ConsensusSsddComponent.sign` — `sign()` enforces `role.currentRole !== 'ssa'` guard at runtime; UI disables Approve button for non-`ssa` callers
- `frontend/src/app/components/consensus-ssdd/consensus-ssdd.component.ts:ConsensusSsddComponent.aiDraft` — AI-draft funding-recommendation narrative; carries inline debt annotations for Items 4 and 5
- `frontend/src/app/services/mock-fixtures.ts:FIXTURE_AUDIT_EVENTS` — audit event `ae-004`: `SSDD.SIGN` action transitioning `PeerReview` from `AWAITING_SSA_SIGNATURE` to `AWARDED`
- `services/ai-orchestrator/app/main.py:eval_ssdd_draft` — `/eval/ssdd-draft` endpoint; always returns `hitl_gate: GATE_4` and `requires_human_review: true`

## Reviewer lens
> The Selecting Official (`ssa`) holds the non-delegable final-approval step on the grants merit-consensus surface (`app.routes.ts:routes` — `/peer-review/:solId/consensus` guard; `ConsensusSsddComponent` JSDoc). This authority is enforced at two layers: the Angular route guard blocks navigation entirely for unlisted roles, and `ConsensusSsddComponent.sign` contains a runtime role check that makes it a no-op for non-`ssa` callers. The role key is inherited from an acquisition baseline and is scheduled for rename/repurpose in W4–W5 (`roles.ts:Role` comment; `roles.ts:ROLE_PROFILES` `ssa` entry). Any migration plan must demonstrate: (1) the replacement role key is wired into both the route guard and `sign()` before the old key is retired; (2) `SSDD.SIGN` audit attribution remains intact under the new role identity (`mock-fixtures.ts:FIXTURE_AUDIT_EVENTS`); (3) single-agency scope (`HHS-ACF`) is preserved and the role is not inadvertently promoted to cross-tenant access; (4) the HITL gate requiring SSA review before the award decision is recorded survives the LangGraph migration.
> Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.205 | Merit review of applications — funding-recommendation approval authority |
