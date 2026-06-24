export const meta = {
  name: 'fde-implement',
  description: 'Turn a /fde-plan report into implementation specs with before/after code snippets and acceptance criteria, written to ./fde-spec/<unit>.md. Steps 4, 6, 7 of the Galent 7-step: spec writing, subtask breakdown, build agents. Works for any modernization target (framework migration, version upgrade, infra change, etc.). Never edits the real app. Args {planReport?, sandboxDir?}.',
  whenToUse: 'Run AFTER /fde-plan. Pass the plan report as args.planReport (paste the markdown). Works for any target — React, Next.js, Spring Boot upgrade, Kubernetes migration, or anything else /fde-plan produced. Optionally pass args.sandboxDir to emit Docker/EKS manifests there (cloud task 1.4). Report-only when no sandboxDir given.',
  phases: [
    { title: 'Load' },
    { title: 'Spec' },
    { title: 'Tasks' },
    { title: 'Report' },
    { title: 'Build', detail: 'opus plans each subtask, sonnet acts in sandbox — only runs when sandboxDir is passed' },
    { title: 'Cloud', detail: 'emit Dockerfile + EKS manifests per service into sandboxDir — only runs when sandboxDir is passed' },
  ],
};

// args: bare string => treat as planReport, object => {planReport?, sandboxDir?, cloudArchReport?}
const _a = args || {};
const planReport = (typeof _a === 'string' ? _a : _a.planReport) || '';
const sandboxDir = (typeof _a === 'object' && _a.sandboxDir) || '';
// cloudArchReport: the ## Cloud Architecture section from /fde-plan (Group 2's output).
// Falls back to scanning planReport for that section when not passed separately.
const cloudArchReport = (typeof _a === 'object' && _a.cloudArchReport) || '';
const MODEL = 'sonnet';

if (!planReport) {
  log('WARNING: No planReport passed. Run /fde-plan first and pass its output as args.planReport.');
}

// ───────────────────────── SCHEMAS ─────────────────────────

const PLAN_ITEMS = {
  type: 'object',
  required: ['units'],
  properties: {
    units: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'type', 'description'],
        properties: {
          id: { type: 'string', description: 'slug-safe filename, e.g. migrate-auth-component' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['epic', 'story', 'subtask', 'component', 'service', 'migration-step'] },
          description: { type: 'string' },
          inputs: { type: 'array', items: { type: 'string' } },
          outputs: { type: 'array', items: { type: 'string' } },
          dependencies: { type: 'array', items: { type: 'string' }, description: 'ids of units this depends on' },
          findingRefs: { type: 'array', items: { type: 'string' }, description: 'F-001 style IDs from /fde-analyze' },
          parentId: { type: 'string', description: 'id of parent epic or story, if any' },
        },
      },
    },
  },
};

const IMPL_SPEC = {
  type: 'object',
  required: ['id', 'title', 'summary', 'before', 'after', 'acceptance'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
    before: {
      type: 'object',
      required: ['description', 'codeSnippet'],
      properties: {
        description: { type: 'string' },
        codeSnippet: { type: 'string', description: 'representative existing code (real or illustrative from the plan context)' },
        language: { type: 'string' },
        fileHint: { type: 'string', description: 'likely source file path' },
      },
    },
    after: {
      type: 'object',
      required: ['description', 'codeSnippet'],
      properties: {
        description: { type: 'string' },
        codeSnippet: { type: 'string', description: 'concrete target implementation code, not pseudocode' },
        language: { type: 'string' },
        fileHint: { type: 'string', description: 'target file path' },
      },
    },
    acceptance: { type: 'array', items: { type: 'string' }, description: 'specific, testable criteria (Given/When/Then preferred)' },
    risks: { type: 'array', items: { type: 'string' } },
    effort: { type: 'string', enum: ['XS', 'S', 'M', 'L', 'XL'] },
    findingRefs: { type: 'array', items: { type: 'string' } },
  },
};

const SUBTASKS = {
  type: 'object',
  required: ['subtasks'],
  properties: {
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'parentId', 'acceptance', 'effort'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          parentId: { type: 'string' },
          description: { type: 'string' },
          acceptance: { type: 'array', items: { type: 'string' } },
          effort: { type: 'string', enum: ['XS', 'S', 'M'] },
          touchFiles: { type: 'array', items: { type: 'string' }, description: 'files this subtask will create or modify' },
        },
      },
    },
  },
};

// ───────────────────────── Ph0 LOAD ─────────────────────────
// Parse the plan report into discrete units of work.
phase('Load');
const extracted = await agent(
  `Read the /fde-plan report below and extract every distinct unit of work.
   Include: epics, stories, services, modules, components, migration steps, upgrade steps, infra changes, ADRs, milestones — whatever units the plan contains, regardless of tech stack.
   For each unit:
   - id: slug-safe (lowercase-hyphenated, max 40 chars, filename-safe — no spaces or special chars)
   - title: human-readable
   - type: epic | story | subtask | component | service | migration-step
   - description: what needs to be done
   - inputs/outputs: data or artifacts this unit consumes/produces (if stated)
   - dependencies: ids of other units this one depends on
   - findingRefs: any F-xxx finding IDs from /fde-analyze referenced in the plan
   - parentId: id of the parent epic/story if this is a child unit
   If the report has an epic→story→subtask hierarchy, preserve parent/child relationships.
   Extract every actionable unit — do not summarize or merge. Return all.

   PLAN REPORT:
   ${planReport.slice(0, 200000) || '[No plan report provided — return 1 placeholder unit with id "placeholder-unit"]'}`,
  { label: 'parse-plan', phase: 'Load', schema: PLAN_ITEMS, model: MODEL }
);
const units = (extracted && extracted.units) || [];
if (!units.length) {
  log('WARNING: 0 units extracted. Confirm planReport is a /fde-plan output (markdown with epics/stories/steps). Continuing with empty set — no spec files will be written.');
} else {
  log(`Parsed ${units.length} unit(s) of work from the plan.`);
}

// ───────────────────────── Ph1 SPEC ─────────────────────────
// For each unit, generate an implementation spec with before/after code snippets.
phase('Spec');
const specs = (
  await pipeline(
    units,
    (unit) =>
      agent(
        `Write a complete implementation spec for this unit of work.

         UNIT:
         ${JSON.stringify(unit)}

         PLAN CONTEXT (for code patterns and naming):
         ${planReport.slice(0, 80000) || '[No plan context — infer from unit description]'}

         Return a structured spec with:
         - id: keep exactly as given in the unit
         - title: keep exactly as given in the unit
         - summary: 2-3 sentences — what this unit achieves and why it matters
         - before: the CURRENT (pre-change) state — whatever the plan says exists today, regardless of tech stack
             * description: what exists today and what problem it has
             * codeSnippet: representative code showing the current pattern. Base on plan context;
               if no real code is quoted, write illustrative code that matches the described legacy pattern.
             * language: the current language (typescript, java, python, yaml, hcl — whatever fits)
             * fileHint: likely source file path in the current app
         - after: the TARGET state — whatever the plan says the modernized version looks like
             * description: what the updated code does differently
             * codeSnippet: concrete, runnable target code — NOT pseudocode. Show the real implementation pattern.
             * language: target language (may differ from before if the unit is a language migration)
             * fileHint: target file path in the modernized app
         - acceptance: 3–6 specific, testable acceptance criteria. Prefer Given/When/Then format.
         - risks: implementation gotchas or blockers (empty array if none)
         - effort: XS (< 1h) | S (half day) | M (1 day) | L (2-3 days) | XL (week+)
         - findingRefs: F-xxx IDs from the analysis that this unit addresses (from unit.findingRefs)`,
        { label: `spec:${unit.id}`, phase: 'Spec', schema: IMPL_SPEC, model: MODEL }
      )
  )
).filter(Boolean);
log(`Generated ${specs.length} implementation spec(s) with before/after code.`);

// ───────────────────────── Ph2 TASKS ─────────────────────────
// Break each spec into single-engineer subtasks (task 1.2).
// Epics skip breakdown — they own child units. Everything else gets subtasks.
phase('Tasks');
const specsForBreakdown = specs.filter((s) => {
  const unit = units.find((u) => u && s && u.id === s.id);
  return unit && unit.type !== 'epic';
});

const subtaskSets = specsForBreakdown.length
  ? (
      await pipeline(
        specsForBreakdown,
        (spec) =>
          agent(
            `Break this implementation spec into single-engineer subtasks.
             Each subtask must be completable in 1 day or less (XS/S/M effort).
             Never produce a subtask larger than M.
             For each subtask:
             - id: parent id + hyphen + index, e.g. "${(spec && spec.id) || 'unit'}-t1"
             - title: imperative verb phrase, e.g. "Add auth token validator"
             - parentId: "${(spec && spec.id) || 'unit'}"
             - description: exactly what to do
             - acceptance: 2-4 specific, testable criteria
             - effort: XS | S | M
             - touchFiles: files this subtask will create or modify (best-effort)

             SPEC:
             ${JSON.stringify(spec)}`,
            { label: `tasks:${spec && spec.id}`, phase: 'Tasks', schema: SUBTASKS, model: MODEL }
          )
      )
    ).filter(Boolean)
  : [];

const allSubtasks = subtaskSets.flatMap((s) => (s && s.subtasks) || []);
log(`Broke ${specsForBreakdown.length} spec(s) into ${allSubtasks.length} single-engineer subtask(s).`);

// ───────────────────────── Ph3 REPORT ─────────────────────────
// One agent per spec writes its own ./fde-spec/<id>.md file (reliable: each agent owns one Write call).
// A final synthesis agent returns the session-level summary table.
phase('Report');

const SPEC_TEMPLATE = (spec, unitType, mySubtasks) => {
  const refs = (spec.findingRefs || []).join(', ') || '—';
  const subtaskLines = mySubtasks.length
    ? mySubtasks.map((t) => `- [ ] **${t.id}** (${t.effort}) — ${t.title}\n  Touches: ${(t.touchFiles || []).join(', ') || '—'}`).join('\n')
    : '_(Broken down at epic level — see child spec files.)_';
  return `# ${spec.title}

**Type:** ${unitType || spec.id}  |  **Effort:** ${spec.effort}  |  **Finding Refs:** ${refs}

## Summary
${spec.summary}

## Before
**File:** \`${(spec.before && spec.before.fileHint) || '—'}\`

\`\`\`${(spec.before && spec.before.language) || ''}
${(spec.before && spec.before.codeSnippet) || ''}
\`\`\`

${(spec.before && spec.before.description) || ''}

## After
**File:** \`${(spec.after && spec.after.fileHint) || '—'}\`

\`\`\`${(spec.after && spec.after.language) || ''}
${(spec.after && spec.after.codeSnippet) || ''}
\`\`\`

${(spec.after && spec.after.description) || ''}

## Acceptance Criteria
${(spec.acceptance || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Subtasks
${subtaskLines}

## Risks
${(spec.risks || []).length ? (spec.risks || []).map((r) => `- ${r}`).join('\n') : 'None identified.'}
`;
};

// Write one file per spec — each agent owns exactly one Write call.
const written = (
  await pipeline(
    specs,
    (spec) => {
      const unit = units.find((u) => u && spec && u.id === spec.id);
      const mySubtasks = allSubtasks.filter((t) => t && t.parentId === spec.id);
      const content = SPEC_TEMPLATE(spec, unit && unit.type, mySubtasks);
      const filePath = `./fde-spec/${spec.id}.md`;
      return agent(
        `Use the Write tool to save the following content EXACTLY as-is to the file path "${filePath}". Do not alter the content. After writing, return the string "${filePath}" as your result.

CONTENT:
${content}`,
        { label: `write:${spec.id}`, phase: 'Report', model: MODEL }
      );
    }
  )
).filter(Boolean);

// Synthesis: session-level summary table + implementation order.
const report = await agent(
  `Produce a Markdown summary of the implementation specs written for this modernization sprint.

   Include:
   1. A table: | Spec ID | Title | Type | Effort | Subtasks | Finding Refs |
   2. Total specs written, total subtasks, estimated total effort range
   3. Suggested implementation order (respecting dependencies from the units data)
   4. Cross-spec risks or integration watch-points

   UNITS (dependency + type data):
   ${JSON.stringify(units).slice(0, 40000)}

   SPECS (titles, effort, refs):
   ${JSON.stringify(specs.map((s) => ({ id: s.id, title: s.title, effort: s.effort, findingRefs: s.findingRefs, risks: s.risks }))).slice(0, 60000)}

   SUBTASKS (counts per parent):
   ${JSON.stringify(allSubtasks.map((t) => ({ id: t.id, parentId: t.parentId, effort: t.effort }))).slice(0, 40000)}

   Files written: ${written.join(', ')}`,
  { label: 'summary', phase: 'Report', model: MODEL }
);

log(`fde-spec/ written: ${written.length}/${specs.length} file(s), ${allSubtasks.length} subtask(s).`);

// ───────────────────────── Ph4 BUILD (gated) ─────────────────────────
// Only runs when sandboxDir is explicitly passed. Never touches the real app.
// Per subtask: opus drafts a precise implementation plan, sonnet carries it out
// writing ONLY to sandboxDir, then a test + rollback note closes the loop.
// Budget-bounded so the build loop can't run away.

const BUILD_PLAN = {
  type: 'object',
  required: ['subtaskId', 'approach', 'filesToWrite', 'testCommand', 'rollback'],
  properties: {
    subtaskId: { type: 'string' },
    approach: { type: 'string', description: 'step-by-step implementation plan' },
    filesToWrite: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'description'],
        properties: {
          path: { type: 'string', description: 'path UNDER sandboxDir — never outside it' },
          description: { type: 'string' },
          language: { type: 'string' },
        },
      },
    },
    testCommand: { type: 'string', description: 'shell command to verify the subtask output' },
    rollback: { type: 'string', description: 'how to undo this subtask if it breaks something' },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

const BUILD_RESULT = {
  type: 'object',
  required: ['subtaskId', 'filesWritten', 'testNote'],
  properties: {
    subtaskId: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    testNote: { type: 'string', description: 'what to run/check to verify this subtask' },
    rollback: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

let buildNote = 'Build phase skipped (no sandboxDir passed — pass args.sandboxDir to enable).';

if (sandboxDir) {
  phase('Build');

  // Cap the subtasks we'll actually build so the loop can't run forever.
  // Budget-aware: scale fleet to remaining token budget; floor at 1, cap at 8 subtasks.
  const MAX_BUILD = budget.total
    ? Math.min(8, Math.max(1, Math.floor(budget.remaining() / 60000)))
    : Math.min(8, allSubtasks.length);

  // Prefer XS/S subtasks first (lowest risk for a skeleton run).
  const EFFORT_ORDER = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };
  const buildQueue = allSubtasks
    .slice()
    .sort((a, b) => (EFFORT_ORDER[a.effort] || 99) - (EFFORT_ORDER[b.effort] || 99))
    .slice(0, MAX_BUILD);

  log(`Build phase: sandboxDir="${sandboxDir}", running ${buildQueue.length}/${allSubtasks.length} subtask(s) (budget cap=${MAX_BUILD}).`);

  const buildResults = (
    await pipeline(
      buildQueue,

      // Stage 1 — PLAN (opus): detailed implementation approach per subtask.
      (subtask) => {
        const parentSpec = specs.find((s) => s && s.id === subtask.parentId);
        return agent(
          `You are a senior engineer planning the implementation of a single subtask.
           Produce a precise, step-by-step implementation plan (approach) for this subtask.
           ALL files must be written UNDER "${sandboxDir}" — never outside it and never to the real app.
           Specify each file to create/modify (path relative to sandboxDir), its purpose, and language.
           Include a shell testCommand to verify the output compiles/runs/passes.
           Include a rollback note (what to delete/revert if this subtask breaks things).

           SUBTASK:
           ${JSON.stringify(subtask)}

           PARENT SPEC (before/after context):
           ${JSON.stringify(parentSpec || {})}`,
          { label: `plan:${subtask.id}`, phase: 'Build', schema: BUILD_PLAN, model: 'opus' }
        );
      },

      // Stage 2 — ACT (sonnet + worktree isolation): carry out the plan, write files to sandbox.
      (buildPlan, subtask) => {
        if (!buildPlan) return null;
        return agent(
          `You are implementing a modernization subtask in a sandbox directory.
           Follow this plan EXACTLY. Write ALL files under "${sandboxDir}" — NEVER modify files outside it.
           After writing all files, return the list of files written, the testNote (what to run to verify),
           the rollback instructions, and any warnings.

           PLAN:
           ${JSON.stringify(buildPlan)}

           SUBTASK ID: ${subtask.id}
           SANDBOX DIR: ${sandboxDir}`,
          { label: `act:${subtask.id}`, phase: 'Build', schema: BUILD_RESULT, model: MODEL, isolation: 'worktree' }
        );
      }
    )
  ).filter(Boolean);

  const builtCount = buildResults.length;
  const allFilesWritten = buildResults.flatMap((r) => r.filesWritten || []);
  buildNote = `Build phase complete: ${builtCount}/${buildQueue.length} subtask(s) executed in ${sandboxDir}.\nFiles written: ${allFilesWritten.join(', ') || '(none confirmed)'}\n\nPer-subtask results:\n${buildResults.map((r) => `- **${r.subtaskId}**: ${(r.filesWritten || []).length} file(s). Test: \`${r.testNote}\`. Rollback: ${r.rollback}`).join('\n')}`;

  log(`Build done: ${builtCount} subtask(s) acted, ${allFilesWritten.length} file(s) written to ${sandboxDir}.`);
}

// ───────────────────────── Ph5 CLOUD (gated) ─────────────────────────
// Emit real Dockerfile + Kubernetes manifests for the 1-2 highest-value services.
// Reads the ## Cloud Architecture section from Group 2's /fde-plan output.
// Writes ONLY into sandboxDir. Never touches the real app.

const CLOUD_SERVICES = {
  type: 'object',
  required: ['services'],
  properties: {
    services: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'value', 'baseImage', 'port', 'namespace'],
        properties: {
          name: { type: 'string', description: 'slug-safe service name, e.g. grant-application-service' },
          value: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], description: 'business value for prioritisation' },
          baseImage: { type: 'string', description: 'Docker base image, e.g. eclipse-temurin:17-jre-alpine' },
          port: { type: 'number', description: 'container port the service listens on' },
          namespace: { type: 'string', description: 'Kubernetes namespace' },
          replicas: { type: 'number', description: 'initial replica count' },
          envVars: { type: 'array', items: { type: 'string' }, description: 'env var names (no values — reference ConfigMap/Secret)' },
          secretNames: { type: 'array', items: { type: 'string' }, description: 'Secret names this service needs' },
          configMapNames: { type: 'array', items: { type: 'string' }, description: 'ConfigMap names this service needs' },
          buildContext: { type: 'string', description: 'Docker build context path relative to repo root' },
        },
      },
    },
  },
};

let cloudNote = 'Cloud phase skipped (no sandboxDir passed — pass args.sandboxDir to enable).';

if (sandboxDir) {
  phase('Cloud');

  // Use cloudArchReport if passed separately; otherwise extract the Cloud Architecture
  // section from planReport (Group 2 writes it as ## Cloud Architecture in the plan).
  const cloudSource = cloudArchReport ||
    (() => {
      const marker = planReport.indexOf('## Cloud Architecture');
      return marker !== -1 ? planReport.slice(marker, marker + 40000) : '';
    })();

  if (!cloudSource) {
    log('WARNING: No Cloud Architecture section found in planReport and no cloudArchReport passed. Cloud phase will infer from plan context — results may be approximate. Pass args.cloudArchReport (Group 2\'s ## Cloud Architecture section) for accurate manifests.');
  }

  // Extract service specs from the cloud architecture, pick top 1-2 by value.
  const cloudParsed = await agent(
    `Read this Cloud Architecture section (from /fde-plan) and extract every service it describes.
     For each service return: name (slug-safe), business value (Critical/High/Medium/Low),
     Docker base image, container port, Kubernetes namespace, replica count, env var names,
     Secret names, ConfigMap names, Docker build context path.
     If the section doesn't specify a field, infer a safe default (e.g. replicas=2, namespace=default).
     Return ALL services found.

     CLOUD ARCHITECTURE:
     ${cloudSource.slice(0, 60000) || planReport.slice(0, 60000)}`,
    { label: 'cloud-parse', phase: 'Cloud', schema: CLOUD_SERVICES, model: MODEL }
  );

  const VALUE_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const allServices = (cloudParsed && cloudParsed.services) || [];
  // Emit manifests for top 2 highest-value services only (cost + risk control).
  const topServices = allServices
    .slice()
    .sort((a, b) => (VALUE_ORDER[a.value] || 99) - (VALUE_ORDER[b.value] || 99))
    .slice(0, 2);

  log(`Cloud: ${allServices.length} service(s) found, emitting manifests for top ${topServices.length}: ${topServices.map((s) => s.name).join(', ')}.`);

  const manifestResults = (
    await pipeline(
      topServices,

      // Stage 1: generate Dockerfile content for this service.
      (svc) =>
        agent(
          `Write a production-ready Dockerfile for this service.
           Base image: ${svc.baseImage}. Build context: ${svc.buildContext || '.'}.
           The app listens on port ${svc.port}.
           Use multi-stage build if it makes sense for the stack (e.g. builder + runtime stages).
           Include: WORKDIR, COPY, build command, EXPOSE ${svc.port}, CMD/ENTRYPOINT.
           Return ONLY the raw Dockerfile text — no markdown fences, no explanation.
           SERVICE: ${JSON.stringify(svc)}`,
          { label: `dockerfile:${svc.name}`, phase: 'Cloud', model: MODEL }
        ).then((dockerfile) => ({ svc, dockerfile })),

      // Stage 2: generate K8s Deployment + Service YAML.
      ({ svc, dockerfile }) =>
        agent(
          `Write Kubernetes manifests for this service targeting Amazon EKS.
           Produce TWO YAML documents separated by ---:
           1. Deployment: namespace=${svc.namespace}, replicas=${svc.replicas || 2},
              image placeholder=\`<ECR_REGISTRY>/${svc.name}:latest\`,
              containerPort=${svc.port}, resource requests/limits (reasonable defaults),
              envFrom referencing ConfigMaps ${JSON.stringify(svc.configMapNames || [])} and
              Secrets ${JSON.stringify(svc.secretNames || [])},
              readinessProbe + livenessProbe on port ${svc.port}.
           2. Service: ClusterIP, port 80 → targetPort ${svc.port}, selector matching the Deployment.
           Return ONLY the raw YAML — no markdown fences, no explanation.
           SERVICE: ${JSON.stringify(svc)}`,
          { label: `k8s:${svc.name}`, phase: 'Cloud', model: MODEL }
        ).then((k8sYaml) => ({ svc, dockerfile, k8sYaml })),

      // Stage 3: write files — one agent per file (each owns exactly one Write call).
      ({ svc, dockerfile, k8sYaml }) =>
        parallel([
          () =>
            agent(
              `Use the Write tool to save the following content EXACTLY as-is to "${sandboxDir}/docker/${svc.name}/Dockerfile". Do not alter the content. After writing, return the string "${sandboxDir}/docker/${svc.name}/Dockerfile" as your result.\n\nCONTENT:\n${dockerfile}`,
              { label: `write-dockerfile:${svc.name}`, phase: 'Cloud', model: MODEL }
            ),
          () =>
            agent(
              `Use the Write tool to save the following content EXACTLY as-is to "${sandboxDir}/k8s/${svc.name}/manifests.yaml". Do not alter the content. After writing, return the string "${sandboxDir}/k8s/${svc.name}/manifests.yaml" as your result.\n\nCONTENT:\n${k8sYaml}`,
              { label: `write-k8s:${svc.name}`, phase: 'Cloud', model: MODEL }
            ),
        ]).then((results) => ({ svc, filesWritten: results.filter(Boolean) }))
    )
  ).filter(Boolean);

  // Use agent-confirmed paths — not hardcoded reconstructions.
  const cloudFiles = manifestResults.flatMap((r) => (r && r.filesWritten) || []);

  cloudNote = `Cloud manifests emitted for ${topServices.map((s) => s.name).join(', ')} (top ${topServices.length} of ${allServices.length} service(s) by value).\n\nFiles written:\n${cloudFiles.map((f) => `- \`${f}\``).join('\n')}\n\n> Apply with: \`kubectl apply -f ${sandboxDir}/k8s/<service>/manifests.yaml\`\n> Build image: \`docker build -t <service> ${sandboxDir}/docker/<service>/\``;

  log(`Cloud done: manifests written for ${topServices.length} service(s) to ${sandboxDir}.`);
}

return `${report}\n\n---\n\n## Build Phase\n\n${buildNote}\n\n---\n\n## Cloud Manifests\n\n${cloudNote}`;
