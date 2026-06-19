export const meta = {
  name: 'fde-personas',
  description: 'Discover stakeholder personas from the repo (roles, routes, regulation refs, audit actors, README), synthesize an evidence-grounded record + reviewer prompt each, and write/merge into .claude/personas.md (preserves curated entries). Run once per repo before /fde-plan.',
  whenToUse: 'First-time setup in a new repo, or when stakeholders changed. A new group runs this so they never hand-author personas — the workflow infers them from their own code. /fde-analyze and /fde-plan then consume the result.',
  phases: [
    { title: 'Discover' },
    { title: 'Synthesize' },
    { title: 'Write' },
  ],
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
          evidence: { type: 'array', items: { type: 'string' }, description: 'file:line citations (code, not comment)' },
          signals: { type: 'string', description: 'what in the code points to this persona' },
          confidence: { type: 'number' },
          evidence_type: { type: 'string', enum: ['code', 'comment-only', 'readme-only'] },
        },
      },
    },
  },
};

const PERSONA_FULL = {
  type: 'object',
  required: ['name', 'confidence', 'reviewerPrompt'],
  properties: {
    name: { type: 'string' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: { type: 'string' } },
    corroboration: { type: 'string', enum: ['code+claudemd', 'code-only', 'claudemd-only', 'readme-only'] },
    goals: { type: 'string' },
    responsibilities: { type: 'string' },
    commonActions: { type: 'string' },
    painPoints: { type: 'string' },
    flaggedInferences: { type: 'string', description: 'lower-confidence claims to verify, with why' },
    reviewerPrompt: { type: 'string', description: 'system prompt injected during /fde-plan review' },
    markdown: { type: 'string', description: 'the full .claude/personas.md section for this persona, ready to write' },
  },
};

// Ph1 DISCOVER — infer candidate personas from code + docs. Evidence-cited, no guessing.
phase('Discover');
const candidates = await agent(
  `Discover the human stakeholder personas of THIS system by reading the repository. Infer them from:
   role/permission enums, route and API names, DB entities, UI labels, audit actors/event types,
   regulation references (e.g. FAR clauses), service names, and the README/docs.
   Follow the fde-evidence-rules skill: cite file:line for every signal, tag evidence_type (code beats
   comment/readme), and score confidence. Expand abbreviations to full role names (e.g. CO -> Contracting
   Officer) ONLY when evidence or the README supports it. Do NOT invent personas with no evidence.`,
  { label: 'discover-personas', phase: 'Discover', schema: CANDIDATES, agentType: 'Explore', model: 'sonnet' }
);
const people = (candidates && candidates.personas) || [];
log(`Discovered ${people.length} candidate persona(s): ${people.map((p) => p.name).join(', ') || 'none'}.`);

// Ph2 SYNTHESIZE — one reviewer-lens persona per candidate (parallel).
phase('Synthesize');
const synthesized = (
  await parallel(
    people.map((p) => () =>
      agent(
        `Use the persona-synthesis skill. Build the full .claude/personas.md persona section for "${p.name}".
         Evidence: ${JSON.stringify(p.evidence)}. Signals: ${p.signals || ''}. Confidence: ${p.confidence}.
         Produce: the persona record (goals/responsibilities/common actions/pain points, all evidence-grounded),
         a flagged-inferences note for anything below high confidence, a Reviewer Prompt (authority + constraints
         each tied to cited code; ends with "Default to REFUTE..."), and the ready-to-write \`markdown\` section.
         Set corroboration=code-only for now (.claude/personas.md merge happens in the Write phase).`,
        { label: `synth:${p.name}`, phase: 'Synthesize', schema: PERSONA_FULL, model: 'sonnet' }
      )
    )
  )
).filter(Boolean);
log(`Synthesized ${synthesized.length} persona section(s).`);

// Ph3 WRITE — write/merge into .claude/personas.md. Preserve anything already curated; never clobber.
phase('Write');
const result = await agent(
  `Write the repository's .claude/personas.md with these discovered personas. Rules:
   - If .claude/personas.md already exists, READ it first. PRESERVE every persona already curated there (especially
     ones marked high-confidence/manually edited). Do not delete or overwrite curated content.
   - For each discovered persona below: if a section with the same name exists, reconcile (mark corroboration
     code+claudemd, keep the richer evidence); if new, append the section.
   - Keep the file's scope header explaining personas are per-repo + evidence-grounded (create it if absent).
   - After writing, return a short summary: which personas were added, merged, or left untouched, and the
     confidence of each. Flag any persona that is readme-only/comment-only as a ghost to verify.
   Personas to write (each has a ready \`markdown\` section):
   ${JSON.stringify(synthesized).slice(0, 400000)}`,
  { label: 'write-claudemd', phase: 'Write', model: 'sonnet' }
);

log('.claude/personas.md bootstrapped. Review the evidence, trim any ghosts, then run /fde-analyze.');
return result;
