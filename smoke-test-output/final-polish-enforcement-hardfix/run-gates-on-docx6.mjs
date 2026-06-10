// Step 2: Run actual quality gates on extracted chapters
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load modules using resolved paths
const safetyGatePath = resolve(__dirname, '../../src/lib/manuscriptSafetyGate.js');
const qualityGatePath = resolve(__dirname, '../../src/lib/prosePolishQualityGate.js');
const exportGatePath = resolve(__dirname, '../../src/lib/exportSafetyGate.js');

const { runManuscriptSafetyGate } = await import(safetyGatePath);
const { runProsePolishQualityGate, runDeterministicGrammarRepair, repairMissingOpeningQuotes } = await import(qualityGatePath);

let runPreExportSafetyGate;
try {
  const exportMod = await import(exportGatePath);
  runPreExportSafetyGate = exportMod.runPreExportSafetyGate || exportMod.runExportSafetyGate;
} catch (e) {
  console.warn('Export safety gate not loadable standalone:', e.message);
}

// Load extracted chapters
const chapters = JSON.parse(readFileSync(resolve(__dirname, 'docx6-chapters.json'), 'utf-8'));

const TARGET_CHAPTERS = [1, 5, 6, 7, 9];
const results = [];

console.log('\n═══ Quality Gate Enforcement Trace ═══\n');

for (const chNum of TARGET_CHAPTERS) {
  const ch = chapters.find(c => c.num === chNum);
  if (!ch) { console.log(`Ch.${chNum}: NOT FOUND`); continue; }

  console.log(`\n── Ch.${chNum}: ${ch.title} (${ch.wordCount} words) ──`);
  const content = ch.content;

  // 1. Safety gate
  const safety = runManuscriptSafetyGate(content, { stage: 'pre-polish' });
  console.log(`  Safety Gate: ok=${safety.ok}, action=${safety.recommendedAction}, leaks=${safety.processLeaks.matches.length}, contam=${safety.contamination.matches.length}, malformed=${safety.malformed.matches.length}`);

  // 2. Grammar repair preview
  const grammar = runDeterministicGrammarRepair(content);
  console.log(`  Grammar Repair: ${grammar.repairs.length} repairs`);
  for (const r of grammar.repairs.slice(0, 5)) {
    console.log(`    → "${r.original}" → "${r.replacement}" [${r.rule}]`);
  }
  if (grammar.repairs.length > 5) console.log(`    … and ${grammar.repairs.length - 5} more`);

  // 3. Quote repair preview
  const quoteRepair = repairMissingOpeningQuotes(content);
  console.log(`  Quote Repair: ${quoteRepair.repairCount} repairs`);
  for (const r of (quoteRepair.repairs || []).slice(0, 5)) {
    console.log(`    → "${(r.original || '').substring(0, 60)}" → "${(r.replacement || '').substring(0, 60)}"`);
  }

  // 4. Post-polish quality gate
  const quality = runProsePolishQualityGate(content);
  console.log(`  Quality Gate: ok=${quality.ok}, malformed=${quality.malformed.count}, quoteIssues=${quality.quoteIssues.count}, slop=${quality.slopCounts.total}`);
  if (quality.malformed.count > 0) {
    for (const m of quality.malformed.matches.slice(0, 5)) {
      console.log(`    ❌ malformed: "${m}"`);
    }
  }
  if (quality.quoteIssues.count > 0) {
    for (const q of (quality.quoteIssues.matches || []).slice(0, 5)) {
      console.log(`    ❌ quote: "${q}"`);
    }
  }

  // Check specific canaries
  const canaries = [];
  if (chNum === 1) {
    canaries.push({ id: 'missing-open-quote-1', present: content.includes('The game is the model, Marcus,\u201d') || content.includes('The game is the model, Marcus,"') });
    canaries.push({ id: 'missing-open-quote-2', present: content.includes('And I thrive on efficiency,\u201d') || content.includes('And I thrive on efficiency,"') });
  }
  if (chNum === 5) {
    canaries.push({ id: 'she-were-carrying', present: /She were carrying/i.test(content) });
    canaries.push({ id: 'she-was-it-monopolistic', present: /She was it monopolistic/i.test(content) });
  }
  if (chNum === 6) {
    canaries.push({ id: 'she-were-metrics', present: /She were those just metrics/i.test(content) });
    canaries.push({ id: 'aether-were', present: /Aether were they/i.test(content) });
    canaries.push({ id: 'a-obvious', present: /a obvious/i.test(content) });
  }
  if (chNum === 7) {
    canaries.push({ id: 'was-was', present: /Was was/i.test(content) });
  }

  console.log(`  Canaries:`);
  for (const c of canaries) {
    console.log(`    ${c.present ? '❌ PRESENT' : '✅ ABSENT'}: ${c.id}`);
  }

  // Key question: Does the quality gate BLOCK save for these chapters?
  const wouldBlock = !quality.ok && quality.malformed.count > 0;
  console.log(`  Would block save? ${wouldBlock ? 'YES ✅' : 'NO ❌ ← THIS IS THE BUG'}`);
  
  // Check if grammar repair would fix the issues
  const afterGrammar = grammar.text;
  const afterQuote = repairMissingOpeningQuotes(afterGrammar).text;
  const afterGate = runProsePolishQualityGate(afterQuote);
  console.log(`  After auto-repair: ok=${afterGate.ok}, malformed=${afterGate.malformed.count}, quotes=${afterGate.quoteIssues.count}`);

  results.push({
    chapter: chNum,
    title: ch.title,
    safetyOk: safety.ok,
    grammarRepairs: grammar.repairs.length,
    quoteRepairs: quoteRepair.repairCount,
    qualityOk: quality.ok,
    qualityMalformed: quality.malformed.count,
    qualityQuotes: quality.quoteIssues.count,
    qualitySlop: quality.slopCounts.total,
    wouldBlock,
    canaries: canaries.map(c => ({ id: c.id, present: c.present })),
    afterRepairOk: afterGate.ok,
    afterRepairMalformed: afterGate.malformed.count,
  });
}

console.log('\n\n═══ Summary ═══');
console.log('Chapter | Safety | QGate | Block? | Grammar | Quotes | AfterRepair');
for (const r of results) {
  console.log(`  Ch.${r.chapter} | ${r.safetyOk ? 'PASS' : 'FAIL'} | ${r.qualityOk ? 'PASS' : 'FAIL'} | ${r.wouldBlock ? 'YES' : 'NO'} | ${r.grammarRepairs} repairs | ${r.quoteRepairs} fixes | ${r.afterRepairOk ? 'PASS' : 'FAIL'}`);
}
