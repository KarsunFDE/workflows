export const meta = {
  name: 'fde-personas',
  description: 'Discover stakeholder personas from the repo (role/permission keys, routes, DB entities, audit actors, regulation refs, README) and write ONE evidence-cited card per persona to personas/<slug>.md in a single canonical schema (summary · can/cannot do · constraints · impact · code evidence · reviewer lens · optional regulatory anchors) + a personas/README.md index. Roles, not people — no named accounts. INCREMENTAL: re-runs only re-synthesize personas whose cited code changed; unchanged cards are reused untouched. Run once per repo, then after stakeholder/code changes.',
  whenToUse: 'First-time setup in a new repo, or after code changes. Safe to run repeatedly: an Inventory pass reuses cards whose cited files are unchanged (git-based) and only re-synthesizes new or stale personas, so repeat runs are cheap. /fde-analyze and /fde-plan then consume personas/*.md (reviewer lens + code evidence).',
  phases: [
    { title: 'Inventory' },
    { title: 'Discover' },
    { title: 'Synthesize' },
    { title: 'Write' },
    { title: 'Index' },
  ],
};

const MODEL = 'sonnet'; // all subagents run on sonnet

// kebab-case a role name for the card filename stem. Pure JS (no Date/random).
function kebab(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ───────────────────────── CANONICAL CARD FORMAT ─────────────────────────
// One fixed schema for every persona across every project — removes cross-group drift.
// Engine-critical sections: "Evidence (file:line)" feeds /fde-analyze corroboration;
// "Reviewer lens" feeds /fde-plan refute review.
const CARD_SPEC = `
Write the card in EXACTLY this Markdown shape — same section set for every persona, no extra/ad-hoc sections:

# Persona: <Full Role Name>

- **Role id:** \`<role/permission key from code, e.g. roles.ts>\`   (OMIT this line entirely if the code has no role key)
- **Class:** <internal|external · single-agency|cross-tenant · human|service · trusted|untrusted>
- **Regulatory basis:** <statute/clause, e.g. 5 USC 552(a)(6)>      (OMIT this line if no regulation applies)

## Summary
<1-3 sentences: who this role is and its place in the system.>

## What they can do
- <capability — each grounded in code you cite under Evidence>

## What they cannot do
- <explicit negative authority / separation-of-duties limit — what this role is blocked from>

## Constraints / authority limits
- <scope, fail-closed rules, identity source, tenant/agency boundaries, approval bindings>

## Impact on the system
<Why this role matters and WHAT BREAKS IF ITS RULES ARE REMOVED in a migration. This is the
migration-risk statement reviewers care about.>

## Pain points
- <friction this role hits today — workflow slowdowns, manual steps, gaps the migration could fix or worsen>
(REQUIRED — every persona has this section. Ground in code/UX where possible; mark as inference if reasoned.)

## Evidence (file:symbol)
- \`path/to/file.ext:symbolName\` — <what it shows>   (symbol = function/class/interface/enum/route/const name — it survives edits that raw line numbers don't; add "(~line)" only as a hint)
- \`path/to/config.ext:line\` — <what it shows>       (bare file:line ONLY where no named symbol applies — config, templates, markup)
(CODE citations ONLY. PREFER a stable symbol anchor over a raw line number. Do NOT put regulations here.)

## Reviewer lens
> <A short refute-mode system prompt for /fde-plan. State this persona's authority + constraints, each
> tied to cited code. Say what the migration must preserve for this stakeholder. End with exactly:
> "Default to REFUTE — if the plan does not prove the constraint survives, assume it does not.">

## Regulatory anchors
| Reg | Topic |
|-----|-------|
| <clause> | <topic> |
(OPTIONAL — include this whole section ONLY if domain regulations apply; otherwise omit it.)

HARD RULES:
- ROLES, NOT PEOPLE. Never include named accounts, demo fixtures, or display names (e.g. "Dr. Maria Alvarez").
  If the code has example fixtures, ignore the names — describe the role only.
- Evidence = CODE only, cited as \`file:symbol\` (a stable function/class/enum/route/const name; raw line only where no symbol applies). Regulations belong under "Regulatory anchors", never under Evidence.
- Do NOT add sections like "Cares About", "HITL Gate", or "Access Level". Use the fixed set above only.
- Cite file:line for every capability/constraint claim. No guessing, no uncited authority.`;

// Existing-card inventory — drives the incremental skip (only re-synth new/stale personas).
const INVENTORY = {
  type: 'object',
  required: ['existing'],
  properties: {
    existing: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slug', 'name', 'stale', 'canonical'],
        properties: {
          slug: { type: 'string', description: 'ACTUAL filename stem on disk of personas/<slug>.md (may differ from kebab(name) for legacy/other-skill cards)' },
          name: { type: 'string', description: 'role name from the card H1' },
          roleId: { type: 'string', description: 'Role id line value if present, else empty' },
          klass: { type: 'string', description: 'Class line value if present, else empty' },
          authority: { type: 'string', description: 'one-line authority summary for the index (derive from Summary if no index line)' },
          citedFiles: { type: 'array', items: { type: 'string' }, description: 'distinct file paths cited under the Evidence section (empty if no recognizable evidence section)' },
          canonical: { type: 'boolean', description: 'true ONLY if the card matches THIS engine schema: H1 "# Persona:", and the section set Summary / What they can do / What they cannot do / Constraints / Impact / Pain points / Evidence (file:symbol) / Reviewer lens. A card from a different persona skill or with different/extra sections is NOT canonical.' },
          stale: { type: 'boolean', description: 'true if any cited file changed (git) since the card was last committed, OR has uncommitted changes, OR staleness could not be determined' },
        },
      },
    },
  },
};

const CANDIDATES = {
  type: 'object',
  required: ['personas'],
  properties: {
    personas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'evidence', 'confidence'],
        properties: {
          name: { type: 'string', description: 'expanded role name, e.g. "Contracting Officer"' },
          evidence: { type: 'array', items: { type: 'string' }, description: 'file:symbol citations preferred (stable anchor; raw line only where no symbol applies); code, not comment' },
          signals: { type: 'string', description: 'what in the code points to this persona' },
          confidence: { type: 'number' },
          evidence_type: { type: 'string', enum: ['code', 'comment-only', 'readme-only'] },
        },
      },
    },
  },
};

const PERSONA_CARD = {
  type: 'object',
  required: ['name', 'slug', 'confidence', 'reviewerLens', 'markdown'],
  properties: {
    name: { type: 'string', description: 'full role name' },
    slug: { type: 'string', description: 'kebab-case filename stem, e.g. "contracting-officer"' },
    roleId: { type: 'string', description: 'role/permission key from code if one exists, else empty' },
    klass: { type: 'string', description: 'the Class line value (internal/external · scope · human/service)' },
    authority: { type: 'string', description: 'one-line authority summary for the README index' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'code citations only, file:symbol preferred (raw line only where no symbol applies)' },
    reviewerLens: { type: 'string', description: 'the refute-mode lens for /fde-plan' },
    markdown: { type: 'string', description: 'the FULL canonical card, ready to write to personas/<slug>.md' },
  },
};

// ─── Ph0 INVENTORY — what already exists + what is stale (drives incremental skip) ───
// Reuse any card whose cited code is unchanged; only new/stale personas get re-synthesized.
phase('Inventory');
const inv = await agent(
  `Inventory the persona cards already in this repo so a re-run can skip unchanged ones.
   If a top-level \`personas/\` directory does not exist, return {"existing": []} and stop.
   Otherwise, for EACH \`personas/<slug>.md\` (ignore README.md):
   - record the ACTUAL filename stem as \`slug\` (it may NOT match the role name — legacy/other-skill cards);
   - read its H1 role name, the Role id / Class lines (if present), and a one-line authority
     (use the index authority if present, else condense the Summary);
   - set \`canonical\`: true ONLY if the card already matches THIS engine's schema (see required-field
     description). A card produced by a different persona skill, or with missing/extra/renamed sections, is
     canonical=false — it will be cleanly regenerated, not merged.
   - parse the "Evidence" section and collect the DISTINCT file paths it cites (strip the :symbol/:line suffix);
     if there is no recognizable evidence section, return citedFiles=[] (it will be treated as stale);
   - determine staleness with git, at SYMBOL granularity (an edit elsewhere in a big cited file must NOT mark
     the card stale). First get the card's own last-commit time: \`git log -1 --format=%ct -- personas/<slug>.md\`.
     Then for EACH evidence citation:
       * If it cites a symbol (\`file:symbolName\`), locate that symbol's current line range in the file and run
         \`git log -L <start>,<end>:<file> -1 --format=%ct\` — the last commit that touched THOSE lines. Also
         check uncommitted edits to that range: \`git diff -U0 -- <file>\` and see if any hunk overlaps the range.
       * If it cites a bare \`file:line\` or whole file (no resolvable symbol), fall back to file granularity:
         \`git log -1 --format=%ct -- <file>\` and \`git status --porcelain -- <file>\`.
     The card is STALE if, for ANY citation, the symbol-range (or file, on fallback) was committed MORE RECENTLY
     than the card, OR has an overlapping uncommitted hunk, OR you cannot resolve the range / git history
     (symbol not found, file moved/deleted, no history) — when in doubt, mark stale=true (fail toward re-synthesis).
   Return the existing[] array. Roles, not people.`,
  { label: 'inventory', phase: 'Inventory', schema: INVENTORY, agentType: 'Explore', model: MODEL }
);
const existing = (inv && inv.existing) || [];
log(`Inventory: ${existing.length} existing card(s); ${existing.filter((e) => e.stale).length} stale, ${existing.filter((e) => !e.canonical).length} non-canonical.`);

// Match a discovered persona to an existing card by canonical name OR its on-disk stem (handles
// legacy/other-skill files whose filename != kebab(name)). One existing card matches at most once.
const matched = new Set();
function findExisting(name) {
  const k = kebab(name);
  for (const e of existing) {
    if (matched.has(e)) continue;
    if (kebab(e.name) === k || (e.slug || '') === k) return e;
  }
  return null;
}

// ─── Ph1 DISCOVER — infer candidate personas from code + docs. Evidence-cited, no guessing. ───
phase('Discover');
const candidates = await agent(
  `Discover the human (and notable non-human/service) stakeholder personas of THIS system by reading the
   repository. Infer them from: role/permission enums and keys (e.g. a roles.ts union or ROLE_PROFILES),
   route and API names, DB entities, UI labels, audit actors/event types, regulation references (e.g. FAR/
   CFR clauses), service names, and the README/docs.
   Follow the fde-analysis skill evidence rules: cite \`file:symbol\` for every signal (a stable function/class/
   enum/route name; raw line only where no symbol applies), tag evidence_type (code beats comment/readme),
   and score confidence. Expand abbreviations to full role names (e.g. CO -> Contracting
   Officer) ONLY when evidence or the README supports it. ROLES, NOT PEOPLE — ignore named demo accounts.
   Do NOT invent personas with no evidence.
   Report EVERY persona you find (this is the internal proposal pass) — including ones that may already have a
   card. The orchestrator decides what to re-verify.${existing.length ? ` For context, cards already exist for: ${existing.map((e) => e.name).join(', ')}.` : ''}`,
  { label: 'discover-personas', phase: 'Discover', schema: CANDIDATES, agentType: 'Explore', model: MODEL }
);
const people = (candidates && candidates.personas) || [];
log(`Discovered ${people.length} candidate persona(s): ${people.map((p) => p.name).join(', ') || 'none'}.`);

// ─── Decide work: (re)synthesize new + stale + non-canonical; reuse unchanged canonical cards untouched. ───
// A card is reused ONLY if it is canonical AND unchanged. Legacy/other-skill cards (canonical=false) are
// always regenerated into the canonical schema. The canonical slug is always kebab(name); when an existing
// file used a different stem, we flag it as a duplicate to remove (we never auto-delete).
const work = [];
const reused = [];
const dupes = []; // {role, oldFile, canonicalFile} — legacy stems to remove by hand
function planExisting(ex, p) {
  const slug = kebab(ex.name);
  const legacyStem = ex.slug && ex.slug !== slug ? ex.slug : '';
  if (ex.canonical && !ex.stale && !legacyStem) {
    reused.push({ ...ex, slug });
    return;
  }
  if (legacyStem) dupes.push({ role: ex.name, oldFile: `personas/${ex.slug}.md`, canonicalFile: `personas/${slug}.md` });
  work.push({
    name: ex.name,
    slug,
    evidence: (p && p.evidence) || ex.citedFiles || [],
    signals: (p && p.signals) || '',
    confidence: (p && p.confidence) != null ? p.confidence : 0.5,
    existing: true,
    canonical: !!ex.canonical,
  });
}
for (const p of people) {
  const slug = kebab(p.name);
  const ex = findExisting(p.name);
  if (ex) {
    matched.add(ex);
    planExisting(ex, p);
  } else {
    work.push({ ...p, slug, existing: false, canonical: true });
  }
}
// Existing personas the discover pass did NOT re-find: keep canonical+fresh ones; regenerate the rest.
for (const ex of existing) {
  if (matched.has(ex)) continue;
  matched.add(ex);
  planExisting(ex, null);
}
log(`Reusing ${reused.length} unchanged card(s); (re)synthesizing ${work.length}.${dupes.length ? ` ${dupes.length} legacy file(s) to remove by hand.` : ''}`);

// ─── Ph2 SYNTHESIZE + Ph3 WRITE — pipeline, one persona at a time, no central dump. ───
// (A) Each persona's card is written by its OWN write agent (~2KB input), never a 400KB batch.
// (C) Synthesis re-reads ONLY the cited evidence files (the external fact-check of Discover's claims),
//     instead of re-walking the whole repo per persona.
phase('Synthesize');
const written = (
  await pipeline(
    work,
    // Stage 1 — synthesize the canonical card (external check of Discover's internal proposal).
    (p) =>
      agent(
        `Build the canonical persona CARD for "${p.name}" for THIS repository.
         You are the EXTERNAL fact-check of an internal discovery pass. Re-read ONLY the cited evidence below
         (and files those directly reference) to GROUND or CORRECT every claim — do NOT re-scan the whole repo;
         Discover already located these. If the code disagrees with a signal, REFUTE it and write what the code
         actually supports; adjust the confidence accordingly.
         Candidate evidence: ${JSON.stringify(p.evidence)}. Signals: ${p.signals || ''}. Proposed confidence: ${p.confidence}.
         Produce the full card markdown, a kebab-case slug for the filename, the Role id / Class / one-line
         authority for the index, the code evidence list (cite \`file:symbol\` — stable function/class/enum/
         route names; raw line only where no symbol applies), and the Reviewer lens text.
         ${CARD_SPEC}`,
        { label: `synth:${p.name}`, phase: 'Synthesize', schema: PERSONA_CARD, model: MODEL }
      ),
    // Stage 2 — persist THIS one card (preserve any hand-curated content already on disk).
    (card, p) => {
      if (!card) return null;
      const slug = kebab(card.name || p.name) || card.slug || p.slug;
      // Merge-preserve ONLY when the existing file is our canonical schema; otherwise clean replace
      // (a legacy/other-skill card must not have its non-canonical sections dragged in).
      const writeRule =
        p.existing && p.canonical
          ? `- \`personas/${slug}.md\` already exists in THIS engine's canonical format: READ it first and
           PRESERVE hand-curated content (manual edits, extra evidence, a tuned reviewer lens). Reconcile —
           keep the richer card and the canonical section set. Never delete curated content.`
          : `- If \`personas/${slug}.md\` exists, OVERWRITE it cleanly with the canonical card below. Do NOT try
           to merge or carry over any prior content (it is legacy / a different schema).`;
      return agent(
        `Write this single persona card to \`personas/<slug>.md\` (create the \`personas/\` dir if absent).
         slug: "${slug}"
         ${writeRule}
         - Enforce the canonical schema: roles not people (strip any named accounts), Evidence = code file:symbol
           only, no ad-hoc sections.
         Card to write:
         ${card.markdown}
         Return one line: "<slug>: added|merged|replaced".`,
        { label: `write:${slug}`, phase: 'Write', model: MODEL }
      ).then(() => ({
        slug,
        name: card.name,
        roleId: card.roleId || '',
        klass: card.klass || '',
        authority: card.authority || '',
        confidence: card.confidence,
      }));
    }
  )
).filter(Boolean);
log(`Wrote ${written.length} card(s); reused ${reused.length}.`);

// ─── Ph4 INDEX — regenerate personas/README.md from metadata only (no card bodies). ───
phase('Index');
const indexRows = [
  ...reused.map((e) => ({ slug: e.slug || kebab(e.name), name: e.name, roleId: e.roleId || '', klass: e.klass || '', authority: e.authority || '' })),
  ...written.map((w) => ({ slug: w.slug, name: w.name, roleId: w.roleId, klass: w.klass, authority: w.authority })),
];
const result = await agent(
  `Write/update \`personas/README.md\` as the persona index. Do NOT touch the individual card files.
   Intro: "roles, not people; each card is code-cited; cards feed /fde-analyze corroboration and /fde-plan review".
   Then a table | Persona (link to ./<slug>.md) | Role id | Class | One-line authority |, one row per persona
   below. Group rows sensibly if there are clear classes (active/legacy/cross-cutting), else one flat table.
   After writing, return a short summary: counts of cards reused-unchanged vs (re)written this run, and flag any
   persona whose evidence looks readme/comment-only as a ghost to verify.
   Personas (metadata only — the card files are already written):
   ${JSON.stringify(indexRows)}`,
  { label: 'index', phase: 'Index', model: MODEL }
);

if (dupes.length) {
  log(`⚠ ${dupes.length} legacy persona file(s) re-slugged to canonical — REMOVE the old file(s) by hand:`);
  for (const d of dupes) log(`   ${d.role}: delete ${d.oldFile} (now ${d.canonicalFile})`);
}
log(`personas/*.md + README.md updated. ${written.length} (re)written, ${reused.length} reused unchanged. Review evidence, trim ghosts, then run /fde-analyze.`);

const dupeNote = dupes.length
  ? `\n\n⚠ Legacy duplicates to delete by hand (re-slugged to canonical, NOT auto-deleted):\n${dupes.map((d) => `- ${d.role}: ${d.oldFile} → now ${d.canonicalFile}`).join('\n')}`
  : '';
return `${result}${dupeNote}`;
