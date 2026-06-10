/**
 * Capitalization and name-fragment hygiene polish.
 *
 * Catches mechanical artifacts that LLMs emit at 1-3% rates and survive all
 * other polish passes:
 *
 *   1. Random mid-sentence capitalized letters
 *      Pattern: "the Man walked" → "the man walked"
 *      Common with rare nouns, technical terms, sci-fi coinage.
 *
 *   2. Comma-fragmented names
 *      Pattern: "Mrs, then gable" or "Dr, the foundation"
 *      The LLM places a comma where a period belongs and then lowercases
 *      the next word, breaking the person's title off from their name.
 *
 *   3. Capitalized verbs
 *      Pattern: "He Said something." | "The door Opened."
 *      Middle-of-sentence verb capitalization, sometimes a residue of
 *      training-data headers that leaked into the generator.
 *
 * Run in Polish pipeline AFTER punctuation cleanup, BEFORE voice pattern fixes.
 *
 * IMPORTANT: All patterns are CONSERVATIVE. We never lowercase anything that
 * could be a legitimate proper noun (character name, place, title). Only the
 * safe cases get fixed — words on an allow-list of common verbs/articles/
 * prepositions that should never be mid-sentence capitalized.
 */

// Common lowercase words that should NEVER appear capitalized mid-sentence.
// If we see "the Man" or "he Said", we downcase the second word.
// Kept tight to avoid stomping on real proper nouns.
const SAFE_DOWNCASE_VERBS = new Set([
  'said', 'says', 'saying', 'spoke', 'speaks', 'speaking',
  'walked', 'walks', 'walking', 'ran', 'runs', 'running',
  'opened', 'opens', 'opening', 'closed', 'closes', 'closing',
  'looked', 'looks', 'looking', 'watched', 'watches', 'watching',
  'turned', 'turns', 'turning', 'moved', 'moves', 'moving',
  'stepped', 'steps', 'stepping', 'sat', 'sits', 'sitting',
  'stood', 'stands', 'standing', 'rose', 'rises', 'rising',
  'felt', 'feels', 'feeling', 'thought', 'thinks', 'thinking',
  'knew', 'knows', 'knowing', 'saw', 'sees', 'seeing',
  'heard', 'hears', 'hearing', 'held', 'holds', 'holding',
  'gave', 'gives', 'giving', 'took', 'takes', 'taking',
  'came', 'comes', 'coming', 'went', 'goes', 'going',
  'asked', 'asks', 'asking', 'answered', 'answers', 'answering',
  'replied', 'replies', 'replying', 'nodded', 'nods', 'nodding',
  'shook', 'shakes', 'shaking', 'pulled', 'pulls', 'pulling',
  'pushed', 'pushes', 'pushing', 'leaned', 'leans', 'leaning',
  'reached', 'reaches', 'reaching', 'picked', 'picks', 'picking',
  'dropped', 'drops', 'dropping', 'lifted', 'lifts', 'lifting',
  'whispered', 'whispers', 'whispering', 'shouted', 'shouts', 'shouting',
  'smiled', 'smiles', 'smiling', 'laughed', 'laughs', 'laughing',
  'cried', 'cries', 'crying', 'wept', 'weeps', 'weeping',
  'screamed', 'screams', 'screaming', 'glanced', 'glances', 'glancing',
  'stared', 'stares', 'staring', 'paused', 'pauses', 'pausing',
]);

const SAFE_DOWNCASE_ARTICLES = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'yet', 'so',
  'with', 'without', 'within', 'through', 'across', 'behind',
  'before', 'after', 'during', 'around', 'between', 'among',
  'above', 'below', 'beyond', 'beside', 'beneath', 'under',
  'over', 'into', 'onto', 'from', 'toward', 'towards',
  'of', 'in', 'on', 'at', 'by', 'for', 'to',
  'he', 'she', 'it', 'they', 'we', 'you', 'i',
  'his', 'her', 'its', 'their', 'our', 'your', 'my',
  'him', 'them', 'us',
  'was', 'were', 'is', 'are', 'be', 'been', 'being',
  'has', 'have', 'had', 'having',
  'did', 'does', 'doing',
  'will', 'would', 'could', 'should', 'might', 'may', 'can',
  'not', 'never', 'always', 'often', 'sometimes',
  'still', 'instead', 'however', 'meanwhile', 'furthermore', 'moreover',
  'nevertheless', 'therefore', 'thus', 'hence', 'consequently',
  'regardless', 'otherwise', 'already', 'also', 'perhaps',
]);

const SAFE_DOWNCASE_ALL = new Set([...SAFE_DOWNCASE_VERBS, ...SAFE_DOWNCASE_ARTICLES]);

/**
 * Fix random mid-sentence capitalized words.
 * Scan for pattern: [word][space][CapitalWord] where the second word is on
 * the safe-downcase list and the prior word did NOT end a sentence.
 */
function fixMidSentenceCaps(text) {
  let fixed = 0;
  // Original pattern: lowercase word + space + CapWord
  let out = text.replace(
    /([a-z][a-z']{0,20})(\s+)([A-Z][a-z]{1,15})/g,
    (match, prev, gap, capped) => {
      const lower = capped.toLowerCase();
      if (!SAFE_DOWNCASE_ALL.has(lower)) return match;
      fixed++;
      return prev + gap + lower;
    }
  );
  // NEW pattern: comma + space + CapWord (catches "The paperwork, Still, it is")
  // Only downcases words on the safe list — won't touch proper nouns after commas.
  out = out.replace(
    /(,\s+)([A-Z][a-z]{1,15})(\b)/g,
    (match, comma, capped, boundary) => {
      const lower = capped.toLowerCase();
      if (!SAFE_DOWNCASE_ALL.has(lower)) return match;
      fixed++;
      return comma + lower + boundary;
    }
  );
  return { text: out, fixed };
}

/**
 * Fix comma-fragmented titles/names.
 * Patterns:
 *   "Mrs, then gable"    → "Mrs. Gable"  (but only if "Mrs"+"Gable" is plausible)
 *   "Dr, the foundation" → "Dr. The foundation" (keep as-is; ambiguous)
 *
 * Safe path: only fix titles ("Mr", "Mrs", "Ms", "Dr", "Mx", "Prof", "Rev")
 * directly followed by a comma, space, and then a lowercase word. Replace
 * the comma with a period and capitalize the next letter.
 */
function fixCommaFragmentedTitles(text) {
  let fixed = 0;
  const out = text.replace(
    /\b(Mrs|Mr|Ms|Mx|Dr|Prof|Rev|Sr|Jr|St)\s*,\s+([a-z])/g,
    (match, title, letter) => {
      fixed++;
      return title + '. ' + letter.toUpperCase();
    }
  );
  return { text: out, fixed };
}

/**
 * Fix spurious capitalized verbs INSIDE dialogue attribution.
 * Pattern: `," He said.` or `," she Nodded.`
 * These slip past mid-sentence-cap detection because of the quote boundary.
 */
function fixDialogueTagCaps(text) {
  let fixed = 0;
  const out = text.replace(
    /([,.!?]\s*["\u201d])\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/g,
    (match, close, subj, verb) => {
      const verbLower = verb.toLowerCase();
      if (SAFE_DOWNCASE_VERBS.has(verbLower)) {
        fixed++;
        return close + ' ' + subj + ' ' + verbLower;
      }
      return match;
    }
  );
  return { text: out, fixed };
}

/**
 * Fix lowercase standalone `i` used as the first-person pronoun.
 * Patterns: "yet i miss", "and i feel", "but i said" — the LLM occasionally
 * drops a lowercase `i` where the pronoun `I` belongs, especially inside
 * emotional dialogue where sentences get fragmented.
 *
 * Safe cases to upcase:
 *   - `word i word` where both surrounding words are lowercase (clearly pronoun)
 *   - `word i'` (contraction: "i'm", "i'll", "i've", "i'd")
 *   - `— i ` or `, i ` (after dash/comma break)
 * UNSAFE — leave alone:
 *   - URLs, code samples, email addresses (contain alphanumeric clusters)
 *   - Single-letter variables in inline code blocks (rare in prose)
 */
function fixLowercaseStandaloneI(text) {
  let fixed = 0;

  // Pattern 1: " i " with a space on both sides, flanked by alphanumeric prose.
  // Example: "yet i miss" → "yet I miss"
  let out = text.replace(
    /([a-z,;:!?"'\u2014\u2013\u2026\s]) i ([a-z])/g,
    (match, before, after) => {
      fixed++;
      return before + 'I ' + after;
    }
  );

  // Pattern 2: " i' " contractions → " I' "
  // Example: "but i'm" → "but I'm", "yet i've" → "yet I've"
  out = out.replace(
    /([a-z,;:!?"'\u2014\u2013\u2026\s]) i(['\u2019])/g,
    (match, before, apos) => {
      fixed++;
      return before + 'I' + apos;
    }
  );

  return { text: out, fixed };
}

/**
 * Detect "missing noun" patterns — flag-only, does NOT auto-fix.
 *
 * Pattern: [article/preposition] [adjective], [verb-phrase]
 * Example: "portal of pure, pulsed" — "pure" is an adjective but no noun
 * follows before the comma + verb. Likely missing "light" / "energy" etc.
 *
 * We anchor on article/preposition to skip legitimate appositive constructs
 * like "The problem, ugly and pulsing, was on the screen" — that pattern
 * has a noun subject BEFORE the adjective list, so it's not a missing-noun
 * case.
 *
 * Returns an array of warning objects that Polish can surface in its report.
 * No auto-replacement — the right noun ("light", "glow", "hum", "radiance")
 * is an authorial choice that a mechanical scanner cannot make safely.
 */
function detectMissingNouns(text, chapterNumber) {
  const warnings = [];
  const seen = new Set(); // dedupe identical patterns

  // Adjective list — words that ONLY function as adjectives, never as nouns.
  // (skipping ambiguous words like "smooth" "rough" "cool" which can be nouns too)
  const ADJ_LIST = '(?:pure|steady|silent|still|frozen|glowing|radiant|bright|deep|dark|shimmering|crystalline|pulsing|quiet|fierce|raw|soft|smooth|low|high|dull|sharp|thin|thick|warm|cold|hot|faint|loud|harsh|gentle|tender|brittle|wet|dry|slow|fast|quick|sluggish|languid|sticky|tacky|sour|sweet|bitter|salty|musty|stale|fresh|rough|smooth|jagged|round|square|flat|hollow|solid|rich|poor|lush|barren|dense|sparse|brilliant|murky|cloudy|clear|pale|vibrant|muted|stark|empty|full|hungry|thirsty|tired|weary|nervous|anxious|calm|tense|loose|tight|warm|cool|chilly|sweltering|mild|rabid|frantic|frenzied|placid|surly|sullen|grim|cheerful|grave|stern|jolly|merry|grouchy|snide|smarmy|crisp|stale|athletic)';

  // Pattern A — predicate-position with verb: "of pure, pulsed"
  const verbRx = new RegExp(
    '\\b(a|an|the|of|in|with|at|from|on|by|to)\\s+((?:\\w+\\s+)?' + ADJ_LIST +
    '),\\s+(pulsed|seemed|pulsing|glowed|was|were|hung|lay|stood|sat|gleamed|hummed|thrummed|rose|fell|shone|flickered|stretched|sounded)\\b',
    'gi'
  );

  // Pattern B — copula-position with simile/conjunction: "It was a slow, like..." / "The athletic, like..."
  // This catches Gemini's new finds. Match: <subject> <copula> <article> <adj>, <like|and>
  // EXAMPLE good catches: "It was a slow, like a small animal..."
  // EXAMPLE bypass: "It was a slow climb, like riding a bike" — adj is FOLLOWED by noun before comma, so no match
  const copulaRx = new RegExp(
    '\\b((?:it|that|this|there|something|everything|nothing|the\\s+\\w+|his\\s+\\w+|her\\s+\\w+|their\\s+\\w+|the)\\s+(?:was|were|is|are|felt|seemed|sounded|looked|tasted|smelled))\\s+(a|an|the)\\s+(' + ADJ_LIST +
    '),\\s+(like|and|but|then|that|which|with)\\b',
    'gi'
  );

  // Pattern C — bare subject-position: "The athletic, like..."
  const subjectRx = new RegExp(
    '\\b(The|A|An|His|Her|Their|Its)\\s+(' + ADJ_LIST +
    '),\\s+(like|and|but|then)\\b',
    'gi'
  );

  function pushWarning(adj, fullMatch, idx) {
    const key = fullMatch.toLowerCase().slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);

    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + fullMatch.length + 60);
    const snippet = text.substring(start, end).replace(/\s+/g, ' ').trim();
    warnings.push({
      chapterNumber: chapterNumber || '?',
      pattern: fullMatch.trim(),
      context: snippet,
      suggestion: 'Possible missing noun after "' + adj + '" — review and insert the intended word (e.g., light, glow, hum, sound, vibration, pulse).',
    });
  }

  let m;
  while ((m = verbRx.exec(text)) !== null) {
    pushWarning(m[2], m[0], m.index);
  }
  while ((m = copulaRx.exec(text)) !== null) {
    pushWarning(m[3], m[0], m.index);
  }
  while ((m = subjectRx.exec(text)) !== null) {
    pushWarning(m[2], m[0], m.index);
  }

  return warnings;
}

/**
 * Main entry point — run all three passes on every loaded chapter.
 * Matches the signature style of other Polish fixers (loaded[], onProgress).
 *
 * @returns {{ capFixed: number, changes: string[], warnings: object[] }}
 */
export function runCapitalizationHygiene(loaded, onProgress) {
  onProgress?.('Polish: Fixing capitalization and name fragments…');
  const changes = [];
  const warnings = [];
  let capFixed = 0;

  for (const f of loaded) {
    const ch = f.chapter?.chapter_number || '?';
    let chFixed = 0;

    const r1 = fixMidSentenceCaps(f.content);
    if (r1.fixed > 0) {
      f.content = r1.text;
      chFixed += r1.fixed;
      changes.push('Ch.' + ch + ': downcased ' + r1.fixed + ' mid-sentence caps');
    }

    const r2 = fixCommaFragmentedTitles(f.content);
    if (r2.fixed > 0) {
      f.content = r2.text;
      chFixed += r2.fixed;
      changes.push('Ch.' + ch + ': fixed ' + r2.fixed + ' comma-fragmented titles');
    }

    const r3 = fixDialogueTagCaps(f.content);
    if (r3.fixed > 0) {
      f.content = r3.text;
      chFixed += r3.fixed;
      changes.push('Ch.' + ch + ': fixed ' + r3.fixed + ' capitalized dialogue-tag verbs');
    }

    const r4 = fixLowercaseStandaloneI(f.content);
    if (r4.fixed > 0) {
      f.content = r4.text;
      chFixed += r4.fixed;
      changes.push('Ch.' + ch + ': upcased ' + r4.fixed + ' lowercase "i" pronouns');
    }

    // Flag-only: missing-noun candidates for author review
    const w = detectMissingNouns(f.content, ch);
    if (w.length > 0) {
      warnings.push(...w);
      changes.push('Ch.' + ch + ': flagged ' + w.length + ' possible missing-noun site(s) for review');
    }

    capFixed += chFixed;
  }

  if (capFixed > 0) {
    console.log('[POLISH] Capitalization hygiene fixed:', capFixed);
  }
  if (warnings.length > 0) {
    console.log('[POLISH] Missing-noun candidates flagged:', warnings.length);
    warnings.forEach(w => console.log('  Ch.' + w.chapterNumber + ': ' + w.pattern + ' — ' + w.suggestion));
  }

  return { capFixed, changes, warnings };
}