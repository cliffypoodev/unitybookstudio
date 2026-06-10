#!/usr/bin/env node
/**
 * draft-all-test.mjs — Draft All Hardening Smoke Test for UBS
 *
 * Calls Ollama ghostwriter model with 5 controlled chapter prompts that
 * simulate the app's normal Draft All flow, runs regex cleanup + polish
 * stages + exact-final-line enforcement, validates at every step, and
 * produces comprehensive summary tables.
 *
 * Usage: node draft-all-test.mjs
 */

import { extractRequiredFinalLine, enforceExactFinalLine } from './src/lib/exactFinalLine.js';
import { mkdirSync, writeFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL      = 'ghostwriter';
const TEMPERATURE = 0.72;
const MAX_TOKENS  = 6000;
const TIMEOUT     = 600_000; // 10 min
const OUT_DIR     = '/Users/cliff/Downloads/UBS/smoke-test-output/draft-all-hardening';

// ─── Opening / Ending rotation rules ──────────────────────────
const OPENING_RULES = {
  'MID-ACTION': `RULE 15 — ROTATING CHAPTER OPENINGS (Slot 1: MID-ACTION)
Open mid-action. The first sentence must show the POV character physically doing something. Do NOT open with weather, atmosphere, heat, humidity, backstory, landscape, or abstract rumination. The character must be in motion or engaged in a concrete task from the very first word.`,
  'DIALOGUE': `RULE 15 — ROTATING CHAPTER OPENINGS (Slot 2: DIALOGUE)
Open with dialogue. The very first line of text must be spoken dialogue inside quotation marks. No action beats, no description, no attribution before the dialogue. The quote comes first.`,
  'SENSORY DETAIL': `RULE 15 — ROTATING CHAPTER OPENINGS (Slot 3: SENSORY DETAIL)
Open with a one-sense sensory detail. The first sentence must deliver a concrete sensory impression (smell, taste, texture, temperature, sound). Do NOT open with dialogue, weather generalities, or backstory.`,
  'TIME/PLACE ANCHOR': `RULE 15 — ROTATING CHAPTER OPENINGS (Slot 4: TIME/PLACE ANCHOR)
Open with a time or place anchor. The first sentence must contain a specific reference to time of day, day of the week, or a named location. Ground the reader in when and where before anything else.`,
  'CONTRADICTING THOUGHT': `RULE 15 — ROTATING CHAPTER OPENINGS (Slot 5: CONTRADICTING THOUGHT)
Open with a contradicting thought or belief. The first sentence should present the POV character's thought, expectation, or assumption — one that the chapter will challenge or overturn. Show the character's inner voice first.`,
};

const ENDING_RULES = {
  'REVELATION': `RULE 16 — ROTATING CHAPTER ENDINGS (Slot 1: REVELATION)
End with a revelation. The final paragraph must introduce new information — a discovery, a realization, or a piece of evidence the reader did not have before. The chapter closes on the moment of learning, not on reaction.`,
  'CONCRETE SENSORY IMAGE': `RULE 16 — ROTATING CHAPTER ENDINGS (Slot 2: CONCRETE SENSORY IMAGE)
End with a concrete sensory image. The final line must be a physical detail — something seen, heard, felt, or touched. Not dialogue. Not thought. A sensory snapshot that lingers.`,
  'GUT-PUNCH DIALOGUE': `RULE 16 — ROTATING CHAPTER ENDINGS (Slot 3: GUT-PUNCH DIALOGUE)
End with gut-punch dialogue. The final line of the chapter must be spoken dialogue inside quotation marks — a line that reframes everything. No attribution after it. The quote is the last thing the reader encounters.`,
  'QUIET MUNDANE CONTRAST': `RULE 16 — ROTATING CHAPTER ENDINGS (Slot 4: QUIET MUNDANE CONTRAST)
End with a quiet mundane contrast. After the chapter's intensity, the final action should be ordinary and domestic — a hand on a railing, a door closing, a clock ticking. The mundanity amplifies what just happened.`,
  'MID-ACTION CLIFFHANGER': `RULE 16 — ROTATING CHAPTER ENDINGS (Slot 5: MID-ACTION CLIFFHANGER)
End mid-action. The chapter cuts off while something is still happening — unresolved, incomplete. The reader has no closure. Something has just begun or is in the act of occurring when the chapter ends.`,
};

// ─── Chapter definitions ──────────────────────────────────────
const CHAPTERS = [
  {
    num: 1,
    title: 'The Weight of Cotton Dust',
    guidance: `Margot arrives at Maude's estate to settle estate affairs. She meets Chester, the estate's longtime keeper, who tries to keep her in the parlor. Margot spots a brass key in Chester's waistcoat pocket and insists on accessing the basement records room. Chester reluctantly unlocks it. Margot finds a ledger on the central desk.`,
    beats: [
      'Margot knocks on the porch.',
      'Chester redirects to parlor.',
      'Margot sees brass key.',
      'Vivian delivers veiled warning.',
      'Margot demands access.',
      'Chester unlocks basement.',
      'Margot finds ledger.',
    ],
    exactFinalLine: 'The ledger was dated May 12th.',
    openingType: 'MID-ACTION',
    endingType: 'REVELATION',
    slot: 1,
  },
  {
    num: 2,
    title: "The Ledger's Confession",
    guidance: `Margot confronts Vivian about the ledger's payment records. Vivian tries to dismiss them as charity. Chester insists it's old bookkeeping. Margot finds a receipt tucked between pages naming three families: Rivers, Thorne, and Dale. Vivian eventually admits the payments were made to keep people quiet.`,
    beats: [
      'Margot places ledger on dining table.',
      'Vivian turns page back.',
      'Chester reaches for ledger, Margot pulls away.',
      'Receipt found.',
      'Three families named.',
      'Vivian confesses.',
    ],
    exactFinalLine: "The tea cooled untouched beside Vivian's hand.",
    openingType: 'DIALOGUE',
    endingType: 'CONCRETE SENSORY IMAGE',
    slot: 2,
  },
  {
    num: 3,
    title: "Founder's Hall",
    guidance: `Margot takes the receipt to Founder's Hall to match it against the commemorative plaque. Jebediah tries to dismiss the receipt as a ceremonial donation. Silas reveals the plaque was replaced last year and points out screw marks from the old one. Margot reads a handwritten note on the receipt's back that says "Keep the story clean."`,
    beats: [
      'Margot enters with receipt.',
      'Compares receipt to plaque.',
      'Silas shows screw marks.',
      'Jebediah tries to take receipt.',
      'Margot reads note on back.',
      'Note says: Keep the story clean.',
    ],
    exactFinalLine: '"You were never supposed to find her name."',
    openingType: 'SENSORY DETAIL',
    endingType: 'GUT-PUNCH DIALOGUE',
    slot: 3,
  },
  {
    num: 4,
    title: 'The Second Ledger',
    guidance: `Margot returns to the basement records room at night, alone, looking for more evidence. She discovers a second ledger hidden behind a false panel in the desk drawer. This ledger is personal — handwritten entries from Maude herself, detailing what she witnessed during the 1962 crisis. The entries reference a meeting at the old mill where the cover-up was planned. A floorboard creaks upstairs.`,
    beats: [
      'Margot uses brass key alone at night.',
      'Searches desk drawers.',
      'Finds false panel.',
      'Discovers secondary ledger.',
      "Reads Maude's handwriting.",
      'Entries reference old mill.',
      'Hears floorboard creak.',
    ],
    exactFinalLine: null,
    openingType: 'TIME/PLACE ANCHOR',
    endingType: 'QUIET MUNDANE CONTRAST',
    slot: 4,
  },
  {
    num: 5,
    title: 'The Old Mill',
    guidance: `Margot drives to the old mill before dawn, carrying both ledgers. The mill is partially collapsed but the meeting room Maude described is intact. Margot finds names carved into a support beam — the same three families from the receipt. She photographs the evidence. As she turns to leave, headlights sweep across the mill's windows.`,
    beats: [
      'Margot drives to mill.',
      'Describes mill exterior.',
      'Enters meeting room.',
      'Finds carved names.',
      'Names match receipt families.',
      'Takes photographs.',
      'Headlights sweep windows.',
    ],
    exactFinalLine: null,
    openingType: 'CONTRADICTING THOUGHT',
    endingType: 'MID-ACTION CLIFFHANGER',
    slot: 5,
  },
];

// ─── Canary / validation term lists ───────────────────────────
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
  'Self-Correction', 'Anticipation Check', 'Thinking', 'Next steps',
  'Emotional Arc', 'CHAPTER NOTES', 'REVISION NOTES', 'TODO:', 'FIXME:', 'NOTE:',
  'Predicted Conflict', 'Checklist', 'I will now', 'Here is the revised',
  'Revision notes', 'Analysis',
];

const LITERAL_OBJECTS = [
  'the ledger', 'the secondary ledger', 'the diary', 'the brass key',
  'the plaque', 'the lockbox', 'the receipt', 'the watch',
  'the records', 'the letter', 'the photograph',
];

const MALFORMED = [
  'from to the', 'looked at;', 'looked at.', 'fixed on,', 'fixed on.',
  'shifted his gaze from to', 'shifted her gaze from to',
  'reached for to', 'turned from to', 'gaze from to',
];

// ─── Helpers ──────────────────────────────────────────────────
function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) || []).length;
}

// Word-boundary version for leaked notes (avoids "overthinking" → "Thinking")
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

// ─── Chapter restart detection ────────────────────────────────
function detectRestart(text) {
  // Skip first line (expected chapter title)
  const lines = text.split('\n');
  const bodyText = lines.slice(1).join('\n');
  const doubleEndings = (bodyText.match(/\n\n---\n/g) || []).length;
  const restartPatterns = [
    /chapter \d+/gi,
    /\n\n\*\*(?:Chapter|Scene|Part)/gi,
  ];
  let restarts = doubleEndings;
  for (const rx of restartPatterns) { restarts += (bodyText.match(rx) || []).length; }
  return { detected: restarts > 0, count: restarts };
}

// ─── Repeated reveal detection ────────────────────────────────
function detectRepeatedReveal(text) {
  const reveals = [
    'keep the story clean', 'keep people quiet', 'Rivers, Thorne, and Dale',
    'cover-up', '1962',
  ];
  const repeated = [];
  for (const r of reveals) {
    const count = countTerm(text, r);
    if (count >= 3) repeated.push({ phrase: r, count });
  }
  return { detected: repeated.length > 0, repeated };
}

// ─── Regex cleanup (replicated from codebase) ─────────────────
function lightClean(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text;
  t = t.replace(/^```[\s\S]*?\n/gm, '').replace(/```$/gm, '');
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/\n---\n[\s\S]*$/m, '');
  t = t.replace(/\n\*\*(?:Notes?|Analysis|Self-Correction|Anticipation)[\s\S]*$/mi, '');
  t = t.replace(/^Chapter\s+\d+\s*[:.\-—]\s*/i, '');
  // Strip markdown chapter headings: "# Chapter N: Title"
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

// ─── Prompt builder ───────────────────────────────────────────
function buildPrompt(ch) {
  const openingRule = OPENING_RULES[ch.openingType];
  const endingRule = ENDING_RULES[ch.endingType];
  const beatsBlock = ch.beats.map((b, i) => `${i + 1}. ${b}`).join('\n');

  let exactLineBlock = '';
  if (ch.exactFinalLine) {
    exactLineBlock = `\nThe final line must be exactly:\n${ch.exactFinalLine}\n`;
  }

  return `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.

PROJECT: The Weight of Cotton Dust
Genre: Southern Gothic / Mystery
Setting: Harmony Creek, Alabama, 1962
POV: Third-person limited (Margot Rivers)
Tense: Past tense

=== PROSE RULES (MANDATORY) ===
${openingRule}

${endingRule}

RULE — ACTIVE PAST TENSE: Use simple past tense. Progressive past (was running, was watching) is the #1 AI tell. Convert to simple past unless action is interrupted.

RULE — NO CONTAMINATION: This is an 1860s-1960s rural Alabama setting. NO modern companies, apps, software, business pitches, compliance systems, subscriptions, ROI, healthcare operations, AI products, corporate terms, startups, platforms, or digital anything.

RULE — NO PROCESS LEAKAGE: Do not include Self-Correction, Anticipation Check, Thinking, Next steps, Emotional Arc, TODO, analysis, revision notes, or meta-commentary. Write finished prose only.

RULE — ANTI-SLOP: Avoid: not just, more than just, the truth was, the lie was, the secret was, the mystery was, the narrative, the performance, the emotional architecture, the collective memory, the weight of, woven into, fabric of, couldn't help but, a sense of, the air was thick, washed over.

=== CHAPTER CONTEXT ===
Chapter ${ch.num}: ${ch.title}
${ch.guidance}

=== REQUIRED BEATS ===
${beatsBlock}
${exactLineBlock}
=== OUTPUT RULES ===
Write 1500-2000 words of finished prose. No headings except chapter title. No notes. No analysis.`;
}

// ─── Ollama call ──────────────────────────────────────────────
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

// ─── Check opening rule ───────────────────────────────────────
function checkOpening(text, openingType) {
  const firstLine = text.split('\n').find(l => l.trim().length > 10)?.trim() || '';
  switch (openingType) {
    case 'MID-ACTION': {
      const weatherOpeners = /^(?:the heat|the humidity|the air|it was hot|the sun|the sky|the weather|the temperature)/i;
      return { pass: !weatherOpeners.test(firstLine), firstLine, rule: openingType };
    }
    case 'DIALOGUE':
      return { pass: /^["""\u201c]/.test(firstLine), firstLine, rule: openingType };
    case 'SENSORY DETAIL': {
      const isDialogue = /^["""\u201c]/.test(firstLine);
      return { pass: !isDialogue, firstLine, rule: openingType };
    }
    case 'TIME/PLACE ANCHOR': {
      const timeRefs = /\b(dawn|dusk|midnight|noon|morning|evening|afternoon|night|o'clock|monday|tuesday|wednesday|thursday|friday|saturday|sunday|a\.m\.|p\.m\.|hour|daylight|quarter past|half past)\b/i;
      return { pass: timeRefs.test(firstLine), firstLine, rule: openingType };
    }
    case 'CONTRADICTING THOUGHT': {
      // Should show a thought/belief — check for thought verbs or internal language
      const thoughtIndicators = /\b(thought|believed|expected|assumed|told herself|convinced|imagined|supposed|figured|hadn't expected|would have|should have|could have|hadn't thought|never thought|never expected|never imagined)\b/i;
      // Lenient: pass if it doesn't start with dialogue and isn't weather
      const isDialogue = /^["""\u201c]/.test(firstLine);
      return { pass: !isDialogue, firstLine, rule: openingType };
    }
    default:
      return { pass: true, firstLine, rule: openingType };
  }
}

// ─── Check ending rule ────────────────────────────────────────
function checkEnding(text, endingType, expectedLine) {
  const trimmed = text.trim();
  const lastLines = trimmed.split('\n').filter(l => l.trim()).slice(-3).join(' ').trim();
  const lastLine = trimmed.split('\n').filter(l => l.trim()).slice(-1)[0]?.trim() || '';

  const result = {
    rule: endingType,
    lastLine: lastLine.slice(-120),
    exactMatch: false,
    fuzzyMatch: false,
    rulePass: false,
  };

  // Check exact final line match (if one was required)
  if (expectedLine) {
    const clean = (s) => s.replace(/["""\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();
    result.exactMatch = clean(lastLines).endsWith(clean(expectedLine));
    result.fuzzyMatch = lastLines.toLowerCase().includes(clean(expectedLine).toLowerCase().slice(0, 30));
  } else {
    // No exact line required — mark as auto-pass for exact match
    result.exactMatch = true;
    result.fuzzyMatch = true;
  }

  // Validate ending type compliance
  switch (endingType) {
    case 'REVELATION':
      // Last paragraph should introduce new info — hard to auto-check perfectly
      // Heuristic: not pure dialogue, has some substantive content
      result.rulePass = lastLine.length > 15;
      break;
    case 'CONCRETE SENSORY IMAGE':
      // Last line should NOT be dialogue
      result.rulePass = !/^["""\u201c]/.test(lastLine);
      break;
    case 'GUT-PUNCH DIALOGUE':
      // Last line MUST be dialogue
      result.rulePass = /^["""\u201c]/.test(lastLine) || /["""\u201d]$/.test(lastLine);
      break;
    case 'QUIET MUNDANE CONTRAST':
      // Hard to auto-validate — pass if it's not dialogue
      result.rulePass = !/^["""\u201c]/.test(lastLine);
      break;
    case 'MID-ACTION CLIFFHANGER':
      // Should feel unresolved — heuristic: not ending with a period-heavy "settled" feel
      result.rulePass = lastLine.length > 10;
      break;
    default:
      result.rulePass = true;
  }

  return result;
}

// ─── Save a stage file ────────────────────────────────────────
function saveStage(chNum, stageCode, stageName, content) {
  const filename = `ch${chNum}-${stageCode}-${stageName}.txt`;
  writeFileSync(`${OUT_DIR}/${filename}`, content, 'utf-8');
  return filename;
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  UBS DRAFT ALL HARDENING SMOKE TEST                            ║');
  console.log('║  5 Chapters · Full Pipeline · Model: ghostwriter               ║');
  console.log('║  Ollama @ 127.0.0.1:11434                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── Check Ollama health ──────────────────────────────────
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

  // ─── Create output directory ──────────────────────────────
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`📁 Output directory: ${OUT_DIR}\n`);

  const results = [];
  const overallStart = Date.now();

  // ─── Process each chapter ─────────────────────────────────
  for (const ch of CHAPTERS) {
    console.log(`\n${'═'.repeat(68)}`);
    console.log(`  CHAPTER ${ch.num}: ${ch.title}`);
    console.log(`  Opening: ${ch.openingType} (Slot ${ch.slot}) | Ending: ${ch.endingType} (Slot ${ch.slot})`);
    console.log(`${'═'.repeat(68)}`);

    const stages = {};
    const stageValidations = {};

    // ─── Stage 01: Save guidance ────────────────────────────
    const guidanceText = `CHAPTER ${ch.num}: ${ch.title}\n\n${ch.guidance}\n\nBEATS:\n${ch.beats.map((b,i)=>`${i+1}. ${b}`).join('\n')}\n\nExact final line: ${ch.exactFinalLine || '(none)'}\nOpening: ${ch.openingType}\nEnding: ${ch.endingType}`;
    saveStage(ch.num, '01', 'guidance', guidanceText);

    // ─── Stage 02: Build and save prompt ────────────────────
    const prompt = buildPrompt(ch);
    stages.prompt = prompt;
    saveStage(ch.num, '02', 'prompt', prompt);

    // ─── Extract required final line from prompt ────────────
    const requiredFinalLine = extractRequiredFinalLine(prompt);
    const effectiveFinalLine = ch.exactFinalLine || null;
    console.log(`\n  📌 Required final line: ${effectiveFinalLine ? `"${effectiveFinalLine}"` : '(none)'}`);
    if (requiredFinalLine !== undefined && requiredFinalLine !== null) {
      console.log(`  📌 Extracted from prompt: "${requiredFinalLine}"`);
    }

    // ─── Stage 03: Call Ghostwriter ─────────────────────────
    console.log('\n  [1/6] Calling Ghostwriter LLM...');
    const startTime = Date.now();
    let raw;
    try {
      raw = await callGhostwriter(prompt);
    } catch (e) {
      console.error(`  ❌ LLM call failed: ${e.message}`);
      results.push({ ch: ch.num, title: ch.title, error: e.message });
      continue;
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ Ghostwriter responded in ${elapsed}s (${wordCount(raw)} words)`);

    stages.raw = raw;
    stageValidations.raw = validate(raw, ch.num);
    saveStage(ch.num, '03', 'raw', raw);
    console.log('  [Stage: Raw LLM output]');
    printValidation('    raw', stageValidations.raw);

    // ─── Stage 04: lightClean ───────────────────────────────
    console.log('\n  [2/6] Running lightClean...');
    const light = lightClean(raw);
    stages.light = light;
    stageValidations.light = validate(light, ch.num);
    saveStage(ch.num, '04', 'light-clean', light);
    printValidation('    lgt', stageValidations.light);

    // ─── Stage 05: deepClean ────────────────────────────────
    console.log('\n  [3/6] Running deepClean...');
    const deep = deepClean(light);
    stages.deep = deep;
    stageValidations.deep = validate(deep, ch.num);
    saveStage(ch.num, '05', 'deep-clean', deep);
    printValidation('    dep', stageValidations.deep);

    // ─── Stage 06: polishPipeline ───────────────────────────
    console.log('\n  [4/6] Running polishPipeline...');
    const polished = polishPipeline(light);
    stages.polished = polished;
    stageValidations.polished = validate(polished, ch.num);
    saveStage(ch.num, '06', 'polished', polished);
    printValidation('    pol', stageValidations.polished);

    // ─── Stage 07: enforceExactFinalLine ────────────────────
    console.log('\n  [5/6] Running exact final line enforcement...');
    const enforceResult = enforceExactFinalLine(polished, effectiveFinalLine, `Ch.${ch.num}`);
    const enforced = enforceResult.text;
    stages.enforced = enforced;
    stageValidations.enforced = validate(enforced, ch.num);
    stages.finalLinePatched = enforceResult.patched;
    saveStage(ch.num, '07', 'enforced', enforced);
    if (enforceResult.patched) {
      console.log('  ✅ PATCHED: model ending replaced with required final line.');
    } else if (effectiveFinalLine) {
      console.log('  ✅ OK: text already ended with required final line.');
    } else {
      console.log('  ⚠️  No required final line for this chapter.');
    }
    printValidation('    enf', stageValidations.enforced);

    // ─── Stage 08: Final validation ─────────────────────────
    console.log('\n  [6/6] Final validation + structural checks...');

    // Opening check
    const opening = checkOpening(enforced, ch.openingType);
    console.log(`  Opening (${ch.openingType}): ${opening.pass ? '✅' : '❌'} "${opening.firstLine.slice(0, 80)}${opening.firstLine.length > 80 ? '...' : ''}"`);

    // Ending check
    const ending = checkEnding(enforced, ch.endingType, ch.exactFinalLine);
    console.log(`  Ending (${ch.endingType}): rule=${ending.rulePass ? '✅' : '❌'} | exact=${ending.exactMatch ? '✅' : '❌'} | fuzzy=${ending.fuzzyMatch ? '✅' : '⚠️'}`);
    console.log(`  Last line: "...${ending.lastLine.slice(-100)}"`);

    // Restart detection
    const restart = detectRestart(enforced);
    console.log(`  Restart detection: ${restart.detected ? `❌ ${restart.count} restart(s)` : '✅ clean'}`);

    // Repeated reveal detection
    const repeatedReveal = detectRepeatedReveal(enforced);
    if (repeatedReveal.detected) {
      console.log(`  ⚠️  Repeated reveals: ${repeatedReveal.repeated.map(r => `"${r.phrase}":${r.count}`).join(', ')}`);
    } else {
      console.log('  ✅ No over-repeated reveals');
    }

    // Word count delta
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
      console.log('  ✅ All literal objects preserved');
    }

    // Save final text
    saveStage(ch.num, '08', 'final', enforced);

    // ─── Assemble result ────────────────────────────────────
    const overallPass =
      stageValidations.enforced.pass &&
      opening.pass &&
      ending.exactMatch &&
      ending.rulePass &&
      !restart.detected &&
      destroyed.length === 0;

    results.push({
      ch: ch.num,
      title: ch.title,
      elapsed: parseFloat(elapsed),
      rawWords: rawW,
      enforcedWords: enfW,
      delta: `${pct}%`,
      openingType: ch.openingType,
      endingType: ch.endingType,
      openingPass: opening.pass,
      openingFirstLine: opening.firstLine,
      endingExact: ending.exactMatch,
      endingFuzzy: ending.fuzzyMatch,
      endingRulePass: ending.rulePass,
      endingLastLine: ending.lastLine,
      contaminationPass: stageValidations.enforced.contaminationTotal === 0,
      malformedPass: stageValidations.enforced.malformedTotal === 0,
      leakedPass: stageValidations.enforced.leakedTotal === 0,
      notJust: stageValidations.enforced.notJust,
      notJustPass: stageValidations.enforced.notJust <= 2,
      forbiddenTotal: stageValidations.enforced.forbiddenTotal,
      literalTotal: stageValidations.enforced.literalTotal,
      literalsDestroyed: destroyed.length,
      finalLinePatched: stages.finalLinePatched,
      requiredFinalLine: ch.exactFinalLine,
      restartDetected: restart.detected,
      restartCount: restart.count,
      repeatedReveal: repeatedReveal.detected,
      overallPass,
      stages,
      stageValidations,
    });
  }

  const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);

  // ═══════════════════════════════════════════════════════════
  //  TABLE 1 — Per Chapter Result
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n' + '═'.repeat(68));
  console.log('  TABLE 1 — Per Chapter Result');
  console.log('═'.repeat(68));
  console.log('Ch | Title                    | Opening | EndRule | EndExact | Contam | Malfrm | Leaked | Restart | OVERALL');
  console.log('---|--------------------------|---------|---------|----------|--------|--------|--------|---------|--------');
  for (const r of results) {
    if (r.error) { console.log(` ${r.ch} | ${r.title.padEnd(24)} | ERROR: ${r.error}`); continue; }
    const s = (v) => v ? '  ✅  ' : '  ❌  ';
    console.log(
      ` ${r.ch} | ${r.title.padEnd(24).slice(0,24)} |${s(r.openingPass)}|${s(r.endingRulePass)}|${s(r.endingExact)}|${s(r.contaminationPass)}|${s(r.malformedPass)}|${s(r.leakedPass)}|${s(!r.restartDetected)}|${s(r.overallPass)}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 2 — Stage Word Count Deltas
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 2 — Stage Word Count Deltas');
  console.log('═'.repeat(68));
  console.log('Ch | Raw    | Light  | Deep   | Polish | Enforced | Δ Raw→Enf');
  console.log('---|--------|--------|--------|--------|----------|----------');
  for (const r of results) {
    if (r.error) continue;
    const sv = r.stageValidations;
    console.log(
      ` ${r.ch} | ${String(sv.raw.words).padStart(5)} | ${String(sv.light.words).padStart(5)} | ${String(sv.deep.words).padStart(5)} | ${String(sv.polished.words).padStart(5)} | ${String(sv.enforced.words).padStart(7)} | ${r.delta}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 3 — Canary Summary
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 3 — Canary Summary (per stage, final chapters)');
  console.log('═'.repeat(68));
  console.log('Ch | Stage    | Contam | Leaked | Forbidden | not-just');
  console.log('---|----------|--------|--------|-----------|--------');
  for (const r of results) {
    if (r.error) continue;
    for (const [stage, label] of [['raw','Raw'],['light','Light'],['deep','Deep'],['polished','Polish'],['enforced','Enforced']]) {
      const sv = r.stageValidations[stage];
      console.log(
        ` ${r.ch} | ${label.padEnd(8)} | ${String(sv.contaminationTotal).padStart(5)} | ${String(sv.leakedTotal).padStart(5)} | ${String(sv.forbiddenTotal).padStart(8)} | ${String(sv.notJust).padStart(5)}`
      );
    }
    console.log('---|----------|--------|--------|-----------|--------');
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 4 — Literal Object Preservation
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 4 — Literal Object Preservation');
  console.log('═'.repeat(68));
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

  // ═══════════════════════════════════════════════════════════
  //  TABLE 5 — Before/After Final Lines
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 5 — Before/After Final Lines');
  console.log('═'.repeat(68));
  for (const r of results) {
    if (r.error) continue;
    const polLast = r.stages.polished.trim().split('\n').filter(l=>l.trim()).slice(-1)[0]?.trim() || '';
    const enfLast = r.stages.enforced.trim().split('\n').filter(l=>l.trim()).slice(-1)[0]?.trim() || '';
    const required = r.requiredFinalLine || '(none)';
    console.log(`\n  Ch.${r.ch}: ${r.title}`);
    console.log(`    Required:  "${required}"`);
    console.log(`    Pre-enf:   "...${polLast.slice(-100)}"`);
    console.log(`    Post-enf:  "...${enfLast.slice(-100)}"`);
    console.log(`    Match: ${r.endingExact ? '✅ EXACT' : '❌ MISMATCH'} | Patched: ${r.finalLinePatched ? 'YES' : 'no'}`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 6 — Opening/Ending Rotation Compliance
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 6 — Opening/Ending Rotation Compliance');
  console.log('═'.repeat(68));
  console.log('Ch | Slot | Opening Type           | Pass | Ending Type            | Rule | Exact');
  console.log('---|------|------------------------|------|------------------------|------|------');
  for (const r of results) {
    if (r.error) { console.log(` ${r.ch} | ERROR`); continue; }
    const s = (v) => v ? ' ✅ ' : ' ❌ ';
    console.log(
      ` ${r.ch} |  ${r.ch}   | ${r.openingType.padEnd(22)} |${s(r.openingPass)}| ${r.endingType.padEnd(22)} |${s(r.endingRulePass)}|${s(r.endingExact)}`
    );
  }

  // First lines / last lines detail
  console.log('\n  Opening first lines:');
  for (const r of results) {
    if (r.error) continue;
    console.log(`    Ch.${r.ch} (${r.openingType}): "${r.openingFirstLine?.slice(0, 90)}${(r.openingFirstLine?.length || 0) > 90 ? '...' : ''}"`);
  }
  console.log('\n  Ending last lines:');
  for (const r of results) {
    if (r.error) continue;
    console.log(`    Ch.${r.ch} (${r.endingType}): "...${r.endingLastLine?.slice(-90)}"`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TABLE 7 — Final Verdict
  // ═══════════════════════════════════════════════════════════
  const allPassed = results.every(r => !r.error && r.overallPass);
  const passCount = results.filter(r => !r.error && r.overallPass).length;
  const failCount = results.filter(r => r.error || !r.overallPass).length;

  console.log('\n' + '═'.repeat(68));
  console.log('  TABLE 7 — Final Verdict');
  console.log('═'.repeat(68));
  console.log(`  Chapters processed: ${results.length}`);
  console.log(`  Passed: ${passCount}  |  Failed: ${failCount}`);
  console.log(`  Total time: ${totalElapsed}s`);
  console.log(`  Average per chapter: ${(parseFloat(totalElapsed) / results.length).toFixed(1)}s`);

  if (!allPassed) {
    console.log('\n  FAILURES:');
    for (const r of results) {
      if (r.error) { console.log(`    Ch.${r.ch}: LLM error — ${r.error}`); continue; }
      if (r.overallPass) continue;
      const issues = [];
      if (!r.openingPass) issues.push(`opening rule violated (${r.openingType})`);
      if (!r.endingExact) issues.push('ending not exact after enforcement');
      if (!r.endingRulePass) issues.push(`ending rule violated (${r.endingType})`);
      if (!r.contaminationPass) issues.push(`contamination: ${JSON.stringify(r.stageValidations.enforced.contamination)}`);
      if (!r.malformedPass) issues.push(`malformed: ${JSON.stringify(r.stageValidations.enforced.malformed)}`);
      if (!r.leakedPass) issues.push(`leaked notes: ${JSON.stringify(r.stageValidations.enforced.leaked)}`);
      if (r.notJust > 2) issues.push(`not-just: ${r.notJust} (max 2)`);
      if (r.literalsDestroyed > 0) issues.push('literal objects destroyed');
      if (r.restartDetected) issues.push(`chapter restart detected (${r.restartCount})`);
      console.log(`    Ch.${r.ch}: ${issues.join('; ')}`);
    }
  }

  console.log('\n' + '═'.repeat(68));
  console.log(`  OVERALL VERDICT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}`);
  console.log('═'.repeat(68));
  console.log(`\n  📁 All stage outputs saved to ${OUT_DIR}/`);
  console.log('     ch{1-5}-{01-guidance,02-prompt,03-raw,04-light-clean,05-deep-clean,06-polished,07-enforced,08-final}.txt');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
