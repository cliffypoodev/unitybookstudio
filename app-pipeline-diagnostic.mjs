#!/usr/bin/env node
/**
 * APP PIPELINE FAILURE DIAGNOSTIC
 * Steps 1-2, 5-9: Extract DOCX, compare, trace Chapter 2, diagnose failures
 * Steps 3-4, 10-11: Handled by subagent + final report assembly
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import mammoth from 'mammoth';

const BASE = '/Users/cliff/Downloads/UBS';
const OUT = join(BASE, 'smoke-test-output/app-pipeline-failure-diagnostic');
const REWRITE_DOCX = '/Users/cliff/Downloads/digital-equity-tribunal (2).docx';
const POLISHED_DOCX = '/Users/cliff/Downloads/digital-equity-tribunal (3).docx';

const log = (msg) => console.log(`[${new Date().toLocaleTimeString('en-US',{hour12:false})}] ${msg}`);

// Create output directories
const dirs = [
  '01-extracted-rewrite', '02-extracted-polished', '03-docx-comparison',
  '06-contamination-guard-diagnosis', '07-process-leak-diagnosis',
  '08-phrase-replacement-diagnosis', '09-quote-repair-diagnosis',
  '10-malformed-grammar-diagnosis', 'stage-snapshots',
];
for (const d of dirs) mkdirSync(join(OUT, d), { recursive: true });

// ============ CANARIES ============
const PROCESS_LEAK_CANARIES = [
  'The opening is sharp, highly polished',
  'The prose hits all the required marks',
  'Analysis & Strengths', 'Areas for Refinement',
  'Best Next Move', 'Next Move:', 'Action Plan:',
  'Action Plan for Next Section', 'Constraint Adherence',
  'Show vs. Tell', 'Pacing & Tension', 'Voice Consistency',
  'Sensory Density', 'I recommend',
  'The current trajectory is working exactly as planned',
  'We have established the what and the why',
  'We need to move', 'Focus on how',
  'Here is the revised', 'I will now',
  'Revision notes', 'Self-Correction', 'Anticipation Check',
  'Thinking...', 'Checklist', 'TODO',
];

const CONTAMINATION_CANARIES = [
  'Unity Supported Living Services', 'Unity Supported Living',
  'Unity Media Solutions', 'Unity Media',
  'care documentation', 'compliance documentation',
  'Q3', 'ROI', 'cohort analysis', 'subscription service',
  'business plan', 'Project Management Office',
  'AI content pipeline', 'funding streams',
  'platform market penetration', 'quarterly profit reports',
  'startup', 'app launch', 'software product',
  'Harmony Creek', 'old mill', 'Jebediah', 'Vivian Dale',
  'Margot Rivers', "Founder's Hall", 'Southern Gothic estate',
];

const MALFORMED_CANARIES = [
  'from to the', 'gaze from to', 'looked at;',
  'reached for the and', 'looked at the and',
  'picked up the and', 'You was', 'Was was',
  'It was was', 'He was was', 'She was was',
];

const CH2_FORENSIC_CANARIES = [
  'The opening is sharp, highly polished',
  'Next Move: Commit to the Bargain', 'Next Move:',
  'Action Plan:', 'Unity Supported Living',
  'Unity Supported Living Services', 'Unity Media',
  'Unity Media Solutions', 'care documentation',
  'compliance documentation', 'Q3',
  'You was Julian talking', 'Was was it his fatigue',
  "Don't blend,\"", "Worse is too strong,\"",
  "It's everything,\"", "We want you to sell your analysis,\"",
];

const SLOP_TERMS = [
  'not just', "wasn't just", "isn't just", 'more than just',
  'the weight of', 'the narrative', 'felt', 'realized',
  'palpable', 'meticulously', 'luminous', 'shimmering', 'ethereal',
];

// ============ HELPERS ============
function countTerm(text, term) {
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text.match(re) || []).length;
}

function countQuoteImbalance(text) {
  let issues = 0;
  for (const p of text.split('\n')) {
    if (!p.trim()) continue;
    const c = (p.match(/"/g) || []).length;
    if (c % 2 !== 0) issues++;
  }
  return issues;
}

function findCanaries(text, list) {
  const found = [];
  for (const canary of list) {
    const count = countTerm(text, canary);
    if (count > 0) found.push({ canary, count });
  }
  return found;
}

// ============ EXTRACT DOCX ============
async function extractDocx(path, label) {
  log(`Extracting ${label}...`);
  const result = await mammoth.extractRawText({ path });
  const raw = result.value;

  // Split into chapters
  const chapterRegex = /Chapter\s+(\d+)[:\s]+([^\n]+)/gi;
  const positions = [];
  let m;
  while ((m = chapterRegex.exec(raw)) !== null) {
    positions.push({ index: m.index, num: parseInt(m[1]), title: m[2].trim(), headerLen: m[0].length });
  }

  const chapters = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i].headerLen;
    const end = i + 1 < positions.length ? positions[i + 1].index : raw.length;
    const body = raw.slice(start, end).trim();
    const wc = body.split(/\s+/).length;
    const leaks = findCanaries(body, PROCESS_LEAK_CANARIES);
    const contam = findCanaries(body, CONTAMINATION_CANARIES);
    const malformed = findCanaries(body, MALFORMED_CANARIES);
    const quoteIssues = countQuoteImbalance(body);
    const slopCounts = {};
    for (const t of SLOP_TERMS) {
      const c = countTerm(body, t);
      if (c > 0) slopCounts[t] = c;
    }

    let status = 'PASS';
    if (leaks.length > 0) status = 'FAIL_PROCESS_LEAK';
    else if (contam.length > 0) status = 'FAIL_CONTAMINATION';
    else if (malformed.length > 0) status = 'FAIL_MALFORMED';
    else if (quoteIssues > 5) status = 'MINOR_QUOTE_ISSUES';

    chapters.push({
      num: positions[i].num, title: positions[i].title, body, wc,
      leaks, contam, malformed, quoteIssues, slopCounts, status,
    });
  }

  log(`  ✓ ${chapters.length} chapters, ${raw.split(/\s+/).length} words total`);
  return { raw, chapters };
}

// ============ MAIN ============
async function main() {
  log('═══ APP PIPELINE FAILURE DIAGNOSTIC — START ═══');

  // STEP 1: Extract both DOCX files
  log('STEP 1: Extracting DOCX files...');
  const rewrite = await extractDocx(REWRITE_DOCX, 'Rewrite (2).docx');
  const polished = await extractDocx(POLISHED_DOCX, 'Polished (3).docx');

  // Save extracted chapters
  for (const ch of rewrite.chapters) {
    writeFileSync(join(OUT, `01-extracted-rewrite/chapter-${String(ch.num).padStart(2,'0')}.txt`), ch.body);
  }
  for (const ch of polished.chapters) {
    writeFileSync(join(OUT, `02-extracted-polished/chapter-${String(ch.num).padStart(2,'0')}.txt`), ch.body);
  }

  // STEP 1 continued: Create comparison report
  log('STEP 1b: Creating comparison report...');

  let compReport = `# DOCX Comparison Report

## File Summary

| File | Chapters | Total Words | Process Leaks | Contamination | Malformed | Quote Issues |
|------|----------|-------------|---------------|---------------|-----------|--------------|
| Rewrite (2).docx | ${rewrite.chapters.length} | ${rewrite.raw.split(/\s+/).length} | ${rewrite.chapters.reduce((s,c) => s + c.leaks.length, 0)} | ${rewrite.chapters.reduce((s,c) => s + c.contam.length, 0)} | ${rewrite.chapters.reduce((s,c) => s + c.malformed.length, 0)} | ${rewrite.chapters.reduce((s,c) => s + c.quoteIssues, 0)} |
| Polished (3).docx | ${polished.chapters.length} | ${polished.raw.split(/\s+/).length} | ${polished.chapters.reduce((s,c) => s + c.leaks.length, 0)} | ${polished.chapters.reduce((s,c) => s + c.contam.length, 0)} | ${polished.chapters.reduce((s,c) => s + c.malformed.length, 0)} | ${polished.chapters.reduce((s,c) => s + c.quoteIssues, 0)} |

## Per-Chapter Comparison

| Ch | Title | Rewrite WC | Polish WC | Δ | Rewrite Leaks | Polish Leaks | Rewrite Contam | Polish Contam | Rewrite Malformed | Polish Malformed | Rewrite QI | Polish QI | Rewrite Status | Polish Status |
|----|-------|-----------|----------|---|---------------|--------------|----------------|---------------|-------------------|------------------|-----------|----------|----------------|--------------|
`;

  for (let i = 0; i < Math.max(rewrite.chapters.length, polished.chapters.length); i++) {
    const rw = rewrite.chapters[i];
    const po = polished.chapters[i];
    if (!rw && !po) continue;
    compReport += `| ${rw?.num || po?.num || '?'} | ${rw?.title || po?.title || '?'} | ${rw?.wc || 0} | ${po?.wc || 0} | ${(po?.wc||0) - (rw?.wc||0)} | ${rw?.leaks?.length || 0} | ${po?.leaks?.length || 0} | ${rw?.contam?.length || 0} | ${po?.contam?.length || 0} | ${rw?.malformed?.length || 0} | ${po?.malformed?.length || 0} | ${rw?.quoteIssues || 0} | ${po?.quoteIssues || 0} | ${rw?.status || '-'} | ${po?.status || '-'} |\n`;
  }

  // Hard failure chapters
  compReport += `\n## Hard Failure Chapters\n\n### Rewrite (2).docx\n\n`;
  const rwFails = rewrite.chapters.filter(c => c.status.startsWith('FAIL'));
  if (rwFails.length === 0) compReport += 'None.\n';
  for (const c of rwFails) {
    compReport += `**Chapter ${c.num}: ${c.title}** — ${c.status}\n`;
    if (c.leaks.length) compReport += `- Process leaks: ${c.leaks.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    if (c.contam.length) compReport += `- Contamination: ${c.contam.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    if (c.malformed.length) compReport += `- Malformed: ${c.malformed.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    compReport += '\n';
  }

  compReport += `\n### Polished (3).docx\n\n`;
  const poFails = polished.chapters.filter(c => c.status.startsWith('FAIL'));
  if (poFails.length === 0) compReport += 'None.\n';
  for (const c of poFails) {
    compReport += `**Chapter ${c.num}: ${c.title}** — ${c.status}\n`;
    if (c.leaks.length) compReport += `- Process leaks: ${c.leaks.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    if (c.contam.length) compReport += `- Contamination: ${c.contam.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    if (c.malformed.length) compReport += `- Malformed: ${c.malformed.map(l => `"${l.canary}" (×${l.count})`).join(', ')}\n`;
    compReport += '\n';
  }

  // Slop comparison
  compReport += `\n## Slop Phrase Comparison (Rewrite → Polished)\n\n| Term | Rewrite Total | Polish Total | Δ |\n|------|--------------|-------------|---|\n`;
  for (const t of SLOP_TERMS) {
    const rwTotal = rewrite.chapters.reduce((s,c) => s + (c.slopCounts[t] || 0), 0);
    const poTotal = polished.chapters.reduce((s,c) => s + (c.slopCounts[t] || 0), 0);
    compReport += `| ${t} | ${rwTotal} | ${poTotal} | ${poTotal - rwTotal} |\n`;
  }

  writeFileSync(join(OUT, '03-docx-comparison/comparison-report.md'), compReport);
  log('  ✓ 03-docx-comparison/comparison-report.md written');

  // ============ STEP 2: Chapter 2 Forensics ============
  log('STEP 2: Chapter 2 forensics...');

  const ch2rw = rewrite.chapters.find(c => c.num === 2);
  const ch2po = polished.chapters.find(c => c.num === 2);

  let ch2Report = `# Chapter 2 Failure Forensics

## Overview

| Metric | Rewrite (2).docx | Polished (3).docx | Δ |
|--------|----------------|--------------------|---|
| Word Count | ${ch2rw?.wc || 'MISSING'} | ${ch2po?.wc || 'MISSING'} | ${(ch2po?.wc||0) - (ch2rw?.wc||0)} |
| Process Leaks | ${ch2rw?.leaks?.length || 0} | ${ch2po?.leaks?.length || 0} | ${(ch2po?.leaks?.length||0) - (ch2rw?.leaks?.length||0)} |
| Contamination | ${ch2rw?.contam?.length || 0} | ${ch2po?.contam?.length || 0} | ${(ch2po?.contam?.length||0) - (ch2rw?.contam?.length||0)} |
| Quote Issues | ${ch2rw?.quoteIssues || 0} | ${ch2po?.quoteIssues || 0} | ${(ch2po?.quoteIssues||0) - (ch2rw?.quoteIssues||0)} |
| Status | ${ch2rw?.status || 'MISSING'} | ${ch2po?.status || 'MISSING'} | — |

## Canary Tracking — Chapter 2

| Canary | In Rewrite? | Count | In Polished? | Count | Survived Fix/Polish? |
|--------|-------------|-------|--------------|-------|---------------------|
`;

  for (const canary of CH2_FORENSIC_CANARIES) {
    const rwCount = ch2rw ? countTerm(ch2rw.body, canary) : 0;
    const poCount = ch2po ? countTerm(ch2po.body, canary) : 0;
    const survived = rwCount > 0 && poCount > 0 ? '❌ YES — NOT REMOVED' :
                     rwCount > 0 && poCount === 0 ? '✅ Removed' :
                     rwCount === 0 && poCount > 0 ? '⚠️ INTRODUCED by polish' :
                     '— not present';
    ch2Report += `| ${canary} | ${rwCount > 0 ? 'YES' : 'no'} | ${rwCount} | ${poCount > 0 ? 'YES' : 'no'} | ${poCount} | ${survived} |\n`;
  }

  // Show first 500 chars of both Chapter 2 versions
  ch2Report += `\n## Chapter 2 Opening — Rewrite (2).docx\n\n\`\`\`\n${(ch2rw?.body || '').slice(0, 800)}\n\`\`\`\n`;
  ch2Report += `\n## Chapter 2 Opening — Polished (3).docx\n\n\`\`\`\n${(ch2po?.body || '').slice(0, 800)}\n\`\`\`\n`;

  // Check for missing opening quotes in polished Ch 2
  ch2Report += `\n## Missing Opening Quotes in Polished Chapter 2\n\n`;
  if (ch2po) {
    const missingQuotePattern = /(?:^|\n)\s*([A-Z][^"]*?,"\s)/g;
    let mqMatch;
    const missingQuotes = [];
    const lines = ch2po.body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Look for dialogue starting without opening quote: word," tag
      const dqMatches = lines[i].match(/(?<!["])\b[A-Z][^"]{0,50}?,"\s+\w+\s+(said|replied|asked|whispered|murmured|corrected|continued|insisted|added|offered|confirmed)/g);
      if (dqMatches) {
        for (const dq of dqMatches) {
          missingQuotes.push({ line: i + 1, text: dq.slice(0, 80) });
        }
      }
    }
    if (missingQuotes.length === 0) {
      ch2Report += 'No obvious missing opening quotes detected.\n';
    } else {
      ch2Report += `Found ${missingQuotes.length} potential missing opening quotes:\n\n`;
      for (const mq of missingQuotes) {
        ch2Report += `- Line ${mq.line}: \`${mq.text}\`\n`;
      }
    }
  }

  writeFileSync(join(OUT, '03-docx-comparison/chapter-02-forensics.md'), ch2Report);
  log('  ✓ Chapter 2 forensics written');

  // ============ STEP 5: Contamination Guard Diagnosis ============
  log('STEP 5: Contamination guard diagnosis...');

  let contamReport = `# Contamination Guard Diagnosis

## Contamination Found in DOCX Files

### Rewrite (2).docx

| Ch | Title | Contamination Terms Found |
|----|-------|--------------------------|
`;
  for (const ch of rewrite.chapters) {
    if (ch.contam.length > 0) {
      contamReport += `| ${ch.num} | ${ch.title} | ${ch.contam.map(c => `${c.canary} (×${c.count})`).join(', ')} |\n`;
    }
  }

  contamReport += `\n### Polished (3).docx\n\n| Ch | Title | Contamination Terms Found |\n|----|-------|---------------------------|\n`;
  for (const ch of polished.chapters) {
    if (ch.contam.length > 0) {
      contamReport += `| ${ch.num} | ${ch.title} | ${ch.contam.map(c => `${c.canary} (×${c.count})`).join(', ')} |\n`;
    }
  }

  // Track which contamination terms survive from rewrite to polish
  contamReport += `\n## Contamination Survival Analysis\n\n| Term | Rewrite Chapters | Polish Chapters | Survived? |\n|------|-----------------|-----------------|----------|\n`;
  for (const term of CONTAMINATION_CANARIES) {
    const rwChs = rewrite.chapters.filter(c => c.contam.some(x => x.canary === term)).map(c => c.num);
    const poChs = polished.chapters.filter(c => c.contam.some(x => x.canary === term)).map(c => c.num);
    if (rwChs.length > 0 || poChs.length > 0) {
      contamReport += `| ${term} | Ch ${rwChs.join(',')||'none'} | Ch ${poChs.join(',')||'none'} | ${poChs.length > 0 ? '❌ YES' : '✅ Removed'} |\n`;
    }
  }

  contamReport += `\n## Diagnosis\n\nContext: The Digital Equity Tribunal anthology is about digital systems, algorithms, and equity.\nSome terms like 'Q3', 'ROI', 'platform' may appear as legitimate story content.\nHowever, 'Unity Supported Living Services', 'Unity Media Solutions', and 'care documentation'\nare from OTHER projects (Southern Gothic / Unity Supported Living) and are TRUE contamination.\n\nKey questions:\n1. Was contamination detection run during app fix/polish? → Check manuscriptFixer.js\n2. Was it a hard reject or soft warning? → Check if chapters are rejected or just logged\n3. Was the contamination list in the app the same as in the smoke tests?\n4. Did fix/polish preserve contamination because the story world uses similar business language?\n`;

  writeFileSync(join(OUT, '06-contamination-guard-diagnosis/contamination-diagnosis.md'), contamReport);
  log('  ✓ Contamination diagnosis written');

  // ============ STEP 6: Process Leak Diagnosis ============
  log('STEP 6: Process leak diagnosis...');

  let leakReport = `# Process Leak Diagnosis

## Process Leaks Found in DOCX Files

### Rewrite (2).docx

| Ch | Title | Leak Phrases |
|----|-------|-------------|
`;
  for (const ch of rewrite.chapters) {
    if (ch.leaks.length > 0) {
      leakReport += `| ${ch.num} | ${ch.title} | ${ch.leaks.map(l => `"${l.canary}" (×${l.count})`).join(', ')} |\n`;
    }
  }

  leakReport += `\n### Polished (3).docx\n\n| Ch | Title | Leak Phrases |\n|----|-------|-------------|\n`;
  for (const ch of polished.chapters) {
    if (ch.leaks.length > 0) {
      leakReport += `| ${ch.num} | ${ch.title} | ${ch.leaks.map(l => `"${l.canary}" (×${l.count})`).join(', ')} |\n`;
    }
  }

  // Track survival
  leakReport += `\n## Process Leak Survival Analysis\n\n| Phrase | Rewrite Chapters | Polish Chapters | Survived? |\n|--------|-----------------|-----------------|----------|\n`;
  for (const phrase of PROCESS_LEAK_CANARIES) {
    const rwChs = rewrite.chapters.filter(c => c.leaks.some(x => x.canary === phrase)).map(c => c.num);
    const poChs = polished.chapters.filter(c => c.leaks.some(x => x.canary === phrase)).map(c => c.num);
    if (rwChs.length > 0 || poChs.length > 0) {
      leakReport += `| ${phrase} | Ch ${rwChs.join(',')||'none'} | Ch ${poChs.join(',')||'none'} | ${poChs.length > 0 ? '❌ YES' : '✅ Removed'} |\n`;
    }
  }

  leakReport += `\n## Diagnosis\n\nKey questions:\n1. Is process-leak detection present in the actual app fix/polish path?\n2. Does it reject contaminated chapters or just try to clean them?\n3. Are the leak phrases in the app detection list the same as in smoke tests?\n4. Does fix/polish regenerate rejected chapters or pass them through unchanged?\n`;

  writeFileSync(join(OUT, '07-process-leak-diagnosis/process-leak-diagnosis.md'), leakReport);
  log('  ✓ Process leak diagnosis written');

  // ============ STEP 7: Phrase Replacement Diagnosis ============
  log('STEP 7: Phrase replacement diagnosis...');

  let phraseReport = `# Phrase Replacement Diagnosis

## "not just" Family — Before/After

| Term | Rewrite (2) Total | Polished (3) Total | Δ | Verdict |
|------|------------------|-------------------|---|---------|
`;
  const njTerms = ['not just', "wasn't just", "isn't just", 'more than just', 'not merely', 'not simply'];
  for (const t of njTerms) {
    const rwTotal = rewrite.chapters.reduce((s,c) => s + countTerm(c.body, t), 0);
    const poTotal = polished.chapters.reduce((s,c) => s + countTerm(c.body, t), 0);
    const verdict = poTotal < rwTotal ? (poTotal === 0 ? '⚠️ ALL REMOVED (possibly destructive)' : `✅ Reduced by ${rwTotal - poTotal}`) : 
                    poTotal === rwTotal ? '— unchanged' : '⚠️ increased';
    phraseReport += `| ${t} | ${rwTotal} | ${poTotal} | ${poTotal - rwTotal} | ${verdict} |\n`;
  }

  // Check for "Was was" and "You was" malformed patterns
  phraseReport += `\n## Malformed Grammar Check — Introduced by Polish?\n\n| Pattern | In Rewrite (2)? | In Polished (3)? | Introduced by Polish? |\n|---------|-----------------|------------------|-----------------------|\n`;
  const malPatterns = ['You was', 'Was was', 'It was was', 'He was was', 'She was was',
    'from to the', 'gaze from to', 'reached for the and', 'picked up the and'];
  for (const p of malPatterns) {
    const rwCount = countTerm(rewrite.raw, p);
    const poCount = countTerm(polished.raw, p);
    const verdict = rwCount === 0 && poCount > 0 ? '❌ YES — introduced by fix/polish' :
                    rwCount > 0 && poCount > 0 ? '❌ Present in both — not cleaned' :
                    rwCount > 0 && poCount === 0 ? '✅ Cleaned by fix/polish' : '— not present';
    phraseReport += `| ${p} | ${rwCount > 0 ? `YES (×${rwCount})` : 'no'} | ${poCount > 0 ? `YES (×${poCount})` : 'no'} | ${verdict} |\n`;
  }

  // Find examples of broken "not just" removal near malformed text
  phraseReport += `\n## "not just" Removal Context Examples\n\nSearching for text around deleted "not just" phrases where grammar may be broken...\n\n`;
  if (ch2po) {
    // Look for sentences that seem to have had "not just" removed: "It was recording" instead of "It wasn't just recording"
    const suspectPatterns = [
      /\bwas\s+\w+ing\b/gi, // "was recording" without subject context
      /\bwas\s+was\b/gi,    // "was was" double
      /\bYou\s+was\b/gi,    // "You was" (wrong grammar)
    ];
    for (const pat of suspectPatterns) {
      let sm;
      while ((sm = pat.exec(ch2po.body)) !== null) {
        const ctx = ch2po.body.slice(Math.max(0, sm.index - 40), sm.index + sm[0].length + 40);
        phraseReport += `- \`...${ctx}...\`\n`;
      }
    }
  }

  writeFileSync(join(OUT, '08-phrase-replacement-diagnosis/phrase-diagnosis.md'), phraseReport);
  log('  ✓ Phrase replacement diagnosis written');

  // ============ STEP 8: Quote Repair Diagnosis ============
  log('STEP 8: Quote repair diagnosis...');

  let quoteReport = `# Quote Repair Diagnosis

## Quote Imbalance — Before/After

| Ch | Rewrite (2) Quote Issues | Polished (3) Quote Issues | Δ | Verdict |
|----|-------------------------|--------------------------|---|---------|
`;
  for (let i = 0; i < Math.max(rewrite.chapters.length, polished.chapters.length); i++) {
    const rw = rewrite.chapters[i];
    const po = polished.chapters[i];
    if (!rw || !po) continue;
    const verdict = po.quoteIssues < rw.quoteIssues ? '✅ Improved' :
                    po.quoteIssues === rw.quoteIssues ? '— unchanged' :
                    '❌ WORSE';
    quoteReport += `| ${rw.num} | ${rw.quoteIssues} | ${po.quoteIssues} | ${po.quoteIssues - rw.quoteIssues} | ${verdict} |\n`;
  }

  // Missing opening quote examples from polished
  quoteReport += `\n## Missing Opening Quote Examples in Polished (3).docx\n\n`;
  const quoteTargets = [
    "Don't blend,\"", "Worse is too strong,\"", "It's everything,\"",
    "We want you to sell your analysis,\"",
    "And all auditors are risk-mitigators,\"",
  ];
  for (const qt of quoteTargets) {
    for (const ch of polished.chapters) {
      const idx = ch.body.indexOf(qt);
      if (idx >= 0) {
        const ctx = ch.body.slice(Math.max(0, idx - 30), idx + qt.length + 40);
        quoteReport += `- Ch ${ch.num}: \`...${ctx.replace(/\n/g, '⏎')}...\`\n`;
      }
    }
  }

  quoteReport += `\n## Diagnosis\n\nKey questions:\n1. Is quote repair (repairChapterQuotes or equivalent) running in the app fix/polish path?\n2. If so, does it detect missing OPENING quotes (not just closing)?\n3. Does a later transform (e.g., "not just" removal) break quotes after repair?\n4. Does the polish path's SV_VERBS or other regex strip opening quote characters?\n`;

  writeFileSync(join(OUT, '09-quote-repair-diagnosis/quote-diagnosis.md'), quoteReport);
  log('  ✓ Quote repair diagnosis written');

  // ============ STEP 9: Malformed Grammar ============
  log('STEP 9: Malformed grammar diagnosis...');

  let malReport = `# Malformed Grammar Diagnosis

## Malformed Patterns Found

### In Rewrite (2).docx

| Ch | Pattern | Count | Context |
|----|---------|-------|---------|
`;
  for (const ch of rewrite.chapters) {
    for (const m of ch.malformed) {
      const idx = ch.body.toLowerCase().indexOf(m.canary.toLowerCase());
      const ctx = ch.body.slice(Math.max(0, idx - 30), idx + m.canary.length + 30);
      malReport += `| ${ch.num} | ${m.canary} | ${m.count} | \`${ctx.replace(/\n/g, ' ')}\` |\n`;
    }
  }

  malReport += `\n### In Polished (3).docx\n\n| Ch | Pattern | Count | Context |\n|----|---------|-------|---------|\n`;
  for (const ch of polished.chapters) {
    for (const m of ch.malformed) {
      const idx = ch.body.toLowerCase().indexOf(m.canary.toLowerCase());
      const ctx = ch.body.slice(Math.max(0, idx - 30), idx + m.canary.length + 30);
      malReport += `| ${ch.num} | ${m.canary} | ${m.count} | \`${ctx.replace(/\n/g, ' ')}\` |\n`;
    }
  }

  malReport += `\n## Origin Analysis\n\nFor each malformed pattern, determine if it was:\n1. Present in the rewrite → survived fix/polish (NOT CLEANED)\n2. NOT present in rewrite → INTRODUCED by fix/polish\n3. Present in rewrite and cleaned by fix/polish (WORKING)\n`;

  writeFileSync(join(OUT, '10-malformed-grammar-diagnosis/malformed-diagnosis.md'), malReport);
  log('  ✓ Malformed grammar diagnosis written');

  // ============ SUMMARY ============
  log('Writing summary...');
  const totalRwLeaks = rewrite.chapters.reduce((s,c) => s + c.leaks.length, 0);
  const totalRwContam = rewrite.chapters.reduce((s,c) => s + c.contam.length, 0);
  const totalPoLeaks = polished.chapters.reduce((s,c) => s + c.leaks.length, 0);
  const totalPoContam = polished.chapters.reduce((s,c) => s + c.contam.length, 0);
  const totalRwMal = rewrite.chapters.reduce((s,c) => s + c.malformed.length, 0);
  const totalPoMal = polished.chapters.reduce((s,c) => s + c.malformed.length, 0);

  console.log('\n═══ DIAGNOSTIC SUMMARY ═══');
  console.log(`Rewrite (2).docx: ${rewrite.chapters.length} chapters, ${totalRwLeaks} process leaks, ${totalRwContam} contamination, ${totalRwMal} malformed`);
  console.log(`Polished (3).docx: ${polished.chapters.length} chapters, ${totalPoLeaks} process leaks, ${totalPoContam} contamination, ${totalPoMal} malformed`);
  console.log(`Process leak chapters surviving polish: ${polished.chapters.filter(c => c.leaks.length > 0).map(c => c.num).join(', ') || 'none'}`);
  console.log(`Contamination chapters surviving polish: ${polished.chapters.filter(c => c.contam.length > 0).map(c => c.num).join(', ') || 'none'}`);
  console.log(`Malformed chapters in polish: ${polished.chapters.filter(c => c.malformed.length > 0).map(c => c.num).join(', ') || 'none'}`);

  log('═══ APP PIPELINE FAILURE DIAGNOSTIC (STEPS 1-2, 5-9) — COMPLETE ═══');
}

main().catch(err => { console.error(err); process.exit(1); });
