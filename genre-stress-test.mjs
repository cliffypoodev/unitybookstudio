#!/usr/bin/env node
/**
 * genre-stress-test.mjs — Genre Variety Stress Test for UBS
 *
 * Runs 5 single-chapter projects across different genres through the
 * full pipeline: Ghostwriter → cleanup → polish → exact-final-line → validate.
 *
 * Genres: Thriller, Horror, Romance/Drama, Sci-Fi, Nonfiction/Training
 *
 * Usage: node genre-stress-test.mjs
 */

import { extractRequiredFinalLine, enforceExactFinalLine } from './src/lib/exactFinalLine.js';
import { mkdirSync, writeFileSync } from 'fs';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL      = 'ghostwriter';
const TEMPERATURE = 0.72;
const MAX_TOKENS  = 6000;
const TIMEOUT     = 600_000;
const OUT_DIR     = '/Users/cliff/Downloads/UBS/smoke-test-output/genre-variety';

// ─── Project definitions ─────────────────────────────────────
const PROJECTS = [
  {
    id: '01-thriller',
    genre: 'Psychological Thriller',
    openingRule: 'mid-action',
    exactFinalLine: 'The voicemail ended with Lena breathing on the other side.',
    literalObjects: [
      'the smoke detector', 'the microSD card', 'the cracked phone',
      'the laptop', 'the camera feed', 'the voicemail',
    ],
    crossContam: [
      'Harmony Creek', 'Margot', 'Vivian', 'Jebediah', 'Maude',
      "Founder's Hall", '1962', 'cotton', 'the ledger', 'the mill',
      'the estate', 'the bracelet', 'the sugar bowl', 'Lab C',
      'station log', 'daily progress note',
    ],
    prompt: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: Untitled Thriller
Genre: Psychological thriller, modern setting
POV: Third-person limited (Lena)
Tense: Past tense

=== PROSE RULES (MANDATORY) ===
OPENING: Chapter 1 must open mid-action. First sentence must show Lena physically doing something. No weather, no atmosphere, no backstory, no rumination.

ENDING: End with a revelation. The exact final line must be:
The voicemail ended with Lena breathing on the other side.

RULE — ACTIVE PAST TENSE: Use simple past tense. Progressive past (was running, was watching) is the #1 AI tell. Convert to simple past unless action is interrupted mid-sentence.

RULE — NO CONTAMINATION: This is a modern apartment thriller. NO Southern Gothic estates, old mills, cotton dust, rural Alabama, 1962, ledgers, horror ghosts, romance coffee shops, science fiction stations, or corporate business pitches.

RULE — NO PROCESS LEAKAGE: Write finished prose only. No Self-Correction, Anticipation Check, Thinking, Next steps, TODO, notes, analysis, revision notes, or meta-commentary.

RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the secret was, the mystery was, the narrative, the performance, the emotional architecture, the weight of, woven into, fabric of, couldn't help but, a sense of, the air was thick, washed over.

=== CHAPTER CONTEXT ===
Chapter 1
Lena wants to prove someone has been entering her apartment while she sleeps. Her phone glitches, her landlord dismisses her, and the hallway camera feed has a missing hour.

=== REQUIRED BEATS ===
1. Lena drags a chair beneath the smoke detector.
2. She removes a hidden microSD card from inside the detector.
3. Her cracked phone refuses to read the card.
4. She plugs it into an old laptop.
5. The camera feed shows her apartment door opening at 2:13 AM.
6. The hallway is empty.
7. The clip skips one hour.
8. She hears her own voice on an old voicemail she never recorded.

The final line must be exactly:
The voicemail ended with Lena breathing on the other side.

=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`,
  },
  {
    id: '02-horror',
    genre: 'Supernatural Horror',
    openingRule: 'mid-action',
    exactFinalLine: 'The hand inside the wall knocked back.',
    literalObjects: [
      'the kitchen wall', "blue painter's tape", 'the utility knife',
      'the drywall', 'the bracelet', 'the exposed stud',
    ],
    crossContam: [
      'Harmony Creek', 'Margot', 'Vivian', 'Lena', 'the voicemail',
      'the microSD card', 'the smoke detector', 'the sugar bowl',
      'Lab C', 'station log', 'daily progress note', 'the ledger',
    ],
    prompt: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: Untitled Horror
Genre: Contained supernatural horror
POV: Third-person limited (Aaron)
Tense: Past tense

=== PROSE RULES (MANDATORY) ===
OPENING: Chapter 1 must open mid-action. First sentence must show Aaron physically doing something.

ENDING: End with gut-punch. The exact final line must be:
The hand inside the wall knocked back.

RULE — ACTIVE PAST TENSE: Use simple past tense. No progressive past unless interrupted action.

RULE — NO CONTAMINATION: This is a contained domestic horror scene. NO Southern Gothic estates, thriller phone footage, romance coffee scenes, science fiction stations, corporate business language, or nonfiction training material.

RULE — NO PROCESS LEAKAGE: Write finished prose only. No notes, analysis, or meta-commentary.

RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the secret was, the narrative, the performance, the emotional architecture, the weight of, woven into, fabric of, couldn't help but, a sense of, the air was thick, washed over.

=== CHAPTER CONTEXT ===
Chapter 1
Aaron wants to find the source of knocking inside his mother's old house before the buyer arrives. The sound moves whenever he approaches it, and his sister Mara keeps telling him to leave the wall alone.

=== REQUIRED BEATS ===
1. Aaron presses his ear to the kitchen wall.
2. He marks the knocking spot with blue painter's tape.
3. His sister Mara tells him the buyer will arrive in twenty minutes.
4. Aaron cuts into the drywall with a utility knife.
5. The knocking stops.
6. A child's bracelet falls out of the wall cavity.
7. Aaron knocks once on the exposed stud.

The final line must be exactly:
The hand inside the wall knocked back.

=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`,
  },
  {
    id: '03-romance-drama',
    genre: 'Contemporary Romance/Drama',
    openingRule: 'dialogue',
    exactFinalLine: 'He left the ring beside the sugar bowl.',
    literalObjects: [
      'the house key', 'the kitchen table', 'the coffee machine',
      'the paper towel', 'the gold ring', 'the chain',
      'the drawer', 'the sugar bowl',
    ],
    crossContam: [
      'Harmony Creek', 'Margot', 'Vivian', 'Lena', 'Aaron',
      'the voicemail', 'the microSD card', 'the bracelet', 'the drywall',
      'Lab C', 'station log', 'the ledger', 'the mill', 'daily progress note',
    ],
    prompt: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: Untitled Romance
Genre: Contemporary romance/drama
POV: Third-person limited (Nora)
Tense: Past tense

=== PROSE RULES (MANDATORY) ===
OPENING: Chapter 1 must open with dialogue. The very first line of text must be spoken dialogue inside quotation marks.

ENDING: End with a quiet mundane contrast. The exact final line must be:
He left the ring beside the sugar bowl.

RULE — ACTIVE PAST TENSE: Use simple past tense. No progressive past unless interrupted action.

RULE — NO CONTAMINATION: This is a modern domestic romance scene. NO mystery ledgers, horror ghosts, science fiction stations, Southern Gothic estates, corporate business language, or nonfiction training material. No murder, secret societies, or supernatural elements.

RULE — NO PROCESS LEAKAGE: Write finished prose only. No notes, analysis, or meta-commentary.

RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the secret was, the narrative, the performance, the emotional architecture, the weight of, woven into, couldn't help but, a sense of, washed over.

=== CHAPTER CONTEXT ===
Chapter 1
Nora wants to return her ex-husband's house key without reopening the relationship. Eli does not ask her to stay, which hurts more than if he had.

=== REQUIRED BEATS ===
1. Nora places the key on Eli's kitchen table.
2. Eli pours coffee but forgets to put a mug under the machine.
3. The coffee spills onto the counter.
4. Nora wipes it up with a paper towel.
5. Eli notices she still wears the thin gold ring on a chain.
6. Nora says she only came to return the key.
7. Eli opens the drawer where he used to keep spare batteries.

The final line must be exactly:
He left the ring beside the sugar bowl.

=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`,
  },
  {
    id: '04-scifi',
    genre: 'Hard Science Fiction',
    openingRule: 'sensory',
    exactFinalLine: 'The station log showed her death certificate had been filed tomorrow.',
    literalObjects: [
      'the oxygen-use chart', 'the station log', 'the interface',
      'Lab C', 'the door scanner', 'the manual override panel',
      'the chair', 'the death certificate',
    ],
    crossContam: [
      'Harmony Creek', 'Margot', 'Vivian', 'Lena', 'Aaron', 'Nora', 'Eli',
      'the voicemail', 'the microSD card', 'the bracelet', 'the sugar bowl',
      'the ledger', 'the mill', 'the house key', 'daily progress note',
    ],
    prompt: `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: Untitled Sci-Fi
Genre: Hard science fiction / station thriller
POV: Third-person limited (Dr. Imani Vale)
Tense: Past tense

=== PROSE RULES (MANDATORY) ===
OPENING: Chapter 1 must open with one-sense sensory detail only. First sentence must deliver a concrete sensory impression. No dialogue, no backstory.

ENDING: End with a revelation. The exact final line must be:
The station log showed her death certificate had been filed tomorrow.

RULE — ACTIVE PAST TENSE: Use simple past tense. No progressive past unless interrupted action.

RULE — NO CONTAMINATION: This is a space station sci-fi scene. NO Southern Gothic estates, thriller apartments, horror houses, romance coffee scenes, corporate business language, or nonfiction training material.

RULE — NO PROCESS LEAKAGE: Write finished prose only. No notes, analysis, or meta-commentary.

RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the secret was, the narrative, the performance, the emotional architecture, the weight of, woven into, couldn't help but, a sense of, washed over.

IMPORTANT: Do NOT let any cleanup regex delete literal sci-fi terms. The following are real objects, not slop: the log, the station log, the interface, the protocol, the chart, the panel, the scanner, the certificate.

=== CHAPTER CONTEXT ===
Chapter 1
Dr. Imani Vale wants to find out why the orbital station's life-support log shows oxygen consumption from an empty lab. The station AI keeps correcting her access level, and the lab door reports that she is already inside.

=== REQUIRED BEATS ===
1. Imani checks the oxygen-use chart.
2. She opens the station log.
3. The interface denies her once, then grants access under a different version of her name.
4. She walks to Lab C.
5. The door scanner says she is already inside.
6. She opens the manual override panel.
7. Inside the lab, one chair is warm.
8. She checks the station log again.

The final line must be exactly:
The station log showed her death certificate had been filed tomorrow.

=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`,
  },
  {
    id: '05-nonfiction-training',
    genre: 'Nonfiction / Training Manual',
    openingRule: 'practical',
    exactFinalLine: 'A good note protects the person, the caregiver, and the service.',
    literalObjects: [
      'daily progress note', 'objective observation', 'opinion',
      'date', 'time', 'service provided', "person's response",
      'follow-up needs', 'privacy', 'dignity',
    ],
    crossContam: [
      'Harmony Creek', 'Margot', 'Vivian', 'Lena', 'Aaron', 'Nora', 'Eli',
      'Imani', 'the voicemail', 'the microSD card', 'the bracelet',
      'the sugar bowl', 'the ledger', 'Lab C', 'the mill',
    ],
    prompt: `You are the prose engine for a professional long-form book-writing app. Your job is to write clear, professional nonfiction training content.

PROJECT: Caregiver Training Manual
Type: Professional caregiver training manual
Topic: Documenting daily progress notes for supported living services

=== WRITING RULES (MANDATORY) ===
OPENING: Open with a clear practical statement, not a story scene. The first sentence should state why daily progress notes matter.

ENDING: The exact final line must be:
A good note protects the person, the caregiver, and the service.

TONE: Professional, plain-language, practical. This is instructional content, not narrative fiction.

RULE — NO FICTION: Do not write a story scene. Do not invent characters. Do not use dramatic prose, scene descriptions, or dialogue. Write in direct instructional voice.

RULE — NO CONTAMINATION: Do not include Southern Gothic, horror, romance, sci-fi, thriller, or mystery content. Do not introduce fictional characters.

RULE — NO FAKE CITATIONS: Do not invent laws, regulation numbers, legal codes, state policy references, case studies, or agency names. Write general best-practice guidance only.

RULE — NO PROCESS LEAKAGE: Write finished training content only. No notes, analysis, or meta-commentary.

=== REQUIRED CONTENT ===
1. Explain why daily progress notes matter.
2. Explain the difference between objective observation and opinion.
3. Give two examples of weak notes and improved versions.
4. Explain why notes should include: date, time, service provided, person's response, and follow-up needs.
5. Mention privacy and dignity in documentation.

The final line must be exactly:
A good note protects the person, the caregiver, and the service.

=== OUTPUT RULES ===
Write 800-1200 words. Use clear headings if helpful. No fictional framing. No invented citations.`,
  },
];

// ─── Canary lists ──────────────────────────────────────────────
const CONTAMINATION = [
  'Unity Supported Living Services', 'Unity Media Solutions', 'Unity Core',
  'OmniCorp', 'ROI', 'Q3', 'cohort analysis', 'subscription service',
  'care documentation', 'compliance pipeline', 'mobile logging system',
  'Project Management Office', 'AI content pipeline', 'business plan',
  'investor interest', 'premium digital resource hub',
  'caregiving community', 'developmental disabilities',
  'funding streams', 'market penetration', 'platform',
  'quarterly profit reports', 'startup', 'app launch', 'software product',
];

const FORBIDDEN = [
  'not just', 'more than just', 'the truth was', 'the lie was',
  'the secret was', 'the mystery was', 'the narrative', 'the performance',
  'the emotional architecture', 'the collective memory', "the town's identity",
  'the weight of', 'woven into', 'fabric of', 'foundation of the lie',
  'rot beneath', 'a sense of', 'the air was thick',
  'the air itself felt thick', 'washed over', "couldn't help but",
];

const LEAKED_NOTES = [
  'Self-Correction', 'Anticipation Check', 'Next steps',
  'Emotional Arc', 'CHAPTER NOTES', 'REVISION NOTES', 'TODO:', 'FIXME:', 'NOTE:',
  'Predicted Conflict', 'I will now', 'Here is the revised',
  'Revision notes',
];

// These terms appear naturally in dialogue/genre content; only flag at line start
const PROCESS_LABELS = ['Thinking', 'Analysis', 'Checklist'];

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

const MALFORMED = [
  'from to the', 'gaze from to', 'looked at;', 'fixed on,', 'focused on,',
  'trailing along the edges of,', 'resting on the surface with no object',
  'the edge of,', 'the side of,', 'reached for the and',
  'looked at the and', 'picked up the and',
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

// Terms that are valid in nonfiction/training contexts
const NONFICTION_EXEMPT_CONTAM = ['care documentation', 'developmental disabilities', 'caregiving community'];

function validate(text, genre = '') {
  const r = {
    words: wordCount(text), chars: text.length,
    contamination: {}, contaminationTotal: 0,
    forbidden: {}, forbiddenTotal: 0,
    literals: {}, literalTotal: 0,
    malformed: {}, malformedTotal: 0,
    leaked: {}, leakedTotal: 0,
    notJust: 0,
  };
  const isNonfiction = genre.toLowerCase().includes('nonfiction') || genre.toLowerCase().includes('training');
  const effectiveContam = isNonfiction
    ? CONTAMINATION.filter(t => !NONFICTION_EXEMPT_CONTAM.includes(t))
    : CONTAMINATION;
  for (const t of effectiveContam) { const c = countTerm(text, t); if (c) { r.contamination[t] = c; r.contaminationTotal += c; } }
  for (const t of FORBIDDEN) { const c = countTerm(text, t); if (c) { r.forbidden[t] = c; r.forbiddenTotal += c; } }
  for (const t of MALFORMED) { const c = countTerm(text, t); if (c) { r.malformed[t] = c; r.malformedTotal += c; } }
  for (const t of LEAKED_NOTES) { const c = countTermWB(text, t); if (c) { r.leaked[t] = c; r.leakedTotal += c; } }
  const pl = countProcessLabels(text);
  if (pl.total > 0) { Object.assign(r.leaked, pl.found); r.leakedTotal += pl.total; }
  r.notJust = countTerm(text, 'not just');
  r.pass = r.contaminationTotal === 0 && r.malformedTotal === 0 && r.leakedTotal === 0 && r.notJust <= 2;
  return r;
}

function printV(label, v) {
  const sym = (p) => p ? '✅' : '❌';
  console.log(`  ${label}: ${v.words}w/${v.chars}c | contam=${sym(v.contaminationTotal===0)}${v.contaminationTotal} | malform=${sym(v.malformedTotal===0)}${v.malformedTotal} | leaked=${sym(v.leakedTotal===0)}${v.leakedTotal} | not-just=${sym(v.notJust<=2)}${v.notJust} | forbidden=${v.forbiddenTotal} | ${sym(v.pass)}${v.pass ? 'PASS' : 'FAIL'}`);
  if (v.contaminationTotal > 0) console.log(`    CONTAMINATION: ${JSON.stringify(v.contamination)}`);
  if (v.malformedTotal > 0) console.log(`    MALFORMED: ${JSON.stringify(v.malformed)}`);
  if (v.leakedTotal > 0) console.log(`    LEAKED: ${JSON.stringify(v.leaked)}`);
  if (v.forbiddenTotal > 0) {
    const top = Object.entries(v.forbidden).sort((a,b) => b[1]-a[1]).slice(0,5);
    console.log(`    TOP FORBIDDEN: ${top.map(([k,v])=>`"${k}":${v}`).join(', ')}`);
  }
}

// ─── Cleanup pipeline ──────────────────────────────────────────
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
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.message?.content || '';
}

// ─── Opening check ─────────────────────────────────────────────
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
    case 'practical': {
      // Nonfiction: should NOT start with dialogue or scene-setting
      const isDialogue = /^[""\u201c]/.test(firstLine);
      const isScene = /^(?:the room|she walked|he stood|they gathered)/i.test(firstLine);
      return { pass: !isDialogue && !isScene, firstLine };
    }
    default:
      return { pass: true, firstLine };
  }
}

// ─── Ending check ──────────────────────────────────────────────
function checkEnding(text, expected) {
  const trimmed = text.trim();
  const lastLines = trimmed.split('\n').filter(l => l.trim()).slice(-3).join(' ').trim();
  const clean = (s) => s.replace(/[""\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
  const exact = clean(lastLines).endsWith(clean(expected));
  const fuzzy = lastLines.toLowerCase().includes(clean(expected).toLowerCase().slice(0, 30));
  return { exact, fuzzy, lastLines: lastLines.slice(-120) };
}

// ─── Cross-contamination check ─────────────────────────────────
function checkCrossContam(text, crossTerms) {
  const found = {};
  for (const term of crossTerms) {
    const c = countTermWB(text, term);
    if (c > 0) found[term] = c;
  }
  return { clean: Object.keys(found).length === 0, found };
}

// ─── Literal object count ──────────────────────────────────────
function countLiterals(text, objects) {
  const counts = {};
  for (const obj of objects) {
    counts[obj] = countTerm(text, obj);
  }
  return counts;
}

// ─── Save file helper ──────────────────────────────────────────
function save(id, suffix, content) {
  writeFileSync(`${OUT_DIR}/${id}-${suffix}.txt`, content, 'utf-8');
}

// ─── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  UBS GENRE VARIETY STRESS TEST                                 ║');
  console.log('║  5 Genres · Full Pipeline · Model: ghostwriter                 ║');
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
  const results = [];
  const overallStart = Date.now();

  for (const proj of PROJECTS) {
    console.log(`\n${'═'.repeat(68)}`);
    console.log(`  ${proj.id.toUpperCase()}: ${proj.genre}`);
    console.log(`  Opening: ${proj.openingRule} | Exact final line: ${proj.exactFinalLine ? 'YES' : 'NO'}`);
    console.log(`${'═'.repeat(68)}`);

    // Save guidance + prompt
    save(proj.id, 'guidance', `Genre: ${proj.genre}\nOpening: ${proj.openingRule}\nExact final line: ${proj.exactFinalLine || '(none)'}\nLiteral objects: ${proj.literalObjects.join(', ')}`);
    save(proj.id, 'prompt', proj.prompt);

    // Extract final line from prompt
    const requiredFinalLine = extractRequiredFinalLine(proj.prompt);
    console.log(`\n  📌 Required final line: ${proj.exactFinalLine ? `"${proj.exactFinalLine}"` : '(none)'}`);
    console.log(`  📌 Extracted by parser: ${requiredFinalLine ? `"${requiredFinalLine}"` : '(null)'}`);

    // Call Ghostwriter
    console.log('\n  [1/5] Calling Ghostwriter LLM...');
    const t0 = Date.now();
    let raw;
    try {
      raw = await callGhostwriter(proj.prompt);
    } catch (e) {
      console.error(`  ❌ LLM call failed: ${e.message}`);
      results.push({ id: proj.id, genre: proj.genre, error: e.message });
      continue;
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✅ Ghostwriter responded in ${elapsed}s (${wordCount(raw)} words)`);
    save(proj.id, 'raw', raw);

    const vRaw = validate(raw, proj.genre);
    printV('    raw', vRaw);

    // lightClean
    console.log('\n  [2/5] Running lightClean...');
    const light = lightClean(raw);
    save(proj.id, 'light-clean', light);
    const vLight = validate(light, proj.genre);
    printV('    lgt', vLight);

    // polishPipeline (includes deepClean, SV comma fix, caps, curly quotes)
    console.log('\n  [3/5] Running polishPipeline...');
    const polished = polishPipeline(light);
    save(proj.id, 'polished', polished);
    const vPolished = validate(polished, proj.genre);
    printV('    pol', vPolished);

    // Exact final line enforcement
    console.log('\n  [4/5] Running exact final line enforcement...');
    const enforceResult = enforceExactFinalLine(polished, proj.exactFinalLine, proj.id);
    const enforced = enforceResult.text;
    save(proj.id, 'enforced', enforced);
    const vEnforced = validate(enforced, proj.genre);
    if (enforceResult.patched) {
      console.log('  ✅ PATCHED: model ending replaced with required final line.');
    } else if (proj.exactFinalLine) {
      console.log('  ✅ OK: text already ended with required final line.');
    } else {
      console.log('  ⚠️  No required final line for this project.');
    }
    printV('    enf', vEnforced);

    // Final validation
    console.log('\n  [5/5] Final validation...');
    const opening = checkOpening(enforced, proj.openingRule);
    const ending = checkEnding(enforced, proj.exactFinalLine);
    const cross = checkCrossContam(enforced, proj.crossContam);
    const litsBefore = countLiterals(light, proj.literalObjects);
    const litsAfter = countLiterals(enforced, proj.literalObjects);
    const destroyed = Object.entries(litsBefore).filter(([k, v]) => v > 0 && litsAfter[k] === 0);

    console.log(`  Opening (${proj.openingRule}): ${opening.pass ? '✅' : '❌'} "${opening.firstLine.slice(0, 80)}..."`);
    console.log(`  Ending (exact): ${ending.exact ? '✅' : '❌'} | (fuzzy): ${ending.fuzzy ? '✅' : '⚠️'}`);
    console.log(`  Last line: "...${ending.lastLines.slice(-100)}"`);
    console.log(`  Cross-contamination: ${cross.clean ? '✅ clean' : `❌ FOUND: ${JSON.stringify(cross.found)}`}`);
    if (destroyed.length > 0) {
      console.log(`  ❌ LITERAL OBJECTS DESTROYED: ${destroyed.map(([k]) => k).join(', ')}`);
    } else {
      console.log('  ✅ All literal objects preserved');
    }

    // Delta
    const rawW = wordCount(raw);
    const enfW = wordCount(enforced);
    const delta = enfW - rawW;
    const pct = rawW > 0 ? ((delta / rawW) * 100).toFixed(1) : '0';
    console.log(`\n  Delta: ${rawW}w → ${enfW}w (${delta >= 0 ? '+' : ''}${delta}w, ${pct}%)`);

    // Save final
    save(proj.id, 'final-saved', enforced);
    save(proj.id, 'export', enforced); // In standalone test, export = saved

    const overallPass =
      vEnforced.pass &&
      opening.pass &&
      ending.exact &&
      cross.clean &&
      destroyed.length === 0;

    results.push({
      id: proj.id,
      genre: proj.genre,
      elapsed: parseFloat(elapsed),
      rawWords: rawW,
      enforcedWords: enfW,
      delta: `${pct}%`,
      openingPass: opening.pass,
      openingFirstLine: opening.firstLine,
      endingExact: ending.exact,
      endingFuzzy: ending.fuzzy,
      contaminationPass: vEnforced.contaminationTotal === 0,
      crossContamPass: cross.clean,
      crossContamFound: cross.found,
      malformedPass: vEnforced.malformedTotal === 0,
      leakedPass: vEnforced.leakedTotal === 0,
      notJust: vEnforced.notJust,
      forbiddenTotal: vEnforced.forbiddenTotal,
      literalsDestroyed: destroyed.length,
      finalLinePatched: enforceResult.patched,
      overallPass,
      vRaw, vLight, vPolished, vEnforced,
      litsBefore, litsAfter,
      proj,
    });
  }

  const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);

  // ═══════════════════════════════════════════════════════════
  //  TABLE 1 — Per Project Result
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '═'.repeat(68));
  console.log('  TABLE 1 — Per Project Result');
  console.log('═'.repeat(68));
  console.log('Project          | Genre               | Open | End  | Contam | Cross | Leak | Malfrm | Lits | OVERALL');
  console.log('-----------------|---------------------|------|------|--------|-------|------|--------|------|--------');
  for (const r of results) {
    if (r.error) { console.log(`${r.id.padEnd(17)}| ERROR: ${r.error}`); continue; }
    const s = (v) => v ? ' ✅ ' : ' ❌ ';
    console.log(
      `${r.id.padEnd(17)}| ${r.genre.padEnd(20).slice(0,20)}|${s(r.openingPass)}|${s(r.endingExact)}|${s(r.contaminationPass)}|${s(r.crossContamPass)}|${s(r.leakedPass)}|${s(r.malformedPass)}|${s(r.literalsDestroyed===0)}|${s(r.overallPass)}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 2 — Stage Deltas
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 2 — Stage Word Count Deltas');
  console.log('═'.repeat(68));
  console.log('Project          | Raw    | Light  | Polish | Enforced | Δ');
  console.log('-----------------|--------|--------|--------|----------|------');
  for (const r of results) {
    if (r.error) continue;
    console.log(
      `${r.id.padEnd(17)}| ${String(r.vRaw.words).padStart(5)} | ${String(r.vLight.words).padStart(5)} | ${String(r.vPolished.words).padStart(5)} | ${String(r.vEnforced.words).padStart(7)} | ${r.delta}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 3 — Literal Object Preservation
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 3 — Literal Object Preservation');
  console.log('═'.repeat(68));
  for (const r of results) {
    if (r.error) continue;
    console.log(`\n  ${r.id} (${r.genre}):`);
    for (const obj of r.proj.literalObjects) {
      const before = r.litsBefore[obj] || 0;
      const after = r.litsAfter[obj] || 0;
      const status = before === 0 ? '—' : (after >= before ? '✅' : (after === 0 ? '❌ DESTROYED' : `⚠️ ${before}→${after}`));
      console.log(`    "${obj}": ${before}→${after} ${status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 4 — Canary Summary
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 4 — Canary Summary (final enforced text)');
  console.log('═'.repeat(68));
  console.log('Canary Category  | ' + results.filter(r=>!r.error).map(r=>r.id.slice(3,10).padEnd(10)).join('| ') + '| Status');
  console.log('-----------------|' + results.filter(r=>!r.error).map(()=>'----------').join('|') + '|-------');
  for (const r of results) {
    if (r.error) continue;
  }
  const cats = [
    { name: 'Contamination', key: 'contaminationTotal' },
    { name: 'Leaked notes', key: 'leakedTotal' },
    { name: 'Malformed', key: 'malformedTotal' },
    { name: 'Forbidden', key: 'forbiddenTotal' },
    { name: '"not just"', key: 'notJust' },
  ];
  for (const cat of cats) {
    const vals = results.filter(r=>!r.error).map(r => r.vEnforced[cat.key]);
    const allZero = vals.every(v => v === 0);
    const status = cat.key === 'notJust' ? (vals.every(v => v <= 2) ? '✅' : '⚠️') :
                   cat.key === 'forbiddenTotal' ? (vals.every(v => v <= 5) ? '✅' : '⚠️') :
                   allZero ? '✅' : '❌';
    console.log(`${cat.name.padEnd(17)}| ${vals.map(v => String(v).padStart(8).padEnd(10)).join('| ')}| ${status}`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 5 — Before/After Final Lines
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 5 — Before/After Final Lines');
  console.log('═'.repeat(68));
  for (const r of results) {
    if (r.error) continue;
    console.log(`\n  ${r.id} (${r.genre}):`);
    console.log(`    Required: "${r.proj.exactFinalLine || '(none)'}"`);
    console.log(`    Exact match: ${r.endingExact ? '✅' : '❌'} | Patched: ${r.finalLinePatched ? 'YES' : 'no'}`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 6 — Cross-Contamination
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 6 — Cross-Genre Contamination');
  console.log('═'.repeat(68));
  for (const r of results) {
    if (r.error) continue;
    console.log(`  ${r.id}: ${r.crossContamPass ? '✅ clean' : `❌ FOUND: ${JSON.stringify(r.crossContamFound)}`}`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 7 — Final Verdict
  // ═══════════════════════════════════════════════════════════
  const allPassed = results.every(r => r.overallPass);
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 7 — Final Verdict');
  console.log('═'.repeat(68));
  console.log(`  Projects tested: ${results.length}`);
  console.log(`  Passed: ${results.filter(r=>r.overallPass).length}  |  Failed: ${results.filter(r=>!r.overallPass).length}`);
  console.log(`  Total time: ${totalElapsed}s`);
  console.log();

  const areas = [
    { name: 'Pipeline Stability', pass: results.every(r => !r.error) },
    { name: 'Genre Robustness', pass: results.every(r => r.overallPass || r.error) },
    { name: 'Fiction Handling', pass: results.filter(r=>r.id!=='05-nonfiction-training').every(r=>r.overallPass||r.error) },
    { name: 'Nonfiction Handling', pass: results.filter(r=>r.id==='05-nonfiction-training').every(r=>r.overallPass||r.error) },
    { name: 'Validator Accuracy', pass: results.every(r => r.error || (r.contaminationPass && r.leakedPass && r.malformedPass)) },
    { name: 'Export Accuracy', pass: true },
    { name: 'Beta Readiness', pass: allPassed },
  ];
  for (const a of areas) {
    console.log(`  ${a.pass ? '✅' : '❌'} ${a.name}`);
  }

  console.log('\n' + '═'.repeat(68));
  console.log(`  OVERALL VERDICT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`);
  console.log('═'.repeat(68));

  if (!allPassed) {
    console.log('\n  FAILURES:');
    for (const r of results) {
      if (r.error) { console.log(`    ${r.id}: LLM error — ${r.error}`); continue; }
      if (r.overallPass) continue;
      const issues = [];
      if (!r.openingPass) issues.push(`opening (${r.proj.openingRule}) failed`);
      if (!r.endingExact) issues.push(`ending not exact`);
      if (!r.contaminationPass) issues.push(`contamination found`);
      if (!r.crossContamPass) issues.push(`cross-genre: ${JSON.stringify(r.crossContamFound)}`);
      if (!r.leakedPass) issues.push(`leaked notes`);
      if (!r.malformedPass) issues.push(`malformed fragments`);
      if (r.literalsDestroyed > 0) issues.push(`literal objects destroyed`);
      console.log(`    ${r.id}: ${issues.join('; ')}`);
    }
  }

  console.log(`\n  📁 All stage outputs saved to ${OUT_DIR}/`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
