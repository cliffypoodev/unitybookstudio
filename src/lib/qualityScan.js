/**
 * Post-generation quality scanning for chapters.
 * Produces warnings (not auto-fixes) for the Review tab.
 */

import { stripDialogue } from '@/lib/povTense';

// Common stop words to exclude from repetition scanning
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can',
  'could','not','no','so','if','then','than','that','this','it','he',
  'she','they','we','you','me','him','her','them','us','my','his','her',
  'its','our','your','their','who','what','which','when','where','how',
  'all','each','every','both','few','more','most','other','some','such',
  'into','up','out','over','down','back','just','about','only','very',
  'also','still','even','now','here','there','again','once','never',
  'said','says','like','as','been','about','after','before','between',
  'through','during','without','again','further','then','once','upon',
  'much','well','way','long','too','own','same','made','come','make',
  'know','take','see','look','come','think','tell','give','find','want',
  'seem','feel','leave','call','keep','turn','hand','eyes','head','face',
  'time','door','room','voice','body','back','away','around','something',
  'nothing','went','came','going','looked','asked','knew','thought','took',
  'didn','don','didn','wasn','couldn','wouldn','hadn','isn','aren','doesn',
]);

/**
 * Scan chapter text for word repetition (>8 occurrences of any non-stop word).
 * Returns array of warning strings.
 */
export function scanWordRepetition(text, chapterNumber, characterNames = [], cap = 8) {
  const warnings = [];
  if (!text) return warnings;

  // Normalize character names for exclusion
  const nameSet = new Set(
    characterNames.flatMap(n => n.toLowerCase().split(/\s+/))
  );

  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const freq = {};
  for (const w of words) {
    if (w.length <= 3) continue;
    if (STOP_WORDS.has(w)) continue;
    if (nameSet.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }

  const overused = Object.entries(freq)
    .filter(([, count]) => count > cap)
    .sort((a, b) => b[1] - a[1]);

  for (const [word, count] of overused) {
    warnings.push(`Word frequency: '${word}' appears ${count}x in Ch ${chapterNumber} (cap: ${cap})`);
  }

  return warnings;
}

/**
 * Scan for POV drift: first-person "I" in third-person spec (outside dialogue).
 * Only flags if >5 instances found.
 */
export function scanPovDrift(text, project, chapterNumber) {
  const warnings = [];
  if (!text || !project?.pov_mode) return warnings;

  const pov = project.pov_mode;
  // Only check third-person modes
  if (pov !== 'third-close' && pov !== 'third-omni' && pov !== 'third-multi') {
    return warnings;
  }

  const withoutDialogue = stripDialogue(text);

  // Count standalone "I" as subject pronoun (word boundary + uppercase I + word boundary)
  // Match "I" followed by a verb-like word or common patterns
  const matches = withoutDialogue.match(/\bI\s+(?:[a-z])/g) || [];
  const count = matches.length;

  if (count > 5) {
    warnings.push(
      `POV drift: ${count} first-person "I" instances found outside dialogue in Ch ${chapterNumber} (project POV: ${pov}). Review for accidental first-person narration.`
    );
  }

  return warnings;
}

/**
 * Scan nonfiction chapter text for integrity markers inserted by the post-generation cleanup:
 * - Composite character labels
 * - FOIA anachronism fixes (already applied)
 * - Unverified statistic flags [VERIFY: ...]
 */
export function scanNonfictionIntegrity(text, project, chapterNumber) {
  const warnings = [];
  if (!text || project?.book_type !== 'nonfiction') return warnings;

  // Count composite labels
  const compositeMatches = text.match(/\[The following account is a composite[^\]]*\]/g) || [];
  if (compositeMatches.length > 0) {
    warnings.push(`Unlabeled Composites: ${compositeMatches.length} composite character label(s) inserted in Ch ${chapterNumber}. Review for accuracy.`);
  }

  // Count unverified statistic flags
  const verifyMatches = text.match(/\[VERIFY: [^\]]*\]/g) || [];
  if (verifyMatches.length > 0) {
    warnings.push(`Unverified Statistics: ${verifyMatches.length} statistical claim(s) in Ch ${chapterNumber} need source confirmation. Search for [VERIFY] in the text.`);
  }

  return warnings;
}

/**
 * Scan nonfiction prose for fabrication risk: sentences that ASSERT a specific document,
 * archival discovery, named source reveal, or conclusive proof. These are surfaced for human
 * verification, NOT auto-failed — the scanner cannot know truth, only that a claim asserts
 * specific evidence that must be checked against real sources before publishing. This catches
 * confident fabrication written as plain prose (e.g. "In 1974 a researcher uncovered ledgers...")
 * that the marker-based scans above miss because nothing inserted a flag.
 */
// Cross-checks drafted prose against the project's research: flags direct
// quotes, titled officials, and named documents that do NOT appear in the
// research. Returns { clean, violations:[{type, snippet, detail}] }. Heuristic
// but tuned to catch invented quotes/officials/documents while sparing real
// sourced people. Consumed by the scene-writer's blocking-retry check.
export function crossCheckResearchFabrication(text, project) {
  if (!text || !project || project.book_type !== 'nonfiction') return { clean: true, violations: [] };
  const researchRaw = typeof project.research_data === 'string'
    ? project.research_data
    : (project.research_data ? JSON.stringify(project.research_data) : '');
  if (!researchRaw || researchRaw.length < 50) return { clean: true, violations: [] };
  const norm = (s) => (s || '').toLowerCase().replace(/[\u2018\u2019\u2032`]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
  const hay = norm(researchRaw + ' ' + (project.world_md || '') + ' ' + (project.characters_md || '') + ' ' + (project.outline_md || '') + ' ' + (project.canon_md || ''));
  const violations = [];
  const seen = new Set();
  const add = (type, snippet, detail) => {
    const k = type + '|' + snippet.toLowerCase().slice(0, 60);
    if (seen.has(k)) return;
    seen.add(k);
    violations.push({ type, snippet: snippet.slice(0, 90), detail });
  };
  // 1) Direct quotes not present in research (possible invented quotation)
  const quoteRe = /["\u201c]([^"\u201d\n\r]{25,240})["\u201d]/g;
  let qm;
  while ((qm = quoteRe.exec(text)) !== null) {
    const q = qm[1].trim();
    const words = norm(q).split(' ').filter(Boolean);
    if (words.length < 5 || !/[a-z]/i.test(q)) continue;
    const head = words.slice(0, 6).join(' ');
    const tail = words.slice(-6).join(' ');
    if (!hay.includes(head) && !hay.includes(tail)) add('quote', q, 'quotation not found in research');
  }
  // 2) Titled officials presented as sources/actors, not in research
  const KNOWN = new Set(['lincoln', 'granger', 'gordon granger', 'abraham lincoln']);
  const titleRe = /\b(Major General|Brigadier General|General|Judge|Governor|Colonel|Captain|Lieutenant|Senator|Secretary|President)\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2})/g;
  let tm;
  while ((tm = titleRe.exec(text)) !== null) {
    const name = norm(tm[2]).replace(/[.'-]+$/, '');
    const last = name.split(' ').pop();
    if (KNOWN.has(name) || KNOWN.has(last)) continue;
    if (!hay.includes(name) && !hay.includes(last)) add('person', (tm[1] + ' ' + tm[2]).replace(/[.'-]+$/, ''), 'named official not found in research');
  }
  // 3) Named documents (ProperNoun + doc-noun) not traceable to research
  const DOC = '(ledger|dispatch|telegram|memorandum|memo|injunction|gazette|courthouse|logbook|register|deed|manifest)';
  const docRe = new RegExp("((?:[A-Z][a-zA-Z.&'-]+\\s+){1,4})" + DOC + "\\b", 'g');
  let dm;
  const GEO = new Set(['county', 'court', 'state', 'texas', 'union', 'federal', 'galveston', 'general', 'order']);
  while ((dm = docRe.exec(text)) !== null) {
    const owner = dm[1].trim();
    const on = norm(owner);
    const toks = on.split(' ').filter((w) => w.length > 3 && !GEO.has(w));
    if (toks.length === 0) continue;
    if (!hay.includes(on) && !toks.some((t) => hay.includes(t))) add('document', dm[0].trim(), 'named document not traceable to research');
  }
  return { clean: violations.length === 0, violations };
}

export function scanNonfictionFabricationRisk(text, project, chapterNumber) {
  const warnings = [];
  if (!text || project?.book_type !== 'nonfiction') return warnings;

  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const docNoun = /\b(ledgers?|manifests?|dispatch(?:es)?|diary|diaries|journals?|transcripts?|regist(?:ry|ers?)|archives?|documents?|tapes?|recordings?|letters?|memos?|records?|files?|correspondence|logs?|telegrams?|affidavits?|depositions?)\b/i;
  const discoveryVerb = /\b(uncovered|discovered|unearthed|stumbled (?:upon|across|onto)|came to light|surfaced|recovered|located|brought to light|long[- ]forgotten|tucked (?:away|between)|overlooked for)\b/i;
  const datedDiscovery = /\bin\s+(1[6-9]\d{2}|20\d{2})\b[^.?!]{0,80}\b(uncovered|discovered|unearthed|stumbled|surfaced|found|came to light)\b/i;
  const namedSource = /\b(?:a|an|the|one)\s+(?:young\s+|veteran\s+)?(researcher|historian|archivist|scholar|investigator|graduate student|clerk)\b[^.?!]{0,80}\b(uncovered|discovered|found|stumbled|noticed|realized)\b/i;
  const certainty = /\b(smoking gun|breakthrough|conclusive(?:ly)?|irrefutabl[ey]|definitive(?:ly)? proof|proves (?:that|the|beyond)|undeniabl[ey]|the evidence (?:shows|proves) (?:conclusively|definitively))\b/i;

  const flagged = [];
  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;
    const hit = (discoveryVerb.test(sentence) && docNoun.test(sentence)) || datedDiscovery.test(sentence) || namedSource.test(sentence) || certainty.test(sentence);
    if (hit) flagged.push(sentence.length > 160 ? sentence.slice(0, 157) + '...' : sentence);
  }

  if (flagged.length > 0) {
    const shown = flagged.slice(0, 8).map(function (f, i) { return '  ' + (i + 1) + '. ' + f; }).join('\n');
    const more = flagged.length > 8 ? '\n  ...and ' + (flagged.length - 8) + ' more.' : '';
    warnings.push('Fabrication risk (Ch ' + chapterNumber + '): ' + flagged.length + ' sentence(s) assert a specific document, discovery, or proof. VERIFY each against a real source before publishing — the model can invent evidence that reads as documented:\n' + shown + more);
  }

  return warnings;
}

/**
 * Run all quality scans and return a combined warning string for the quality_scan field.
 */
export function runQualityScan(text, project, chapterNumber, characterNames = []) {
  const warnings = [
    ...scanWordRepetition(text, chapterNumber, characterNames),
    ...scanPovDrift(text, project, chapterNumber),
    ...scanNonfictionIntegrity(text, project, chapterNumber),
    ...scanNonfictionFabricationRisk(text, project, chapterNumber),
  ];

  return warnings.length ? warnings.join('\n') : '';
}