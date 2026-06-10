// Extract chapters from digital-equity-tribunal (6).docx and scan for failures
import { readFileSync, writeFileSync } from 'fs';

// Use mammoth to extract text
let text;
try {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: '/Users/cliff/Downloads/digital-equity-tribunal (6).docx' });
  text = result.value;
} catch (e) {
  // Fallback: use textract or manual extraction
  console.error('mammoth failed:', e.message);
  // Try using the docx package
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execP = promisify(exec);
    // Use python to extract
    const { stdout } = await execP(`python3 -c "
import zipfile, xml.etree.ElementTree as ET, sys
z = zipfile.ZipFile('/Users/cliff/Downloads/digital-equity-tribunal (6).docx')
xml = z.read('word/document.xml')
root = ET.fromstring(xml)
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paras = []
for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
    texts = []
    for r in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
        if r.text:
            texts.append(r.text)
    if texts:
        paras.append(''.join(texts))
print('\\n'.join(paras))
"`);
    text = stdout;
  } catch (e2) {
    console.error('python fallback failed:', e2.message);
    process.exit(1);
  }
}

console.log('Extracted text length:', text.length);

// Split into chapters
const chapterPattern = /^(?:Chapter\s+(\d+)[:\s]*(.*))/gmi;
const chapters = [];
let lastIdx = 0;
let lastNum = 0;
let lastTitle = '';

const lines = text.split('\n');
const chapterStarts = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  const m = line.match(/^Chapter\s+(\d+)[:\s]*(.*)/i);
  if (m) {
    chapterStarts.push({ lineIdx: i, num: parseInt(m[1]), title: m[2].trim() || '' });
  }
}

for (let i = 0; i < chapterStarts.length; i++) {
  const start = chapterStarts[i];
  const endLine = i + 1 < chapterStarts.length ? chapterStarts[i + 1].lineIdx : lines.length;
  const content = lines.slice(start.lineIdx, endLine).join('\n');
  chapters.push({ num: start.num, title: start.title, content, charCount: content.length, wordCount: content.split(/\s+/).length });
}

console.log('Found', chapters.length, 'chapters');

// Known failure patterns
const FAILURES = [
  { pattern: /The game is the model, Marcus,\u201d/g, id: 'missing-open-quote-1', severity: 'HARD' },
  { pattern: /And I thrive on efficiency,\u201d/g, id: 'missing-open-quote-2', severity: 'HARD' },
  { pattern: /She were carrying/gi, id: 'she-were-carrying', severity: 'HARD' },
  { pattern: /She was it monopolistic practice/gi, id: 'she-was-it-monopolistic', severity: 'HARD' },
  { pattern: /Was was it a failure/gi, id: 'was-was-failure', severity: 'HARD' },
  { pattern: /She were those just metrics/gi, id: 'she-were-metrics', severity: 'HARD' },
  { pattern: /Aether were they/gi, id: 'aether-were', severity: 'HARD' },
  { pattern: /a obvious/gi, id: 'a-obvious', severity: 'HARD' },
  { pattern: /The game is the model, Marcus,"/g, id: 'missing-open-quote-straight-1', severity: 'HARD' },
  { pattern: /And I thrive on efficiency,"/g, id: 'missing-open-quote-straight-2', severity: 'HARD' },
];

// Slop patterns
const SLOP = [
  { pattern: /\bnot just\b/gi, id: 'not-just' },
  { pattern: /\bwasn.t just\b/gi, id: 'wasnt-just' },
  { pattern: /\bdid(?:n.t| not) just\b/gi, id: 'didnt-just' },
  { pattern: /\bisn.t just\b/gi, id: 'isnt-just' },
  { pattern: /\bthe weight of\b/gi, id: 'weight-of' },
  { pattern: /\bfelt\b/gi, id: 'felt' },
  { pattern: /\brealized\b/gi, id: 'realized' },
  { pattern: /\bnarrative\b/gi, id: 'narrative' },
  { pattern: /\bperformance\b/gi, id: 'performance' },
  { pattern: /\bthe system wasn.t\b/gi, id: 'system-wasnt' },
  { pattern: /\bthe platform wasn.t\b/gi, id: 'platform-wasnt' },
];

// Process leaks
const PROCESS_LEAKS = [
  /\bAction Plan\b/gi,
  /\bNext Move\b/gi,
  /\bThe opening is sharp\b/gi,
  /\bYou have successfully\b/gi,
  /\bHere is (?:the|your) (?:revised|polished|edited)/gi,
];

// Contamination
const CONTAMINATION = [
  /\bUnity Supported Living\b/gi,
  /\bUnity Media\b/gi,
  /\bcompliance documentation\b/gi,
  /\bcare documentation\b/gi,
];

// Grammar: She were / He were / You was / Was was / She was it / He was it
const GRAMMAR_HARD = [
  { pattern: /\bShe were\b/g, id: 'she-were' },
  { pattern: /\bHe were\b/g, id: 'he-were' },
  { pattern: /\bYou was\b/g, id: 'you-was' },
  { pattern: /\bWas was\b/gi, id: 'was-was' },
  { pattern: /\bShe was it\b/gi, id: 'she-was-it' },
  { pattern: /\bHe was it\b/gi, id: 'he-was-it' },
  { pattern: /\bwere those just\b/gi, id: 'were-those-just' },
];

// Quote imbalance: closing quote without opening in same paragraph
const QUOTE_ISSUES = [];

const report = { chapters: [], globalSlop: {}, globalFailures: 0, globalHard: 0 };

for (const ch of chapters) {
  const chReport = {
    num: ch.num,
    title: ch.title,
    words: ch.wordCount,
    chars: ch.charCount,
    failures: [],
    slop: {},
    processLeaks: [],
    contamination: [],
    grammar: [],
    slopTotal: 0,
  };

  // Check failures
  for (const f of FAILURES) {
    f.pattern.lastIndex = 0;
    const matches = [...ch.content.matchAll(new RegExp(f.pattern.source, f.pattern.flags))];
    if (matches.length > 0) {
      for (const m of matches) {
        const ctx = ch.content.substring(Math.max(0, m.index - 30), m.index + m[0].length + 30);
        chReport.failures.push({ id: f.id, severity: f.severity, match: m[0], context: ctx.replace(/\n/g, ' ') });
      }
    }
  }

  // Check slop
  for (const s of SLOP) {
    s.pattern.lastIndex = 0;
    const matches = ch.content.match(new RegExp(s.pattern.source, s.pattern.flags)) || [];
    chReport.slop[s.id] = matches.length;
    chReport.slopTotal += matches.length;
    report.globalSlop[s.id] = (report.globalSlop[s.id] || 0) + matches.length;
  }

  // Check process leaks
  for (const p of PROCESS_LEAKS) {
    p.lastIndex = 0;
    const matches = ch.content.match(new RegExp(p.source, p.flags)) || [];
    for (const m of matches) chReport.processLeaks.push(m);
  }

  // Check contamination
  for (const c of CONTAMINATION) {
    c.lastIndex = 0;
    const matches = ch.content.match(new RegExp(c.source, c.flags)) || [];
    for (const m of matches) chReport.contamination.push(m);
  }

  // Check grammar
  for (const g of GRAMMAR_HARD) {
    g.pattern.lastIndex = 0;
    const matches = [...ch.content.matchAll(new RegExp(g.pattern.source, g.pattern.flags))];
    for (const m of matches) {
      const ctx = ch.content.substring(Math.max(0, m.index - 30), m.index + m[0].length + 30);
      chReport.grammar.push({ id: g.id, match: m[0], context: ctx.replace(/\n/g, ' ') });
    }
  }

  report.chapters.push(chReport);
  report.globalFailures += chReport.failures.length;
  report.globalHard += chReport.grammar.length;
}

// Save raw chapters for later use
writeFileSync('smoke-test-output/final-polish-enforcement-hardfix/docx6-chapters.json', JSON.stringify(chapters, null, 2));
writeFileSync('smoke-test-output/final-polish-enforcement-hardfix/docx6-scan-report.json', JSON.stringify(report, null, 2));

// Print summary
console.log('\n═══ DOCX 6 Failure Scan ═══\n');
console.log('Total chapters:', chapters.length);
console.log('Total failures:', report.globalFailures);
console.log('Total grammar hard:', report.globalHard);
console.log('');

for (const ch of report.chapters) {
  if (ch.failures.length > 0 || ch.grammar.length > 0 || ch.processLeaks.length > 0 || ch.contamination.length > 0) {
    console.log(`\n── Ch.${ch.num}: ${ch.title} (${ch.words} words) ──`);
    for (const f of ch.failures) {
      console.log(`  ❌ [${f.severity}] ${f.id}: "${f.match}" | …${f.context}…`);
    }
    for (const g of ch.grammar) {
      console.log(`  ❌ [GRAMMAR] ${g.id}: "${g.match}" | …${g.context}…`);
    }
    for (const p of ch.processLeaks) {
      console.log(`  🚫 [PROCESS] ${p}`);
    }
    for (const c of ch.contamination) {
      console.log(`  🚫 [CONTAM] ${c}`);
    }
    console.log(`  📊 Slop total: ${ch.slopTotal}`);
  }
}

console.log('\n── Global Slop Counts ──');
for (const [k, v] of Object.entries(report.globalSlop).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
