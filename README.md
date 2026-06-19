# FDE Modernization Engine

Reusable Claude Code workflow engine for the Karsun FDE team. Analyzes a legacy codebase and plans an
Angular → React/Next.js (or other target) modernization. **You don't build anything — copy files and run.**
All subagents run on `sonnet`.

## Layout

```
.claude/
  workflows/   fde-personas.js  fde-analyze.js  fde-plan.js   (fde-analyze.v2.bak = rollback)
  skills/      fde-analysis/  persona-synthesis/

combined_workflow.md          # master design doc (authoritative)
fde-engine-SETUP.md           # setup guide for a new group
fde-engine-WHATS-NEW.md       # changelog / highlights
how-this-workflow-was-built.md
workflow.md                   # prior design snapshot (history)
fde-analyze-sample-report.html # sample run output (proof it works)

contract-payment-flow/        # per-project config storage (personas, fde.config, sample outputs)
grants-portal-modern/
foia-response-pipeline/
```

## Install (Model A — install into your own project repo)

The engine is generic; each project supplies its own config. Run the engine **inside your actual project repo**,
not from this one. This repo is the shared source of truth + central config storage.

```
1. Copy .claude/workflows + .claude/skills into your project repo's .claude/
2. /fde-personas    → generates YOUR .claude/personas.md from YOUR code (run once)
3. /fde-analyze     → cited analysis report (start scoped: args {pathPrefix, maxFiles})
4. /fde-plan react  → migration plan (or nextjs / other target)
```

After generating, copy your `personas.md` (+ any `fde.config.*` and sample outputs) into this repo's matching
project folder so the group has a versioned, central record.

> The Ph0 loader reads `.claude/personas.md` at the **project root** where the workflow runs — not this repo's
> project subfolders. Those subfolders are backup/handoff storage only.

## Cost note (Pro budget)

`/fde-analyze` cost scales with file count. Scope it first (`{pathPrefix, maxFiles}`) while iterating; run
full-repo as a once-per-window batch. Watch live usage with `/workflows`; stop anytime. See `fde-engine-SETUP.md`.
