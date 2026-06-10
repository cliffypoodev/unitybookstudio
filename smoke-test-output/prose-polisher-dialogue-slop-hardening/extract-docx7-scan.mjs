// Extract text from DOCX7 and scan for dialogue issues and slop patterns
import mammoth from 'mammoth';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DOCX_PATH = '/Users/cliff/Downloads/digital-equity-tribunal (7).docx';
const OUT_DIR = '/Users/cliff/Downloads/UBS/smoke-test-output/prose-polisher-dialogue-slop-hardening';

mkdirSync(OUT_DIR, { recursive: true });

// Extract raw text
const result = await mammoth.extractRawText({ path: DOCX_PATH });
const fullText = result.value;

// Split into chapters
const chapterSplits = fullText.split(/(?=Chapter \d+[:\s])/);
const chapters = [];
for (const block of chapterSplits) {
  const match = block.match(/^Chapter (\d+)[:\s]+(.+?)(?:\n|$)/);
  if (match) {
    chapters.push({
      number: parseInt(match[1]),
      title: match[2].trim(),
      text: block.trim(),
    });
  }
}

console.log(`Extracted ${chapters.length} chapters from DOCX7\n`);

// ── DIALOGUE QUOTE ISSUE DETECTION ──
const DIALOGUE_TAGS = /\b(?:she|he|they|it|the system|Aether|Marcus|Elena|Zara|Kai)\s+(?:said|asked|replied|countered|retorted|corrected|whispered|murmured|demanded|challenged|confirmed|repeated|continued|interrupted|admitted|added|protested|agreed|insisted|observed|noted|announced|warned|explained|suggested|offered|prompted|conceded|argued|snapped|snarled|growled|muttered)\b/i;

function detectDialogueQuoteIssues(text) {
  const issues = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Pattern 1: Line/sentence contains ," or ." or ?" or !" followed by dialogue tag,
    // but the matching opening quote is missing
    // Look for: text," dialogue_tag  where text before ," has no opening quote
    const closeQuoteTagPattern = /([^"\u201c\u201d]{3,}?[,.])([\"\u201d])\s+(she|he|they|it|the system|Aether|Marcus|Elena|Zara|Kai)\s+(said|asked|replied|countered|retorted|corrected|whispered|murmured|demanded|challenged|confirmed|repeated|continued|interrupted|admitted|added|protested|agreed|insisted|observed|noted|announced|warned|explained|suggested|offered|prompted|conceded|argued|snapped|snarled|growled|muttered)/gi;
    
    let m;
    while ((m = closeQuoteTagPattern.exec(line)) !== null) {
      const beforeMatch = line.substring(0, m.index);
      // Count opening quotes before this point
      const openQuotes = (beforeMatch.match(/[\"\u201c]/g) || []).length;
      const closeQuotes = (beforeMatch.match(/[\"\u201d]/g) || []).length;
      
      // If we don't have an unmatched opening quote, this is a missing opener
      if (openQuotes <= closeQuotes) {
        // Find the likely start of the speech
        const speechText = m[1].substring(0, 60);
        issues.push({
          line: i + 1,
          type: 'missing_opening_quote',
          snippet: line.substring(Math.max(0, m.index - 10), m.index + m[0].length + 5).trim(),
          fullLine: line.substring(0, 120),
          speech: speechText.trim(),
        });
      }
    }
    
    // Pattern 2: Paragraph starts with speech-like content ending in ," tag
    // e.g., 'No," she said' or 'Exactly," Elena said'
    const startPattern = /^([A-Z][^"\u201c\u201d]*?[,.\?!])([\"\u201d])\s+(she|he|they|it|the system|Aether|Marcus|Elena|Zara|Kai)\s+(said|asked|replied|countered|retorted|corrected|whispered|murmured|demanded|challenged|confirmed|repeated|continued|interrupted|admitted|added|protested|agreed|insisted)/i;
    const startMatch = line.match(startPattern);
    if (startMatch && !line.startsWith('"') && !line.startsWith('\u201c')) {
      issues.push({
        line: i + 1,
        type: 'paragraph_start_missing_quote',
        snippet: line.substring(0, 100),
        speech: startMatch[1].trim(),
      });
    }
  }
  
  return issues;
}

// ── AI-SLOP PATTERN COUNTING ──
const SLOP_PATTERNS = [
  { name: 'not just', pattern: /\bnot just\b/gi },
  { name: "wasn't just", pattern: /\bwasn['']t just\b/gi },
  { name: "didn't just", pattern: /\bdidn['']t just\b/gi },
  { name: "isn't just", pattern: /\bisn['']t just\b/gi },
  { name: 'more than just', pattern: /\bmore than just\b/gi },
  { name: 'the weight of', pattern: /\bthe weight of\b/gi },
  { name: 'felt', pattern: /\bfelt\b/gi },
  { name: 'realized', pattern: /\brealized\b/gi },
  { name: 'narrative', pattern: /\bnarrative\b/gi },
  { name: 'performance', pattern: /\bperformance\b/gi },
  { name: "the system wasn't", pattern: /\bthe system wasn['']t\b/gi },
  { name: "the platform wasn't", pattern: /\bthe platform wasn['']t\b/gi },
  { name: 'it was designed to', pattern: /\bit was designed to\b/gi },
  { name: "it wasn't merely", pattern: /\bit wasn['']t merely\b/gi },
  { name: 'she realized', pattern: /\bshe realized\b/gi },
  { name: 'he realized', pattern: /\bhe realized\b/gi },
  { name: 'the realization', pattern: /\bthe realization\b/gi },
  { name: 'settled over', pattern: /\bsettled over\b/gi },
  { name: 'washed over', pattern: /\bwashed over\b/gi },
  { name: 'something shifted', pattern: /\bsomething shifted\b/gi },
  { name: 'palpable', pattern: /\bpalpable\b/gi },
  { name: 'meticulously', pattern: /\bmeticulously\b/gi },
  { name: 'luminous', pattern: /\bluminous\b/gi },
  { name: 'relentless', pattern: /\brelentless\b/gi },
  { name: 'woven into', pattern: /\bwoven into\b/gi },
  { name: 'foundational', pattern: /\bfoundational\b/gi },
];

function countSlop(text) {
  const counts = {};
  let total = 0;
  for (const { name, pattern } of SLOP_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    counts[name] = matches.length;
    total += matches.length;
  }
  return { counts, total };
}

// ── SCAN ALL CHAPTERS ──
const results = [];
const TARGET_CHAPTERS = [1, 3, 4, 5, 6, 7];

for (const ch of chapters) {
  const dialogueIssues = detectDialogueQuoteIssues(ch.text);
  const slop = countSlop(ch.text);
  const wordCount = ch.text.split(/\s+/).filter(Boolean).length;
  
  results.push({
    number: ch.number,
    title: ch.title,
    wordCount,
    dialogueIssues: dialogueIssues.length,
    dialogueExamples: dialogueIssues.slice(0, 5),
    slopTotal: slop.total,
    slopCounts: slop.counts,
    isTarget: TARGET_CHAPTERS.includes(ch.number),
  });
}

// ── OUTPUT REPORT ──
let report = '# DOCX7 Dialogue & Slop Scan\n\n';
report += `Extracted ${chapters.length} chapters from digital-equity-tribunal (7).docx\n\n`;

// Summary table
report += '## Summary\n\n';
report += '| Ch | Title | Words | Dialogue Issues | Slop Total | Severity | Target? |\n';
report += '|----|-------|-------|----------------|------------|----------|--------|\n';

for (const r of results) {
  const severity = r.dialogueIssues > 3 ? '🔴 HIGH' : r.dialogueIssues > 0 ? '🟡 MED' : r.slopTotal > 30 ? '🟡 MED' : '🟢 LOW';
  report += `| ${r.number} | ${r.title.substring(0, 35)} | ${r.wordCount} | ${r.dialogueIssues} | ${r.slopTotal} | ${severity} | ${r.isTarget ? '✅' : ''} |\n`;
}

// Dialogue issue details
report += '\n## Dialogue Quote Issues by Chapter\n\n';
for (const r of results) {
  if (r.dialogueIssues === 0) continue;
  report += `### Chapter ${r.number}: ${r.title}\n`;
  report += `Issues: ${r.dialogueIssues}\n\n`;
  for (const ex of r.dialogueExamples) {
    report += `- **[${ex.type}]** \`${ex.snippet}\`\n`;
  }
  report += '\n';
}

// Slop breakdown for target chapters
report += '## AI-Slop Breakdown (Target Chapters)\n\n';
report += '| Pattern | ';
for (const num of TARGET_CHAPTERS) report += `Ch.${num} | `;
report += 'Total |\n';
report += '|---------|';
for (let i = 0; i < TARGET_CHAPTERS.length; i++) report += '------|';
report += '------|\n';

for (const { name } of SLOP_PATTERNS) {
  let rowTotal = 0;
  let row = `| ${name} | `;
  for (const num of TARGET_CHAPTERS) {
    const r = results.find(r => r.number === num);
    const count = r?.slopCounts[name] || 0;
    rowTotal += count;
    row += `${count || '-'} | `;
  }
  row += `${rowTotal} |`;
  if (rowTotal > 0) report += row + '\n';
}

// Top slop offenders
report += '\n## Top Slop Patterns (All Chapters)\n\n';
const globalSlop = {};
for (const r of results) {
  for (const [k, v] of Object.entries(r.slopCounts)) {
    globalSlop[k] = (globalSlop[k] || 0) + v;
  }
}
const sorted = Object.entries(globalSlop).sort((a, b) => b[1] - a[1]);
for (const [name, count] of sorted.slice(0, 15)) {
  report += `- **${name}**: ${count}\n`;
}

// Write report
writeFileSync(`${OUT_DIR}/01-docx7-dialogue-slop-scan.md`, report);
console.log('Wrote 01-docx7-dialogue-slop-scan.md');

// Also write raw data for later use
writeFileSync(`${OUT_DIR}/scan-data.json`, JSON.stringify({ results, chapters: chapters.map(c => ({ number: c.number, title: c.title, wordCount: c.text.split(/\s+/).length })) }, null, 2));
console.log('Wrote scan-data.json');

// Print summary
console.log('\n=== DIALOGUE ISSUES ===');
for (const r of results) {
  if (r.dialogueIssues > 0) {
    console.log(`  Ch.${r.number} (${r.title}): ${r.dialogueIssues} issues`);
    for (const ex of r.dialogueExamples.slice(0, 3)) {
      console.log(`    → ${ex.snippet}`);
    }
  }
}

console.log('\n=== SLOP TOTALS ===');
for (const r of results) {
  console.log(`  Ch.${r.number}: ${r.slopTotal} slop hits`);
}
