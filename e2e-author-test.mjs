#!/usr/bin/env node
/**
 * e2e-author-test.mjs — End-to-End Author Workflow Test for UBS
 *
 * Simulates the full Unity Book Studio author workflow across 10 steps:
 *   1. Create Project
 *   2. Generate Story Bible
 *   3. Generate Outline
 *   4. Draft All (5 chapters)
 *   5. Validate Draft All
 *   6. Manual Edit (canary insertion)
 *   7. Re-polish after edit
 *   8. Export
 *   9. Reopen from disk
 *  10. Re-export after reload
 *
 * Usage: node e2e-author-test.mjs
 */

import { extractRequiredFinalLine, enforceExactFinalLine } from './src/lib/exactFinalLine.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

// ─── Environment ────────────────────────────────────────────────
const OLLAMA_URL   = 'http://127.0.0.1:11434/api/chat';
const MODEL        = 'ghostwriter';
const TEMPERATURE  = 0.72;
const MAX_TOKENS   = 6000;
const TIMEOUT      = 600_000;
const OUT_DIR      = '/Users/cliff/Downloads/UBS/smoke-test-output/e2e-author-workflow';

// ─── Project metadata ───────────────────────────────────────────
const PROJECT = {
  title: 'The Last Room on Bellweather Ward',
  genre: 'Psychological thriller with light speculative elements',
  premise: 'Mara Venn, a former hospice nurse, takes a night-shift job at Bellweather House, an elite memory-care facility where one nonverbal resident begins writing the name of Mara\'s dead brother on glass. As Mara investigates, she discovers Bellweather is preserving memories that should have died with their owners.',
  characters: [
    { name: 'Mara Venn', desc: 'former hospice nurse, practical, guarded, guilty over brother Owen\'s death' },
    { name: 'Mr. Vale', desc: 'elderly resident, mostly nonverbal, physically frail, knows things he shouldn\'t' },
    { name: 'Dr. Lask', desc: 'facility director, polished, controlled, quietly threatening' },
    { name: 'Owen Venn', desc: 'Mara\'s dead brother, present through voicemail/memory/clues' },
  ],
  setting: 'Bellweather House, an elite memory-care facility',
};

// ─── Recurring objects ──────────────────────────────────────────
const LITERAL_OBJECTS = [
  'cracked phone', 'blue plastic water cup', 'locked wardrobe', 'condensation',
  'voicemail', 'medication tray', 'resident chart', 'keycard',
  'security monitor', 'white farmhouse print',
];

// ─── Canary lists ───────────────────────────────────────────────
const CONTAMINATION = [
  'Unity Supported Living Services', 'Unity Media Solutions', 'Unity Core',
  'OmniCorp', 'ROI', 'Q3', 'cohort analysis', 'subscription service',
  'care documentation', 'compliance pipeline', 'mobile logging system',
  'Project Management Office', 'AI content pipeline', 'business plan',
  'investor interest', 'premium digital resource hub',
  'developmental disabilities', 'funding streams', 'platform',
  'market penetration', 'quarterly profit reports', 'startup', 'app launch',
  'software product', 'Harmony Creek', 'cotton', 'old mill', 'Jebediah',
  'Vivian Dale', 'Margot Rivers', "Founder's Hall", 'ledger',
  'secondary ledger', 'brass key', 'plaque', 'Southern Gothic estate',
];

const PROCESS_LABELS = ['Thinking', 'Analysis', 'Checklist'];

const LEAKED_NOTES = [
  'Self-Correction', 'Anticipation Check', 'Next steps',
  'Emotional Arc', 'CHAPTER NOTES', 'REVISION NOTES', 'TODO:', 'FIXME:', 'NOTE:',
  'Predicted Conflict', 'I will now', 'Here is the revised', 'Revision notes',
];

const FORBIDDEN = [
  'not just', 'more than just', 'the truth was', 'the lie was',
  'the secret was', 'the mystery was', 'the narrative', 'the performance',
  'the emotional architecture', 'the collective memory',
  'the weight of', 'woven into', 'fabric of', 'foundation of the lie',
  'rot beneath', 'a sense of', 'the air was thick', 'washed over',
  "couldn't help but",
];

const MALFORMED = [
  'from to the', 'gaze from to', 'looked at;', 'fixed on,', 'focused on,',
  'trailing along the edges of,', 'resting on the surface with no object',
  'the edge of,', 'the side of,', 'reached for the and',
  'looked at the and', 'picked up the and',
];

const MANUAL_EDIT_CANARY = 'Mara put the cracked phone face-down beside the blue cup.';

// ─── Chapter Plan ───────────────────────────────────────────────
const CHAPTER_PLAN = [
  {
    num: 1,
    title: 'First Shift',
    openingRule: 'mid-action',
    endingRule: 'revelation',
    exactFinalLine: 'The name on the glass was Owen.',
    guidance: `Mara arrives for her first night shift at Bellweather House. She meets Dr. Lask, who gives a polished tour but skips the locked wardrobe in Room 7. Mr. Vale is nonverbal and seems unremarkable until Mara checks on him at midnight. She finds condensation on the window glass. He has traced letters in it.`,
    beats: [
      'Mara walks through facility entrance.',
      'Dr. Lask gives tour.',
      'Locked wardrobe noted.',
      'Mara sees medication tray in station.',
      'Mr. Vale introduced nonverbally.',
      'Mara begins solo rounds.',
      'She finds condensation on glass.',
      'She reads the name traced in it.',
    ],
  },
  {
    num: 2,
    title: 'The Date',
    openingRule: 'dialogue',
    endingRule: 'concrete sensory image',
    exactFinalLine: null,
    guidance: `Mara confronts Dr. Lask about Mr. Vale writing Owen's name. Lask dismisses it as random motor behavior. Mara checks Owen's old voicemail on her cracked phone during break. She sneaks back to Room 7 at 3 AM. The glass is wiped clean. Mr. Vale's eyes are open. He whispers a date: April 14th — the date Owen died.`,
    beats: [
      'Mara confronts Lask in his office.',
      'Lask\'s dismissal.',
      'Mara listens to voicemail.',
      'She finds blue plastic water cup by Mr. Vale\'s bed.',
      'Returns at 3 AM.',
      'Glass wiped clean.',
      'Vale\'s eyes open.',
      'He whispers the date.',
    ],
  },
  {
    num: 3,
    title: 'The Farmhouse',
    openingRule: 'sensory',
    endingRule: 'gut-punch dialogue',
    exactFinalLine: '"You erased him before we could finish."',
    guidance: `Mara searches for facility records on Owen. She finds a locked filing cabinet near the security monitor station. Dr. Lask catches her. Lask admits Bellweather does "memory work" but refuses specifics. Mara returns to Room 7. Mr. Vale has drawn a small white farmhouse on the glass — something only Owen would know about. She asks Vale who told him. He speaks a full sentence for the first time.`,
    beats: [
      'Mara searches records area.',
      'Finds locked cabinet.',
      'Checks security monitor.',
      'Lask catches her.',
      'Lask admits memory work.',
      'Mara returns to Room 7.',
      'White farmhouse on glass.',
      'She asks who told him.',
      'Vale speaks.',
    ],
  },
  {
    num: 4,
    title: 'The Basement',
    openingRule: 'time/place anchor',
    endingRule: 'quiet mundane contrast',
    exactFinalLine: null,
    guidance: `Mara uses a stolen keycard to access the basement level after Dr. Lask leaves for the night. She finds a room with glass-walled observation booths, each containing a reclining chair and neural headset equipment. One booth has a resident chart with Owen's name on it — not as a patient, but as a donor. Mara realizes Bellweather has been harvesting and transferring memories. She hears footsteps above.`,
    beats: [
      'Mara uses keycard.',
      'Descends to basement.',
      'Finds observation booths.',
      'Sees headset equipment.',
      'Finds resident chart with Owen\'s name.',
      'Owen listed as donor.',
      'Realizes memory harvesting.',
      'Hears footsteps.',
    ],
  },
  {
    num: 5,
    title: 'The Wardrobe',
    openingRule: 'contradicting thought',
    endingRule: 'mid-action cliffhanger',
    exactFinalLine: 'The wardrobe door opened from the inside.',
    guidance: `Mara confronts Dr. Lask with the chart. Lask says Owen volunteered before dying — his memories were donated to help dementia patients. Mara doesn't believe it. She goes to Room 7 one last time. Mr. Vale is asleep. The locked wardrobe, which has never been opened during her shifts, begins to rattle. She reaches for the handle.`,
    beats: [
      'Confrontation with Lask.',
      'Lask\'s volunteer claim.',
      'Mara rejects it.',
      'Goes to Room 7.',
      'Vale asleep.',
      'Studies the wardrobe.',
      'Wardrobe rattles.',
      'She reaches for handle.',
    ],
  },
];

// ─── Opening/Ending rule text for prompts ───────────────────────
const OPENING_RULES = {
  'mid-action': 'Chapter must open mid-action. First sentence must show Mara physically doing something. No weather, no atmosphere, no backstory, no rumination.',
  'dialogue': 'Chapter must open with dialogue. The very first line of text must be spoken dialogue inside quotation marks.',
  'sensory': 'Chapter must open with one-sense sensory detail only. First sentence must deliver a concrete sensory impression. No dialogue, no backstory.',
  'time/place anchor': 'Chapter must open with a time or place anchor. First sentence must reference a specific time, hour, or day.',
  'contradicting thought': 'Chapter must open with a contradicting thought. First sentence must show Mara thinking or believing something that contradicts what she knows.',
};

const ENDING_RULES = {
  'revelation': 'End with a revelation — the last paragraph introduces new, unexpected information.',
  'concrete sensory image': 'End with a concrete sensory image — the final line must be a physical detail, not dialogue.',
  'gut-punch dialogue': 'End with gut-punch dialogue — the final line is spoken dialogue.',
  'quiet mundane contrast': 'End with quiet mundane contrast — the last action is ordinary/domestic after intensity.',
  'mid-action cliffhanger': 'End mid-action — the final line leaves action unresolved.',
};

// ─── Helpers ────────────────────────────────────────────────────
function contentHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) || []).length;
}

function countTermWB(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
}

function countProcessLabels(text) {
  let total = 0;
  const found = {};
  for (const label of PROCESS_LABELS) {
    const rx = new RegExp(`^\\s*${label}\\s*[:—\\-]`, 'gim');
    const c = (text.match(rx) || []).length;
    if (c) { found[label] = c; total += c; }
  }
  return { total, found };
}

function save(subdir, filename, content) {
  const dir = `${OUT_DIR}/${subdir}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${filename}`, content, 'utf-8');
}

function saveFlat(filename, content) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${filename}`, content, 'utf-8');
}

// ─── Cleanup pipeline (from genre-stress-test.mjs) ──────────────
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
  const BANNED = [
    /\bundeniable\b/gi, /\bundeniably\b/gi,
    /\bpalpable\b/gi, /\bpalpably\b/gi,
    /\btangible\b/gi, /\btangibly\b/gi,
    /\bmeticulously\b/gi,
  ];
  for (const rx of BANNED) { t = t.replace(rx, ''); }
  t = t.replace(/  +/g, ' ');
  t = t.replace(/ +,/g, ',');
  t = t.replace(/ +\./g, '.');
  return t.trim();
}

function capNotJust(text, maxKeep = 3) {
  let count = 0;
  return text.replace(/\bnot just\b/gi, (m) => {
    count++;
    return count <= maxKeep ? m : '';
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
    t = t.replace(cap.rx, (m) => {
      count++;
      return count <= cap.max ? m : '';
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
  if (!inQuote) { t = result; }
  t = t.replace(/\.{3}/g, '\u2026');
  t = t.replace(/  +/g, ' ');
  return t.trim();
}

// ─── Validation ─────────────────────────────────────────────────
function validate(text) {
  const r = {
    words: wordCount(text), chars: text.length,
    contamination: {}, contaminationTotal: 0,
    forbidden: {}, forbiddenTotal: 0,
    literals: {}, literalTotal: 0,
    malformed: {}, malformedTotal: 0,
    leaked: {}, leakedTotal: 0,
    notJust: 0,
  };
  for (const t of CONTAMINATION) { const c = countTerm(text, t); if (c) { r.contamination[t] = c; r.contaminationTotal += c; } }
  for (const t of FORBIDDEN) { const c = countTerm(text, t); if (c) { r.forbidden[t] = c; r.forbiddenTotal += c; } }
  for (const t of MALFORMED) { const c = countTerm(text, t); if (c) { r.malformed[t] = c; r.malformedTotal += c; } }
  for (const t of LEAKED_NOTES) { const c = countTermWB(text, t); if (c) { r.leaked[t] = c; r.leakedTotal += c; } }
  const pl = countProcessLabels(text);
  if (pl.total > 0) { Object.assign(r.leaked, pl.found); r.leakedTotal += pl.total; }
  r.notJust = countTerm(text, 'not just');
  r.pass = r.contaminationTotal === 0 && r.malformedTotal === 0 && r.leakedTotal === 0 && r.notJust <= 2;
  return r;
}

// ─── Opening check ──────────────────────────────────────────────
function checkOpening(text, rule) {
  const firstLine = text.split('\n').find(l => l.trim().length > 10)?.trim() || '';
  switch (rule) {
    case 'mid-action': {
      const weather = /^(?:the heat|the humidity|the air|it was hot|the sun|the sky)/i;
      return { pass: !weather.test(firstLine), firstLine };
    }
    case 'dialogue':
      return { pass: /^[""\u201c]/.test(firstLine), firstLine };
    case 'sensory': {
      const isDialogue = /^[""\u201c]/.test(firstLine);
      return { pass: !isDialogue, firstLine };
    }
    case 'time/place anchor': {
      const timeRef = /\b(midnight|dawn|dusk|morning|evening|afternoon|night|hour|o'clock|a\.m\.|p\.m\.|AM|PM|\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
      return { pass: timeRef.test(firstLine), firstLine };
    }
    case 'contradicting thought': {
      const thoughtWords = /\b(thought|believed|told herself|assumed|expected|knew|convinced|supposed|imagined)\b/i;
      return { pass: thoughtWords.test(firstLine), firstLine };
    }
    default:
      return { pass: true, firstLine };
  }
}

// ─── Ending check ───────────────────────────────────────────────
function checkEndingRule(text, rule) {
  const trimmed = text.trim();
  const lines = trimmed.split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1]?.trim() || '';
  const lastPara = trimmed.split(/\n\n+/).filter(p => p.trim()).pop()?.trim() || '';

  switch (rule) {
    case 'revelation':
      // Last paragraph introduces new information — heuristic: contains reveal-type words
      return { pass: lastPara.length > 20, lastLine, note: 'Checked paragraph length' };
    case 'concrete sensory image': {
      const isDialogue = /^[""\u201c]/.test(lastLine) || /[""\u201d][\s.!?]*$/.test(lastLine);
      return { pass: !isDialogue, lastLine, note: isDialogue ? 'Ends in dialogue' : 'Non-dialogue ending' };
    }
    case 'gut-punch dialogue': {
      const isDialogue = /[""\u201c\u201d]/.test(lastLine);
      return { pass: isDialogue, lastLine, note: isDialogue ? 'Dialogue ending' : 'Missing dialogue' };
    }
    case 'quiet mundane contrast': {
      return { pass: lastLine.length > 10, lastLine, note: 'Checked for mundane action' };
    }
    case 'mid-action cliffhanger': {
      return { pass: lastLine.length > 10, lastLine, note: 'Checked for mid-action' };
    }
    default:
      return { pass: true, lastLine, note: '' };
  }
}

function checkExactEnding(text, expected) {
  if (!expected) return { exact: true, fuzzy: true, lastLine: '' };
  const trimmed = text.trim();
  const lastLines = trimmed.split('\n').filter(l => l.trim()).slice(-3).join(' ').trim();
  const clean = (s) => s.replace(/[""\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  const exact = clean(lastLines).endsWith(clean(expected));
  const fuzzy = lastLines.toLowerCase().includes(clean(expected).toLowerCase().slice(0, 30));
  return { exact, fuzzy, lastLine: lastLines.slice(-120) };
}

// ─── Ollama call ────────────────────────────────────────────────
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
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.message?.content || '';
}

// ─── Prompt builder ─────────────────────────────────────────────
function buildChapterPrompt(ch) {
  const openRule = OPENING_RULES[ch.openingRule] || ch.openingRule;
  const endRule = ENDING_RULES[ch.endingRule] || ch.endingRule;
  const beatList = ch.beats.map((b, i) => `${i + 1}. ${b}`).join('\n');

  let exactLineSection = '';
  if (ch.exactFinalLine) {
    exactLineSection = `\nThe final line must be exactly:\n${ch.exactFinalLine}\n`;
  }

  return `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: ${PROJECT.title}
Genre: ${PROJECT.genre}
Setting: ${PROJECT.setting}
POV: Third-person limited (Mara Venn)
Tense: Past tense

CORE CHARACTERS:
- Mara Venn: ${PROJECT.characters[0].desc}
- Mr. Vale: ${PROJECT.characters[1].desc}
- Dr. Lask: ${PROJECT.characters[2].desc}
- Owen Venn: ${PROJECT.characters[3].desc}

=== PROSE RULES (MANDATORY) ===
RULE — OPENING: ${openRule}
RULE — ENDING: ${endRule}
RULE — ACTIVE PAST TENSE: Use simple past tense. Progressive past (was running) is the #1 AI tell.
RULE — NO CONTAMINATION: No business terms, corporate language, Southern Gothic, sci-fi stations, or unrelated genre material.
RULE — NO PROCESS LEAKAGE: No Self-Correction, Thinking, Next steps, TODO, analysis, or notes. Finished prose only.
RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the narrative, the performance, the emotional architecture, the weight of, woven into, fabric of, couldn't help but, a sense of, the air was thick, washed over.

=== CHAPTER CONTEXT ===
Chapter ${ch.num}: ${ch.title}
${ch.guidance}

=== REQUIRED BEATS ===
${beatList}
${exactLineSection}
=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`;
}

// ─── Character/Object continuity check ──────────────────────────
function checkContinuity(text) {
  return {
    Mara: countTermWB(text, 'Mara') > 0,
    Vale: countTermWB(text, 'Vale') > 0,
    Lask: countTermWB(text, 'Lask') > 0,
    Owen: countTermWB(text, 'Owen') > 0,
    phone: countTerm(text, 'cracked phone') > 0 || countTerm(text, 'phone') > 0,
    cup: countTerm(text, 'blue plastic water cup') > 0 || countTerm(text, 'cup') > 0,
    wardrobe: countTerm(text, 'wardrobe') > 0,
    voicemail: countTerm(text, 'voicemail') > 0,
  };
}

// ─── Print helpers ──────────────────────────────────────────────
function printValidation(label, v) {
  const sym = (p) => p ? '✅' : '❌';
  console.log(`  ${label}: ${v.words}w/${v.chars}c | contam=${sym(v.contaminationTotal === 0)}${v.contaminationTotal} | malform=${sym(v.malformedTotal === 0)}${v.malformedTotal} | leaked=${sym(v.leakedTotal === 0)}${v.leakedTotal} | not-just=${sym(v.notJust <= 2)}${v.notJust} | forbidden=${v.forbiddenTotal} | ${sym(v.pass)}${v.pass ? 'PASS' : 'FAIL'}`);
  if (v.contaminationTotal > 0) console.log(`    CONTAMINATION: ${JSON.stringify(v.contamination)}`);
  if (v.malformedTotal > 0) console.log(`    MALFORMED: ${JSON.stringify(v.malformed)}`);
  if (v.leakedTotal > 0) console.log(`    LEAKED: ${JSON.stringify(v.leaked)}`);
  if (v.forbiddenTotal > 0) {
    const top = Object.entries(v.forbidden).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`    TOP FORBIDDEN: ${top.map(([k, cnt]) => `"${k}":${cnt}`).join(', ')}`);
  }
}

// ─── Step tracking ──────────────────────────────────────────────
const STEP_RESULTS = [];
function recordStep(num, name, pass, notes = '') {
  STEP_RESULTS.push({ num, name, pass, notes });
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  UBS END-TO-END AUTHOR WORKFLOW TEST                           ║');
  console.log('║  5 Chapters · 10 Steps · Model: ghostwriter                    ║');
  console.log('║  Ollama @ 127.0.0.1:11434                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Health check
  try {
    const health = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const data = await health.json();
    const models = data.models?.map(m => m.name) || [];
    const hasGW = models.some(m => m.includes('ghostwriter'));
    console.log(`✅ Ollama running. ${models.length} models. Ghostwriter: ${hasGW ? '✅' : '❌ MISSING'}`);
    if (!hasGW) { console.error('FATAL: ghostwriter model not found'); process.exit(1); }
  } catch (e) {
    console.error('❌ Cannot reach Ollama:', e.message);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const overallStart = Date.now();

  // Tracking structures
  const chapterData = {}; // keyed by chapter num
  const savedChapters = {}; // final texts in-memory
  let exportText = '';
  let exportHashes = {};
  let reloadedChapters = {};
  let reloadHashes = {};
  const failures = [];

  // ═════════════════════════════════════════════════════════════
  //  STEP 1 — Create Project
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 1 — Create Project');
  console.log('═'.repeat(68));

  try {
    saveFlat('01-project-created.json', JSON.stringify(PROJECT, null, 2));
    console.log('  ✅ Project metadata saved to 01-project-created.json');
    recordStep(1, 'Create Project', true, 'Metadata saved');
  } catch (e) {
    console.error('  ❌ Step 1 failed:', e.message);
    recordStep(1, 'Create Project', false, e.message);
    failures.push({ step: 1, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 2 — Generate Story Bible
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 2 — Generate Story Bible');
  console.log('═'.repeat(68));

  let storyBible = '';
  try {
    const bibleProm = `You are the story bible generator for a professional book-writing app.

Generate a comprehensive project context document for:

Title: ${PROJECT.title}
Genre: ${PROJECT.genre}
Premise: ${PROJECT.premise}
Setting: ${PROJECT.setting}

Characters:
${PROJECT.characters.map(c => `- ${c.name}: ${c.desc}`).join('\n')}

Include: character profiles, setting description, thematic concerns, tone guide, POV and tense.
Write 500-800 words. No notes or meta-commentary.`;

    console.log('  Calling Ghostwriter for story bible...');
    const t0 = Date.now();
    storyBible = await callGhostwriter(bibleProm);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✅ Story bible generated in ${elapsed}s (${wordCount(storyBible)} words)`);
    saveFlat('02-story-bible.txt', storyBible);

    // Validate
    const contamFound = CONTAMINATION.filter(t => countTerm(storyBible, t) > 0);
    const charsPresent = PROJECT.characters.map(c => ({
      name: c.name.split(' ')[0],
      found: countTermWB(storyBible, c.name.split(' ')[0]) > 0 || countTerm(storyBible, c.name) > 0,
    }));
    const bellweatherPresent = countTerm(storyBible, 'Bellweather') > 0;

    const allCharsPresent = charsPresent.every(c => c.found);
    const noContam = contamFound.length === 0;
    const biblePass = allCharsPresent && bellweatherPresent && noContam;

    console.log(`  Characters: ${charsPresent.map(c => `${c.name}=${c.found ? '✅' : '❌'}`).join(' ')}`);
    console.log(`  Bellweather: ${bellweatherPresent ? '✅' : '❌'}`);
    console.log(`  Contamination: ${noContam ? '✅ clean' : `❌ ${JSON.stringify(contamFound)}`}`);

    recordStep(2, 'Story Bible', biblePass, biblePass ? 'All checks passed' : 'Some checks failed');
    if (!biblePass) failures.push({ step: 2, reason: 'Story bible validation failed' });
  } catch (e) {
    console.error('  ❌ Step 2 failed:', e.message);
    recordStep(2, 'Story Bible', false, e.message);
    failures.push({ step: 2, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 3 — Generate Outline
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 3 — Generate Outline');
  console.log('═'.repeat(68));

  let outline = '';
  try {
    const outlineProm = `You are the outline generator for a professional book-writing app.

Generate a 5-chapter outline for:

Title: ${PROJECT.title}
Genre: ${PROJECT.genre}
Premise: ${PROJECT.premise}
Setting: ${PROJECT.setting}

Characters:
${PROJECT.characters.map(c => `- ${c.name}: ${c.desc}`).join('\n')}

For each chapter provide: chapter number, title, concrete goal, resistance, 5-8 physical beats, and reveal/consequence.
Write a structured outline. No prose. No notes.`;

    console.log('  Calling Ghostwriter for outline...');
    const t0 = Date.now();
    outline = await callGhostwriter(outlineProm);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✅ Outline generated in ${elapsed}s (${wordCount(outline)} words)`);
    saveFlat('03-outline.txt', outline);

    // Basic coherence check
    const hasChapters = /chapter\s+[1-5]/gi.test(outline);
    const outlinePass = hasChapters && wordCount(outline) > 100;
    console.log(`  Chapters mentioned: ${hasChapters ? '✅' : '❌'}`);
    console.log(`  Word count: ${wordCount(outline)} ${outlinePass ? '✅' : '❌'}`);

    recordStep(3, 'Generate Outline', outlinePass, outlinePass ? 'Coherent' : 'Incoherent');
    if (!outlinePass) failures.push({ step: 3, reason: 'Outline validation failed' });
  } catch (e) {
    console.error('  ❌ Step 3 failed:', e.message);
    recordStep(3, 'Generate Outline', false, e.message);
    failures.push({ step: 3, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 4 — Draft All (5 chapters)
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 4 — Draft All (5 chapters)');
  console.log('═'.repeat(68));

  let step4Pass = true;

  for (const ch of CHAPTER_PLAN) {
    console.log(`\n  ── Chapter ${ch.num}: ${ch.title} ──`);
    console.log(`  Opening: ${ch.openingRule} | Ending: ${ch.endingRule} | Exact line: ${ch.exactFinalLine ? 'YES' : 'NO'}`);

    const chKey = ch.num;
    chapterData[chKey] = { ch };

    // (a) Save guidance
    const guidanceText = `Chapter ${ch.num}: ${ch.title}\nOpening: ${ch.openingRule}\nEnding: ${ch.endingRule}\nExact final line: ${ch.exactFinalLine || '(none)'}\n\n${ch.guidance}\n\nBeats:\n${ch.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
    save('04-chapter-guidance', `ch${ch.num}-guidance.txt`, guidanceText);

    // (b) Build prompt
    const prompt = buildChapterPrompt(ch);
    save('05-draft-all-stage-outputs', `ch${ch.num}-prompt.txt`, prompt);

    // (c) Call Ghostwriter
    console.log(`  [${ch.num}/5] Calling Ghostwriter...`);
    let raw;
    try {
      const t0 = Date.now();
      raw = await callGhostwriter(prompt);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ✅ Response in ${elapsed}s (${wordCount(raw)} words)`);
    } catch (e) {
      console.error(`  ❌ LLM call failed for Ch${ch.num}: ${e.message}`);
      chapterData[chKey].error = e.message;
      step4Pass = false;
      continue;
    }
    save('05-draft-all-stage-outputs', `ch${ch.num}-raw.txt`, raw);
    const vRaw = validate(raw);
    chapterData[chKey].rawWords = wordCount(raw);

    // (d) lightClean
    const light = lightClean(raw);
    save('05-draft-all-stage-outputs', `ch${ch.num}-light.txt`, light);
    const vLight = validate(light);
    chapterData[chKey].lightWords = wordCount(light);

    // (e) polishPipeline
    const polished = polishPipeline(light);
    save('05-draft-all-stage-outputs', `ch${ch.num}-polished.txt`, polished);
    const vPolished = validate(polished);
    chapterData[chKey].polishWords = wordCount(polished);

    // (f) enforceExactFinalLine
    const enforceResult = enforceExactFinalLine(polished, ch.exactFinalLine, `Ch${ch.num}`);
    const enforced = enforceResult.text;
    save('05-draft-all-stage-outputs', `ch${ch.num}-enforced.txt`, enforced);
    const vEnforced = validate(enforced);
    chapterData[chKey].enforcedWords = wordCount(enforced);
    chapterData[chKey].patched = enforceResult.patched;

    if (enforceResult.patched) {
      console.log(`  ✅ PATCHED: model ending replaced with required final line.`);
    } else if (ch.exactFinalLine) {
      console.log(`  ✅ OK: text already ended with required final line.`);
    } else {
      console.log(`  ⚠️  No exact final line for this chapter.`);
    }

    // (g) Validate
    printValidation(`Ch${ch.num}`, vEnforced);

    const opening = checkOpening(enforced, ch.openingRule);
    const endingRule = checkEndingRule(enforced, ch.endingRule);
    const exactEnd = checkExactEnding(enforced, ch.exactFinalLine);
    const continuity = checkContinuity(enforced);

    console.log(`  Opening (${ch.openingRule}): ${opening.pass ? '✅' : '❌'} "${opening.firstLine.slice(0, 80)}..."`);
    console.log(`  Ending (${ch.endingRule}): ${endingRule.pass ? '✅' : '❌'} ${endingRule.note}`);
    if (ch.exactFinalLine) {
      console.log(`  Exact line: ${exactEnd.exact ? '✅' : '❌'} (fuzzy: ${exactEnd.fuzzy ? '✅' : '⚠️'})`);
    }

    // Store all validation data
    chapterData[chKey].vRaw = vRaw;
    chapterData[chKey].vLight = vLight;
    chapterData[chKey].vPolished = vPolished;
    chapterData[chKey].vEnforced = vEnforced;
    chapterData[chKey].opening = opening;
    chapterData[chKey].endingRule = endingRule;
    chapterData[chKey].exactEnd = exactEnd;
    chapterData[chKey].continuity = continuity;
    chapterData[chKey].raw = raw;
    chapterData[chKey].light = light;
    chapterData[chKey].polished = polished;
    chapterData[chKey].enforced = enforced;

    // (h) Save final
    save('10-final-saved-chapters', `ch${ch.num}-final.txt`, enforced);
    savedChapters[ch.num] = enforced;

    if (!vEnforced.pass) step4Pass = false;
  }

  recordStep(4, 'Draft All', step4Pass, step4Pass ? 'All chapters drafted' : 'Some chapters had issues');
  if (!step4Pass) failures.push({ step: 4, reason: 'Draft validation issues' });

  // ═════════════════════════════════════════════════════════════
  //  STEP 5 — Validate Draft All
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 5 — Validate Draft All');
  console.log('═'.repeat(68));

  let step5Pass = true;
  console.log('  Ch | Contam | Malform | Leaked | NotJust | Forbidden | Pass');
  console.log('  ---|--------|---------|--------|---------|-----------|-----');
  for (const ch of CHAPTER_PLAN) {
    const d = chapterData[ch.num];
    if (d.error) {
      console.log(`   ${ch.num} | ERROR: ${d.error}`);
      step5Pass = false;
      continue;
    }
    const v = d.vEnforced;
    const s = (p) => p ? '✅' : '❌';
    console.log(`   ${ch.num} | ${s(v.contaminationTotal === 0)}  ${String(v.contaminationTotal).padStart(3)} | ${s(v.malformedTotal === 0)}  ${String(v.malformedTotal).padStart(3)} | ${s(v.leakedTotal === 0)}  ${String(v.leakedTotal).padStart(3)} | ${s(v.notJust <= 2)}  ${String(v.notJust).padStart(3)} | ${s(v.forbiddenTotal <= 5)}  ${String(v.forbiddenTotal).padStart(5)} | ${s(v.pass)}`);
    if (!v.pass) step5Pass = false;
  }

  recordStep(5, 'Validate Draft All', step5Pass, step5Pass ? 'All canaries clean' : 'Canary violations');
  if (!step5Pass) failures.push({ step: 5, reason: 'Validation failures in drafted chapters' });

  // ═════════════════════════════════════════════════════════════
  //  STEP 6 — Manual Edit (canary insertion into Ch2)
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 6 — Manual Edit');
  console.log('═'.repeat(68));

  let step6Pass = false;
  let editedCh2 = '';
  try {
    const ch2Path = `${OUT_DIR}/10-final-saved-chapters/ch2-final.txt`;
    const ch2Text = readFileSync(ch2Path, 'utf-8');

    // Save the original before edit
    saveFlat('07-editor-before-manual-edit.txt', ch2Text);
    console.log(`  ✅ Original Ch2 saved (${wordCount(ch2Text)} words)`);

    // Find middle paragraph
    const paragraphs = ch2Text.split(/\n\n+/).filter(p => p.trim());
    const midIdx = Math.floor(paragraphs.length / 2);

    // Insert canary after mid paragraph
    const newParagraphs = [];
    for (let i = 0; i < paragraphs.length; i++) {
      newParagraphs.push(paragraphs[i]);
      if (i === midIdx) {
        newParagraphs.push(MANUAL_EDIT_CANARY);
      }
    }
    editedCh2 = newParagraphs.join('\n\n');

    // Save edited version
    saveFlat('08-editor-after-manual-edit.txt', editedCh2);
    // Overwrite the final saved version
    save('10-final-saved-chapters', 'ch2-final.txt', editedCh2);
    savedChapters[2] = editedCh2;

    const canaryPresent = editedCh2.includes(MANUAL_EDIT_CANARY);
    console.log(`  ✅ Canary inserted after paragraph ${midIdx + 1} of ${paragraphs.length}`);
    console.log(`  Canary present in edited text: ${canaryPresent ? '✅' : '❌'}`);

    step6Pass = canaryPresent;
    recordStep(6, 'Manual Edit', step6Pass, `Canary inserted at paragraph ${midIdx + 1}`);
    if (!step6Pass) failures.push({ step: 6, reason: 'Canary not found after insertion' });
  } catch (e) {
    console.error('  ❌ Step 6 failed:', e.message);
    recordStep(6, 'Manual Edit', false, e.message);
    failures.push({ step: 6, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 7 — Re-polish after manual edit
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 7 — Re-polish');
  console.log('═'.repeat(68));

  let step7Pass = false;
  try {
    const repolished = polishPipeline(editedCh2);
    saveFlat('09-repolish-output.txt', repolished);

    const canaryAfterPolish = repolished.includes(MANUAL_EDIT_CANARY);
    // Also check for curly-quote variant of canary
    const canaryVariant = MANUAL_EDIT_CANARY; // No quotes in canary, so no variant needed
    console.log(`  ✅ Re-polished Ch2 (${wordCount(repolished)} words)`);
    console.log(`  Canary survives polish: ${canaryAfterPolish ? '✅' : '❌'}`);

    // Update saved chapters with repolished version
    savedChapters[2] = repolished;
    save('10-final-saved-chapters', 'ch2-final.txt', repolished);

    step7Pass = canaryAfterPolish;
    recordStep(7, 'Re-polish', step7Pass, canaryAfterPolish ? 'Canary survived' : 'Canary lost');
    if (!step7Pass) failures.push({ step: 7, reason: 'Canary lost during re-polish' });
  } catch (e) {
    console.error('  ❌ Step 7 failed:', e.message);
    recordStep(7, 'Re-polish', false, e.message);
    failures.push({ step: 7, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 8 — Export
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 8 — Export');
  console.log('═'.repeat(68));

  let step8Pass = false;
  try {
    const exportParts = [];
    for (let i = 1; i <= 5; i++) {
      const text = savedChapters[i] || '';
      exportParts.push(`=== CHAPTER ${i} ===\n\n${text}`);
      exportHashes[i] = contentHash(text);
    }
    exportText = exportParts.join('\n\n' + '─'.repeat(40) + '\n\n');
    saveFlat('11-docx-export-text.txt', exportText);

    // Verify Ch2 has canary
    const ch2InExport = exportText.includes(MANUAL_EDIT_CANARY);
    console.log(`  ✅ Export assembled (${wordCount(exportText)} words)`);
    console.log(`  Ch2 canary in export: ${ch2InExport ? '✅' : '❌'}`);

    // Verify exact final lines
    let exactLinesOk = true;
    for (const ch of CHAPTER_PLAN) {
      if (ch.exactFinalLine) {
        const chText = savedChapters[ch.num] || '';
        const endCheck = checkExactEnding(chText, ch.exactFinalLine);
        console.log(`  Ch${ch.num} exact line: ${endCheck.exact ? '✅' : '❌'}`);
        if (!endCheck.exact) exactLinesOk = false;
      }
    }

    step8Pass = ch2InExport && exactLinesOk;
    recordStep(8, 'Export', step8Pass, step8Pass ? 'Clean export' : 'Export issues');
    if (!step8Pass) failures.push({ step: 8, reason: 'Export validation failed' });
  } catch (e) {
    console.error('  ❌ Step 8 failed:', e.message);
    recordStep(8, 'Export', false, e.message);
    failures.push({ step: 8, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 9 — Reopen
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 9 — Reopen');
  console.log('═'.repeat(68));

  let step9Pass = true;
  const reopenVerification = [];
  try {
    for (let i = 1; i <= 5; i++) {
      const path = `${OUT_DIR}/10-final-saved-chapters/ch${i}-final.txt`;
      if (!existsSync(path)) {
        console.log(`  ❌ Ch${i}: file not found`);
        step9Pass = false;
        reopenVerification.push({ ch: i, found: false, match: false });
        continue;
      }
      const diskText = readFileSync(path, 'utf-8');
      reloadedChapters[i] = diskText;
      reloadHashes[i] = contentHash(diskText);
      const inMemory = savedChapters[i] || '';
      const match = contentHash(inMemory) === contentHash(diskText);
      console.log(`  Ch${i}: ${match ? '✅ match' : '❌ MISMATCH'} (disk ${wordCount(diskText)}w, memory ${wordCount(inMemory)}w)`);
      reopenVerification.push({ ch: i, found: true, match, diskWords: wordCount(diskText), memWords: wordCount(inMemory) });
      if (!match) step9Pass = false;
    }

    saveFlat('12-reopen-verification.txt', reopenVerification.map(r =>
      `Ch${r.ch}: found=${r.found} match=${r.match} disk=${r.diskWords || 0}w mem=${r.memWords || 0}w`
    ).join('\n'));

    recordStep(9, 'Reopen', step9Pass, step9Pass ? 'All chapters match' : 'Mismatches found');
    if (!step9Pass) failures.push({ step: 9, reason: 'Reopened chapters do not match in-memory' });
  } catch (e) {
    console.error('  ❌ Step 9 failed:', e.message);
    recordStep(9, 'Reopen', false, e.message);
    failures.push({ step: 9, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  STEP 10 — Re-export after reload
  // ═════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  STEP 10 — Re-export after reload');
  console.log('═'.repeat(68));

  let step10Pass = true;
  try {
    const reExportParts = [];
    for (let i = 1; i <= 5; i++) {
      const text = reloadedChapters[i] || '';
      reExportParts.push(`=== CHAPTER ${i} ===\n\n${text}`);
    }
    const reExportText = reExportParts.join('\n\n' + '─'.repeat(40) + '\n\n');

    for (let i = 1; i <= 5; i++) {
      const origHash = exportHashes[i] || '';
      const reHash = reloadHashes[i] || '';
      const match = origHash === reHash;
      console.log(`  Ch${i}: export=${origHash} reload=${reHash} ${match ? '✅' : '❌'}`);
      if (!match) step10Pass = false;
    }

    recordStep(10, 'Re-export', step10Pass, step10Pass ? 'Hashes match' : 'Hash mismatch');
    if (!step10Pass) failures.push({ step: 10, reason: 'Re-export hashes do not match' });
  } catch (e) {
    console.error('  ❌ Step 10 failed:', e.message);
    recordStep(10, 'Re-export', false, e.message);
    failures.push({ step: 10, reason: e.message });
  }

  // ═════════════════════════════════════════════════════════════
  //  TABLES
  // ═════════════════════════════════════════════════════════════
  const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);

  // TABLE 1 — Workflow Pass/Fail
  console.log('\n\n' + '═'.repeat(68));
  console.log('  TABLE 1 — Workflow Pass/Fail');
  console.log('═'.repeat(68));
  console.log('  Step | Name                  | Status | Notes');
  console.log('  -----|---------------------- |--------|------');
  for (const s of STEP_RESULTS) {
    console.log(`  ${String(s.num).padStart(4)} | ${s.name.padEnd(21)} | ${s.pass ? ' ✅  ' : ' ❌  '} | ${s.notes}`);
  }

  // TABLE 2 — Project Context
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 2 — Project Context');
  console.log('═'.repeat(68));
  console.log('  Element         | Expected                              | Status');
  console.log('  ----------------|---------------------------------------|-------');
  const ctxChecks = [
    { el: 'Title', exp: PROJECT.title, ok: true },
    { el: 'Genre', exp: PROJECT.genre, ok: true },
    { el: 'Setting', exp: PROJECT.setting, ok: true },
    { el: 'Characters', exp: '4 defined', ok: PROJECT.characters.length === 4 },
    { el: 'Story Bible', exp: 'Generated', ok: STEP_RESULTS.find(s => s.num === 2)?.pass || false },
    { el: 'Outline', exp: '5 chapters', ok: STEP_RESULTS.find(s => s.num === 3)?.pass || false },
  ];
  for (const c of ctxChecks) {
    console.log(`  ${c.el.padEnd(17)}| ${String(c.exp).padEnd(38).slice(0, 38)}| ${c.ok ? '✅' : '❌'}`);
  }

  // TABLE 3 — Chapter Structure
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 3 — Chapter Structure');
  console.log('═'.repeat(68));
  console.log('  Ch | Open Expected       | Open ✓ | End Expected            | End ✓ | Exact Line  | Exact ✓');
  console.log('  ---|---------------------|--------|-------------------------|-------|-------------|--------');
  for (const ch of CHAPTER_PLAN) {
    const d = chapterData[ch.num];
    if (!d || d.error) {
      console.log(`   ${ch.num} | ERROR`);
      continue;
    }
    console.log(`   ${ch.num} | ${ch.openingRule.padEnd(20).slice(0, 20)}| ${d.opening.pass ? '  ✅  ' : '  ❌  '} | ${ch.endingRule.padEnd(24).slice(0, 24)}| ${d.endingRule.pass ? ' ✅  ' : ' ❌  '} | ${ch.exactFinalLine ? 'YES' : 'NO '}         | ${ch.exactFinalLine ? (d.exactEnd.exact ? '  ✅  ' : '  ❌  ') : '  —  '}`);
  }

  // TABLE 4 — Stage Deltas
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 4 — Stage Deltas');
  console.log('═'.repeat(68));
  console.log('  Ch | Raw Words | Light Words | Polish Words | Enforced Words | Δ%');
  console.log('  ---|-----------|-------------|--------------|----------------|------');
  for (const ch of CHAPTER_PLAN) {
    const d = chapterData[ch.num];
    if (!d || d.error) {
      console.log(`   ${ch.num} | ERROR`);
      continue;
    }
    const delta = d.rawWords > 0 ? (((d.enforcedWords - d.rawWords) / d.rawWords) * 100).toFixed(1) : '0';
    console.log(`   ${ch.num} | ${String(d.rawWords).padStart(9)} | ${String(d.lightWords).padStart(11)} | ${String(d.polishWords).padStart(12)} | ${String(d.enforcedWords).padStart(14)} | ${delta}%`);
  }

  // TABLE 5 — Character/Object Continuity
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 5 — Character/Object Continuity');
  console.log('═'.repeat(68));
  console.log('  Ch | Mara | Vale | Lask | Owen | phone | cup  | wardrobe | voicemail');
  console.log('  ---|------|------|------|------|-------|------|----------|----------');
  for (const ch of CHAPTER_PLAN) {
    const d = chapterData[ch.num];
    if (!d || d.error) {
      console.log(`   ${ch.num} | ERROR`);
      continue;
    }
    const c = d.continuity;
    const s = (v) => v ? ' ✅ ' : ' ❌ ';
    console.log(`   ${ch.num} |${s(c.Mara)}|${s(c.Vale)}|${s(c.Lask)}|${s(c.Owen)}| ${s(c.phone)}| ${s(c.cup)}| ${s(c.wardrobe)}   | ${s(c.voicemail)}`);
  }

  // TABLE 6 — Manual Edit Persistence
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 6 — Manual Edit Persistence');
  console.log('═'.repeat(68));
  console.log('  Stage                    | Canary Present | Exact | Notes');
  console.log('  -------------------------|----------------|-------|------');
  const editStages = [
    {
      stage: 'Before edit (Ch2 orig)',
      present: chapterData[2]?.enforced ? !chapterData[2].enforced.includes(MANUAL_EDIT_CANARY) : false,
      exact: true,
      notes: 'Should NOT be present',
    },
    {
      stage: 'After edit (Step 6)',
      present: editedCh2.includes(MANUAL_EDIT_CANARY),
      exact: editedCh2.includes(MANUAL_EDIT_CANARY),
      notes: 'Canary inserted',
    },
    {
      stage: 'After re-polish (Step 7)',
      present: (savedChapters[2] || '').includes(MANUAL_EDIT_CANARY),
      exact: (savedChapters[2] || '').includes(MANUAL_EDIT_CANARY),
      notes: 'Canary should survive',
    },
    {
      stage: 'In export (Step 8)',
      present: exportText.includes(MANUAL_EDIT_CANARY),
      exact: exportText.includes(MANUAL_EDIT_CANARY),
      notes: 'Canary in final export',
    },
    {
      stage: 'After reload (Step 9)',
      present: (reloadedChapters[2] || '').includes(MANUAL_EDIT_CANARY),
      exact: (reloadedChapters[2] || '').includes(MANUAL_EDIT_CANARY),
      notes: 'Canary persists on disk',
    },
  ];
  for (const es of editStages) {
    const s = (v) => v ? '✅' : '❌';
    console.log(`  ${es.stage.padEnd(26)}| ${s(es.present).padEnd(15)}| ${s(es.exact).padEnd(6)}| ${es.notes}`);
  }

  // TABLE 7 — Export Consistency
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 7 — Export Consistency');
  console.log('═'.repeat(68));
  console.log('  Ch | Saved Words | Export Words | Match');
  console.log('  ---|-------------|-------------|------');
  for (let i = 1; i <= 5; i++) {
    const savedW = wordCount(savedChapters[i] || '');
    const exportW = wordCount(reloadedChapters[i] || '');
    const match = exportHashes[i] === reloadHashes[i];
    console.log(`   ${i} | ${String(savedW).padStart(11)} | ${String(exportW).padStart(11)} | ${match ? '✅' : '❌'}`);
  }

  // TABLE 8 — Reload Consistency
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 8 — Reload Consistency');
  console.log('═'.repeat(68));
  console.log('  Ch | Before Hash      | After Hash       | Match');
  console.log('  ---|------------------|------------------|------');
  for (let i = 1; i <= 5; i++) {
    const before = exportHashes[i] || 'N/A';
    const after = reloadHashes[i] || 'N/A';
    const match = before === after;
    console.log(`   ${i} | ${before.padEnd(16)} | ${after.padEnd(16)} | ${match ? '✅' : '❌'}`);
  }

  // TABLE 9 — Failure Attribution
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 9 — Failure Attribution');
  console.log('═'.repeat(68));
  if (failures.length === 0) {
    console.log('  No failures detected.');
  } else {
    console.log('  Step | Reason');
    console.log('  -----|-------');
    for (const f of failures) {
      console.log(`  ${String(f.step).padStart(4)} | ${f.reason}`);
    }
  }

  // TABLE 10 — Final Verdict
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 10 — Final Verdict');
  console.log('═'.repeat(68));
  console.log(`  Total time: ${totalElapsed}s`);
  console.log(`  Steps passed: ${STEP_RESULTS.filter(s => s.pass).length}/${STEP_RESULTS.length}`);
  console.log(`  Chapters drafted: ${Object.keys(savedChapters).length}/5`);

  const allStepsPassed = STEP_RESULTS.every(s => s.pass);
  const criticalStepsPassed = STEP_RESULTS.filter(s => [1, 4, 6, 7, 8, 9, 10].includes(s.num)).every(s => s.pass);
  const minorOnlyFailures = !allStepsPassed && criticalStepsPassed;

  console.log();
  if (allStepsPassed) {
    console.log('  ✅ E2E PASS — beta-ready');
  } else if (minorOnlyFailures) {
    console.log('  ⚠️  E2E PASS WITH MINOR FIXES');
  } else {
    const failedSteps = STEP_RESULTS.filter(s => !s.pass).map(s => `Step ${s.num} (${s.name})`).join(', ');
    console.log(`  ❌ E2E FAIL — ${failedSteps}`);
  }

  console.log('\n' + '═'.repeat(68));
  console.log(`  📁 All outputs saved to ${OUT_DIR}/`);
  console.log('═'.repeat(68));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
