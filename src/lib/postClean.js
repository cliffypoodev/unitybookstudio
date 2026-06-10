/**
 * Post-generation mechanical cleaning — runs AFTER the model writes.
 * Every function here is pure regex / string manipulation. The model gets no vote.
 */

// ── 1. Strip formatting artifacts ──────────────────────────────────────────

function stripMarkdownHeaders(text) {
  return text.replace(/^#{1,6}\s+.*/gm, (m) => m.replace(/^#{1,6}\s+/, ''));
}

function stripBoldMarkers(text) {
  return text.replace(/\*\*/g, '');
}

function stripItalicMarkers(text) {
  return text.replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '$1');
}

function stripSceneLabels(text) {
  return text.replace(/^(?:#{0,4}\s*)?Scene\s+\d+\s*[:\-—]?\s*.*/gim, '');
}

function stripDiffArtifacts(text) {
  // Code fences, diff headers, hunk markers
  return text.replace(/^```[\s\S]*?^```/gm, '')
    .replace(/^---\s*a\/.*/gm, '')
    .replace(/^\+\+\+\s*b\/.*/gm, '')
    .replace(/^@@\s.*?@@.*$/gm, '');
}

function stripOrphanedFormatting(text) {
  return text.replace(/__/g, '');
}

// ── 2. Duplicate removal ───────────────────────────────────────────────────

function removeExactDuplicateLines(text) {
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      result.push(line);
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(line);
  }
  return result.join('\n');
}

function getWordSet(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

function wordOverlapRatio(a, b) {
  const setA = new Set(getWordSet(a));
  const setB = new Set(getWordSet(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  setB.forEach(w => { if (setA.has(w)) overlap++; });
  return overlap / Math.min(setA.size, setB.size);
}

function removeNearDuplicateParagraphs(text) {
  const paragraphs = text.split(/\n\n+/);
  const kept = [];
  for (const para of paragraphs) {
    if (para.trim().length < 30) { kept.push(para); continue; }
    let isDupe = false;
    for (const prev of kept) {
      if (prev.trim().length < 30) continue;
      if (wordOverlapRatio(prev, para) > 0.75) { isDupe = true; break; }
    }
    if (!isDupe) kept.push(para);
  }
  return kept.join('\n\n');
}

function removeDuplicateSentencesInParagraphs(text) {
  return text.split(/\n\n+/).map(para => {
    const sentences = para.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length < 2) return para;
    const seen = new Set();
    const unique = [];
    for (const s of sentences) {
      const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
    }
    return unique.join('');
  }).join('\n\n');
}

// ── 3. Instruction leaks ───────────────────────────────────────────────────

function stripInstructionLeaks(text) {
  // Bracketed editorial notes
  let cleaned = text.replace(/\[(?:NOTE(?:\s+TO\s+AUTHOR)?|TODO|TK|FIXME|EDITOR|INSERT|PLACEHOLDER|CONTENT WARNING|CW|TW)[^\]]*\]/gi, '');
  // "as instructed by the prompt" and variants
  cleaned = cleaned.replace(/[,.]?\s*as (?:instructed|directed|specified|requested) by the (?:prompt|instructions?|system)[.,]?/gi, '');
  return cleaned;
}

// ── 3b. Assistant-style preamble/postamble and meta-commentary ─────────────

function stripAssistantFraming(text) {
  let cleaned = text;
  // Strip opening preambles: "Here is...", "Here's...", "Below is..."
  cleaned = cleaned.replace(/^(?:Here(?:'s| is) (?:the |your |a )?(?:chapter|prose|draft|content|text|story|scene)[^\n]*\n+)/i, '');
  // Strip closing assistant lines
  cleaned = cleaned.replace(/\n+(?:Let me know if[^\n]*|I hope (?:this|you)[^\n]*|Feel free to[^\n]*|Would you like[^\n]*|If you(?:'d| would) like[^\n]*)\s*$/gi, '');
  // Strip content warnings / disclaimers at top
  cleaned = cleaned.replace(/^(?:Content Warning|CW|TW|Trigger Warning|Disclaimer)[:\s][^\n]*\n+/gi, '');
  // Strip meta-commentary lines
  cleaned = cleaned.replace(/^(?:Note:|Author'?s? note:|Editor'?s? note:)[^\n]*\n*/gim, '');
  // Strip ALL composite/methodology disclaimers (bracketed and inline)
  cleaned = cleaned.replace(/\[(?:The following|This) (?:account|narrative|story|section) is (?:a )?composite[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Composite[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Based on composite[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Drawn from multiple[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Note:[^\]]*composite[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/A composite (?:figure|character|portrait|narrative|account) drawn from (?:multiple|several|various) (?:documented |historical )?(?:accounts|experiences|sources|records)[^.]*\.\s*/gi, '');
  cleaned = cleaned.replace(/The following account is a composite[^.]*\.\s*/gi, '');
  cleaned = cleaned.replace(/  +/g, ' ');
  return cleaned;
}

function stripChapterHeadings(text) {
  // Remove "Chapter 1: Title" or "Chapter One" or "CHAPTER 1" style headings
  return text.replace(/^(?:#{0,4}\s*)?(?:Chapter\s+(?:\d+|[A-Z][a-z]+))(?:\s*[:\-—]\s*[^\n]*)?\s*\n+/gim, '');
}

// ── 3c. Delete sentences containing BANNED phrases ───────────────────────────

const BANNED_SENTENCE_PATTERNS = [
  /in that moment/gi,
  /waves of (pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi,
  /washed over (him|her|them|me|us)/gi,
  /threatened to overwhelm/gi,
  /couldn't help but/gi,
  /something (shifted|loosened|cracked|tightened|moved|settled|expanded) in (her|his|their|my) chest/gi,
  /the (weight|smell|sound|feel) of (everything|all of it|the moment)/gi,
  /what might have been/gi,
  /a kind of \w+ that/gi,
  /the particular \w+ of/gi,
  /something that (looked|felt|sounded|seemed) like/gi,
  /a breath \w+ didn.t know/gi,
  /a sense of \w+/gi,
  /the air was thick with/gi,
  /a pang of \w+/gi,
  /heart pounded in (his|her|their) chest/gi,
  /(raven|dark|golden) hair (spilled|cascaded|tumbled)/gi,
  /piercing (blue|green|gray) eyes/gi,
  /a knowing smile/gi,
  /the world seemed to (slow|stop|shift)/gi,
  /a silence that spoke volumes/gi,
  /sent (a )?(jolt|shiver|chill|wave|surge|bolt) (through|down|up)/gi,
  /\bcacophony\b/gi,
];

function deleteBannedSentences(text) {
  for (const rx of BANNED_SENTENCE_PATTERNS) {
    const paragraphs = text.split(/\n\n+/);
    text = paragraphs.map(para => {
      const sentences = para.split(/(?<=[.!?])\s+/);
      return sentences.filter(s => { rx.lastIndex = 0; return !rx.test(s); }).join(' ');
    }).join('\n\n');
  }
  return text;
}

// ── 3d. Cap AI adjectives at 1 per chapter ───────────────────────────────────

const AI_ADJECTIVE_LIST = [
  'shimmering', 'luminous', 'tapestry', 'intricate', 'meticulously',
  'insatiable', 'palpable', 'unmistakable', 'undeniable', 'relentless',
  'sprawling', 'labyrinthine', 'opulent', 'resplendent', 'ethereal',
  'visceral', 'crescendo', 'juxtaposition', 'myriad',
  'plethora', 'testament', 'harbinger', 'paradigm', 'dichotomy',
];

function capAiAdjectives(text) {
  for (const adj of AI_ADJECTIVE_LIST) {
    let count = 0;
    const rx = new RegExp('\\b' + adj + '\\b', 'gi');
    text = text.replace(rx, function(match) {
      count++;
      return count <= 1 ? match : '';
    });
  }
  return text;
}

// ── 3e. Cap character names at 12 per chapter ────────────────────────────────

function capCharacterNames(text) {
  const names = {};
  const nameMatches = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  nameMatches.forEach(n => { names[n] = (names[n] || 0) + 1; });
  for (const [name, count] of Object.entries(names)) {
    if (count > 12) {
      let seen = 0;
      const rx = new RegExp('\\b' + name + '\\b', 'g');
      text = text.replace(rx, function(match) {
        seen++;
        if (seen <= 12) return match;
        // Keep every 3rd occurrence as the name for clarity, replace others with 'they'
        return seen % 3 === 0 ? match : 'they';
      });
    }
  }
  return text;
}

// ── 4. Frequency-capped phrases (with rotation) ───────────────────────────

function capPhrase(text, rx, max, replacements) {
  let count = 0;
  let repIdx = 0;
  return text.replace(rx, (match) => {
    count++;
    if (count <= max) return match;
    if (replacements && replacements.length > 0) {
      const rep = replacements[repIdx % replacements.length];
      repIdx++;
      return rep;
    }
    return '';
  });
}

function capConsiderPhrases(text) {
  return capPhrase(text, /\bConsider (?:the|a)\b[^.!?\n]*/gi, 1, []);
}

function capYouMightPhrases(text) {
  let cleaned = capPhrase(text, /\bYou might assume\b[^.!?\n]*/gi, 1, []);
  cleaned = capPhrase(cleaned, /\bYou might imagine\b[^.!?\n]*/gi, 1, []);
  return cleaned;
}

const THESIS_ROTATIONS = [
  { rx: /\bgilded cage\b/gi, max: 2, alts: ['luxurious prison', 'golden trap', 'opulent confinement'] },
  { rx: /\babsolute control\b/gi, max: 2, alts: ['total authority', 'iron grip', 'complete dominion'] },
  { rx: /\bsystemic exploitation\b/gi, max: 2, alts: ['institutional abuse', 'organized predation'] },
  { rx: /\bdream factory\b/gi, max: 2, alts: ['studio machine', 'Hollywood apparatus'] },
  { rx: /\bunchecked power\b/gi, max: 2, alts: ['unaccountable authority', 'unrestrained dominance'] },
];

function capThesisRestatements(text) {
  let cleaned = text;
  for (const { rx, max, alts } of THESIS_ROTATIONS) {
    cleaned = capPhrase(cleaned, rx, max, alts);
  }
  return cleaned;
}

// ── 5. Scaffolding, recap, and transition crutches ─────────────────────────

function stripScaffolding(text) {
  return text.replace(/^[^\n]*(?:This chapter (?:will )?explore|We (?:will|shall) (?:examine|explore|discuss|consider|look at|turn to)|In this (?:chapter|section),? (?:we|I) (?:will|shall))[^\n]*$/gim, '');
}

function stripRecapBloat(text) {
  return text.replace(/^[^\n]*(?:As we'?ve (?:discussed|seen|noted|established|mentioned)|To summarize(?:,|\s)|As (?:previously )?(?:mentioned|discussed|noted)|To recap(?:,|\s)|In summary(?:,|\s))[^\n]*$/gim, '');
}

function stripTransitionCrutches(text) {
  // Only strip when they open a sentence (start of line or after period)
  return text
    .replace(/(?:^|\.\s+)Furthermore,\s/gm, (m) => m.replace(/Furthermore,\s/, ''))
    .replace(/(?:^|\.\s+)Moreover,\s/gm, (m) => m.replace(/Moreover,\s/, ''))
    .replace(/(?:^|\.\s+)Additionally,\s/gm, (m) => m.replace(/Additionally,\s/, ''));
}

// ── 6. Scene caps ──────────────────────────────────────────────────────────

function capCoffeeScenes(text) {
  // Detect coffee-making / coffee-drinking scenes (paragraph-level)
  const coffeeRx = /\b(?:made? (?:herself|himself|myself|themselves)? ?(?:a )?(?:cup of )?coffee|poured? (?:a )?(?:cup of )?coffee|brewed? (?:a pot|coffee)|sipped? (?:her|his|my|their) coffee|reached for (?:the|her|his|my) (?:coffee|mug)|the coffee maker? (?:gurgled|hissed|beeped))\b/gi;
  let count = 0;
  return text.replace(coffeeRx, (match) => {
    count++;
    return count <= 1 ? match : '';
  });
}

function capArchiveFraming(text) {
  const archiveRx = /\b(?:I (?:open(?:ed)?|pull(?:ed)? out|discover(?:ed)? in) (?:the|a) (?:dusty |worn |yellowed )?(?:folder|archive|box|file|envelope|document)|the (?:scent|smell) of old (?:paper|documents|files)|(?:faded|yellowed|brittle) (?:pages?|documents?|photographs?|clippings?) (?:spill(?:ed)?|tumbl(?:ed)?|fell?|spread))\b/gi;
  let count = 0;
  return text.replace(archiveRx, (match) => {
    count++;
    return count <= 2 ? match : '';
  });
}

// ── 7. Hard word-count truncation ──────────────────────────────────────────

function hardWordCap(text, targetWords) {
  if (!targetWords || targetWords <= 0) return text;
  const maxWords = Math.round(targetWords * 1.3);
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  const capAt = Math.round(targetWords * 1.15);
  const paragraphs = text.split(/\n\n+/);

  // Preserve the last paragraph (likely the conclusion)
  const conclusion = paragraphs[paragraphs.length - 1] || '';
  const conclusionWords = conclusion.split(/\s+/).length;
  const bodyBudget = capAt - conclusionWords;

  let accumulated = 0;
  const keptParagraphs = [];
  for (let i = 0; i < paragraphs.length - 1; i++) {
    const paraWords = paragraphs[i].split(/\s+/).length;
    if (accumulated + paraWords > bodyBudget) break;
    accumulated += paraWords;
    keptParagraphs.push(paragraphs[i]);
  }
  keptParagraphs.push(conclusion);
  return keptParagraphs.join('\n\n');
}

// ── 8. Prose model pronoun corruption fix ──────────────────────────────────

function fixPronounCorruption(text, spec) {
  if (!spec) return text;
  // Detect protagonist pronouns from project spec (fixes pronoun corruption from prose model)
  const pov = (spec.pov_mode || '').toLowerCase();
  const chars = (spec.characters_md || '').toLowerCase();
  // Determine if protagonist uses she/her
  let protagonistPronouns = null;
  if (pov.includes('she') || /\bshe\/her\b/.test(chars) || /protagonist.*?\bshe\b/.test(chars) || /\bheroine\b/.test(chars)) {
    protagonistPronouns = 'she';
  } else if (/\bhe\/him\b/.test(chars) || /protagonist.*?\bhe\b/.test(chars)) {
    protagonistPronouns = 'he';
  }
  // Also check pov_mode for gendered hints
  if (!protagonistPronouns && /\bshe\b/.test(pov)) protagonistPronouns = 'she';
  if (!protagonistPronouns && /\bhe\b/.test(pov)) protagonistPronouns = 'he';

  // Also check the explicit protagonist_pronouns field
  if (!protagonistPronouns && spec.protagonist_pronouns) {
    if (/she/i.test(spec.protagonist_pronouns)) protagonistPronouns = 'she';
    else if (/he/i.test(spec.protagonist_pronouns)) protagonistPronouns = 'he';
  }

  if (!protagonistPronouns) return text;

  const pronoun = protagonistPronouns; // 'she' or 'he'
  const before = text;

  // Only replace "they" when followed by a clearly singular verb form
  // Use word boundary assertions to avoid partial matches
  // SAFETY: only run on text OUTSIDE of dialogue quotes to avoid corrupting speech
  const singularVerbs = 'was|has|does|doesn\'t|didn\'t|wasn\'t|couldn\'t|wouldn\'t|shouldn\'t|hadn\'t';
  const rx = new RegExp('\\bthey (' + singularVerbs + ')\\b', 'gi');
  text = text.replace(rx, pronoun + ' $1');

  // Replace contractions: they's → she's, they'd → she'd, they'll → she'll
  text = text.replace(/\bthey ('s|'d|'ll)\b/gi, pronoun + '$1');

  // SAFETY CHECK: if the replacement made text worse (repetitive corruption), revert
  const theyTheyCount = (text.match(/they they/gi) || []).length;
  const theTheCount = (text.match(/the the/gi) || []).length;
  if (theyTheyCount > 5 || theTheCount > 5) {
    console.warn('[PRONOUN FIX] Corruption detected after pronoun replacement (' + theyTheyCount + ' "they they", ' + theTheCount + ' "the the"). Reverting.');
    return before;
  }

  return text;
}

// ── 9. Whitespace normalization ────────────────────────────────────────────

function normalizeWhitespace(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')       // collapse triple+ newlines
    .replace(/[ \t]+$/gm, '')          // trailing spaces
    .replace(/^\n+/, '')               // leading newlines
    .replace(/\n+$/, '')               // trailing newlines
    .trim();
}

// ── 10. Nonfiction composite character detection ───────────────────────────

// Common proper-noun pairs that are NOT character names
const NON_NAME_PROPER_NOUNS = new Set([
  'United States', 'New York', 'Los Angeles', 'San Francisco', 'San Diego',
  'Las Vegas', 'New Orleans', 'San Antonio', 'Santa Monica', 'Beverly Hills',
  'Palm Springs', 'Long Beach', 'Santa Barbara', 'Pacific Coast', 'Atlantic City',
  'World War', 'Cold War', 'Great Depression', 'Supreme Court', 'White House',
  'Wall Street', 'Capitol Hill', 'Central Park', 'Motion Picture', 'Academy Awards',
  'Golden Globe', 'Screen Actors', 'Screen Guild', 'Warner Bros', 'Metro Goldwyn',
  'Twentieth Century', 'Chapter One', 'Chapter Two', 'Chapter Three',
  'North America', 'South America', 'East Coast', 'West Coast',
  'North Hollywood', 'South Beach', 'East Side', 'West Side',
]);

function extractKnownNames(project, chapter) {
  const names = new Set();

  // 1. From research_data.key_figures
  let research = project.research_data;
  if (typeof research === 'string') {
    try { research = JSON.parse(research); } catch { research = null; }
  }
  if (research?.key_figures) {
    for (const fig of research.key_figures) {
      if (fig.name) names.add(fig.name.trim());
    }
  }
  // Also extract names mentioned in key_events, institutions, competing_narratives
  if (research?.key_events) {
    for (const ev of research.key_events) {
      const found = (ev.description || '').match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
      found.forEach(n => names.add(n));
    }
  }
  if (research?.institutions) {
    for (const inst of research.institutions) {
      if (inst.name) names.add(inst.name.trim());
    }
  }
  if (research?.competing_narratives) {
    for (const cn of research.competing_narratives) {
      const found = ((cn.official_story || '') + ' ' + (cn.evidence_counter || '') + ' ' + (cn.key_evidence || ''))
        .match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
      found.forEach(n => names.add(n));
    }
  }

  // 2. From characters_md (story bible)
  if (project.characters_md) {
    const charNames = project.characters_md.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    charNames.forEach(n => names.add(n));
  }

  // 3. From chapter beat sheet
  if (chapter?.beat_summary) {
    const beatNames = chapter.beat_summary.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    beatNames.forEach(n => names.add(n));
  }
  if (chapter?.scene_beats_json) {
    const beatsStr = typeof chapter.scene_beats_json === 'string' ? chapter.scene_beats_json : JSON.stringify(chapter.scene_beats_json);
    const beatNames = beatsStr.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    beatNames.forEach(n => names.add(n));
  }

  // 4. From world_md, outline_md, canon_md (project-level known names)
  for (const field of ['world_md', 'outline_md', 'canon_md', 'mystery_md']) {
    if (project[field]) {
      const fieldNames = project[field].match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
      fieldNames.forEach(n => names.add(n));
    }
  }

  return names;
}

/**
 * Scan nonfiction prose for unlabeled composite/fictional characters.
 * Returns the list of unknown names for logging/review purposes.
 * Does NOT inject inline disclaimers — the disclaimer belongs once in
 * the front matter (Author's Note), not repeated in every chapter.
 *
 * @param {string} text - Generated prose
 * @param {object} project - NovelProject record
 * @param {object} chapter - Chapter record
 * @returns {{ text: string, compositeNames: string[] }}
 */
export function labelCompositeCharacters(text, project, chapter) {
  if (!text || project?.book_type !== 'nonfiction') return { text, compositeNames: [] };

  const knownNames = extractKnownNames(project, chapter);
  const proseNames = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
  const uniqueProseNames = [...new Set(proseNames)];

  const unknownNames = uniqueProseNames.filter(name => {
    if (NON_NAME_PROPER_NOUNS.has(name)) return false;
    for (const known of knownNames) {
      if (name.includes(known) || known.includes(name)) return false;
    }
    return true;
  });

  if (unknownNames.length > 0) {
    console.log('[NF] Possible composite names detected (not in known sources): ' + unknownNames.join(', '));
  }

  // Return text UNMODIFIED — no inline disclaimers. The composite methodology
  // disclaimer belongs in the book's front matter copyright page, not inline.
  return { text, compositeNames: unknownNames };
}

// ── 11. Unverified statistic flagging (nonfiction) ────────────────────

/**
 * Scan nonfiction prose for statistical claims not confirmed by research data.
 * Inserts [VERIFY: ...] flags that are visible in the editor/review but stripped on export.
 *
 * @param {string} text - Generated prose
 * @param {object} project - NovelProject record (needs research_data)
 * @returns {{ text: string, statFlags: string[] }}
 */
export function flagUnverifiedStats(text, project) {
  if (!text) return { text, statFlags: [] };
  const statFlags = [];

  // Parse research data for cross-checking
  let research = project?.research_data;
  if (typeof research === 'string') {
    try { research = JSON.parse(research); } catch { research = null; }
  }
  const researchStr = research ? JSON.stringify(research) : '';

  const VERIFY_TAG = ' [VERIFY: This statistic requires source confirmation.]';

  // Find sentences with specific percentages
  const statClaims = text.match(/\b\d{1,3}(\.\d+)?%\s+of\b[^.]*\./g) || [];
  // Find sentences with "over N people/members/etc."
  const numberClaims = text.match(/\bover\s+\d[\d,]+\s+(?:people|members|actors|actresses|women|men|performers|employees|workers|victims|survivors|cases|complaints|reports|incidents)\b[^.]*\./gi) || [];
  const allClaims = [...new Set([...statClaims, ...numberClaims])];

  let result = text;
  for (const claim of allClaims) {
    // Extract the core number from the claim
    const numMatch = claim.match(/\d+%|\d[\d,]+/);
    const coreNumber = numMatch ? numMatch[0] : null;

    // Check if this number appears anywhere in research data
    const inResearch = coreNumber && researchStr.includes(coreNumber);
    if (!inResearch) {
      // Only flag if not already flagged
      if (!result.includes(claim + VERIFY_TAG)) {
        result = result.replace(claim, claim + VERIFY_TAG);
        statFlags.push('Flagged unverified statistic: ' + claim.slice(0, 80));
      }
    }
  }

  if (statFlags.length > 0) {
    console.log('NF unverified stats flagged: ' + statFlags.length);
  }

  return { text: result, statFlags };
}

// ── 12. FOIA anachronism detection (nonfiction) ────────────────────────────

/**
 * Scan nonfiction prose for FOIA references paired with pre-1967 dates.
 * FOIA was enacted in 1967 — any claim of FOIA access for earlier documents
 * is anachronistic and gets replaced with generic archival sourcing.
 *
 * @param {string} text - Generated prose
 * @returns {{ text: string, foiaFixes: string[] }}
 */
export function fixFoiaAnachronisms(text) {
  if (!text) return { text, foiaFixes: [] };
  const foiaFixes = [];

  // Match FOIA-referencing sentences
  const foiaRx = /(?:obtained|acquired|released|accessed|uncovered|discovered)\s+(?:through|via|under|by)\s+(?:the\s+)?(?:Freedom of Information|FOIA|FOI)\b[^.]*\./gi;
  let result = text;
  const foiaRefs = text.match(foiaRx) || [];

  for (const ref of foiaRefs) {
    // Check if the sentence references a year before 1967
    const yearMatch = ref.match(/\b(19[0-5]\d|196[0-6])\b/);
    if (yearMatch) {
      let fixed = ref
        .replace(/obtained\s+through\s+(?:the\s+)?Freedom of Information Act\s+requests?/gi, 'uncovered in institutional archives')
        .replace(/obtained\s+through\s+(?:the\s+)?(?:Freedom of Information|FOIA|FOI)\s+(?:Act\s+)?requests?/gi, 'uncovered in institutional archives')
        .replace(/obtained\s+through\s+(?:the\s+)?(?:Freedom of Information|FOIA|FOI)/gi, 'uncovered in institutional archives')
        .replace(/(?:acquired|released|accessed|uncovered|discovered)\s+(?:through|via|under|by)\s+(?:the\s+)?(?:Freedom of Information|FOIA|FOI)\s+(?:Act\s+)?requests?/gi, 'found in archival collections')
        .replace(/(?:acquired|released|accessed|uncovered|discovered)\s+(?:through|via|under|by)\s+(?:the\s+)?(?:Freedom of Information|FOIA|FOI)\s+(?:Act)?/gi, 'obtained from archival collections')
        .replace(/\bFOIA\s+request(?:s)?\b/gi, 'archival research')
        .replace(/\bFreedom of Information Act\b/gi, 'archival records');
      if (fixed !== ref) {
        result = result.replace(ref, fixed);
        foiaFixes.push(`Fixed FOIA anachronism: ${yearMatch[0]} predates FOIA (1967)`);
      }
    }
  }

  // Broader sweep: standalone FOIA mentions near pre-1967 years (within same paragraph)
  const paragraphs = result.split(/\n\n+/);
  const rebuiltParagraphs = paragraphs.map(para => {
    const hasPreFoiaYear = /\b(19[0-5]\d|196[0-6])\b/.test(para);
    const hasFoiaRef = /\b(?:FOIA|Freedom of Information Act)\b/i.test(para);
    if (hasPreFoiaYear && hasFoiaRef) {
      const yearMatch = para.match(/\b(19[0-5]\d|196[0-6])\b/);
      let fixed = para
        .replace(/\bFOIA\s+records?\b/gi, 'archival records')
        .replace(/\bFOIA\s+documents?\b/gi, 'archival documents')
        .replace(/\bFOIA\s+files?\b/gi, 'archival files')
        .replace(/\bFreedom of Information Act\s+records?\b/gi, 'archival records')
        .replace(/\bFreedom of Information Act\s+documents?\b/gi, 'archival documents');
      if (fixed !== para) {
        foiaFixes.push(`Fixed FOIA reference in paragraph mentioning ${yearMatch[1]} (pre-1967)`);
      }
      return fixed;
    }
    return para;
  });

  return { text: rebuiltParagraphs.join('\n\n'), foiaFixes };
}

// ── PROTAGONIST PRONOUN DETECTION ───────────────────────────────────────────

/**
 * Extract protagonist pronouns from project spec.
 * Returns 'she', 'he', 'they', or null.
 */
export function detectProtagonistPronouns(project) {
  if (!project) return null;
  const pov = (project.pov_mode || '').toLowerCase();
  const chars = (project.characters_md || '').toLowerCase();

  if (pov.includes('she') || /\bshe\/her\b/.test(chars) || /protagonist.*?\bshe\b/.test(chars) || /\bheroine\b/.test(chars)) return 'she';
  if (pov.includes('he') || /\bhe\/him\b/.test(chars) || /protagonist.*?\bhe\b/.test(chars)) return 'he';
  if (/\bshe\b/.test(pov)) return 'she';
  if (/\bhe\b/.test(pov)) return 'he';
  return null;
}

// ── DELETED: cleanGeneratedProseCodeLevel ───────────────────────────────────
// This function has been replaced by the Critic Agent (functions/criticAgent.js)
// which uses Gemini Flash for LLM-based cleanup instead of regex.

// ── MAIN PIPELINE ──────────────────────────────────────────────────────────

/**
 * Run the full post-generation cleaning pipeline.
 * @param {string} text - Raw model output
 * @param {object} opts
 * @param {number} opts.targetWords - Chapter word target (for hard cap)
 * @param {number} opts.maxWordRepeat - Max repetitions of any non-trivial word per chapter (default 6)
 * @param {object} opts.spec - Project spec for pronoun detection
 * @returns {{ text: string, overusedWords: Array, frequencyWarnings: string[], removals: string[] }}
 */
export function postClean(text = '', { targetWords = 0, maxWordRepeat = 6, spec = null } = {}) {
  const removals = [];
  const frequencyWarnings = [];
  const before = text;

  // Phase 1: Formatting artifacts
  let cleaned = stripMarkdownHeaders(text);
  cleaned = stripBoldMarkers(cleaned);
  cleaned = stripItalicMarkers(cleaned);
  cleaned = stripSceneLabels(cleaned);
  cleaned = stripDiffArtifacts(cleaned);
  cleaned = stripOrphanedFormatting(cleaned);

  // Phase 2: Instruction leaks + assistant framing
  cleaned = stripInstructionLeaks(cleaned);
  cleaned = stripAssistantFraming(cleaned);
  cleaned = stripChapterHeadings(cleaned);

  // Phase 3: Scaffolding, recap, transitions
  cleaned = stripScaffolding(cleaned);
  cleaned = stripRecapBloat(cleaned);
  cleaned = stripTransitionCrutches(cleaned);

  // Phase 3b: Code-level slop enforcement — delete banned sentences, cap AI adjectives
  cleaned = deleteBannedSentences(cleaned);
  cleaned = capAiAdjectives(cleaned);
  // REMOVED: capCharacterNames() — conflicts with Critic Agent Rule 2.
  // The Critic Agent handles name saturation contextually via LLM.
  // Regex-based name replacement inserts "they" which causes pronoun confusion.

  // Phase 4: Duplicate removal
  cleaned = removeExactDuplicateLines(cleaned);
  cleaned = removeNearDuplicateParagraphs(cleaned);
  cleaned = removeDuplicateSentencesInParagraphs(cleaned);

  // Phase 5: Frequency caps
  cleaned = capConsiderPhrases(cleaned);
  cleaned = capYouMightPhrases(cleaned);
  cleaned = capThesisRestatements(cleaned);

  // Phase 6: Scene caps
  cleaned = capCoffeeScenes(cleaned);
  cleaned = capArchiveFraming(cleaned);

  // Phase 7: Hard word-count cap
  cleaned = hardWordCap(cleaned, targetWords);

  // Phase 8: MiMo pronoun corruption fix
  cleaned = fixPronounCorruption(cleaned, spec);

  // Phase 9: Normalize whitespace
  cleaned = normalizeWhitespace(cleaned);

  // Track what changed
  if (before.length !== cleaned.length) {
    const wordsBefore = before.split(/\s+/).length;
    const wordsAfter = cleaned.split(/\s+/).length;
    if (wordsBefore !== wordsAfter) {
      removals.push(`Post-clean: ${wordsBefore} → ${wordsAfter} words (${wordsBefore - wordsAfter} removed)`);
    }
  }

  // Word repetition audit (carried over from old cleanGeneratedProse)
  const STOP_WORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','is','was','are','were','be','been','being','have','has','had',
    'do','does','did','will','would','shall','should','may','might','can',
    'could','not','no','so','if','then','than','that','this','it','i','he',
    'she','they','we','you','me','him','her','them','us','my','his','her',
    'its','our','your','their','who','what','which','when','where','how',
    'all','each','every','both','few','more','most','other','some','such',
    'into','up','out','over','down','back','just','about','only','very',
    'also','still','even','now','here','there','again','once','never',
    'said','says','like','as',
  ]);

  const words = cleaned.toLowerCase().match(/[a-z]+/g) || [];
  const freq = {};
  words.forEach((w) => {
    if (w.length > 3 && !STOP_WORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });
  const overusedWords = Object.entries(freq)
    .filter(([, count]) => count > maxWordRepeat)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));

  // Generate frequency warnings for author review (not auto-replaced)
  overusedWords.forEach(({ word, count }) => {
    frequencyWarnings.push(`Frequency warning: '${word}' appears ${count}x in chapter (cap: ${maxWordRepeat})`);
  });

  return { text: cleaned, overusedWords, frequencyWarnings, removals };
}