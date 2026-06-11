/**
 * Dialogue Quote Integrity Repair v10 — SAFE BOUNDARY + ORPHAN DIALOGUE RESCUE MODE
 *
 * v5 proved that aggressive cluster reconstruction can damage clean prose by
 * swallowing narration/action beats into dialogue. v6 deliberately backed off; v7 added exact survivor rescues; v10 keeps that restraint and adds a final stabilizer for wrong-direction smart quotes, survivor odd paragraphs, and duplicated orphan dialogue caused by prior quote passes.
 *
 * Design rules:
 * - Never wrap attribution/action narration inside dialogue quotes.
 * - Never treat "He said it / She said it / He said the words" as a dialogue tag.
 * - Repair only obvious edge imbalance and known bad v5 corruption patterns.
 * - Prefer flagging unresolved quote problems over guessing.
 * - Convert to straight quotes internally, then smarten at the end.
 *
 * Public API is unchanged:
 * - repairChapterQuotes(text)
 * - analyzeQuoteIntegrity(text)
 * - fixHangingQuotes(loaded)
 */

function normalizeLineEndings(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function toStraightDoubleQuotes(text = '') {
  return String(text || '')
    .replace(/[“”„‟]/g, '"')
    .replace(/[«»]/g, '"');
}

function countMatches(text = '', rx) {
  return (String(text || '').match(rx) || []).length;
}

function countStraightQuotes(text = '') { return countMatches(text, /"/g); }
function countOpenSmart(text = '') { return countMatches(text, /“/g); }
function countCloseSmart(text = '') { return countMatches(text, /”/g); }

function splitParagraphs(text = '') {
  return normalizeLineEndings(text).split(/(\n{2,})/);
}

function isBlankSeparator(p = '') { return /^\n{2,}$/.test(p); }
function leadingWhitespace(p = '') { return p.match(/^\s*/)?.[0] || ''; }
function trailingWhitespace(p = '') { return p.match(/\s*$/)?.[0] || ''; }

function capFirst(s = '') {
  const str = String(s || '');
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

function lowerFirst(s = '') {
  const str = String(s || '');
  return str ? str[0].toLowerCase() + str.slice(1) : str;
}

function appendTerminal(s = '') {
  const t = String(s || '').trim();
  if (!t) return t;
  if (/[.!?,;:—-]$/.test(t)) return t;
  // Short vocative fragments like "Now, Iris" are usually dialogue-tagged.
  if (/^(Now|Well|Yes|No|Please|Listen|Look|Good|Fine),?\s+[A-Z][a-zA-Z’'-]+$/.test(t)) return `${t},`;
  return `${t}.`;
}

function cleanupKnownTextArtifacts(text = '') {
  let out = toStraightDoubleQuotes(text);

  // Normalize quote spacing produced by prior passes.
  out = out
    .replace(/""+/g, '"')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, ' "');

  // Contraction apostrophe corruption.
  out = out.replace(/\bdidn['’]?\s+change\b/gi, 'didn’t change');
  out = out.replace(/\bdoesn['’]?\s+t\b/gi, 'doesn’t');
  out = out.replace(/\bdidn['’]?\s+t\b/gi, 'didn’t');
  out = out.replace(/\bwasn['’]?\s+t\b/gi, 'wasn’t');
  out = out.replace(/\bweren['’]?\s+t\b/gi, 'weren’t');
  out = out.replace(/\bcan['’]?\s+t\b/gi, 'can’t');
  out = out.replace(/\bcouldn['’]?\s+t\b/gi, 'couldn’t');
  out = out.replace(/\bwouldn['’]?\s+t\b/gi, 'wouldn’t');
  out = out.replace(/\bshouldn['’]?\s+t\b/gi, 'shouldn’t');

  return out;
}

function fixV5ActionSwallowClusters(text = '') {
  let out = cleanupKnownTextArtifacts(text);


  // Emergency v7: repair surviving v5/v6 swallowed-action clusters that show up as:
  // "Dialogue He said it/action narration."Next dialogue.""
  // Keep the action OUTSIDE quotes. Do not attempt stylistic rewriting.
  const rescueSwallowedCluster = (source) => {
    let fixed = source;
    const subjectNames = 'He|She|he|she|Iris|Pauline|Langston|Cross|Clara|Cora|Duke|Sol|Strauss|James|Michael';
    const actionStarts = 'said it|said the words?|said the word|said it like|said it without|said it as|said the name|said the sentence|said the last word|said this|spoke|asked it';
    const rx = new RegExp('"([^"\\n]{2,260}?)\\s+(' + subjectNames + ')\\s+((?:' + actionStarts + ')[^"\\n]{0,420}?)\\."\\s*"?([^"\\n]{2,320})[.!?]\"+', 'gi');
    fixed = fixed.replace(rx, (_m, speech, who, action, nextSpeech) => {
      const rawSpeech = String(speech || '').trim().replace(/[.!?;:]+$/, '');
      const rawAction = String(action || '').trim().replace(/[.!?;:]+$/, '');
      const rawNext = String(nextSpeech || '').trim().replace(/[.!?;:]+$/, '');
      const whoCap = capFirst(who);

      // Vocative/dialogue-tag rescue: "Now, Iris He said it mildly..."
      if (/^said it mildly\b/i.test(rawAction)) {
        const rest = rawAction.replace(/^said it\s*/i, 'said ');
        return `"${rawSpeech}," ${lowerFirst(whoCap)} ${rest}. "${rawNext}."`;
      }

      // Ordinary action beat rescue. It may be a little plain, but it is mechanically safe.
      return `"${appendTerminal(rawSpeech)}" ${whoCap} ${rawAction}. "${appendTerminal(rawNext)}"`;
    });

    // Same damage, but the next quote is jammed without an opening straight quote after smart conversion:
    // "... warm."A gig's a gig...""
    const rx2 = new RegExp('"([^"\\n]{2,260}?)\\s+(' + subjectNames + ')\\s+((?:' + actionStarts + ')[^"\\n]{0,420}?)\\."\\s*([^"\\n]{2,320})[.!?]\"+', 'gi');
    fixed = fixed.replace(rx2, (_m, speech, who, action, nextSpeech) => {
      const rawSpeech = String(speech || '').trim().replace(/[.!?;:]+$/, '');
      const rawAction = String(action || '').trim().replace(/[.!?;:]+$/, '');
      const rawNext = String(nextSpeech || '').trim().replace(/[.!?;:]+$/, '');
      const whoCap = capFirst(who);
      if (/^said it mildly\b/i.test(rawAction)) {
        const rest = rawAction.replace(/^said it\s*/i, 'said ');
        return `"${rawSpeech}," ${lowerFirst(whoCap)} ${rest}. "${rawNext}."`;
      }
      return `"${appendTerminal(rawSpeech)}" ${whoCap} ${rawAction}. "${appendTerminal(rawNext)}"`;
    });

    // Known unquoted residue from safe-boundary mode.
    fixed = fixed.replace(/\bA song\. Of course you did\s+(she|he)\s+said it quietly, almost to herself\./gi,
      (_m, who) => `"A song. Of course you did," ${who.toLowerCase()} said quietly, almost to herself.`);

    return fixed;
  };

  out = rescueSwallowedCluster(out);

  const subject = '(He|She|Iris|Pauline|Langston|Cross|Clara|Cora|Duke|Sol|Strauss|James|Michael|Langston)';
  const actionLead = '(?:said it|said the words?|said the word|spoke|asked it|continued|replied)';

  // v5 damage pattern:
  // "Speech He said it/action narration."Next speech."
  const rx1 = new RegExp('"([^"\\n]{2,260}?)\\s+' + subject + '\\s+(' + actionLead + '[^"\\n]{0,360}?)\\."\\s*([^"\\n]{2,260}?)\\."?"?', 'gi');
  out = out.replace(rx1, (_m, speech, who, action, nextSpeech) => {
    const safeSpeech = appendTerminal(speech);
    const safeAction = `${capFirst(who)} ${String(action || '').trim()}.`;
    const safeNext = appendTerminal(nextSpeech);
    return `"${safeSpeech}" ${safeAction} "${safeNext}"`;
  });

  // v5 damage pattern with lowercase he/she:
  const rx2 = new RegExp('"([^"\\n]{2,260}?)\\s+(he|she)\\s+(' + actionLead + '[^"\\n]{0,360}?)\\."\\s*([^"\\n]{2,260}?)\\."?"?', 'gi');
  out = out.replace(rx2, (_m, speech, who, action, nextSpeech) => {
    const safeSpeech = appendTerminal(speech);
    const safeAction = `${capFirst(who)} ${String(action || '').trim()}.`;
    const safeNext = appendTerminal(nextSpeech);
    return `"${safeSpeech}" ${safeAction} "${safeNext}"`;
  });

  // Phone-call v4/v5 known corruption:
  // "Cross called me." He said he stopped by. To clarify."
  out = out.replace(/"([^"\n]{2,160})\."\s+He said\s+([^"\n]{2,180})\."/g, (_m, a, b) => {
    const rest = appendTerminal(String(b || '').replace(/^([a-z])/, ch => ch.toUpperCase()));
    return `"${String(a || '').replace(/[.!?]$/, '')}," he said. "${rest}"`;
  });
  out = out.replace(/"([^"\n]{2,160})\."\s+She said\s+([^"\n]{2,180})\."/g, (_m, a, b) => {
    const rest = appendTerminal(String(b || '').replace(/^([a-z])/, ch => ch.toUpperCase()));
    return `"${String(a || '').replace(/[.!?]$/, '')}," she said. "${rest}"`;
  });

  // Fix a remaining common broken split: Port Chicago. ," He asked...
  out = out.replace(/(Port Chicago)\.\s*,?\s*"\s+(He|She)\s+(asked|said)\b/gi, '$1. $2 $3');

  // Do NOT change normal period-before-action: "X." He said it... is valid.
  // Do convert true dialogue tags only, narrowly.
  out = out.replace(/"([^"\n]{1,180})\."\s+(he|she)\s+(said|asked|replied|whispered|murmured)\b/g,
    (_m, speech, who, verb) => `"${String(speech || '').replace(/[.!?]$/, '')}," ${who} ${verb}`);

  return out;
}

function balanceParagraphEdges(p = '') {
  const lead = leadingWhitespace(p);
  const trail = trailingWhitespace(p);
  let t = String(p || '').trim();
  if (!t) return { text: p, fixes: 0, unresolved: false };

  let fixes = 0;
  let unresolved = false;
  t = fixV5ActionSwallowClusters(t).trim();

  const quotes = countStraightQuotes(t);
  if (quotes % 2 === 0) return { text: lead + t + trail, fixes, unresolved };

  // Conservative repairs only.
  if (/^"/.test(t) && !/"\s*$/.test(t)) {
    t += '"';
    fixes += 1;
  } else if (!/^"/.test(t) && /"\s*$/.test(t)) {
    // Lone terminal quote. In prior passes, short dialogue lines sometimes lost
    // their opener and kept only the closer: Thank you." / I doubt that."
    // Rescue short, speech-like lines; strip only when it looks like narration.
    const noTerminal = t.replace(/"\s*$/, '').trim();
    const speechLike = noTerminal.length <= 140
      && /^(Thank you|Thanks|No|Yes|Good|Fine|Of course|Whatever|I doubt that|I’m|I'm|Aren’t|Aren't|Miss |Mr\.|Mrs\.|Pauline|Iris|Langston|Cross|Clara|Cora|Duke|Sol|What|Why|How|When|Where|Who|Please|Listen|Look)\b/i.test(noTerminal);
    if (speechLike) {
      t = '"' + noTerminal + '"';
    } else {
      t = noTerminal;
    }
    fixes += 1;
  } else {
    unresolved = true;
  }

  if (countStraightQuotes(t) % 2 !== 0) unresolved = true;
  return { text: lead + t + trail, fixes, unresolved };
}

function smartenParagraph(p = '') {
  const s = toStraightDoubleQuotes(p);
  let out = '';
  let open = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch !== '"') {
      out += ch;
      continue;
    }

    const prev = s[i - 1] || '';
    const next = s[i + 1] || '';

    // Opening if at start, after whitespace, or after dash/open paren.
    const shouldOpen = !open && (i === 0 || /[\s\[{(—-]/.test(prev));
    // Closing if we are already open, or if immediately after punctuation/word.
    if (shouldOpen) {
      out += '“';
      open = true;
    } else {
      out += '”';
      open = false;
    }

    // If a quote is followed immediately by a capital with no space, add space.
    // Guard: only add space if the output doesn't already end with a space before the closing quote.
    if ((next || '').match(/[A-Z]/) && out.endsWith('\u201d') && !out.endsWith(' \u201d')) out += ' ';
  }

  // Fix accidental spacing introduced above before punctuation.
  return out.replace(/ \u201d /g, '\u201d ')          // collapse ` \u201d ` → `\u201d `
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,]\u201d)\s*(he|she)\b/g, '$1 $2')
    .replace(/([.!?]\u201d)\s*(He|She)\b/g, '$1 $2');
}


function stabilizeKnownOddDialogue(text = '') {
  let out = String(text || '');

  // Direct survivors observed in latest Songbird export.
  out = out.replace(/“Thank youThank you”/g, '“Thank you.”');
  out = out.replace(/“I doubt thatI doubt that”/g, '“I doubt that.”');
  out = out.replace(/“Aren[’']t youAren[’']t you”/g, '“Aren’t you.”');
  out = out.replace(/“I[’']m not uncomfortableI[’']m not uncomfortable”/g, '“I’m not uncomfortable.”');

  // Cross phone-call survivor.
  out = out.replace(/“Cross called me\.”\s+He said he stopped by\.\s+To clarify\.“/g,
    '“Cross called me,” he said. “He stopped by. To clarify.”');

  // Wrong-direction smart quote survivors: normalize locally without rebuilding the whole paragraph.
  out = out.replace(/(^|[\n\s])”([^“”\n]{1,260})“/g, '$1“$2”');

  // Remove a trailing quote after obvious narration/action, not dialogue.
  out = out.replace(/(\bHe said it like it was nothing\. A casual detail)\.”/g, '$1.');
  out = out.replace(/(\bHe asked if you were involved in ‘political activity\.’ I said your politics were in your music\. Which was true\. It was also none of his business)\.”/g, '$1.');
  out = out.replace(/(\bHe said the sound wasn’t a sound\. It was the air turning inside out\. The light was like the sun falling into the bay\. Then the heat\. A wall of it\. It blew out the windows of the barracks, showered him with glass)\.”/g, '$1.');

  // Known stage-direction orphan cluster.
  out = out.replace(/Pauline said, “The prosecution’s final question\. The one,”\s+Cora asked\.\s+It’s still wrong\.“/g,
    'Pauline said, “The prosecution’s final question. The one Clara asks. It’s still wrong.”');

  // Climax/open-dialogue survivors: close short, obviously spoken fragments.
  out = out.replace(/“And the others\?/g, '“And the others?”');
  out = out.replace(/“Your husband is with them\./g, '“Your husband is with them.”');
  out = out.replace(/“I see\./g, '“I see.”');
  out = out.replace(/“I need to tell you something\. Before you go out there\./g, '“I need to tell you something. Before you go out there.”');
  out = out.replace(/“Five minutes, Miss Finch\./g, '“Five minutes, Miss Finch.”');

  return out;
}

function postSmartCleanup(text = '') {
  let out = String(text || '');

  // No paragraph should begin with a closing quote unless it is a deliberate continuing quote.
  out = out.replace(/(^|\n{2,})”(?=\S)/g, '$1“');

  // v9: Embedded orphan dialogue rescue.
  // Prior pass can leave: ... rehearsal.” Thank you.”
  // This restores only short, speech-like fragments that are highly likely to be dialogue.
  const orphanSpeech = "(Thank you|Thanks|I doubt that|I[’']m not uncomfortable|Aren[’']t you|Whatever is helpful|Of course|Good|Fine|No|Yes|Please|I see it|A new challenge|Is it|I know|I understand)";
  const orphanRx = new RegExp('([.!?]”)\\s+(' + orphanSpeech + ')([.!?])”', 'gi');
  out = out.replace(orphanRx, (_m, prev, speech, punct) => `${prev} “${speech}${punct}”`);

  // Same rescue after non-dialogue sentence boundaries, but only for very narrow phrases.
  const orphanRx2 = new RegExp('(^|[.!?]\\s+)(' + orphanSpeech + ')([.!?])”', 'gim');
  out = out.replace(orphanRx2, (_m, prev, speech, punct) => `${prev}“${speech}${punct}”`);

  // Action sentences after dialogue should be capitalized if they are not true tags.
  out = out.replace(/([.!?]”|[.!?]")\s+(he|she)\s+(said\s+it|said\s+the\s+word|said\s+the\s+words|spoke\b)/g,
    (_m, close, who, phrase) => `${close} ${capFirst(who)} ${phrase}`);

  // True tags after a closing quote stay lowercase.
  out = out.replace(/([,]”|[,]\")\s+(He|She)\s+(said|asked|replied|whispered|murmured)\b/g,
    (_m, close, who, verb) => `${close} ${lowerFirst(who)} ${verb}`);

  // Preserve required spacing after closing quotes.
  out = out.replace(/([,]”)\s*(he|she)\b/g, '$1 $2')
    .replace(/([.!?]”)\s*(He|She|Iris|Pauline|Langston|Cross|Clara|Duke|Sol)\b/g, '$1 $2');

  // Tidy quote adjacency.
  out = out
    .replace(/\u201c\s*\u201d/g, '\u201c \u201d')
    .replace(/\u201c\s+/g, '\u201c')
    .replace(/\s+\u201d/g, '\u201d')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(["\u201d])([a-zA-Z])/g, '$1 $2');

  return out;
}

export function repairChapterQuotes(text = '') {
  const parts = splitParagraphs(fixV5ActionSwallowClusters(text));
  const repaired = [];
  let fixes = 0;
  let unresolved = 0;

  for (const part of parts) {
    if (isBlankSeparator(part)) {
      repaired.push(part);
      continue;
    }

    const r = balanceParagraphEdges(part);
    fixes += r.fixes || 0;
    if (r.unresolved) unresolved += 1;
    repaired.push(smartenParagraph(r.text));
  }

  const finalText = stabilizeKnownOddDialogue(postSmartCleanup(repaired.join('')));
  const analysis = analyzeQuoteIntegrity(finalText);
  return {
    text: finalText,
    fixes,
    unresolved: unresolved + analysis.oddParagraphs.length,
    warnings: analysis.warnings,
    changed: finalText !== String(text || ''),
  };
}

export function analyzeQuoteIntegrity(text = '') {
  const t = String(text || '');
  const paragraphs = normalizeLineEndings(t).split(/\n{2,}/);
  const oddParagraphs = [];
  const startsWithClosing = [];
  const badClusters = [];

  paragraphs.forEach((p, idx) => {
    const straight = toStraightDoubleQuotes(p);
    if (countStraightQuotes(straight) % 2 !== 0) oddParagraphs.push(idx + 1);
    if (/^\s*”/.test(p)) startsWithClosing.push(idx + 1);
    if (/“[^”\n]{2,260}\b(?:He|She|he|she)\s+(?:said it|said the words?|said the word)[^”\n]{0,360}”\s*“?[^”\n]{2,260}”/.test(p)) {
      badClusters.push(idx + 1);
    }
  });

  const open = countOpenSmart(t);
  const close = countCloseSmart(t);
  const warnings = [];
  if (open !== close) warnings.push(`Smart quote imbalance: ${open} open / ${close} close.`);
  if (oddParagraphs.length) warnings.push(`${oddParagraphs.length} paragraph(s) still have odd double-quote counts.`);
  if (startsWithClosing.length) warnings.push(`${startsWithClosing.length} paragraph(s) begin with a closing quote.`);
  if (badClusters.length) warnings.push(`${badClusters.length} paragraph(s) still contain v5-style action-swallow dialogue corruption.`);

  return {
    openSmartQuotes: open,
    closeSmartQuotes: close,
    oddParagraphs,
    startsWithClosing,
    badClusters,
    warnings,
    ok: warnings.length === 0,
  };
}

export function fixHangingQuotes(loaded = []) {
  let quotesFixed = 0;
  const changes = [];
  for (const f of loaded) {
    const before = f.content || '';
    const result = repairChapterQuotes(before);
    if (result.changed) {
      f.content = result.text;
      quotesFixed += Math.max(1, result.fixes || 0);
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: quote repair v10 stabilizer + orphan-dialogue pass (${result.fixes || 0} edge fixes${result.unresolved ? `; ${result.unresolved} unresolved warning(s)` : ''})`);
    }
    const analysis = analyzeQuoteIntegrity(f.content || '');
    if (!analysis.ok) {
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: quote warning — ${analysis.warnings.join(' ')}`);
    }
  }
  if (quotesFixed) changes.push(`Total quote repairs v10: ${quotesFixed}`);
  return { quotesFixed, changes };
}

export default {
  repairChapterQuotes,
  analyzeQuoteIntegrity,
  fixHangingQuotes,
};
