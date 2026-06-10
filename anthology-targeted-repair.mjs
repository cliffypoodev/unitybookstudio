#!/usr/bin/env node
// anthology-targeted-repair.mjs
// Full targeted repair pipeline for Digital Equity Tribunal 20-chapter anthology.

import fs from 'fs';
import path from 'path';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const BASE = '/Users/cliff/Downloads/UBS';
const SRC_DIR = path.join(BASE, 'smoke-test-output/anthology-prepolish-gate/01-extracted-chapters');
const REGEN_PROMPT_DIR = path.join(BASE, 'smoke-test-output/anthology-prepolish-gate/09-regeneration-prompts');
const BEFORE_SCAN = path.join(BASE, 'smoke-test-output/anthology-prepolish-gate/02-chapter-scan-results.json');
const OUT_DIR = path.join(BASE, 'smoke-test-output/anthology-targeted-repair');

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'ghostwriter';
const TEMP = 0.75;

const CHAPTER_TITLES = {
  1: 'The Algorithmic Stage',
  2: "The Patron's Palette",
  3: 'The Office of Echoes',
  4: 'The Sacred Screen',
  5: 'The Transit of Ghosts',
  6: 'The Drift of Echoes',
  7: "The Anatomist's Stage",
  8: 'The Pixelated Heir',
  9: 'The Terminal Veil',
  10: 'The Algorithmic Battlefield',
  11: 'The Plaza Ledger',
  12: "The Anatomist's Protocol",
  13: 'The Syntax of Survival',
  14: 'The Incantation of Bytes',
  15: 'The Transit of Errors',
  16: 'The Whispering Glade',
  17: 'The Echo Chamber',
  18: 'The Stage of Errors',
  19: 'The Threshold of Bytes',
  20: 'The Battlefield Code',
};

// Repair classification
const REGEN_CHAPTERS = [6, 10, 15];
const MECH_CLEANUP_CHAPTERS = [2];
const DEEP_POLISH_CHAPTERS = [7, 11, 12, 14, 16, 20];
const STANDARD_POLISH_CHAPTERS = [1, 3, 4, 5, 8, 9, 13, 17, 18, 19];

// Sub-directories
const SUBDIRS = [
  '02-regenerated-chapters',
  '03-mechanical-cleanup',
  '04-deep-polished-chapters',
  '05-standard-polished-chapters',
  '06-reassembled-manuscript',
  '07-post-repair-quality-gate',
];

// ─── HARD-REJECT PROCESS LEAK PHRASES ──────────────────────────────────────
const PROCESS_LEAK_PHRASES = [
  'Analysis & Strengths', 'Areas for Refinement', 'Best Next Move',
  'Best next move', 'Action Plan', 'Action Plan for Next Section',
  'Constraint Adherence', 'Show vs. Tell', 'Pacing & Tension',
  'Voice Consistency', 'Sensory Density', 'I recommend',
  'Critique', 'Revision notes', 'REVISION NOTES',
  'Here is the revised', 'I will now', 'Self-Correction',
  'Anticipation Check', 'Thinking...', 'Checklist', 'TODO',
  'next section', 'Inciting Incident', 'Rising Action',
  'The structure is solid', 'The next logical step',
  'The goal is for the reader', 'Micro-Adjustments',
  'The prose hits all the required marks',
  'Strengths\n', 'Strengths:',
];

// ─── SLOP PHRASES FOR COUNTING ─────────────────────────────────────────────
const SLOP_PATTERNS = [
  { label: 'not just', re: /not just/gi },
  { label: 'more than just', re: /more than just/gi },
  { label: 'the weight of', re: /the weight of/gi },
  { label: 'the narrative', re: /the narrative/gi },
  { label: 'the performance', re: /the performance/gi },
  { label: 'the truth was', re: /the truth was/gi },
  { label: 'woven into', re: /woven into/gi },
  { label: 'fabric of', re: /fabric of/gi },
  { label: 'rot beneath', re: /rot beneath/gi },
  { label: 'something shifted', re: /something shifted/gi },
  { label: 'the emotional architecture', re: /the emotional architecture/gi },
  { label: 'collective memory', re: /collective memory/gi },
  { label: 'collective identity', re: /collective identity/gi },
  { label: 'felt', re: /\bfelt\b/gi },
  { label: 'realized', re: /\brealized\b/gi },
  { label: 'palpable', re: /\bpalpable\b/gi },
  { label: 'meticulously', re: /\bmeticulously\b/gi },
  { label: 'luminous', re: /\bluminous\b/gi },
  { label: 'shimmering', re: /\bshimmering\b/gi },
  { label: 'ethereal', re: /\bethereal\b/gi },
  { label: 'relentless', re: /\brelentless\b/gi },
];

const BANNED_WORDS = ['palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal'];

// Formula beats for sameness detection
const FORMULA_BEATS = [
  { id: 'A', label: 'protagonist-as-expert', patterns: [/protagonist.*expert/i, /she was.*(?:leading|expert|specialist|renowned)/i, /he was.*(?:leading|expert|specialist|renowned)/i, /years of.*(?:training|experience|expertise)/i] },
  { id: 'B', label: 'system-quantifies-trait', patterns: [/(?:score|rating|metric|index|coefficient|percentile).*(?:calculated|computed|assigned|generated)/i, /(?:algorithm|system|AI|machine).*(?:quantif|measur|assess|evaluat)/i, /numerical.*(?:value|score|rating)/i] },
  { id: 'C', label: 'authority-explains-monetization', patterns: [/(?:monetiz|profit|revenue|market|commodif)/i, /(?:director|CEO|executive|manager|official).*(?:explain|describ|said|told)/i] },
  { id: 'D', label: 'protagonist-finds-flaw', patterns: [/(?:discover|found|noticed|detected|uncovered).*(?:flaw|bug|glitch|error|anomaly|bias)/i, /(?:flaw|bug|glitch|error|anomaly|bias).*(?:discover|found|noticed|detected|uncovered)/i] },
  { id: 'E', label: 'hidden-layer-revealed', patterns: [/(?:hidden|secret|concealed|buried).*(?:layer|level|system|protocol|truth)/i, /(?:beneath|under|behind).*(?:surface|facade|interface)/i] },
  { id: 'F', label: 'philosophical-ending', patterns: [/what it meant to be/i, /the question.*remain/i, /perhaps.*truth/i, /in the end/i, /she understood.*now/i, /he understood.*now/i] },
];

// ─── UTILITIES ──────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function wordCount(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function chapterPad(n) {
  return String(n).padStart(2, '0');
}

function readChapter(n) {
  return fs.readFileSync(path.join(SRC_DIR, `chapter-${chapterPad(n)}.txt`), 'utf-8');
}

// ─── OLLAMA CALLER ──────────────────────────────────────────────────────────
async function callOllama(prompt, model = MODEL, temp = TEMP) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600000); // 10 min
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: temp, num_predict: 8192 },
      }),
      signal: controller.signal,
    });
    const data = await response.json();
    let text = data?.message?.content || '';
    // Strip thinking-model artifacts
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<\/think>/gi, '');
    text = text.replace(/\\boxed\{[^}]*\}/g, '');
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── PROCESS LEAK SCANNER ───────────────────────────────────────────────────
function scanProcessLeaks(text) {
  const leaks = [];
  for (const phrase of PROCESS_LEAK_PHRASES) {
    const idx = text.indexOf(phrase);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + phrase.length + 40);
      leaks.push({
        phrase,
        position: idx,
        snippet: text.slice(start, end),
      });
    }
  }
  return leaks;
}

// ─── SLOP COUNTER ───────────────────────────────────────────────────────────
function countSlop(text) {
  const counts = {};
  const flags = [];
  let totalSlop = 0;

  for (const { label, re } of SLOP_PATTERNS) {
    const matches = text.match(re);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      counts[label] = count;
      totalSlop += count;
    }
  }

  // Flag checks
  const notJustFamily = (counts['not just'] || 0) + (counts['more than just'] || 0);
  if (notJustFamily > 5) flags.push(`FLAG_HEAVY_SLOP: "not just" family > 5`);
  if ((counts['the weight of'] || 0) > 3) flags.push(`FLAG_HEAVY_SLOP: "the weight of" > 3`);
  if ((counts['the narrative'] || 0) > 5) flags.push(`FLAG_HEAVY_SLOP: "narrative" > 5`);
  if ((counts['felt'] || 0) > 12) flags.push(`FLAG_STYLE_REVIEW: "felt" > 12`);
  if ((counts['realized'] || 0) > 5) flags.push(`FLAG_STYLE_REVIEW: "realized" > 5`);

  const bannedFound = BANNED_WORDS.filter(w => counts[w]);
  if (bannedFound.length > 0) flags.push(`FLAG_POLISH_REQUIRED: banned words [${bannedFound.join(', ')}]`);

  let status = 'PASS';
  if (flags.some(f => f.includes('HEAVY_SLOP'))) status = 'NEEDS_POLISH';
  else if (flags.length > 0) status = 'MINOR_FLAGS';

  return { counts, flags, totalSlop, status };
}

// ─── DIALOGUE PUNCTUATION CHECKER ───────────────────────────────────────────
function checkDialoguePunctuation(text) {
  let issues = 0;
  const lines = text.split('\n');
  for (const line of lines) {
    // Check for dialogue ending without proper punctuation before closing quote
    const badEndings = line.match(/ [a-zA-Z]"/g);
    if (badEndings) issues += badEndings.length;

    // Check for comma after closing quote before dialogue tag
    const missingComma = line.match(/"[A-Z]/g);
    if (missingComma) issues += missingComma.length;
  }

  // Also count unmatched quotes
  const quoteCount = (text.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) issues += 1;

  let severity = 'CLEAN';
  if (issues > 10) severity = 'CRITICAL';
  else if (issues > 3) severity = 'MINOR';
  else if (issues > 0) severity = 'MINOR';

  return { issues, severity };
}

// ─── OPENING / ENDING SCANNER ───────────────────────────────────────────────
function scanOpeningEnding(text) {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0] || '';
  const lines = trimmed.split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1] || '';

  const openingIssues = [];
  if (/^The air\b/i.test(firstLine)) openingIssues.push('Opens with "The air..."');
  if (/^In the\b/i.test(firstLine)) openingIssues.push('Opens with "In the..."');

  const endingIssues = [];
  if (/what it meant to be/i.test(lastLine)) endingIssues.push('Philosophical ending: "what it meant to be"');
  if (/the question.*remain/i.test(lastLine)) endingIssues.push('Philosophical ending: "the question remained"');
  if (/perhaps.*truth/i.test(lastLine)) endingIssues.push('Philosophical ending: "perhaps...truth"');

  return { openingIssues, endingIssues };
}

// ─── STRUCTURAL SAMENESS ────────────────────────────────────────────────────
function detectSameness(text) {
  const beats = [];
  for (const beat of FORMULA_BEATS) {
    for (const pat of beat.patterns) {
      if (pat.test(text)) {
        beats.push(`${beat.id}: ${beat.label}`);
        break;
      }
    }
  }
  return { score: beats.length, beats };
}

// ─── DEEP POLISH ────────────────────────────────────────────────────────────
function deepPolish(text, chapterNum) {
  let t = text;

  // Remove banned words
  const banned = ['palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal'];
  for (const word of banned) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      const alts = {
        'palpable': 'visible',
        'meticulously': 'carefully',
        'luminous': 'bright',
        'shimmering': 'gleaming',
        'ethereal': 'faint',
      };
      const alt = alts[match.toLowerCase()] || '';
      return match[0] === match[0].toUpperCase() ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt;
    });
  }

  // Reduce "not just" family — replace excess occurrences beyond 2
  const notJustPatterns = [
    { re: /wasn't just/gi, rep: 'was more than' },
    { re: /isn't just/gi, rep: 'is more than' },
    { re: /not just/gi, rep: 'beyond' },
    { re: /more than just/gi, rep: 'beyond' },
  ];
  for (const p of notJustPatterns) {
    let count = 0;
    t = t.replace(p.re, (match) => {
      count++;
      return count > 2 ? p.rep : match;
    });
  }

  // Reduce "the weight of" beyond 2
  let weightCount = 0;
  t = t.replace(/the weight of/gi, (match) => {
    weightCount++;
    return weightCount > 2 ? 'the burden of' : match;
  });

  // Reduce "felt" beyond 10
  let feltCount = 0;
  t = t.replace(/\bfelt\b/gi, (match) => {
    feltCount++;
    if (feltCount <= 10) return match;
    const alts = ['sensed', 'noticed', 'registered', 'recognized', 'experienced'];
    return alts[(feltCount - 11) % alts.length];
  });

  // Reduce "realized" beyond 3
  let realizedCount = 0;
  t = t.replace(/\brealized\b/gi, (match) => {
    realizedCount++;
    if (realizedCount <= 3) return match;
    const alts = ['understood', 'saw', 'recognized', 'grasped'];
    return alts[(realizedCount - 4) % alts.length];
  });

  // Fix "The air..." opening
  if (/^The air\b/i.test(t.trim())) {
    t = t.replace(/^The air [^.]+\./, (match) => {
      return match.replace(/^The air/, 'The room');
    });
  }

  // Remove other slop phrases
  const slopReduce = [
    { re: /the emotional architecture/gi, rep: 'the emotional core' },
    { re: /collective memory/gi, rep: 'shared memory' },
    { re: /collective identity/gi, rep: 'shared identity' },
    { re: /woven into the fabric of/gi, rep: 'embedded in' },
    { re: /fabric of/gi, rep: 'structure of' },
    { re: /the air was thick/gi, rep: 'the air hung heavy' },
    { re: /couldn't help but/gi, rep: '' },
    { re: /a sense of/gi, rep: 'a feeling of' },
    { re: /something shifted/gi, rep: 'something changed' },
    { re: /washed over/gi, rep: 'swept through' },
  ];
  for (const s of slopReduce) {
    t = t.replace(s.re, s.rep);
  }

  // Clean up double spaces
  t = t.replace(/  +/g, ' ');

  return t;
}

// ─── STANDARD (LIGHT) POLISH ────────────────────────────────────────────────
function standardPolish(text, chapterNum) {
  let t = text;

  // Remove banned words only
  const banned = ['palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal'];
  for (const word of banned) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      const alts = {
        'palpable': 'visible',
        'meticulously': 'carefully',
        'luminous': 'bright',
        'shimmering': 'gleaming',
        'ethereal': 'faint',
      };
      const alt = alts[match.toLowerCase()] || '';
      return match[0] === match[0].toUpperCase() ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt;
    });
  }

  // Light slop phrase reduction
  const slopReduce = [
    { re: /the emotional architecture/gi, rep: 'the emotional core' },
    { re: /collective memory/gi, rep: 'shared memory' },
    { re: /collective identity/gi, rep: 'shared identity' },
    { re: /woven into the fabric of/gi, rep: 'embedded in' },
    { re: /the air was thick/gi, rep: 'the air hung heavy' },
    { re: /couldn't help but/gi, rep: '' },
    { re: /washed over/gi, rep: 'swept through' },
  ];
  for (const s of slopReduce) {
    t = t.replace(s.re, s.rep);
  }

  // Fix obvious punctuation (double spaces, trailing spaces on lines)
  t = t.replace(/  +/g, ' ');
  t = t.replace(/ +\n/g, '\n');

  return t;
}

// ─── MECHANICAL CLEANUP (Ch 2) ──────────────────────────────────────────────
function mechanicalCleanup(text) {
  let t = text;

  // Normalize curly quotes to straight quotes
  t = t.replace(/[\u201C\u201D]/g, '"');
  t = t.replace(/[\u2018\u2019]/g, "'");

  // Fix dialogue tags — ensure comma before closing quote when followed by a tag
  // e.g., "Hello." she said → "Hello," she said
  // But only for dialogue tags, not for action beats
  t = t.replace(/"([^"]*?)\."\s+(she said|he said|they said|she whispered|he whispered|she asked|he asked|she replied|he replied|she murmured|he murmured|she snapped|he snapped)/gi,
    (match, dialogue, tag) => `"${dialogue}," ${tag}`
  );

  // Fix unmatched quote pairs where a line has dialogue but starts without opening quote
  // This is conservative — only fix clear cases
  const lines = t.split('\n');
  const fixed = lines.map(line => {
    const quoteCount = (line.match(/"/g) || []).length;
    // If there's exactly one quote and line starts with speech-like text
    if (quoteCount === 1) {
      // If the quote is a closing quote and the line looks like dialogue
      if (line.match(/[,.]"/) && !line.match(/^"/)) {
        // Don't auto-fix — too risky without context
      }
    }
    return line;
  });
  t = fixed.join('\n');

  // Clean up double spaces
  t = t.replace(/  +/g, ' ');
  t = t.replace(/ +\n/g, '\n');

  return t;
}

// ─── STRIP ARTIFACTS FROM REGENERATED TEXT ───────────────────────────────────
function stripArtifacts(text) {
  let t = text;
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<\/think>/gi, '');
  t = t.replace(/\\boxed\{[^}]*\}/g, '');
  // Strip code fences
  t = t.replace(/^```[\s\S]*?```$/gm, '');
  t = t.replace(/```/g, '');
  return t.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const startTime = Date.now();
  log('═══ ANTHOLOGY TARGETED REPAIR PIPELINE — START ═══');

  // ── STEP 1: Setup ──────────────────────────────────────────────────────
  log('STEP 1: Setup and create output directories...');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const sub of SUBDIRS) {
    fs.mkdirSync(path.join(OUT_DIR, sub), { recursive: true });
  }

  // Load before-data
  const beforeData = JSON.parse(fs.readFileSync(BEFORE_SCAN, 'utf-8'));

  // Write triage summary
  const triageMd = buildTriageSummary(beforeData);
  fs.writeFileSync(path.join(OUT_DIR, '01-original-triage-summary.md'), triageMd);
  log('  ✓ 01-original-triage-summary.md written');

  // ── STEP 2: Regenerate Chapters 6, 10, 15 ─────────────────────────────
  log('STEP 2: Regenerating chapters 6, 10, 15 via Ollama...');
  const regenResults = {};

  const PREAMBLE = `You are the prose engine for a professional book-writing app. Write finished manuscript prose ONLY.

RULES:
- NO commentary, analysis, critique, notes, or planning text
- NO phrases: "Analysis & Strengths", "Best Next Move", "Action Plan", "I recommend", "Areas for Refinement"
- Begin directly in scene with action, dialogue, or sensory detail
- Write 3000-5000 words of polished fiction
- Past tense, third-person limited
- End with a story moment, not a philosophical summary
`;

  const STRICT_ADDENDUM = `
CRITICAL: Output ONLY the chapter prose. Absolutely NO notes, critique, analysis, or recommendations. Begin with the first line of the story.
`;

  for (const chNum of REGEN_CHAPTERS) {
    log(`  → Regenerating Chapter ${chNum}: ${CHAPTER_TITLES[chNum]}...`);
    const promptFile = path.join(REGEN_PROMPT_DIR, `regen-chapter-${chapterPad(chNum)}.md`);
    let regenPromptContent;
    try {
      regenPromptContent = fs.readFileSync(promptFile, 'utf-8');
    } catch (e) {
      log(`    ✗ ERROR: Cannot read prompt file ${promptFile}: ${e.message}`);
      regenResults[chNum] = { success: false, error: e.message };
      continue;
    }

    const fullPrompt = PREAMBLE + '\n' + regenPromptContent;

    try {
      const t0 = Date.now();
      let result = await callOllama(fullPrompt);
      result = stripArtifacts(result);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log(`    Generated in ${elapsed}s — ${wordCount(result)} words`);

      // Process leak scan
      const leaks = scanProcessLeaks(result);
      if (leaks.length > 0) {
        log(`    ⚠ Process leaks detected (${leaks.length}), retrying with strict prompt...`);
        const strictPrompt = PREAMBLE + STRICT_ADDENDUM + '\n' + regenPromptContent;
        const t1 = Date.now();
        result = await callOllama(strictPrompt);
        result = stripArtifacts(result);
        const elapsed2 = ((Date.now() - t1) / 1000).toFixed(1);
        log(`    Retry generated in ${elapsed2}s — ${wordCount(result)} words`);

        const leaks2 = scanProcessLeaks(result);
        if (leaks2.length > 0) {
          log(`    ⚠ Still ${leaks2.length} leaks after retry — saving anyway`);
          regenResults[chNum] = { success: true, wordCount: wordCount(result), leaksRemaining: leaks2.length, retried: true };
        } else {
          log(`    ✓ Retry clean — no process leaks`);
          regenResults[chNum] = { success: true, wordCount: wordCount(result), leaksRemaining: 0, retried: true };
        }
      } else {
        log(`    ✓ Clean — no process leaks`);
        regenResults[chNum] = { success: true, wordCount: wordCount(result), leaksRemaining: 0, retried: false };
      }

      const outPath = path.join(OUT_DIR, '02-regenerated-chapters', `chapter-${chapterPad(chNum)}-regen.txt`);
      fs.writeFileSync(outPath, result);
      log(`    ✓ Saved to ${path.basename(outPath)}`);

    } catch (e) {
      log(`    ✗ ERROR regenerating chapter ${chNum}: ${e.message}`);
      regenResults[chNum] = { success: false, error: e.message };
    }
  }

  // ── STEP 3: Mechanical cleanup Chapter 2 ───────────────────────────────
  log('STEP 3: Mechanical cleanup — Chapter 2...');
  const ch2Raw = readChapter(2);
  const ch2Cleaned = mechanicalCleanup(ch2Raw);
  const ch2OutPath = path.join(OUT_DIR, '03-mechanical-cleanup', 'chapter-02-cleaned.txt');
  fs.writeFileSync(ch2OutPath, ch2Cleaned);
  log(`  ✓ chapter-02-cleaned.txt written (${wordCount(ch2Cleaned)} words)`);

  // ── STEP 4: Deep polish Chapters 7, 11, 12, 14, 16, 20 ───────────────
  log('STEP 4: Deep polish — Chapters 7, 11, 12, 14, 16, 20...');
  for (const chNum of DEEP_POLISH_CHAPTERS) {
    const raw = readChapter(chNum);
    const polished = deepPolish(raw, chNum);
    const outPath = path.join(OUT_DIR, '04-deep-polished-chapters', `chapter-${chapterPad(chNum)}-deep.txt`);
    fs.writeFileSync(outPath, polished);
    log(`  ✓ Chapter ${chNum}: ${CHAPTER_TITLES[chNum]} — ${wordCount(polished)} words`);
  }

  // ── STEP 5: Standard polish safe chapters ─────────────────────────────
  log('STEP 5: Standard polish — Chapters 1, 3-5, 8-9, 13, 17-19...');
  for (const chNum of STANDARD_POLISH_CHAPTERS) {
    const raw = readChapter(chNum);
    const polished = standardPolish(raw, chNum);
    const outPath = path.join(OUT_DIR, '05-standard-polished-chapters', `chapter-${chapterPad(chNum)}-polished.txt`);
    fs.writeFileSync(outPath, polished);
    log(`  ✓ Chapter ${chNum}: ${CHAPTER_TITLES[chNum]} — ${wordCount(polished)} words`);
  }

  // ── STEP 6: Reassemble manuscript ─────────────────────────────────────
  log('STEP 6: Reassembling manuscript...');
  let manuscript = '# Digital Equity Tribunal\n\n---\n\n';

  for (let ch = 1; ch <= 20; ch++) {
    let chapterText;
    if (REGEN_CHAPTERS.includes(ch)) {
      const fp = path.join(OUT_DIR, '02-regenerated-chapters', `chapter-${chapterPad(ch)}-regen.txt`);
      if (fs.existsSync(fp)) {
        chapterText = fs.readFileSync(fp, 'utf-8');
      } else {
        // Fallback to original if regen failed
        chapterText = readChapter(ch);
        log(`  ⚠ Chapter ${ch} regen missing, using original`);
      }
    } else if (MECH_CLEANUP_CHAPTERS.includes(ch)) {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '03-mechanical-cleanup', `chapter-${chapterPad(ch)}-cleaned.txt`), 'utf-8');
    } else if (DEEP_POLISH_CHAPTERS.includes(ch)) {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '04-deep-polished-chapters', `chapter-${chapterPad(ch)}-deep.txt`), 'utf-8');
    } else {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '05-standard-polished-chapters', `chapter-${chapterPad(ch)}-polished.txt`), 'utf-8');
    }

    manuscript += `## Chapter ${ch}: ${CHAPTER_TITLES[ch]}\n\n`;
    manuscript += chapterText.trim() + '\n\n---\n\n';
  }

  const msPath = path.join(OUT_DIR, '06-reassembled-manuscript', 'digital-equity-tribunal-repaired.md');
  fs.writeFileSync(msPath, manuscript);
  log(`  ✓ Reassembled manuscript: ${wordCount(manuscript)} total words`);

  // ── STEP 7: Post-repair quality gate ──────────────────────────────────
  log('STEP 7: Running post-repair quality gate...');
  const postScanResults = { scanDate: new Date().toISOString(), totalChapters: 20, chapters: [] };

  for (let ch = 1; ch <= 20; ch++) {
    let chapterText;
    if (REGEN_CHAPTERS.includes(ch)) {
      const fp = path.join(OUT_DIR, '02-regenerated-chapters', `chapter-${chapterPad(ch)}-regen.txt`);
      chapterText = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : readChapter(ch);
    } else if (MECH_CLEANUP_CHAPTERS.includes(ch)) {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '03-mechanical-cleanup', `chapter-${chapterPad(ch)}-cleaned.txt`), 'utf-8');
    } else if (DEEP_POLISH_CHAPTERS.includes(ch)) {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '04-deep-polished-chapters', `chapter-${chapterPad(ch)}-deep.txt`), 'utf-8');
    } else {
      chapterText = fs.readFileSync(path.join(OUT_DIR, '05-standard-polished-chapters', `chapter-${chapterPad(ch)}-polished.txt`), 'utf-8');
    }

    const leaks = scanProcessLeaks(chapterText);
    const slop = countSlop(chapterText);
    const dialogue = checkDialoguePunctuation(chapterText);
    const openEnd = scanOpeningEnding(chapterText);
    const sameness = detectSameness(chapterText);
    const wc = wordCount(chapterText);

    let status = 'PASS';
    if (leaks.length > 0) status = 'FAIL_PROCESS_LEAK';
    else if (slop.flags.some(f => f.includes('HEAVY_SLOP'))) status = 'NEEDS_REVIEW';
    else if (slop.flags.length > 0) status = 'MINOR_FLAGS';

    postScanResults.chapters.push({
      number: ch,
      title: CHAPTER_TITLES[ch],
      wordCount: wc,
      repairAction: REGEN_CHAPTERS.includes(ch) ? 'REGENERATED' :
                    MECH_CLEANUP_CHAPTERS.includes(ch) ? 'MECHANICAL_CLEANUP' :
                    DEEP_POLISH_CHAPTERS.includes(ch) ? 'DEEP_POLISHED' : 'STANDARD_POLISHED',
      processLeak: { status: leaks.length > 0 ? 'FAIL' : 'PASS', leaks },
      slop,
      dialogue,
      openingEnding: openEnd,
      sameness,
      overallStatus: status,
    });
  }

  // Compute anthology-level stats
  const postLeakCount = postScanResults.chapters.filter(c => c.processLeak.leaks.length > 0).length;
  const postHeavySlop = postScanResults.chapters.filter(c => c.slop.flags.some(f => f.includes('HEAVY_SLOP'))).length;
  const avgSameness = (postScanResults.chapters.reduce((s, c) => s + c.sameness.score, 0) / 20).toFixed(1);
  postScanResults.anthologyVerdict = {
    processLeakageCount: postLeakCount,
    heavySlopCount: postHeavySlop,
    averageSamenessScore: parseFloat(avgSameness),
    gateVerdict: postLeakCount === 0 && postHeavySlop <= 2 ? 'PASS' : 'PARTIAL_PASS',
  };

  fs.writeFileSync(
    path.join(OUT_DIR, '07-post-repair-quality-gate', 'post-repair-scan-results.json'),
    JSON.stringify(postScanResults, null, 2)
  );

  // Write post-repair gate report markdown
  const gateReport = buildPostRepairGateReport(postScanResults);
  fs.writeFileSync(
    path.join(OUT_DIR, '07-post-repair-quality-gate', 'post-repair-gate-report.md'),
    gateReport
  );
  log('  ✓ Post-repair quality gate complete');

  // ── STEP 8: Before/after comparison ───────────────────────────────────
  log('STEP 8: Building before/after comparison...');
  const comparisonMd = buildBeforeAfterComparison(beforeData, postScanResults);
  fs.writeFileSync(path.join(OUT_DIR, '08-before-after-comparison.md'), comparisonMd);
  log('  ✓ 08-before-after-comparison.md written');

  // ── STEP 9: Final report ──────────────────────────────────────────────
  log('STEP 9: Writing final repair report...');
  const finalReport = buildFinalReport(beforeData, postScanResults, regenResults, startTime);
  fs.writeFileSync(path.join(OUT_DIR, '09-final-targeted-repair-report.md'), finalReport);
  log('  ✓ 09-final-targeted-repair-report.md written');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`═══ ANTHOLOGY TARGETED REPAIR PIPELINE — COMPLETE (${elapsed}s) ═══`);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function buildTriageSummary(beforeData) {
  let md = `# Original Triage Summary\n\n`;
  md += `**Scan Date:** ${beforeData.scanDate}\n`;
  md += `**Total Chapters:** ${beforeData.totalChapters}\n\n`;
  md += `## Anthology Verdict\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Structural Sameness | ${beforeData.anthologyVerdict.structuralSameness} |\n`;
  md += `| Process Leakage Count | ${beforeData.anthologyVerdict.processLeakageCount} |\n`;
  md += `| Heavy Slop Count | ${beforeData.anthologyVerdict.heavySlopCount} |\n`;
  md += `| Gate Verdict | ${beforeData.anthologyVerdict.gateVerdict} |\n\n`;

  md += `## Chapter Classification\n\n`;
  md += `| Ch | Title | Status | Severity | Action |\n|---|---|---|---|---|\n`;
  for (const ch of beforeData.chapters) {
    md += `| ${ch.number} | ${ch.title} | ${ch.recommendation.status} | ${ch.recommendation.severity} | ${ch.recommendation.action} |\n`;
  }

  md += `\n## Repair Plan\n\n`;
  md += `- **REGENERATE** (Chapters 6, 10, 15): Process leakage detected — regenerate from scratch\n`;
  md += `- **MECHANICAL CLEANUP** (Chapter 2): Dialogue punctuation issues\n`;
  md += `- **DEEP POLISH** (Chapters 7, 11, 12, 14, 16, 20): Heavy AI-slop — deterministic transform\n`;
  md += `- **STANDARD POLISH** (Chapters 1, 3, 4, 5, 8, 9, 13, 17, 18, 19): Light cleanup\n\n`;

  md += `## Stats\n\n`;
  md += `| Category | Count |\n|---|---|\n`;
  md += `| Regenerate | ${beforeData.stats.regen} |\n`;
  md += `| Deep Polish | ${beforeData.stats.deepPolish} |\n`;
  md += `| Mechanical Fix | ${beforeData.stats.mechFix} |\n`;
  md += `| Safe Polish | ${beforeData.stats.safePolish} |\n`;

  return md;
}

function buildPostRepairGateReport(scanResults) {
  let md = `# Post-Repair Quality Gate Report\n\n`;
  md += `**Scan Date:** ${scanResults.scanDate}\n\n`;

  md += `## Anthology Verdict\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Process Leakage Count | ${scanResults.anthologyVerdict.processLeakageCount} |\n`;
  md += `| Heavy Slop Count | ${scanResults.anthologyVerdict.heavySlopCount} |\n`;
  md += `| Avg Sameness Score | ${scanResults.anthologyVerdict.averageSamenessScore} |\n`;
  md += `| Gate Verdict | **${scanResults.anthologyVerdict.gateVerdict}** |\n\n`;

  md += `## Per-Chapter Results\n\n`;
  md += `| Ch | Title | Repair | WC | Leaks | Slop | Dialogue | Sameness | Status |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;
  for (const ch of scanResults.chapters) {
    md += `| ${ch.number} | ${ch.title} | ${ch.repairAction} | ${ch.wordCount} | ${ch.processLeak.leaks.length} | ${ch.slop.totalSlop} | ${ch.dialogue.issues} (${ch.dialogue.severity}) | ${ch.sameness.score} | ${ch.overallStatus} |\n`;
  }

  md += `\n## Process Leak Details\n\n`;
  const leakyChapters = scanResults.chapters.filter(c => c.processLeak.leaks.length > 0);
  if (leakyChapters.length === 0) {
    md += `✅ No process leaks detected in any chapter.\n\n`;
  } else {
    for (const ch of leakyChapters) {
      md += `### Chapter ${ch.number}: ${ch.title}\n\n`;
      for (const leak of ch.processLeak.leaks) {
        md += `- **"${leak.phrase}"** at pos ${leak.position}\n  \`${leak.snippet}\`\n`;
      }
      md += '\n';
    }
  }

  md += `## Slop Flags\n\n`;
  const flaggedChapters = scanResults.chapters.filter(c => c.slop.flags.length > 0);
  if (flaggedChapters.length === 0) {
    md += `✅ No slop flags raised.\n\n`;
  } else {
    for (const ch of flaggedChapters) {
      md += `- **Ch ${ch.number}** (${ch.title}): ${ch.slop.flags.join('; ')}\n`;
    }
    md += '\n';
  }

  md += `## Opening/Ending Issues\n\n`;
  const oeIssues = scanResults.chapters.filter(c =>
    c.openingEnding.openingIssues.length > 0 || c.openingEnding.endingIssues.length > 0
  );
  if (oeIssues.length === 0) {
    md += `✅ No opening/ending issues.\n\n`;
  } else {
    for (const ch of oeIssues) {
      md += `- **Ch ${ch.number}**: `;
      const issues = [...ch.openingEnding.openingIssues, ...ch.openingEnding.endingIssues];
      md += issues.join('; ') + '\n';
    }
    md += '\n';
  }

  return md;
}

function buildBeforeAfterComparison(beforeData, afterData) {
  let md = `# Before/After Comparison\n\n`;
  md += `Pre-repair scan: ${beforeData.scanDate}\n`;
  md += `Post-repair scan: ${afterData.scanDate}\n\n`;

  // Process Leak Comparison
  md += `## Process Leak Count\n\n`;
  md += `| Ch | Title | Before | After | Δ |\n|---|---|---|---|---|\n`;
  for (let i = 0; i < 20; i++) {
    const before = beforeData.chapters[i];
    const after = afterData.chapters[i];
    const bCount = before.processLeak.leaks.length;
    const aCount = after.processLeak.leaks.length;
    const delta = aCount - bCount;
    const deltaStr = delta < 0 ? `✅ ${delta}` : delta > 0 ? `❌ +${delta}` : '—';
    md += `| ${before.number} | ${before.title} | ${bCount} | ${aCount} | ${deltaStr} |\n`;
  }

  // Slop Comparison
  md += `\n## Per-Chapter Slop Counts\n\n`;
  md += `| Ch | Title | Before | After | Δ |\n|---|---|---|---|---|\n`;
  for (let i = 0; i < 20; i++) {
    const before = beforeData.chapters[i];
    const after = afterData.chapters[i];
    const bSlop = before.slop.totalSlop;
    const aSlop = after.slop.totalSlop;
    const delta = aSlop - bSlop;
    const deltaStr = delta < 0 ? `✅ ${delta}` : delta > 0 ? `⚠ +${delta}` : '—';
    md += `| ${before.number} | ${before.title} | ${bSlop} | ${aSlop} | ${deltaStr} |\n`;
  }

  // Word Count Comparison
  md += `\n## Per-Chapter Word Counts\n\n`;
  md += `| Ch | Title | Before | After | Δ |\n|---|---|---|---|---|\n`;
  for (let i = 0; i < 20; i++) {
    const before = beforeData.chapters[i];
    const after = afterData.chapters[i];
    const bWC = before.wordCount;
    const aWC = after.wordCount;
    const delta = aWC - bWC;
    const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '—';
    md += `| ${before.number} | ${before.title} | ${bWC} | ${aWC} | ${deltaStr} |\n`;
  }

  // Sameness Comparison
  md += `\n## Structural Sameness Scores\n\n`;
  md += `| Ch | Title | Before | After | Δ |\n|---|---|---|---|---|\n`;
  for (let i = 0; i < 20; i++) {
    const before = beforeData.chapters[i];
    const after = afterData.chapters[i];
    const bScore = before.sameness.score;
    const aScore = after.sameness.score;
    const delta = aScore - bScore;
    const deltaStr = delta < 0 ? `✅ ${delta}` : delta > 0 ? `⚠ +${delta}` : '—';
    md += `| ${before.number} | ${before.title} | ${bScore} | ${aScore} | ${deltaStr} |\n`;
  }

  // Summary
  const bTotalLeaks = beforeData.chapters.reduce((s, c) => s + c.processLeak.leaks.length, 0);
  const aTotalLeaks = afterData.chapters.reduce((s, c) => s + c.processLeak.leaks.length, 0);
  const bTotalSlop = beforeData.chapters.reduce((s, c) => s + c.slop.totalSlop, 0);
  const aTotalSlop = afterData.chapters.reduce((s, c) => s + c.slop.totalSlop, 0);
  const bTotalWC = beforeData.chapters.reduce((s, c) => s + c.wordCount, 0);
  const aTotalWC = afterData.chapters.reduce((s, c) => s + c.wordCount, 0);
  const bAvgSameness = (beforeData.chapters.reduce((s, c) => s + c.sameness.score, 0) / 20).toFixed(1);
  const aAvgSameness = (afterData.chapters.reduce((s, c) => s + c.sameness.score, 0) / 20).toFixed(1);

  md += `\n## Summary\n\n`;
  md += `| Metric | Before | After | Δ |\n|---|---|---|---|\n`;
  md += `| Total Process Leaks | ${bTotalLeaks} | ${aTotalLeaks} | ${aTotalLeaks - bTotalLeaks} |\n`;
  md += `| Total Slop Instances | ${bTotalSlop} | ${aTotalSlop} | ${aTotalSlop - bTotalSlop} |\n`;
  md += `| Total Word Count | ${bTotalWC} | ${aTotalWC} | ${aTotalWC - bTotalWC} |\n`;
  md += `| Avg Sameness Score | ${bAvgSameness} | ${aAvgSameness} | ${(parseFloat(aAvgSameness) - parseFloat(bAvgSameness)).toFixed(1)} |\n`;

  return md;
}

function buildFinalReport(beforeData, afterData, regenResults, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  let md = `# Final Targeted Repair Report\n\n`;
  md += `**Pipeline Runtime:** ${elapsed}s\n`;
  md += `**Date:** ${new Date().toISOString()}\n\n`;

  md += `## Pipeline Steps Executed\n\n`;
  md += `| Step | Description | Status |\n|---|---|---|\n`;
  md += `| 1 | Setup & Triage Summary | ✅ Complete |\n`;
  md += `| 2 | Regenerate Chs 6, 10, 15 | ${Object.values(regenResults).every(r => r.success) ? '✅ Complete' : '⚠ Partial'} |\n`;
  md += `| 3 | Mechanical Cleanup Ch 2 | ✅ Complete |\n`;
  md += `| 4 | Deep Polish Chs 7,11,12,14,16,20 | ✅ Complete |\n`;
  md += `| 5 | Standard Polish Chs 1,3-5,8-9,13,17-19 | ✅ Complete |\n`;
  md += `| 6 | Reassemble Manuscript | ✅ Complete |\n`;
  md += `| 7 | Post-Repair Quality Gate | ✅ Complete |\n`;
  md += `| 8 | Before/After Comparison | ✅ Complete |\n`;
  md += `| 9 | Final Report | ✅ Complete |\n\n`;

  md += `## Regeneration Results\n\n`;
  md += `| Chapter | Title | Success | Words | Leaks Remaining | Retried |\n|---|---|---|---|---|---|\n`;
  for (const chNum of REGEN_CHAPTERS) {
    const r = regenResults[chNum] || { success: false, error: 'not attempted' };
    if (r.success) {
      md += `| ${chNum} | ${CHAPTER_TITLES[chNum]} | ✅ | ${r.wordCount} | ${r.leaksRemaining} | ${r.retried ? 'Yes' : 'No'} |\n`;
    } else {
      md += `| ${chNum} | ${CHAPTER_TITLES[chNum]} | ❌ | — | — | — |\n`;
    }
  }

  md += `\n## Repair Actions Per Chapter\n\n`;
  md += `| Ch | Title | Action | Before Slop | After Slop | Before Leaks | After Leaks |\n|---|---|---|---|---|---|---|\n`;
  for (let i = 0; i < 20; i++) {
    const before = beforeData.chapters[i];
    const after = afterData.chapters[i];
    let action;
    const ch = before.number;
    if (REGEN_CHAPTERS.includes(ch)) action = 'REGENERATED';
    else if (MECH_CLEANUP_CHAPTERS.includes(ch)) action = 'MECH_CLEANUP';
    else if (DEEP_POLISH_CHAPTERS.includes(ch)) action = 'DEEP_POLISH';
    else action = 'STD_POLISH';

    md += `| ${ch} | ${before.title} | ${action} | ${before.slop.totalSlop} | ${after.slop.totalSlop} | ${before.processLeak.leaks.length} | ${after.processLeak.leaks.length} |\n`;
  }

  // Totals
  const bTotalLeaks = beforeData.chapters.reduce((s, c) => s + c.processLeak.leaks.length, 0);
  const aTotalLeaks = afterData.chapters.reduce((s, c) => s + c.processLeak.leaks.length, 0);
  const bTotalSlop = beforeData.chapters.reduce((s, c) => s + c.slop.totalSlop, 0);
  const aTotalSlop = afterData.chapters.reduce((s, c) => s + c.slop.totalSlop, 0);
  const bTotalWC = beforeData.chapters.reduce((s, c) => s + c.wordCount, 0);
  const aTotalWC = afterData.chapters.reduce((s, c) => s + c.wordCount, 0);

  md += `\n## Aggregate Metrics\n\n`;
  md += `| Metric | Before | After | Change |\n|---|---|---|---|\n`;
  md += `| Chapters with Process Leaks | ${beforeData.anthologyVerdict.processLeakageCount} | ${afterData.anthologyVerdict.processLeakageCount} | ${afterData.anthologyVerdict.processLeakageCount - beforeData.anthologyVerdict.processLeakageCount} |\n`;
  md += `| Total Slop Instances | ${bTotalSlop} | ${aTotalSlop} | ${aTotalSlop - bTotalSlop} |\n`;
  md += `| Total Word Count | ${bTotalWC} | ${aTotalWC} | ${aTotalWC - bTotalWC} |\n`;
  md += `| Total Process Leak Instances | ${bTotalLeaks} | ${aTotalLeaks} | ${aTotalLeaks - bTotalLeaks} |\n`;
  md += `| Gate Verdict | ${beforeData.anthologyVerdict.gateVerdict} | ${afterData.anthologyVerdict.gateVerdict} | — |\n\n`;

  md += `## Post-Repair Quality Gate Verdict\n\n`;
  md += `**${afterData.anthologyVerdict.gateVerdict}**\n\n`;

  if (afterData.anthologyVerdict.processLeakageCount === 0) {
    md += `✅ All process leakage has been eliminated.\n`;
  } else {
    md += `⚠ ${afterData.anthologyVerdict.processLeakageCount} chapter(s) still contain process leaks.\n`;
  }

  if (afterData.anthologyVerdict.heavySlopCount === 0) {
    md += `✅ No chapters flagged for heavy AI-slop.\n`;
  } else {
    md += `⚠ ${afterData.anthologyVerdict.heavySlopCount} chapter(s) still flagged for heavy slop.\n`;
  }

  md += `\n## Output Files\n\n`;
  md += `- \`01-original-triage-summary.md\`\n`;
  md += `- \`02-regenerated-chapters/\` — Regenerated chapters 6, 10, 15\n`;
  md += `- \`03-mechanical-cleanup/\` — Cleaned chapter 2\n`;
  md += `- \`04-deep-polished-chapters/\` — Deep polished chapters 7, 11, 12, 14, 16, 20\n`;
  md += `- \`05-standard-polished-chapters/\` — Standard polished chapters 1, 3-5, 8-9, 13, 17-19\n`;
  md += `- \`06-reassembled-manuscript/digital-equity-tribunal-repaired.md\`\n`;
  md += `- \`07-post-repair-quality-gate/post-repair-gate-report.md\`\n`;
  md += `- \`07-post-repair-quality-gate/post-repair-scan-results.json\`\n`;
  md += `- \`08-before-after-comparison.md\`\n`;
  md += `- \`09-final-targeted-repair-report.md\`\n`;

  return md;
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════
main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
