export const meta = {
  name: 'fde-plan',
  description: 'Plan an Angular->target (react|nextjs) migration: research equivalents, user stories, persona review (refute-mode, using the personas/*.md reviewer lenses), spec-level plan + roadmap/risk/rollback/test, critic gate. Default review is lean (1 agent, all lenses, one-shot critic); {rigorous:true} runs one critic PER lens + a verdict vote + a bounded gap-loop. Report-only unless {sandboxDir} given; never edits the app. Run after /fde-analyze. Args {target,analysisReport?,sandboxDir?,rigorous?,web?}.',
  whenToUse: 'Run AFTER /fde-analyze, once a human has read the analysis and picked a target. Invoke as: /fde-plan with args {target:"react"|"nextjs", analysisReport?:string, sandboxDir?:string, rigorous?:boolean}. analysisReport (paste the /fde-analyze output) grounds the plan; sandboxDir enables prototype emission; rigorous trades tokens for per-lens adversarial review + gap-loop.',
  phases: [
    { title: 'Load' },
    { title: 'Research' },
    { title: 'Stories' },
    { title: 'Review' },
    { title: 'Spec' },
    { title: 'Critic' },
    { title: 'Report' },
  ],
};

// args may arrive as a bare string ("/fde-plan nextjs") or an object
// ("/fde-plan with target nextjs, sandboxDir ../proto"). Handle both.
const _a = args || {};
const _rawTarget = (typeof _a === 'string' ? _a : _a.target) || 'react';
let target = String(_rawTarget).toLowerCase().trim();
if (target !== 'react' && target !== 'nextjs') {
  log(`Unrecognized target "${target}" — defaulting to react. Pass react or nextjs.`);
  target = 'react';
}
const analysisReport = (typeof _a === 'object' && _a.analysisReport) || '';
const sandboxDir = (typeof _a === 'object' && _a.sandboxDir) || '';
// RIGOROUS tier (token-for-rigor trade): one critic PER stakeholder lens + a verdict vote, and a bounded
// gap-loop that re-specs while the critic still finds gaps. Default stays lean (1 review agent, one-shot critic)
// to hold the Pro budget — mirrors /fde-analyze's {thorough} A/B tier.
const RIGOROUS = (typeof _a === 'object' && _a.rigorous) === true;
const MAX_GAP_ROUNDS = 2; // bound the re-spec loop so it always terminates
const MODEL = 'sonnet'; // all subagents run on sonnet

const RESEARCH = {
  type: 'object',
  required: ['angle', 'findings'],
  properties: {
    angle: { type: 'string' },
    findings: { type: 'array', items: { type: 'object' }, description: 'Angular construct -> target equivalent, breaking changes, recommended lib, citation/source' },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

const STORIES = {
  type: 'object',
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['persona', 'want', 'soThat'],
        properties: {
          persona: { type: 'string' },
          want: { type: 'string' },
          soThat: { type: 'string' },
          acceptance: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
      },
    },
  },
};

const REVIEW = {
  type: 'object',
  required: ['persona', 'verdict', 'risks'],
  properties: {
    persona: { type: 'string' },
    verdict: { type: 'string', enum: ['no-regression', 'regression-risk'] },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          risk: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
          capability: { type: 'string' },
          mitigation: { type: 'string' },
        },
      },
    },
  },
};

const REVIEWS_BATCH = {
  type: 'object',
  required: ['reviews'],
  properties: { reviews: { type: 'array', items: REVIEW } },
};

const SPEC = {
  type: 'object',
  required: ['targetArchitecture', 'roadmap', 'componentMap'],
  properties: {
    targetArchitecture: { type: 'string' },
    roadmap: { type: 'array', items: { type: 'object' }, description: 'strangler-fig ordered phases/milestones' },
    componentMap: { type: 'array', items: { type: 'object' }, description: 'Angular file -> target file, prop/state contract (spec-level, NO full code)' },
    dataMigration: { type: 'string' },
    riskAssessment: { type: 'string' },
    rollback: { type: 'string' },
    testing: { type: 'string' },
    deployment: { type: 'string' },
    effort: { type: 'string' },
  },
};

// Ph0 LOAD — reviewer lenses from the persona cards + the analysis to plan against.
phase('Load');
const ctx = await agent(
  `Read this repo's persona cards from the top-level \`personas/\` directory — every \`personas/*.md\` EXCEPT
   \`personas/README.md\`. If \`personas/\` does not exist, fall back to \`.claude/personas.md\`, then \`CLAUDE.md\`.
   For each persona, produce its stakeholder REVIEW LENS: copy the card's "## Reviewer lens" section VERBATIM if
   present; if a card has no Reviewer lens, DERIVE one from its "What they cannot do" / "Constraints / authority
   limits" / "Impact on the system" sections (refute-mode: what the migration must not regress).
   ${analysisReport ? 'An analysis report is provided separately; do not re-scan.' :
   'No analysis report was passed — do a FOCUSED read of the in-scope Angular frontend (components, routes, ' +
   'forms, services it calls) to recover the capabilities and boundary contracts the plan must preserve. ' +
   'Cite file:line.'} Return the reviewer prompts and a concise capability/boundary summary.`,
  { label: 'load-context', phase: 'Load', agentType: 'Explore', model: MODEL,
    schema: { type: 'object', required: ['reviewerPrompts', 'capabilities'],
      properties: {
        reviewerPrompts: { type: 'array', items: { type: 'object', properties: { persona: { type: 'string' }, prompt: { type: 'string' } } } },
        capabilities: { type: 'array', items: { type: 'object' } },
        boundaries: { type: 'array', items: { type: 'string' } },
      } } }
);
const reviewers = (ctx && ctx.reviewerPrompts) || [];
const groundwork = analysisReport
  ? `ANALYSIS REPORT:\n${analysisReport.slice(0, 200000)}`
  : `CAPABILITIES (recovered): ${JSON.stringify((ctx && ctx.capabilities) || []).slice(0, 100000)}\nBOUNDARIES: ${JSON.stringify((ctx && ctx.boundaries) || [])}`;
log(`Planning Angular -> ${target}. Loaded ${reviewers.length} reviewer persona(s).`);

// Ph1 RESEARCH — ONE agent covers all angles from model knowledge. Web OFF by default (token-frugal);
// pass args.web:true to allow a couple of targeted searches for version-specific details.
phase('Research');
const WEB = (typeof _a === 'object' && _a.web) === true;
const research = [
  await agent(
    `Summarize how to migrate an Angular app to ${target}, covering: components/templates, routing,
     state management & services, reactive forms & validation, build/tooling & SSR, and the main
     breaking-change gotchas. For each, give the ${target} equivalent + recommended library.
     ${WEB ? 'You MAY run up to 2 web searches ONLY for version-specific details you are unsure of.'
           : 'Do NOT use web search — rely on your own knowledge to conserve tokens.'}`,
    { label: 'research', phase: 'Research', schema: RESEARCH, model: MODEL }
  ),
].filter(Boolean);
log(`Research done (web=${WEB}).`);

// Ph2 STORIES — evidence-backed user stories from capabilities + discovered personas.
phase('Stories');
const stories = await agent(
  `Generate evidence-backed user stories (As a [persona] / I want / So that + acceptance + evidence + confidence)
   for the in-scope frontend modernization. Use ONLY personas and capabilities grounded in the analysis.
   ${groundwork}`,
  { label: 'user-stories', phase: 'Stories', schema: STORIES, model: MODEL }
);

// Ph3 REVIEW — refute-mode stakeholder review.
//   default : ONE agent reviews through ALL lenses (lean).
//   rigorous: ONE independent critic PER lens (blind to each other) + a verdict vote.
phase('Review');
const planSketch = `Target: Angular -> ${target}. Research: ${JSON.stringify(research).slice(0, 80000)}. Stories: ${JSON.stringify((stories && stories.stories) || []).slice(0, 40000)}. ${groundwork}`;
const reviewLenses = reviewers.length ? reviewers : [{ persona: 'Generic stakeholder', prompt: 'Review for any regression to documented behavior.' }];
let reviews = [];
if (RIGOROUS) {
  reviews = (
    await parallel(
      reviewLenses.map((r) => () =>
        agent(
          `Review this Angular -> ${target} migration ONLY through the ${r.persona} lens, refute-mode. You have NOT
           seen any other reviewer's verdict — judge independently. Return ONE review entry: a verdict
           (no-regression | regression-risk) and the regression risks (risk, severity, capability, mitigation).
           Default to REFUTE: if the plan does not prove this lens's constraints survive, record a regression-risk.
           LENS — ${r.persona}: ${r.prompt}

${planSketch}`,
          { label: `review:${r.persona}`, phase: 'Review', schema: REVIEW, model: MODEL }
        )
      )
    )
  ).filter(Boolean);
} else {
  const reviewOut = await agent(
    `Review this Angular -> ${target} migration through EACH stakeholder lens below, refute-mode.
     For every lens, return one review entry with regression risks (risk, severity, capability, mitigation).
     Default to REFUTE: if the plan does not prove a lens's constraints survive, record a regression-risk.
     LENSES:
${reviewLenses.map((r) => `- ${r.persona}: ${r.prompt}`).join('\n')}

${planSketch}`,
    { label: 'persona-review', phase: 'Review', schema: REVIEWS_BATCH, model: MODEL }
  );
  reviews = (reviewOut && reviewOut.reviews) || [];
}
let mustFix = reviews.flatMap((r) => (r.risks || []).filter((x) => x.severity === 'Critical' || x.severity === 'High'));
// Verdict vote (rigorous only): how many independent lenses flagged a regression.
const regressionVotes = reviews.filter((r) => r && r.verdict === 'regression-risk').length;
const voteNote = RIGOROUS ? ` Verdict vote: ${regressionVotes}/${reviews.length} lens(es) flagged regression-risk.` : '';
log(`Persona review complete (${reviewLenses.length} lenses, ${RIGOROUS ? `${reviews.length} agents` : '1 agent'}). ${mustFix.length} Critical/High risk(s).${voteNote}`);

// Ph4 SPEC — spec-level migration plan that must answer every Critical/High risk.
phase('Spec');
let spec = await agent(
  `Produce the spec-level migration plan for Angular -> ${target}. SPEC-LEVEL ONLY: component-by-component
   mapping (Angular file -> target file, prop/state contract), target architecture, strangler-fig roadmap/
   milestones, data-migration, risk, rollback, testing, deployment, effort. NO full source in the spec.
   Every Critical/High regression risk below MUST be explicitly addressed by a roadmap step or mitigation.
   Regression risks: ${JSON.stringify(mustFix).slice(0, 80000)}
   Research: ${JSON.stringify(research).slice(0, 120000)}
   ${groundwork}`,
  { label: 'migration-spec', phase: 'Spec', schema: SPEC, model: MODEL }
);

// Ph5 CRITIC — adversarial gate over the finished spec.
//   default : one pass, gaps reported in the plan.
//   rigorous: re-spec while the critic still finds gaps, bounded by MAX_GAP_ROUNDS (gaps actually loop back).
phase('Critic');
const criticOf = (s) =>
  agent(
    `Adversarially review this migration spec. Does it leave ANY Critical/High regression risk unaddressed?
     Any boundary contract unprotected? Any capability dropped? List gaps with severity, or state "no gaps".
     Spec: ${JSON.stringify(s).slice(0, 150000)}
     Risks raised: ${JSON.stringify(mustFix).slice(0, 60000)}`,
    { label: 'critic-gate', phase: 'Critic', model: MODEL,
      schema: { type: 'object', required: ['gaps'], properties: { gaps: { type: 'array', items: { type: 'object' } }, verdict: { type: 'string' } } } }
  );
let critique = await criticOf(spec);
if (RIGOROUS) {
  let round = 0;
  while ((critique && (critique.gaps || []).length) && round < MAX_GAP_ROUNDS) {
    round++;
    log(`Rigorous gap-loop round ${round}/${MAX_GAP_ROUNDS}: ${critique.gaps.length} gap(s) — re-specing to close them.`);
    spec = await agent(
      `Revise this migration spec to CLOSE every gap the critic raised. Keep the same SPEC shape; do not drop
       prior coverage. Address each gap explicitly in the roadmap/mitigations.
       Critic gaps: ${JSON.stringify(critique.gaps).slice(0, 60000)}
       Prior spec: ${JSON.stringify(spec).slice(0, 120000)}
       Regression risks: ${JSON.stringify(mustFix).slice(0, 40000)}`,
      { label: `re-spec:${round}`, phase: 'Critic', schema: SPEC, model: MODEL }
    );
    critique = await criticOf(spec);
  }
  if (critique && (critique.gaps || []).length) {
    log(`⚠ Gap-loop hit the ${MAX_GAP_ROUNDS}-round bound with ${critique.gaps.length} gap(s) still open — reported in the plan, not silently dropped.`);
  }
}

// Ph5.5 PROTOTYPE (gated) — only if an explicit sandbox dir was passed. Runs AFTER the gap-loop so the
// prototype reflects the FINAL spec. Never touches the app.
let prototypeNote = 'Prototype skipped (no sandboxDir passed; report stays spec-level).';
if (sandboxDir) {
  const proto = await agent(
    `Emit a small React/Next prototype for the 1-2 highest-value in-scope components from the spec.
     Write files ONLY under "${sandboxDir}". Do NOT read or modify any file outside that directory, and never
     touch the Angular app. Return the list of files written. Spec: ${JSON.stringify(spec).slice(0, 80000)}`,
    { label: 'prototype', phase: 'Spec', model: MODEL }
  );
  prototypeNote = `Prototype emitted to ${sandboxDir}:\n${proto}`;
}

// Ph6 REPORT — synthesize ModernizationPlan. Returned to session (report-only).
phase('Report');
const report = await agent(
  `FIRST use the Write tool to save your complete final plan markdown to ./fde-modernization-plan.md in the repo root, THEN return the same markdown as your text result. Write the Modernization Plan as professional Markdown (Angular -> ${target}). Sections:
   Executive Summary; Target Architecture; Migration Roadmap (strangler-fig, milestones); Component Map
   (spec-level table); User Stories; Stakeholder Review (per persona, risks + how the spec answers them);
   Data Migration / Risk / Rollback / Testing / Deployment / Effort; Critic Gate result; Prototype note.
   Review tier: ${RIGOROUS ? `RIGOROUS (one critic per lens${voteNote})` : 'lean (1 agent, all lenses, one-shot critic — pass {rigorous:true} for per-lens review + gap-loop)'}.
   Separate Facts / Inferences / Recommendations; keep confidence scores. Then: Epics, Features, Tasks, ADRs,
   Migration Phases, Milestones with an implementation order and called-out blockers, dependencies, quick wins.
   spec=${JSON.stringify(spec).slice(0, 150000)}
   stories=${JSON.stringify((stories && stories.stories) || []).slice(0, 60000)}
   reviews=${JSON.stringify(reviews).slice(0, 80000)}
   critic=${JSON.stringify(critique || {}).slice(0, 40000)}
   prototype=${prototypeNote.slice(0, 8000)}`,
  { label: 'plan-report', phase: 'Report', model: MODEL }
);

log(`Modernization plan complete (Angular -> ${target}, ${RIGOROUS ? 'rigorous' : 'lean'} review). Report returned to the session.`);
return report;
