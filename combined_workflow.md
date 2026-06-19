# FDE Modernization Workflow — Combined Design (Master)

> Master design doc. Merges the earlier `workflow.md` handoff with the content spec in
> `docs/context/workflow_prompt.txt`. This is the authoritative reference; `workflow.md`
> is the prior snapshot kept for history.
>
> Status legend: ✅ locked · 🟡 leaning (not locked) · ⏳ open / pending input.

---

## 0. File layout — where everything goes in the repo

Default Claude Code paths, so it works with no install step. Invoked as `/fde-analyze`.

```
contract-payment-flow/
├── CLAUDE.md                                  # THIS repo's personas (CO, etc.) — per-repo, evidence-grounded
├── .claude/
│   ├── workflows/
│   │   ├── fde-personas.js                     # persona bootstrap (BUILT) -> /fde-personas
│   │   ├── fde-analyze.js                      # analysis arm      (BUILT) -> /fde-analyze
│   │   └── fde-plan.js                         # planning arm      (BUILT) -> /fde-plan <target>
│   ├── skills/
│   │   └── fde-analysis/SKILL.md               # evidence + clustering + schema + coverage
├── personas/                                   # THIS repo's persona cards (one .md each + README index; written by /fde-personas)
├── CLAUDE.md                                   # lean pointer only (~15 lines) — NOT the personas
├── combined_workflow.md                        # THIS design doc (master)
└── workflow.md                                 # prior snapshot (history)
```

Rules of placement (per Claude Code best practices):
- **Workflows** must be in `.claude/workflows/` to be invokable as `/name`.
- **Skills** must be in `.claude/skills/<name>/SKILL.md` to auto-register. Only frontmatter (~100 tok) is always-loaded; bodies load on trigger.
- **Personas live in `personas/*.md` cards** (one file per persona + a `personas/README.md` index; written by `/fde-personas`), NOT in CLAUDE.md. CLAUDE.md loads every session, so it stays a lean pointer — bloating it makes Claude ignore real instructions ([best practices](https://code.claude.com/docs/en/best-practices)).
- To share across groups: package `.claude/workflows` + `.claude/skills` as the engine; each repo generates its own `personas/*.md` cards via `/fde-personas`. See §12.

---

## 0.1 The workflows — what exists, what each does, when to call

Three workflows + one skill make up the engine. All BUILT.

| Command | What it does | When to call | Writes? |
|---|---|---|---|
| `/fde-personas` | Discovers stakeholder personas from the repo (roles, routes, regulation refs, audit actors, README), synthesizes an evidence-grounded card + reviewer lens for each, and **writes one canonical card per persona to `personas/<slug>.md`** (+ a `personas/README.md` index; preserves anything already curated). | **First**, once per repo (or when stakeholders change). A new group runs this so they never hand-author personas. | `personas/*.md` |
| `/fde-analyze` | **v3 default (token-frugal):** structural MAP pass (local CLI `repomix --compress`/`ctags`/`ripgrep` — near-zero AI tokens) gives 100% whole-repo coverage + surfaces dup/ghost/missing-schema cheaply → tier files → **deep-read only in-scope+boundary** → cluster → schema map → personas → **report**. Flags: `{full:true}` deep-reads every file (old v2), `{thorough:true}` blind dual-analyst, `{pathPrefix,maxFiles}` scope a test. Ends presenting options (no auto-pick). | **Second**, before any modernization. Run many times. | nothing (report to session) |
| `/fde-plan <target>` | Takes a chosen target (`react`\|`nextjs`) + the analysis. Research Angular→target mapping → user stories → **persona review (refute-mode)** → spec-level migration plan + roadmap/risk/rollback/test → critic gate → **ModernizationPlan**. Optional prototype into a sandbox dir. | **Third**, after a human reads the analysis and picks a target. `args: {target, analysisReport?, sandboxDir?}`. | report only (prototype only if `sandboxDir` given) |

Run order:
```
/fde-personas   → bootstrap personas/*.md cards from this repo's code   (once)
/fde-analyze    → analysis report, presents target options     (repeatable)
   [human picks react or nextjs]
/fde-plan react → spec-level migration plan                    (after selection)
```

Skill (1): `fde-analysis` (evidence discipline + capability clustering + schema extraction + coverage). Personas are generated directly by `/fde-personas` as canonical `personas/*.md` cards (code-cited, each with a Reviewer lens) — the former `persona-synthesis` skill is retired.

---

## 1. Goal

Recreate an FDE-style modernization process (Galent's "Galent Workflows") as a **Claude Code dynamic
workflow** — a JavaScript script that orchestrates subagents, saved to `.claude/workflows/<name>.js`,
invoked `/<name>`.

- **Galent Workflows** = an FDE-style process (analyze → understand → spec → plan/prototype). A *methodology*, not a tool.
- **Subject** = an Angular → React (easier) or Next.js (harder) frontend modernization. This repo's frontend is Angular.

> **Report-only is a TEMPORARY design choice.** Right now the workflow only reads the repo and produces
> reports/specs — it does not edit the app. This is deliberate until the approach is approved. Once approved,
> the scope extends (prototype into sandbox now; later, point it at real source). The output format
> (report-only, no JSON, no code edits) is a current bound, not a permanent decision.

## 2. What a Claude Code dynamic workflow IS (mechanic)

- A **JS script** that spawns and coordinates many Claude **subagents**. Runs in background.
- Primitives: `meta` (header), `phase()`, `agent(prompt, opts)`, `parallel([...])`, `pipeline(items, ...stages)`, `log()`.
- Intermediate results live in **script variables**, not a chat context → can span the **entire repo regardless of size** via fan-out (1 agent per file), bounded only by per-agent context, never one chat's window.
- Saved to `.claude/workflows/` (project, shared via repo) or `~/.claude/workflows/` (personal). Invoked `/<name>`. Accepts `args`.
- **The script is static; output is generated only when run.** Run N times → N reports. Script unchanged.
- Limits: ≤16 concurrent agents, 1000 agents/run total. **No mid-run user input.** No direct FS/shell from script (the *agents* read/write/run).
- Docs: https://code.claude.com/docs/en/workflows

### Deliverable distinction
- **Script** = the machine. Holds agent prompts + orchestration. The reusable deliverable.
- **Output report (markdown)** = what a run produces. The analysis/plan a human (or BA persona) approves.
- System prompts live in the **script**, NOT in the output report.
- For grading: submit **script** + **one sample run output** (proof it works).

## 3. Galent's FDE process (galent.com, cited)

- **Four agile phases:** (1) Problem Decomposition & Scoping, (2) Rapid Prototyping & Iteration, (3) Optimization & Hardening, (4) Deployment & Feedback Loop.
- **Operating model:** Scope → Sequence → Build → Ship → Measure.
- **Principle:** "engineering empathy" — understand the problem before solving it.
- Sources: https://galent.com/insights/blogs/beyond-the-build-why-forward-deployed-engineers-are-the-new-face-of-tech/ · https://galent.com/ · https://code.claude.com/docs/en/workflows
- **Galent's specific numbers/examples are illustration only — do NOT put them in our deliverable.** Used only to derive guardrails.

### Internal + external analysis (the core idea we mimic)
- Galent runs an **internal** analysis + an **external** one. External uses Claude Code to **verify the internal analysis** AND do its **own** on top, **rating internal accuracy**. Purpose: bias mitigation, fresh perspective.
- We have no internal platform → mimic with **two blind Claude agents (A/B)** when no internal analysis exists.

## 4. Relationship to `docs/context/workflow_prompt.txt`  *(NEW — §13 fold-in)*

`workflow_prompt.txt` is a **single-agent mega-prompt**: 12 ordered discovery phases, full content spec, evidence + confidence required. It is the **WHAT**.

- It is the **content spec + analyst system prompt** — we do NOT reinvent the analyst prompt; we **decompose this file into per-phase agent prompts.**
- It has **no reliability mechanism** — no dual review, no completeness gate, no dedup, no bias mitigation. One agent, one pass = exactly the Galent first-pass failure mode.
- **Our workflow is the rigor layer it lacks** (the **HOW**): fan-out + blind A/B + adjudication + completeness gate wrapped around this content.
- Net: `workflow_prompt.txt` = the menu; our orchestration = reliable multi-agent execution of it.

## 5. Constraints (current)

| Action on this repo | Status |
|---|---|
| **Read** code | ✅ Required — exhaustive, cited, no guessing |
| **Change** app code | ✅ NOT until instructor approves the workflow |
| Workflow may **prototype** code | ✅ Allowed, but only into an **isolated sandbox**, never mutating the Angular app. Location ⏳ pending team consult |
| Framework scope | ✅ Generic / agnostic of group's other projects; each project injects its own context (see §12) |

## 6. The analysis quality invariants

Generalized from Galent's failure modes (no Galent specifics):

1. **Total coverage** — every file enumerated by filesystem walk; read-vs-found reconciled; gaps logged.
2. **Independent corroboration** — ≥2 blind perspectives; uncorroborated findings flagged, not dropped.
3. **Duplication awareness** — repeated logic clustered, not counted as distinct features.
4. **Code-not-comment evidence** — findings tagged real-code vs comment-only; "ghosts" demoted.
5. **Data inventoried & schema-linked, not inferred** — every schema file tied to entities + rules it defines; orphaned + missing schemas both flagged.
6. **Evidence discipline** *(NEW)* — never present assumptions as facts; **separate Facts / Inferences / Recommendations**; every inferred conclusion carries a **confidence score**. Agreement between blind agents A and B is the confidence signal.

## 7. Canonical phase list — adopted from `workflow_prompt.txt` (12 phases)  *(NEW — replaces old 8-phase list)*

| Phase | Source-prompt name | Arm |
|---|---|---|
| 1 | Repository Discovery | Analysis |
| 2 | Database Discovery | Analysis |
| 3 | Service Discovery | Analysis |
| 4 | Architecture Discovery | Analysis |
| 5 | Business Capability Discovery | Analysis |
| 6 | Workflow Discovery | Analysis |
| 7 | User Persona Discovery | Analysis (see §9) |
| 8 | User Story Generation | Planning |
| 9 | Technical Debt Assessment | Analysis |
| 10 | Security Assessment | Analysis |
| 11 | Modernization Assessment (present profiles, do NOT auto-pick) | Analysis → handoff |
| 12 | Interactive Modernization Planning + Implementation Planning | Planning (separate workflow — see §11) |

Primary objective questions the report must answer (prompt lines 32-43): what it does · why it exists · business problem · who uses it · workflows · services · databases · integrations · tech debt · security risks · modernization opportunities · what a new engineer learns first.

## 8. ✅ ANALYSIS ARM — locked spec (orchestration layer over Phases 1-11)

Reads whole repo. Writes nothing to repo. Output = one markdown report.

```
Ph0  LOAD          loader agent reads ./fde.config.* (personas/context/doc paths) -> cfg   [see §12]

Ph1  DISCOVER      filesystem walk, whole repo, every file by ext -> work-list
                   (NOT import-graph -- avoids invisible domains)

Ph2  READ          pipeline, 1 agent per file, reads FULL, no guessing
   default (no internal analysis):  Analyst A || Analyst B  -- blind, IDENTICAL lens,
                                    both capture business rules/constraints
   if internal.md passed:           Claude external || internal doc
   extraction checklist (prompt 97-141): languages, frameworks, services, modules, APIs,
     controllers, routes, DTOs, repositories, models, event handlers, scheduled/batch jobs,
     shared libs, auth(n/z), integrations, queues, workers
   finding = {claim, file, lineStart, lineEnd, type:feature|data|rule|flow|service|debt|security,
              evidence_type: code|comment-only, confidence: 0-1}
   NOTE single-file-too-big-for-context: if a file exceeds an agent's context, split into
        line-range chunks, 1 agent per chunk, stitch findings. Size-agnostic guarantee holds.

Ph3  MERGE         cross-file barrier:
                   - dedup -> duplicated_at:[...]        (invariant 3)
                   - ghost-hunt -> demote comment-only   (invariant 4)
                   - data/schema inventory (invariant 5, enriched from prompt 144-198):
                       tables/collections/columns/relationships/constraints/indexes/views/
                       triggers/stored-procs; per entity: purpose, business meaning,
                       relationships, importance score (1-10), ownership domain;
                       maps: entity inventory, relationship map, domain map, data-flow map;
                       highlight: duplicate entities, missing constraints, data-quality,
                       poor normalization, bottlenecks;
                       if no schema files -> reconstruct implicit shape from code, cite file:line;
                       flag orphaned schema + missing schema

Ph4  RECONCILE     adjudicator compares A vs B (or external vs internal):
                   agree->confirmed (high confidence) | conflict-> ADJUDICATOR RE-READS file:line
                   (3rd tiebreaker agent only if still unresolved) | only-one->coverage gap
                   -> agreement / accuracy / confidence scores

Ph5  CLUSTER       group findings by DOMAIN CAPABILITY (cross-check vs dir structure)
                   per capability (prompt 275-313): description, supporting services/data/workflows,
                   users, business value, criticality (Critical/High/Medium/Low)

Ph6  MAP           entity->business + service->business (prompt 365-399):
                   business meaning, users, related workflows, criticality,
                   WHAT BREAKS IF REMOVED / operational impact if unavailable
                   workflow discovery (prompt 316-362): name, trigger, actors, systems, data,
                   outcome, confidence + text diagrams

Ph7  SCOPE         tag each cluster: in-scope (Angular->React target) | out-of-scope (backend/infra,
                   mapped not touched) | boundary (talks to in-scope; contract must hold)

Ph8  ASSESS        tech debt (prompt 459-493) + security (prompt 496-514) lenses:
                   each finding: description, impact, severity (Critical/High/Med/Low), evidence, recommendation

Ph9  COMPLETENESS  gate: every work-list file read? log gaps. NO silent truncation.

Ph10 REPORT        analysis.md (prompt 423-457, 731-763): exec summary; system purpose; arch overview;
                   technology/service/data/integration/dependency/workflow inventories;
                   capability clusters; persona discovery (§9); scope map; schema map (markdown table);
                   duplication/ghost/orphan sections; tech-debt + security; brownfield onboarding
                   (what to learn first); A-vs-B (or external-vs-internal) score.
                   FORMAT: separate Facts / Inferences / Recommendations; confidence scores throughout;
                   ENDS by PRESENTING modernization profiles (does NOT auto-pick) -> handoff to planning arm.
```

Locked detail decisions (carried from prior doc):
- ✅ Internal analysis usually absent → A/B blind mode is default. If present, markdown format.
- ✅ Whole repo analyzed (accurate scope; nothing invisible). Size-agnostic via fan-out + per-file chunking.
- ✅ Two **identical-lens** blind analysts (synthetic "internal reviewer").
- ✅ Both analysts capture business rules/constraints.
- ✅ Group by **domain capability**, cross-checked vs directory structure.
- ✅ Conflicts → **adjudicator re-reads** disputed file:line; 3rd agent only as fallback.
- ✅ Schema map = **report-only** (markdown table). No JSON artifact yet.
- ✅ "No schema files" → reconstruct shape from code, flag missing where undefined.

## 9. Personas — DISCOVERED vs REVIEWER  *(NEW — rewrites prior §9)*

`workflow_prompt.txt` (230-271) infers personas FROM code — they are not hardcoded. Two distinct uses, previously conflated:

- **Discovered personas** = analysis *output*. Inferred from route names, API names, permissions, roles, DB entities, UIs, docs, service names, audit records. Per persona (prompt 257-271): persona, **confidence score**, supporting evidence, goals, responsibilities, common actions, pain points. Examples the prompt lists incl. *Contract Officer, Auditor, Reviewer, Vendor, Administrator*.
- **Reviewer personas** = stakeholder lenses used in the planning arm to pressure-test the modernization plan.
- ✅ **Resolution: discovered personas SEED the reviewer lenses.** No hardcoding. If CO / COR / OIG are real, they emerge from the code with evidence; the planning arm then reviews through those same evidence-backed lenses. This also removes personas from the engine entirely (engine discovers; nothing baked) — see §12.

## 10. 🟡 PLANNING ARM — sketched, NOT locked (Phases 8, 11-12 + Implementation)

Runs AFTER analysis, as a **separate workflow** (see §11). Consumes the verified capability map + scope map + discovered personas. Maps to Galent Scope→Sequence→Build→Ship→Measure.

```
Profiles      present modernization profiles (prompt 616-650), e.g. React / Next.js bundles; user picks BETWEEN runs
Research      web-search: Angular feature -> React/Next equivalent, breaking changes, tooling
              (deep-research style adversarial cross-check)
User stories  evidence-backed (prompt 401-419): As a [persona] / I want / So that + acceptance + evidence + confidence
Persona review discovered stakeholder lenses (e.g. CO/COR/OIG) review what must not regress + business-purpose Qs;
              BA synthesis (forced schema: business_purpose, end_user, end_user_value, play_type: solution|sales)
Spec          ✅ SPEC-LEVEL in report: target architecture, migration roadmap, dependency/risk/effort,
              data-migration, validation, rollback, testing, deployment, operational-readiness (prompt 654-678);
              per-component mapping (e.g. ContractForm.component.ts -> ContractForm.tsx, prop/state contracts).
              NO full code in report body. Illustrative before/after diffs only for a few key components.
Prototype     ✅ real React/Next prototype code emitted into ISOLATED SANDBOX only  [location ⏳],
              referenced from the report by path. Never edits the Angular app.
Critic gate   one critic per discovered stakeholder lens, refute-mode; majority vote; gaps loop back (bounded)
Synthesize    ModernizationPlan.md + epics/features/stories/tasks/ADRs/phases/milestones (prompt 682-702)
```

## 11. ⚠️ Interactive planning vs the no-mid-run-input rule — mandates the split  *(NEW)*

`workflow_prompt.txt` Phase 12 (589-612): "WAIT FOR USER SELECTION. Do not continue until the user chooses."
But dynamic workflows have **no mid-run user input** (docs: "run each stage as its own workflow").

✅ **Resolution (validates the two-arm split):**
```
/fde-analyze            -> Phases 1-11, ENDS by presenting modernization profiles (no auto-pick)
   [user reads report, picks a profile / target]
/fde-plan <profile>     -> Phase 12 + implementation planning, target passed as args
```
Satisfies the prompt's "present, don't choose" rule AND the workflow mechanic.

## 12. Cross-repo sharing — engine vs config  *(NEW — owed §12)*

Share one **engine**; each repo supplies its own **config**. Script stays byte-identical across groups.

```
ENGINE (generic, same everywhere)        CONFIG (per-repo, group-owned)
   fde-analyze.js / fde-plan.js             fde.config.md (or .json)
   - filesystem walk                          - context / domain notes
   - blind A/B + adjudicate                   - path to internal analysis (if any)
   - invariants, cluster, scope, report       - React vs Next.js target
        ^                                           |
        +------------ loader agent reads at Ph0 ----+
```

- Script can't read FS itself → **Ph0 loader agent** reads `./fde.config.*` from whatever repo it runs in, returns config; later phases use it. Different config per repo, zero script edits.
- Personas are **discovered** (§9), so the engine bakes none — fully agnostic. Config only supplies context + doc paths + target.
- Distribution: **Plugin** (recommended — versioned, one source of truth, all groups pull updates) · shared template repo + copy · git submodule · personal `~/.claude/` (individual only, not group).
- Internal-analysis doc is just a path in config → present = verify mode, absent = blind A/B mode. Same engine.

## 13. Project persona context (federal contracting)

- Likely-discovered domain personas: **Contracting Officer (CO)**, **COR**, **OIG**, + others — confirmed only if evidence appears in code/docs (§9).
- Craft personas (generic FDE machinery, inline in engine): Analyst (x2 blind), Adjudicator, Researcher, BA, Architect, Decomposer, Critic.
- 🟡 Persona prompt location (externalize `.claude/agents/*.md` vs single-file config block): **NOT locked.** §9/§12 lean toward discovered-in-engine + craft prompts inline. Confirm before building.

## 14. Status / open questions

| Item | Status |
|---|---|
| Analysis arm spec | ✅ locked (§8) |
| `/fde-personas` script | ✅ BUILT + ✅ **SMOKE-TESTED** (sonnet, 8 agents, ~370k tok, ~11min; wrote 6 personas) |
| `/fde-analyze` script | ✅ BUILT — sonnet — ⏳ smoke-test launched (scoped: 1 module, maxFiles 8) |
| `/fde-plan` script | ✅ BUILT — sonnet — ⏳ smoke-test launched (`target:react`) |
| All subagents → sonnet | ✅ DONE — model-tags == agent-calls in all 3 (11/11, 3/3, 8/8) |
| MERGE truncation fix | ✅ DONE — batched clustering + merge pass (no silent `slice()` drop) |
| Scope knob (`pathPrefix`/`maxFiles`) | ✅ DONE — bounds cost for test runs; truncation logged + in report |
| 5 analysis skills | ✅ BUILT — `.claude/skills/*` |
| CLAUDE.md (6 personas) | ✅ generated by `/fde-personas` (CO/COR/sys_admin/OIG/DCAA/Vendor); backup `CLAUDE.md.bak` |
| Adopt 12-phase canonical list | ✅ (§7) |
| Personas discovered-vs-reviewer | ✅ resolved (§9) |
| Personas location | ✅ per-repo CLAUDE.md (§0, §9) |
| Interactive-planning split | ✅ resolved (§11) |
| Confidence + Facts/Inferences/Recs | ✅ added (§6, §8) |
| Cross-repo engine/config | ✅ documented (§12) |
| Single-file chunking guarantee | ✅ spec'd (§8 Ph2); ⏳ not yet coded |
| Proposed-change detail level | ✅ spec-level in report + prototype in sandbox (§10) |
| Planning arm (`/fde-plan`) | ✅ BUILT (§10) — ⚠️ untested; prototype gated on `sandboxDir` |
| Output / prototype sandbox location | ⏳ pending team consult |
| Save location (project vs plugin) | ⏳ project `.claude/` now; plugin later for group sharing |
| React vs Next.js target | ⏳ parametrize via args/profiles; default TBD |

## 14b. v3 token-frugal redesign (now the default)

Driven by the smoke-test reality: on a **Pro 5h budget (~2M-token window, shared with claude.ai/Desktop)**, the
old full-read analyze ate ~95% of a window in one run. v3 fixes this.

- **Default = map + tiered read.** A local CLI builds a structural map (signatures only): `npx repomix --compress`
  (tree-sitter; no permanent install if Node present) → `ctags`/`ast-grep` if installed → `ripgrep` fallback
  (**always available, zero install**). Map = 100% coverage + cheap dup/ghost/missing-schema detection. Then only
  **in-scope + boundary** files get a full body read; out-of-scope stays signature-level.
- **Projected cost (200-file repo):** ~700k vs v2 ~1.9M (~⅓) → ~35% of a Pro window vs ~95%. Estimate, pending re-test.
- **Validated against:** Google/Gemini's 4-step plan + official sources — Anthropic [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  & [multi-agent](https://www.anthropic.com/engineering/multi-agent-research-system) (just-in-time retrieval, subagent
  compression, scale-effort-to-complexity), [repomix --compress](https://repomix.com/guide/code-compress),
  [ast-grep](https://ast-grep.github.io/), [ctags](https://docs.ctags.io). Key correction: gitingest is NOT
  signature-only (dumps full text) — use repomix/ctags/grep.
- **Trade-off:** out-of-scope files are mapped at signature level, not body-read → small risk of missing a deep rule
  in skimmed backend code (boundary tier mitigates). `{full:true}` restores uniform deep read.
- **Rollback:** v2 preserved as `.claude/workflows/fde-analyze.v2.bak` AND reachable live via `{full:true}`.
- **No download required** for the team — ripgrep fallback works out-of-box; `npx repomix` (Node only) is the cheaper path.

## 15. Status & next steps

**Done this session:** all subagents → sonnet · MERGE truncation fixed (batched) · scope knob added ·
`/fde-personas` smoke-tested (PASS) · `/fde-analyze` smoke-test #1 caught a real bug (now fixed) · re-running.

**Bug found + fixed (smoke-test #1, run wf_6c50ebdc):** the in-script `PATH_PREFIX` filter
(`files.filter(f => f.startsWith(PATH_PREFIX))`) dropped ALL discovered files (separator/format mismatch
between the agent's returned paths and the forward-slash prefix). Result: discovery → 0 files → the entire
blind-A/B read+reconcile pipeline was skipped, and the report agent improvised a plausible-but-unverified
report (coverage 0/0, agreement N/A). FIX: removed the brittle filter — the discover agent already restricts
by prefix via its prompt; the script keeps only the `maxFiles` cap and reads `work.total` for the denominator.
LESSON: a workflow can finish "successfully" with a polished report while its core mechanism silently no-ops —
always check the reliability/coverage section, not just that a report came out.

**Still to verify / do (team testing tomorrow):**
- Confirm re-run `/fde-analyze` actually fans out (agent count ~3×files, coverage > 0, agreement numeric).
- Confirm `/fde-plan` smoke-test result; fix anything it exposes.
- `/fde-analyze` full (whole-repo) run not yet done — only scoped. Watch agent count + token cost at full scale.
- `/fde-plan` prototype emission gated behind `args.sandboxDir` — pick the sandbox location (team consult).
- Single-file chunking for oversized files (§8 Ph2) — still spec-only, not coded.
- Verify workflow subagents actually auto-load `.claude/skills` (critical rules are also inlined as fallback).

## 16. Sending the engine to the team

**Ship the ENGINE only** — each repo bootstraps its own personas:
```
.claude/workflows/   (fde-personas.js, fde-analyze.js, fde-plan.js)
.claude/skills/       (fde-analysis)
```
**Do NOT ship:** `personas/`, `CLAUDE.md`, `*.bak` (your repo's personas). `combined_workflow.md` +
`fde-engine-SETUP.md` + `fde-engine-WHATS-NEW.md` ARE included in the zip as reference.

**Their setup (no building — copy + run):**
```
1. drop .claude/workflows + .claude/skills into their repo
2. /fde-personas    → generates THEIR personas/*.md cards from THEIR code
3. /fde-analyze     → analysis report (start scoped: args {pathPrefix, maxFiles})
4. /fde-plan react  → migration plan
```
All subagents are pinned to sonnet inside the scripts. Tell them to start `/fde-analyze` scoped
(`maxFiles`) before a full-repo run, since cost scales with file count.

## 17. v4 — target-neutral modernization assessment (PLANNED, not built)

**Problem found (design bias):** the current engine is a *frontend-migration* tool wearing a *general-modernization*
label. `/fde-analyze`'s read + findings are target-neutral, BUT its **Scope phase, §8, and all of `/fde-plan`
presuppose "the goal is Angular → React/Next."** Consequences:
- Backend / DB / infra / security / deps needs are *discovered* (debt+security findings span the repo) but
  **deprioritized**: out-of-scope files are read only at signature level, tagged out-of-scope, and **never planned**.
- If React/Next is the wrong call, the analysis still informs but the **prioritization misleads** — you'd optimize
  the frontend while deeper debt sits unread elsewhere.
- This narrowed the original `workflow_prompt.txt` Phase 11 ("Modernization Assessment") + Phase 12 ("do NOT
  auto-choose targets, present options") intent, which we lost when scoping to frontend in/out/boundary.

**v4 fix — insert a neutral assessment BEFORE scoping/planning:**
```
/fde-analyze (neutral)
   whole-repo map + read → RANK modernization vectors objectively:
     frontend framework · backend version (e.g. Spring Boot) · database · infra · security · deps · tech-debt
   → recommend highest-value target(s) WITH rationale + rough effort (do NOT assume frontend)
   [human picks WHAT to modernize — could be React, could be Spring Boot upgrade, could be DB/infra]
/fde-plan <chosen target>   ← becomes a GENERAL modernization planner, not just frontend-migration
```
Concrete changes:
- `/fde-analyze`: add a **Modernization Opportunity Assessment** section (ranked, target-neutral) ahead of the
  frontend-specific scope/§8. Keep whole-repo coverage; stop hard-coding "frontend = in-scope".
- `/fde-plan`: generalize beyond Angular→React/Next. Two task *shapes* to support:
  (a) **cross-framework migration** (Angular→React/Next — current), (b) **same-framework upgrade**
  (e.g. Angular 14→19, Spring Boot 2→3) — research = inter-version breaking changes + `ng update`/migration
  guides; spec = API/pattern updates, NOT file-to-file translation. Possibly a `mode: migrate|upgrade` arg or a
  thin `/fde-upgrade` sibling. Loosen the `react|nextjs` target guard.
- Net: the **codebase drives the goal**, instead of React/Next being presupposed.

## 18. RESUME — current state for a fresh Claude window

> Point a new window at THIS file (`combined_workflow.md`) first. Snapshot as of 2026-06-19.

**Built + in `.claude/` (all sonnet, syntax-clean):**
- `workflows/fde-personas.js` — discover personas → writes canonical `personas/*.md` cards + `personas/README.md` index. ✅ smoke-tested (earlier version wrote a single `.claude/personas.md`).
- `workflows/fde-analyze.js` — **v3 default**: map (repomix→ctags→ripgrep) + tiered deep-read. ✅ smoke-tested
  (repomix tier, 100% coverage, 22% deep-read). Flags `{full,thorough,pathPrefix,maxFiles}`. v2 saved as
  `fde-analyze.v2.bak` + reachable via `{full:true}`.
- `workflows/fde-plan.js` — Angular→`{target}` plan. ⚠️ not full-run-tested (beta).
- `skills/fde-analysis` (skills merged 5 → 1; `persona-synthesis` retired — personas now generated directly by `/fde-personas` as `personas/*.md` cards).
- Both report agents now **write a local `.md`** (`fde-analysis-report.md`, `fde-modernization-plan.md`) before returning.

**Token optimizations done this session:** sonnet everywhere · lean batch read default (was per-file dual) ·
MERGE batched (no silent truncation) · web OFF by default in `/fde-plan` · personas moved CLAUDE.md → `.claude/personas.md`
(on-demand, per best practices) · CLAUDE.md slimmed to a pointer · skills 5→2 · descriptions tightened.
Projected `/fde-analyze` full-repo ~700k–1M tokens (Pro 5h window ≈ a couple million, shared) → **scope on Pro**.

**Deliverable:** `fde-engine.zip` (engine + WHATS-NEW + SETUP + design doc; excludes personas/CLAUDE/bak).
Sample output: `fde-analyze-sample-report.html`.

**Open / next:**
- Build **v4** (§17) — target-neutral assessment + general `/fde-plan` (migrate vs upgrade). Biggest pending item.
- Full-run-test `/fde-plan`; full-repo `/fde-analyze` cost is projected, not measured.
- Single-file chunking for oversized files (§8 Ph2) — spec'd, not coded.
- Decide `/fde-plan` sandbox location (prototype emission, gated on `{sandboxDir}`).
- Cross-group sharing: project `.claude/` now; plugin later (§12).

**Watch-outs (lessons):** a workflow can finish with a polished report while its core silently no-ops — always
check the coverage/reliability section. Reports are report-only by design (now also written to a local `.md`).
