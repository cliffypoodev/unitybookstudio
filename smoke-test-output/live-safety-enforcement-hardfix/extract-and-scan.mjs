// Extract text from the (4).docx and scan Chapter 2 with the safety gate
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = __dirname; // already in the right directory

const docxPath = '/Users/cliff/Downloads/digital-equity-tribunal (4).docx';
const tmpDir = resolve(outDir, 'docx-extract');
mkdirSync(tmpDir, { recursive: true });

execSync(`unzip -o "${docxPath}" -d "${tmpDir}" 2>/dev/null || true`);

const docXml = readFileSync(resolve(tmpDir, 'word', 'document.xml'), 'utf8');

// Extract text content from XML
const textContent = docXml
  .replace(/<w:br[^>]*\/>/g, '\n')
  .replace(/<w:p[^>]*\/>/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/\n{3,}/g, '\n\n')
  .trim();

writeFileSync(resolve(outDir, 'extracted-full-text.txt'), textContent);
console.log(`Extracted ${textContent.length} chars from DOCX`);

// Search for known canaries in full text first
console.log('\n=== CANARY SEARCH IN FULL TEXT ===');
const canaries = [
  'The opening is sharp, highly polished',
  'You have successfully executed',
  'Next Move:',
  'Action Plan:',
  'Unity Supported Living',
  'Unity Media',
  'You was',
  'Was was',
  'care documentation',
  'compliance documentation',
];
for (const c of canaries) {
  const idx = textContent.indexOf(c);
  if (idx >= 0) {
    console.log(`  ✅ FOUND "${c}" at index ${idx}`);
    console.log(`     context: ...${textContent.substring(Math.max(0, idx-30), idx+c.length+30).replace(/\n/g, '⏎')}...`);
  } else {
    console.log(`  ❌ NOT FOUND: "${c}"`);
  }
}

// Find Chapter 2 using various markers
let ch2Text = '';
const ch2Patterns = [
  /Chapter\s+2[:\s—–-][^\n]*\n([\s\S]*?)(?=\nChapter\s+3[:\s—–-])/i,
  /Chapter\s+2\n([\s\S]*?)(?=\nChapter\s+3)/i,
  /Chapter 2[^\n]*\n([\s\S]*?)(?=Chapter 3)/i,
];

for (const rx of ch2Patterns) {
  const m = textContent.match(rx);
  if (m) {
    ch2Text = m[1].trim();
    console.log(`\n--- Chapter 2 found via ${rx.source.substring(0, 40)}... : ${ch2Text.length} chars ---`);
    break;
  }
}

if (!ch2Text) {
  // Try splitting by "Chapter N" markers
  const parts = textContent.split(/(?=Chapter \d+)/i);
  console.log(`\nSplit into ${parts.length} parts by "Chapter N" marker`);
  for (let i = 0; i < Math.min(parts.length, 5); i++) {
    console.log(`  Part ${i}: ${parts[i].substring(0, 100).replace(/\n/g, '⏎')}...`);
  }
  if (parts.length >= 3) {
    ch2Text = parts[2].replace(/^Chapter\s+2[^\n]*\n?/i, '').trim();
    console.log(`Using part[2] as Chapter 2: ${ch2Text.length} chars`);
  }
}

if (ch2Text) {
  writeFileSync(resolve(outDir, 'chapter-2-extracted.txt'), ch2Text);
  console.log(`\n--- Chapter 2 first 800 chars ---`);
  console.log(ch2Text.substring(0, 800));
  
  // Scan with safety gate
  const projectRoot = resolve(__dirname, '..', '..');
  const gatePath = resolve(projectRoot, 'src', 'lib', 'manuscriptSafetyGate.js');
  const { runManuscriptSafetyGate } = await import(gatePath);
  
  const gate = runManuscriptSafetyGate(ch2Text, {
    project: { project_type: 'anthology', genre: 'literary fiction' },
    chapter: { chapter_number: 2 },
    stage: 'pre-export',
  });
  
  console.log('\n=== SAFETY GATE RESULT FOR CHAPTER 2 ===');
  console.log('ok:', gate.ok);
  console.log('recommendedAction:', gate.recommendedAction);
  console.log('processLeaks:', gate.processLeaks.matches.length, 'matches');
  for (const m of gate.processLeaks.matches) {
    console.log(`  [LEAK] "${m.phrase}" → ${m.snippet?.substring(0, 100)}`);
  }
  console.log('contamination:', gate.contamination.matches.length, 'matches');
  for (const m of gate.contamination.matches) {
    console.log(`  [CONTAM] "${m.phrase}" → ${m.snippet?.substring(0, 100)}`);
  }
  console.log('malformed:', gate.malformed.matches.length, 'matches');
  for (const m of gate.malformed.matches) {
    console.log(`  [MALFORM] "${m.phrase}" → ${m.snippet?.substring(0, 100)}`);
  }
  console.log('\nreasons:');
  for (const r of gate.reasons) console.log(`  - ${r}`);
  
  writeFileSync(resolve(outDir, 'chapter-2-gate-result.json'), JSON.stringify(gate, null, 2));
  
  console.log('\n=== VERDICT ===');
  if (!gate.ok && gate.processLeaks.hasLeak && gate.contamination.hasContamination) {
    console.log('✅ Safety gate CORRECTLY detects all failures in extracted Chapter 2.');
    console.log('The gate works. The bypass is in the export path, not in the detection.');
  } else {
    console.log('❌ Safety gate MISSED some failures. Fix manuscriptSafetyGate.js first.');
  }
} else {
  console.error('\n❌ Could not extract Chapter 2 from DOCX.');
}
