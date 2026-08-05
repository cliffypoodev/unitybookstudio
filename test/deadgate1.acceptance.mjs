// DEADGATE-1 + CONTRACTVER-1 acceptance — a validator that never runs may not read as
// coverage, and a version constant that exists to be the authority must be used.
//
// generationContext.js declares six scene-execution feature flags. A grep across src/
// and test/ found nothing but their declarations, and executing the shipped functions
// against the flags object production actually passes (sceneWriter's `let flags = {}`)
// returned false for all six, with the acceptance-gate decision "disabled".
//
// That is not a dormant feature. ProjectStudio.jsx builds a real LLM audit+repair runner
// pair on EVERY draft and hands it to the writer; evaluateSceneExecutionAcceptance
// returned { status: 'bypassed' } before it was ever touched, silently. Roughly 2,000
// lines of required-event / exit-state / POV / forbidden-event checking that reads as
// coverage in review and executes nothing at runtime — which is worse than having none,
// because it is why the gaps elsewhere went unnoticed.
//
// Two things had to be true, and neither was:
//   1. The gates must be REACHABLE. flags came only from sceneExecutionShadow.flags and
//      ProjectStudio never passes sceneExecutionShadow, so nobody could turn them on.
//   2. Being off must be LOUD. Silence is what made this survive.
//
// Nothing is switched on here. Turning untested validators on mid-book is its own
// hazard; the point is that the state is now declarable and audible.
import fs from 'fs';
import vm from 'node:vm';
import { isNonfictionProject } from '../src/lib/projectType.js';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url).pathname, 'utf8');
const executable = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

const GC_SRC = read('src/lib/generationContext.js');
const warnings = [];
const gcCtx = {
  console: { log: (...a) => warnings.push(a.join(' ')), warn: (...a) => warnings.push(a.join(' ')), error() {} },
  isNonfictionProjectAuthority: isNonfictionProject,
  __e: {},
};
vm.createContext(gcCtx);
vm.runInContext(
  GC_SRC.replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export (const|class)/gm, '$1')
  + '\n__e = { SCENE_EXECUTION_FEATURE_KEYS, resolveSceneExecutionFlags, reportSceneExecutionGateStatus,'
  + ' getSceneExecutionAcceptanceGateDecision, isSceneContextComposerEnabled, isSceneExecutionShadowEnabled,'
  + ' isSceneExecutionPromptCanaryEnabled, isSceneExecutionCanaryTrialEnabled,'
  + ' isSceneExecutionCanaryComparisonEnabled, isSceneExecutionAcceptanceGateEnabled,'
  + ' EXPECTED_SCENE_CONTRACT_VERSION, EXPECTED_SNAPSHOT_VERSION, GENERATION_CONTEXT_VERSION };',
  gcCtx,
);
const E = gcCtx.__e;

// ── the key list is complete and frozen ──
{
  check('the six scene-execution feature keys are enumerated in one frozen list',
    Object.isFrozen(E.SCENE_EXECUTION_FEATURE_KEYS) && E.SCENE_EXECUTION_FEATURE_KEYS.length === 6,
    JSON.stringify(E.SCENE_EXECUTION_FEATURE_KEYS));

  // Every *_FEATURE declared in the file must be in that list, or a new gate can be
  // added and quietly never run — exactly the situation this fix exists for.
  const declared = [...GC_SRC.matchAll(/^export const (SCENE_[A-Z_]*FEATURE) = Object\.freeze\(\{\s*\n\s*key: '([a-z0-9_]+)'/gm)]
    .map((m) => m[2]);
  check('every declared *_FEATURE key is in the enumerated list',
    declared.length > 0 && declared.every((k) => E.SCENE_EXECUTION_FEATURE_KEYS.includes(k)),
    `declared=${JSON.stringify(declared)}`);
  check('…and the list contains nothing that is not declared',
    E.SCENE_EXECUTION_FEATURE_KEYS.every((k) => declared.includes(k)));
}

// ── the gates are still OFF by default ──
{
  const flags = E.resolveSceneExecutionFlags({ id: 'p1' }, null);
  check('a project that declares nothing gets no flags', Object.keys(flags).length === 0);
  const checks = [
    ['scene_context_composer', E.isSceneContextComposerEnabled],
    ['scene_execution_shadow', E.isSceneExecutionShadowEnabled],
    ['prompt_canary', E.isSceneExecutionPromptCanaryEnabled],
    ['canary_trial', E.isSceneExecutionCanaryTrialEnabled],
    ['canary_comparison', E.isSceneExecutionCanaryComparisonEnabled],
    ['acceptance_gate', E.isSceneExecutionAcceptanceGateEnabled],
  ];
  for (const [name, fn] of checks) {
    let v; try { v = fn(flags); } catch (err) { v = `threw ${err.message}`; }
    check(`${name} is off by default (unchanged behaviour)`, v === false, String(v));
  }
  check('the acceptance-gate decision is still "disabled" by default',
    E.getSceneExecutionAcceptanceGateDecision(flags) === 'disabled');
}

// ── but they are now REACHABLE ──
{
  const key = E.SCENE_EXECUTION_FEATURE_KEYS[E.SCENE_EXECUTION_FEATURE_KEYS.length - 1];
  const flags = E.resolveSceneExecutionFlags({ id: 'p2', scene_execution_flags: { [key]: true } }, null);
  check('a project can enable a gate on its own record', flags[key] === true, JSON.stringify(flags));

  const composerKey = E.SCENE_EXECUTION_FEATURE_KEYS[0];
  const on = E.resolveSceneExecutionFlags({ id: 'p3', scene_execution_flags: { [composerKey]: true } }, null);
  check('…and the corresponding predicate then returns true',
    E.isSceneContextComposerEnabled(on) === true);

  const typo = E.resolveSceneExecutionFlags({ id: 'p4', scene_execution_flags: { scene_contxt_composer_v1: true } }, null);
  check('a misspelled flag key is dropped, not silently honoured', Object.keys(typo).length === 0);
  check('…and the typo is named in a warning',
    warnings.some((w) => w.includes('unknown scene-execution flag') && w.includes('scene_contxt_composer_v1')));

  check('only literal true enables a gate (no truthy strings)',
    E.resolveSceneExecutionFlags({ scene_execution_flags: { [composerKey]: 'yes' } }, null)[composerKey] === false);
  check('null/undefined project does not throw',
    Object.keys(E.resolveSceneExecutionFlags(null, null)).length === 0
    && Object.keys(E.resolveSceneExecutionFlags(undefined, undefined)).length === 0);
}

// ── being off is audible ──
{
  warnings.length = 0;
  const status = E.reportSceneExecutionGateStatus({}, 'Ch.1');
  check('all-off reports all six as off', status.off.length === 6 && status.on.length === 0);
  check('…and says so out loud, naming what is not running',
    warnings.some((w) => w.includes('[DEADGATE-1]') && w.includes('ALL 6') && /required-event/.test(w)),
    JSON.stringify(warnings).slice(0, 220));

  warnings.length = 0;
  const partial = E.reportSceneExecutionGateStatus({ [E.SCENE_EXECUTION_FEATURE_KEYS[0]]: true });
  check('a partially-enabled set names the ones still off',
    partial.on.length === 1 && partial.off.length === 5
    && warnings.some((w) => w.includes('gates OFF:')));

  const raw = read('src/lib/generationContext.js');
  check('the acceptance-gate bypass is no longer silent',
    /\[DEADGATE-1\] acceptance gate BYPASSED for this scene/.test(raw));
}

// ── the writer actually uses the reachable path ──
{
  const SW = executable(read('src/lib/sceneWriter.js'));
  check('sceneWriter resolves flags from the project, not only from the integration',
    /let flags = resolveSceneExecutionFlags\(project, null\)/.test(SW));
  check('…and no longer assigns sceneExecutionShadow.flags straight through',
    !/flags = sceneExecutionShadow\.flags;/.test(SW));
  check('sceneWriter reports the gate status once per chapter',
    /reportSceneExecutionGateStatus\(flags, `Ch\.\$\{chapterNumber\}`\)/.test(SW));
  check('both helpers are imported', /resolveSceneExecutionFlags,/.test(SW) && /reportSceneExecutionGateStatus,/.test(SW));
}

// ── CONTRACTVER-1: one owner per version ──
{
  const XGC = executable(GC_SRC);
  const literalContract = (XGC.match(/'fiction-scene-contract-v2'/g) || []).length;
  check('the scene-contract version literal appears exactly once (its declaration)',
    literalContract === 1, `found ${literalContract}`);
  const literalSnapshot = (XGC.match(/'narrative-connect-v2'/g) || []).length;
  check('the snapshot version literal appears exactly once (its declaration)',
    literalSnapshot === 1, `found ${literalSnapshot}`);
  check('the producer stamps the constant',
    /version: EXPECTED_SCENE_CONTRACT_VERSION/.test(XGC));
  check('the validator compares against the constant',
    /versionDesc\.value !== EXPECTED_SCENE_CONTRACT_VERSION/.test(XGC));
  check('EXPECTED_SNAPSHOT_VERSION derives from GENERATION_CONTEXT_VERSION',
    /EXPECTED_SNAPSHOT_VERSION = GENERATION_CONTEXT_VERSION/.test(XGC));
  check('…and the two still hold the same value at runtime',
    E.EXPECTED_SNAPSHOT_VERSION === E.GENERATION_CONTEXT_VERSION);
}

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
