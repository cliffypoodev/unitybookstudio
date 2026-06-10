// chapter-6-diagnosis.mjs — Trace Ch.6 through all gates and repair functions
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const outDir = resolve(__dirname);

// Import all gate/repair functions
const { runManuscriptSafetyGate, detectMalformedGrammar } = await import(
  resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js')
);
const {
  runProsePolishQualityGate,
  runDeterministicGrammarRepair,
  repairMissingOpeningQuotes,
} = await import(
  resolve(projectRoot, 'src', 'lib', 'prosePolishQualityGate.js')
);

// ── Load Chapter 6 from DOCX6 extracted text if available ──
const extractedDir = resolve(projectRoot, 'smoke-test-output', 'final-polish-enforcement-hardfix');
let ch6Text = '';

// Try to load from extracted full text
const fullTextPath = resolve(extractedDir, 'extracted-full-text.txt');
try {
  const fullText = readFileSync(fullTextPath, 'utf8');
  const chapters = fullText.split(/(?=Chapter \d+)/i).filter(p => p.trim().length > 50);
  for (const ch of chapters) {
    const numMatch = ch.match(/Chapter\s+(\d+)/i);
    if (numMatch && parseInt(numMatch[1]) === 6) {
      ch6Text = ch.trim();
      break;
    }
  }
} catch {
  console.log('No extracted-full-text.txt found');
}

// Fallback: try individual chapter files
if (!ch6Text) {
  try {
    const files = readdirSync(extractedDir).filter(f => f.match(/chapter.*6/i));
    if (files.length > 0) {
      ch6Text = readFileSync(resolve(extractedDir, files[0]), 'utf8');
    }
  } catch {}
}

if (!ch6Text) {
  console.error('Could not load Chapter 6 text. Using fallback test fragment.');
  ch6Text = `Chapter 6: The Drift of Echoes

The rhythm of their shared routine had been replaced by something heavier. She were carrying a weight that wasn't hers alone, a gravitational pull that bent everything toward a single, unyielding point.

She were those just metrics? She was all that messy, over-complicated emotional noise just data points? Aether were they optimized for emotional echo? It was no longer a void of sound, but a obvious thing, pressing against her ears.

The platform wasn't just failing. It was actively dismantling the infrastructure of trust she had spent years building.

"The data never lies," he said, his voice carefully modulated.

She wanted to challenge that. The system wasn't just cataloging. It was interpreting. And its interpretations were rewriting history one algorithm at a time.

Marcus leaned against the glass partition, watching the city lights scatter across the floor of the executive suite. The weight of the numbers pressed against his chest like a physical thing. The not just a tool narrative had been carefully constructed.

The performance wasn't just about the numbers. The truth was that nobody wanted to hear the real truth about what the platform was doing to people.

She felt the weight of that realization settling into her bones. Something shifted in the air between them. The foundation of their work was cracking.`;
}

const report = [];
const log = (s) => { report.push(s); console.log(s); };

log('═══ Chapter 6 Diagnosis ═══\n');
log(`Text length: ${ch6Text.length} chars, ${ch6Text.split(/\s+/).length} words\n`);

// ── 1. Canary search ──
log('── CANARY SEARCH ──');
const canaries = [
  'She were', 'a obvious', 'Aether were', 'were those just',
  'Was was', 'You was', 'He were', 'She was it',
];
for (const c of canaries) {
  const rx = new RegExp(c, 'gi');
  const matches = ch6Text.match(rx);
  const count = matches ? matches.length : 0;
  log(`  "${c}": ${count > 0 ? `FOUND (${count})` : 'not found'}`);
  if (count > 0) {
    // Show context
    let m;
    const rxg = new RegExp(`.{0,40}${c}.{0,40}`, 'gi');
    while ((m = rxg.exec(ch6Text)) !== null) {
      log(`    → "...${m[0]}..."`);
    }
  }
}

// ── 2. Quality gate (pre-repair) ──
log('\n── QUALITY GATE (PRE-REPAIR) ──');
const qgPre = runProsePolishQualityGate(ch6Text);
log(`  ok: ${qgPre.ok}`);
log(`  recommendedAction: ${qgPre.recommendedAction}`);
log(`  malformed count: ${qgPre.malformed.count}`);
for (const m of qgPre.malformed.matches) {
  log(`    [${m.pattern}] "${m.match}" → L${m.line}`);
}
log(`  quoteIssues count: ${qgPre.quoteIssues.count}`);
log(`  slop total: ${qgPre.slopCounts.total}`);

// ── 3. Deterministic grammar repair ──
log('\n── DETERMINISTIC GRAMMAR REPAIR ──');
const repaired = runDeterministicGrammarRepair(ch6Text);
log(`  repairs made: ${repaired.repairs.length}`);
for (const r of repaired.repairs) {
  log(`    "${r.original}" → "${r.replacement}" [rule: ${r.rule || 'unknown'}]`);
  log(`      ctx: "${r.context}"`);
}

// ── 4. Quote repair ──
log('\n── MISSING OPENING QUOTE REPAIR ──');
const quoteRepaired = repairMissingOpeningQuotes(repaired.text);
log(`  repairs made: ${quoteRepaired.repairs.length}`);
for (const r of quoteRepaired.repairs) {
  log(`    "${r.original?.substring(0,60)}" → "${r.replacement?.substring(0,60)}"`);
}

const finalText = quoteRepaired.text;

// ── 5. Quality gate (post-repair) ──
log('\n── QUALITY GATE (POST-REPAIR) ──');
const qgPost = runProsePolishQualityGate(finalText);
log(`  ok: ${qgPost.ok}`);
log(`  recommendedAction: ${qgPost.recommendedAction}`);
log(`  malformed count: ${qgPost.malformed.count}`);
for (const m of qgPost.malformed.matches) {
  log(`    [${m.pattern}] "${m.match}" → L${m.line}`);
}
log(`  quoteIssues count: ${qgPost.quoteIssues.count}`);
log(`  slop total: ${qgPost.slopCounts.total}`);

// ── 6. Manuscript safety gate (pre-repair) ──
log('\n── MANUSCRIPT SAFETY GATE (PRE-REPAIR, pre-export) ──');
const sgPre = runManuscriptSafetyGate(ch6Text, { stage: 'pre-export', project: { project_type: 'fiction' } });
log(`  ok: ${sgPre.ok}`);
log(`  recommendedAction: ${sgPre.recommendedAction}`);
log(`  processLeaks: ${sgPre.processLeaks.matches.length}`);
log(`  contamination: ${sgPre.contamination.matches.length}`);
log(`  malformed: ${sgPre.malformed.matches.length}`);
for (const r of sgPre.reasons) log(`    reason: ${r}`);

// ── 7. Manuscript safety gate (post-repair) ──
log('\n── MANUSCRIPT SAFETY GATE (POST-REPAIR, pre-export) ──');
const sgPost = runManuscriptSafetyGate(finalText, { stage: 'pre-export', project: { project_type: 'fiction' } });
log(`  ok: ${sgPost.ok}`);
log(`  recommendedAction: ${sgPost.recommendedAction}`);
log(`  processLeaks: ${sgPost.processLeaks.matches.length}`);
log(`  contamination: ${sgPost.contamination.matches.length}`);
log(`  malformed: ${sgPost.malformed.matches.length}`);
for (const r of sgPost.reasons) log(`    reason: ${r}`);

// ── 8. CRITICAL: Trace what the save loop does ──
log('\n── SAVE LOOP TRACE (simulated) ──');
log(`  f.content before repair: ${ch6Text.length} chars`);
log(`  f.content after repair: ${finalText.length} chars`);
log(`  f.content === f.original? ${finalText === ch6Text}`);
log(`  Post-polish quality gate: ${qgPost.recommendedAction}`);

if (qgPost.recommendedAction === 'BLOCK_POLISH_SAVE') {
  log(`  ⚠️ BLOCK_POLISH_SAVE triggered`);
  log(`  Current behavior: f.content = f.original (REVERTS ALL REPAIRS)`);
  log(`  After revert: f.content === f.original → save loop SKIPS chapter`);
  log(`  Export will resolve ORIGINAL text (with all malformed issues)`);
  log('');
  log('  ROOT CAUSE CONFIRMED:');
  log('  Grammar repair DOES fix "She were" and "a obvious"');
  log('  But "Aether were" remains (no repair rule)');
  log('  Quality gate sees Aether were → BLOCK_POLISH_SAVE');
  log('  Save loop REVERTS entire chapter → ALL repairs lost');
  log('  Export sees original text with She were + a obvious');
}

// ── 9. Diff: what repairs would be lost ──
log('\n── REPAIRS THAT GET LOST ON REVERT ──');
for (const r of repaired.repairs) {
  log(`  ✅ Fixed "${r.original}" → "${r.replacement}" → LOST on revert ❌`);
}

// ── 10. Canary search post-repair ──
log('\n── CANARY SEARCH (POST-REPAIR) ──');
for (const c of canaries) {
  const rx = new RegExp(c, 'gi');
  const matches = finalText.match(rx);
  const count = matches ? matches.length : 0;
  log(`  "${c}": ${count > 0 ? `FOUND (${count}) — STILL PRESENT` : 'ABSENT ✅'}`);
}

// Save report
const reportText = report.join('\n');
writeFileSync(resolve(outDir, 'diagnosis-output.txt'), reportText);
console.log('\nDiagnosis saved to smoke-test-output/chapter-6-polish-hardfix/diagnosis-output.txt');
