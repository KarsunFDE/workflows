# FDE Modernization Engine — Setup (for other project groups)

A reusable Claude Code workflow engine that analyzes a legacy codebase and plans an Angular → React/Next.js
modernization. **You don't build anything — copy files and run.** All subagents run on **sonnet**.

## 1. Install (copy into your repo)
```
.claude/workflows/   fde-personas.js  fde-analyze.js  fde-plan.js
.claude/skills/       fde-analysis/   persona-synthesis/
```
Claude Code auto-discovers them. No CLAUDE.md / personas file is shipped — you generate your own (step 2).

## 2. Run order
```
/fde-personas        → discovers YOUR stakeholders from YOUR code → writes .claude/personas.md   (run once)
/fde-analyze         → cited analysis report of your repo
   [read it, pick a target]
/fde-plan react      → spec-level migration plan   (or: /fde-plan nextjs)
```

## 3. What each does
- **/fde-personas** — infers personas (roles, routes, regulation refs, audit actors, README), evidence-cited
  with confidence, and writes/merges them into `.claude/personas.md`. Preserves anything you've hand-curated.
- **/fde-analyze** — **MAP pass** (local CLI: `repomix --compress` → `ctags` → `ripgrep` fallback) maps the whole
  repo cheaply (100% coverage + duplication/ghost/missing-schema) → deep-reads ONLY in-scope + boundary files →
  cluster → schema map → personas → cited report. **Reads only; writes nothing.** Ends by presenting React vs Next.js.
- **/fde-plan <target>** — research Angular→target mapping → user stories → persona review (refute-mode, using
  `.claude/personas.md`) → spec-level migration plan + roadmap/risk/rollback/test → critic gate → plan.
  Report-only unless you pass `sandboxDir` (then it writes prototype code there — never touches your app).

## 4. Flags & cost (IMPORTANT on a Pro token budget)
`/fde-analyze` defaults to the cheap MAP + tiered read. Options:
- `{pathPrefix:"src/app", maxFiles:10}` — **scope it** (do this while iterating; full-repo is much pricier)
- `{full:true}` — deep-read every file (uniform depth, ~3× cost)
- `{thorough:true}` — blind dual-analyst on deep reads (bias-mitigated, most expensive)

Rough cost: a scoped run ~250-400k tokens; full-repo ~700k-1M. A Pro 5-hour window is ~a couple million tokens
shared across claude.ai + Code, so **treat full-repo `/fde-analyze` as a once-per-window batch** and scope while testing.
Watch live usage with `/workflows`; stop anytime.

## 5. Requirements
- **No download required.** The map pass uses `ripgrep` (always present in Claude Code) if nothing else is installed.
- **Optional, cheaper:** `npx repomix` (needs Node; npx fetches on demand — no global install) or `ctags`/`ast-grep`.
  The workflow auto-detects and logs which it used.

## 6. Status
- `/fde-personas` and `/fde-analyze` smoke-tested (work). `/fde-plan` syntax-verified; treat as beta — report bugs.
- See `combined_workflow.md` for full design + rationale.
