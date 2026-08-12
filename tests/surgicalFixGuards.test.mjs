// FIXGUARD-1 + FIXGUARD-2 -- the whole-manuscript fixer had none of the protections
// the drafting path gained this week.
//
// Measured against the live code at bda02f9, using a real Chapter 4 paragraph from
// brassmeridiantest 8 and the REAL applySurgicalFixes path (via its _llmOverride and
// _saveOverride test seams):
//
//   revision drops ONE opening quote  -> status "applied", chapter imbalance 0 -> 1
//   revision drops a closing quote    -> status "applied", chapter imbalance 0 -> -1
//
// Both shipped. The export gate only hard-blocks above FIVE dialogue issues, and the
// surgical-fix save path runs no safety gate at all, so damage of that size reaches the
// manuscript silently. This matters because the polish model demonstrably drops opening
// quotes: on 2026-07-30 the draft path healed 27 missing openers and the polisher then
// produced 27 MORE in text that was already clean. The draft path survives it because
// PARABREAK and the orphan healer run afterwards. This path had neither.
//
// FIXGUARD-1 repairs first and rejects second. FIXGUARD-2 stops the fixer being blind to
// everything LEDGERSCOPE-1 / EXTRACTFIX-1 / STATEFIX-1 established -- it could previously
// put an amputated hand back on the page and pass every check.
import { applySurgicalFixes } from '@/lib/surgicalFix';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const OPEN = '\u201c';
const CLOSE = '\u201d';
const count = (t, ch) => (String(t).match(new RegExp(ch, 'g')) || []).length;
const imbalance = (t) => count(t, CLOSE) - count(t, OPEN);

// A real two-speaker exchange in the shape the manuscript actually produces.
const TARGET = '\u201cWe run,\u201d Vale agreed. \u201cBut not yet. The main elevator shaft is blocked by debris from the collapse in Sector 4.\u201d';
const CHAPTER = [
  'Lena pressed her palm flat against the bulkhead. The metal was cold enough to sting.',
  TARGET,
  'Marcus said nothing. He was watching the water climb the far wall.',
].join('\n\n');

async function runFix(revision, chapterRecordExtra = {}) {
  let saved = null;
  const res = await applySurgicalFixes({
    loaded: [{ chapter: { chapter_number: 4, id: 'ch4', ...chapterRecordExtra }, content: CHAPTER }],
    issues: [{ chapterNumber: 4, fixType: 'prose', description: 'Tighten this exchange.', quote: TARGET.slice(0, 40) }],
    project: { title: 'T' },
    onProgress: () => {},
    _llmOverride: async () => revision,
    _saveOverride: async (id, content) => { saved = content; return true; },
  });
  return { result: res.results[0], saved };
}

// ─── FIXGUARD-1: dialogue damage ──────────────────────────────────────────────

check('FIXGUARD-1: a dropped OPENING quote never reaches the manuscript',
  await (async () => {
    const { saved } = await runFix(TARGET.replace(OPEN, ''));
    return saved === null || imbalance(saved) === imbalance(CHAPTER);
  })());

check('FIXGUARD-1: a dropped opening quote is REPAIRED, not just rejected',
  await (async () => {
    const { result } = await runFix(TARGET.replace(OPEN, ''));
    return result.status === 'applied';
  })());

check('FIXGUARD-1: a dropped CLOSING quote is rejected and the original kept',
  await (async () => {
    const { result, saved } = await runFix(TARGET.replace(CLOSE, ''));
    return result.status === 'failed'
      && (saved === null || imbalance(saved) === imbalance(CHAPTER));
  })());

check('FIXGUARD-1: the rejection says WHY, with counts',
  await (async () => {
    const { result } = await runFix(TARGET.replace(CLOSE, ''));
    return /Dialogue damage/.test(result.detail || '') && /opening/.test(result.detail || '');
  })());

check('FIXGUARD-1: a clean rewrite is still accepted (no false rejection)',
  await (async () => {
    const { result, saved } = await runFix(TARGET.replace('Vale agreed', 'Vale said'));
    return result.status === 'applied' && imbalance(saved) === imbalance(CHAPTER);
  })());

check('FIXGUARD-1: a rewrite with no dialogue at all is still accepted',
  await (async () => {
    const { result } = await runFix('Vale nodded once and started down the service ladder, saying nothing at all, while the water kept climbing the far bulkhead behind them.');
    return result.status === 'applied';
  })());

check('FIXGUARD-1: quote balance is preserved across the whole chapter',
  await (async () => {
    for (const rev of [TARGET.replace(OPEN, ''), TARGET.replace(CLOSE, ''), TARGET]) {
      const { saved } = await runFix(rev);
      if (saved !== null && imbalance(saved) !== imbalance(CHAPTER)) return false;
    }
    return true;
  })());

// ─── FIXGUARD-2: the fixer can see the ledger ───────────────────────────────

const LEDGER = JSON.stringify({
  characterConditions: { marcus: ['left amputated/severed'], ana: ['blind'] },
  deadCharacters: ['Vale'],
});

async function capturePrompt(chapterRecordExtra) {
  let prompt = '';
  await applySurgicalFixes({
    loaded: [{ chapter: { chapter_number: 4, id: 'ch4', ...chapterRecordExtra }, content: CHAPTER }],
    issues: [{ chapterNumber: 4, fixType: 'prose', description: 'Tighten.', quote: TARGET.slice(0, 40) }],
    project: { title: 'T' },
    onProgress: () => {},
    _llmOverride: async (p) => { prompt = p; return TARGET; },
    _saveOverride: async () => true,
  });
  return prompt;
}

check('FIXGUARD-2: character conditions reach the fix prompt',
  (await capturePrompt({ narrative_ledger_json: LEDGER })).includes('left amputated/severed'));

check('FIXGUARD-2: a second character’s condition also reaches it',
  (await capturePrompt({ narrative_ledger_json: LEDGER })).includes('blind'));

check('FIXGUARD-2: dead characters reach the fix prompt',
  (await capturePrompt({ narrative_ledger_json: LEDGER })).includes('DEAD'));

check('FIXGUARD-2: the prompt forbids contradicting them',
  /do NOT contradict/i.test(await capturePrompt({ narrative_ledger_json: LEDGER })));

check('FIXGUARD-2: a chapter with NO ledger produces no constraint block',
  !(await capturePrompt({})).includes('ESTABLISHED CHARACTER STATE'));

check('FIXGUARD-2: malformed ledger JSON does not throw or leak',
  (async () => {
    const p = await capturePrompt({ narrative_ledger_json: '{not json' });
    return !p.includes('ESTABLISHED CHARACTER STATE');
  })());

check('FIXGUARD-2: an empty ledger produces no constraint block',
  !(await capturePrompt({ narrative_ledger_json: JSON.stringify({ characterConditions: {}, deadCharacters: [] }) }))
    .includes('ESTABLISHED CHARACTER STATE'));

check('FIXGUARD-2: the original rules are all still present',
  (() => {
    return capturePrompt({ narrative_ledger_json: LEDGER }).then((p) =>
      p.includes('Rewrite the entire target paragraph')
      && p.includes('Preserve all events')
      && p.includes('Return ONLY the revised paragraph text'));
  })());

// ─── the existing guards must be untouched ──────────────────────────────────

check('UNCHANGED: the length guard still rejects an over-long rewrite',
  await (async () => {
    const { result } = await runFix(TARGET + ' ' + TARGET + ' ' + TARGET);
    return result.status === 'failed' && /Length mismatch/.test(result.detail || '');
  })());

check('UNCHANGED: a quote that cannot be located is still reported stale',
  await (async () => {
    let res;
    res = await applySurgicalFixes({
      loaded: [{ chapter: { chapter_number: 4, id: 'ch4' }, content: CHAPTER }],
      issues: [{ chapterNumber: 4, fixType: 'prose', description: 'x', quote: 'this text is not in the chapter at all' }],
      project: { title: 'T' }, onProgress: () => {},
      _llmOverride: async () => TARGET, _saveOverride: async () => true,
    });
    return res.results[0].status === 'stale';
  })());

console.log('\nSURGICAL FIX GUARDS (FIXGUARD-1 + FIXGUARD-2): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
