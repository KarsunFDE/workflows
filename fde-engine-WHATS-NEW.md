# FDE Engine — What's New (read me first)

Short version of what changed and why. Full detail in `combined_workflow.md`.

## Highlights
- **Token-frugal by default (v3).** `/fde-analyze` now does a cheap structural **MAP pass** (local CLI
  `repomix --compress` → `ctags` → `ripgrep` fallback) for 100% whole-repo coverage, then **deep-reads only
  in-scope + boundary files**. Smoke-tested: 100% coverage, ~22% deep-read. Roughly ⅓–⅕ the tokens of reading
  everything. Old "read every file" behavior is still available via `{full:true}`.
- **All subagents pinned to sonnet.** Cheaper; matters on a Pro budget.
- **No web by default.** `/fde-plan` research uses model knowledge (1 agent, not 6). Pass `{web:true}` to allow
  a couple of targeted searches.
- **Personas moved out of CLAUDE.md** → `.claude/personas.md` (loaded on demand, not every session — per Claude
  Code best practices). `/fde-personas` writes it. CLAUDE.md is now a lean pointer.
- **Skills merged 5 → 2:** `fde-analysis` (evidence + clustering + schema + coverage) and `persona-synthesis`.

## Use it (zero build — copy + run)
```
1. drop .claude/ into your repo
2. /fde-personas                              → writes your .claude/personas.md (run once)
3. /fde-analyze {pathPrefix:"src", maxFiles:10}   → SCOPE IT FIRST (cheap); drop flags for full repo
4. /fde-plan react                            → migration plan (or nextjs)
```

## On a Pro plan — read this
- `/fde-analyze` cost scales with file count. Scoped run ≈ 250–400k tokens; full-repo ≈ 700k–1M.
- A Pro 5-hour window is ~a couple million tokens, **shared** across claude.ai + Claude Code.
- So: **scope while iterating; run full-repo as a once-per-window batch.** Watch `/workflows`; stop anytime.
- Run heavy workflows from a plain Sonnet session, not alongside a big Opus chat (same pool).

## Status / caveats
- `/fde-personas`, `/fde-analyze` — smoke-tested, working.
- `/fde-plan` — syntax-verified, not yet full-run-tested → **beta, report bugs**.
- Full-repo `/fde-analyze` cost is projected, not yet measured.
- No download required (ripgrep fallback). `npx repomix` (Node) used automatically if present — cheaper map.
