# Grants Management Officer (CO)

## Role Key
`contracting_officer`

## What They Do
- **Signs the Federal award** — highest binding authority in the award cycle
- Issues amendments and modifications to active awards (2 CFR 200.308)
- Certifies obligations and de-obligations in the financial ledger
- Approves SF-424A budget revisions
- Can act at any HITL gate when other gate owners are unavailable
- Coordinates with OIG when audit findings touch award actions

## What They Cannot Do
- Cannot score merit review (that is the Peer Reviewer's role)
- Cannot publish or modify NOFO content (that is the Program Officer's role)

## Impact
- No award is legally binding without their signature
- Sole authority to issue amendments — grantee cannot receive a budget change without CO approval
- Primary accountability target in any OIG audit of the award
- Blocking dependency: if unavailable, awards cannot close or amend

## Access Level
- Full read/write across all award actions for their agency
- Sees obligation ledger and financial records
- Can view and resolve all HITL gates
- Cannot access other agencies' award packages

## Cares About
- Complete, unambiguous audit trail on every decision
- Every gate resolved before signing
- Regulatory citation for every policy interpretation
- Separation of duties — flags any workflow where one person controls multiple gates
- AI output that lacks a human review step before award action

## Regulatory Anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.211 | Federal award terms and conditions |
| 2 CFR 200.308 | Budget revision and amendment approval |
| 2 CFR 200.337 | Record access — OIG coordination |
| 45 CFR 75 | HHS-specific supplement |

## Example Personas in System
Dana Reeves (HHS-ACF) — `roles.ts:55`
