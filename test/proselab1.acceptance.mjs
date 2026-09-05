// PROSELAB-1 acceptance battery — Phase 0 "Prose Lab" capture (UBS_plan.md
// Phase 0). Capture module + flag (src/lib/proseLab.js), the two wrapped
// scene-generation call sites (sceneWriter.js), entity registration
// (localDB.js + vite-server-store-plugin.js), and the report script
// (scripts/proselab-summary.mjs).
import fs from 'node:fs';
import {
  PROSELAB_VERSION,
  PROSE_LAB_CAPTURE_FEATURE,
  isProseLabCaptureEnabled,
  captureGeneration,
} from '../src/lib/proseLab.js';
import {
  PROSELAB_SUMMARY_VERSION,
  parseArgs,
  summarizeCaptures,
  formatSummaryReport,
  fetchCaptures,
} from '../scripts/proselab-summary.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── version + flag shape ──
check('1. PROSELAB_VERSION', PROSELAB_VERSION === 'prose-lab-v1');
check('2. PROSE_LAB_CAPTURE_FEATURE shape', PROSE_LAB_CAPTURE_FEATURE.key === 'prose_lab_capture_v1' && PROSE_LAB_CAPTURE_FEATURE.defaultEnabled === false);
check('3. PROSE_LAB_CAPTURE_FEATURE is frozen', Object.isFrozen(PROSE_LAB_CAPTURE_FEATURE));

// ── isProseLabCaptureEnabled: default off, descriptor-safe ──
check('4. no project -> default (false)', isProseLabCaptureEnabled(undefined) === false);
check('5. empty project -> default (false)', isProseLabCaptureEnabled({}) === false);
check('6. project with no prose_lab_flags -> false', isProseLabCaptureEnabled({ id: 'p1' }) === false);
check('7. prose_lab_flags with the key false -> false', isProseLabCaptureEnabled({ prose_lab_flags: { prose_lab_capture_v1: false } }) === false);
check('8. prose_lab_flags with the key true -> true', isProseLabCaptureEnabled({ prose_lab_flags: { prose_lab_capture_v1: true } }) === true);
check('9. prose_lab_flags is an array -> false (not a plain object)', isProseLabCaptureEnabled({ prose_lab_flags: ['x'] }) === false);
check('10. prose_lab_flags with a getter for the key -> false (descriptor-safe)', (() => {
  const flags = {};
  Object.defineProperty(flags, PROSE_LAB_CAPTURE_FEATURE.key, { get: () => true, enumerable: true });
  return isProseLabCaptureEnabled({ prose_lab_flags: flags }) === false;
})());
check('11. prose_lab_flags with a non-enumerable true value -> false', (() => {
  const flags = {};
  Object.defineProperty(flags, PROSE_LAB_CAPTURE_FEATURE.key, { value: true, enumerable: false });
  return isProseLabCaptureEnabled({ prose_lab_flags: flags }) === false;
})());
check('12. an unrelated scene_execution_flags.prose_lab_capture_v1=true does NOT enable capture (separate field)', isProseLabCaptureEnabled({ scene_execution_flags: { prose_lab_capture_v1: true } }) === false);

// ── captureGeneration: field mapping ──
{
  let created = null;
  const record = await captureGeneration({
    projectId: 'proj-1',
    chapter: 4,
    sceneId: 'ch04-s02',
    attempt: 2,
    model: 'ghostwriter',
    temperature: 0.72,
    compiledPrompt: 'ABCDE',
    promptSections: { foundation: 3, rules: 2 },
    output: 'two words',
    accepted: true,
    repairReason: null,
  }, { create: async (doc) => { created = doc; } });

  check('13. captureGeneration maps projectId -> project_id', record.project_id === 'proj-1');
  check('14. bookId defaults to projectId when omitted', record.book_id === 'proj-1');
  check('15. chapter passed through', record.chapter === 4);
  check('16. sceneId -> scene_id', record.scene_id === 'ch04-s02');
  check('17. attempt passed through', record.attempt === 2);
  check('18. model passed through', record.model === 'ghostwriter');
  check('19. compiledPrompt -> compiled_prompt', record.compiled_prompt === 'ABCDE');
  check('20. prompt_char_count computed from compiledPrompt', record.prompt_char_count === 5);
  check('21. promptSections passed through verbatim when a plain object', record.prompt_sections.foundation === 3 && record.prompt_sections.rules === 2);
  check('22. output_word_count computed from output', record.output_word_count === 2);
  check('23. the injected create() received the built record', created && created.project_id === 'proj-1' && created.compiled_prompt === 'ABCDE');
  check('24. id and timestamp are auto-generated when omitted', typeof record.id === 'string' && record.id.length > 0 && typeof record.timestamp === 'string' && record.timestamp.length > 0);
}

// ── captureGeneration: defaults + edge cases ──
{
  const record = await captureGeneration({}, { create: async () => {} });
  check('25. missing fields default sanely: project_id null', record.project_id === null);
  check('26. missing fields default sanely: attempt defaults to 1', record.attempt === 1);
  check('27. missing compiledPrompt -> compiled_prompt "" and char count 0', record.compiled_prompt === '' && record.prompt_char_count === 0);
  check('28. missing output -> output "" and word count 0', record.output === '' && record.output_word_count === 0);
  check('29. accepted defaults to true unless explicitly false', record.accepted === true);
  const arrSectionsRecord = await captureGeneration({ promptSections: ['not', 'an', 'object'] }, { create: async () => {} });
  check('30. an array passed as promptSections is ignored (defaults to {})', Object.keys(arrSectionsRecord.prompt_sections).length === 0);
}
check('31. accepted:false is honored', (await captureGeneration({ accepted: false }, { create: async () => {} })).accepted === false);

// ── captureGeneration: fails open on a storage error ──
{
  let threw = false;
  let record = null;
  try {
    record = await captureGeneration({ projectId: 'p2' }, { create: async () => { throw new Error('store down'); } });
  } catch {
    threw = true;
  }
  check('32. a throwing create() never propagates (fail open)', threw === false);
  check('33. the record is still returned when storage fails', record && record.project_id === 'p2');
}

// ── captureGeneration: default create path uses the real entity store (source-shape) ──
const PROSELAB_SRC = fs.readFileSync(new URL('../src/lib/proseLab.js', import.meta.url), 'utf8');
check('34. default storage path goes through entities.ProseLabCapture.create (never hand-written JSON)', PROSELAB_SRC.includes("entities.ProseLabCapture.create"));
check('35. proseLab.js imports localDB.js with a relative import (bare-Node battery safe)', PROSELAB_SRC.includes("from './localDB.js'"));

// ── entity registration ──
const LOCALDB_SRC = fs.readFileSync(new URL('../src/lib/localDB.js', import.meta.url), 'utf8');
check('36. localDB.js ENTITY_STORES includes ProseLabCapture', /ENTITY_STORES = \[[\s\S]*?'ProseLabCapture'[\s\S]*?\]/.test(LOCALDB_SRC));
check('37. localDB.js entities proxy exposes ProseLabCapture', /ProseLabCapture:\s*createEntityProxy\('ProseLabCapture'\)/.test(LOCALDB_SRC));
const SERVER_STORE_SRC = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
check('38. vite-server-store-plugin.js ENTITY_STORES includes ProseLabCapture (server accepts the entity)', /ENTITY_STORES = \[[\s\S]*?'ProseLabCapture'[\s\S]*?\]/.test(SERVER_STORE_SRC));

// ── wiring into sceneWriter.js (source-shape; sceneWriter.js has @/ imports and
// cannot itself be imported under bare Node without the alias loader) ──
const SCENEWRITER_SRC = fs.readFileSync(new URL('../src/lib/sceneWriter.js', import.meta.url), 'utf8');
check('39. sceneWriter.js imports captureGeneration and isProseLabCaptureEnabled from proseLab', SCENEWRITER_SRC.includes("import { captureGeneration, isProseLabCaptureEnabled } from '@/lib/proseLab';"));
const captureCallCount = (SCENEWRITER_SRC.match(/if \(isProseLabCaptureEnabled\(project\)\)/g) || []).length;
check('40. exactly two wrapped call sites (generateChapterSceneByScene + generateSingleScene) — PROSELAB-1 scope, see docs/pipeline-map.md', captureCallCount === 2);
check('41. the wrap never runs unconditionally — every capture call site is behind the flag check', (SCENEWRITER_SRC.match(/await captureGeneration\(/g) || []).length === captureCallCount);

// ── report script ──
check('42. PROSELAB_SUMMARY_VERSION', PROSELAB_SUMMARY_VERSION === 'proselab-summary-v1');
check('43. parseArgs parses --project', parseArgs(['--project', 'abc']).project === 'abc');
check('44. parseArgs treats a trailing flag with no value as boolean true', parseArgs(['--project', 'abc', '--verbose']).verbose === true);

{
  const records = [
    { chapter: 2, scene_id: 's2', attempt: 1, model: 'm1', prompt_char_count: 2000, prompt_sections: { foundation: 800 }, output_word_count: 600, accepted: true },
    { chapter: 1, scene_id: 's1', attempt: 1, model: 'm1', prompt_char_count: 1000, prompt_sections: { foundation: 400 }, output_word_count: 0, accepted: false, repair_reason: 'empty-reroll' },
    { chapter: 1, scene_id: 's1', attempt: 2, model: 'm1', prompt_char_count: 1050, prompt_sections: { foundation: 420 }, output_word_count: 500, accepted: true },
  ];
  const summary = summarizeCaptures(records);
  check('45. summarizeCaptures totalRecords', summary.totalRecords === 3);
  check('46. summarizeCaptures attemptCounts', summary.attemptCounts[1] === 2 && summary.attemptCounts[2] === 1);
  check('47. summarizeCaptures avgPromptCharCount', summary.avgPromptCharCount === Math.round((2000 + 1000 + 1050) / 3));
  check('48. summarizeCaptures maxPromptCharCount', summary.maxPromptCharCount === 2000);
  check('49. summarizeCaptures sectionAverages averages numeric section values', summary.sectionAverages.foundation === Math.round((800 + 400 + 420) / 3));
  check('50. summarizeCaptures sorts scenes by chapter, then scene id, then attempt', summary.scenes.map((s) => `${s.chapter}/${s.sceneId}/${s.attempt}`).join(',') === '1/s1/1,1/s1/2,2/s2/1');
  const report = formatSummaryReport(summary, { projectId: 'proj-9' });
  check('51. formatSummaryReport names the project', report.includes('project proj-9'));
  check('52. formatSummaryReport reports the record count', report.includes('Records: 3'));
  check('53. formatSummaryReport lists every scene row', report.split('\n').filter((l) => l.trim().startsWith('Ch.')).length === 3);
}
{
  const empty = summarizeCaptures([]);
  check('54. summarizeCaptures on an empty set never divides by zero into NaN', empty.avgPromptCharCount === 0 && empty.maxPromptCharCount === 0);
  check('55. summarizeCaptures on an empty set has no section averages', Object.keys(empty.sectionAverages).length === 0);
  const report = formatSummaryReport(empty, {});
  check('56. formatSummaryReport on an empty set still names the section-breakdown fallback', report.includes('Section breakdown: none reported'));
}

// ── fetchCaptures: request shape + error handling (dependency-injected fetch) ──
{
  let requested = null;
  const fetchImpl = async (url, opts) => {
    requested = { url, opts };
    return { ok: true, json: async () => [{ id: 'r1' }] };
  };
  const records = await fetchCaptures({ baseUrl: 'http://x', token: 'tok', projectId: 'p1', fetchImpl });
  check('57. fetchCaptures hits the ProseLabCapture filter endpoint', requested.url === 'http://x/api/store/ProseLabCapture/filter');
  check('58. fetchCaptures sends the runner token header', requested.opts.headers['x-ubs-runner-token'] === 'tok');
  check('59. fetchCaptures filters by project_id', JSON.parse(requested.opts.body).query.project_id === 'p1');
  check('60. fetchCaptures returns the parsed records', Array.isArray(records) && records[0].id === 'r1');
}
{
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  let threw = false;
  try {
    await fetchCaptures({ baseUrl: 'http://x', token: 'tok', projectId: 'p1', fetchImpl });
  } catch (err) {
    threw = /500/.test(err.message);
  }
  check('61. fetchCaptures throws a loud error on a non-OK response (never a silent empty result)', threw);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
