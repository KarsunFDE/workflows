# FDE Modernization Workflow — Design Context & Handoff

> Resume doc. Captures the design of an FDE-style modernization workflow recreated as a
> **Claude Code dynamic workflow**. Pick up where we left off in any terminal.
> Status legend: ✅ locked · 🟡 leaning (not locked) · ⏳ open / pending input.

---

## 1. The assignment (instructor, verbatim)

> "I want you to re-create the Galent Workflows in claude as a group
> https://code.claude.com/docs/en/workflows
> Angular -> React (easier) or NextJS (harder)"

Decoded:
- **"Galent Workflows"** = an FDE-style process (analyze → understand → spec → plan/prototype). A *methodology*, not a tool.
- **"re-create in claude"** = build it as a **Claude Code dynamic workflow** (a JavaScript script that orchestrates subagents; saved to `.claude/workflows/<name>.js`; invoked `/<name>`).
- **"Angular → React (or Next.js)"** = the *subject* the workflow reasons about. This repo's frontend is Angular; modernization target is React (easier) or Next.js (harder).

## 2. What a Claude Code dynamic workflow IS (mechanic)

- A **JS script** that spawns and coordinates many Claude **subagents**. Runs in background.
- Primitives: `meta` (header), `phase()`, `agent(prompt, opts)`, `parallel([...])`, `pipeline(items, ...stages)`, `log()`.
- Intermediate results live in **script variables**, not a chat context → can span the **entire repo regardless of size** via fan-out (1 agent per file), bounded only by per-agent context, never one chat's window.
- Saved to `.claude/workflows/` (project, shared via repo) or `~/.claude/workflows/` (personal). Invoked `/<name>`. Accepts `args`.
- **The script is static; output is generated only when run.** Run N times → N reports. Script unchanged.
- Limits: ≤16 concurrent agents, 1000 agents/run total. No mid-run user input. No direct FS/shell from script (the *agents* read/write/run).
- Docs: https://code.claude.com/docs/en/workflows

### Deliverable distinction (was a point of confusion)
- **Script** = the machine. Holds persona system prompts + orchestration. The reusable deliverable.
- **Output report (markdown)** = what a run produces. The analysis/plan a human (or BA persona) approves.
- System prompts live in the **script**, NOT in the output report.
- For grading: submit **script** (the machine) + **one sample run output** (proof it works).

## 3. Galent's actual FDE process (from galent.com, cited)

Galent = real AI-native engineering firm. Published FDE process:
- **Four agile phases:** (1) Problem Decomposition & Scoping, (2) Rapid Prototyping & Iteration,
  (3) Optimization & Hardening, (4) Deployment & Feedback Loop.
- **Operating model:** Scope → Sequence → Build → Ship → Measure.
- **Principle:** "engineering empathy" — understand the problem before solving it.
- Sources: https://galent.com/insights/blogs/beyond-the-build-why-forward-deployed-engineers-are-the-new-face-of-tech/ · https://galent.com/ · https://code.claude.com/docs/en/workflows
- NOTE: Galent's specific numbers/examples are illustration only — **do NOT put their numbers/examples in our deliverable.** Used only to derive guardrails.

### Galent's internal + external analysis (key concept we mimic)
- Galent has an **internal** analysis process + an **external** one. External uses Claude Code to
  **verify the internal analysis** AND do its **own** analysis on top, **rating internal accuracy**.
- Purpose: mitigate bias, fresh perspective.
- **We have no internal platform** → we mimic the two-arm review with **two Claude agents** (blind A/B)
  when no pre-existing internal analysis exists.

## 4. Constraints (current)

| Action on this repo | Status |
|---|---|
| **Read** code | ✅ Required — exhaustive, cited, no guessing |
| **Change** app code | ✅ NOT until instructor approves the workflow |
| Workflow may **prototype** code | ✅ Allowed, but only into an **isolated sandbox**, never mutating the Angular app. Output location ⏳ pending team consult. |
| Framework scope | ✅ Generic / agnostic of group's other projects; this project injects its own personas |

## 5. The 5 analysis invariants (generalized — no Galent specifics)

1. **Total coverage** — every file enumerated by filesystem walk; read-vs-found reconciled; gaps logged.
2. **Independent corroboration** — ≥2 blind perspectives; uncorroborated findings flagged, not dropped.
3. **Duplication awareness** — repeated logic clustered, not counted as distinct features.
4. **Code-not-comment evidence** — findings tagged real-code vs comment-only; "ghosts" demoted.
5. **Data inventoried & schema-linked, not inferred** — every schema file tied to entities + rules it defines;
   orphaned schemas and missing schemas both flagged.

## 6. ✅ ANALYSIS ARM — locked spec

Reads whole repo. Writes nothing to repo. Output = one markdown report.

```
Ph0  DISCOVER      filesystem walk, whole repo, every file by ext -> work-list
                   (NOT import-graph -- avoids invisible domains)

Ph1  READ          pipeline, 1 agent per file, reads FULL, no guessing
   default (no internal analysis):  Analyst A || Analyst B  -- blind, IDENTICAL lens,
                                    both capture business rules/constraints
   if internal.md passed:           Claude external || internal doc
   finding = {claim, file, lineStart, lineEnd, type:feature|data|rule|flow,
              evidence_type: code|comment-only}

Ph2  MERGE         cross-file barrier:
                   - dedup -> duplicated_at:[...]        (invariant 3)
                   - ghost-hunt -> demote comment-only   (invariant 4)
                   - data/schema inventory               (invariant 5):
                       classify schema-defining vs data-bearing;
                       if no schema files -> reconstruct implicit shape from code (TS interfaces,
                         models, form defs), cite file:line;
                       link schema -> entity -> consumers;
                       flag orphaned schema (on disk, unreferenced) + missing schema (used, undefined)

Ph3  RECONCILE     adjudicator compares A vs B (or external vs internal):
                   agree->confirmed | conflict-> ADJUDICATOR RE-READS file:line
                   (3rd tiebreaker agent only if still unresolved) | only-one->coverage gap
                   -> agreement / accuracy score

Ph4  CLUSTER       group findings by DOMAIN CAPABILITY (cross-check vs dir structure)
                   -> "how many features, what groups"

Ph5  SCOPE         tag each cluster: in-scope (Angular->React target) | out-of-scope (backend/infra,
                   mapped not touched) | boundary (talks to in-scope; contract must hold)

Ph6  COMPLETENESS  gate: every work-list file read? log gaps. NO silent truncation.

Ph7  REPORT        analysis.md: capability clusters, evidence table (file:line), scope map,
                   schema map (markdown table: entity|field|type|constraint|file:line),
                   duplication/ghost/orphan sections, A-vs-B (or external-vs-internal) score
```

Locked detail decisions:
- ✅ Internal analysis usually absent → A/B blind mode is default. If present, markdown format.
- ✅ Whole repo analyzed (so scope classification is accurate; nothing invisible).
- ✅ Two **identical-lens** blind analysts (not diverse-lens) — they are the synthetic "internal reviewer."
- ✅ Both analysts capture business rules/constraints.
- ✅ Group by **domain capability**, cross-checked vs directory structure.
- ✅ Conflicts → **adjudicator re-reads** the disputed file:line; 3rd agent only as fallback.
- ✅ Schema map = **report-only** (markdown table). No JSON artifact yet (add later if prototype arm consumes it).
- ✅ "No schema files" is a normal case → reconstruct shape from code, flag missing where truly undefined.

## 7. 🟡 PLANNING ARM — sketched, NOT locked

Runs after analysis. Consumes the verified capability map + scope map.
Maps to Galent Scope→Sequence→Build→Ship→Measure.

```
Research      web-search: Angular feature -> React/Next equivalent, breaking changes, tooling
              (deep-research style adversarial cross-check)
Persona pass  domain personas (CO / COR / OIG) review what must not regress + business-purpose Qs;
              BA persona synthesizes (forced schema: business_purpose, end_user, end_user_value,
              play_type: solution|sales)
Spec          architect: per-capability target-state spec, strangler-fig sequencing
Prototype     (allowed) emit React/Next prototype into ISOLATED SANDBOX only  [location ⏳]
Critic gate   one critic per domain lens, refute-mode (e.g. OIG: audit trail survive?); majority vote;
              gaps loop back (bounded rounds)
Synthesize    ModernizationPlan.md
```

## 8. Agent configurability (mimic Galent "create/modify agents, prompts, skills, tools, task steps")

Claude Code primitives = the config surface (Galent GUI → editable files/strings):

| Galent knob | Claude primitive |
|---|---|
| create agent | subagent (`.claude/agents/*.md`) OR inline prompt string |
| prompt structure | agent system prompt (file body or string const) |
| tools | tool allowlist (`tools:` frontmatter / opts) |
| skills | `.claude/skills/` referenced in prompt |
| task steps | the workflow `.js` (phases + agent calls + pipeline/parallel order) |

🟡 **OPEN — not locked.** Two options for where personas live:
- **(A) Externalize** as `.claude/agents/*.md` — Galent-like, each agent its own inspectable/configurable artifact; reusable across workflows. Cost: file sprawl, config-heavy.
- **(B) Single-file, config block at top** — one workflow `.js` with a `PERSONAS` object + `TOOLS` const at top, steps below. `agent(prompt)` takes raw strings so no separate files needed. Far lighter; still hits every knob.
- 🟡 Current lean: **(B) single-file config block** for one analysis workflow; graduate to (A) only if a persona is reused across multiple workflows or grows large. **User said "don't lock this in yet."**

## 9. This project's persona pack (federal contracting)

- Domain personas (project-specific system prompts): **Contracting Officer (CO)**, **COR**
  (Contracting Officer's Representative), **OIG** (Office of Inspector General), + others TBD.
- Craft personas (generic FDE machinery): Analyst (x2 blind), Adjudicator, Researcher, BA,
  Architect, Decomposer, Critic.

## 10. Status / open questions

| Item | Status |
|---|---|
| Analysis arm spec | ✅ locked (§6) |
| Planning arm | 🟡 sketched (§7) |
| Persona externalize vs single-file | 🟡 leaning single-file; NOT locked (§8) |
| Output / prototype sandbox location | ⏳ pending team consult (sibling dir / scratch dir / git worktree) |
| Save location of workflow script | ⏳ project `.claude/workflows/` (group-shared) vs `~/.claude/workflows/` (personal) |
| Internal analysis format | ✅ markdown, only if it ever exists |
| React vs Next.js target | ⏳ parametrize via `args`; default TBD |
| Build `/fde-analyze` script | ⏳ not started — draft when ready |

## 11. Next step when resuming

Likely: draft `/fde-analyze` (analysis arm only, §6) as a runnable single-file workflow script,
so one working piece can be shown. Planning arm (§7) is a second workflow built after.
Confirm §8 (single-file vs externalize) and §10 open items before writing.
