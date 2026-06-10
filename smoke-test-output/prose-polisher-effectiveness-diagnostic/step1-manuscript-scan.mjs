// =============================================================
// step1-manuscript-scan.mjs
//
// STEP 1: Comprehensive scan of digital-equity-tribunal (5).docx
// for polish failures: malformed grammar, quote issues, slop
// =============================================================

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const outDir = __dirname;

const chaptersJson = JSON.parse(readFileSync(resolve(outDir, 'chapters-v5.json'), 'utf8'));

// ── Malformed grammar patterns ──
const malformedPatterns = [
  { id: 'she-were', regex: /\bShe were\b/gi, label: 'She were' },
  { id: 'he-were', regex: /\bHe were\b/gi, label: 'He were' },
  { id: 'they-was', regex: /\bThey was\b/gi, label: 'They was' },
  { id: 'was-was', regex: /\bWas was\b/gi, label: 'Was was' },
  { id: 'you-was', regex: /\bYou was\b/gi, label: 'You was' },
  { id: 'she-was-it', regex: /\bShe was it\b/gi, label: 'She was it' },
  { id: 'he-was-it', regex: /\bHe was it\b/gi, label: 'He was it' },
  { id: 'were-was', regex: /\bwere was\b/gi, label: 'were was' },
  { id: 'was-were', regex: /\bwas were\b/gi, label: 'was were' },
  { id: 'a-obvious', regex: /\ba obvious\b/gi, label: 'a obvious' },
  { id: 'it-was-it', regex: /\bit was it\b/gi, label: 'it was it' },
  { id: 'dup-aux', regex: /\b(had had|has has|is is|are are|were were|have have)\b/gi, label: 'duplicated auxiliary' },
];

// ── Quote issue patterns ──
function findQuoteIssues(text) {
  const issues = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern: closing quote with dialogue tag but no opening quote
    // e.g.: The game is the model, Marcus," she said
    const closingNoOpen = /[^"""]+(,"|\."|!"|\?")\s*(she|he|they|I|it|we|the|a|[A-Z][a-z]+)\s+(said|whispered|muttered|murmured|replied|answered|countered|corrected|continued|asked|demanded|snapped|insisted|added|announced|declared|noted|observed|offered|suggested|shouted|yelled|called|growled|hissed|sighed|breathed|rasped|barked|exclaimed)/i;
    if (closingNoOpen.test(line) && !line.match(/^["""]/)) {
      // Check if there's really no opening quote
      const openQuotes = (line.match(/["""]/g) || []).length;
      // Rough heuristic: if we have a closing quote pattern but odd number of quotes
      if (openQuotes % 2 !== 0 || openQuotes === 1) {
        const match = line.match(closingNoOpen);
        if (match) {
          issues.push({
            type: 'missing-open-quote',
            line: i + 1,
            snippet: line.substring(0, 100),
            match: match[0].substring(0, 80),
          });
        }
      }
    }

    // Pattern: line ends with ," or ." followed by said/whispered/etc but starts without quote
    const endQuoteDialogue = /[,.]"\s*$/;
    if (endQuoteDialogue.test(line.trim())) {
      // Count quote marks
      const quotes = line.match(/["""""]/g) || [];
      if (quotes.length === 1) {
        issues.push({
          type: 'unpaired-close-quote',
          line: i + 1,
          snippet: line.substring(0, 100),
        });
      }
    }

    // Pattern: straight closing quote with no matching open
    // Look for ," or ." patterns  
    const straightClosePatterns = line.match(/[^"]*,"\s/g) || [];
    for (const p of straightClosePatterns) {
      // Check if the text before the ," has no opening "
      const beforeClose = p.substring(0, p.indexOf(',"'));
      if (!beforeClose.includes('"') && !beforeClose.includes('\u201c') && beforeClose.length > 10) {
        issues.push({
          type: 'straight-close-no-open',
          line: i + 1,
          snippet: p.trim().substring(0, 100),
        });
      }
    }
  }

  return issues;
}

// ── AI slop patterns ──
const slopPatterns = [
  { id: 'not-just', regex: /\bnot just\b/gi, label: 'not just' },
  { id: 'wasnt-just', regex: /\bwasn['']t just\b/gi, label: "wasn't just" },
  { id: 'didnt-just', regex: /\bdidn['']t just\b/gi, label: "didn't just" },
  { id: 'isnt-just', regex: /\bisn['']t just\b/gi, label: "isn't just" },
  { id: 'more-than-just', regex: /\bmore than just\b/gi, label: 'more than just' },
  { id: 'weight-of', regex: /\bthe weight of\b/gi, label: 'the weight of' },
  { id: 'felt', regex: /\bfelt\b/gi, label: 'felt' },
  { id: 'realized', regex: /\brealized\b/gi, label: 'realized' },
  { id: 'narrative', regex: /\bnarrative\b/gi, label: 'narrative' },
  { id: 'performance', regex: /\bperformance\b/gi, label: 'performance' },
  { id: 'system-wasnt', regex: /\bthe system wasn['']t\b/gi, label: "the system wasn't" },
  { id: 'platform-wasnt', regex: /\bthe platform wasn['']t\b/gi, label: "the platform wasn't" },
  { id: 'truth-was', regex: /\bthe truth was\b/gi, label: 'the truth was' },
  { id: 'real-truth', regex: /\bthe real truth\b/gi, label: 'the real truth' },
  { id: 'foundation-of', regex: /\bfoundation of\b/gi, label: 'foundation of' },
  { id: 'woven-into', regex: /\bwoven into\b/gi, label: 'woven into' },
  { id: 'washed-over', regex: /\bwashed over\b/gi, label: 'washed over' },
  { id: 'something-shifted', regex: /\bsomething shifted\b/gi, label: 'something shifted' },
  { id: 'palpable', regex: /\bpalpable\b/gi, label: 'palpable' },
  { id: 'meticulously', regex: /\bmeticulously\b/gi, label: 'meticulously' },
  { id: 'luminous', regex: /\bluminous\b/gi, label: 'luminous' },
  { id: 'ethereal', regex: /\bethereal\b/gi, label: 'ethereal' },
  { id: 'relentless', regex: /\brelentless\b/gi, label: 'relentless' },
];

// ── Scan each chapter ──
console.log('═'.repeat(60));
console.log('STEP 1: Prose Polish Failure Scan — v5.docx');
console.log('═'.repeat(60));

const results = [];

for (const ch of chaptersJson) {
  const text = ch.text;

  // Malformed grammar
  const malformed = [];
  for (const p of malformedPatterns) {
    const matches = [...text.matchAll(p.regex)];
    for (const m of matches) {
      const ctx = text.substring(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\n/g, ' ');
      malformed.push({ pattern: p.label, match: m[0], context: ctx });
    }
  }

  // Quote issues
  const quoteIssues = findQuoteIssues(text);

  // Slop counts
  const slop = {};
  let totalSlop = 0;
  for (const p of slopPatterns) {
    const matches = [...text.matchAll(p.regex)];
    slop[p.id] = matches.length;
    totalSlop += matches.length;
  }

  const severity = malformed.length > 0 ? 'HIGH' :
                   quoteIssues.length > 0 ? 'MEDIUM' :
                   totalSlop > 50 ? 'LOW' : 'OK';

  results.push({
    chapter: ch.number,
    title: ch.title,
    words: ch.words,
    malformedCount: malformed.length,
    malformed,
    quoteIssueCount: quoteIssues.length,
    quoteIssues,
    slopTotal: totalSlop,
    slop,
    severity,
  });

  // Log highlights
  if (malformed.length > 0 || quoteIssues.length > 0) {
    console.log(`\n  Ch.${ch.number} (${ch.title.substring(0, 40)}): malformed=${malformed.length} quotes=${quoteIssues.length} slop=${totalSlop} — ${severity}`);
    for (const m of malformed.slice(0, 3)) {
      console.log(`    ⚠️  [malformed] "${m.match}" → …${m.context.substring(0, 60)}…`);
    }
    for (const q of quoteIssues.slice(0, 3)) {
      console.log(`    ⚠️  [${q.type}] "${q.snippet?.substring(0, 60)}…"`);
    }
  }
}

// ── Write report ──
const reportLines = [
  '# 01 — Exported Manuscript Scan (v5.docx)',
  '',
  `**Date:** ${new Date().toISOString().split('T')[0]}`,
  `**Source:** digital-equity-tribunal (5).docx`,
  `**Chapters:** ${results.length}`,
  '',
  '---',
  '',
  '## Summary',
  '',
  '| Chapter | Title | Words | Malformed | Quotes | Slop Total | Severity |',
  '|---------|-------|-------|-----------|--------|------------|----------|',
];

for (const r of results) {
  reportLines.push(`| ${r.chapter} | ${r.title.substring(0, 40)} | ${r.words} | **${r.malformedCount}** | **${r.quoteIssueCount}** | ${r.slopTotal} | ${r.severity} |`);
}

// Total row
const totalMalformed = results.reduce((s, r) => s + r.malformedCount, 0);
const totalQuotes = results.reduce((s, r) => s + r.quoteIssueCount, 0);
const totalSlopAll = results.reduce((s, r) => s + r.slopTotal, 0);
reportLines.push(`| **TOTAL** | | | **${totalMalformed}** | **${totalQuotes}** | **${totalSlopAll}** | |`);

reportLines.push('');
reportLines.push('---');
reportLines.push('');

// Malformed grammar details
reportLines.push('## Malformed Grammar Failures');
reportLines.push('');
const malformedChapters = results.filter(r => r.malformedCount > 0);
if (malformedChapters.length === 0) {
  reportLines.push('No malformed grammar failures found.');
} else {
  reportLines.push('| Chapter | Pattern | Match | Context |');
  reportLines.push('|---------|---------|-------|---------|');
  for (const r of malformedChapters) {
    for (const m of r.malformed) {
      reportLines.push(`| ${r.chapter} | ${m.pattern} | \`${m.match}\` | …${m.context.substring(0, 60).replace(/\|/g, '\\|')}… |`);
    }
  }
}

reportLines.push('');
reportLines.push('---');
reportLines.push('');

// Quote issues details
reportLines.push('## Dialogue Quote Issues');
reportLines.push('');
const quoteChapters = results.filter(r => r.quoteIssueCount > 0);
if (quoteChapters.length === 0) {
  reportLines.push('No dialogue quote issues found.');
} else {
  reportLines.push('| Chapter | Type | Snippet |');
  reportLines.push('|---------|------|---------|');
  for (const r of quoteChapters) {
    for (const q of r.quoteIssues) {
      reportLines.push(`| ${r.chapter} | ${q.type} | \`${(q.snippet || '').substring(0, 80).replace(/\|/g, '\\|')}\` |`);
    }
  }
}

reportLines.push('');
reportLines.push('---');
reportLines.push('');

// Slop per chapter
reportLines.push('## AI Slop Counts (Top Patterns)');
reportLines.push('');
reportLines.push('| Pattern | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 | Ch6 | Ch7 | Ch8 | Ch9 | Ch10 | Total |');
reportLines.push('|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|-------|');

const topSlop = slopPatterns.filter(p => {
  const total = results.reduce((s, r) => s + (r.slop[p.id] || 0), 0);
  return total > 5;
});

for (const p of topSlop) {
  const counts = results.slice(0, 10).map(r => r.slop[p.id] || 0);
  const total = results.reduce((s, r) => s + (r.slop[p.id] || 0), 0);
  reportLines.push(`| ${p.label} | ${counts.join(' | ')} | **${total}** |`);
}

reportLines.push('');
reportLines.push('---');
reportLines.push('');

// Top offending chapters
reportLines.push('## Top 5 Worst Chapters');
reportLines.push('');
const sorted = [...results].sort((a, b) => (b.malformedCount * 100 + b.quoteIssueCount * 10 + b.slopTotal) - (a.malformedCount * 100 + a.quoteIssueCount * 10 + a.slopTotal));
for (const r of sorted.slice(0, 5)) {
  reportLines.push(`### Ch.${r.chapter}: ${r.title}`);
  reportLines.push(`- **Severity:** ${r.severity}`);
  reportLines.push(`- Malformed: ${r.malformedCount}, Quote issues: ${r.quoteIssueCount}, Slop: ${r.slopTotal}`);
  if (r.malformed.length > 0) {
    reportLines.push('- Malformed examples:');
    for (const m of r.malformed.slice(0, 5)) {
      reportLines.push(`  - \`${m.match}\` → …${m.context.substring(0, 60)}…`);
    }
  }
  if (r.quoteIssues.length > 0) {
    reportLines.push('- Quote examples:');
    for (const q of r.quoteIssues.slice(0, 3)) {
      reportLines.push(`  - [${q.type}] \`${(q.snippet || '').substring(0, 60)}\``);
    }
  }
  reportLines.push('');
}

writeFileSync(resolve(outDir, '01-exported-manuscript-scan.md'), reportLines.join('\n'));
console.log(`\n[STEP1] Report written: 01-exported-manuscript-scan.md`);

// Write JSON for downstream use
writeFileSync(resolve(outDir, 'scan-results.json'), JSON.stringify(results, null, 2));

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${totalMalformed} malformed, ${totalQuotes} quote issues, ${totalSlopAll} slop instances`);
console.log(`Chapters with malformed: ${malformedChapters.length}`);
console.log(`Chapters with quotes: ${quoteChapters.length}`);
console.log(`${'═'.repeat(60)}`);
