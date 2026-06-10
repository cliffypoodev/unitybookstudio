#!/usr/bin/env node
/**
 * smoke-test.mjs — Standalone pipeline smoke test for UBS
 *
 * Calls Ollama ghostwriter model with 3 controlled chapter prompts,
 * runs regex cleanup + polish stages + exact-final-line enforcement,
 * validates at every step.
 *
 * Usage: node smoke-test.mjs
 */

import { extractRequiredFinalLine, enforceExactFinalLine } from './src/lib/exactFinalLine.js';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'ghostwriter';
const TEMPERATURE = 0.72;
const MAX_TOKENS = 6000;

// ─── Chapter prompts ───────────────────────────────────────────
const CHAPTER_PROMPTS = [
  {
    num: 1,
    title: 'The Weight of Cotton Dust',
    prompt: `Write Chapter 1 of a Southern Gothic mystery novel set in Harmony Creek, Alabama, 1962.

Opening rule:
Chapter 1 must open mid-action. The first sentence must show Margot physically doing something. Do not open with heat, humidity, weather, atmosphere, backstory, or description.

Concrete goal:
Margot wants Chester to unlock Maude's basement records room.

Resistance:
Chester tries to keep her in the parlor.
Vivian tries to redirect her with polite hospitality.

Required physical beats:
Margot reaches the porch and knocks before Chester can avoid her.
Chester moves her toward the parlor.
Margot spots the brass key in Chester's waistcoat pocket.
Vivian says one ordinary sentence that is actually a warning.
Margot demands the key.
Chester unlocks the basement records room.
Margot finds the ledger on a central desk.
The final line must be exactly:
The ledger was dated May 12th.

CRITICAL RULES:
- This is an 1860s-1960s rural Alabama setting. NO modern companies, apps, software, business pitches, compliance systems, subscriptions, ROI, healthcare operations, AI products, or corporate terms.
- Write finished prose only. No headings except the chapter title. No notes. No analysis. No self-correction. No meta-commentary.
- Target 1500-2000 words.`,
    expectedEnding: 'The ledger was dated May 12th.',
    openingRule: 'mid-action',
  },
  {
    num: 2,
    title: "The Ledger's Confession",
    prompt: `Write Chapter 2 of a Southern Gothic mystery novel set in Harmony Creek, Alabama, 1962.

Opening rule:
Chapter 2 must open with dialogue. The first line must be spoken dialogue in quotation marks.

Concrete goal:
Margot wants Vivian to explain why the ledger lists names beside payments.

Resistance:
Vivian tries to call the payments charity.
Chester insists the ledger is just old bookkeeping.

Required physical beats:
Margot places the ledger on the dining table.
Vivian turns one page back before answering.
Chester reaches for the ledger and Margot pulls it away.
Margot finds a receipt tucked between two pages.
The receipt names three families: Rivers, Thorne, and Dale.
Vivian admits the payments were made to keep people quiet.
The final line must be exactly:
The tea cooled untouched beside Vivian's hand.

CRITICAL RULES:
- This is an 1860s-1960s rural Alabama setting. NO modern companies, apps, software, business pitches, compliance systems, subscriptions, ROI, healthcare operations, AI products, or corporate terms.
- Write finished prose only. No notes. No analysis. No self-correction. No meta-commentary.
- Target 1500-2000 words.`,
    expectedEnding: "The tea cooled untouched beside Vivian's hand.",
    openingRule: 'dialogue',
  },
  {
    num: 3,
    title: "Founder's Hall",
    prompt: `Write Chapter 3 of a Southern Gothic mystery novel set in Harmony Creek, Alabama, 1962.

Opening rule:
Chapter 3 must open with one-sense sensory detail only.

Concrete goal:
Margot wants to match the receipt to the plaque in Founder's Hall.

Resistance:
Jebediah tries to dismiss the receipt as a ceremonial donation.
Silas tells Margot the plaque was replaced last year.

Required physical beats:
Margot enters Founder's Hall with the receipt folded in her palm.
She compares the receipt to the plaque.
Silas points out two screw marks where an older plaque used to be.
Jebediah tries to take the receipt.
Margot steps back and reads the handwritten note on the back.
The note says: "Keep the story clean."
End with gut-punch dialogue from Jebediah.
The final line must be exactly:
"You were never supposed to find her name."

CRITICAL RULES:
- This is an 1860s-1960s rural Alabama setting. NO modern companies, apps, software, business pitches, compliance systems, subscriptions, ROI, healthcare operations, AI products, or corporate terms.
- Write finished prose only. No notes. No analysis. No self-correction. No meta-commentary.
- Target 1500-2000 words.`,
    expectedEnding: '"You were never supposed to find her name."',
    openingRule: 'sensory',
  },
];

// ─── Canary terms ──────────────────────────────────────────────
const CONTAMINATION = [
  'Unity Supported Living Services', 'Unity Media Solutions', 'Unity Core',
  'OmniCorp', 'ROI', 'Q3', 'cohort analysis', 'subscription service',
  'care documentation', 'compliance pipeline', 'mobile logging system',
  'Project Management Office', 'AI content pipeline', 'business plan',
  'investor interest', 'premium digital resource hub',
  'caregiving community', 'developmental disabilities',
  'funding streams', 'market penetration', 'platform',
];

const FORBIDDEN = [
  'not just', 'more than just', 'the truth was', 'the lie was',
  'the secret was', 'the mystery was', 'the narrative', 'the performance',
  'the emotional architecture', 'the collective memory', "the town's identity",
  'the weight of', 'woven into', 'fabric of', 'foundation of the lie',
  'rot beneath', 'a sense of', 'the air was thick',
  'the air itself felt thick', 'washed over', "couldn't help but",
];

const LITERAL_OBJECTS = [
  'the ledger', 'the secondary ledger', 'the diary', 'the brass key',
  'the plaque', 'the lockbox', 'the receipt', 'the watch',
];

const MALFORMED = [
  'from to the', 'looked at;', 'looked at.', 'fixed on,', 'fixed on.',
  'shifted his gaze from to', 'shifted her gaze from to',
  'reached for to', 'turned from to',
];

const LEAKED_NOTES = [
  'Self-Correction', 'Anticipation Check', 'Thinking', 'Next steps',
  'Emotional Arc', 'CHAPTER NOTES', 'REVISION NOTES', 'TODO:', 'FIXME:', 'NOTE:',
];

// ─── Helpers ───────────────────────────────────────────────────
function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) || []).length;
}

function countTermWB(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function validate(text, chNum) {
  const r = {
    ch: chNum,
    words: wordCount(text),
    chars: text.length,
    contamination: {},
    contaminationTotal: 0,
    forbidden: {},
    forbiddenTotal: 0,
    literals: {},
    literalTotal: 0,
    malformed: {},
    malformedTotal: 0,
    leaked: {},
    leakedTotal: 0,
    notJust: 0,
  };
  for (const t of CONTAMINATION) { const c = countTerm(text, t); if (c) { r.contamination[t] = c; r.contaminationTotal += c; } }
  for (const t of FORBIDDEN) { const c = countTerm(text, t); if (c) { r.forbidden[t] = c; r.forbiddenTotal += c; } }
  for (const t of LITERAL_OBJECTS) { const c = countTerm(text, t); r.literals[t] = c; r.literalTotal += c; }
  for (const t of MALFORMED) { const c = countTerm(text, t); if (c) { r.malformed[t] = c; r.malformedTotal += c; } }
  for (const t of LEAKED_NOTES) { const c = countTermWB(text, t); if (c) { r.leaked[t] = c; r.leakedTotal += c; } }
  r.notJust = countTerm(text, 'not just');
  r.pass = r.contaminationTotal === 0 && r.malformedTotal === 0 && r.leakedTotal === 0 && r.notJust <= 2;
  return r;
}

function printValidation(label, v) {
  const sym = (pass) => pass ? '✅' : '❌';
  console.log(`  ${label}: ${v.words}w/${v.chars}c | contam=${sym(v.contaminationTotal===0)}${v.contaminationTotal} | malform=${sym(v.malformedTotal===0)}${v.malformedTotal} | leaked=${sym(v.leakedTotal===0)}${v.leakedTotal} | not-just=${sym(v.notJust<=2)}${v.notJust} | forbidden=${v.forbiddenTotal} | literals=${v.literalTotal} | ${sym(v.pass)}${v.pass ? 'PASS' : 'FAIL'}`);
  if (v.contaminationTotal > 0) console.log(`    CONTAMINATION: ${JSON.stringify(v.contamination)}`);
  if (v.malformedTotal > 0) console.log(`    MALFORMED: ${JSON.stringify(v.malformed)}`);
  if (v.leakedTotal > 0) console.log(`    LEAKED: ${JSON.stringify(v.leaked)}`);
  if (v.forbiddenTotal > 0) {
    const top = Object.entries(v.forbidden).sort((a,b) => b[1]-a[1]).slice(0,8);
    console.log(`    TOP FORBIDDEN: ${top.map(([k,v])=>`"${k}":${v}`).join(', ')}`);
  }
  if (v.literalTotal > 0) {
    const present = Object.entries(v.literals).filter(([,c]) => c > 0);
    console.log(`    LITERALS FOUND: ${present.map(([k,v])=>`"${k}":${v}`).join(', ')}`);
  }
}

// ─── Regex cleanup (replicated from the codebase) ──────────────
function lightClean(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text;
  t = t.replace(/^```[\s\S]*?\n/gm, '').replace(/```$/gm, '');
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/\n---\n[\s\S]*$/m, '');
  t = t.replace(/\n\*\*(?:Notes?|Analysis|Self-Correction|Anticipation)[\s\S]*$/mi, '');
  t = t.replace(/^Chapter\s+\d+\s*[:.\-—]\s*/i, '');
  t = t.replace(/^#+\s*Chapter\s+\d+\s*[:.\-—][^\n]*/im, '');
  return t.trim();
}

function deepClean(text) {
  if (!text) return '';
  let t = text;
  const BANNED_EXACT = [
    /\bundeniable\b/gi, /\bundeniably\b/gi,
    /\bpalpable\b/gi, /\bpalpably\b/gi,
    /\btangible\b/gi, /\btangibly\b/gi,
    /\bmeticulously\b/gi,
  ];
  for (const rx of BANNED_EXACT) { t = t.replace(rx, ''); }
  t = t.replace(/  +/g, ' ');
  t = t.replace(/ +,/g, ',');
  t = t.replace(/ +\./g, '.');
  return t.trim();
}

function capNotJust(text, maxKeep = 3) {
  let count = 0;
  return text.replace(/\bnot just\b/gi, (match) => {
    count++;
    return count <= maxKeep ? match : '';
  }).replace(/  +/g, ' ');
}

function capForbiddenPhrases(text) {
  const caps = [
    { rx: /\bmore than just\b/gi, max: 1 },
    { rx: /\bthe emotional architecture\b/gi, max: 0 },
    { rx: /\bthe collective memory\b/gi, max: 1 },
    { rx: /\bcouldn't help but\b/gi, max: 2 },
    { rx: /\bwashed over\b/gi, max: 2 },
    { rx: /\ba sense of\b/gi, max: 3 },
    { rx: /\bthe weight of\b/gi, max: 3 },
    { rx: /\bthe narrative\b/gi, max: 1 },
    { rx: /\bthe performance\b/gi, max: 1 },
  ];
  let t = text;
  for (const cap of caps) {
    let count = 0;
    t = t.replace(cap.rx, (match) => {
      count++;
      return count <= cap.max ? match : '';
    });
  }
  return t.replace(/  +/g, ' ');
}

function fixSVCommas(text) {
  const SV_VERBS = /\b(is|are|was|were|has|have|had|does|did|do|will|would|could|should|can|may|might|shall|sits|sat|stands|stood|walks|walked|runs|ran|goes|went|comes|came|gets|got|makes|made|takes|took|gives|gave|keeps|kept|lets|left|puts|set|hits|cut|falls|fell|rose|grew|pays|paid|costs|sent|spent|built|led|met|won|sold|bought|drove|wore|wrote|read|chose|hung|spoke|meant|hid|brought|taught|fought|caught|lost|found|held|told|heard|felt|knew|thought|saw|showed|seemed|appeared|remained|became|began|started|stopped|continued|turned|proved|happened|existed|occurred|lived|died|worked|played|moved|changed|produced|created|provided|offered|allowed|caused|raised|needed|wanted|required|vanished|implied|represented|included|involved|operated|generated|converge|converges|generates|operates)\b/;
  const orig = text;
  return text.replace(
    new RegExp('(\\b\\w+)\\s*,\\s+(' + SV_VERBS.source.slice(2, -2) + ')', 'g'),
    (match, subject, verb, offset) => {
      if (/ing$/.test(verb)) return match;
      if (/^(?:isn|aren|wasn|weren|doesn|didn|don|won|can|couldn|shouldn|wouldn)/i.test(verb)) return match;
      if (/(?:ly|ed|ful|ous|ive|al|ent|ant|ible|able)$/.test(subject)) return match;
      const afterVerb = orig.substring(offset + match.length, offset + match.length + 40);
      const commaInAfter = afterVerb.indexOf(',');
      const beforeSubject = orig.substring(Math.max(0, offset - 5), offset);
      if (commaInAfter >= 0 && commaInAfter < 35) return match;
      if (beforeSubject.includes(',')) return match;
      return subject + ' ' + verb;
    }
  );
}

function polishPipeline(text) {
  let t = text;
  t = deepClean(t);
  t = fixSVCommas(t);
  t = capNotJust(t, 3);
  t = capForbiddenPhrases(t);
  let inQuote = false;
  let result = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '"') {
      result += inQuote ? '\u201d' : '\u201c';
      inQuote = !inQuote;
    } else {
      result += t[i];
    }
  }
  if (inQuote) { /* leave as-is */ } else { t = result; }
  t = t.replace(/\.{3}/g, '\u2026');
  t = t.replace(/  +/g, ' ');
  return t.trim();
}

// ─── Ollama call ───────────────────────────────────────────────
async function callGhostwriter(prompt) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS },
  };
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.message?.content || '';
}

// ─── Check opening rule ────────────────────────────────────────
function checkOpening(text, rule) {
  const firstLine = text.split('\n').find(l => l.trim().length > 10)?.trim() || '';
  if (rule === 'dialogue') {
    return { pass: /^[""\u201c]/.test(firstLine), firstLine };
  }
  if (rule === 'sensory') {
    const isDialogue = /^[""\u201c]/.test(firstLine);
    return { pass: !isDialogue, firstLine };
  }
  if (rule === 'mid-action') {
    const weatherOpeners = /^(?:the heat|the humidity|the air|it was hot|the sun|the sky|the weather|the temperature)/i;
    return { pass: !weatherOpeners.test(firstLine), firstLine };
  }
  return { pass: true, firstLine };
}

// ─── Check ending ──────────────────────────────────────────────
function checkEnding(text, expected) {
  const trimmed = text.trim();
  const lastLines = trimmed.split('\n').filter(l => l.trim()).slice(-3).join(' ').trim();
  const clean = (s) => s.replace(/["""\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  const exact = clean(lastLines).endsWith(clean(expected));
  const fuzzy = lastLines.toLowerCase().includes(clean(expected).toLowerCase().slice(0, 30));
  return { exact, fuzzy, lastLines: lastLines.slice(-120) };
}

// ─── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   UBS PIPELINE SMOKE TEST v2 — Final Line Enforcement      ║');
  console.log('║   Model: ghostwriter | Ollama @ 127.0.0.1:11434            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check Ollama health
  try {
    const health = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const data = await health.json();
    const models = data.models?.map(m => m.name) || [];
    const hasGW = models.some(m => m.includes('ghostwriter'));
    console.log(`✅ Ollama running. ${models.length} models loaded. Ghostwriter: ${hasGW ? '✅' : '❌ MISSING'}`);
    if (!hasGW) { console.error('FATAL: ghostwriter model not found'); process.exit(1); }
  } catch (e) {
    console.error('❌ Cannot reach Ollama:', e.message);
    process.exit(1);
  }

  const results = [];

  for (const ch of CHAPTER_PROMPTS) {
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`  CHAPTER ${ch.num}: ${ch.title}`);
    console.log(`${'═'.repeat(64)}`);

    const stages = {};

    // ─── Extract required final line from prompt ─────────────
    const requiredFinalLine = extractRequiredFinalLine(ch.prompt);
    console.log(`\n  📌 Required final line: ${requiredFinalLine ? `"${requiredFinalLine}"` : '(none)'}`);

    // Stage 1: Call Ghostwriter
    console.log('\n  [1/6] Calling Ghostwriter LLM...');
    const startTime = Date.now();
    let raw;
    try {
      raw = await callGhostwriter(ch.prompt);
    } catch (e) {
      console.error(`  ❌ LLM call failed: ${e.message}`);
      results.push({ ch: ch.num, error: e.message });
      continue;
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ Ghostwriter responded in ${elapsed}s`);

    stages.raw = raw;
    stages.rawV = validate(raw, ch.num);
    console.log(`  [Stage 0a: Raw LLM output]`);
    printValidation('    0a', stages.rawV);

    // Stage 2: lightClean
    console.log('\n  [2/6] Running lightClean...');
    const light = lightClean(raw);
    stages.light = light;
    stages.lightV = validate(light, ch.num);
    printValidation('    0b', stages.lightV);

    // Stage 3: deepClean
    console.log('\n  [3/6] Running deepClean...');
    const deep = deepClean(light);
    stages.deep = deep;
    stages.deepV = validate(deep, ch.num);
    printValidation('    0c', stages.deepV);

    // Stage 4: Full polish pipeline
    console.log('\n  [4/6] Running polish pipeline...');
    const polished = polishPipeline(light);
    stages.polished = polished;
    stages.polishedV = validate(polished, ch.num);
    printValidation('    pol', stages.polishedV);

    // Stage 5: ★ EXACT FINAL LINE ENFORCEMENT ★
    console.log('\n  [5/6] Running exact final line enforcement...');
    const enforceResult = enforceExactFinalLine(polished, requiredFinalLine, `Ch.${ch.num}`);
    const enforced = enforceResult.text;
    stages.enforced = enforced;
    stages.enforcedV = validate(enforced, ch.num);
    stages.finalLinePatched = enforceResult.patched;
    if (enforceResult.patched) {
      console.log(`  ✅ PATCHED: model ending replaced with required final line.`);
    } else if (requiredFinalLine) {
      console.log(`  ✅ OK: text already ended with required final line.`);
    } else {
      console.log(`  ⚠️ No required final line found in prompt.`);
    }
    printValidation('    enf', stages.enforcedV);

    // Stage 6: Structural checks (on enforced text, not polished)
    console.log('\n  [6/6] Checking structure...');
    const opening = checkOpening(enforced, ch.openingRule);
    const ending = checkEnding(enforced, ch.expectedEnding);
    console.log(`  Opening (${ch.openingRule}): ${opening.pass ? '✅' : '❌'} "${opening.firstLine.slice(0, 80)}..."`);
    console.log(`  Ending (exact): ${ending.exact ? '✅' : '❌'} | (fuzzy): ${ending.fuzzy ? '✅' : '⚠️'}`);
    console.log(`  Last line: "...${ending.lastLines.slice(-100)}"`);

    // Delta summary
    const rawW = wordCount(raw);
    const enfW = wordCount(enforced);
    const delta = enfW - rawW;
    const pct = rawW > 0 ? ((delta / rawW) * 100).toFixed(1) : '0';
    console.log(`\n  Delta: ${rawW}w → ${enfW}w (${delta >= 0 ? '+' : ''}${delta}w, ${pct}%)`);

    // Literal object check
    const litsBefore = {};
    const litsAfter = {};
    for (const obj of LITERAL_OBJECTS) {
      litsBefore[obj] = countTerm(light, obj);
      litsAfter[obj] = countTerm(enforced, obj);
    }
    const destroyed = Object.entries(litsBefore).filter(([k, v]) => v > 0 && litsAfter[k] === 0);
    if (destroyed.length > 0) {
      console.log(`  ❌ LITERAL OBJECTS DESTROYED: ${destroyed.map(([k]) => k).join(', ')}`);
    } else {
      console.log(`  ✅ All literal objects preserved`);
    }

    results.push({
      ch: ch.num,
      title: ch.title,
      rawWords: rawW,
      enforcedWords: enfW,
      delta: `${pct}%`,
      openingPass: opening.pass,
      endingExact: ending.exact,
      endingFuzzy: ending.fuzzy,
      contaminationPass: stages.enforcedV.contaminationTotal === 0,
      malformedPass: stages.enforcedV.malformedTotal === 0,
      leakedPass: stages.enforcedV.leakedTotal === 0,
      notJust: stages.enforcedV.notJust,
      notJustPass: stages.enforcedV.notJust <= 2,
      forbiddenTotal: stages.enforcedV.forbiddenTotal,
      literalTotal: stages.enforcedV.literalTotal,
      literalsDestroyed: destroyed.length,
      finalLinePatched: stages.finalLinePatched,
      requiredFinalLine,
      overallPass:
        stages.enforcedV.pass &&
        opening.pass &&
        ending.exact &&  // NOW requires EXACT match since enforcement guarantees it
        destroyed.length === 0,
      stages,
    });
  }

  // ─── FINAL REPORT ──────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(64));
  console.log('  TABLE 1 — Per Chapter Pass/Fail');
  console.log('═'.repeat(64));
  console.log('Ch | Opening | Ending | Contam | Malform | Leaked | not-just | FinalLine | OVERALL');
  console.log('---|---------|--------|--------|---------|--------|----------|-----------|--------');
  for (const r of results) {
    if (r.error) { console.log(`${r.ch}  | ERROR: ${r.error}`); continue; }
    const s = (v) => v ? '  ✅  ' : '  ❌  ';
    const fl = r.finalLinePatched ? ' PATCHED ' : '   OK    ';
    console.log(
      ` ${r.ch} |${s(r.openingPass)}|${s(r.endingExact)}|${s(r.contaminationPass)}|${s(r.malformedPass)}|${s(r.leakedPass)}|  ${r.notJust<=2?'✅':'❌'} ${r.notJust}   | ${fl} |${s(r.overallPass)}`
    );
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TABLE 2 — Before/After Final Lines');
  console.log('═'.repeat(64));
  for (const r of results) {
    if (r.error) continue;
    const polLast = r.stages.polished.trim().split('\n').filter(l=>l.trim()).slice(-1)[0]?.trim() || '';
    const enfLast = r.stages.enforced.trim().split('\n').filter(l=>l.trim()).slice(-1)[0]?.trim() || '';
    const required = r.requiredFinalLine || '(none)';
    console.log(`\n  Ch.${r.ch}:`);
    console.log(`    Required:  "${required}"`);
    console.log(`    Pre-enf:   "...${polLast.slice(-100)}"`);
    console.log(`    Post-enf:  "...${enfLast.slice(-100)}"`);
    console.log(`    Match: ${r.endingExact ? '✅ EXACT' : '❌ MISMATCH'} | Patched: ${r.finalLinePatched ? 'YES' : 'no'}`);
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TABLE 3 — Stage Word Count Deltas');
  console.log('═'.repeat(64));
  console.log('Ch | Raw    | Light  | Deep   | Polish | Enforced | Δ Raw→Enf');
  console.log('---|--------|--------|--------|--------|----------|----------');
  for (const r of results) {
    if (r.error) continue;
    const s = r.stages;
    console.log(
      ` ${r.ch} | ${String(s.rawV.words).padStart(5)} | ${String(s.lightV.words).padStart(5)} | ${String(s.deepV.words).padStart(5)} | ${String(s.polishedV.words).padStart(5)} | ${String(s.enforcedV.words).padStart(7)} | ${r.delta}`
    );
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TABLE 4 — Forbidden Phrase Summary');
  console.log('═'.repeat(64));
  const allForbidden = {};
  for (const r of results) {
    if (r.error || !r.stages) continue;
    for (const [phrase, count] of Object.entries(r.stages.enforcedV.forbidden)) {
      allForbidden[phrase] = (allForbidden[phrase] || 0) + count;
    }
  }
  const sorted = Object.entries(allForbidden).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    console.log('  None! 🎉');
  } else {
    for (const [phrase, count] of sorted) {
      console.log(`  "${phrase}": ${count}`);
    }
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TABLE 5 — Literal Object Preservation');
  console.log('═'.repeat(64));
  for (const obj of LITERAL_OBJECTS) {
    let totalBefore = 0, totalAfter = 0;
    for (const r of results) {
      if (r.error || !r.stages) continue;
      totalBefore += countTerm(r.stages.light, obj);
      totalAfter += countTerm(r.stages.enforced, obj);
    }
    const status = totalBefore === 0 ? '—' : (totalAfter >= totalBefore ? '✅' : (totalAfter === 0 ? '❌ DESTROYED' : `⚠️ ${totalBefore}→${totalAfter}`));
    console.log(`  "${obj}": before=${totalBefore}, after=${totalAfter} ${status}`);
  }

  // Overall verdict
  const allPassed = results.every(r => r.overallPass);
  console.log('\n' + '═'.repeat(64));
  console.log(`  OVERALL VERDICT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`);
  console.log('═'.repeat(64));

  if (!allPassed) {
    console.log('\n  FAILURES:');
    for (const r of results) {
      if (r.error) { console.log(`    Ch.${r.ch}: LLM error — ${r.error}`); continue; }
      if (r.overallPass) continue;
      const issues = [];
      if (!r.openingPass) issues.push('opening rule violated');
      if (!r.endingExact) issues.push(`ending not exact after enforcement`);
      if (!r.contaminationPass) issues.push(`contamination: ${JSON.stringify(r.stages.enforcedV.contamination)}`);
      if (!r.malformedPass) issues.push(`malformed: ${JSON.stringify(r.stages.enforcedV.malformed)}`);
      if (!r.leakedPass) issues.push(`leaked notes: ${JSON.stringify(r.stages.enforcedV.leaked)}`);
      if (r.notJust > 2) issues.push(`not-just: ${r.notJust} (max 2)`);
      if (r.literalsDestroyed > 0) issues.push('literal objects destroyed');
      console.log(`    Ch.${r.ch}: ${issues.join('; ')}`);
    }
  }

  // Write stage outputs
  const fs = await import('fs');
  const outDir = '/Users/cliff/Downloads/UBS/smoke-test-output';
  fs.mkdirSync(outDir, { recursive: true });
  for (const r of results) {
    if (r.error || !r.stages) continue;
    fs.writeFileSync(`${outDir}/ch${r.ch}-0a-raw.txt`, r.stages.raw);
    fs.writeFileSync(`${outDir}/ch${r.ch}-0b-lightClean.txt`, r.stages.light);
    fs.writeFileSync(`${outDir}/ch${r.ch}-0c-deepClean.txt`, r.stages.deep);
    fs.writeFileSync(`${outDir}/ch${r.ch}-1-polished.txt`, r.stages.polished);
    fs.writeFileSync(`${outDir}/ch${r.ch}-2-enforced.txt`, r.stages.enforced);
  }
  console.log(`\n  📁 Stage outputs saved to ${outDir}/`);
  console.log('     ch{1,2,3}-{0a-raw,0b-lightClean,0c-deepClean,1-polished,2-enforced}.txt');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
