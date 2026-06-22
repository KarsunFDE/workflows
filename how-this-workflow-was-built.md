# How the FDE Workflow Was Built — Prompt Trail

A chronological summary of the prompts/decisions that produced the FDE modernization engine
(`/fde-personas`, `/fde-analyze`, `/fde-plan` + 5 skills). Lets others see the reasoning path,
not just the result.

---

## Phase 1 — Framing & correction

1. **Initial ask** — "Develop an FDE-mindset workflow like GalentAI's, to modernize this brownfield project
   (Spring Boot upgrade, Angular→React)." Provided fragmented notes: research/target-state, external analysis,
   business capabilities, a BA persona that analyzes tasks → subtasks → engineering specs, business-purpose
   questions (purpose, customer value, solution-vs-sales), epics, per-stage agents. Asked to brainstorm + propose.
2. **Correction** — "Not a demo. A real workflow *inside Claude* mimicking GalentAI. Make it **agnostic** of the
   group's other projects; this project has its own personas (Contracting Officer, COR, OIG). No code read or
   changed." Quoted the literal instructor deliverable: *recreate the Galent Workflows in Claude as a group*,
   link to `code.claude.com/docs/en/workflows`, *Angular → React (easier) or NextJS (harder)*.

## Phase 2 — Understanding the deliverable

3. "Explain what the workflow actually does — is it changing code, or building docs for a BA to approve? I'm confused."
4. "So you're also providing system prompts in the markdown plan?" → clarified script vs output.
5. "So the output markdown only comes when the workflow is run?" → confirmed static script vs generated report.
6. "How does this mimic the GalentAI workflow — list how GalentAI works." → researched Galent's published
   four-phase process + Scope→Sequence→Build→Ship→Measure.
7. "You *can* prototype code + produce a spec, but don't touch this project's code until approved."

## Phase 3 — Analysis-arm design (the core)

8. Described **GalentAI's internal + external analysis**: external (Claude) verifies the internal analysis AND
   does its own, rating accuracy + grouping features. Required analysis steps: read actual code (no guessing),
   cite evidence by file/line, extract features/data/rules/flows, read exhaustively (whole files).
9. "If a pre-existing analysis exists, follow those steps against it."
10. "Internal/external reviews mitigate bias. We have no internal platform → mimic with **two Claude agents**.
    Should Claude spin up a second subagent to compare when no prior analysis exists?" → blind A/B + adjudicator.
11. "Use **identical lenses**; both must capture business constraints/rules."
12. "Internal analysis may never exist; if it does, markdown. Analyze the **whole codebase**." Gave Galent failure
    examples (missed in-scope code / invisible domain, missed features, duplicated logic, comment-only 'ghost'
    programs, missing schema data files) → became the **5 analysis invariants**.
13. "The Galent examples were only to derive guardrails — don't put their numbers/examples in our deliverable."
14. "Whole repo, so we learn which parts are in modernization scope." → scope-tagging (in/out/boundary).
15. Chose: **group by domain capability**; on conflict, **adjudicator re-reads** the cited lines.
16–19. Schema handling: what 'missing schema data files' means; what if a project has **no schema**
    (→ reconstruct shape from code); what "emit schema map" does; decided **report-only** schema map (no JSON).

## Phase 4 — Configurability, personas, sharing

20. "GalentAI lets you create agents + modify prompts/skills/tools/task-steps. How do we mimic that?"
    → mapped to Claude subagents / skills / workflow script.
21. "Streamline it — looks config-heavy." → single-file config block over externalized agent files.
22. "Don't lock that in. Create `workflow.md` as a handoff context doc." → first design snapshot.
23. "How is this shared across other groups' repos (same modernization, different context/personas/docs)?"
    → **engine vs config** split (generic engine + per-repo config/personas).
24. Flagged a hardcoded "20k lines" leak in the doc → made the design **size-agnostic** (fan-out + chunking).
25. "Read `docs/context/workflow_prompt.txt`; fold in the useful sections — give analysis before editing."
    → adopted its 12-phase discovery list, confidence scores, facts/inferences/recommendations split; surfaced
    the persona-discovery model and the interactive-planning-vs-no-mid-run-input conflict (→ two-workflow split).
26. "Create `combined_workflow.md` for all those changes." → master design doc.
27. "Summarize clearly what the workflow does so far."
28–29. "Will the report include the code changes it would make?" → **spec-level in report + prototype in sandbox**.
30–32. Persona mechanics: inferred vs manual (→ hybrid: discover + corroborate vs CLAUDE.md); "do other groups
    hand-edit their CLAUDE.md?" (→ no — ship engine only); "how do they generate their own CLAUDE.md?"
    (→ a `/fde-personas` bootstrap workflow writes it).

## Phase 5 — Build, model, test, package

33. "How many workflows are there? Do they have to build them? How do I send it?" → 3 workflows; copy-not-build;
    distribute the engine.
34. "Build the rest; note in `combined_workflow.md` what each workflow does + when to call it."
    → built `/fde-personas` and `/fde-plan`; added the workflows table.
35. "Smoke-test first. Also: what's the CLAUDE.md.template for — do they need it?" (→ no, `/fde-personas` replaces it).
36–37. "Use **sonnet** subagents only." → all agents pinned to sonnet.
38. "How do you call `/fde-plan <target>` — is it just react or nextjs?" → fixed args parsing (string or object).
39. "Why is the flow analyze→plan? Where does `/fde-personas` fit?" → clarified personas = one-time setup first.
40. "Can I send this to the team, or do we work on next steps first?" → recommended testing analyze+plan first.
41. "Set both to sonnet, do each step, update `combined_workflow.md`. I need to send the engine to the team to
    test more tomorrow." → sonnet on all; fixed MERGE truncation (batched); added scope knob; launched smoke-tests;
    packaged `fde-engine.zip`.
42. "Include `combined_workflow.md` in the deliverable as reference."
43. "Summarize the prompts I gave." → this document.

## Phase 6 — Token optimization (`/fde-personas` re-runs)

44. "A full `/fde-personas` run ate ~76% of a window; it's meant to run after every code change — why so
    expensive, and fix it." → traced cost to (1) every synth agent re-walking the whole repo, (2) a single
    Write agent carrying all cards (~27.5K tok) + re-reading every file, (3) no incremental reuse.
45. "Does optimizing contradict the internal/external fact-check goal?" → no: the blind A/B fact-check lives in
    `/fde-analyze`, not `/fde-personas`. Reframed the synth re-read as the *external check of the discover pass*
    and scoped it to cited files (kept the intent, dropped the whole-repo re-walk).
46. "Implement all three." → INVENTORY phase (git staleness, symbol-range via `git log -L`) reuses unchanged
    canonical cards; synth reads only cited evidence; per-persona WRITE replaces the central dump; metadata-only
    INDEX. Legacy/other-skill cards detected + cleanly regenerated; re-slugged duplicates flagged, never
    auto-deleted. First-run cost ~same→modestly lower; re-run cost near-zero when little changed.

---

## Method, in one line

The workflow was **co-designed conversationally**: the user supplied GalentAI's behavior + guardrails in
fragments, corrected framing as it drifted, and made the binding decisions (blind dual-analyst, capability
clustering, report-only, engine-vs-config, sonnet); Claude grounded each step in the official Claude Code
workflow docs + this repo's code, and built/tested the result.
