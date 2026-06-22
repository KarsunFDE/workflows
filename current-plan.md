# FDE Engine — Current Plan & Review (resume doc)

> Living status/plan doc so work can resume from any Claude terminal. Snapshot: 2026-06-22.
> Authoritative design = `combined_workflow.md`. This file = current state + roadmap + last review.

---

## Goal
Mimic **GalentAI's 7-step app-modernization** process as Claude Code dynamic workflows. Must be
**target-neutral** (eventual goal = React frontend, but the engine must NOT hard-wire it — the target
is a CLIENT decision, instructor acting as client wants React), and must run within a **Pro token budget**.

### GalentAI 7 steps → coverage
| # | Step | Status |
|---|---|---|
| 1 | Ingest sources | ✅ repo on PC = the platform |
| 2 | Analyze (features/data/how-it-works) | ✅ `/fde-analyze` (map + deep-read; blind A/B under `{thorough}`) |
| 3 | Target state agreed WITH client (no framework assumed) | ⚠️ PARTIAL — engine presupposes Angular→React/Next; target-neutral assessment NOT built (see §17 of combined_workflow + P1 below) |
| 4 | Implementation specs WITH documented code snippets | ⚠️ PARTIAL — `/fde-plan` SPEC is contract-only; no code snippets (prototype only if `sandboxDir`) |
| 5 | Epics & stories + BA review | ⚠️ PARTIAL — stories + persona refute-review exist; no explicit epic→story hierarchy/BA gate |
| 6 | Subtasks (single-engineer) | ❌ not built |
| 7 | Implementation agents plan(opus)+act(sonnet) | ❌ not built; all agents pinned sonnet |

---

## Repo layout (Model A)
Engine lives in the shared repo **KarsunFDE/workflows**. Teammates copy `.claude/` into their OWN project
repo and run the workflows there. Per-project folders here = central versioned storage of each repo's
persona cards + config (NOT an auto-discovery location).

```
.claude/workflows/   fde-personas.js  fde-analyze.js  fde-plan.js  (fde-analyze.v2.bak = rollback)
.claude/skills/      fde-analysis/
combined_workflow.md  fde-engine-SETUP.md  how-this-workflow-was-built.md  fde-analyze-sample-report.html
current-plan.md  (this file)
contract-payment-flow/  grants-portal-modern/  foia-response-pipeline/   ← per-project storage (personas/, config)
```

## The three workflows (all sonnet, report-only, no app edits)
- **`/fde-personas`** — INVENTORY existing cards (git staleness, symbol-range) → DISCOVER → SYNTHESIZE (re-read
  only cited evidence) → WRITE (per-persona) → INDEX. Writes ONE canonical card per persona to `personas/<slug>.md`
  + `personas/README.md` index. Self-contained (persona-synthesis skill retired). Run once per repo, then after
  code changes — **incremental**: reuses unchanged canonical cards, only (re)builds new/stale ones.
- **`/fde-analyze`** — token-frugal: structural MAP pass (`repomix --compress` → `ctags` → `ripgrep`, 100%
  coverage, near-zero AI tokens) → SCOPE-tier → deep-read ONLY in-scope+boundary (lean batches of 6; blind
  A/B + adjudicator if `{thorough:true}`) → MERGE (cluster/schema/personas) → REPORT (writes
  `./fde-analysis-report.md`, ends presenting React vs Next). Flags `{full,thorough,pathPrefix,maxFiles}`.
- **`/fde-plan <react|nextjs>`** — load reviewer lenses from persona cards → research → user stories →
  refute-mode persona review → SPEC (component map, NO full code) → optional sandbox prototype → critic gate
  → REPORT (`./fde-modernization-plan.md`).

### Run order
```
/fde-personas              (once per repo)
/fde-analyze {pathPrefix,maxFiles}   ← SCOPE IT FIRST on Pro budget; no-args = full repo (once-per-window batch)
   [human reads report, picks target]
/fde-plan react
```

## Persona card canonical standard (PR #5, merged)
One fixed schema for every group (fixed cross-group drift between foia/grants/contract-payment-flow):
```
# Persona: <Name>
- Role id · Class · Regulatory basis        (optional lines)
## Summary
## What they can do
## What they cannot do
## Constraints / authority limits
## Impact on the system
## Pain points
## Evidence (file:symbol)      ← code citations only (file:symbol preferred — stable anchor, survives edits); powers /fde-analyze corroboration
## Reviewer lens               ← explicit; powers /fde-plan refute review (ends "Default to REFUTE…")
## Regulatory anchors          (optional table)
```
Rules: roles-not-people, Evidence = code `file:symbol` (stable anchor — survives edits; raw line only where no
symbol applies; regs → Regulatory anchors), fixed section set.
Loaders read `personas/*.md` (fallback `.claude/personas.md` → `CLAUDE.md`); read `## Reviewer lens`/
`## Evidence` verbatim if present, else derive. Team will regenerate their cards via `/fde-personas` on
their own time (back-fills old drifted cards to canonical).

---

## Architecture decisions (locked)
- **Two-arm split + human gate between runs** — mandated by the no-mid-run-input limit; human picks target
  between `/fde-analyze` and `/fde-plan`. CONFIRMED correct (do not "fix away").
- **Target = run parameter, not baked.** Engine-neutral; the run is TOLD the target (arg). Analysis base is
  target-AGNOSTIC → reused across pivots; only downstream arms re-run on a pivot.
- **Token control = per-run checkpoints (.md handoff) + human gates + fan-out caps + map-before-read.**
- **AI informs/drafts; client decides the target.** Step 3 = human agreement, AI = decision-support + draft.

## Flexibility / pivots (how)
- Different frontend → reuse analysis, re-run `/fde-plan` with new target arg (needs target guard loosened).
- Backend in scope → re-scope (promote out-of-scope dirs), incremental delta deep-read (map already lists them).
- Backend = upgrade not migrate → need `mode: migrate|upgrade` + neutral "work-unit" (not "component").
- Know what a pivot breaks → traceability ID spine (planned, not built).

---

## Opus review (2026-06-20) — verdict: MOSTLY sound; clean idiomatic code that RUNS; gaps = unbuilt steps
Grounded in Claude Code workflow docs + Anthropic multi-agent/context-engineering + modernization best practice.

### Planning findings
- **P1 Critical** — target-neutral step-3 not built; engine presupposes Angular→React/Next (scope + §8 + all
  of plan). Report's "Modernization Options" only ever presents React vs Next. Fix = build §17 (ranked,
  framework-agnostic Modernization Opportunity Assessment before frontend scoping) + generalize `/fde-plan`.
- **P2 High** — steps 6–7 absent; opus/sonnet not split. Everything pinned sonnet (analyze:22, plan:27,
  personas:12) — even judgment stages (adjudicator, critic, cluster-merge). Anthropic: opus-lead+sonnet-workers
  beats single opus 90.2%. Fix = route judgment stages to opus; build subtasks + plan(opus)/act(sonnet) arm.
- **P3 High** — two-arm split is CORRECT, keep it.
- **P4 Med** — persona loader depends on exact headers (fragile); see C1.
- **P5 Med** — `fde.config.*` loader (§12) described + referenced in README but NOT implemented (nothing reads it).

### Code findings
- **C1 High — PARTIAL (verified 2026-06-22).** `grants-portal-modern/` + `foia-response-pipeline/` cards WERE
  regenerated to canonical shape (have `personas/README.md` index + `## Evidence (file:line)` + `## Reviewer
  lens`). **`contract-payment-flow/personas/*.md` was NOT** — still OLD shape (`## Role`/`## Impact`/`## Key
  constraints`, no `## Evidence`, no `## Reviewer lens`, no `personas/README.md`, footer points to dead
  `.claude/personas.md`). On contract-payment-flow the loader falls back to derived lenses + zero
  code-corroboration. FIX: re-run `/fde-personas` in contract-payment-flow to back-fill it to canonical.
- **C2 Med** — bare-string args silently drop flags (analyze.js:17; plan.js:19–26). Fix = log on string-arg.
- **C3 Med** — coverage numbers pre-computed (good) but no post-hoc assert vs the written report.
- **C4 Low** — `.slice()` prompt caps truncate SILENTLY (unlike MERGE which was fixed). Fix = log on actual
  truncation (length-before ≠ length-after).
- **C5** — token discipline correct; `pipeline`/`parallel`/`.filter(Boolean)` used right; `meta` pure literal;
  no forbidden globals. **Scripts run.**

### Token budget (Pro)
Default scoped runs HOLD (~700k projected). Blow-up only on opt-in `{full}` (deep-reads everything = old v2)
and `{thorough}` (A+B+adjudicator per file). Scope knob is the right, implemented mitigation.

### Top 3 highest-leverage changes
1. **Build §17 target-neutral assessment** → makes step-3 a client decision, not presupposed React.
2. **Regenerate persona cards to canonical** (team's `/fde-personas` runs) → fires corroboration + verbatim-lens.
3. **Add opus for judgment stages + build steps 6–7** (subtasks + plan-opus/act-sonnet).

---

## Roadmap / build order (recommended)
1. **(NEXT)** §17 target-neutral step-3 — add ranked "Modernization Opportunity Assessment" to `/fde-analyze`
   (before frontend scope); loosen `/fde-plan` target guard (currently `react|nextjs`, fde-plan.js:21) to accept
   any (vector, target); add `mode: migrate|upgrade`. Smallest diff, biggest fidelity gain. Unblocks "don't assume React".
2. **Traceability ID spine** — stable IDs in `/fde-analyze` (F-001…); downstream artifacts carry parent IDs;
   BA gate validates coverage. Build EARLY (retrofitting after fan-out is expensive).
   **Consider building this AS a deterministic code graph — see KG-1 below; node IDs = the spine.**
3. **Step 4** — code-snippet implementation specs: fan-out per work-unit → before/after snippet + contract,
   written to `./fde-spec/<unit>.md` (by reference, not report body); comprehension-validation gate before
   translation (SME sign-off); acceptance criteria per unit.
4. **Steps 5/6** — explicit epic→story→subtask hierarchy + BA refute-review gate (uses IDs).
5. **Step 7** — implementation agents: per subtask opus-PLAN → sonnet-ACT (pipeline), sandbox-only writes,
   `isolation:'worktree'`, global run budget (caps are multiplicative — bound the product, not 3 local caps),
   tests + rollback per subtask before ACT.

## Quick fixes (cheap, any time)
- Log on bare-string args (C2) and on actual `.slice()` truncation (C4).
- Implement or drop the `fde.config.*` loader (P5).

---

## Candidates under consideration (not committed)

### KG-1 — deterministic code graph (knowledge graph), persisted + reused across runs
**Status: candidate. Researched 2026-06-22 (official + arXiv sources).** Tie to roadmap item 2 (traceability spine) — build them together; a code graph IS the natural ID spine.

**The two flavors — only one fits.**
- ❌ **LLM-extracted semantic KG (GraphRAG-style)** — REJECTED for our budget. Indexing is an LLM call per chunk; "~75% of token budget spent before the first question" (PremAI), millions of tokens for a medium corpus (Microsoft: start small). That is the OPPOSITE of the v3 token-frugal goal, and LLM-extracted graphs "lack precision vs syntactic extraction" + hallucinate (arXiv 2601.08773). Our fan-out + MERGE/CLUSTER + adjudication already approximates the global-reasoning win.
- ✅ **Deterministic code graph (AST/def-ref/call/import)** — the candidate. Built by a CLI (`scip-*`, `srctx`, `ctags --fields=+ne`, or tree-sitter) → **near-zero LLM tokens**, deterministic, reproducible. arXiv 2601.08773: AST-derived graphs are *preferable for codebase QA when cost + reliability matter*. We ALREADY build a flat proto-version (Ph1 MAP); a graph adds the **edges** the flat map lacks.

**Why it helps (the real payoff — precision + reuse, NOT big token savings):**
- **Subsequent-run reuse (the main motivation):** persist the graph to **`./fde-graph.json`**; `/fde-analyze` and `/fde-plan` both read it. A re-run re-indexes only changed files (git-diff) → cheaper agent analysis on every run after the first. This is where a KG earns its keep — without cross-arm/cross-run reuse it's just rebuilt-and-discarded and the value is lost.
- **Exact boundary/scope** (def→ref edges crossing the scope cut) instead of agent-guessed → deep-read a smaller exact set → the one real (marginal) token win.
- **Precise dedup/ghost** (identical call-subgraphs / zero in-edges) vs today's fuzzy shape-match.
- **Migration ordering** for `/fde-plan` — strangler-fig order falls out of a topological sort of the dep graph.
- **Traceability spine for free** — graph node IDs = the F-001 spine (roadmap item 2); downstream artifacts carry parent IDs; coverage gate validates against graph nodes.

**Implementation sketch (fits the dynamic-workflow model):**
1. **Ph1.5 GRAPH** (after MAP, before SCOPE): agent runs the indexer via CLI → emits nodes+edges to `./fde-graph.json` (re-index only git-changed files when the file exists).
2. **Query in-script as a plain JS object** — reachability + topo-sort over the JSON in the script body. NO graph DB needed at our scale (allowed: pure JS).
3. **SCOPE uses graph reachability:** in-scope = frontend subtree; boundary = nodes with edges crossing the cut; out-of-scope = unreachable.
4. **Persist + reuse:** `/fde-plan` reads the same `./fde-graph.json` for ordering + parent IDs.

**Cons / costs:** per-language indexer unevenness (SCIP needs TS/Py/Java/Go indexers; degrades to `ctags`/`ripgrep` like MAP already does) · syntactic-only (no business-meaning edges — LLM CLUSTER still needed) · misses dynamic/runtime edges (DI, reflection, string-keyed routes — boundary tier mitigates) · new persisted artifact to version per-repo + added orchestration.

**Cheapest first step (do this before committing to SCIP/persistence):** enrich the EXISTING MAP `structuralFindings` with `ctags` def-ref edges — captures ~70% of the boundary-precision win, near-zero new machinery, no graph DB, no new artifact. Validate the gain, then decide on the persisted-graph build.

Sources: Microsoft GraphRAG indexing overview · arXiv 2601.08773 (AST-derived vs LLM-extracted KG for code) · Sourcegraph SCIP · srctx (tree-sitter + LSIF/SCIP) · arXiv 2603.27277 (tree-sitter KG for LLM code exploration).

---

## How to resume (cold terminal)
1. `cd` into the KarsunFDE/workflows clone; `git pull origin main`.
2. Read THIS file + `combined_workflow.md` (§17 = the target-neutral gap).
3. Next task = roadmap item 1 (§17 target-neutral step-3). Work on a feature branch + open a PR (team norm).
4. Note: the `pr-summary` push hook misfires here (reads the other repo's branch) — create PRs explicitly with
   `gh pr create --repo KarsunFDE/workflows`.

## Status log
- 2026-06-19: engine uploaded to KarsunFDE/workflows; per-project folders created.
- 2026-06-20: PR #5 MERGED — canonical persona cards + persona-synthesis retired + docs updated.
- 2026-06-20: opus review captured above. Next step (§17) deferred — to continue 2026-06-21.
- 2026-06-22: Phase A doc-honesty pass — fixed combined_workflow.md (§0 tree contradiction + wrong placement
  + dead workflow.md/WHATS-NEW refs; §8 Ph0 + §12 fde.config marked PLANNED-not-implemented; §1 neutrality
  banner; §14/§18 persona-location + skill-count corrected) and current-plan.md (C1 corrected to PARTIAL —
  contract-payment-flow cards never regenerated; this log). §17 (v4 neutrality CODE) still NOT built = next.
- 2026-06-22: citation-rot fix — Evidence now cites `file:symbol` (stable anchor) instead of raw `file:line`,
  which rots on edits. Changed in fde-analysis SKILL §1, fde-personas.js (CARD_SPEC header `## Evidence
  (file:symbol)` + hard rule + discover/synth prompts + schema descs), fde-analyze.js (EVIDENCE_RULES + Ph0
  loader header match + personas schema). Transient per-run numeric lineStart/lineEnd kept (regenerated each
  run, don't rot). Existing grants/foia cards still title "(file:line)" — re-run /fde-personas to re-anchor.
- 2026-06-22: added candidate KG-1 — deterministic code graph (persisted `./fde-graph.json`, reused across runs),
  tied to roadmap item 2. Researched: GraphRAG-style LLM-KG rejected (token blow-up); AST/def-ref graph is the
  fit. Cheapest first step = enrich MAP with ctags def-ref edges. Not committed — candidate only.
- 2026-06-22: `/fde-personas` token optimization (branch `persona-optimization`, commit ea887ea). Re-runs were
  rebuilding all personas from scratch (~76% of a window). Added INVENTORY phase: reuse canonical cards whose
  cited code is unchanged (git staleness at symbol-range granularity via `git log -L`); synth re-reads ONLY
  cited evidence (not whole repo); per-persona WRITE replaces the ~27.5K all-cards dump; metadata-only INDEX.
  Legacy/other-skill cards detected (`canonical` flag) + cleanly regenerated; re-slugged dups flagged, not
  auto-deleted. NOT runtime-tested yet (syntax-clean). Engine file synced into contract-payment-flow.
