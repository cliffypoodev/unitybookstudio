// AUDITPROMPT-1 proof: the future-boundary audit prompt must actually be a
// multi-line prompt, and a failed audit must show what the model said.
//
// Live failure, 2026-07-29, Chapter 1 scene 1 (and Chapter 2 before it):
//   [auditSceneFutureBoundaries] attempt 1/3 returned unusable data: LLM response did not contain a JSON array.
//   [auditSceneFutureBoundaries] attempt 2/3 returned unusable data: LLM response did not contain a JSON array.
//   [auditSceneFutureBoundaries] attempt 3/3 returned unusable data: LLM response did not contain a JSON array.
//   NarrativeInvariantError: Scene ch01-s01 was rejected: future boundary audit
//     failed to execute or returned malformed JSON.
//
// TWO defects, both proven from source:
//
// 1. The prompt was assembled with .join('\\n') — a literal backslash and the
//    letter n, not a newline. It is the ONLY place in src/ that does this; every
//    other prompt builder in the app uses a real newline. The model was handed one
//    single line: seven rules, the reserved-event list, several thousand characters
//    of novel prose, and then "Output ONLY valid JSON." welded onto the end of it.
//
// 2. "did not contain a JSON array" means the reply held no [ ... ] pair AT ALL —
//    an empty completion, or continuous prose. Nothing logged the reply, so two
//    fixes (AUDITRETRY-1, AUDITJSON-1) were aimed at this parse without anyone
//    ever seeing what came back. Retrying an unread answer three times is not a
//    diagnosis.
import { auditSceneFutureBoundaries } from '@/lib/sceneBeatNormalizer';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); pass += 1; }
  else { console.log('FAIL ' + name); fail += 1; }
}

const SPEC = {
  future_reserved_events: [
    'Marcus unlocks the archive with the key.',
    'Lena confronts Dr. Vale about the report.',
  ],
};
const PROSE = 'Lena stood in the corridor with the key still warm in her fist and did not go back through the door.';

// Capture the prompt the audit builds.
async function capturePrompt(reply = '[]') {
  let captured = null;
  const fn = async (payload) => { captured = payload; return reply; };
  const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
  return { prompt: captured?.prompt || '', payload: captured, audit };
}

// Capture console.warn output.
async function captureWarnings(reply) {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => { lines.push(args.map((a) => (typeof a === 'string' ? a : String(a?.message || a))).join(' ')); };
  try {
    const fn = async () => (reply instanceof Error ? (() => { throw reply; })() : reply);
    const audit = await auditSceneFutureBoundaries(PROSE, SPEC, 'local', fn);
    return { lines, audit };
  } finally {
    console.warn = original;
  }
}

// ── 1. THE PROMPT IS A PROMPT, NOT ONE LINE ─────────────────────────────────
{
  const { prompt } = await capturePrompt();

  check('the prompt contains real newlines', (prompt.match(/\n/g) || []).length >= 15);
  check('the prompt contains NO literal backslash-n sequences', !prompt.includes('\\n'));

  // Every structural marker must own its line, or the model is reading a wall.
  for (const marker of [
    'RULES:',
    'RESERVED FUTURE EVENTS (Do not perform these):',
    'SCENE PROSE TO EVALUATE:',
    'Return a JSON array of violations. If no violations exist, return [].',
    'Output ONLY valid JSON.',
  ]) {
    const idx = prompt.indexOf(marker);
    check(`"${marker.slice(0, 34)}" starts its own line`,
      idx === 0 || (idx > 0 && prompt[idx - 1] === '\n'));
  }

  // The final instruction must not be buried at the end of the prose paragraph.
  const proseIdx = prompt.indexOf(PROSE);
  const jsonIdx = prompt.indexOf('Output ONLY valid JSON.');
  check('the prose block is separated from the closing instructions by a blank line',
    proseIdx !== -1 && jsonIdx > proseIdx && prompt.slice(proseIdx + PROSE.length, jsonIdx).includes('\n\n'));

  // Each reserved event is addressable by ID only if each is on its own line.
  check('[ID: 0] starts its own line', /\n\[ID: 0\] Marcus unlocks/.test(prompt));
  check('[ID: 1] starts its own line', /\n\[ID: 1\] Lena confronts/.test(prompt));

  // The rewrite must not have changed WHAT is asked, only how it is laid out.
  for (const rule of [
    'Merely mentioning an object or character from a reserved event is NOT a violation.',
    'Foreshadowing, guessing, fearing, or discussing a future possibility is NOT a violation.',
    'A negated statement ("They did not find the key") is NOT a violation.',
    'A violation ONLY occurs if the scene definitively enacts the physical or informational action of the reserved event.',
    'You must extract the exact sentence excerpt that performs the violation.',
  ]) {
    check(`rule preserved: "${rule.slice(0, 30)}..."`, prompt.includes(rule));
  }
  check('the response format is still specified',
    prompt.includes('{"id": <number from list>, "excerpt": "<exact sentence from prose>"}'));
  check('the prose is still passed to the model', prompt.includes(PROSE));
}

// ── 2. A FAILED AUDIT SHOWS WHAT THE MODEL SAID ─────────────────────────────
{
  const storyContinuation = 'Lena turned back toward the door anyway. The corridor lights had gone amber while she stood there, and somewhere below the deck plating a compressor kicked over and settled.';
  const { lines, audit } = await captureWarnings(storyContinuation);
  const rawLines = lines.filter((l) => l.includes('raw reply:'));

  check('a failed audit prints the raw reply', rawLines.length === 3);
  check('  ... once per attempt', rawLines.length === 3);
  check('  ... reporting the type', rawLines[0].includes('type=string'));
  check('  ... reporting the length', rawLines[0].includes('length=' + storyContinuation.length));
  check('  ... and showing the actual text', rawLines[0].includes('Lena turned back toward the door anyway'));
  check('fail-closed is unchanged', audit.ok === false && audit.auditFailed === true);
}

// An empty completion must be visibly empty, not silently "unusable data".
{
  const { lines, audit } = await captureWarnings('');
  const rawLines = lines.filter((l) => l.includes('raw reply:'));
  check('an EMPTY reply is reported as length=0', rawLines.length === 3 && rawLines[0].includes('length=0'));
  check('  ... and still fails closed', audit.ok === false && audit.auditFailed === true);
}

// A thrown transport error must not crash the logger.
{
  const { lines, audit } = await captureWarnings(new Error('Cannot reach llama serve at http://127.0.0.1:8080'));
  check('a thrown error still fails closed', audit.ok === false && audit.auditFailed === true);
  check('  ... and the raw-reply line survives a null reply',
    lines.filter((l) => l.includes('raw reply:')).length === 3);
  check('  ... reporting nothing was received', lines.find((l) => l.includes('raw reply:')).includes('length=0'));
}

// The dump is bounded — a 20k-character reply must not flood the console.
{
  const huge = 'x'.repeat(20000);
  const { lines } = await captureWarnings(huge);
  const raw = lines.find((l) => l.includes('raw reply:'));
  check('a huge reply is reported at full length', raw.includes('length=20000'));
  check('  ... but only the first 400 characters are printed', raw.length < 700);
}

// Success must stay quiet.
{
  const { lines, audit } = await captureWarnings('[]');
  check('a clean audit prints no raw-reply noise',
    audit.ok === true && lines.filter((l) => l.includes('raw reply:')).length === 0);
}

// ── 3. NOTHING ELSE MOVED ───────────────────────────────────────────────────
{
  const { audit } = await captureWarnings('[{"id": 0, "excerpt": "Marcus turned the key and the archive door gave."}]');
  check('a real violation is still reported', audit.ok === false && audit.violations.length === 1);
  check('  ... naming the reserved event', audit.violations[0].event === 'Marcus unlocks the archive with the key.');
  check('  ... and is not an audit failure', !audit.auditFailed);
}
{
  const { audit, payload } = await capturePrompt('[]');
  check('the audit still asks for headroom (AUDITJSON-1 intact)', payload.max_tokens === 4000);
  check('the audit still runs cold (temperature 0.1)', payload.temperature === 0.1);
  check('a clean reply passes', audit.ok === true);
}
{
  let calls = 0;
  const fn = async () => { calls += 1; return '[]'; };
  const audit = await auditSceneFutureBoundaries(PROSE, { future_reserved_events: [] }, 'local', fn);
  check('no reserved events still means no model call', audit.ok === true && calls === 0);
}
{
  let calls = 0;
  const fn = async () => { calls += 1; return '[]'; };
  const audit = await auditSceneFutureBoundaries('', SPEC, 'local', fn);
  check('empty prose still means no model call', audit.ok === true && calls === 0);
}

// ── 4. AN EMPTY COMPLETION IS NAMED WHERE IT HAPPENS ────────────────────────
// If content comes back blank, the reply almost always landed in
// reasoning_content. Downstream only ever saw "unusable data".
{
  const { callLlama } = await import('@/lib/localLLM.js');
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const lines = [];
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '', reasoning_content: 'I should check whether...' }, finish_reason: 'length' }] }),
  });
  console.warn = (...a) => lines.push(a.join(' '));
  console.log = () => {};
  let text;
  try {
    text = await callLlama({ model: 'qwen3.6-35b-uncensored', prompt: 'audit this', maxTokens: 4000 });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.log = originalLog;
  }
  const empty = lines.find((l) => l.includes('EMPTY completion'));
  check('an empty completion is named', Boolean(empty));
  check('  ... naming the model', Boolean(empty) && empty.includes('qwen3.6-35b-uncensored'));
  check('  ... reporting the finish reason', Boolean(empty) && empty.includes('finish_reason: length'));
  check('  ... and reporting that reasoning_content held the answer',
    Boolean(empty) && empty.includes('reasoning_content length: 25'));
  check('  ... while still returning an empty string, not throwing', text === '');
}
// A healthy reply must stay silent.
{
  const { callLlama } = await import('@/lib/localLLM.js');
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const lines = [];
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '[]' }, finish_reason: 'stop' }] }),
  });
  console.warn = (...a) => lines.push(a.join(' '));
  console.log = () => {};
  let text;
  try {
    text = await callLlama({ model: 'qwen3.6-35b-uncensored', prompt: 'audit this', maxTokens: 4000 });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.log = originalLog;
  }
  check('a healthy completion prints no empty-completion warning',
    text === '[]' && !lines.some((l) => l.includes('EMPTY completion')));
}

console.log('\nAUDIT PROMPT SHAPE (AUDITPROMPT-1): ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
