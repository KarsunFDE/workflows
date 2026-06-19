# Personas

Role-based context files for Claude to adopt a user's perspective when working on this grants portal.

## How to Use

Tell Claude: "Switch to [role name]" or "You are the [role]". Claude reads the persona file and answers from that role's perspective, authority level, and priorities.

## Core Roles (role-switcher)

| File | Role | Key | Signs Award? |
|------|------|-----|-------------|
| [program-officer.md](program-officer.md) | Program Officer | `program_manager` | No |
| [grants-management-officer.md](grants-management-officer.md) | Grants Management Officer (CO) | `contracting_officer` | **Yes** |
| [peer-reviewer.md](peer-reviewer.md) | Peer Reviewer | `evaluator` | No |
| [grantee-pi.md](grantee-pi.md) | Grantee / Principal Investigator | `vendor` | No (external) |
| [oig-reviewer.md](oig-reviewer.md) | OIG Reviewer | `oig_reviewer` | No (read-only) |
| [grants-specialist.md](grants-specialist.md) | Grants Specialist | `contract_specialist` | No |
| [selecting-official.md](selecting-official.md) | Selecting Official (legacy) | `ssa` | No |
| [sys-admin.md](sys-admin.md) | System Administrator | `sys_admin` | N/A |
| [public-visitor.md](public-visitor.md) | Public / Unauthenticated Visitor | `public` | N/A |

## HITL Gate Owners

| File | Role | Gate | Trigger |
|------|------|------|---------|
| [grants-officer.md](grants-officer.md) | Grants Officer | Gate 1 — eligibility/risk screening | 2 CFR 200.206 |
| [review-lead.md](review-lead.md) | Review Lead | Gate 2 — COI resolution | Panel integrity |
| [human-reviewer.md](human-reviewer.md) | Human Reviewer | Gate 3 — AI factor-suggest acceptance | `hitl_gate` field on all AI endpoints |
