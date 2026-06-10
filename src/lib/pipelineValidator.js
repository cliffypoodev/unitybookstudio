/**
 * Pipeline Validator — smoke-test utility for manuscript pipeline.
 * Usage from console: __UBS_VALIDATOR.check(chapterText)
 * Or: __UBS_VALIDATOR.checkAll(arrayOfChapterTexts)
 */

const CONTAMINATION_TERMS = [
  'Unity Supported Living Services',
  'Unity Media Solutions',
  'Unity Core',
  'OmniCorp',
  'ROI',
  'cohort analysis',
  'subscription service',
  'care documentation',
  'compliance pipeline',
  'mobile logging system',
  'Project Management Office',
  'AI content pipeline',
  'business plan',
  'investor interest',
  'premium digital resource hub',
  'caregiving community',
  'developmental disabilities',
  'funding streams',
  'market penetration',
];

const FORBIDDEN_PHRASES = [
  'not just',
  'more than just',
  'the truth was',
  'the lie was',
  'the secret was',
  'the mystery was',
  'the narrative',
  'the performance',
  'the emotional architecture',
  'the collective memory',
  "the town's identity",
  'the weight of',
  'woven into',
  'fabric of',
  'foundation of the lie',
  'rot beneath',
  'a sense of',
  'the air was thick',
  'the air itself felt thick',
  'washed over',
  "couldn't help but",
];

const LITERAL_OBJECTS = [
  'the ledger',
  'the secondary ledger',
  'the diary',
  'the brass key',
  'the plaque',
  'the lockbox',
  'the receipt',
  'the watch',
];

const MALFORMED_FRAGMENTS = [
  'from to the',
  'looked at;',
  'looked at.',
  'fixed on,',
  'fixed on.',
  'shifted his gaze from to',
  'shifted her gaze from to',
  'reached for to',
  'turned from to',
];

const LEAKED_NOTES = [
  'Self-Correction',
  'Anticipation Check',
  'Thinking',
  'Next steps',
  'Emotional Arc',
  'CHAPTER NOTES',
  'REVISION NOTES',
  'TODO:',
  'FIXME:',
  'NOTE:',
];

function countOccurrences(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'gi');
  return (text.match(rx) || []).length;
}

export function validateChapterOutput(text, chapterNum = '?') {
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;

  const contamination = {};
  let contaminationTotal = 0;
  for (const term of CONTAMINATION_TERMS) {
    const count = countOccurrences(text, term);
    if (count > 0) {
      contamination[term] = count;
      contaminationTotal += count;
    }
  }

  const forbidden = {};
  let forbiddenTotal = 0;
  for (const phrase of FORBIDDEN_PHRASES) {
    const count = countOccurrences(text, phrase);
    if (count > 0) {
      forbidden[phrase] = count;
      forbiddenTotal += count;
    }
  }

  const literals = {};
  let literalTotal = 0;
  for (const obj of LITERAL_OBJECTS) {
    const count = countOccurrences(text, obj);
    literals[obj] = count;
    literalTotal += count;
  }

  const malformed = {};
  let malformedTotal = 0;
  for (const frag of MALFORMED_FRAGMENTS) {
    const count = countOccurrences(text, frag);
    if (count > 0) {
      malformed[frag] = count;
      malformedTotal += count;
    }
  }

  const leaked = {};
  let leakedTotal = 0;
  for (const note of LEAKED_NOTES) {
    const count = countOccurrences(text, note);
    if (count > 0) {
      leaked[note] = count;
      leakedTotal += count;
    }
  }

  const notJustCount = countOccurrences(text, 'not just');
  const notJustPass = notJustCount <= 2;

  const contaminationPass = contaminationTotal === 0;
  const malformedPass = malformedTotal === 0;
  const leakedPass = leakedTotal === 0;

  const overallPass = contaminationPass && malformedPass && leakedPass && notJustPass;

  const result = {
    chapter: chapterNum,
    words,
    chars,
    overallPass,
    contamination: { pass: contaminationPass, total: contaminationTotal, details: contamination },
    forbidden: { total: forbiddenTotal, details: forbidden },
    literals: { total: literalTotal, details: literals },
    malformed: { pass: malformedPass, total: malformedTotal, details: malformed },
    leaked: { pass: leakedPass, total: leakedTotal, details: leaked },
    notJust: { pass: notJustPass, count: notJustCount },
  };

  return result;
}

export function validateAllChapters(chapters) {
  const results = [];
  for (let i = 0; i < chapters.length; i++) {
    const text = typeof chapters[i] === 'string' ? chapters[i] : (chapters[i]?.content || chapters[i]?.content_md || '');
    results.push(validateChapterOutput(text, i + 1));
  }

  // Print summary table
  console.log('\n=== PIPELINE SMOKE TEST RESULTS ===');
  console.log('Ch | Words | Contam | Forbidden | Literals | Malformed | Leaked | not-just | PASS');
  console.log('---|-------|--------|-----------|----------|-----------|--------|----------|-----');
  for (const r of results) {
    const row = [
      String(r.chapter).padStart(2),
      String(r.words).padStart(5),
      (r.contamination.pass ? '✅ 0' : `❌ ${r.contamination.total}`).padStart(6),
      String(r.forbidden.total).padStart(9),
      String(r.literals.total).padStart(8),
      (r.malformed.pass ? '✅ 0' : `❌ ${r.malformed.total}`).padStart(9),
      (r.leaked.pass ? '✅ 0' : `❌ ${r.leaked.total}`).padStart(6),
      (r.notJust.pass ? `✅ ${r.notJust.count}` : `❌ ${r.notJust.count}`).padStart(8),
      r.overallPass ? '✅' : '❌',
    ].join(' | ');
    console.log(row);
  }

  // Print failures
  const failures = results.filter(r => !r.overallPass);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) {
      console.log(`Ch.${f.chapter}:`);
      if (!f.contamination.pass) console.log('  CONTAMINATION:', f.contamination.details);
      if (!f.malformed.pass) console.log('  MALFORMED:', f.malformed.details);
      if (!f.leaked.pass) console.log('  LEAKED NOTES:', f.leaked.details);
      if (!f.notJust.pass) console.log('  NOT-JUST:', f.notJust.count, 'occurrences (max 2)');
    }
  }

  // Print forbidden phrase summary
  console.log('\n=== FORBIDDEN PHRASE COUNTS (info only) ===');
  const allForbidden = {};
  for (const r of results) {
    for (const [phrase, count] of Object.entries(r.forbidden.details)) {
      allForbidden[phrase] = (allForbidden[phrase] || 0) + count;
    }
  }
  const sorted = Object.entries(allForbidden).sort((a, b) => b[1] - a[1]);
  for (const [phrase, count] of sorted) {
    console.log(`  "${phrase}": ${count}`);
  }

  console.log('\n=== LITERAL OBJECT PRESERVATION ===');
  const allLiterals = {};
  for (const r of results) {
    for (const [obj, count] of Object.entries(r.literals.details)) {
      allLiterals[obj] = (allLiterals[obj] || 0) + count;
    }
  }
  for (const [obj, count] of Object.entries(allLiterals)) {
    const status = count > 0 ? '✅' : '⚠️ MISSING';
    console.log(`  ${status} "${obj}": ${count}`);
  }

  return results;
}

// Auto-register on window for console access
if (typeof window !== 'undefined') {
  window.__UBS_VALIDATOR = {
    check: validateChapterOutput,
    checkAll: validateAllChapters,
    CONTAMINATION_TERMS,
    FORBIDDEN_PHRASES,
    LITERAL_OBJECTS,
    MALFORMED_FRAGMENTS,
  };
  console.log('[PIPELINE-VALIDATOR] Loaded. Use __UBS_VALIDATOR.check(text) or __UBS_VALIDATOR.checkAll([ch1, ch2, ch3])');
}
