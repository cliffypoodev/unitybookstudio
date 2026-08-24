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

// BOOKGATE-1 — structural integrity of the SAVED manuscript, book-agnostic.
//
// WHY THIS EXISTS. Every repair in this app runs at DRAFT time. A chapter written
// before a given fix existed keeps the defect forever, because nothing ever looks
// at a chapter again once it is saved. Proven on Brass Meridian TEST: ch.3 shipped
// with 96 opening quotes and 57 closing ones - 39 lines of dialogue that open and
// never close - long after QUOTECLOSE-1 made that impossible for new drafts. Four
// of the five chapters were clean. Nothing in the app could tell you which.
//
// Everything below is pure structure: quote balance, word boundaries, terminal
// punctuation, cross-chapter repetition, length. No story vocabulary, no character
// names, no genre assumptions. It gives the same verdict on any book, which is the
// point - the next project inherits the CHECK, not the fixture.
//
// Contrast the legacy term lists at the top of this file, which hardcode
// "the brass key", "Unity Supported Living Services" and other book-specific
// strings. Those stay ADVISORY and are excluded from the structural verdict:
// judging a new project against another book's props produces noise, not signal.
// Per the standing architectural direction, book specifics belong in data.

const SCENE_SEPARATOR_RX = /^[\s*#—–-]+$/;

/** Paragraphs of actual prose - blanks and scene separators removed. */
function proseParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !SCENE_SEPARATOR_RX.test(p));
}

// EPISTOLARY-1 — a letter's salutation and sign-off legitimately end without
// terminal punctuation ("My dearest Elise," / "Yours, always, / Wexcombe").
// They are letter format, not truncated prose, so they must not trip the
// unterminated-paragraph hard block. Deliberately narrow: a salutation is a short
// greeting line ending in a comma; a closing STARTS with a valediction. Genuine
// mid-thought stops ("She turned the key and") match neither and stay blocked.
const SALUTATION_RX = /^(?:my\s+)?(?:dear(?:est)?|beloved)\b[^!?\n]{0,50},\s*$/i;
const VALEDICTION_RX = /^(?:yours|sincerely|faithfully|respectfully|fondly|warmly|affectionately|regards|ever(?:\s+yours)?|with\s+(?:love|affection|respect|regard|gratitude)|your\s+(?:loving|devoted|obedient|humble|ever[-\s]?faithful|friend|servant))\b/i;
function isEpistolaryLine(paragraph) {
  const text = String(paragraph || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return SALUTATION_RX.test(text) || VALEDICTION_RX.test(firstLine);
}

// BACKMATTER-1 — a structural heading legitimately ends without terminal
// punctuation ("Sources", "Bibliography", "Appendix B", "# Notes"). Closed
// vocabulary of structural words plus markdown headings only — genuine
// mid-thought truncation ("She turned the key and") matches neither and
// stays a hard block.
const BACKMATTER_HEADING_RX = /^(?:#{1,6}\s+.*|(?:sources|bibliography|references|works cited|further reading|notes|endnotes|acknowledgm?ents|about the author|glossary|index|appendix(?:\s+[A-Z0-9]+)?|epilogue|prologue|introduction|foreword|preface|afterword|part\s+(?:[IVXLC]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten))\s*)$/i;
// DEADTEST-5 — a chapter heading is also not truncated prose. Same BACKMATTER-1
// principle, but "part" was the only numbered-heading word ever added; "chapter"
// — the single most common heading in a book — was not, so a legitimate opening
// line like "Chapter 1: The Chase" hard-blocked export as an unterminated
// paragraph. Chapter headings commonly carry a subtitle after the number, so
// (unlike bare "part") the trailing content is bounded rather than forbidden.
const CHAPTER_HEADING_RX = /^chapter\s+(?:[IVXLC]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*[:.\-–—]\s*.{0,80})?\s*$/i;
function isStructuralHeadingLine(paragraph) {
  const text = String(paragraph || '').trim();
  return BACKMATTER_HEADING_RX.test(text) || CHAPTER_HEADING_RX.test(text);
}

/** BOOKGATE-1 — structural checks on ONE chapter. Every finding is a hard failure. */
export function checkStructuralIntegrity(text, chapterNum = '?') {
  const src = String(text || '');
  const paras = proseParagraphs(src);

  // 1. Dialogue quote balance, per chapter AND per paragraph - a whole-chapter
  //    count can balance by accident while individual paragraphs do not.
  const openTotal = (src.match(/“/g) || []).length;
  const closeTotal = (src.match(/”/g) || []).length;
  const unbalancedParas = [];
  paras.forEach((p, i) => {
    const o = (p.match(/“/g) || []).length;
    const c = (p.match(/”/g) || []).length;
    if (o !== c) unbalancedParas.push({ index: i, open: o, close: c, excerpt: p.slice(0, 120) });
  });

  // 2. Glued words - the collapsed-dialogue scar. The live artifact was
  //    `"I knowI know"`, where the glued token is "knowI": lowercase run, capital,
  //    then a word boundary. Requiring lowercase AFTER the capital misses exactly
  //    that shape, so the trailing run is optional. Two-plus lowercase before the
  //    capital keeps iPhone/eBook/iOS out without an allowlist doing the work.
  const gluedWords = [...new Set(
    (src.match(/\b[a-z]{2,}[A-Z][a-z]*\b/g) || [])
      .filter((w) => !/^(?:iPhone|iPad|eBook|macOS|iOS|iPod|iCloud)$/.test(w))
  )];

  // 3. Paragraphs that simply stop mid-thought.
  const unterminated = paras
    .filter((p) => !/[.!?”"’')\]]$/.test(p) && !isEpistolaryLine(p) && !isStructuralHeadingLine(p))
    .map((p) => ({ excerpt: p.slice(-120) }));

  // 4. Mixed quote typography - a manuscript should pick one and keep it.
  const straightQuotes = (src.match(/"/g) || []).length;

  const quoteBalancePass = openTotal === closeTotal && unbalancedParas.length === 0;
  const gluedPass = gluedWords.length === 0;
  const terminationPass = unterminated.length === 0;
  const typographyPass = !(straightQuotes > 0 && openTotal > 0);

  return {
    chapter: chapterNum,
    pass: quoteBalancePass && gluedPass && terminationPass && typographyPass,
    quoteBalance: {
      pass: quoteBalancePass, open: openTotal, close: closeTotal,
      unbalancedParagraphs: unbalancedParas.length, details: unbalancedParas.slice(0, 10),
    },
    gluedWords: { pass: gluedPass, count: gluedWords.length, details: gluedWords.slice(0, 10) },
    unterminatedParagraphs: {
      pass: terminationPass, count: unterminated.length, details: unterminated.slice(0, 5),
    },
    typography: { pass: typographyPass, straightQuotes, curlyOpen: openTotal },
  };
}

/** Lowercased content words, punctuation stripped. */
function normalizedWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean);
}

/**
 * BOOKGATE-1 — checks that only exist ACROSS chapters. A per-chapter gate is blind
 * to every one of these, which is why they survived every draft-time repair.
 */
export function checkBookIntegrity(chapters, { gram = 8, lengthFloorRatio = 0.8 } = {}) {
  const texts = (chapters || []).map((c, i) => ({
    n: i + 1,
    text: typeof c === 'string' ? c : (c?.content || c?.content_md || ''),
  }));

  // 1. Phrases repeated across chapter boundaries.
  const seen = new Map();
  for (const c of texts) {
    const w = normalizedWords(c.text);
    for (let i = 0; i + gram <= w.length; i += 1) {
      const g = w.slice(i, i + gram).join(' ');
      if (!seen.has(g)) seen.set(g, new Set());
      seen.get(g).add(c.n);
    }
  }
  const crossEchoes = [...seen.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([phrase, s]) => ({ phrase, chapters: [...s].sort((a, b) => a - b) }));

  // 2. Repeated OPENING images. Two chapters starting on the same picture is the
  //    repetition a reader notices first, and no per-chapter check can see it.
  //    Proven on Brass Meridian TEST: ch.3 and ch.4 both opened on a tremor
  //    travelling up through the same character's boots.
  const openings = texts.map((c) => ({
    n: c.n,
    first: normalizedWords(proseParagraphs(c.text)[0] || '').slice(0, 40),
  }));
  const openingEchoes = [];
  for (let i = 0; i < openings.length; i += 1) {
    for (let j = i + 1; j < openings.length; j += 1) {
      const a = openings[i].first;
      const b = new Set(openings[j].first);
      const shared = [];
      for (let k = 0; k + 4 <= a.length; k += 1) {
        const run = a.slice(k, k + 4);
        if (run.every((w) => b.has(w))) shared.push(run.join(' '));
      }
      if (shared.length) {
        openingEchoes.push({ chapters: [openings[i].n, openings[j].n], shared: shared.slice(0, 3) });
      }
    }
  }

  // 3. Length outliers against the median.
  const counts = texts.map((c) => normalizedWords(c.text).length);
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const shortChapters = texts
    .map((c, i) => ({ n: c.n, words: counts[i] }))
    .filter(() => median > 0)
    .filter((c) => c.words < median * lengthFloorRatio);

  return {
    pass: crossEchoes.length === 0 && openingEchoes.length === 0 && shortChapters.length === 0,
    chapters: texts.length,
    medianWords: median,
    crossChapterEchoes: {
      pass: crossEchoes.length === 0, count: crossEchoes.length, details: crossEchoes.slice(0, 15),
    },
    openingEchoes: {
      pass: openingEchoes.length === 0, count: openingEchoes.length, details: openingEchoes,
    },
    shortChapters: {
      pass: shortChapters.length === 0, floor: Math.round(median * lengthFloorRatio),
      details: shortChapters,
    },
  };
}

// BOOKGATE-3 — book-specific vocabulary is DATA, not code.
//
// The lists at the top of this file hardcode "the brass key", "Unity Supported
// Living Services", "care documentation" and other strings from two specific
// projects. Judging a NEW book against another book's props produces noise, and
// the "LITERAL OBJECT PRESERVATION" report would tell the next project that its
// manuscript is missing a brass key it never had.
//
// They are now OPT-IN. A caller that knows its project passes its own terms;
// everyone else gets the structural checks and nothing else. The legacy arrays
// stay exported so the Brass Meridian / Unity runs remain reproducible, but
// nothing reaches for them by default.
const NO_TERMS = { contamination: [], literals: [] };

export function validateChapterOutput(text, chapterNum = '?', projectTerms = NO_TERMS) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;

  const activeContamination = Array.isArray(projectTerms?.contamination)
    ? projectTerms.contamination : [];
  const activeLiterals = Array.isArray(projectTerms?.literals) ? projectTerms.literals : [];

  const contamination = {};
  let contaminationTotal = 0;
  for (const term of activeContamination) {
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
  for (const obj of activeLiterals) {
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

  // BOOKGATE-1: structural integrity is book-agnostic and therefore gates.
  const structural = checkStructuralIntegrity(text, chapterNum);

  const overallPass = contaminationPass && malformedPass && leakedPass && notJustPass
    && structural.pass;

  const result = {
    chapter: chapterNum,
    words,
    chars,
    overallPass,
    structural,
    contamination: { pass: contaminationPass, total: contaminationTotal, details: contamination },
    forbidden: { total: forbiddenTotal, details: forbidden },
    literals: { total: literalTotal, details: literals },
    malformed: { pass: malformedPass, total: malformedTotal, details: malformed },
    leaked: { pass: leakedPass, total: leakedTotal, details: leaked },
    notJust: { pass: notJustPass, count: notJustCount },
  };

  return result;
}

export function validateAllChapters(chapters, projectTerms = NO_TERMS) {
  const results = [];
  for (let i = 0; i < chapters.length; i++) {
    const text = typeof chapters[i] === 'string' ? chapters[i] : (chapters[i]?.content || chapters[i]?.content_md || '');
    results.push(validateChapterOutput(text, i + 1, projectTerms));
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

  // BOOKGATE-1: structural table — the book-agnostic verdict, and the one that
  // catches a chapter drafted before a repair existed.
  console.log('\n=== BOOKGATE-1 STRUCTURAL INTEGRITY (book-agnostic) ===');
  console.log('Ch | quotes open/close | unbal paras | glued | unterminated | PASS');
  for (const r of results) {
    const s = r.structural;
    console.log([
      String(s.chapter).padStart(2),
      `${s.quoteBalance.open}/${s.quoteBalance.close}`.padStart(17),
      String(s.quoteBalance.unbalancedParagraphs).padStart(11),
      String(s.gluedWords.count).padStart(5),
      String(s.unterminatedParagraphs.count).padStart(12),
      s.pass ? '✅' : '❌',
    ].join(' | '));
  }
  for (const r of results) {
    const s = r.structural;
    if (s.pass) continue;
    console.log(`\n--- Ch.${s.chapter} structural failures ---`);
    if (!s.quoteBalance.pass) {
      console.log(`  UNCLOSED DIALOGUE: ${s.quoteBalance.unbalancedParagraphs} paragraph(s), ` +
        `chapter totals ${s.quoteBalance.open} open / ${s.quoteBalance.close} close`);
      s.quoteBalance.details.forEach((d) => console.log(`    [${d.open}/${d.close}] ${d.excerpt}`));
    }
    if (!s.gluedWords.pass) console.log('  GLUED WORDS:', s.gluedWords.details);
    if (!s.unterminatedParagraphs.pass) {
      console.log(`  UNTERMINATED PARAGRAPHS: ${s.unterminatedParagraphs.count}`);
      s.unterminatedParagraphs.details.forEach((d) => console.log(`    ...${d.excerpt}`));
    }
    if (!s.typography.pass) {
      console.log(`  MIXED QUOTE TYPOGRAPHY: ${s.typography.straightQuotes} straight, ` +
        `${s.typography.curlyOpen} curly`);
    }
  }

  // BOOKGATE-1: cross-chapter checks. No per-chapter gate can see these.
  const book = checkBookIntegrity(chapters);
  console.log('\n=== BOOKGATE-1 CROSS-CHAPTER (median ' + book.medianWords + ' words) ===');
  console.log(`  repeated 8-word phrases across chapters: ${book.crossChapterEchoes.count} ` +
    (book.crossChapterEchoes.pass ? '✅' : '❌'));
  book.crossChapterEchoes.details.forEach((d) =>
    console.log(`    [ch ${d.chapters.join(',')}] "${d.phrase}"`));
  console.log(`  chapters opening on the same image: ${book.openingEchoes.count} ` +
    (book.openingEchoes.pass ? '✅' : '❌'));
  book.openingEchoes.details.forEach((d) =>
    console.log(`    ch${d.chapters[0]} + ch${d.chapters[1]}: ${JSON.stringify(d.shared)}`));
  console.log(`  chapters under the ${book.shortChapters.floor}-word floor: ` +
    `${book.shortChapters.details.length} ` + (book.shortChapters.pass ? '✅' : '❌'));
  book.shortChapters.details.forEach((d) => console.log(`    ch${d.n}: ${d.words} words`));

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
    // BOOKGATE-3: pass { contamination: [...], literals: [...] } as the 2nd/3rd arg
    // to score against THIS project. Default is no book vocabulary at all.
    checkAll: validateAllChapters,
    // BOOKGATE-1: book-agnostic structural checks, usable on any project.
    structural: checkStructuralIntegrity,
    book: checkBookIntegrity,
    CONTAMINATION_TERMS,
    FORBIDDEN_PHRASES,
    LITERAL_OBJECTS,
    MALFORMED_FRAGMENTS,
  };
  console.log('[PIPELINE-VALIDATOR] BOOKGATE-1 loaded. __UBS_VALIDATOR.checkAll([ch1..chN]) ' +
    'runs structural + cross-chapter integrity on the SAVED text of any project.');
}
