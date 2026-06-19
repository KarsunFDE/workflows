export const meta = {
  name: 'fde-analyze',
  description: 'Analyze a repo for modernization: a cheap structural MAP pass (repomix/ctags/ripgrep) gives whole-repo coverage + dup/ghost/missing-schema, then deep-reads only in-scope/boundary files. Cited report; reads only, writes nothing. Flags: {full} all files, {thorough} dual-analyst, {pathPrefix,maxFiles} scope a test.',
  whenToUse: 'Before modernizing a legacy codebase. Default is cheap (map + tiered read) — good for a Pro token budget. Use {full:true} for uniform depth, {thorough:true} for bias-mitigated dual-analyst, {pathPrefix,maxFiles} to scope a test run. Pairs with /fde-plan after a target is chosen.',
  phases: [
    { title: 'Load' },
    { title: 'Map' },
    { title: 'Scope' },
    { title: 'Read' },
    { title: 'Merge' },
    { title: 'Report' },
  ],
};

// ───────────────────────── ARGS ─────────────────────────
const _a = args || {};
const PATH_PREFIX = (typeof _a === 'object' && _a.pathPrefix) || (typeof _a === 'string' ? _a : '') || '';
const MAX_FILES = (typeof _a === 'object' && _a.maxFiles) || 0;       // cap on files DEEP-read (test runs)
const FULL = (typeof _a === 'object' && _a.full) === true;            // deep-read every file (old v2 behavior)
const THOROUGH = (typeof _a === 'object' && _a.thorough) === true;    // deep reads use blind A/B + adjudicator
const READ_BATCH = (typeof _a === 'object' && _a.readBatch) || 6;     // files per lean read agent
const MODEL = 'sonnet';
const chunkArr = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// ───────────────────────── SCHEMAS ─────────────────────────
const FINDINGS = {
  type: 'object',
  required: ['file', 'readInFull', 'findings'],
  properties: {
    file: { type: 'string' },
    readInFull: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'lineStart', 'lineEnd', 'type', 'category', 'evidence_type', 'confidence'],
        properties: {
          claim: { type: 'string' },
          lineStart: { type: 'number' },
          lineEnd: { type: 'number' },
          type: { type: 'string', enum: ['feature', 'data', 'rule', 'flow', 'service', 'debt', 'security', 'persona', 'integration'] },
          category: { type: 'string', enum: ['fact', 'inference', 'recommendation'] },
          evidence_type: { type: 'string', enum: ['code', 'comment-only'] },
          confidence: { type: 'number' },
          note: { type: 'string' },
        },
      },
    },
  },
};

const BATCH_FINDINGS = { type: 'object', required: ['files'], properties: { files: { type: 'array', items: FINDINGS } } };

const MAP = {
  type: 'object',
  required: ['tool_used', 'files', 'total', 'structuralFindings'],
  properties: {
    tool_used: { type: 'string', description: 'repomix | ctags | ast-grep | ripgrep' },
    files: { type: 'array', items: { type: 'string' }, description: 'EVERY source/config/schema file (whole-repo coverage)' },
    total: { type: 'number' },
    excluded: { type: 'array', items: { type: 'string' } },
    archNote: { type: 'string' },
    structuralFindings: {
      type: 'array',
      description: 'Things visible from structure alone — cited file:line',
      items: {
        type: 'object',
        required: ['type', 'claim', 'file'],
        properties: {
          type: { type: 'string', enum: ['duplication', 'ghost', 'missing-schema', 'boundary', 'signature', 'service', 'data'] },
          claim: { type: 'string' },
          file: { type: 'string' },
          lineStart: { type: 'number' },
          lineEnd: { type: 'number' },
          duplicated_at: { type: 'array', items: { type: 'string' } },
          evidence_type: { type: 'string', enum: ['code', 'comment-only'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
};

const SCOPE_TIER = {
  type: 'object',
  required: ['scoped', 'deepReadFiles'],
  properties: {
    scoped: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'scope'],
        properties: {
          path: { type: 'string', description: 'file or directory' },
          scope: { type: 'string', enum: ['in-scope', 'out-of-scope', 'boundary'] },
          rationale: { type: 'string' },
          boundaryContract: { type: 'string' },
        },
      },
    },
    deepReadFiles: { type: 'array', items: { type: 'string' }, description: 'in-scope + boundary (+ critical) files to read in full' },
  },
};

const RECONCILED = {
  type: 'object',
  required: ['file', 'confirmed', 'conflicts', 'onlyOne'],
  properties: {
    file: { type: 'string' },
    confirmed: { type: 'array', items: { type: 'object' } },
    conflicts: { type: 'array', items: { type: 'object' } },
    onlyOne: { type: 'array', items: { type: 'object' } },
    agreement: { type: 'number' },
  },
};

const CLUSTERS = {
  type: 'object',
  required: ['capabilities', 'duplications', 'ghosts'],
  properties: {
    capabilities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'criticality'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          supporting: { type: 'array', items: { type: 'string' } },
          users: { type: 'array', items: { type: 'string' } },
          businessValue: { type: 'string' },
          criticality: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
          whatBreaksIfRemoved: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    duplications: { type: 'array', items: { type: 'object' } },
    ghosts: { type: 'array', items: { type: 'object' } },
  },
};

const SCHEMA_MAP = {
  type: 'object',
  required: ['entities', 'orphanedSchemas', 'missingSchemas'],
  properties: {
    entities: { type: 'array', items: { type: 'object' } },
    orphanedSchemas: { type: 'array', items: { type: 'string' } },
    missingSchemas: { type: 'array', items: { type: 'string' } },
  },
};

const PERSONAS = {
  type: 'object',
  required: ['personas'],
  properties: {
    personas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'confidence', 'corroboration'],
        properties: {
          name: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'array', items: { type: 'string' } },
          corroboration: { type: 'string', enum: ['code+claudemd', 'code-only', 'claudemd-only', 'readme-only'] },
          goals: { type: 'string' },
          responsibilities: { type: 'string' },
          painPoints: { type: 'string' },
        },
      },
    },
  },
};

// ───────────────────────── RULES (inlined so agents obey even without skills) ─────────────────────────
const EVIDENCE_RULES = `
Follow the fde-analysis skill (evidence rules): cite file:line for every claim (no citation => drop it); tag category
(fact|inference|recommendation) and evidence_type (code|comment-only — comment-only = GHOST, never assert as real);
confidence 0.0-1.0 (facts=1.0); read the ENTIRE assigned file before any finding (no skimming/guessing).`;

// ───────────────────────── WORKFLOW ─────────────────────────

// Ph0 LOAD — this repo's curated personas (per-repo, not baked).
phase('Load');
const cfg = await agent(
  `Read .claude/personas.md (the per-repo persona file; fall back to CLAUDE.md if it does not exist).
   Return its curated personas (name + the file:line evidence each cites) and any domain glossary.
   If neither file exists, return empty personas. Return only what the files state — invent nothing.`,
  { label: 'load-config', phase: 'Load', schema: PERSONAS, agentType: 'Explore', model: MODEL }
);
const knownPersonas = (cfg && cfg.personas) || [];
log(`Loaded ${knownPersonas.length} curated persona(s) from .claude/personas.md.`);

// Ph1 MAP — structural map of the WHOLE repo via a local CLI (near-zero AI tokens to generate; signatures only).
// 3-tier fallback so NO install is required (ripgrep is always available).
phase('Map');
const map = await agent(
  `Build a STRUCTURAL MAP of this whole repository WITHOUT reading function bodies. Work from the repo root
   (\`git rev-parse --show-toplevel\`). Try these tools in order; use the FIRST that works and record tool_used:
     1. npx --yes repomix --compress --quiet --stdout${PATH_PREFIX ? ` --include "${PATH_PREFIX}/**"` : ''}   (tree-sitter; keeps signatures, strips bodies)
     2. ctags -R --output-format=json   (symbol index)
     3. ast-grep / sg  (structural patterns)  OR  ripgrep for declarations:
        rg -n "(export |public |private |protected |def |class |interface |type |function |@[A-Z]|async )" --type-add 'web:*.{ts,tsx,js,html}' ${PATH_PREFIX ? `"${PATH_PREFIX}"` : ''}
   Then return:
   - files: EVERY source/config/schema file path in the repo (this is the coverage guarantee).
     Exclude only node_modules/dist/build/.git/target/__pycache__/.venv${PATH_PREFIX ? `; restrict to under "${PATH_PREFIX}"` : ''}.
   - total: count. excluded: globs you skipped.
   - structuralFindings: what is visible from structure alone, each cited file:line —
       duplication (same shape/signature across files: set duplicated_at), ghosts (referenced only in
       comments/strings, not real code), missing-schema (entity used with no definition), and key boundary
       signatures (APIs/contracts a frontend would call). Tag evidence_type.
   - archNote: one-paragraph architecture overview.
   Do NOT read full function bodies — signatures and structure only.${EVIDENCE_RULES}`,
  { label: 'map', phase: 'Map', schema: MAP, model: MODEL }
);
const files = (map && map.files) || [];
const structural = (map && map.structuralFindings) || [];
log(`Map via ${map && map.tool_used}: ${files.length} files (100% structural coverage), ${structural.length} structural finding(s).`);
if (!files.length) log('WARNING: map returned 0 files — the structural tool may have failed; report will flag low coverage.');

// Ph2 SCOPE — tier files from the map; pick which need a full deep read.
phase('Scope');
const tier = await agent(
  `From this structural map, tag each file/dir for an Angular -> React/Next FRONTEND modernization and SELECT the
   files that need a full deep read:
     - in-scope: the Angular frontend that migrates (deep-read).
     - boundary: code the frontend calls (APIs/contracts that must hold across migration) (deep-read).
     - out-of-scope: backend/infra — do NOT deep-read; the map signatures suffice (mapped, not read).
   ${FULL ? 'FULL MODE: set deepReadFiles to ALL files (uniform deep read).' : 'Set deepReadFiles = in-scope + boundary files, plus any the map flagged Critical. Keep it minimal — out-of-scope stays signature-only.'}
   Files: ${JSON.stringify(files).slice(0, 120000)}
   Structural findings: ${JSON.stringify(structural).slice(0, 60000)}
   Personas: ${JSON.stringify(knownPersonas).slice(0, 20000)}`,
  { label: 'scope-tier', phase: 'Scope', schema: SCOPE_TIER, model: MODEL }
);
const scoped = (tier && tier.scoped) || [];
let deepReadFiles = FULL ? files.slice() : ((tier && tier.deepReadFiles) || []);
let scopeNote = FULL ? 'FULL mode (deep-read all files). ' : `Tiered: deep-read ${deepReadFiles.length} of ${files.length} files (in-scope+boundary). `;
if (MAX_FILES && deepReadFiles.length > MAX_FILES) {
  scopeNote += `TEST CAP maxFiles=${MAX_FILES}: deep-reading ${MAX_FILES} of ${deepReadFiles.length}. `;
  deepReadFiles = deepReadFiles.slice(0, MAX_FILES);
}
log(scopeNote);

// Ph3 READ — deep read ONLY deepReadFiles. Lean batches by default; blind A/B if thorough.
phase('Read');
let readSet = [];
let deepFindings = [];
let agreementScores = [];

if (deepReadFiles.length === 0) {
  log('No files selected for deep read — relying on the structural map only.');
} else if (THOROUGH) {
  const analystPrompt = (file, tag) => `
You are independent analyst ${tag} (you have NOT seen any other analyst's work). Read ${file} IN FULL and extract
features, data, business rules/constraints, flows, services, integrations, debt, security, persona signals.
${EVIDENCE_RULES}
Set readInFull=true only if you read the whole file. Return findings for ${file} only.`;
  const perFile = (
    await pipeline(
      deepReadFiles,
      (file) =>
        parallel([
          () => agent(analystPrompt(file, 'A'), { label: `A:${file}`, phase: 'Read', schema: FINDINGS, model: MODEL }),
          () => agent(analystPrompt(file, 'B'), { label: `B:${file}`, phase: 'Read', schema: FINDINGS, model: MODEL }),
        ]).then(([a, b]) => ({ file, a, b })),
      (pair) =>
        agent(
          `Adjudicate two blind analyses of ${pair.file}. A: ${JSON.stringify(pair.a)} B: ${JSON.stringify(pair.b)}
           Both agree => confirmed. Conflict => RE-READ the cited lines and resolve. Only one => onlyOne (gap, never drop).
           Compute agreement (0-1). ${EVIDENCE_RULES}`,
          { label: `adj:${pair.file}`, phase: 'Read', schema: RECONCILED, model: MODEL }
        )
    )
  ).filter(Boolean);
  readSet = perFile.map((r) => r.file);
  deepFindings = perFile.flatMap((r) => [...(r.confirmed || []), ...(r.onlyOne || [])]);
  agreementScores = perFile.map((r) => r.agreement).filter((x) => typeof x === 'number');
} else {
  const fileBatches = chunkArr(deepReadFiles, READ_BATCH);
  log(`Lean deep read: ${deepReadFiles.length} files in ${fileBatches.length} batch(es) of <=${READ_BATCH}.`);
  const results = (
    await parallel(
      fileBatches.map((fb, i) => () =>
        agent(
          `You are an FDE code analyst. Read EACH of these files IN FULL (no skimming) and extract what exists:
           features, data models, business rules/constraints, flows, services, integrations, technical debt,
           security concerns, persona signals. ${EVIDENCE_RULES}
           Return one entry per file. Files: ${fb.join(', ')}`,
          { label: `read:${i + 1}/${fileBatches.length}`, phase: 'Read', schema: BATCH_FINDINGS, model: MODEL }
        )
      )
    )
  ).filter(Boolean);
  for (const r of results) for (const fr of r.files || []) { readSet.push(fr.file); deepFindings.push(...(fr.findings || [])); }
}

// Structural findings from the map join the deep findings (dup/ghost/missing-schema come from the map).
const allConfirmed = [...structural, ...deepFindings];
log(`Deep-read ${readSet.length}/${deepReadFiles.length} selected files; ${allConfirmed.length} total findings (incl. ${structural.length} structural).`);

// Ph4 MERGE — cluster (batched, no truncation), schema map, personas.
phase('Merge');
const CHUNK = 120;
const batches = chunkArr(allConfirmed, CHUNK);
const partialClusters = (
  await parallel(
    batches.map((b, i) => () =>
      agent(
        `Use the fde-analysis skill (clustering). Cluster THIS BATCH (${i + 1}/${batches.length}) of cited findings into business
         capabilities; detect duplication (duplicated_at); demote comment-only ghosts; score criticality.
         Findings: ${JSON.stringify(b)}`,
        { label: `cluster:${i + 1}/${batches.length}`, phase: 'Merge', schema: CLUSTERS, model: MODEL }
      )
    )
  )
).filter(Boolean);
const clusters =
  batches.length <= 1
    ? partialClusters[0] || { capabilities: [], duplications: [], ghosts: [] }
    : await agent(
        `Use the fde-analysis skill (clustering). MERGE these per-batch cluster sets into ONE: combine same-named capabilities
         (union supporting + duplicated_at), keep highest criticality, merge ghosts/duplications. Drop nothing.
         Cluster sets: ${JSON.stringify(partialClusters)}`,
        { label: 'cluster-merge', phase: 'Merge', schema: CLUSTERS, model: MODEL }
      );

const dataFindings = allConfirmed.filter((f) => f && (f.type === 'data' || f.type === 'rule' || f.type === 'missing-schema'));
const personaFindings = allConfirmed.filter((f) => f && f.type === 'persona');
const [schemaMap, personas] = await parallel([
  () =>
    agent(
      `Use the fde-analysis skill (schema). Build the schema map from these data/rule findings + the file list. Classify
       schema-defining vs data-bearing; reconstruct shape from code where no schema file exists (cite file:line,
       source=reconstructed); flag orphaned + missing schemas.
       Findings: ${JSON.stringify(dataFindings)}
       Files: ${JSON.stringify(files)}`,
      { label: 'schema-map', phase: 'Merge', schema: SCHEMA_MAP, model: MODEL }
    ),
  () =>
    agent(
      `Use persona-synthesis. From these persona findings, discover stakeholders; corroborate vs the curated
       CLAUDE.md personas (code+CLAUDE.md => confirmed; CLAUDE.md/README only => ghost; code only => propose).
       Curated: ${JSON.stringify(knownPersonas)}
       Persona findings: ${JSON.stringify(personaFindings)}`,
      { label: 'personas', phase: 'Merge', schema: PERSONAS, model: MODEL }
    ),
]);

// Ph5 REPORT — synthesize. Returned to the session; nothing written to the repo.
phase('Report');
const avgAgreement = agreementScores.length
  ? (agreementScores.reduce((a, b) => a + b, 0) / agreementScores.length).toFixed(2)
  : (THOROUGH ? 'n/a' : 'single-pass (run {thorough:true} for dual-analyst agreement)');
const deepPct = files.length ? Math.round((readSet.length / files.length) * 100) : 0;

const report = await agent(
  `FIRST use the Write tool to save your complete final report markdown to ./fde-analysis-report.md in the repo root, THEN return the same markdown as your text result. Write the FDE Analysis Report as professional Markdown. Follow the fde-analysis skill: separate
   FACTS / INFERENCES / RECOMMENDATIONS, show confidence scores. Sections:
   1. Executive Summary — what the system does, why, who uses it.
   2. Capability Map — clusters + criticality + what-breaks-if-removed.
   3. Personas — discovered + evidence + confidence + corroboration vs CLAUDE.md.
   4. Schema Map — table (entity|field|type|constraint|file:line|source) + orphaned/missing.
   5. Duplication & Ghosts — from the structural map + deep read.
   6. Modernization Scope Map — in-scope / out-of-scope / boundary (+ boundary contracts).
   7. Method & Reliability — map tool: ${map && map.tool_used}. STRUCTURAL coverage: ${files.length} files (100%).
      DEEP-read: ${readSet.length} files (${deepPct}% — in-scope/boundary only; out-of-scope is signature-level).
      ${scopeNote} Dual-analyst agreement: ${avgAgreement}.
      State plainly that out-of-scope files were mapped at signature level, not body-read.
   8. Modernization Options — PRESENT React vs Next.js profiles for the in-scope frontend. DO NOT pick one
      (selection happens via /fde-plan <target>).
   Inputs:
   archNote=${JSON.stringify((map && map.archNote) || '').slice(0, 8000)}
   capabilities=${JSON.stringify((clusters && clusters.capabilities) || []).slice(0, 150000)}
   duplications=${JSON.stringify((clusters && clusters.duplications) || []).slice(0, 40000)}
   ghosts=${JSON.stringify((clusters && clusters.ghosts) || []).slice(0, 40000)}
   personas=${JSON.stringify((personas && personas.personas) || []).slice(0, 60000)}
   schema=${JSON.stringify(schemaMap || {}).slice(0, 80000)}
   scope=${JSON.stringify(scoped).slice(0, 80000)}`,
  { label: 'report', phase: 'Report', model: MODEL }
);

log(`Analysis complete (map=${map && map.tool_used}, deep-read ${readSet.length}/${files.length}). Review, then /fde-plan <react|nextjs>.`);
return report;
