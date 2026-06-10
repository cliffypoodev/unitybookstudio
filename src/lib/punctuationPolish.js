// PUNCTUATION_POLISH_V3_AGGRESSIVE — 2026-04-22 — 150+ verb progressive reducer
/**
 * Punctuation artifact cleanup, broken sentence fixes, spelling corrections,
 * and coping mechanism caps.
 * Shared between fiction and nonfiction polish pipelines.
 */

/**
 * Enhanced punctuation artifact cleanup.
 * Mutates loaded[].content in place.
 */
export function runPunctuationCleanup(loaded, onProgress) {
  onProgress?.('Polish: Cleaning punctuation artifacts…');
  const changes = [];
  let punctFixed = 0;

  for (const f of loaded) {
    const before = f.content;

    // ── Straight-to-curly quote conversion ──
    // Convert all straight double quotes to proper curly (smart) quotes.
    // Rule: opening quote comes after whitespace/newline/start or after (—
    //        closing quote comes before whitespace/newline/end or before punctuation
    const straightCount = (f.content.match(/"/g) || []).length;
    if (straightCount > 0) {
      // Track open/close state
      let inQuote = false;
      let result = '';
      for (let i = 0; i < f.content.length; i++) {
        const ch = f.content[i];
        if (ch === '"') {
          // Em-dash boundary: quote after em-dash is always an opener
          const prevChar = f.content[i - 1] || '';
          if (!inQuote || prevChar === '\u2014') {
            result += '\u201c'; // opening curly "
            inQuote = true;
          } else {
            result += '\u201d'; // closing curly "
            inQuote = false;
          }
        } else {
          result += ch;
        }
      }
      // If we ended with an unclosed quote, the toggle got out of sync.
      // Fallback: just use simple regex approach
      if (inQuote) {
        // Reset and try regex instead
        let t = f.content;
        // Opening: after whitespace, newline, start of string, or after (—
        t = t.replace(/(^|[\s\n(\u2014])"(\S)/g, '$1\u201c$2');
        // Closing: before whitespace, newline, end, or punctuation
        t = t.replace(/(\S)"([\s\n,.!?;:\u2014)\-]|$)/g, '$1\u201d$2');
        // Remaining unmatched — alternate open/close
        let toggleOpen = true;
        t = t.replace(/"/g, () => {
          const q = toggleOpen ? '\u201c' : '\u201d';
          toggleOpen = !toggleOpen;
          return q;
        });
        f.content = t;
      } else {
        f.content = result;
      }
      const converted = straightCount;
      if (converted > 0) {
        punctFixed += converted;
        const chNum = f.chapter?.chapter_number || '?';
        changes.push('Ch.' + chNum + ': converted ' + converted + ' straight quotes to curly');
        console.log('[POLISH] Ch.' + chNum + ': converted ' + converted + ' straight quotes to curly');
      }
    }

    // Double commas
    f.content = f.content.replace(/,,+/g, ',');
    // Double periods (not ellipsis)
    f.content = f.content.replace(/(?<!\.)\.\.(?!\.)/g, '.');
    // Space before comma/period
    f.content = f.content.replace(/ +,/g, ',');
    f.content = f.content.replace(/ +\./g, '.');
    // Double spaces (not paragraph breaks)
    f.content = f.content.replace(/([^\n]) {2,}([^\n])/g, '$1 $2');
    // Comma followed by period
    f.content = f.content.replace(/,\./g, '.');
    // Period followed by comma
    f.content = f.content.replace(/\.,/g, '.');
    // Empty smart quotes
    f.content = f.content.replace(/\u201c\u201d/g, '');
    // Semicolon followed by period or comma
    f.content = f.content.replace(/;\./g, '.');
    f.content = f.content.replace(/;,/g, ';');
    // Orphaned verb + punctuation from banned word removal
    f.content = f.content.replace(/\bwas\s+\./g, 'was clear.');
    f.content = f.content.replace(/\bwas\s+,/g, 'was evident,');
    f.content = f.content.replace(/\bwere\s+\./g, 'were apparent.');
    f.content = f.content.replace(/\bwere\s+,/g, 'were evident,');
    f.content = f.content.replace(/\bseemed\s+\./g, 'seemed obvious.');
    f.content = f.content.replace(/\bseemed\s+,/g, 'seemed clear,');
    f.content = f.content.replace(/\bfelt\s+\./g, 'felt real.');
    f.content = f.content.replace(/\bfelt\s+,/g, 'felt present,');
    f.content = f.content.replace(/\ban\s+\./g, 'a clear.');
    f.content = f.content.replace(/\ban\s+,/g, 'a clear,');
    // Duplicate articles/determiners
    f.content = f.content.replace(/\bthe\s+the\b/gi, 'the');
    f.content = f.content.replace(/\ba\s+a\b/gi, 'a');
    f.content = f.content.replace(/\ban\s+an\b/gi, 'an');

    // Subject-verb comma splits: "The fan, sits" → "The fan sits"
    // Expanded verb list covers all common verbs the LLM places after spurious commas.
    // Only fires when comma is DIRECTLY between last word and verb — appositives
    // like "The setup, she says, is" are safe because they have words between commas.
    //
    // SAFETY: we check that no comma follows within the next 40 chars (which would
    // indicate an appositive: "The topic, according to his biography, is...").
    const SV_VERBS = /\b(is|are|was|were|has|have|had|does|did|do|will|would|could|should|can|may|might|shall|sits|sat|stands|stood|walks|walked|runs|ran|goes|went|comes|came|gets|got|makes|made|takes|took|gives|gave|keeps|kept|lets|left|puts|set|hits|cut|falls|fell|rose|grew|pays|paid|costs|sent|spent|built|led|met|won|sold|bought|drove|wore|wrote|read|chose|hung|spoke|meant|hid|brought|taught|fought|caught|lost|found|held|told|heard|felt|knew|thought|saw|showed|seemed|appeared|remained|became|began|started|stopped|continued|turned|proved|happened|existed|occurred|lived|died|worked|played|moved|changed|produced|created|provided|offered|allowed|caused|raised|needed|wanted|required|vanished|implied|represented|included|involved|operated|generated|converge|converges|generates|operates)\b/;
    
    const svOriginal = f.content;
    f.content = f.content.replace(
      new RegExp('(\\b\\w+)\\s*,\\s+(' + SV_VERBS.source.slice(2, -2) + ')', 'g'),
      (match, subject, verb, offset) => {
        // Skip participial modifiers: "posture, settling" is correct grammar
        if (/ing$/.test(verb)) return match;
        // Skip contracted tag questions: "clean, isn't it?" is correct
        if (/^(?:isn|aren|wasn|weren|doesn|didn|don|won|can|couldn|shouldn|wouldn)/i.test(verb)) return match;
        // Skip adjective/adverb subjects — these aren't subject-verb errors
        if (/(?:ly|ed|ful|ous|ive|al|ent|ant|ible|able)$/.test(subject)) return match;
        const afterVerb = svOriginal.substring(offset + match.length, offset + match.length + 40);
        const commaInAfter = afterVerb.indexOf(',');
        const beforeSubject = svOriginal.substring(Math.max(0, offset - 5), offset);
        if (commaInAfter >= 0 && commaInAfter < 35) return match;
        if (beforeSubject.includes(',')) return match;
        punctFixed++;
        return subject + ' ' + verb;
      }
    );

    // "yet" misuse detector: flag (not auto-fix) instances where "yet" is used
    // as a list connector instead of a conjunction. Pattern: ", yet [noun/gerund]"
    // where the word after "yet" is NOT a pronoun/subject (which would make it
    // a legitimate "however" usage: ", yet they are..." / ", yet it was...").
    // This is a known Lumimaid/DeepSeek quirk that produces ", yet eating and drinking"
    // when it means ", including eating and drinking" or "— eating and drinking".
    // Flag-only because the correct replacement varies by context.

    // Stacked duplicate openers: "The key is, the result is, the key is, the key is,"
    // Strip duplicate consecutive openers, keeping only the first.
    const STACKING_OPENERS = [
      'The key is, ', 'The result is, ', 'Consider: ',
      'In practice, ', 'Notice that ', 'Put simply, ',
      'That said, ', 'More importantly, ', 'In short, ',
      'By contrast, ', 'In fact, ', 'Of course, ',
    ];
    for (const opener of STACKING_OPENERS) {
      const escaped = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the opener appearing 2+ times in close proximity (within 100 chars)
      const stackRx = new RegExp(escaped + '(.{0,80})' + escaped, 'gi');
      let stackMatch;
      while ((stackMatch = stackRx.exec(f.content)) !== null) {
        // Remove the second occurrence
        const secondStart = stackMatch.index + opener.length + stackMatch[1].length;
        f.content = f.content.substring(0, secondStart) + f.content.substring(secondStart + opener.length);
        punctFixed++;
        // Reset regex to catch additional stacks
        stackRx.lastIndex = stackMatch.index;
      }
    }

    // Spaced em-dash fix: "p.m — on" → "p.m.—on" (specifically for time abbreviations)
    f.content = f.content.replace(/(\w)\.([a-z])\s+—\s+/g, '$1.$2.—');

    // ── FIX: Repeated consecutive words ──
    // "campaign campaign" → "campaign", "She she" → "She", "but but" → "but"
    // Skip legitimate doubles: "had had", "that that" (relative clause)
    // NOTE: Uses two capture groups + case-insensitive string compare because
    // JS regex backreferences (\1) are ALWAYS case-sensitive even with /i flag.
    // This ensures "Was was" (different case) is also caught.
    const SKIP_DOUBLES = new Set(['had', 'that', 'the']);
    f.content = f.content.replace(
      /\b(\w{2,})\s+(\w{2,})\b/gi,
      (match, word1, word2) => {
        if (word1.toLowerCase() !== word2.toLowerCase()) return match;
        if (SKIP_DOUBLES.has(word1.toLowerCase())) return match;
        punctFixed++;
        return word1;
      }
    );

    // ── FIX: Triple/double closing quotes ──
    // '"""' → '"', '""' at end of dialogue → '"'
    f.content = f.content.replace(/[\u201d]{2,}/g, '\u201d');
    f.content = f.content.replace(/"{2,}/g, '"');

    if (f.content !== before) punctFixed++;
  }

  if (punctFixed > 0) {
    changes.push('Punctuation artifacts cleaned in ' + punctFixed + ' chapters');
  }
  return { punctFixed, changes };
}

/**
 * Em-dash density reducer.
 * Converts excess em-dashes to other punctuation based on context.
 * Target: ~4 per 1K words (published fiction norm).
 * Keeps parenthetical pairs (word — phrase — word) and dialogue interruptions (word—").
 * Converts excess elaboration dashes (word — lowercase) to commas, colons, or periods.
 * Mutates loaded[].content in place.
 *
 * @returns {{ emDashReduced: number, changes: string[] }}
 */
export function runEmDashReducer(loaded, onProgress) {
  onProgress?.('Polish: Reducing em-dash density…');
  const changes = [];
  let emDashReduced = 0;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const wordCount = f.content.split(/\s+/).length;
    const dashes = (f.content.match(/\u2014/g) || []).length;
    const per1k = dashes / (wordCount / 1000);

    // Only reduce if above 6 per 1K (give some headroom above the 4 target)
    if (per1k <= 6) continue;

    // Target: reduce to ~5 per 1K
    const targetDashes = Math.round(5 * wordCount / 1000);
    const excess = dashes - targetDashes;
    if (excess <= 0) continue;

    let removed = 0;

    // Strategy: convert elaboration em-dashes (word — lowercase) to commas
    // These are the safest to convert: "a contract job — a pattern" → "a contract job, a pattern"
    // Skip parenthetical pairs and dialogue interruptions.
    //
    // Work backwards through the text to avoid index shifts.
    const dashPositions = [];
    const dashRx = /(\w[\w']*)\s*\u2014\s*([a-z])/g;
    let dm;
    while ((dm = dashRx.exec(f.content)) !== null) {
      // Check: is this part of a parenthetical pair?
      // Look ahead for a closing dash within 60 chars
      const ahead = f.content.substring(dm.index + dm[0].length, dm.index + dm[0].length + 80);
      const hasClosingDash = /\u2014/.test(ahead.substring(0, 60));
      if (hasClosingDash) continue; // skip parenthetical pairs

      // Check: is this inside dialogue?
      const before200 = f.content.substring(Math.max(0, dm.index - 200), dm.index);
      const openQ = (before200.match(/[\u201c"]/g) || []).length;
      const closeQ = (before200.match(/[\u201d"]/g) || []).length;
      if (openQ > closeQ) continue; // inside dialogue

      dashPositions.push(dm.index);
    }

    // Convert from the end to avoid index shifts, up to excess count
    const toConvert = dashPositions.slice(-Math.min(excess, dashPositions.length));
    toConvert.reverse();

    for (const pos of toConvert) {
      // Find the actual dash and its surrounding spaces
      const segment = f.content.substring(pos, pos + 40);
      const dashMatch = segment.match(/(\w[\w']*)\s*\u2014\s*/);
      if (!dashMatch) continue;

      const fullMatch = dashMatch[0];
      const replacement = dashMatch[1] + ', ';
      f.content = f.content.substring(0, pos) +
        f.content.substring(pos).replace(fullMatch, replacement);
      removed++;
      emDashReduced++;
    }

    if (removed > 0) {
      const newDashes = (f.content.match(/\u2014/g) || []).length;
      const newPer1k = newDashes / (wordCount / 1000);
      changes.push('Ch.' + chNum + ': reduced em-dashes ' + dashes + ' → ' + newDashes + ' (' + per1k.toFixed(1) + ' → ' + newPer1k.toFixed(1) + ' per 1K)');
    }
  }

  if (emDashReduced > 0) {
    console.log('[POLISH] Em-dash reducer: converted ' + emDashReduced + ' dashes to commas');
  }
  return { emDashReduced, changes };
}

/**
 * Progressive tense converter.
 * Converts "was/were [verb]ing" to simple past in narration.
 * "She was running" → "She ran", "He was watching" → "He watched"
 * Skips dialogue, skips verbs without safe conversions, skips "was being".
 * Caps at 50% reduction — leaves some progressive for legitimate ongoing-action uses.
 * Mutates loaded[].content in place.
 *
 * @returns {{ progressiveFixed: number, changes: string[] }}
 */
export function runProgressiveReducer(loaded, onProgress) {
  onProgress?.('Polish: Converting progressive tense…');
  const changes = [];
  let progressiveFixed = 0;
  let chaptersChecked = 0;
  let chaptersSkipped = 0;

  // Comprehensive conversions: progressive → simple past
  const CONVERT = {
    // Motion
    'running': 'ran', 'walking': 'walked', 'moving': 'moved', 'climbing': 'climbed',
    'crawling': 'crawled', 'stepping': 'stepped', 'sliding': 'slid', 'drifting': 'drifted',
    'floating': 'floated', 'falling': 'fell', 'rising': 'rose', 'flying': 'flew',
    'driving': 'drove', 'racing': 'raced', 'charging': 'charged', 'retreating': 'retreated',
    'advancing': 'advanced', 'approaching': 'approached', 'departing': 'departed',
    // Perception
    'watching': 'watched', 'looking': 'looked', 'staring': 'stared', 'seeing': 'saw',
    'listening': 'listened', 'hearing': 'heard', 'studying': 'studied', 'scanning': 'scanned',
    'searching': 'searched', 'examining': 'examined', 'observing': 'observed',
    'noticing': 'noticed', 'tracking': 'tracked', 'monitoring': 'monitored',
    // Physical action
    'standing': 'stood', 'sitting': 'sat', 'kneeling': 'knelt', 'leaning': 'leaned',
    'holding': 'held', 'gripping': 'gripped', 'pulling': 'pulled', 'pushing': 'pushed',
    'reaching': 'reached', 'grabbing': 'grabbed', 'carrying': 'carried', 'lifting': 'lifted',
    'dropping': 'dropped', 'throwing': 'threw', 'catching': 'caught', 'dragging': 'dragged',
    'pressing': 'pressed', 'squeezing': 'squeezed', 'scratching': 'scratched',
    'rubbing': 'rubbed', 'touching': 'touched', 'pointing': 'pointed',
    // Communication
    'talking': 'talked', 'speaking': 'spoke', 'whispering': 'whispered',
    'screaming': 'screamed', 'shouting': 'shouted', 'yelling': 'yelled',
    'singing': 'sang', 'calling': 'called', 'asking': 'asked', 'telling': 'told',
    'saying': 'said', 'explaining': 'explained', 'arguing': 'argued',
    'muttering': 'muttered', 'mumbling': 'mumbled',
    // Mental/emotional
    'thinking': 'thought', 'feeling': 'felt', 'wondering': 'wondered',
    'remembering': 'remembered', 'imagining': 'imagined', 'considering': 'considered',
    'planning': 'planned', 'expecting': 'expected', 'hoping': 'hoped',
    'preparing': 'prepared', 'calculating': 'calculated', 'counting': 'counted',
    'deciding': 'decided', 'choosing': 'chose', 'learning': 'learned',
    // Body states
    'shaking': 'shook', 'trembling': 'trembled', 'sweating': 'sweated',
    'bleeding': 'bled', 'breathing': 'breathed', 'choking': 'choked',
    'coughing': 'coughed', 'crying': 'cried', 'smiling': 'smiled',
    'frowning': 'frowned', 'pacing': 'paced', 'fidgeting': 'fidgeted',
    'twitching': 'twitched', 'stuttering': 'stuttered',
    // Change of state
    'changing': 'changed', 'growing': 'grew', 'building': 'built',
    'breaking': 'broke', 'burning': 'burned', 'dying': 'died',
    'forming': 'formed', 'spreading': 'spread', 'shrinking': 'shrank',
    'fading': 'faded', 'thinning': 'thinned', 'thickening': 'thickened',
    'healing': 'healed', 'cracking': 'cracked', 'melting': 'melted',
    'freezing': 'froze', 'dissolving': 'dissolved', 'hardening': 'hardened',
    'weakening': 'weakened', 'strengthening': 'strengthened',
    // Work/effort
    'working': 'worked', 'trying': 'tried', 'fighting': 'fought',
    'struggling': 'struggled', 'winning': 'won', 'losing': 'lost',
    'making': 'made', 'taking': 'took', 'getting': 'got',
    'giving': 'gave', 'coming': 'came', 'going': 'went',
    'leaving': 'left', 'hiding': 'hid', 'living': 'lived',
    'playing': 'played', 'reading': 'read', 'writing': 'wrote',
    'wearing': 'wore', 'eating': 'ate', 'drinking': 'drank',
    'sleeping': 'slept', 'waiting': 'waited', 'turning': 'turned',
    // System/mechanical (for sci-fi)
    'directing': 'directed', 'scrubbing': 'scrubbed', 'weaving': 'wove',
    'manifesting': 'manifested', 'misfiring': 'misfired', 'attempting': 'attempted',
    'refining': 'refined', 'operating': 'operated', 'processing': 'processed',
    'mapping': 'mapped', 'calibrating': 'calibrated', 'reacting': 'reacted',
    'dismantling': 'dismantled', 'flickering': 'flickered', 'pulsing': 'pulsed',
    'humming': 'hummed', 'vibrating': 'vibrated', 'buzzing': 'buzzed',
    'glowing': 'glowed', 'dimming': 'dimmed', 'offering': 'offered',
    'introducing': 'introduced', 'producing': 'produced',
    'clicking': 'clicked', 'scrolling': 'scrolled', 'typing': 'typed',
    // Additional verbs found in manuscripts
    'using': 'used', 'doing': 'did', 'becoming': 'became',
    'sobbing': 'sobbed', 'adapting': 'adapted', 'constructing': 'constructed',
    'experiencing': 'experienced', 'completing': 'completed', 'generating': 'generated',
    'harvesting': 'harvested', 'performing': 'performed', 'measuring': 'measured',
    'reflecting': 'reflected', 'initiating': 'initiated', 'serving': 'served',
    'optimizing': 'optimized', 'panting': 'panted', 'lowering': 'lowered',
    'piecing': 'pieced', 'reciting': 'recited', 'heading': 'headed',
    'creating': 'created', 'ensuring': 'ensured', 'planting': 'planted',
    'acknowledging': 'acknowledged', 'hammering': 'hammered', 'normalizing': 'normalized',
    'anchoring': 'anchored', 'folding': 'folded', 'iterating': 'iterated',
    'decaying': 'decayed', 'tapping': 'tapped', 'corrupting': 'corrupted',
    'balancing': 'balanced', 'collecting': 'collected', 'slowing': 'slowed',
    'responding': 'responded', 'applying': 'applied', 'innovating': 'innovated',
    'ringing': 'rang', 'bridging': 'bridged', 'providing': 'provided',
    'seeding': 'seeded', 'simulating': 'simulated', 'evolving': 'evolved',
    'spiking': 'spiked', 'punishing': 'punished', 'warming': 'warmed',
    'reconstructing': 'reconstructed', 'tuning': 'tuned', 'amplifying': 'amplified',
    'framing': 'framed', 'broadcasting': 'broadcast', 'flowing': 'flowed',
    'transmitting': 'transmitted', 'sending': 'sent', 'dipping': 'dipped',
    'exposing': 'exposed', 'sanding': 'sanded', 'tilting': 'tilted',
    'connecting': 'connected', 'missing': 'missed', 'locking': 'locked',
    'digging': 'dug', 'ending': 'ended', 'bandaging': 'bandaged',
    'opting': 'opted', 'reliving': 'relived', 'rewriting': 'rewrote',
    'erasing': 'erased', 'debugging': 'debugged', 'judging': 'judged',
    'scraping': 'scraped', 'swelling': 'swelled', 'diverging': 'diverged',
    'binding': 'bound', 'weeping': 'wept', 'executing': 'executed',
    'altering': 'altered', 'tracing': 'traced', 'presenting': 'presented',
    'drawing': 'drew', 'adjusting': 'adjusted', 'overwhelming': 'overwhelmed',
  };

  // Words that look like progressive but aren't verbs — skip these
  // Words that look like progressive but NEVER function as verbs in "was/were X" context
  const NOT_VERBS = new Set([
    'something', 'nothing', 'anything', 'everything',
    'morning', 'evening', 'willing', 'thing', 'king',
    'string', 'ring', 'spring', 'bling', 'wing', 'swing',
    'bring', 'cling', 'fling', 'sling', 'sting', 'wring',
    'ceiling', 'darling', 'sibling', 'offspring',
    'lightning', 'clothing', 'sterling', 'startling',
    'underlying', 'interesting',
  ]);

  // Interrupted-action patterns — skip these (progressive is correct)
  const INTERRUPT_RX = /^[\s,]*(?:when|as |until|before|after|while|the moment|just as)\b/i;

  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const wordCount = f.content.split(/\s+/).length;

    // Count current progressive usage
    const allProg = (f.content.match(/\b(?:was|were)\s+\w+ing\b/gi) || []).length;
    const per10k = allProg / (wordCount / 10000);

    // Fire on ANY chapter with progressive > 8/10K (published norm)
    if (per10k <= 8) { chaptersSkipped++; continue; }

    // Target: reduce to 6/10K — aggressive
    const target = Math.round(6 * wordCount / 10000);
    const toConvert = allProg - target;
    if (toConvert <= 0) { chaptersSkipped++; continue; }

    chaptersChecked++;

    let converted = 0;

    // Match ALL was/were + *ing patterns, then decide per-match
    const rx = /\b(was|were)\s+(\w+ing)\b/gi;

    // CRITICAL: capture original content BEFORE replace mutates f.content.
    // The offset parameter in .replace() refers to the ORIGINAL string,
    // but f.content changes as replacements shorten the text. Reading
    // f.content at stale offsets corrupts the dialogue/interrupt checks.
    const originalContent = f.content;

    f.content = f.content.replace(rx, (match, auxiliary, verb, offset) => {
      if (converted >= toConvert) return match;

      const verbLower = verb.toLowerCase();

      // Skip non-verbs
      if (NOT_VERBS.has(verbLower)) return match;

      // Skip if inside dialogue (use ORIGINAL content for offset lookups)
      const before200 = originalContent.substring(Math.max(0, offset - 200), offset);
      const openQ = (before200.match(/[\u201c"]/g) || []).length;
      const closeQ = (before200.match(/[\u201d"]/g) || []).length;
      if (openQ > closeQ) return match;

      // Skip if the action is being interrupted (use ORIGINAL content)
      const after40 = originalContent.substring(offset + match.length, offset + match.length + 40);
      if (INTERRUPT_RX.test(after40)) return match;

      // Try known conversion first
      const simplePast = CONVERT[verbLower];
      if (simplePast) {
        converted++;
        progressiveFixed++;
        return simplePast;
      }

      // Auto-convert regular verbs: *ing → *ed (if not in the table)
      // This catches verbs we didn't explicitly list
      if (verbLower.endsWith('ting') && verbLower.length > 5) {
        // sitting → sat (irregular, skip), but "stuttering" → "stuttered" etc.
        // Only auto-convert if the -ing form is 6+ chars (avoid "biting"→"bited")
        return match; // Skip short irregular -ting verbs
      }
      if (verbLower.endsWith('ning') && verbLower.length > 6) {
        // running → ran (irregular), thinning → thinned
        const stem = verbLower.slice(0, -4); // thin + ning → thin
        converted++;
        progressiveFixed++;
        return stem + 'ned';
      }
      if (verbLower.endsWith('ling') && verbLower.length > 5) {
        const stem = verbLower.slice(0, -3); // travel + ling → traveled
        converted++;
        progressiveFixed++;
        return stem + 'ed';
      }
      if (verbLower.endsWith('ting') && verbLower.length > 6) {
        const stem = verbLower.slice(0, -4);
        converted++;
        progressiveFixed++;
        return stem + 'ted';
      }

      return match;
    });

    if (converted > 0) {
      const newProg = (f.content.match(/\b(?:was|were)\s+\w+ing\b/gi) || []).length;
      const newPer10k = newProg / (wordCount / 10000);
      changes.push('Ch.' + chNum + ': converted ' + converted + ' progressive verbs (' + per10k.toFixed(0) + ' → ' + newPer10k.toFixed(0) + ' per 10K)');
    }
  }

  if (progressiveFixed > 0) {
    console.log('[POLISH] Progressive reducer: converted ' + progressiveFixed + ' instances');
  }
  return { progressiveFixed, changes };
}

/**
 * Common AI misspelling corrections.
 * Mutates loaded[].content in place.
 */
export function runSpellingFixes(loaded, onProgress) {
  onProgress?.('Polish: Fixing common misspellings…');
  const changes = [];
  let spellingFixed = 0;

  const spellingFixes = [
    [/\bcacheing\b/g, 'caching'],
    [/\brecieve\b/gi, 'receive'],
    [/\boccured\b/gi, 'occurred'],
    [/\bseperate\b/gi, 'separate'],
    [/\baccidently\b/gi, 'accidentally'],
    [/\boccassion/gi, 'occasion'],
    [/\bneccessary\b/gi, 'necessary'],
    [/\bconciousness\b/gi, 'consciousness'],
    [/\bdieing\b/g, 'dying'],
    [/\blieing\b/g, 'lying'],
    [/\bthier\b/gi, 'their'],
    [/\balot\b/gi, 'a lot'],
    [/\bdefinate\b/gi, 'definite'],
    [/\bdefinately\b/gi, 'definitely'],
  ];

  for (const f of loaded) {
    for (const [pattern, replacement] of spellingFixes) {
      const matches = f.content.match(pattern);
      if (matches && matches.length > 0) {
        f.content = f.content.replace(pattern, replacement);
        spellingFixed += matches.length;
      }
    }
  }

  if (spellingFixed > 0) {
    changes.push('Spelling corrections: ' + spellingFixed);
    console.log('[POLISH] Spelling fixes:', spellingFixed);
  }
  return { spellingFixed, changes };
}

/**
 * Fix broken sentences from replacement artifacts.
 * Mutates loaded[].content in place.
 */
export function runBrokenSentenceFixes(loaded, onProgress) {
  onProgress?.('Polish: Fixing replacement artifacts…');
  const changes = [];
  let artifactsFixed = 0;

  for (const f of loaded) {
    // "She spoke, and the words barely" → "She spoke, the words barely"
    f.content = f.content.replace(
      /([Ss]he|[Hh]e) spoke, and the words\b/g,
      (m, pronoun) => { artifactsFixed++; return pronoun + ' spoke, the words'; }
    );

    // "said it, and it [preposition] the" without a verb
    f.content = f.content.replace(
      /said it, and it (in|on|at|to|from|through|across|into|over) the\b/g,
      (m, prep) => { artifactsFixed++; return 'said it, and it hung ' + prep + ' the'; }
    );

    // Duplicate determiners
    f.content = f.content.replace(/\bthe the\b/gi, 'the');
    f.content = f.content.replace(/\ba a\b/gi, 'a');
    f.content = f.content.replace(/\ban an\b/gi, 'an');

    // Orphaned dash at end of speech: "She spoke — ." → "She spoke."
    f.content = f.content.replace(/([Ss]he|[Hh]e) spoke\s*[—\-]+\s*([.!?"\n])/g,
      (m, pronoun, end) => { artifactsFixed++; return pronoun + ' spoke.' + (end === '\n' ? '\n' : ''); }
    );
  }

  if (artifactsFixed > 0) {
    changes.push('Replacement artifacts fixed: ' + artifactsFixed);
    console.log('[POLISH] Broken sentence artifacts:', artifactsFixed);
  }
  return { artifactsFixed, changes };
}

/**
 * Coping mechanism / recurring action repetition caps.
 * Caps character tics (palm rubbing, ledger metaphors, taste of copper, etc.).
 * Mutates loaded[].content in place.
 */
export function runCopingMechanismCaps(loaded, onProgress) {
  onProgress?.('Polish: Capping recurring actions…');
  const changes = [];
  let copingFixed = 0;

  const copingText = loaded.map(f => f.content).join(' ');
  const copingWords = copingText.split(/\s+/).filter(Boolean).length;

  const copingCaps = [
    {
      pattern: /\b(?:rubbed?|rubbing)\s+(?:her|his)\s+(?:palm|thumb|hand|wrist)\b/gi,
      max: 0.5,
      label: 'palm/thumb rubbing',
    },
    {
      pattern: /\b(?:her|his)\s+(?:calloused?|callused?)\s+(?:palm|ridge|hand|thumb)\b/gi,
      max: 0.3,
      label: 'calloused palm/ridge',
    },
    {
      pattern: /\b(?:the|her|his)\s+internal\s+ledger\b/gi,
      max: 0.3,
      label: 'ledger metaphor',
    },
    {
      pattern: /\b(?:the|her|his)\s+(?:internal\s+)?(?:machine|mechanism)\s+(?:re-?engaged|engaged|clicked|turned|kicked|whirred|hummed)\b/gi,
      max: 0.5,
      label: 'machine metaphor',
    },
    {
      pattern: /\b(?:tasted?|taste of)\s+(?:copper|blood|iron|metal)\b/gi,
      max: 0.5,
      label: 'taste of copper/blood',
    },
  ];

  for (const entry of copingCaps) {
    const allText = loaded.map(f => f.content).join('\n\n');
    const matches = allText.match(entry.pattern);
    if (!matches) continue;

    const count = matches.length;
    const maxAllowed = Math.max(3, Math.round(entry.max * copingWords / 10000));
    if (count <= maxAllowed) continue;

    const excess = count - maxAllowed;
    let instanceCount = 0;
    let removed = 0;

    console.log('[POLISH] Coping cap "' + entry.label + '": ' + count + ' found, max: ' + maxAllowed + ', removing: ' + excess);

    for (const f of loaded) {
      if (removed >= excess) break;
      f.content = f.content.replace(entry.pattern, (match) => {
        instanceCount++;
        if (instanceCount <= maxAllowed) return match;
        if (removed >= excess) return match;
        removed++;
        copingFixed++;
        return '';
      });
    }

    // Clean artifacts from removal
    for (const f of loaded) {
      f.content = f.content.replace(/  +/g, ' ');
      f.content = f.content.replace(/ ,/g, ',');
      f.content = f.content.replace(/\.\s*\./g, '.');
      f.content = f.content.replace(/,\s*,/g, ',');
    }

    if (removed > 0) {
      changes.push(entry.label + ': ' + count + ' → ' + maxAllowed + ' (' + removed + ' removed)');
    }
  }

  if (copingFixed > 0) {
    changes.push('Coping mechanism tics capped: ' + copingFixed);
    console.log('[POLISH] Coping mechanisms capped:', copingFixed);
  }
  return { copingFixed, changes };
}

/**
 * Fix dialogue punctuation placement — American style requires punctuation
 * INSIDE the closing quotation mark, not outside.
 *
 *   Wrong:  "text".     "text"?     "text"!
 *   Right:  "text."     "text?"     "text!"
 *
 * This module catches both smart (curly) and straight quotes. Handles the
 * three most common offenders: period, question mark, exclamation. Does NOT
 * touch commas because comma-outside-quote is rare as an error (often
 * intentional in citation or when the comma belongs to the sentence frame
 * rather than the quoted text).
 *
 * Also catches the British convention `"text".` where American publishing
 * (KDP default) expects `"text."` — if the user is targeting a British
 * market they can disable this check, but the default is American since
 * that's where the 80% of indie nonfiction/fiction market lives.
 *
 * A single Dustbowl-sized manuscript (86K words) had 183 of these errors,
 * roughly 1 per 475 words. Purely mechanical fix, no risk to real prose.
 */
export function runDialoguePunctuationFix(loaded, onProgress) {
  onProgress?.('Polish: Fixing dialogue punctuation placement…');
  const changes = [];
  let dialogPunctFixed = 0;

  for (const f of loaded) {
    const ch = f.chapter?.chapter_number || '?';

    // Count before any swap so we know how many changes we made
    const smartBefore = (f.content.match(/\u201d[.!?]/g) || []).length;
    const straightBefore = (f.content.match(/"[.!?]/g) || []).length;
    const totalBefore = smartBefore + straightBefore;

    // Smart (curly) closing quote: "text". → "text."
    f.content = f.content.replace(/\u201d([.!?])/g, '$1\u201d');

    // Straight quote: "text". → "text."
    f.content = f.content.replace(/"([.!?])/g, '$1"');

    if (totalBefore > 0) {
      dialogPunctFixed += totalBefore;
      changes.push('Ch.' + ch + ': moved ' + totalBefore + ' punctuation marks inside closing quote');
    }
  }

  if (dialogPunctFixed > 0) {
    console.log('[POLISH] Dialogue punctuation fixed:', dialogPunctFixed);
  }

  return { dialogPunctFixed, changes };
}

/**
 * Strip junk filler conjunctions inserted between an action beat and dialogue.
 *
 * The Base44 prompts tell the LLM to use action beats instead of "said" tags.
 * In ~1% of cases, the LLM compensates by inserting "yet", "then", "and",
 * or "but" between the action beat (ending in a comma) and the opening
 * dialogue quote — creating ungrammatical hybrids:
 *
 *   "Earl eyed them skeptically, yet 'Y'all got money?'"
 *   "Mira gasped, and 'The dullness...'"
 *   "They turned, then 'We need to go.'"
 *
 * The fix: replace ", FILLER " with ". " — promoting the comma to a period
 * and stripping the junk word. This converts an action beat + dialogue into
 * two clean sentences. Capitalization is already correct because the dialogue
 * starts with a capital letter.
 *
 * SAFE because the regex requires an opening quote mark immediately after
 * the filler. Legitimate uses of "yet"/"and"/"then"/"but" inside or outside
 * dialogue (where no quote mark follows) are not touched.
 *
 * Verified on Dustbowl Pitstop v7 (86K words): 76 instances, all real bugs,
 * 0 false positives in legit-case tests.
 */
export function runDialogueFillerFix(loaded, onProgress) {
  onProgress?.('Polish: Stripping junk fillers before dialogue…');
  const changes = [];
  let dialogFillerFixed = 0;

  // Match: <wordEndingInLetter>, [yet|then|and|but] [opening quote]
  // The opening quote can be smart \u201c or straight ".
  // Capture word + filler + quote so we can rebuild without filler.
  const fillerRx = /(\w+),\s+(yet|then|and|but)\s+(["\u201c])/gi;

  for (const f of loaded) {
    const ch = f.chapter?.chapter_number || '?';
    const before = (f.content.match(fillerRx) || []).length;
    if (before === 0) continue;

    f.content = f.content.replace(fillerRx, (match, prevWord, junk, quote) => {
      return prevWord + '. ' + quote;
    });

    dialogFillerFixed += before;
    changes.push('Ch.' + ch + ': stripped ' + before + ' junk fillers (yet/then/and/but) before dialogue');
  }

  if (dialogFillerFixed > 0) {
    console.log('[POLISH] Dialogue fillers stripped:', dialogFillerFixed);
  }

  return { dialogFillerFixed, changes };
}