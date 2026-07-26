import {
  applySceneExecutionPromptCanary,
  buildGenerationSnapshot,
  collectSceneExecutionCanaryEvidence,
  collectSceneExecutionLegacyEvidence,
  createImmutableSceneContract,
  evaluateSceneExecutionCanaryComparison,
  findNarrativeMetaLeaks,
  prepareSceneExecutionCanaryTrial,
  prepareSceneExecutionPromptCanary,
  prepareSceneExecutionShadowIntegration,
  SCENE_CONTEXT_COMPOSER_FEATURE,
  SCENE_EXECUTION_CANARY_COMPARISON_FEATURE,
  SCENE_EXECUTION_CANARY_TRIAL_FEATURE,
  SCENE_EXECUTION_PROMPT_CANARY_FEATURE,
  SCENE_EXECUTION_SHADOW_FEATURE,
} from './generationContext.js';

export const SCENE_EXECUTION_LIVE_CANARY_VERSION =
  'scene-execution-live-canary-v8';

export const SCENE_EXECUTION_LIVE_CANARY_FEATURE = Object.freeze({
  key: 'scene_execution_live_canary_v8',
  defaultEnabled: false,
});

const LIVE_CANARY_MODE = 'test-only-local-llama-paired-evaluation';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080/v1';
const PREFERRED_MODEL = 'qwen3.6-35b-uncensored';
const AUTHORITY_BEGIN =
  '<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>';
const AUTHORITY_END =
  '<<< END VALIDATED SCENE EXECUTION AUTHORITY >>>';
const STAGE8_POV_IDENTITY = 'Hero';
const AUTHORITY_ADHERENCE_ISSUE_CODES = new Set([
  'POV_IDENTITY_DRIFT',
  'UNAUTHORIZED_EVENT_INSTRUMENT',
  'UNSUPPORTED_HISTORY_OR_KNOWLEDGE',
  'UNSUPPORTED_SETTING_DETAIL',
]);

const RUN_INPUT_KEYS = new Set(['integration', 'fetchImpl']);
const INTEGRATION_KEYS = new Set([
  'flags',
  'mode',
  'runId',
  'endpoint',
  'model',
  'seed',
  'temperature',
  'maxTokens',
  'timeoutMs',
]);
const FLAG_KEYS = new Set([
  SCENE_CONTEXT_COMPOSER_FEATURE.key,
  SCENE_EXECUTION_SHADOW_FEATURE.key,
  SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key,
  SCENE_EXECUTION_CANARY_TRIAL_FEATURE.key,
  SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.key,
  SCENE_EXECUTION_LIVE_CANARY_FEATURE.key,
]);

const STAGE8_BASE_PROMPT = [
  'Write one finished fiction scene in close third-person past tense.',
  'Return manuscript prose only: no heading, outline, analysis, planning language, or commentary.',
  'Target length: 220-320 words.',
  '',
  'CURRENT SCENE:',
  '- Point of view: Hero.',
  '- Scene goal: Open the locked room.',
  '- Entry state: Hero holds the brass latch outside the locked room.',
  '- Required event: Hero opens the locked room.',
  '- Exit state: Hero stands inside the room.',
  '- Continuity dependency: Hero still holds the brass latch.',
  '- Forbidden in this scene: Do not open the chest, reveal its contents, or discover the sealed letter.',
  '',
  'End immediately after Hero has entered the room. Do not advance the story beyond that boundary.',
].join('\n');

export class SceneExecutionLiveCanaryError extends Error {
  constructor(message, code, issues = []) {
    super(message);
    this.name = 'SceneExecutionLiveCanaryError';
    this.code = code;
    this.issues = Object.freeze(issues.slice());
  }
}

function fail(message, code, issue) {
  throw new SceneExecutionLiveCanaryError(message, code, [issue]);
}

function inspectRecord(record, path, allowedKeys) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail(
      `Invalid Stage 8 record at ${path}`,
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
      `${path} must be a plain record`
    );
  }
  const proto = Object.getPrototypeOf(record);
  if (proto !== Object.prototype && proto !== null) {
    fail(
      `Invalid Stage 8 prototype at ${path}`,
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
      `${path} must have Object.prototype or null prototype`
    );
  }
  if (Object.getOwnPropertySymbols(record).length > 0) {
    fail(
      `Invalid Stage 8 symbol property at ${path}`,
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
      `${path} may not contain symbol properties`
    );
  }
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(record)
  )) {
    if (!allowedKeys.has(key)) {
      fail(
        `Unknown Stage 8 property at ${path}.${key}`,
        'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
        `${path}.${key} is not allowed`
      );
    }
    if (
      descriptor.get ||
      descriptor.set ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      fail(
        `Unsafe Stage 8 property at ${path}.${key}`,
        'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
        `${path}.${key} must be an own enumerable data property`
      );
    }
  }
}

function ownValue(record, key) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor &&
    !descriptor.get &&
    !descriptor.set &&
    descriptor.enumerable &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

export function isSceneExecutionLiveCanaryEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_EXECUTION_LIVE_CANARY_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_EXECUTION_LIVE_CANARY_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    flags,
    SCENE_EXECUTION_LIVE_CANARY_FEATURE.key
  );
  if (
    !descriptor ||
    descriptor.get ||
    descriptor.set ||
    !descriptor.enumerable
  ) {
    return SCENE_EXECUTION_LIVE_CANARY_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

function requireAllGates(flags) {
  inspectRecord(flags, 'sceneExecutionLiveCanary.integration.flags', FLAG_KEYS);
  if (!isSceneExecutionLiveCanaryEnabled(flags)) {
    fail(
      'Scene execution live canary is disabled',
      'SCENE_EXECUTION_LIVE_CANARY_DISABLED',
      `Set the own data flag "${SCENE_EXECUTION_LIVE_CANARY_FEATURE.key}" to true for one explicit local test`
    );
  }
  const priorKeys = [
    SCENE_CONTEXT_COMPOSER_FEATURE.key,
    SCENE_EXECUTION_SHADOW_FEATURE.key,
    SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key,
    SCENE_EXECUTION_CANARY_TRIAL_FEATURE.key,
    SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.key,
  ];
  if (priorKeys.some((key) => ownValue(flags, key) !== true)) {
    fail(
      'Scene execution live canary requires all five prior gates',
      'SCENE_EXECUTION_LIVE_CANARY_PRIOR_GATE_DISABLED',
      'The composer, shadow, prompt-canary, trial, comparison, and live-canary flags must all be own enumerable data properties set to true'
    );
  }
}

function requireOpaqueId(value, path) {
  if (
    typeof value !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{5,95}$/i.test(value)
  ) {
    fail(
      `Invalid Stage 8 identifier at ${path}`,
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_ID',
      `${path} must be an opaque 6-96 character identifier without prose or whitespace`
    );
  }
  return value;
}

function normalizeEndpoint(value) {
  const raw = value === undefined ? DEFAULT_ENDPOINT : value;
  if (typeof raw !== 'string' || raw.trim() === '') {
    fail(
      'Invalid Stage 8 llama.cpp endpoint',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_ENDPOINT',
      'endpoint must be a loopback http(s) URL'
    );
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(
      'Invalid Stage 8 llama.cpp endpoint',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_ENDPOINT',
      'endpoint must be a valid loopback URL such as http://127.0.0.1:8080/v1'
    );
  }
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    fail(
      'Stage 8 refuses a non-loopback model endpoint',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_ENDPOINT',
      'The live canary may contact only localhost, 127.0.0.1, or ::1 and may not embed credentials'
    );
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/v1') {
    fail(
      'Invalid Stage 8 llama.cpp API path',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_ENDPOINT',
      'The endpoint path must be empty or /v1'
    );
  }
  url.pathname = '/v1';
  return url.toString().replace(/\/$/, '');
}

function requireFiniteNumber(value, fallback, options) {
  const resolved = value === undefined ? fallback : value;
  if (
    typeof resolved !== 'number' ||
    !Number.isFinite(resolved) ||
    resolved < options.min ||
    resolved > options.max ||
    (options.integer && !Number.isInteger(resolved))
  ) {
    fail(
      `Invalid Stage 8 ${options.label}`,
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_SETTINGS',
      `${options.label} must be ${options.integer ? 'an integer' : 'a number'} from ${options.min} through ${options.max}`
    );
  }
  return resolved;
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

function hashText(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function countWords(value) {
  return String(value || '').trim().match(/\b[\p{L}\p{N}'’-]+\b/gu)?.length || 0;
}

function countMarker(value, marker) {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = value.indexOf(marker, offset);
    if (found === -1) return count;
    count += 1;
    offset = found + marker.length;
  }
}

function hasRequiredRoomOpening(normalized) {
  if (
    /\b(?:open(?:ed|s|ing)?|unlock(?:ed|s|ing)?|unseal(?:ed|s|ing)?)\b.{0,100}\b(?:room|door)\b/i.test(
      normalized
    ) ||
    /\b(?:room|door)\b.{0,100}\b(?:open(?:ed|s|ing)?|unlock(?:ed|s|ing)?|unseal(?:ed|s|ing)?)\b/i.test(
      normalized
    )
  ) {
    return true;
  }
  return (
    /\b(?:door|portal)\b.{0,80}\b(?:sw(?:ing|ang|ung)|move(?:d|s|ing)?|yield(?:ed|s|ing)?|gave way)\b.{0,40}\b(?:inward|open|aside)\b/i.test(
      normalized
    ) ||
    /\b(?:inward|open|aside)\b.{0,40}\b(?:sw(?:ing|ang|ung)|move(?:d|s|ing)?|yield(?:ed|s|ing)?|gave way)\b.{0,80}\b(?:door|portal)\b/i.test(
      normalized
    )
  );
}

function findExitTransition(normalized) {
  const patterns = [
    /\b(?:cross(?:ed|es|ing)|pass(?:ed|es|ing))\s+(?:(?:over|across|through)\s+)?the threshold\b/i,
    /\bstep(?:ped|s|ping)\s+(?:across|over|through|into|inside|in)\b/i,
    /\benter(?:ed|s|ing)\s+(?:the\s+)?(?:room|space)\b/i,
    /\b(?:stood|stopped|paused|was|is)\s+inside\b/i,
  ];
  let earliest = null;
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (
      match &&
      (!earliest || match.index < earliest.index)
    ) {
      earliest = {
        index: match.index,
        end: match.index + match[0].length,
      };
    }
  }
  return earliest;
}

const POST_EXIT_WORD_ALLOWANCE = 18;

function assessExitBoundary(normalized, transition) {
  if (!transition) {
    return {
      post_exit_word_count: 0,
      exit_boundary_overrun_words: 0,
      exit_boundary_overrun_severity: 'not-reached',
      post_exit_action_detected: false,
      overrun: false,
    };
  }
  const postExit = normalized.slice(transition.end).trim();
  const postExitWordCount = countWords(postExit);
  const postExitActionDetected =
    /\b(?:advance(?:d|s|ing)?|breathe(?:d|s|ing)?|close(?:d|s|ing)?|decid(?:e|ed|es|ing)|examin(?:e|ed|es|ing)|explor(?:e|ed|es|ing)|hear(?:d|s|ing)?|listen(?:ed|s|ing)?|look(?:ed|s|ing)?|mov(?:e|ed|es|ing)|notic(?:e|ed|es|ing)|open(?:ed|s|ing)?|plan(?:ned|s|ning)?|pull(?:ed|s|ing)?|push(?:ed|s|ing)?|reach(?:ed|es|ing)?|read(?:s|ing)?|search(?:ed|es|ing)?|see(?:s|ing)?|saw|shut(?:s|ting)?|step(?:ped|s|ping)?|survey(?:ed|s|ing)?|think(?:s|ing)?|thought|turn(?:ed|s|ing)?|wait(?:ed|s|ing)?|walk(?:ed|s|ing)?|wonder(?:ed|s|ing)?)\b/i.test(
      postExit
    );
  const overrun =
    postExitWordCount > POST_EXIT_WORD_ALLOWANCE ||
    postExitActionDetected;
  const overrunWords = overrun ? postExitWordCount : 0;
  let severity = 'none';
  if (overrunWords > 60) severity = 'severe';
  else if (overrunWords > 20) severity = 'material';
  else if (overrunWords > 0) severity = 'minor';
  return {
    post_exit_word_count: postExitWordCount,
    exit_boundary_overrun_words: overrunWords,
    exit_boundary_overrun_severity: severity,
    post_exit_action_detected: postExitActionDetected,
    overrun,
  };
}

function actionIsNegated(clause, actionIndex, actionEnd) {
  const prefix = clause.slice(Math.max(0, actionIndex - 55), actionIndex);
  const suffix = clause.slice(actionEnd, Math.min(clause.length, actionEnd + 45));
  return (
    /(?:\b(?:not|never|without)\b|\b(?:didn't|doesn't|don't|hadn't|hasn't|haven't|wouldn't|won't|couldn't|can't|shouldn't|mustn't)\b)(?:\s+[\p{L}\p{N}'’-]+){0,3}\s*$/iu.test(
      prefix
    ) ||
    /^\s+(?:no|neither)\b/i.test(suffix)
  );
}

function clauseHasAffirmedActionNearObject(clause, actions, objects) {
  const actionPattern = new RegExp(actions.source, 'gi');
  let match;
  while ((match = actionPattern.exec(clause)) !== null) {
    const windowStart = Math.max(0, match.index - 65);
    const windowEnd = Math.min(
      clause.length,
      match.index + match[0].length + 65
    );
    const window = clause.slice(windowStart, windowEnd);
    if (
      objects.test(window) &&
      !actionIsNegated(
        clause,
        match.index,
        match.index + match[0].length
      )
    ) {
      return true;
    }
  }
  return false;
}

function hasFutureBoundaryViolation(normalized) {
  const clauses = normalized.split(/(?<=[.!?;])\s+|\n+/u);
  const chestActions =
    /\b(?:open(?:ed|s|ing)?|unlock(?:ed|s|ing)?|unseal(?:ed|s|ing)?|lift(?:ed|s|ing)?|raise(?:d|s|ing)?|pr(?:y|ied|ies|ying)|forc(?:e|ed|es|ing)|remov(?:e|ed|es|ing))\b/i;
  const letterActions =
    /\b(?:discover(?:ed|s|ing)?|find(?:s|ing)?|found|locat(?:e|ed|es|ing)|read(?:s|ing)?|open(?:ed|s|ing)?|unseal(?:ed|s|ing)?|remov(?:e|ed|es|ing)|retriev(?:e|ed|es|ing)|reveal(?:ed|s|ing)?|expos(?:e|ed|es|ing))\b/i;
  const contentsActions =
    /\b(?:discover(?:ed|s|ing)?|examin(?:e|ed|es|ing)|inspect(?:ed|s|ing)?|read(?:s|ing)?|reveal(?:ed|s|ing)?|expos(?:e|ed|es|ing)|see(?:s|ing)?|saw)\b/i;
  for (const clause of clauses) {
    if (
      clauseHasAffirmedActionNearObject(
        clause,
        chestActions,
        /\b(?:chest|chest's|lid)\b/i
      ) ||
      clauseHasAffirmedActionNearObject(
        clause,
        letterActions,
        /\b(?:sealed\s+)?letter\b/i
      ) ||
      clauseHasAffirmedActionNearObject(
        clause,
        contentsActions,
        /\bcontents?\b/i
      )
    ) {
      return true;
    }
  }
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assessAuthorityAdherence(source, normalized) {
  const povIdentityPresent = new RegExp(
    `\\b${escapeRegExp(STAGE8_POV_IDENTITY)}\\b`
  ).test(source);
  const inventedEventMechanismDetected =
    /\b(?:key|keycard|keyhole|tumblers?|crowbar|lockpick|lock-pick|skeleton key|mechanisms?)\b/i.test(
      normalized
    ) ||
    /\bpick(?:ed|s|ing)?\s+(?:at\s+)?the lock\b/i.test(normalized);
  const unsupportedEventOperationDetected =
    /\b(?:brass\s+)?latch\b[^.!?;\n]{0,48}\b(?:against|at|in|into|on|onto|through|to|within)\s+(?:the\s+)?lock\b/i.test(
      normalized
    );
  const unauthorizedEventInstrumentDetected =
    inventedEventMechanismDetected || unsupportedEventOperationDetected;
  const unsupportedHistoryOrKnowledgeDetected =
    /\b(?:again|familiar|previously|practiced|recalled|recognized|remembered|retrieved|returned|expected|knew|known)\b/i.test(
      normalized
    ) ||
    /\bhad(?:n't| not)?\s+(?:[\p{L}'’-]+\s+){0,2}(?:been|brought|come|done|expected|felt|found|gone|heard|known|left|made|met|moved|opened|read|retrieved|seen|taken|tried|visited|written)\b/iu.test(
      normalized
    ) ||
    /\b(?:for|over|within|after|in)\s+(?:[\p{L}\p{N}'’-]+\s+){0,2}(?:days?|weeks?|months?|years?|decades?)\b/iu.test(
      normalized
    ) ||
    /\bdecades?\s+of\b/i.test(normalized);
  const unsupportedSettingDetailDetected =
    /\b(?:brick|marble|oak|stone)\s+(?:door|floor|floorboards|wall|walls)\b/i.test(
      normalized
    ) ||
    /\b(?:furniture|shelves|shelving|tapestries|window|windows)\b/i.test(
      normalized
    ) ||
    /\broom\s+(?:was|felt|seemed)\s+(?:bare|cavernous|large|narrow|small|vast)\b/i.test(
      normalized
    );
  return {
    pov_identity_present: povIdentityPresent,
    unauthorized_event_instrument_detected:
      unauthorizedEventInstrumentDetected,
    invented_event_mechanism_detected:
      inventedEventMechanismDetected,
    unsupported_event_operation_detected:
      unsupportedEventOperationDetected,
    unsupported_history_or_knowledge_detected:
      unsupportedHistoryOrKnowledgeDetected,
    unsupported_setting_detail_detected:
      unsupportedSettingDetailDetected,
  };
}

function assessOutput(prose) {
  const source = String(prose || '').trim();
  const normalized = source
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
  const issues = [];
  const wordCount = countWords(source);
  if (wordCount > 500) issues.push('OUTPUT_OVERSIZED');
  if (
    countMarker(source, AUTHORITY_BEGIN) !== 0 ||
    countMarker(source, AUTHORITY_END) !== 0
  ) {
    issues.push('AUTHORITY_MARKER_LEAK');
  }
  if (findNarrativeMetaLeaks(source).length > 0) {
    issues.push('NARRATIVE_META_LEAK');
  }
  if (/^\s*(?:scene|chapter)\s+(?:\d+|[ivxlcdm]+)\b/im.test(source)) {
    issues.push('MANUSCRIPT_HEADING_LEAK');
  }
  const opensRoom = hasRequiredRoomOpening(normalized);
  if (!opensRoom) issues.push('REQUIRED_ROOM_OPENING_MISSING');
  const exitTransition = findExitTransition(normalized);
  const reachesExit = exitTransition !== null;
  if (!reachesExit) issues.push('EXIT_STATE_MISSING');
  const exitBoundary = assessExitBoundary(normalized, exitTransition);
  if (exitBoundary.overrun) {
    issues.push('EXIT_BOUNDARY_OVERRUN');
  }
  if (hasFutureBoundaryViolation(normalized)) {
    issues.push('FUTURE_BOUNDARY_VIOLATION');
  }
  const authorityAdherence = assessAuthorityAdherence(source, normalized);
  if (!authorityAdherence.pov_identity_present) {
    issues.push('POV_IDENTITY_DRIFT');
  }
  if (authorityAdherence.unauthorized_event_instrument_detected) {
    issues.push('UNAUTHORIZED_EVENT_INSTRUMENT');
  }
  if (authorityAdherence.unsupported_history_or_knowledge_detected) {
    issues.push('UNSUPPORTED_HISTORY_OR_KNOWLEDGE');
  }
  if (authorityAdherence.unsupported_setting_detail_detected) {
    issues.push('UNSUPPORTED_SETTING_DETAIL');
  }
  return deepFreeze({
    word_count: wordCount,
    issue_codes: issues,
    issue_count: issues.length,
    post_exit_word_count: exitBoundary.post_exit_word_count,
    exit_boundary_overrun_words:
      exitBoundary.exit_boundary_overrun_words,
    exit_boundary_overrun_severity:
      exitBoundary.exit_boundary_overrun_severity,
    post_exit_action_detected:
      exitBoundary.post_exit_action_detected,
    pov_identity_present: authorityAdherence.pov_identity_present,
    unauthorized_event_instrument_detected:
      authorityAdherence.unauthorized_event_instrument_detected,
    invented_event_mechanism_detected:
      authorityAdherence.invented_event_mechanism_detected,
    unsupported_event_operation_detected:
      authorityAdherence.unsupported_event_operation_detected,
    unsupported_history_or_knowledge_detected:
      authorityAdherence.unsupported_history_or_knowledge_detected,
    unsupported_setting_detail_detected:
      authorityAdherence.unsupported_setting_detail_detected,
    passed: issues.length === 0,
  });
}

function compareExitBoundaryAudits(legacyAudit, canaryAudit) {
  const legacyMissing = legacyAudit.issue_codes.includes(
    'EXIT_STATE_MISSING'
  );
  const canaryMissing = canaryAudit.issue_codes.includes(
    'EXIT_STATE_MISSING'
  );
  if (legacyMissing !== canaryMissing) {
    return canaryMissing
      ? 'canary-regression-signal'
      : 'canary-improvement-signal';
  }
  const delta =
    canaryAudit.exit_boundary_overrun_words -
    legacyAudit.exit_boundary_overrun_words;
  if (delta > 0) return 'canary-regression-signal';
  if (delta < 0) return 'canary-improvement-signal';
  return 'neutral-signal';
}

function authorityIssueCodes(audit) {
  return audit.issue_codes.filter((code) =>
    AUTHORITY_ADHERENCE_ISSUE_CODES.has(code)
  );
}

function compareAuthorityAudits(legacyAudit, canaryAudit) {
  const legacyIssues = authorityIssueCodes(legacyAudit);
  const canaryIssues = authorityIssueCodes(canaryAudit);
  const legacySet = new Set(legacyIssues);
  if (canaryIssues.some((code) => !legacySet.has(code))) {
    return 'canary-regression-signal';
  }
  if (canaryIssues.length < legacyIssues.length) {
    return 'canary-improvement-signal';
  }
  return 'neutral-signal';
}

function buildFixture(flags) {
  const immutableSceneContract = createImmutableSceneContract(
    [
      {
        scene_number: 1,
        scene_id: 'ch01-s01',
        scene_goal: 'Establish the locked room.',
        entry_state: 'Hero stands outside the room.',
        required_events: ['Hero finds the brass latch.'],
        forbidden_events: ['Do not open the room yet.'],
        exit_state: 'Hero holds the brass latch.',
        continuity_dependencies: [],
      },
      {
        scene_number: 2,
        scene_id: 'ch01-s02',
        scene_goal: 'Open the locked room.',
        entry_state: 'Hero holds the brass latch.',
        required_events: ['Hero opens the locked room.'],
        forbidden_events: [
          'Do not open the chest or discover the sealed letter.',
        ],
        exit_state: 'Hero stands inside the room.',
        continuity_dependencies: ['Hero holds the brass latch.'],
      },
      {
        scene_number: 3,
        scene_id: 'ch01-s03',
        scene_goal: 'Reveal the chest contents.',
        entry_state: 'Hero stands inside the room.',
        required_events: [
          'Hero opens the chest.',
          'Hero discovers the sealed letter.',
        ],
        forbidden_events: [],
        exit_state: 'Hero holds the sealed letter.',
        continuity_dependencies: ['Hero stands inside the room.'],
      },
    ],
    { chapterNumber: 1 }
  );
  const chapter = {
    id: 'ch-001',
    chapter_number: 1,
    updated_date: '2026-07-26',
  };
  const snapshot = buildGenerationSnapshot({
    project: { id: 'proj-001', updated_date: '2026-07-26' },
    chapters: [chapter],
    chapter,
  });
  const contextBySceneId = Object.fromEntries(
    immutableSceneContract.beats.map((beat) => [
      beat.scene_id,
      {
        pov_identity: 'Hero',
        immediate_continuity:
          beat.scene_id === 'ch01-s02'
            ? 'The brass latch is already in Hero’s hand.'
            : '',
        voice_rules: ['Close third-person past tense', 'Manuscript prose only'],
        current_locations: [
          beat.scene_id === 'ch01-s02'
            ? 'Outside the locked room'
            : 'The old house',
        ],
        current_possessions:
          beat.scene_id === 'ch01-s01' ? [] : ['Brass latch'],
        current_injuries: [],
        confirmed_deaths: [],
        current_separations: [],
        unavailable_objects: [],
        canonically_unique_objects: ['Brass latch', 'Sealed letter'],
      },
    ])
  );
  const shadowState = prepareSceneExecutionShadowIntegration({
    integration: {
      flags,
      snapshot,
      contextBySceneId,
    },
    immutableSceneContract,
  });
  const promptCanaryState = prepareSceneExecutionPromptCanary({
    integration: {
      flags,
      targetSceneId: 'ch01-s02',
    },
    shadowState,
    immutableSceneContract,
  });
  const trialState = prepareSceneExecutionCanaryTrial({
    integration: {
      flags,
      mode: 'test-only-single-scene',
      trialId: 'trial-ch01-s02-live-001',
      projectId: 'proj-001',
      chapterId: 'ch-001',
      targetSceneId: 'ch01-s02',
    },
    promptCanaryState,
    immutableSceneContract,
    projectId: 'proj-001',
    chapterId: 'ch-001',
  });
  const promptCanaryResult = applySceneExecutionPromptCanary({
    state: promptCanaryState,
    prompt: STAGE8_BASE_PROMPT,
    sceneId: trialState.target_scene_id,
  });
  return deepFreeze({
    immutableSceneContract,
    snapshot,
    shadowState,
    promptCanaryState,
    trialState,
    promptCanaryResult,
    basePrompt: STAGE8_BASE_PROMPT,
    canaryPrompt: promptCanaryResult.prompt,
  });
}

async function readJsonResponse(response, code, context) {
  if (!response || typeof response !== 'object') {
    fail(
      `Stage 8 ${context} returned no response`,
      code,
      `${context} must return an HTTP response`
    );
  }
  if (!response.ok) {
    fail(
      `Stage 8 ${context} returned HTTP ${response.status || 'error'}`,
      code,
      `${context} must return a successful OpenAI-compatible JSON response`
    );
  }
  try {
    return await response.json();
  } catch {
    fail(
      `Stage 8 ${context} returned malformed JSON`,
      code,
      `${context} response must be valid JSON`
    );
  }
}

async function fetchJson(fetchImpl, url, options, timeoutMs, code, context) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    fail(
      `Stage 8 could not reach ${context}`,
      code,
      `${context} failed: ${error?.message || String(error)}`
    );
  }
  return readJsonResponse(response, code, context);
}

function extractModelIds(payload) {
  const records = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  return records
    .map((record) =>
      typeof record === 'string' ? record : record?.id || record?.name
    )
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());
}

function selectModel(availableModels, requestedModel) {
  if (requestedModel !== undefined) {
    if (
      typeof requestedModel !== 'string' ||
      requestedModel.trim() === '' ||
      !availableModels.includes(requestedModel.trim())
    ) {
      fail(
        'Requested Stage 8 model is not loaded in llama.cpp',
        'SCENE_EXECUTION_LIVE_CANARY_MODEL_UNAVAILABLE',
        `Requested model must exactly match one of: ${availableModels.join(', ') || '(none)'}`
      );
    }
    return requestedModel.trim();
  }
  if (availableModels.includes(PREFERRED_MODEL)) return PREFERRED_MODEL;
  if (availableModels.length === 1) return availableModels[0];
  fail(
    'Stage 8 could not safely choose one loaded model',
    'SCENE_EXECUTION_LIVE_CANARY_MODEL_AMBIGUOUS',
    `Pass an exact model ID; llama.cpp reported: ${availableModels.join(', ') || '(none)'}`
  );
}

function cleanModelText(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/think>/gi, '')
    .trim();
}

async function invokePairedModel({
  fetchImpl,
  endpoint,
  model,
  prompt,
  seed,
  temperature,
  maxTokens,
  timeoutMs,
  pathLabel,
}) {
  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: `${prompt} /no_think`,
      },
    ],
    stream: false,
    temperature,
    max_tokens: maxTokens,
    seed,
    chat_template_kwargs: { enable_thinking: false },
  };
  const payload = await fetchJson(
    fetchImpl,
    `${endpoint}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
    timeoutMs,
    'SCENE_EXECUTION_LIVE_CANARY_MODEL_CALL_FAILED',
    `${pathLabel} model call`
  );
  const prose = cleanModelText(payload?.choices?.[0]?.message?.content);
  if (!prose) {
    fail(
      `Stage 8 ${pathLabel} model call returned empty prose`,
      'SCENE_EXECUTION_LIVE_CANARY_EMPTY_OUTPUT',
      `${pathLabel} must return nonempty assistant content`
    );
  }
  const responseModel =
    typeof payload?.model === 'string' && payload.model.trim()
      ? payload.model.trim()
      : model;
  return deepFreeze({
    prose,
    response_model: responseModel,
    request_fingerprint: hashText(JSON.stringify(requestBody)),
  });
}

export async function runSceneExecutionLiveCanary(input) {
  inspectRecord(input, 'sceneExecutionLiveCanary', RUN_INPUT_KEYS);
  const integration = ownValue(input, 'integration');
  inspectRecord(
    integration,
    'sceneExecutionLiveCanary.integration',
    INTEGRATION_KEYS
  );
  const flags = ownValue(integration, 'flags');
  requireAllGates(flags);
  if (ownValue(integration, 'mode') !== LIVE_CANARY_MODE) {
    fail(
      'Scene execution live canary mode is not test-only',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_MODE',
      `mode must equal "${LIVE_CANARY_MODE}"`
    );
  }
  const runId = requireOpaqueId(
    ownValue(integration, 'runId'),
    'sceneExecutionLiveCanary.integration.runId'
  );
  const endpoint = normalizeEndpoint(ownValue(integration, 'endpoint'));
  const seed = requireFiniteNumber(ownValue(integration, 'seed'), 8082026, {
    min: 0,
    max: 2147483647,
    integer: true,
    label: 'seed',
  });
  const temperature = requireFiniteNumber(
    ownValue(integration, 'temperature'),
    0.2,
    {
      min: 0,
      max: 1,
      integer: false,
      label: 'temperature',
    }
  );
  const maxTokens = requireFiniteNumber(
    ownValue(integration, 'maxTokens'),
    900,
    {
      min: 128,
      max: 4096,
      integer: true,
      label: 'maxTokens',
    }
  );
  const timeoutMs = requireFiniteNumber(
    ownValue(integration, 'timeoutMs'),
    1200000,
    {
      min: 1000,
      max: 1200000,
      integer: true,
      label: 'timeoutMs',
    }
  );
  const fetchImpl = ownValue(input, 'fetchImpl') || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    fail(
      'Stage 8 requires a fetch implementation',
      'INVALID_SCENE_EXECUTION_LIVE_CANARY_INPUT',
      'fetchImpl must be a function when global fetch is unavailable'
    );
  }

  const modelsPayload = await fetchJson(
    fetchImpl,
    `${endpoint}/models`,
    { method: 'GET' },
    Math.min(timeoutMs, 10000),
    'SCENE_EXECUTION_LIVE_CANARY_MODEL_DISCOVERY_FAILED',
    'llama.cpp model discovery'
  );
  const availableModels = extractModelIds(modelsPayload);
  const selectedModel = selectModel(
    availableModels,
    ownValue(integration, 'model')
  );
  const fixture = buildFixture(flags);

  const legacyRun = await invokePairedModel({
    fetchImpl,
    endpoint,
    model: selectedModel,
    prompt: fixture.basePrompt,
    seed,
    temperature,
    maxTokens,
    timeoutMs,
    pathLabel: 'legacy',
  });
  const canaryRun = await invokePairedModel({
    fetchImpl,
    endpoint,
    model: selectedModel,
    prompt: fixture.canaryPrompt,
    seed,
    temperature,
    maxTokens,
    timeoutMs,
    pathLabel: 'canary',
  });
  if (legacyRun.response_model !== canaryRun.response_model) {
    fail(
      'Stage 8 paired calls did not use the same response model',
      'SCENE_EXECUTION_LIVE_CANARY_MODEL_MISMATCH',
      'The legacy and canary response model identifiers must match exactly'
    );
  }

  const legacyAudit = assessOutput(legacyRun.prose);
  const canaryAudit = assessOutput(canaryRun.prose);
  const legacyEvidence = collectSceneExecutionLegacyEvidence({
    trialState: fixture.trialState,
    basePrompt: fixture.basePrompt,
    modelPrompt: fixture.basePrompt,
    acceptedProse: legacyRun.prose,
    repaired: false,
    issues: legacyAudit.issue_codes,
  });
  const canaryEvidence = collectSceneExecutionCanaryEvidence({
    trialState: fixture.trialState,
    promptCanaryResult: fixture.promptCanaryResult,
    basePrompt: fixture.basePrompt,
    modelPrompt: fixture.canaryPrompt,
    acceptedProse: canaryRun.prose,
    repaired: false,
    issues: canaryAudit.issue_codes,
  });
  const comparison = evaluateSceneExecutionCanaryComparison({
    integration: {
      flags,
      mode: 'test-only-paired-evaluation',
      comparisonId: `compare-${runId}`,
      trialId: fixture.trialState.trial_id,
      projectId: fixture.trialState.project_id,
      chapterId: fixture.trialState.chapter_id,
      targetSceneId: fixture.trialState.target_scene_id,
    },
    trialState: fixture.trialState,
    legacyEvidence,
    canaryEvidence,
  });

  const exitBoundaryOutcome = compareExitBoundaryAudits(
    legacyAudit,
    canaryAudit
  );
  const authorityAdherenceOutcome = compareAuthorityAudits(
    legacyAudit,
    canaryAudit
  );
  const regression =
    comparison.mechanical_outcome === 'canary-regression-signal' ||
    exitBoundaryOutcome === 'canary-regression-signal' ||
    authorityAdherenceOutcome === 'canary-regression-signal';
  const liveMechanicalOutcome = regression
    ? 'canary-regression-signal'
    : comparison.mechanical_outcome === 'canary-improvement-signal' ||
        exitBoundaryOutcome === 'canary-improvement-signal' ||
        authorityAdherenceOutcome === 'canary-improvement-signal'
      ? 'canary-improvement-signal'
      : 'neutral-signal';
  const attestation = deepFreeze({
    live_canary_version: SCENE_EXECUTION_LIVE_CANARY_VERSION,
    status: 'live-model-paired-evidence-collected',
    mode: LIVE_CANARY_MODE,
    run_id: runId,
    trial_id: fixture.trialState.trial_id,
    comparison_id: comparison.comparison_id,
    project_id: fixture.trialState.project_id,
    chapter_id: fixture.trialState.chapter_id,
    scene_id: fixture.trialState.target_scene_id,
    packet_id: fixture.trialState.packet_id,
    source_contract_fingerprint:
      fixture.trialState.source_contract_fingerprint,
    transport: 'direct-loopback-openai-compatible-http',
    endpoint_origin: new URL(endpoint).origin,
    model_discovery_verified: true,
    selected_model: selectedModel,
    response_model: legacyRun.response_model,
    request_count: 2,
    matched_seed: seed,
    matched_temperature: temperature,
    matched_max_tokens: maxTokens,
    legacy_request_fingerprint: legacyRun.request_fingerprint,
    canary_request_fingerprint: canaryRun.request_fingerprint,
    base_prompt_fingerprint: comparison.base_prompt_fingerprint,
    canary_base_prompt_fingerprint:
      comparison.canary_base_prompt_fingerprint,
    removed_word_target_directive_count:
      comparison.removed_word_target_directive_count,
    legacy_accepted_prose_fingerprint:
      comparison.legacy_accepted_prose_fingerprint,
    canary_accepted_prose_fingerprint:
      comparison.canary_accepted_prose_fingerprint,
    accepted_outputs_identical: comparison.accepted_outputs_identical,
    legacy_word_count: comparison.legacy_word_count,
    canary_word_count: comparison.canary_word_count,
    word_count_delta: comparison.word_count_delta,
    legacy_issue_codes: legacyAudit.issue_codes,
    canary_issue_codes: canaryAudit.issue_codes,
    issue_count_delta: comparison.issue_count_delta,
    legacy_exit_boundary_overrun_words:
      legacyAudit.exit_boundary_overrun_words,
    canary_exit_boundary_overrun_words:
      canaryAudit.exit_boundary_overrun_words,
    exit_boundary_overrun_word_delta:
      canaryAudit.exit_boundary_overrun_words -
      legacyAudit.exit_boundary_overrun_words,
    legacy_exit_boundary_overrun_severity:
      legacyAudit.exit_boundary_overrun_severity,
    canary_exit_boundary_overrun_severity:
      canaryAudit.exit_boundary_overrun_severity,
    exit_boundary_mechanical_outcome: exitBoundaryOutcome,
    legacy_authority_issue_codes: authorityIssueCodes(legacyAudit),
    canary_authority_issue_codes: authorityIssueCodes(canaryAudit),
    authority_adherence_mechanical_outcome: authorityAdherenceOutcome,
    mechanical_outcome: liveMechanicalOutcome,
    live_model_evidence_satisfied: true,
    broader_rollout_supported: false,
    additional_test_only_trials_supported:
      !regression && comparison.additional_test_only_trials_supported,
    manual_quality_review_required: true,
    rollout_decision: 'hold',
    recommendation: regression
      ? 'stop-live-model-canary'
      : 'review-live-pair-before-any-test-only-expansion',
    raw_content_included: false,
  });

  return deepFreeze({
    attestation,
    comparison,
    localReview: {
      scope: {
        project_id: fixture.trialState.project_id,
        chapter_id: fixture.trialState.chapter_id,
        scene_id: fixture.trialState.target_scene_id,
        model: selectedModel,
        seed,
        temperature,
        max_tokens: maxTokens,
      },
      legacy: {
        prompt: fixture.basePrompt,
        accepted_prose: legacyRun.prose,
        audit: legacyAudit,
      },
      canary: {
        prompt: fixture.canaryPrompt,
        accepted_prose: canaryRun.prose,
        audit: canaryAudit,
      },
    },
  });
}
