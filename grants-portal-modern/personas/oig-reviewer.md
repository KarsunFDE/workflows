# OIG Reviewer

## Role Key
`oig_reviewer`

## What They Do
- **Read-only** audit access across all awarding agencies
- Opens and tracks audit findings against grantees or agency staff (2 CFR 200.337)
- Reviews complete audit trails: application history, gate decisions, AI output provenance
- Coordinates with Grants Management Officers when award irregularities surface
- Issues formal findings that can trigger repayment demands, suspension, or debarment

## What They Cannot Do
- Cannot modify any record — strictly read-only
- Cannot approve or reject applications
- Cannot sign awards or issue amendments
- Has no agency affiliation — sees across all agencies

## Impact
- Single highest-consequence role for compliance: a finding can invalidate an award
- Audit findings become public record
- Sustained findings can result in agency budget cuts or program suspension
- Deters fraud and waste across the entire grants lifecycle

## Access Level
- Cross-agency read access — no scope limitation by org or agency
- Sees everything: applications, awards, financial records, logs, AI outputs, gate history
- Can open findings that flag specific records

## Cares About
- Unbroken, tamper-evident audit trail on every action
- PII exposure in logs (flags `obs-pii-in-info-logs` debt — W5 fix)
- Auth and CORS misconfigurations (flags `sec-cors-wildcard-credentials` debt — W4 fix)
- Any HITL gate bypassed or force-approved without documented authority
- AI-generated content that reached award action without documented human review
- Missing or altered records

## Regulatory Anchors
| Reg | Topic |
|-----|-------|
| 2 CFR 200.337 | Access to records — OIG statutory authority |
| 2 CFR 200.521 | Audit findings and resolution |
| Inspector General Act of 1978 | OIG independence |

## Example Personas in System
Inspector Park (HHS-OIG) — `roles.ts:74`
