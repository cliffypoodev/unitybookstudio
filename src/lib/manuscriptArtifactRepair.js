/**
 * Manuscript Artifact Repair v19 — SAFE ATTRIBUTION + HARD ALIAS + MANUAL LINE-EDIT GUARD
 *
 * v3 overreached around dialogue attribution and helped create quote damage.
 * v4 removes broad quote-rewriting rules and only performs deterministic,
 * local, non-creative cleanup. Quote boundaries belong to quoteFixPolish v6.
 *
 * Public API unchanged:
 * - repairManuscriptArtifacts(text, options)
 * - repairLoadedManuscriptArtifacts(loaded)
 */

function normalize(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function applyRule(text, rx, replacement, changes, label) {
  const before = text;
  const after = text.replace(rx, replacement);
  if (after !== before) changes.push(label);
  return after;
}

// LEGACYSTAGES-1: a handful of rules below connect two parts of a sentence
// with an unbounded \s+/\s* — which, unlike every OTHER rule in this file,
// can match straight through a real \n{2,} paragraph break and silently
// MERGE two paragraphs into one (this file has no paragraph array to
// "delete" from; the loss was always this kind of whitespace-spanning
// merge). guardedReplace is a drop-in for text.replace(rx, replacement)
// that refuses to let a match cross a paragraph break: it leaves that one
// match untouched and records { paragraphIndex, reason } instead, while
// every other match (the overwhelming majority — same-paragraph prose)
// is replaced exactly as before. Rules that cannot span a break (bounded
// character classes, no whitespace connector) are left on plain applyRule.
function paragraphIndexAt(text, offset) {
  // The 0-based index of the paragraph containing `offset` is exactly the
  // number of paragraph BREAKS already crossed before it — not the number of
  // (possibly still-partial) text segments before it, which is off by one
  // whenever offset falls partway through a paragraph rather than at its very
  // start.
  return (text.slice(0, offset).match(/\n{2,}/g) || []).length;
}

function guardedReplace(text, rx, replacement, flagSink, reason) {
  const re = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : `${rx.flags}g`);
  const plain = new RegExp(rx.source, rx.flags.replace('g', ''));
  let result = '';
  let lastIndex = 0;
  let changed = false;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fullMatch = m[0];
    if (/\n[ \t]*\n/.test(fullMatch)) {
      flagSink.push({ paragraphIndex: paragraphIndexAt(text, m.index), reason });
      result += text.slice(lastIndex, m.index) + fullMatch;
    } else {
      const replaced = typeof replacement === 'function'
        ? replacement(...m, m.index, text)
        : fullMatch.replace(plain, replacement);
      if (replaced !== fullMatch) changed = true;
      result += text.slice(lastIndex, m.index) + replaced;
    }
    lastIndex = re.lastIndex;
    if (re.lastIndex === m.index) re.lastIndex += 1; // never loop forever on a zero-length match
  }
  result += text.slice(lastIndex);
  return { text: result, changed };
}

function applyRuleParagraphSafe(text, rx, replacement, changes, label, flagSink) {
  const { text: out, changed } = guardedReplace(text, rx, replacement, flagSink, label);
  if (changed) changes.push(label);
  return out;
}

function capFirst(s = '') {
  const str = String(s || '');
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}


function addSafeSpaceAfterClosingSingleQuotes(text = '') {
  const s = String(text || '');
  let out = '';
  let insideSingleQuote = false;

  const isLetter = (ch) => /[A-Za-z]/.test(ch || '');
  const contractionSuffixAt = (idx) => {
    const tail = s.slice(idx).toLowerCase();
    const match = tail.match(/^(t|s|d|m|ll|ve|re)\b/);
    return Boolean(match);
  };

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    out += ch;

    if (ch === '‘') {
      insideSingleQuote = true;
      continue;
    }

    if (ch === '’') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';

      // Do not split actual contractions/possessives:
      // don’t, won’t, can’t, Iris’s, Cross’s, Strauss’s, Tennessee Williams’s.
      if (isLetter(prev) && isLetter(next) && contractionSuffixAt(i + 1)) {
        continue;
      }

      if (insideSingleQuote) {
        insideSingleQuote = false;
        if (isLetter(next)) out += ' ';
      } else if (/s$/i.test(prev) && isLetter(next) && !contractionSuffixAt(i + 1)) {
        // Plural possessive jam: students’eyes -> students’ eyes.
        // The contractionSuffixAt guard above prevents Iris’s/Cross’s from becoming Iris’ s/Cross’ s.
        out += ' ';
      }
    }
  }

  return out;
}



function finalPossessiveApostropheGuard(text = '') {
  // Absolute last-pass guard for export/polish survivors:
  // Iris’ s -> Iris’s, Cross’ s -> Cross’s, Strauss’ s -> Strauss’s,
  // won’ t -> won’t, I’ m -> I’m.
  //
  // This intentionally only collapses known contraction/possessive suffix
  // shards. It does NOT collapse plural possessives followed by normal words:
  // students’ eyes, workers’ choruses, sailors’ accounts.
  return String(text || '')
    .replace(/\b([A-Za-z]+)\s*[’']\s*(s|d|ll|ve|re|m|t)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`)
    .replace(/\b(I)\s*[’']\s*(m|d|ll|ve)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`);
}


function normalizeSmartApostropheSpacing(text = '', changes = []) {
  const before = String(text || '');
  let out = before;

  // Collapse apostrophes split by export/DOCX conversion:
  // didn’ t -> didn’t; Iris’ s -> Iris’s; Blue Parrot’ s -> Blue Parrot’s.
  //
  // IMPORTANT: keep this marker-limited. A broad "word ’ word" rule caused
  // damage such as workers’choruses, students’eyes, and ‘The Last Goodbye’was.
  out = out.replace(/\b([A-Za-z]+)\s*[’']\s*(s|d|ll|ve|re|m|t)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`);

  // If a plural possessive or quoted phrase has already been jammed against
  // the next word, restore the missing space without touching contractions.
  out = out.replace(/\b([A-Za-z]+s)[’'](?=([a-z]{2,}))\b/g, '$1’ ');
  out = addSafeSpaceAfterClosingSingleQuotes(out);

  // Keep readable year contractions: in’43 -> in ’43.
  out = out.replace(/\b(in|by|from|since|until|around|circa|c\.)[ \t]*[’'](\d{2})\b/gi, (_m, pre, yr) => `${pre} ’${yr}`);

  // Defensive cleanup for common contraction shards.
  out = out.replace(/\b(I)\s*[’']\s*(m|d|ll|ve)\b/gi, (_m, a, b) => `${a}’${b.toLowerCase()}`);
  out = out.replace(/\b(you|we|they|he|she|it|that|there|what|who|where|when|why|how|let)\s*[’']\s*(s|d|ll|ve|re)\b/gi, (_m, a, b) => `${a}’${b.toLowerCase()}`);
  out = finalPossessiveApostropheGuard(out);

  if (out !== before) changes.push('normalized smart apostrophe spacing');
  return out;
}

// POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS: this used to hard-rename
// "Arthur" -> "Langston" and "Cora" -> "Clara" unconditionally in every
// Fix Manuscript run (both call sites pass forceSongbirdAliases: true
// regardless of the actual project), so any OTHER book with a character
// named Arthur or Cora was silently renamed. Retired outright - not a
// general policy substitution, a book-specific string that never
// belonged in shared pipeline code.
function forceSongbirdAliases(text = '', changes = [], options = {}) {
  return String(text || '');
}


function closeOddDoubleQuoteParagraphs(text = '', changes = []) {
  // Safe quote-edge guard:
  // This does NOT rebuild dialogue clusters. It only closes paragraphs that already
  // contain an unmatched opening smart quote. It fixes survivors like:
  //   A knock ... “Five minutes, Miss Finch.
  //   “And the others?
  //   “No. “Thank you.”
  // without moving narration into dialogue.
  const before = String(text || '');
  const lines = before.split('\n');

  const repaired = lines.map((line) => {
    let out = String(line || '');

    // Specific saved survivor: “No. “Thank you.” -> “No.” “Thank you.”
    out = out.replace(/^“([^“”\n]{1,90}?[.!?])\s+“/g, '“$1” “');

    const opens = (out.match(/“/g) || []).length;
    const closes = (out.match(/”/g) || []).length;

    if (opens > closes) {
      const trimmed = out.replace(/\s+$/g, '');
      const trailing = out.slice(trimmed.length);
      if (trimmed && !trimmed.endsWith('”')) {
        out = `${trimmed}”${trailing}`;
      }
    }

    return out;
  });

  const after = repaired.join('\n');
  if (after !== before) changes.push('closed unmatched opening smart quotes safely');
  return after;
}

function repairClimaxQuoteEdgeSurvivors(text = '', changes = [], flagSink = []) {
  // Ultra-narrow survivor rescue for the remaining Songbird climax paragraph.
  // This avoids the dangerous old cluster-rebuild behavior and only restores
  // missing opening smart quotes on two known speech fragments.
  const before = String(text || '');
  let out = before;

  out = guardedReplace(
    out,
    /“Was it not\?”\s+It[’']s not about volume\.”/g,
    '“Was it not?” “It’s not about volume.”',
    flagSink, 'repaired final climax quote-edge survivor'
  ).text;

  out = guardedReplace(
    out,
    /“How do I play a silence\?”\s+You don[’']t play it\./g,
    '“How do I play a silence?” “You don’t play it.',
    flagSink, 'repaired final climax quote-edge survivor'
  ).text;

  out = out.replace(
    /fail\. The failure is the point\.”/g,
    'fail. The failure is the point.”'
  );

  if (out !== before) changes.push('repaired final climax quote-edge survivor');
  return out;
}


function thinSongbirdStyleTics(text = '', changes = []) {
  // Deterministic manuscript-level tic thinning. Kept conservative:
  // - Preserves the first few uses of core motifs.
  // - Replaces only repeated phrasing, not plot content.
  let out = String(text || '');

  const replaceAfter = (pattern, keep, replacements, label) => {
    let seen = 0;
    let idx = 0;
    const before = out;
    out = out.replace(pattern, (match) => {
      seen += 1;
      if (seen <= keep) return match;
      const repl = replacements[idx % replacements.length];
      idx += 1;
      return typeof repl === 'function' ? repl(match) : repl;
    });
    if (out !== before) changes.push(label);
  };

  replaceAfter(/\bcold knot\b/g, 2, [
    'hard pressure',
    'tightness',
    'cold weight',
    'small stone',
    'dense pressure',
  ], 'thinned repeated cold-knot tic');

  replaceAfter(/\bmouth was dry\b/g, 1, [
    'throat felt dry',
    'tongue felt thick',
    'mouth felt papery',
    'throat tightened',
  ], 'thinned repeated mouth-was-dry tic');

  replaceAfter(/\bmouth went dry\b/g, 0, [
    'throat tightened',
    'tongue felt thick',
  ], 'thinned repeated mouth-went-dry tic');

  replaceAfter(/\bA memory surfaced, (?:unbidden|irrelevant and sharp|unbidden and useless|unbidden, irrelevant)\b/gi, 1, [
    'A memory rose',
    'A memory returned',
    'A memory came back',
  ], 'thinned repeated memory-surfaced-unbidden tic');

  replaceAfter(/\bThe silence was a physical presence\b/g, 1, [
    'The silence pressed close',
    'The silence thickened around her',
  ], 'thinned repeated silence-physical-presence tic');

  replaceAfter(/\bnot quite ([^.,;:\n]{1,60}), not quite ([^.,;:\n]{1,60})/gi, 1, [
    (_m) => 'a feeling with no clean name',
    (_m) => 'something between the two',
    (_m) => 'some unnamed middle state',
  ], 'thinned repeated not-quite/not-quite construction');

  replaceAfter(/\bnot quite ([^.!?\n]{1,60})\.\s+not quite ([^.!?\n]{1,60})\./gi, 1, [
    (_m) => 'Something between the two.',
    (_m) => 'Some unnamed middle state.',
  ], 'thinned repeated not-quite sentence pair construction');

  return out;
}

export function repairManuscriptArtifacts(text, options = {}) {
  let out = normalize(text);
  const before = out;
  const changes = [];
  const flagSink = []; // LEGACYSTAGES-1: { paragraphIndex, reason } records for a match this stage refused to let cross a paragraph break

  // Normalize apostrophe spacing before other rules so contraction patterns work.
  out = normalizeSmartApostropheSpacing(out, changes);

  // v6: hard alias enforcement is here too, so the repair still works even if
  // ProjectStudio/canonNameLock metadata detection misses the manuscript.
  out = forceSongbirdAliases(out, changes, options);

  // v5/v6 survivor rescue: keep action beats outside quotes. This is deliberately
  // specific to the malformed exported shape; it does not rewrite normal dialogue.
  const rescueNames = 'He|She|he|she|Iris|Pauline|Langston|Cross|Clara|Cora|Duke|Sol|Strauss|James|Michael';
  const rescueActions = 'said it|said the words?|said the word|said it like|said it without|said it as|said the name|said the sentence|said the last word|said this|spoke|asked it';
  const rescueCluster1 = new RegExp('[“"]([^“”"\\n]{2,260}?)\\s+(' + rescueNames + ')\\s+((?:' + rescueActions + ')[^“”"\\n]{0,420}?)\\.[”"]\\s*[“"]?([^“”"\\n]{2,320})[.!?][”"]+', 'gi');
  out = guardedReplace(out, rescueCluster1, (_m, speech, who, action, next) => {
    changes.push('rescued swallowed quote/action cluster v5');
    const s = String(speech || '').trim().replace(/[,.!?;:]+$/, '');
    const a = String(action || '').trim().replace(/[,.!?;:]+$/, '');
    const n = String(next || '').trim().replace(/[,.!?;:]+$/, '');
    if (/^said it mildly\b/i.test(a)) {
      return `“${s},” ${String(who).toLowerCase()} ${a.replace(/^said it\s*/i, 'said ')}. “${n}.”`;
    }
    return `“${s}.” ${capFirst(who)} ${a}. “${n}.”`;
  }, flagSink, 'rescued swallowed quote/action cluster v5').text;

  out = guardedReplace(out, /\bA song\. Of course you did\s+(she|he)\s+said it quietly, almost to herself\./gi, (_m, who) => {
    changes.push('repaired unquoted speech/action survivor');
    return `“A song. Of course you did,” ${who.toLowerCase()} said quietly, almost to herself.`;
  }, flagSink, 'repaired unquoted speech/action survivor').text;

  // Undo the specific v5/v3 quote-swallow corruption without trying to be a full quote fixer.
  // “Speech He said it/action.”Next speech.“” -> “Speech.” He said it/action. “Next speech.”
  const swallowed = /[“"]([^“”"\n]{2,260}?)\s+(He|She|he|she)\s+(said\s+(?:it|the\s+words?|the\s+word)[^“”"\n]{0,360}?)\.[”"]\s*([^“”"\n]{2,260})\.[”"]+/gi;
  out = guardedReplace(out, swallowed, (_m, speech, who, action, next) => {
    changes.push('repaired swallowed action/dialogue cluster');
    const s = String(speech || '').trim().replace(/[,.!?;:]+$/, '');
    const n = String(next || '').trim().replace(/[,.!?;:]+$/, '');
    return `“${s}.” ${capFirst(who)} ${String(action || '').trim()}. “${n}.”`;
  }, flagSink, 'repaired swallowed action/dialogue cluster').text;

  // Apostrophe / contraction corruption.
  out = applyRule(out, /\bdidn[’']?\s+change\b/gi, 'didn’t change', changes, 'fixed didn’t apostrophe corruption');
  out = applyRule(out, /\bdoesn[’']?\s+t\b/gi, 'doesn’t', changes, 'fixed does not contraction corruption');
  out = applyRule(out, /\bdidn[’']?\s+t\b/gi, 'didn’t', changes, 'fixed did not contraction corruption');
  out = applyRule(out, /\bwasn[’']?\s+t\b/gi, 'wasn’t', changes, 'fixed was not contraction corruption');
  out = applyRule(out, /\bweren[’']?\s+t\b/gi, 'weren’t', changes, 'fixed were not contraction corruption');
  out = applyRule(out, /\bcan[’']?\s+t\b/gi, 'can’t', changes, 'fixed cannot contraction corruption');
  out = applyRule(out, /\bcouldn[’']?\s+t\b/gi, 'couldn’t', changes, 'fixed could not contraction corruption');
  out = applyRule(out, /\bwouldn[’']?\s+t\b/gi, 'wouldn’t', changes, 'fixed would not contraction corruption');
  out = applyRule(out, /\bshouldn[’']?\s+t\b/gi, 'shouldn’t', changes, 'fixed should not contraction corruption');

  // Common malformed verb-object artifacts.
  out = applyRule(out, /\b(The|A|His|Her|Their|Its|This|That|My|Our)\s+(door|doors|window|windows|eyes|eye|mouth|hand|hands|drawer|drawers|gate|gates|hatch|hatches|wall|walls)\s+opened\s+it\b/gi, '$1 $2 opened', changes, 'fixed opened-it artifact');
  out = applyRule(out, /\bopened\s+it\s+(and|but|then|as|while|onto|into|toward|to|when|with)\b/gi, 'opened $1', changes, 'fixed opened-it connector artifact');
  out = applyRule(out, /\b(the|a|his|her|their|its)\s+(door|window|eye|eyes|mouth|gate|hatch)\s+closed\s+it\b/gi, '$1 $2 closed', changes, 'fixed closed-it artifact');

  // Breath/pause/hitch corruption.
  out = applyRule(out, /\b(His|Her|Their|My|Iris’s|Iris'|Pauline’s|Pauline'|Langston’s|Langston'|Arthur’s|Arthur')\s+moment\s+(hitched|caught|stopped|paused)\b/g, '$1 breath $2', changes, 'fixed moment→breath artifact');
  out = applyRule(out, /\b(his|her|their|my)\s+moment\s+(hitched|caught|stopped|paused)\b/g, '$1 breath $2', changes, 'fixed moment→breath artifact');
  out = applyRule(out, /\b(His|Her|his|her)\s+pause\s+hitched\b/g, '$1 breath hitched', changes, 'fixed pause→breath artifact');

  // Missing conjunction/comma artifacts that do not alter quote boundaries.
  const joinRules = [
    [/\b(looked away)\s+(ran a hand over)/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(finished her tea)\s+(washed the mug)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(finished his tea)\s+(washed the mug)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(sat)\s+(took out)\b/gi, '$1, $2', 'fixed missing comma'],
    [/\b(turned away)\s+(ran)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(walked away)\s+(ran)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(looked up)\s+(caught)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(turned)\s+(looked)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(took a breath)\s+(held it)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(appeared at her side)\s+(took half)\b/gi, '$1 and took half', 'fixed missing conjunction'],
    [/\b(moved off)\s+(issuing)\b/gi, '$1, $2', 'fixed missing comma'],
    [/\b(opened a drawer)\s+(took out)\b/gi, '$1 and $2', 'fixed missing conjunction'],
    [/\b(walked to her desk)\s+(a heavy oak thing)\b/gi, '$1, $2', 'fixed appositive comma'],
    [/\b(turned from the window)\s+(the afternoon light)\b/gi, '$1. The afternoon light', 'fixed sentence join'],
    [/\b(a cold, dense clarity)\s+(It wasn’t courage)\b/gi, '$1. $2', 'fixed sentence join'],
    [/\b(the coffee|the tea|the drink|the letter|the report),?\s+when it came\s+was\b/gi, '$1, when it came, was', 'fixed when-it-came comma'],
  ];
  for (const [rx, repl, label] of joinRules) out = applyRule(out, rx, repl, changes, label);

  // Safe attribution punctuation: add comma after said/asked when followed by participle/adverb phrase.
  out = applyRule(out, /\b(he|she|they|Iris|Pauline|Langston|Arthur|Cross|Clara|Cora|Duke|Sol)\s+said\s+(cutting|turning|looking|leaning|watching|without|quietly now|softly now|settling|low)\b/gi, '$1 said, $2', changes, 'fixed said attribution comma');
  out = applyRule(out, /\b(he|she|they|Iris|Pauline|Langston|Arthur|Cross|Clara|Cora|Duke|Sol)\s+asked\s+(cutting|turning|looking|leaning|watching|without|quietly now|softly now|settling|low)\b/gi, '$1 asked, $2', changes, 'fixed asked attribution comma');

  // Action sentence after dialogue should be capitalized; do NOT move quote marks.
  out = guardedReplace(out, /([.!?][”"])\s+(he|she)\s+(said\s+(?:it|the\s+word|the\s+words)|spoke\b)/g, (_m, close, who, phrase) => {
    changes.push('capitalized action sentence after dialogue');
    return `${close} ${capFirst(who)} ${phrase}`;
  }, flagSink, 'capitalized action sentence after dialogue').text;

  // Em dash speech/action fragments.
  out = applyRuleParagraphSafe(out, /\b(She|He|Iris|Pauline|Langston|Cross|Clara|Cora)\s+spoke\s+—\s+low\b/g, '$1 spoke low', changes, 'fixed spoke-em-dash fragment', flagSink);
  out = applyRuleParagraphSafe(out, /\b(She|He|Iris|Pauline|Langston|Cross|Clara|Cora)\s+spoke\s+—\s+([^\n.]+)\./g, '$1 spoke, $2.', changes, 'fixed spoke-em-dash fragment', flagSink);
  out = applyRuleParagraphSafe(out, /\bWhen\s+she\s+spoke,\s+She\s+spoke\b/g, 'When she spoke, she spoke', changes, 'fixed duplicated spoke fragment', flagSink);

  // Small grammar shards observed in Songbird exports.
  out = applyRule(out, /\bThe\s+dust\s+motes\s+swirling\b/g, 'The dust motes swirled', changes, 'fixed dangling dust-motes clause');
  out = applyRule(out, /\bthe\s+sound\s+flat\b/g, 'the sound was flat', changes, 'fixed missing verb');
  out = applyRule(out, /\b(She|He|Iris|Pauline|Langston|Cross|Clara|Cora)\s+spoke\s+low,\s+almost\s+meditative\b/g, '$1 spoke in a low, almost meditative voice', changes, 'fixed spoke-low phrase');

  // v6: surviving Songbird-specific malformed sentence shards.
  out = applyRule(out, /“It was\.\s+Preparation\.”/g, '“Preparation.”', changes, 'fixed It was. Preparation dialogue shard');
  out = applyRule(out, /\b(Langston|Arthur)(['’])s\.\s+Arrangement\b/g, '$1$2 arrangement', changes, 'fixed possessive arrangement sentence shard');
  out = applyRule(out, /\b(The|A|His|Her|Their|Its|This|That|My|Our)\s+(window|door|gate|drawer|eye|eyes|mouth|hand|hands)\s+opened\s+it\b/gi, '$1 $2 opened', changes, 'fixed opened-it survivor artifact');
  out = applyRule(out, /([.!?]”)\s+(Thank you|Thanks|I doubt that|I[’']m not uncomfortable|Aren[’']t you|Whatever is helpful|Of course|Good|Fine|No|Yes)([.!?])”/g, '$1 “$2$3”', changes, 'fixed embedded orphan dialogue opener');



  // v7: precise survivor rules from latest Songbird export.
  out = applyRule(out, /“Thank youThank you”/g, '“Thank you.”', changes, 'fixed duplicated Thank you dialogue');
  out = applyRule(out, /“I doubt thatI doubt that”/g, '“I doubt that.”', changes, 'fixed duplicated I doubt that dialogue');
  out = applyRule(out, /“Aren[’']t youAren[’']t you”/g, '“Aren’t you.”', changes, 'fixed duplicated Aren’t you dialogue');
  out = applyRule(out, /“I[’']m not uncomfortableI[’']m not uncomfortable”/g, '“I’m not uncomfortable.”', changes, 'fixed duplicated I’m-not-uncomfortable dialogue');

  // Fix only impossible opened-it artifacts, not valid "She opened it" usages.
  out = applyRule(out, /\b(the|a|his|her|their|its|this|that|my|our)\s+(door|window|gate|drawer|eye|eyes|mouth|hatch)\s+opened\s+it\b/gi, '$1 $2 opened', changes, 'fixed impossible opened-it subject artifact');
  out = applyRule(out, /\b(The|A|His|Her|Their|Its|This|That|My|Our)\s+(door|window|gate|drawer|eye|eyes|mouth|hatch)\s+opened\s+it\b/g, '$1 $2 opened', changes, 'fixed impossible opened-it subject artifact');
  out = applyRule(out, /\bbeing\s+opened\s+it\b/gi, 'being opened', changes, 'fixed being-opened-it artifact');

  // Dialogue tag punctuation survivors.
  out = applyRuleParagraphSafe(out, /“Now, Iris\.”\s+He said it mildly, chiding\./g, '“Now, Iris,” he said mildly, chiding.', changes, 'fixed Now-Iris tag punctuation', flagSink);
  out = applyRule(out, /\b(The clock, as they say)\s+is ticking\b/g, '$1, is ticking', changes, 'fixed as-they-say comma');

  // v8 extra mechanical survivors from Songbird exports. Kept narrow and deterministic.
  out = applyRule(out, /\bThe coffee, when it came was\b/g, 'The coffee, when it came, was', changes, 'comma: coffee came');
  out = applyRule(out, /\bShe sat took out\b/g, 'She sat, took out', changes, 'comma: sat took');
  out = applyRule(out, /\bPauline opened a drawer took out\b/g, 'Pauline opened a drawer, took out', changes, 'comma: drawer took');
  out = applyRule(out, /\b([Hh]e|[Ss]he) said cutting through\b/g, '$1 said, cutting through', changes, 'comma: said cutting through');
  out = applyRule(out, /\bthe door opened it\.\s*$/gm, 'the door opened.', changes, 'door opened it line');
  out = applyRule(out, /\bThe door opened it\.\s*$/gm, 'The door opened.', changes, 'The door opened it line');
  out = applyRule(out, /\bwho smelled always of hair tonic and nervous sweat played\b/g, 'who always smelled of hair tonic and nervous sweat, played', changes, 'Marty comma/order repair');
  out = applyRule(out, /\bHe nodded took a beat\b/g, 'He nodded, took a beat', changes, 'missing comma: nodded took');
  out = applyRule(out, /\bzips the duffel doesn’t look at her\b/g, 'zips the duffel, doesn’t look at her', changes, 'missing comma: duffel action');
  out = applyRule(out, /\bif the window opened it\b/g, 'if the window opened', changes, 'window opened it');
  out = applyRule(out, /\bif the door opened it\b/g, 'if the door opened', changes, 'door opened it');
  out = applyRule(out, /\bsealed jar being opened it\b/g, 'sealed jar being opened', changes, 'jar being opened it');
  out = applyRule(out, /\bIt was\. Preparation\./g, 'It was preparation.', changes, 'It was. Preparation');
  out = applyRule(out, /\bThank youThank you\b/g, 'Thank you.', changes, 'duplicate Thank you');
  out = applyRule(out, /\bI doubt thatI doubt that\b/g, 'I doubt that.', changes, 'duplicate I doubt that');

  // Final stubborn embedded opener survivors. Keep this narrow: these were saved
  // with a missing opening quote, and export quote repair is intentionally off.
  out = applyRule(out, /(^|\s)I[’']m not uncomfortable,”/g, '$1“I’m not uncomfortable,”', changes, 'restored missing opener: I’m not uncomfortable');
  out = applyRule(out, /(^|\s)Aren[’']t you\.”/g, '$1“Aren’t you?”', changes, 'restored missing opener: Aren’t you');
  out = applyRule(out, /(^|\s)Thank you\.”/g, '$1“Thank you.”', changes, 'restored missing opener: Thank you');
  out = applyRule(out, /(^|\s)I doubt that\.”/g, '$1“I doubt that.”', changes, 'restored missing opener: I doubt that');



  // v18: manual-quality line-edit survivors from clean Songbird exports.
  // Keep these narrow and deterministic; do not reconstruct dialogue or rewrite prose broadly.
  out = applyRule(out, /\bLillian Hellman is a clever woman\. She builds a box onstage puts\b/g, 'Lillian Hellman is a clever woman. She builds a box onstage, puts', changes, 'manual line edit: Hellman onstage comma');
  out = applyRule(out, /\bTennessee Williams’s the Glass Menagerie\b/g, 'Tennessee Williams’s The Glass Menagerie', changes, 'manual line edit: capitalize Glass Menagerie title');
  out = applyRule(out, /\bThe current production in rehearsal appears to be a domestic drama\b/g, 'The current production appears to be a domestic drama', changes, 'manual line edit: report wording');
  out = applyRule(out, /\bthe head of the theatre department, a Miss Pauline Carter was\b/g, 'the head of the theatre department, Miss Pauline Carter, was', changes, 'manual line edit: Pauline Carter appositive');
  out = applyRule(out, /\bThe director, Mr\. Henderson is\b/g, 'The director, Mr. Henderson, is', changes, 'manual line edit: Henderson appositive comma');
  out = applyRule(out, /\bsunlight, thick and golden with dust fell\b/g, 'sunlight, thick and golden with dust, fell', changes, 'manual line edit: dust comma');
  out = applyRule(out, /\bshe took a breath held it\b/gi, 'she took a breath, held it', changes, 'manual line edit: breath comma');
  out = applyRule(out, /\bShe took another drag held the smoke\b/g, 'She took another drag, held the smoke', changes, 'manual line edit: drag comma');
  out = applyRule(out, /\bThe smell of fresh bread, usually a comfort turned\b/g, 'The smell of fresh bread, usually a comfort, turned', changes, 'manual line edit: comfort comma');
  out = applyRule(out, /\bthe other play, the one in her bag seemed\b/g, 'the other play, the one in her bag, seemed', changes, 'manual line edit: bag comma');
  out = applyRule(out, /\bwith a sudden, somatic certainty would not hold\b/g, 'with a sudden, somatic certainty, would not hold', changes, 'manual line edit: certainty comma');
  out = applyRule(out, /\bolder than she’d seemed in the shadow maybe mid-thirties\b/g, 'older than she’d seemed in the shadow, maybe mid-thirties', changes, 'manual line edit: shadow comma');
  out = applyRule(out, /\bthe man, Davies turned to leave\b/g, 'the man, Davies, turned to leave', changes, 'manual line edit: Davies appositive comma');
  out = applyRule(out, /\bthe theatre is the Ethel Barrymore\b/g, 'the theatre is the Ethel Barrymore Theatre', changes, 'manual line edit: theatre name');

  // v19: last narrow mechanical survivors from Songbird 17.
  out = applyRule(out, /\bsunlight, thick and golden with dust fell\b/gi, 'sunlight, thick and golden with dust, fell', changes, 'manual line edit v19: dust comma any case');
  out = applyRule(out, /\bthe smell of fresh bread, usually a comfort turned\b/gi, 'the smell of fresh bread, usually a comfort, turned', changes, 'manual line edit v19: comfort comma any case');
  out = applyRule(out, /\bforced a breath in held it\b/gi, 'forced a breath in, held it', changes, 'manual line edit v19: breath-in comma');
  out = applyRule(out, /\btook another drag held the smoke\b/gi, 'took another drag, held the smoke', changes, 'manual line edit v19: drag comma any case');
  out = applyRule(out, /\beyes, in this light were\b/gi, 'eyes, in this light, were', changes, 'manual line edit v19: in-this-light comma');
  out = applyRule(out, /\bActor’s Studio crowd—They felt\b/g, 'Actor’s Studio crowd—they felt', changes, 'manual line edit v19: lower em-dash continuation');
  out = applyRule(out, /\bThe Children’s Hour\. Yes\.\s+”\s*“And\?\s*”\s*“It’s… a well-made play\./g, 'The Children’s Hour. Yes.”\n“And?”\n“It’s… a well-made play.', changes, 'manual line edit v19: restore And? dialogue line');
  out = applyRule(out, /\bThe Children’s Hour\. Yes\. ” “And\? ” “It’s… a well-made play\./g, 'The Children’s Hour. Yes.”\n“And?”\n“It’s… a well-made play.', changes, 'manual line edit v19: restore And? dialogue line compact');
  out = applyRule(out, /\bthe man, Davies turned to leave\b/gi, 'the man, Davies, turned to leave', changes, 'manual line edit v19: Davies appositive any case');


  // Safe quote-edge guard after local repairs. It only closes unmatched openings.
  out = repairClimaxQuoteEdgeSurvivors(out, changes, flagSink);
  out = closeOddDoubleQuoteParagraphs(out, changes);

  // Conservative tic thinning for polish/export artifact cleanup.
  out = thinSongbirdStyleTics(out, changes);

  // Final apostrophe normalization after other repairs.
  out = normalizeSmartApostropheSpacing(out, changes);

  // Tidy spacing left by repairs/removals. The first three sub-steps below only
  // ever touch horizontal ([ \t]) whitespace immediately beside a newline, or
  // collapse extra ([.!?])([A-Z])/\n{4,} runs down to a still-real paragraph
  // break — none of them can reduce a \n{2,} boundary to nothing, so they stay
  // a plain chained .replace(). The three LEGACYSTAGES-1-guarded steps use \s+/
  // \s*, which — unlike the others — CAN match straight through a \n{2,}
  // boundary and erase it; pulled out of the chain so each gets the same
  // paragraph-break protection as every other risky rule above.
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n');
  out = applyRuleParagraphSafe(out, /\s+([,.!?;:])/g, '$1', changes, 'tidied spacing before punctuation', flagSink);
  out = applyRuleParagraphSafe(out, /([,]”)\s*(he|she)\b/g, '$1 $2', changes, 'tidied spacing: comma-quote then pronoun', flagSink);
  out = applyRuleParagraphSafe(out, /([.!?]”)\s*(He|She|Iris|Pauline|Langston|Cross|Clara|Duke|Sol)\b/g, '$1 $2', changes, 'tidied spacing: terminal-quote then capitalized continuation', flagSink);
  out = out
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  const guardedOut = finalPossessiveApostropheGuard(out);
  if (guardedOut !== out) {
    changes.push('final possessive apostrophe guard');
    out = guardedOut;
  }

  return {
    text: out,
    changed: out !== before,
    changes: [...new Set(changes)],
    count: changes.length,
    flaggedDeletions: flagSink,
  };
}

export function repairLoadedManuscriptArtifacts(loaded = [], options = {}) {
  let artifactsFixed = 0;
  const changes = [];
  const flags = [];
  for (const f of loaded) {
    const before = f.content || '';
    const result = repairManuscriptArtifacts(before, { ...options, chapter: f.chapter });
    if (result.changed) {
      f.content = result.text;
      artifactsFixed += result.count || 1;
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: artifact repair v19 final narrow mechanical guard mode (${result.changes.join(', ')})`);
    }
    // LEGACYSTAGES-1: a flag can fire even on a chapter where nothing else
    // changed (the guard's whole point is to refuse the merge, not to make it
    // conditional on some OTHER edit also happening), so this is not gated by
    // result.changed above.
    for (const fd of result.flaggedDeletions || []) {
      flags.push({ chapter: f.chapter?.chapter_number || '?', paragraphIndex: fd.paragraphIndex, reason: fd.reason });
    }
  }
  if (artifactsFixed) changes.push(`Total deterministic artifact repairs v19: ${artifactsFixed}`);
  return { artifactsFixed, changes, flags };
}

export default {
  repairManuscriptArtifacts,
  repairLoadedManuscriptArtifacts,
};
