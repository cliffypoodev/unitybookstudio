#!/usr/bin/env node
/**
 * Pre-Polish Quality Gate Diagnostic
 * Digital Equity Tribunal — 20-chapter anthology
 *
 * Extracts chapters from DOCX, scans for:
 *   1. Process/critique leakage
 *   2. AI-slop / abstract thesis patterns
 *   3. Dialogue punctuation issues
 *   4. Structural sameness
 *   5. Opening/ending quality
 *
 * Outputs detailed reports and regeneration prompts.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DOCX_PATH = '/Users/cliff/Downloads/digital-equity-tribunal (1).docx';
const OUT_DIR = 'smoke-test-output/anthology-prepolish-gate';
const CHAPTERS_DIR = path.join(OUT_DIR, '01-extracted-chapters');

// ─── Ensure output dirs ───
fs.mkdirSync(CHAPTERS_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════════
// STEP 1 — Extract chapters from DOCX
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 1: Extracting chapters from DOCX ═══\n');

// Use mammoth to extract text from DOCX
let rawText = '';
try {
  // Try using python-docx via python
  const pyScript = `
import sys
try:
    from docx import Document
    doc = Document(sys.argv[1])
    for p in doc.paragraphs:
        print(p.text)
except ImportError:
    # Fallback: use zipfile + xml parsing
    import zipfile
    import xml.etree.ElementTree as ET
    with zipfile.ZipFile(sys.argv[1]) as z:
        with z.open('word/document.xml') as f:
            tree = ET.parse(f)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        texts = []
        for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            if t.text:
                texts.append(t.text)
        print(''.join(texts))
`;
  const tmpPy = path.join(OUT_DIR, '_extract.py');
  fs.writeFileSync(tmpPy, pyScript);
  rawText = execSync(`python3 "${tmpPy}" "${DOCX_PATH}"`, { maxBuffer: 50 * 1024 * 1024 }).toString();
  fs.unlinkSync(tmpPy);
} catch (err) {
  console.error('DOCX extraction failed:', err.message);
  process.exit(1);
}

// Split into chapters
const lines = rawText.split('\n');
const chapters = [];
let currentChapter = null;
let currentLines = [];

for (const line of lines) {
  // Match chapter headings: "Chapter N:", "Story N:", "CHAPTER N", etc.
  const chapterMatch = line.match(/^(?:chapter|story)\s+(\d+)\s*[:\-–—]?\s*(.*)/i);
  if (chapterMatch) {
    if (currentChapter !== null) {
      chapters.push({ number: currentChapter.number, title: currentChapter.title, text: currentLines.join('\n').trim() });
    }
    currentChapter = { number: parseInt(chapterMatch[1]), title: chapterMatch[2].trim() || `Chapter ${chapterMatch[1]}` };
    currentLines = [];
    continue;
  }
  
  // Also match "# Chapter N" or "## Story N:"
  const mdMatch = line.match(/^#{1,3}\s+(?:chapter|story)\s+(\d+)\s*[:\-–—]?\s*(.*)/i);
  if (mdMatch) {
    if (currentChapter !== null) {
      chapters.push({ number: currentChapter.number, title: currentChapter.title, text: currentLines.join('\n').trim() });
    }
    currentChapter = { number: parseInt(mdMatch[1]), title: mdMatch[2].trim() || `Chapter ${mdMatch[1]}` };
    currentLines = [];
    continue;
  }

  if (currentChapter !== null) {
    currentLines.push(line);
  }
}
// Push last chapter
if (currentChapter !== null) {
  chapters.push({ number: currentChapter.number, title: currentChapter.title, text: currentLines.join('\n').trim() });
}

// If no chapters detected with numbering, try splitting on title-like patterns
if (chapters.length === 0) {
  console.log('[EXTRACT] No numbered chapters found. Trying title-based splitting...');
  let chunkIdx = 0;
  let chunk = [];
  for (const line of lines) {
    // Look for all-caps lines or lines that look like story titles
    if (line.trim().length > 3 && line.trim().length < 80 && /^[A-Z]/.test(line.trim()) && chunk.length > 100) {
      chunkIdx++;
      chapters.push({ number: chunkIdx, title: line.trim(), text: chunk.join('\n').trim() });
      chunk = [];
    } else {
      chunk.push(line);
    }
  }
  if (chunk.length > 50) {
    chunkIdx++;
    chapters.push({ number: chunkIdx, title: `Chapter ${chunkIdx}`, text: chunk.join('\n').trim() });
  }
}

// Write individual chapter files
for (const ch of chapters) {
  const pad = String(ch.number).padStart(2, '0');
  const filename = `chapter-${pad}.txt`;
  fs.writeFileSync(path.join(CHAPTERS_DIR, filename), ch.text);
}

console.log(`[EXTRACT] Found ${chapters.length} chapters.`);
if (chapters.length !== 20) {
  console.warn(`[WARNING] Expected 20 chapters, found ${chapters.length}`);
}
for (const ch of chapters) {
  const words = ch.text.split(/\s+/).filter(Boolean).length;
  console.log(`  Ch ${String(ch.number).padStart(2)}: "${ch.title}" — ${words} words`);
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — Process Leakage Scan
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 2: Process Leakage Scan ═══\n');

const HARD_REJECT_PHRASES = [
  'The prose hits all the required marks',
  'Analysis & Strengths', 'Analysis and Strengths',
  'Areas for Refinement', 'Areas for improvement',
  'Best Next Move', 'Best next move',
  'Action Plan', 'Action Plan for Next Section',
  'Constraint Adherence',
  'Show vs. Tell', 'Show vs Tell',
  'Pacing & Tension', 'Pacing and Tension',
  'Voice Consistency',
  'Sensory Density',
  'I recommend',
  'next section',
  'Setup → Inciting Incident', 'Setup -> Inciting Incident',
  'Inciting Incident',
  'Rising Action',
  'The structure is solid',
  "you don't need to polish",
  'The next logical step',
  'The goal is for the reader',
  'Micro-Adjustments',
  'Strengths:', 'Strengths\n',
  'Weaknesses:', 'Weaknesses\n',
  'Critique:', 'Critique\n',
  'Revision notes', 'REVISION NOTES',
  'Here is the revised',
  'I will now',
  'Self-Correction', 'Anticipation Check',
  'Thinking...', 'Thinking…',
  'Checklist:', 'TODO:',
  'CHAPTER NOTES', 'Chapter Notes:',
];

const processLeakResults = [];
for (const ch of chapters) {
  const leaks = [];
  for (const phrase of HARD_REJECT_PHRASES) {
    const idx = ch.text.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(ch.text.length, idx + phrase.length + 40);
      const snippet = ch.text.slice(start, end).replace(/\n/g, ' ');
      leaks.push({ phrase, position: idx, snippet });
    }
  }
  const status = leaks.length > 0 ? 'REGENERATE' : 'PASS';
  processLeakResults.push({ chapter: ch.number, title: ch.title, status, leaks });
  if (leaks.length > 0) {
    console.log(`  Ch ${ch.number}: ❌ REGENERATE — ${leaks.length} leaks found`);
    for (const l of leaks) {
      console.log(`    → "${l.phrase}" at pos ${l.position}`);
    }
  } else {
    console.log(`  Ch ${ch.number}: ✅ PASS`);
  }
}

// Write process leak report
let leakReport = '# Process Leakage Report\n\n';
leakReport += `Scanned ${chapters.length} chapters for ${HARD_REJECT_PHRASES.length} hard-reject phrases.\n\n`;
const leakedChapters = processLeakResults.filter(r => r.status === 'REGENERATE');
leakReport += `## Summary\n- **Chapters with leakage:** ${leakedChapters.length}\n- **Clean chapters:** ${processLeakResults.length - leakedChapters.length}\n\n`;
leakReport += '## Details\n\n';
for (const r of processLeakResults) {
  leakReport += `### Chapter ${r.chapter}: ${r.title}\n`;
  leakReport += `**Status:** ${r.status}\n\n`;
  if (r.leaks.length > 0) {
    for (const l of r.leaks) {
      leakReport += `- **Phrase:** \`${l.phrase}\`\n`;
      leakReport += `  **Position:** ${l.position}\n`;
      leakReport += `  **Snippet:** …${l.snippet}…\n\n`;
    }
  } else {
    leakReport += 'No process leakage detected.\n\n';
  }
}
fs.writeFileSync(path.join(OUT_DIR, '03-process-leak-report.md'), leakReport);

// ═══════════════════════════════════════════════════════════════
// STEP 3 — AI-Slop / Abstract Thesis Scan
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 3: AI-Slop Scan ═══\n');

const SLOP_PHRASES = [
  'not just', 'more than just', "wasn't just", "isn't just",
  'the weight of', 'the narrative', 'the performance',
  "the system wasn't", 'the truth was', 'the secret was',
  'the mystery was', 'the real truth', 'the real problem',
  'the deeper truth', 'the emotional architecture',
  'collective memory', 'collective identity',
  'woven into', 'fabric of', 'foundation of',
  'rot beneath', 'a sense of', 'the air was thick',
  'washed over', "couldn't help but", 'something shifted',
];

const SLOP_SINGLES = ['felt', 'realized', 'palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal', 'relentless'];

const BANNED_WORDS = ['palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal'];

function countOccurrences(text, phrase) {
  const lower = text.toLowerCase();
  const target = phrase.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(target, pos)) !== -1) {
    count++;
    pos += target.length;
  }
  return count;
}

function countWordOccurrences(text, word) {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  return (text.match(regex) || []).length;
}

const slopResults = [];
for (const ch of chapters) {
  const counts = {};
  for (const phrase of SLOP_PHRASES) {
    const c = countOccurrences(ch.text, phrase);
    if (c > 0) counts[phrase] = c;
  }
  for (const word of SLOP_SINGLES) {
    const c = countWordOccurrences(ch.text, word);
    if (c > 0) counts[word] = c;
  }

  const flags = [];
  if ((counts['not just'] || 0) + (counts["wasn't just"] || 0) + (counts["isn't just"] || 0) + (counts['more than just'] || 0) > 5) flags.push('FLAG_HEAVY_SLOP: "not just" family > 5');
  if ((counts['the weight of'] || 0) > 3) flags.push('FLAG_HEAVY_SLOP: "the weight of" > 3');
  if ((counts['the narrative'] || 0) > 5) flags.push('FLAG_HEAVY_SLOP: "narrative" > 5');
  if ((counts['the performance'] || 0) > 5) flags.push('FLAG_HEAVY_SLOP: "performance" > 5');
  if ((counts['felt'] || 0) > 12) flags.push('FLAG_STYLE_REVIEW: "felt" > 12');
  if ((counts['realized'] || 0) > 5) flags.push('FLAG_STYLE_REVIEW: "realized" > 5');

  const bannedFound = BANNED_WORDS.filter(w => (counts[w] || 0) > 0);
  if (bannedFound.length > 0) flags.push(`FLAG_POLISH_REQUIRED: banned words [${bannedFound.join(', ')}]`);

  const totalSlop = Object.values(counts).reduce((a, b) => a + b, 0);
  const isLeaked = processLeakResults.find(r => r.chapter === ch.number)?.status === 'REGENERATE';

  let status;
  if (isLeaked) {
    status = 'REGENERATE';
  } else if (flags.some(f => f.includes('FLAG_HEAVY_SLOP'))) {
    status = 'REWRITE_OR_DEEP_POLISH';
  } else if (flags.length > 0) {
    status = 'SAFE_FOR_POLISH';
  } else {
    status = 'SAFE_FOR_POLISH';
  }

  slopResults.push({ chapter: ch.number, title: ch.title, counts, flags, totalSlop, status });

  const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
  const icon = status === 'REGENERATE' ? '❌' : status === 'REWRITE_OR_DEEP_POLISH' ? '⚠️' : '✅';
  console.log(`  Ch ${String(ch.number).padStart(2)}: ${icon} ${status} — total slop: ${totalSlop}${flagStr}`);
}

// Write AI-slop report
let slopReport = '# AI-Slop / Abstract Thesis Report\n\n';
slopReport += '## Per-Chapter Slop Counts\n\n';
slopReport += '| Chapter | Title | not just | weight | narrative | performance | felt | realized | banned | Total | Status |\n';
slopReport += '|---------|-------|----------|--------|-----------|-------------|------|----------|--------|-------|--------|\n';
for (const r of slopResults) {
  const nj = (r.counts['not just'] || 0) + (r.counts["wasn't just"] || 0) + (r.counts["isn't just"] || 0) + (r.counts['more than just'] || 0);
  const w = r.counts['the weight of'] || 0;
  const n = r.counts['the narrative'] || 0;
  const p = r.counts['the performance'] || 0;
  const f = r.counts['felt'] || 0;
  const rl = r.counts['realized'] || 0;
  const banned = BANNED_WORDS.filter(b => (r.counts[b] || 0) > 0).length;
  slopReport += `| ${r.chapter} | ${r.title.slice(0,30)} | ${nj} | ${w} | ${n} | ${p} | ${f} | ${rl} | ${banned} | ${r.totalSlop} | ${r.status} |\n`;
}
slopReport += '\n## Flags\n\n';
for (const r of slopResults) {
  if (r.flags.length > 0) {
    slopReport += `### Chapter ${r.chapter}: ${r.title}\n`;
    for (const f of r.flags) slopReport += `- ${f}\n`;
    slopReport += '\n';
  }
}
fs.writeFileSync(path.join(OUT_DIR, '04-ai-slop-report.md'), slopReport);

// ═══════════════════════════════════════════════════════════════
// STEP 4 — Dialogue Punctuation Scan
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 4: Dialogue Punctuation Scan ═══\n');

const dialogueResults = [];
for (const ch of chapters) {
  const issues = [];
  const chLines = ch.text.split('\n');

  for (let i = 0; i < chLines.length; i++) {
    const line = chLines[i];

    // Count quotes on this line
    const quoteCount = (line.match(/["""\u201C\u201D]/g) || []).length;

    // Odd number of quotes (potentially unmatched)
    if (quoteCount > 0 && quoteCount % 2 !== 0) {
      // Check for common patterns of missing opening quote
      if (/[^"""\u201C].*["""\u201D]\s*(she|he|they|I)\s+(said|whispered|murmured|replied|asked|shouted)/i.test(line)) {
        issues.push({ line: i + 1, type: 'MISSING_OPEN_QUOTE', severity: 'CRITICAL', snippet: line.slice(0, 120) });
      } else {
        issues.push({ line: i + 1, type: 'UNMATCHED_QUOTES', severity: 'MINOR', snippet: line.slice(0, 120) });
      }
    }

    // Dialogue after narration with no opening quote
    if (/[a-z],\s*[A-Z][a-z]+.*[""\u201D]/.test(line) && !/[""\u201C]/.test(line.slice(0, line.indexOf(',')))) {
      // Only flag if there's a closing quote but the text before comma has no opening
      const beforeComma = line.slice(0, line.indexOf(','));
      const afterComma = line.slice(line.indexOf(','));
      if (/[""\u201D]/.test(afterComma) && !(/[""\u201C]/.test(afterComma.slice(0, afterComma.indexOf('"'))))) {
        // Heuristic; might be false positive
      }
    }

    // Patterns like: No," she said / Yes," he said (missing opening quote)
    if (/^[A-Z][a-z]+,[""\u201D]\s*(she|he|they|I)\s+(said|whispered)/i.test(line.trim())) {
      issues.push({ line: i + 1, type: 'MISSING_OPEN_QUOTE_PATTERN', severity: 'CRITICAL', snippet: line.trim().slice(0, 120) });
    }

    // Dialogue paragraphs > 150 words
    if (/[""\u201C]/.test(line) && line.split(/\s+/).length > 150) {
      issues.push({ line: i + 1, type: 'LONG_DIALOGUE_PARAGRAPH', severity: 'MINOR', snippet: line.slice(0, 120) + '...' });
    }
  }

  // Count total quotes in chapter for balance check
  const totalOpen = (ch.text.match(/["\u201C]/g) || []).length;
  const totalClose = (ch.text.match(/["\u201D]/g) || []).length;
  if (Math.abs(totalOpen - totalClose) > 2) {
    issues.push({ line: 0, type: 'QUOTE_IMBALANCE', severity: 'CRITICAL', snippet: `Open: ${totalOpen}, Close: ${totalClose}, Diff: ${Math.abs(totalOpen - totalClose)}` });
  }

  const severity = issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : issues.length > 0 ? 'MINOR' : 'CLEAN';
  dialogueResults.push({ chapter: ch.number, title: ch.title, issues, severity });

  const icon = severity === 'CRITICAL' ? '❌' : severity === 'MINOR' ? '⚠️' : '✅';
  console.log(`  Ch ${String(ch.number).padStart(2)}: ${icon} ${severity} — ${issues.length} issues`);
}

// Write dialogue report
let dialogueReport = '# Dialogue Punctuation Report\n\n';
dialogueReport += '| Chapter | Title | Issues | Severity | Example |\n';
dialogueReport += '|---------|-------|--------|----------|--------|\n';
for (const r of dialogueResults) {
  const ex = r.issues[0]?.snippet || 'clean';
  dialogueReport += `| ${r.chapter} | ${r.title.slice(0,30)} | ${r.issues.length} | ${r.severity} | ${ex.slice(0,60)} |\n`;
}
dialogueReport += '\n## Details\n\n';
for (const r of dialogueResults) {
  if (r.issues.length > 0) {
    dialogueReport += `### Chapter ${r.chapter}: ${r.title}\n\n`;
    for (const iss of r.issues) {
      dialogueReport += `- **Line ${iss.line}** [${iss.severity}] ${iss.type}: \`${iss.snippet.slice(0,100)}\`\n`;
    }
    dialogueReport += '\n';
  }
}
fs.writeFileSync(path.join(OUT_DIR, '05-dialogue-punctuation-report.md'), dialogueReport);

// ═══════════════════════════════════════════════════════════════
// STEP 5 — Chapter Opening & Ending Scan
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 5: Opening & Ending Scan ═══\n');

const openEndResults = [];
for (const ch of chapters) {
  const words = ch.text.split(/\s+/).filter(Boolean);
  const first150 = words.slice(0, 150).join(' ');
  const last150 = words.slice(-150).join(' ');

  const openingFlags = [];
  const endingFlags = [];

  // Opening checks
  for (const phrase of HARD_REJECT_PHRASES) {
    if (first150.toLowerCase().includes(phrase.toLowerCase())) {
      openingFlags.push(`PROCESS_LEAK_OPENING: "${phrase}"`);
    }
  }
  if (/^the air\b/i.test(first150)) openingFlags.push('ATMOSPHERE_CLICHE: starts with "The air…"');
  if (/^the weight\b/i.test(first150)) openingFlags.push('ATMOSPHERE_CLICHE: starts with "The weight…"');

  // Ending checks
  for (const phrase of HARD_REJECT_PHRASES) {
    if (last150.toLowerCase().includes(phrase.toLowerCase())) {
      endingFlags.push(`PROCESS_LEAK_ENDING: "${phrase}"`);
    }
  }
  // Philosophical summary ending
  const philosophicalEndings = ['the truth was', 'the real truth', 'the deeper truth', 'in the end', 'what mattered was', 'what remained was', 'all that remained'];
  for (const pe of philosophicalEndings) {
    if (last150.toLowerCase().includes(pe)) {
      endingFlags.push(`PHILOSOPHICAL_ENDING: "${pe}"`);
    }
  }

  openEndResults.push({
    chapter: ch.number,
    title: ch.title,
    first150,
    last150,
    openingFlags,
    endingFlags,
    openOk: openingFlags.length === 0,
    endOk: endingFlags.length === 0,
  });

  const oIcon = openingFlags.length > 0 ? '⚠️' : '✅';
  const eIcon = endingFlags.length > 0 ? '⚠️' : '✅';
  console.log(`  Ch ${String(ch.number).padStart(2)}: Opening ${oIcon}${openingFlags.length > 0 ? ' [' + openingFlags[0] + ']' : ''} | Ending ${eIcon}${endingFlags.length > 0 ? ' [' + endingFlags[0] + ']' : ''}`);
}

// ═══════════════════════════════════════════════════════════════
// STEP 6 — Structural Sameness Scan
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 6: Structural Sameness Scan ═══\n');

function checkFormulaBeats(text) {
  const lower = text.toLowerCase();
  let score = 0;
  const beats = [];

  // A. protagonist is expert in a system
  const expertPatterns = ['expert', 'specialized in', 'mastered', 'years of experience', 'trained in', 'her specialty', 'his specialty', 'leading authority', 'pioneer', 'architect of', 'designed the', 'built the system', 'creator of', 'she had built', 'he had built', 'understood the system'];
  if (expertPatterns.some(p => lower.includes(p))) { score++; beats.push('A: protagonist-as-expert'); }

  // B. system quantifies their defining trait
  const quantifyPatterns = ['score', 'rating', 'metric', 'index', 'algorithm', 'quantif', 'measur', 'calculated', 'assessed', 'evaluated', 'percentile', 'ranked', 'points', 'coefficient', 'data point'];
  const quantifyCount = quantifyPatterns.filter(p => lower.includes(p)).length;
  if (quantifyCount >= 3) { score++; beats.push('B: system-quantifies-trait'); }

  // C. authority figure explains monetization/optimization
  const authPatterns = ['monetiz', 'optimiz', 'efficien', 'profit', 'revenue', 'capital', 'value extraction', 'market', 'commodif', 'commercializ', 'tribunal', 'commissioner', 'director', 'overseer', 'administrator'];
  const authCount = authPatterns.filter(p => lower.includes(p)).length;
  if (authCount >= 3) { score++; beats.push('C: authority-explains-monetization'); }

  // D. protagonist identifies flaw
  const flawPatterns = ['flaw', 'loophole', 'error', 'bug', 'glitch', 'discrepancy', 'anomaly', 'contradiction', 'noticed something', 'saw the crack', 'realized the flaw', 'the system had missed', 'overlooked'];
  if (flawPatterns.some(p => lower.includes(p))) { score++; beats.push('D: protagonist-finds-flaw'); }

  // E. hidden deeper layer is revealed
  const layerPatterns = ['deeper layer', 'hidden', 'beneath the surface', 'what lay beneath', 'the real purpose', 'the true', 'revealed', 'unmasked', 'the system was actually', 'designed to', 'all along', 'the deeper', 'underneath'];
  const layerCount = layerPatterns.filter(p => lower.includes(p)).length;
  if (layerCount >= 2) { score++; beats.push('E: hidden-layer-revealed'); }

  // F. story ends with philosophical realization
  const lastQuarter = lower.slice(Math.floor(lower.length * 0.75));
  const philoPatterns = ['realized', 'understood', 'the truth', 'what it meant', 'what it really meant', 'the real', 'the deeper', 'in that moment', 'finally understood', 'came to understand', 'saw clearly', 'the system was', 'perhaps', 'maybe that was', 'and that was'];
  const philoCount = philoPatterns.filter(p => lastQuarter.includes(p)).length;
  if (philoCount >= 2) { score++; beats.push('F: philosophical-ending'); }

  return { score, beats };
}

const samenessResults = [];
for (const ch of chapters) {
  const { score, beats } = checkFormulaBeats(ch.text);
  samenessResults.push({ chapter: ch.number, title: ch.title, score, beats });

  const bar = '█'.repeat(score) + '░'.repeat(6 - score);
  const icon = score >= 5 ? '🔴' : score >= 3 ? '🟡' : '🟢';
  console.log(`  Ch ${String(ch.number).padStart(2)}: ${icon} ${bar} ${score}/6 — ${beats.join(', ') || 'unique structure'}`);
}

const highSamenessCount = samenessResults.filter(r => r.score >= 5).length;
const anthologyStructureStatus = highSamenessCount >= 12 ? 'STRUCTURAL_VARIETY_NEEDED' : highSamenessCount >= 8 ? 'MODERATE_SAMENESS' : 'ACCEPTABLE';
console.log(`\n  Anthology-level: ${anthologyStructureStatus} (${highSamenessCount}/20 chapters score 5-6)`);

// Write structural sameness report
let samenessReport = '# Structural Sameness Report\n\n';
samenessReport += '## Formula Pattern\n\n';
samenessReport += 'Each chapter is scored 0-6 based on how many of these beats appear:\n\n';
samenessReport += '- A: Protagonist is expert in a system\n';
samenessReport += '- B: System quantifies their defining trait\n';
samenessReport += '- C: Authority figure explains monetization/optimization\n';
samenessReport += '- D: Protagonist identifies flaw\n';
samenessReport += '- E: Hidden deeper layer is revealed\n';
samenessReport += '- F: Story ends with philosophical realization\n\n';
samenessReport += '## Per-Chapter Scores\n\n';
samenessReport += '| Chapter | Title | Score | Beats |\n';
samenessReport += '|---------|-------|-------|-------|\n';
for (const r of samenessResults) {
  samenessReport += `| ${r.chapter} | ${r.title.slice(0,35)} | ${r.score}/6 | ${r.beats.join(', ') || 'none'} |\n`;
}
samenessReport += `\n## Anthology-Level Verdict\n\n**Status:** ${anthologyStructureStatus}\n\n`;
samenessReport += `Chapters scoring 5-6: ${highSamenessCount}/20\n`;
fs.writeFileSync(path.join(OUT_DIR, '06-structural-sameness-report.md'), samenessReport);

// ═══════════════════════════════════════════════════════════════
// STEP 7 — Regeneration Recommendations
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 7: Regeneration Recommendations ═══\n');

const recommendations = [];
for (const ch of chapters) {
  const leak = processLeakResults.find(r => r.chapter === ch.number);
  const slop = slopResults.find(r => r.chapter === ch.number);
  const dial = dialogueResults.find(r => r.chapter === ch.number);
  const same = samenessResults.find(r => r.chapter === ch.number);

  let status, mainIssue, severity, action;

  if (leak.status === 'REGENERATE') {
    status = 'REGENERATE';
    mainIssue = 'PROCESS_LEAKAGE';
    severity = 'CRITICAL';
    action = 'Regenerate from scratch. Do not polish.';
  } else if (slop.status === 'REWRITE_OR_DEEP_POLISH') {
    status = 'REWRITE_OR_DEEP_POLISH';
    mainIssue = 'HEAVY_AI_SLOP';
    severity = 'HIGH';
    action = 'Deep polish or partial rewrite to remove slop patterns.';
  } else if (dial.severity === 'CRITICAL') {
    status = 'SAFE_FOR_MECHANICAL_CLEANUP';
    mainIssue = 'DIALOGUE_PUNCTUATION';
    severity = 'MEDIUM';
    action = 'Fix dialogue punctuation before polish.';
  } else if (slop.flags.length > 0 || dial.issues.length > 0) {
    status = 'SAFE_FOR_POLISH';
    mainIssue = 'MINOR_CLEANUP_NEEDED';
    severity = 'LOW';
    action = 'Standard polish pass will address remaining issues.';
  } else {
    status = 'SAFE_FOR_POLISH';
    mainIssue = 'CLEAN';
    severity = 'NONE';
    action = 'Ready for polish.';
  }

  recommendations.push({ chapter: ch.number, title: ch.title, status, mainIssue, severity, action, formulaScore: same.score });
}

// Print recommendation table
console.log('  Chapter | Status                    | Main Issue          | Severity | Action');
console.log('  --------|---------------------------|--------------------|-----------|---------');
for (const r of recommendations) {
  console.log(`  ${String(r.chapter).padStart(7)} | ${r.status.padEnd(25)} | ${r.mainIssue.padEnd(18)} | ${r.severity.padEnd(9)} | ${r.action.slice(0,50)}`);
}

// Write recommendations report
let recoReport = '# Rewrite Recommendations\n\n';
recoReport += '| Chapter | Title | Status | Main Issue | Severity | Action |\n';
recoReport += '|---------|-------|--------|------------|----------|--------|\n';
for (const r of recommendations) {
  recoReport += `| ${r.chapter} | ${r.title.slice(0,30)} | ${r.status} | ${r.mainIssue} | ${r.severity} | ${r.action} |\n`;
}
fs.writeFileSync(path.join(OUT_DIR, '07-rewrite-recommendations.md'), recoReport);

// ═══════════════════════════════════════════════════════════════
// STEP 8 — Regeneration Prompts for Bad Chapters
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 8: Building Regeneration Prompts ═══\n');

const regenChapters = recommendations.filter(r => r.status === 'REGENERATE');
const promptsDir = path.join(OUT_DIR, '09-regeneration-prompts');
fs.mkdirSync(promptsDir, { recursive: true });

for (const r of regenChapters) {
  const ch = chapters.find(c => c.number === r.chapter);
  const leak = processLeakResults.find(l => l.chapter === r.chapter);
  const same = samenessResults.find(s => s.chapter === r.chapter);

  let prompt = `# Regeneration Prompt — Chapter ${r.chapter}: ${r.title}

## Context
Anthology: Digital Equity Tribunal (20-story speculative fiction anthology)
Chapter: ${r.chapter} of 20
Title: ${r.title}

## Why This Chapter Is Being Regenerated
`;

  if (r.chapter === 6) {
    prompt += `The previous Chapter 6 output was contaminated with editorial critique and planning notes. Regenerate Chapter 6 from scratch as finished fiction prose only. Do not include analysis, strengths, refinement notes, action plans, critique, or explanation.\n\n`;
  }

  if (leak.leaks.length > 0) {
    prompt += `The previous output contained process/critique leakage:\n`;
    for (const l of leak.leaks) {
      prompt += `- "${l.phrase}"\n`;
    }
    prompt += '\n';
  }

  prompt += `## MANDATORY RULES

1. Output ONLY finished manuscript prose. No commentary, no analysis, no notes.
2. Do NOT include any of these phrases: "Analysis & Strengths", "Areas for Refinement", "Best Next Move", "Action Plan", "Constraint Adherence", "Show vs. Tell", "Pacing & Tension", "Voice Consistency", "Sensory Density", "I recommend", "Critique", "Revision notes", "Here is the revised", "I will now", "Self-Correction", "Anticipation Check", "Thinking...", "Checklist", "TODO"
3. Begin directly in scene. First line must be action, dialogue, or sensory detail.
4. Write 3000-5000 words of polished fiction.
5. The chapter must have a complete story arc: opening hook → escalation → climax → resolution.
6. Use concrete sensory details, not abstract commentary.
7. AVOID these AI-slop patterns: "not just", "the weight of", "the narrative", "the performance", "woven into", "fabric of", "couldn't help but", "a sense of", "the air was thick", "palpable", "meticulously"
`;

  if (same.score >= 5) {
    prompt += `
8. STRUCTURAL VARIETY REQUIRED: The previous version followed the repetitive formula (expert → system quantifies trait → authority explains → protagonist finds flaw → hidden layer → philosophical ending). Break this pattern:
   - Consider starting from the perspective of someone AFFECTED by the system, not the expert
   - Or start mid-crisis rather than during a routine evaluation
   - Or end with action/consequence rather than philosophical reflection
   - Use a different dramatic engine than "expert discovers hidden layer"
`;
  }

  prompt += `
## Chapter Concept (preserve this, rewrite the execution)
Title: ${r.title}
The chapter should explore the theme of digital equity, algorithmic justice, or technological surveillance through a fresh narrative lens specific to this chapter's title.

## Output Format
Write the complete chapter as prose. No headers except the chapter title. No notes. No analysis. Begin writing now.
`;

  const padNum = String(r.chapter).padStart(2, '0');
  fs.writeFileSync(path.join(promptsDir, `regen-chapter-${padNum}.md`), prompt);
  console.log(`  Created regeneration prompt: regen-chapter-${padNum}.md`);
}

if (regenChapters.length === 0) {
  console.log('  No chapters require regeneration.');
}

// ═══════════════════════════════════════════════════════════════
// STEP 9 — Final Pre-Polish Gate Report
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ STEP 9: Building Final Gate Report ═══\n');

let finalReport = '# Pre-Polish Quality Gate Report\n\n';
finalReport += `**Anthology:** Digital Equity Tribunal\n`;
finalReport += `**Chapters:** ${chapters.length}\n`;
finalReport += `**Scan Date:** ${new Date().toISOString()}\n\n`;

// TABLE 1 — Chapter Gate Status
finalReport += '## TABLE 1 — Chapter Gate Status\n\n';
finalReport += '| Chapter | Title | Status | Reason | Severity | Recommended Action |\n';
finalReport += '|---------|-------|--------|--------|----------|--------------------|\n';
for (const r of recommendations) {
  finalReport += `| ${r.chapter} | ${r.title.slice(0,30)} | ${r.status} | ${r.mainIssue} | ${r.severity} | ${r.action} |\n`;
}

// TABLE 2 — Process Leakage
finalReport += '\n## TABLE 2 — Process Leakage\n\n';
finalReport += '| Chapter | Phrase Found | Snippet | Action |\n';
finalReport += '|---------|-------------|---------|--------|\n';
for (const r of processLeakResults) {
  if (r.leaks.length > 0) {
    for (const l of r.leaks) {
      finalReport += `| ${r.chapter} | ${l.phrase} | …${l.snippet.slice(0,60)}… | REGENERATE |\n`;
    }
  }
}
if (leakedChapters.length === 0) finalReport += '| — | No leakage detected | — | — |\n';

// TABLE 3 — AI-Slop Counts
finalReport += '\n## TABLE 3 — AI-Slop Counts\n\n';
finalReport += '| Ch | not just | weight | narrative | performance | felt | realized | banned | Status |\n';
finalReport += '|----|----------|--------|-----------|-------------|------|----------|--------|--------|\n';
for (const r of slopResults) {
  const nj = (r.counts['not just'] || 0) + (r.counts["wasn't just"] || 0) + (r.counts["isn't just"] || 0) + (r.counts['more than just'] || 0);
  const w = r.counts['the weight of'] || 0;
  const n = r.counts['the narrative'] || 0;
  const p = r.counts['the performance'] || 0;
  const f = r.counts['felt'] || 0;
  const rl = r.counts['realized'] || 0;
  const banned = BANNED_WORDS.filter(b => (r.counts[b] || 0) > 0).join(', ') || '—';
  finalReport += `| ${r.chapter} | ${nj} | ${w} | ${n} | ${p} | ${f} | ${rl} | ${banned} | ${r.status} |\n`;
}

// TABLE 4 — Dialogue Issues
finalReport += '\n## TABLE 4 — Dialogue Issues\n\n';
finalReport += '| Chapter | Issue Count | Severity | Example | Fix |\n';
finalReport += '|---------|------------|----------|---------|-----|\n';
for (const r of dialogueResults) {
  const ex = r.issues[0]?.snippet?.slice(0, 60) || 'clean';
  const fix = r.severity === 'CRITICAL' ? 'Manual fix before polish' : r.severity === 'MINOR' ? 'Polish pass will fix' : 'None needed';
  finalReport += `| ${r.chapter} | ${r.issues.length} | ${r.severity} | ${ex} | ${fix} |\n`;
}

// TABLE 5 — Structural Sameness
finalReport += '\n## TABLE 5 — Structural Sameness\n\n';
finalReport += '| Chapter | Title | Formula Score | Notes |\n';
finalReport += '|---------|-------|---------------|-------|\n';
for (const r of samenessResults) {
  finalReport += `| ${r.chapter} | ${r.title.slice(0,30)} | ${r.score}/6 | ${r.beats.join(', ') || 'unique'} |\n`;
}

// TABLE 6 — Anthology-Level Verdict
finalReport += '\n## TABLE 6 — Anthology-Level Verdict\n\n';
finalReport += '| Metric | Result | Notes |\n';
finalReport += '|--------|--------|-------|\n';
finalReport += `| Total Chapters | ${chapters.length} | ${chapters.length === 20 ? 'Expected count' : '⚠️ Expected 20'} |\n`;
finalReport += `| Process Leakage | ${leakedChapters.length} chapters | ${leakedChapters.length > 0 ? leakedChapters.map(c => 'Ch ' + c.chapter).join(', ') : 'None'} |\n`;
finalReport += `| Heavy Slop | ${slopResults.filter(r => r.status === 'REWRITE_OR_DEEP_POLISH').length} chapters | Threshold exceeded |\n`;
finalReport += `| Dialogue Critical | ${dialogueResults.filter(r => r.severity === 'CRITICAL').length} chapters | |\n`;
finalReport += `| Structural Sameness | ${anthologyStructureStatus} | ${highSamenessCount}/20 score 5-6 |\n`;
finalReport += `| Chapters to Regenerate | ${regenChapters.length} | |\n`;
finalReport += `| Chapters Safe for Polish | ${recommendations.filter(r => r.status === 'SAFE_FOR_POLISH').length} | |\n`;
finalReport += `| Chapters Need Deep Polish | ${recommendations.filter(r => r.status === 'REWRITE_OR_DEEP_POLISH').length} | |\n`;
finalReport += `| Chapters Need Mechanical Fix | ${recommendations.filter(r => r.status === 'SAFE_FOR_MECHANICAL_CLEANUP').length} | |\n`;

// TABLE 7 — Rewrite Queue
finalReport += '\n## TABLE 7 — Rewrite Queue\n\n';
finalReport += '| Chapter | Action | Regeneration Needed? | Prompt File |\n';
finalReport += '|---------|--------|---------------------|-------------|\n';
for (const r of recommendations) {
  const needsRegen = r.status === 'REGENERATE';
  const promptFile = needsRegen ? `09-regeneration-prompts/regen-chapter-${String(r.chapter).padStart(2, '0')}.md` : '—';
  finalReport += `| ${r.chapter} | ${r.status} | ${needsRegen ? 'YES' : 'No'} | ${promptFile} |\n`;
}

// Summary stats
const stats = {
  regen: recommendations.filter(r => r.status === 'REGENERATE').length,
  deepPolish: recommendations.filter(r => r.status === 'REWRITE_OR_DEEP_POLISH').length,
  mechFix: recommendations.filter(r => r.status === 'SAFE_FOR_MECHANICAL_CLEANUP').length,
  safePolish: recommendations.filter(r => r.status === 'SAFE_FOR_POLISH').length,
};

finalReport += `\n## Summary\n\n`;
finalReport += `- 🔴 **REGENERATE:** ${stats.regen} chapters\n`;
finalReport += `- 🟠 **REWRITE_OR_DEEP_POLISH:** ${stats.deepPolish} chapters\n`;
finalReport += `- 🟡 **SAFE_FOR_MECHANICAL_CLEANUP:** ${stats.mechFix} chapters\n`;
finalReport += `- 🟢 **SAFE_FOR_POLISH:** ${stats.safePolish} chapters\n\n`;

finalReport += `### Gate Verdict\n\n`;
if (stats.regen === 0 && stats.deepPolish === 0) {
  finalReport += `✅ **ALL CHAPTERS PASS** — proceed to polish.\n`;
} else if (stats.regen > 10) {
  finalReport += `❌ **MAJORITY REGENERATION NEEDED** — ${stats.regen}/20 chapters require regeneration. Consider re-running Draft All with improved prompts.\n`;
} else {
  finalReport += `⚠️ **PARTIAL PASS** — ${stats.safePolish + stats.mechFix} chapters can proceed. ${stats.regen} need regeneration, ${stats.deepPolish} need deep polish.\n`;
}

fs.writeFileSync(path.join(OUT_DIR, '08-final-prepolish-gate-report.md'), finalReport);

// Write scan results JSON
const scanResults = {
  scanDate: new Date().toISOString(),
  totalChapters: chapters.length,
  chapters: chapters.map(ch => ({
    number: ch.number,
    title: ch.title,
    wordCount: ch.text.split(/\s+/).filter(Boolean).length,
    recommendation: recommendations.find(r => r.chapter === ch.number),
    processLeak: processLeakResults.find(r => r.chapter === ch.number),
    slop: slopResults.find(r => r.chapter === ch.number),
    dialogue: { ...dialogueResults.find(r => r.chapter === ch.number), issues: dialogueResults.find(r => r.chapter === ch.number)?.issues?.length || 0 },
    sameness: samenessResults.find(r => r.chapter === ch.number),
  })),
  anthologyVerdict: {
    structuralSameness: anthologyStructureStatus,
    processLeakageCount: leakedChapters.length,
    heavySlopCount: slopResults.filter(r => r.status === 'REWRITE_OR_DEEP_POLISH').length,
    gateVerdict: stats.regen > 10 ? 'FAIL_MAJORITY' : stats.regen > 0 ? 'PARTIAL_PASS' : 'PASS',
  },
  stats,
};
fs.writeFileSync(path.join(OUT_DIR, '02-chapter-scan-results.json'), JSON.stringify(scanResults, null, 2));

// ═══════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log('  PRE-POLISH QUALITY GATE — FINAL SUMMARY');
console.log('═'.repeat(60));
console.log(`  Chapters extracted:        ${chapters.length}`);
console.log(`  Process leakage found:     ${leakedChapters.length} chapters`);
console.log(`  Heavy AI-slop:             ${slopResults.filter(r => r.status === 'REWRITE_OR_DEEP_POLISH').length} chapters`);
console.log(`  Dialogue critical:         ${dialogueResults.filter(r => r.severity === 'CRITICAL').length} chapters`);
console.log(`  Structural sameness:       ${anthologyStructureStatus}`);
console.log('  ────────────────────────────────────────');
console.log(`  🔴 REGENERATE:             ${stats.regen}`);
console.log(`  🟠 DEEP POLISH:            ${stats.deepPolish}`);
console.log(`  🟡 MECHANICAL FIX:         ${stats.mechFix}`);
console.log(`  🟢 SAFE FOR POLISH:        ${stats.safePolish}`);
console.log('═'.repeat(60));
console.log(`\n  Reports written to: ${OUT_DIR}/`);
console.log('  Done.\n');
