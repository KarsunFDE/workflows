export const meta = {
  name: 'fde-personas',
  description: 'Discover stakeholder personas from the repo (role/permission keys, routes, DB entities, audit actors, regulation refs, README) and write ONE evidence-cited card per persona to personas/<slug>.md in a single canonical schema (summary · can/cannot do · constraints · impact · code evidence · reviewer lens · optional regulatory anchors) + a personas/README.md index. Roles, not people — no named accounts. Run once per repo before /fde-analyze and /fde-plan.',
  whenToUse: 'First-time setup in a new repo, or when stakeholders change. A new group runs this so they never hand-author personas — the workflow infers them from their own code in ONE consistent format. /fde-analyze and /fde-plan then consume personas/*.md (reviewer lens + code evidence).',
  phases: [
    { title: 'Discover' },
    { title: 'Synthesize' },
    { title: 'Write' },
  ],
};

const MODEL = 'sonnet'; // all subagents run on sonnet

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

// Ph1 DISCOVER — infer candidate personas from code + docs. Evidence-cited, no guessing.
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
   Do NOT invent personas with no evidence.`,
  { label: 'discover-personas', phase: 'Discover', schema: CANDIDATES, agentType: 'Explore', model: MODEL }
);
const people = (candidates && candidates.personas) || [];
log(`Discovered ${people.length} candidate persona(s): ${people.map((p) => p.name).join(', ') || 'none'}.`);

// Ph2 SYNTHESIZE — one canonical card per candidate (parallel). Self-contained: no persona-synthesis skill.
phase('Synthesize');
const synthesized = (
  await parallel(
    people.map((p) => () =>
      agent(
        `Build the canonical persona CARD for "${p.name}" for THIS repository. Re-read the cited code as needed
         to ground every claim — do not rely only on the signals below.
         Candidate evidence: ${JSON.stringify(p.evidence)}. Signals: ${p.signals || ''}. Confidence: ${p.confidence}.
         Produce the full card markdown, a kebab-case slug for the filename, the Role id / Class / one-line
         authority for the index, the code evidence list (cite \`file:symbol\` — stable function/class/enum/
         route names; raw line only where no symbol applies), and the Reviewer lens text.
         ${CARD_SPEC}`,
        { label: `synth:${p.name}`, phase: 'Synthesize', schema: PERSONA_CARD, model: MODEL }
      )
    )
  )
).filter(Boolean);
log(`Synthesized ${synthesized.length} canonical persona card(s).`);

// Ph3 WRITE — one file per persona under personas/, plus a personas/README.md index.
// Preserve any hand-curated card already present; never clobber manual edits.
phase('Write');
const result = await agent(
  `Write this repository's persona cards into a top-level \`personas/\` directory (create it if absent).
   For EACH persona below, write its \`markdown\` to \`personas/<slug>.md\`:
   - If \`personas/<slug>.md\` already exists, READ it first. PRESERVE hand-curated content (manual edits,
     extra evidence, tuned reviewer lens). Reconcile rather than blindly overwrite; keep the richer card and
     the canonical section set. Never delete a curated card.
   - Enforce the canonical schema: roles not people (strip any named accounts), Evidence = code file:line only,
     no ad-hoc sections.
   Then write/update \`personas/README.md\` as an index: a short intro ("roles, not people; each card is
   code-cited; cards feed /fde-analyze corroboration and /fde-plan review") followed by a table
   | Persona (link to ./<slug>.md) | Role id | Class | One-line authority |. Group rows sensibly if there are
   clear classes (active/legacy/cross-cutting), otherwise one flat table.
   After writing, return a short summary: which cards were added, merged, or left untouched, with each
   confidence; flag any persona whose evidence is readme/comment-only as a ghost to verify.
   Personas to write:
   ${JSON.stringify(synthesized).slice(0, 400000)}`,
  { label: 'write-personas', phase: 'Write', model: MODEL }
);

log('personas/*.md cards + personas/README.md index written. Review the evidence, trim any ghosts, then run /fde-analyze.');
return result;
