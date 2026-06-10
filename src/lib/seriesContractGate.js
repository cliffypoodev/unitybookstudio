/**
 * Series Contract Gate
 *
 * Validates generated or exported text against series/volume contracts.
 * All checks are text-pattern-based (no LLM calls required).
 *
 * Severity levels:
 *   BLOCK   — hard violation, should not be published / needs immediate fix
 *   WARNING — soft violation, may be intentional but should be reviewed
 *   INFO    — advisory, opportunity or suggestion
 *
 * Wire into:
 *   - sequel generation setup
 *   - Draft All for linked volumes
 *   - Rewrite for linked volumes
 *   - Polish for linked volumes
 *   - Export safety report for linked volumes
 *
 * Results stored at:
 *   - window.__UBS_LAST_SERIES_CONTRACT_REPORT
 *   - window.__UBS_LAST_EXPORT_SERIES_REPORT
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function safeParseJson(str) {
  if (!str) return null;
  if (Array.isArray(str)) return str;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return null; }
}

/** Escape a name for use in a RegExp. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a word-boundary regex for a name, including common variations.
 * E.g., "Marcus" also matches possessive "Marcus's" and "Marcus'".
 */
function nameRegex(name) {
  if (!name || typeof name !== 'string') return null;
  const cleaned = name.trim();
  if (cleaned.length < 2) return null;
  const escaped = escapeRegex(cleaned);
  return new RegExp(`\\b${escaped}(?:'s?)?\\b`, 'gi');
}

/** Check if a name appears in text. */
function nameAppearsInText(name, text) {
  const re = nameRegex(name);
  if (!re) return false;
  return re.test(text);
}

/** Count occurrences of a name in text. */
function nameCountInText(name, text) {
  const re = nameRegex(name);
  if (!re) return 0;
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/**
 * Check if a name appears in a context that suggests they are alive/active
 * (speaking, acting, present in the current narrative timeline) rather than
 * in a non-active context (memory, flashback, dream, letter, historical
 * discussion, hallucination, legend, quoted document, etc.).
 *
 * Design principle: err on the side of ALLOWING legitimate narrative contexts.
 * Only BLOCK when the character clearly participates in the current timeline
 * with no contextual framing that explains their presence.
 */
function nameAppearsAsActive(name, text) {
  if (!nameAppearsInText(name, text)) return false;
  const re = nameRegex(name);
  if (!re) return false;

  // ── Context markers ──────────────────────────────────────────────────
  // If ANY of these appear in the same paragraph as the dead character,
  // the paragraph is treated as non-active (memory/flashback/etc.)
  // regardless of whether active verbs or dialogue are present.
  const contextMarkers = [
    // Memory / remembrance
    'remembered', 'remembering', 'memory', 'memories', 'recalled',
    'recalling', 'reminisced', 'reminiscing', 'reminiscence',
    // Flashback / past-tense framing
    'flashback', 'years earlier', 'years before', 'years ago',
    'months earlier', 'months before', 'months ago',
    'weeks earlier', 'weeks before', 'days earlier', 'days before',
    'long ago', 'long before', 'once upon a time', 'back then',
    'back when', 'in those days', 'that day when', 'the day when',
    'before the war', 'before everything', 'before it all',
    'once said', 'had once', 'had always', 'had been',
    'had said', 'had told', 'had warned', 'had promised',
    'had written', 'had whispered', 'used to',
    // Dream / vision
    'dream', 'dreamed', 'dreaming', 'dreamt', 'nightmare',
    'in the dream', 'in her dream', 'in his dream',
    'vision', 'appeared to her', 'appeared to him',
    'sleep', 'sleeping', 'half-asleep', 'woke from', 'woke up',
    // Hallucination / imagination
    'hallucination', 'hallucinated', 'hallucinating',
    'imagined', 'imagining', 'imagination',
    'thought she saw', 'thought he saw', 'thought they saw',
    'could have sworn', 'impossible second', 'trick of the light',
    'mirage', 'phantom', 'apparition', 'specter', 'spectre',
    // Ghost / supernatural visitation (non-resurrection)
    'ghost of', 'ghost', 'spirit of', 'shade of',
    'haunted by', 'haunting', 'from beyond',
    // Letters / documents / records
    'letter', 'the letter', 'had written', 'was written',
    'letter began', 'letter read', 'letter said',
    'document', 'report', 'police report', 'medical report',
    'journal entry', 'diary entry', 'diary', 'journal',
    'manuscript', 'testament', 'last will',
    'the note', 'note read', 'note said',
    'telegram', 'message read', 'message said',
    // Quoted speech / secondhand account
    'according to', 'they said that', 'she said that', 'he said that',
    'as .* once said', 'as .* put it', 'to quote',
    'the story goes', 'legend has', 'legend says',
    'rumor', 'rumour', 'rumored', 'rumoured',
    // Death / memorial context
    'in honor of', 'in honour of', 'in memory of', 'memorial',
    'tombstone', 'grave of', 'graveside', 'graveyard', 'cemetery',
    'epitaph', 'legacy of', 'late ', 'the late ',
    'the fallen ', 'departed ', 'the departed',
    'funeral', 'eulogy', 'obituary', 'mourning',
    // Photos / art / artifacts of the dead
    'photograph of', 'portrait of', 'painting of', 'photo of',
    'picture of', 'statue of', 'image of',
    // Historical / expository
    'history', 'historical', 'historian',
    'chronicle', 'chronicles', 'annals',
    'before his death', 'before her death', 'before their death',
    'prior to', 'in the past', 'in the old days',
    'it was said', 'people said', 'they say',
  ];

  // ── Active present-timeline signals ──────────────────────────────────
  // These suggest the character is physically present and participating
  // in the current narrative timeline.
  const presentTimelineVerbs = [
    'said', 'says', 'asked', 'asks', 'replied', 'replies',
    'shouted', 'shouts', 'whispered', 'whispers',
    'walked', 'walks', 'ran', 'runs', 'stepped', 'steps',
    'grabbed', 'grabs', 'pulled', 'pulls', 'pushed', 'pushes',
    'looked', 'looks', 'stared', 'stares', 'glanced', 'glances',
    'nodded', 'nods', 'smiled', 'smiles', 'frowned', 'frowns',
    'sighed', 'sighs', 'stood', 'stands', 'sat', 'sits',
    'turned', 'turns', 'moved', 'moves', 'laughed', 'laughs',
  ];

  // Split text into paragraphs and check each mention
  const paragraphs = text.split(/\n\n+/);
  let activeCount = 0;
  let contextCount = 0;

  for (const para of paragraphs) {
    if (!re.test(para)) continue;
    re.lastIndex = 0; // reset

    const lowerPara = para.toLowerCase();

    // Check for ANY context marker — if found, this paragraph is non-active
    const hasContextMarker = contextMarkers.some(m => lowerPara.includes(m));

    if (hasContextMarker) {
      contextCount++;
      continue; // This paragraph has narrative framing → skip it
    }

    // No context marker found — check if character is actively participating
    const hasActiveVerb = presentTimelineVerbs.some(v => {
      // Check that the verb appears near enough to the character name
      // to suggest they are the one acting (within the same paragraph is sufficient)
      return lowerPara.includes(v);
    });

    // Check for dialogue attribution near the name
    const dialogueRe = new RegExp(`[""\u201c\u201d].*[""\u201c\u201d]\\s*,?\\s*${escapeRegex(name)}`, 'i');
    const nameDialogueRe = new RegExp(`${escapeRegex(name)}\\s+(?:said|asked|replied|shouted|whispered)`, 'i');
    const hasDialogue = dialogueRe.test(para) || nameDialogueRe.test(para);

    if (hasActiveVerb || hasDialogue) {
      activeCount++;
    }
  }

  return activeCount > 0;
}

// ── Detection Functions ────────────────────────────────────────────────────

/**
 * Detect dead characters who appear alive in the text.
 * Severity: BLOCK
 *
 * @param {string} text - Generated/exported prose
 * @param {object} seriesBible - SeriesBible record
 * @returns {Array<{severity: string, category: string, description: string, character: string}>}
 */
export function detectDeadCharacterResurrection(text, seriesBible) {
  if (!text || !seriesBible) return [];
  const results = [];

  // Source 1: deaths_and_losses field
  const deaths = safeParseJson(seriesBible.deaths_and_losses) || [];
  for (const death of deaths) {
    const deathStr = typeof death === 'string' ? death : (death.description || death.name || JSON.stringify(death));

    // Extract character name from death entry
    // Common formats: "Character Name died when..." or "Character Name — killed by..."
    const nameMatch = deathStr.match(/^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)*)/);
    if (!nameMatch) continue;
    const charName = nameMatch[1].trim();
    if (charName.length < 2) continue;

    if (nameAppearsAsActive(charName, text)) {
      results.push({
        severity: 'BLOCK',
        category: 'dead_character_resurrection',
        description: `Dead character "${charName}" appears alive/active in the text. Death record: "${deathStr.substring(0, 120)}"`,
        character: charName,
      });
    }
  }

  // Source 2: characters_json with status_at_end === 'dead'
  const characters = safeParseJson(seriesBible.characters_json) || [];
  for (const char of characters) {
    if (!char || !char.name) continue;
    if (char.status_at_end !== 'dead') continue;

    // Skip if already caught by deaths_and_losses
    if (results.some(r => r.character.toLowerCase() === char.name.toLowerCase())) continue;

    if (nameAppearsAsActive(char.name, text)) {
      results.push({
        severity: 'BLOCK',
        category: 'dead_character_resurrection',
        description: `Character "${char.name}" has status_at_end="dead" but appears alive/active in the text.`,
        character: char.name,
      });
    }
  }

  return results;
}

/**
 * Detect resolved threads being reopened as active conflict.
 * Severity: BLOCK (direct reopening) or WARNING (ambiguous reference)
 *
 * @param {string} text - Generated/exported prose
 * @param {object} seriesBible - SeriesBible record
 * @returns {Array<{severity: string, category: string, description: string, thread: string}>}
 */
export function detectResolvedThreadReopened(text, seriesBible) {
  if (!text || !seriesBible) return [];
  const results = [];

  const resolvedThreads = safeParseJson(seriesBible.resolved_threads) || [];
  const lowerText = text.toLowerCase();

  // Context markers that indicate reflective/historical reference (NOT reopening)
  const reflectiveMarkers = [
    'remembered', 'recalled', 'reflected', 'thought back', 'looked back',
    'had solved', 'had resolved', 'had discovered', 'had learned', 'had proven',
    'years ago', 'years earlier', 'months ago', 'long ago', 'back then',
    'back when', 'in those days', 'case closed', 'matter settled',
    'everyone knew', 'it was known', 'it turned out', 'as we learned',
    'the truth was', 'the answer had been', 'they had found',
    'news report', 'newspaper', 'article', 'headline',
    'history', 'historical', 'chronicle', 'in the past',
  ];

  for (const thread of resolvedThreads) {
    const threadStr = typeof thread === 'string' ? thread : (thread.thread || thread.description || JSON.stringify(thread));
    if (!threadStr || threadStr.length < 5) continue;

    // Extract key phrases from the thread (3+ word sequences)
    const words = threadStr.split(/\s+/).filter(w => w.length > 3);
    if (words.length < 2) continue;

    // Build search phrases from consecutive significant words
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + Math.min(3, words.length - i)).join(' ').toLowerCase();
      if (phrase.length > 8) phrases.push(phrase);
    }

    let matchCount = 0;
    const matchingParagraphs = [];

    // Search paragraph by paragraph for thread phrase matches
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      const lowerPara = para.toLowerCase();
      let paraMatches = 0;
      for (const phrase of phrases) {
        if (lowerPara.includes(phrase)) paraMatches++;
      }
      if (paraMatches > 0) {
        matchCount += paraMatches;
        matchingParagraphs.push(lowerPara);
      }
    }

    // Active conflict indicators — only checked in paragraphs that reference the thread
    const conflictMarkers = [
      'must stop', 'threatens', 'looming', 'unresolved',
      'once again', 'resurfaced', 'reopened', 'not over',
      'hasn\'t ended', 'far from over', 'back to haunt',
      'who really', 'the real culprit', 'was wrong about',
      'we were wrong', 'lied about', 'covered up',
    ];

    if (matchCount >= 2) {
      // Check if matching paragraphs contain reflective context
      const hasReflectiveContext = matchingParagraphs.some(p =>
        reflectiveMarkers.some(m => p.includes(m))
      );

      // Check if matching paragraphs contain active conflict language
      const hasConflictLanguage = matchingParagraphs.some(p =>
        conflictMarkers.some(m => p.includes(m))
      );

      if (hasConflictLanguage && !hasReflectiveContext) {
        results.push({
          severity: 'BLOCK',
          category: 'resolved_thread_reopened',
          description: `Resolved thread appears to be reopened as active conflict: "${threadStr.substring(0, 120)}"`,
          thread: threadStr,
        });
      } else {
        results.push({
          severity: 'WARNING',
          category: 'resolved_thread_referenced',
          description: `Resolved thread is referenced (may be intentional callback): "${threadStr.substring(0, 120)}"`,
          thread: threadStr,
        });
      }
    }
  }

  return results;
}

/**
 * Detect world rule contradictions.
 * Severity: BLOCK (direct contradiction) or WARNING (ambiguous)
 *
 * @param {string} text - Generated/exported prose
 * @param {object} seriesBible - SeriesBible record
 * @returns {Array<{severity: string, category: string, description: string, rule: string}>}
 */
export function detectWorldRuleContradictions(text, seriesBible) {
  if (!text || !seriesBible) return [];
  const results = [];

  if (!seriesBible.rules_and_systems) return results;

  // Extract rule-like statements from rules_and_systems
  const rulesText = seriesBible.rules_and_systems;
  const ruleLines = rulesText.split(/\n+/).filter(l => l.trim().length > 10);

  const negationPatterns = [
    /\bcannot\b/i, /\bimpossible\b/i, /\bnever\b/i, /\bno one can\b/i,
    /\bforbidden\b/i, /\bcannot be\b/i, /\bdoes not exist\b/i,
    /\bonly (?:one|the) .{3,30} can\b/i,
  ];

  const lowerText = text.toLowerCase();

  for (const rule of ruleLines) {
    const lowerRule = rule.toLowerCase().replace(/^[-*•]+\s*/, '');
    if (lowerRule.length < 10) continue;

    // Check for explicit "cannot" / "impossible" rules
    for (const negPattern of negationPatterns) {
      if (!negPattern.test(rule)) continue;

      // Extract what is forbidden
      const match = rule.match(/\b(?:cannot|impossible|never|forbidden|no one can)\s+(.{5,50})/i);
      if (!match) continue;

      const forbidden = match[1].toLowerCase().replace(/[.,;!?].*$/, '').trim();
      if (forbidden.length < 4) continue;

      // Check if the forbidden thing happens in the text
      if (lowerText.includes(forbidden)) {
        results.push({
          severity: 'WARNING',
          category: 'world_rule_contradiction',
          description: `World rule states "${rule.substring(0, 100)}" but the text may contradict this (found "${forbidden}").`,
          rule: rule,
        });
      }
    }
  }

  return results;
}

/**
 * Detect character status contradictions between text and volume bible.
 * Severity: BLOCK
 *
 * @param {string} text - Generated/exported prose
 * @param {object} seriesBible - SeriesBible record
 * @param {object} volumeBible - Per-volume bible (from loadVolumeBible)
 * @returns {Array<{severity: string, category: string, description: string}>}
 */
export function detectCharacterStatusContradictions(text, seriesBible, volumeBible) {
  if (!text) return [];
  const results = [];

  // Check volume bible characters_at_end
  const vbData = volumeBible?.volumeBible || volumeBible;
  const charsAtEnd = vbData?.characters_at_end || [];

  for (const char of charsAtEnd) {
    if (!char || !char.name) continue;

    if (char.status === 'dead') {
      if (nameAppearsAsActive(char.name, text)) {
        results.push({
          severity: 'BLOCK',
          category: 'character_status_contradiction',
          description: `Volume bible records "${char.name}" as dead at end of volume, but character appears active in text.`,
          character: char.name,
        });
      }
    }

    if (char.status === 'transformed') {
      // Check if character is referenced with pre-transformation identity
      // This is a WARNING since transformations can be complex
      if (nameAppearsAsActive(char.name, text) && char.arc_position) {
        const transformClues = ['transformed', 'became', 'changed into', 'no longer'];
        const lowerArc = char.arc_position.toLowerCase();
        if (transformClues.some(c => lowerArc.includes(c))) {
          results.push({
            severity: 'WARNING',
            category: 'character_status_contradiction',
            description: `"${char.name}" was transformed (${char.arc_position.substring(0, 80)}). Verify references are consistent with post-transformation state.`,
            character: char.name,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Detect violations of the entry contract (what previous volume delivered).
 * Severity: BLOCK
 *
 * @param {string} text - Generated/exported prose (should be early chapters)
 * @param {object} entryContract - Entry contract object
 * @returns {Array<{severity: string, category: string, description: string}>}
 */
export function detectEntryContractViolations(text, entryContract) {
  if (!text || !entryContract) return [];
  const results = [];

  // Characters required alive must not be treated as dead
  const reqAlive = entryContract.characters_required_alive || [];
  for (const name of reqAlive) {
    if (!name || typeof name !== 'string') continue;
    // Check if the text says they are dead
    const deathPhrases = [
      `${name} was dead`, `${name} had died`, `${name} died`,
      `death of ${name}`, `killed ${name}`, `${name}'s death`,
      `${name}'s grave`, `${name}'s tombstone`,
    ];
    const lowerText = text.toLowerCase();
    const lowerName = name.toLowerCase();
    for (const phrase of deathPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        results.push({
          severity: 'BLOCK',
          category: 'entry_contract_violation',
          description: `Entry contract requires "${name}" to be alive, but text indicates they are dead ("${phrase}").`,
        });
        break;
      }
    }
  }

  // Characters required dead must not appear alive
  const reqDead = entryContract.characters_required_dead || [];
  for (const name of reqDead) {
    if (!name || typeof name !== 'string') continue;
    if (nameAppearsAsActive(name, text)) {
      results.push({
        severity: 'BLOCK',
        category: 'entry_contract_violation',
        description: `Entry contract requires "${name}" to be dead, but character appears alive/active in text.`,
      });
    }
  }

  // Threads that must be open should be referenced
  const reqOpenThreads = entryContract.threads_that_must_be_open || [];
  if (reqOpenThreads.length > 0 && text.length > 10000) {
    // Only check in longer texts (full manuscripts) — early chapters may not mention all threads
    for (const thread of reqOpenThreads) {
      if (!thread || typeof thread !== 'string') continue;
      const keywords = thread.split(/\s+/).filter(w => w.length > 4);
      const lowerText = text.toLowerCase();
      const found = keywords.some(kw => lowerText.includes(kw.toLowerCase()));
      if (!found) {
        results.push({
          severity: 'WARNING',
          category: 'entry_contract_gap',
          description: `Entry contract thread not referenced in text: "${thread.substring(0, 100)}". May be picked up later.`,
        });
      }
    }
  }

  // World facts assumed
  const worldFacts = entryContract.world_facts_assumed || [];
  // These are harder to validate without LLM — just flag if key nouns are contradicted
  // Leaving as INFO for now
  if (worldFacts.length > 0) {
    results.push({
      severity: 'INFO',
      category: 'entry_contract_world_facts',
      description: `Entry contract assumes ${worldFacts.length} world fact(s). Manual review recommended: ${worldFacts.slice(0, 3).join('; ').substring(0, 150)}`,
    });
  }

  return results;
}

/**
 * Detect violations of the exit contract (what next volume expects).
 * Should be run on final chapters or full export.
 * Severity: BLOCK
 *
 * @param {string} text - Generated/exported prose (should include final chapters)
 * @param {object} exitContract - Exit contract object
 * @returns {Array<{severity: string, category: string, description: string}>}
 */
export function detectExitContractViolations(text, exitContract) {
  if (!text || !exitContract) return [];
  const results = [];

  // Characters who must be alive at end
  const mustAlive = exitContract.characters_alive || [];
  const lowerText = text.toLowerCase();
  for (const name of mustAlive) {
    if (!name || typeof name !== 'string') continue;
    const deathPhrases = [
      `${name} was dead`, `${name} had died`, `${name} died`,
      `death of ${name}`, `killed ${name}`, `${name}'s death`,
    ];
    for (const phrase of deathPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        results.push({
          severity: 'BLOCK',
          category: 'exit_contract_violation',
          description: `Exit contract requires "${name}" alive at end, but text kills them ("${phrase}").`,
        });
        break;
      }
    }
  }

  // Characters who must be dead at end
  const mustDead = exitContract.characters_dead || [];
  for (const name of mustDead) {
    if (!name || typeof name !== 'string') continue;
    // If the character is never killed in the text, it's a violation
    const deathPhrases = [
      `${name} was dead`, `${name} had died`, `${name} died`,
      `death of ${name}`, `killed ${name}`, `${name} fell`,
      `${name} collapsed`, `${name}'s body`,
    ];
    const hasDeathRef = deathPhrases.some(phrase => lowerText.includes(phrase.toLowerCase()));
    if (!hasDeathRef && nameAppearsAsActive(name, text)) {
      results.push({
        severity: 'BLOCK',
        category: 'exit_contract_violation',
        description: `Exit contract requires "${name}" dead at end, but character appears alive with no death scene.`,
      });
    }
  }

  // Threads that must be open at end (should not be fully resolved)
  const mustOpenThreads = exitContract.threads_open_for_next || [];
  // Hard to validate without semantic analysis — flag as warning
  if (mustOpenThreads.length > 0) {
    results.push({
      severity: 'INFO',
      category: 'exit_contract_threads',
      description: `Exit contract requires ${mustOpenThreads.length} thread(s) open for next volume. Manual review recommended.`,
    });
  }

  // Threads that must be closed
  const mustClosed = exitContract.threads_closed || [];
  if (mustClosed.length > 0) {
    results.push({
      severity: 'INFO',
      category: 'exit_contract_closed_threads',
      description: `Exit contract requires ${mustClosed.length} thread(s) closed. Manual review recommended.`,
    });
  }

  // Cliffhangers
  const cliffhangers = exitContract.cliffhangers || [];
  if (cliffhangers.length > 0) {
    results.push({
      severity: 'INFO',
      category: 'exit_contract_cliffhangers',
      description: `Exit contract requires ${cliffhangers.length} cliffhanger(s) to deliver: ${cliffhangers.slice(0, 2).join('; ').substring(0, 120)}`,
    });
  }

  return results;
}

/**
 * Detect voice/tone drift from series baseline.
 * Severity: WARNING
 *
 * @param {string} text - Generated/exported prose
 * @param {object} seriesBible - SeriesBible record
 * @param {object} project - NovelProject record
 * @returns {Array<{severity: string, category: string, description: string}>}
 */
export function detectSeriesVoiceDrift(text, seriesBible, project) {
  if (!text || !seriesBible) return [];
  const results = [];

  // Check voice profile
  if (seriesBible.voice_profile) {
    const voiceProfile = seriesBible.voice_profile.toLowerCase();

    // Detect major POV shifts
    const povMarkers = {
      'first person': /\b(I|me|my|mine|myself)\b/g,
      'third person': /\b(he|she|they|his|her|their)\b/g,
    };

    if (voiceProfile.includes('first person')) {
      const thirdCount = (text.match(povMarkers['third person']) || []).length;
      const firstCount = (text.match(povMarkers['first person']) || []).length;
      if (thirdCount > firstCount * 3 && firstCount < 20) {
        results.push({
          severity: 'WARNING',
          category: 'series_voice_drift',
          description: `Series voice profile indicates first person, but text appears to use third person (${thirdCount} third-person vs ${firstCount} first-person markers).`,
        });
      }
    }

    if (voiceProfile.includes('third person')) {
      const firstCount = (text.match(povMarkers['first person']) || []).length;
      const thirdCount = (text.match(povMarkers['third person']) || []).length;
      if (firstCount > thirdCount * 3 && thirdCount < 20) {
        results.push({
          severity: 'WARNING',
          category: 'series_voice_drift',
          description: `Series voice profile indicates third person, but text appears to use first person (${firstCount} first-person vs ${thirdCount} third-person markers).`,
        });
      }
    }

    // Detect tense shifts
    if (voiceProfile.includes('past tense')) {
      const presentMarkers = text.match(/\b(walks|runs|says|looks|turns|stands|sits)\b/gi) || [];
      if (presentMarkers.length > 30) {
        results.push({
          severity: 'WARNING',
          category: 'series_voice_drift',
          description: `Series voice profile indicates past tense, but text has ${presentMarkers.length} present-tense markers. Possible tense drift.`,
        });
      }
    }
  }

  // Check tone drift
  if (seriesBible.tone_and_themes) {
    const tone = seriesBible.tone_and_themes.toLowerCase();

    // Broad tonal categories
    if ((tone.includes('dark') || tone.includes('grim') || tone.includes('horror')) && !tone.includes('comedy')) {
      const comedyMarkers = text.match(/\b(hilarious|comedy|slapstick|wacky|zany|punchline|joke|gag)\b/gi) || [];
      if (comedyMarkers.length > 5) {
        results.push({
          severity: 'WARNING',
          category: 'series_tone_drift',
          description: `Series tone is dark/grim but text has ${comedyMarkers.length} comedy markers. Possible tonal inconsistency.`,
        });
      }
    }
  }

  return results;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Run the full series contract gate.
 *
 * @param {string} text - Generated/exported prose
 * @param {object} project - NovelProject record (must have series_bible_id to trigger checks)
 * @param {object|null} seriesBible - SeriesBible record (or null to skip series-level checks)
 * @param {object|null} volumeBible - Volume bible data from loadVolumeBible (or null)
 * @param {object} options - { entryContract, exitContract, isExport, isFinalChapter, chapterNumber, totalChapters }
 * @returns {{results: Array, summary: {blocks: number, warnings: number, infos: number}, passed: boolean}}
 */
export function runSeriesContractGate(text, project, seriesBible, volumeBible, options = {}) {
  const allResults = [];

  // Only run if the project is linked to a series
  if (!project?.series_bible_id && !seriesBible) {
    return { results: [], summary: { blocks: 0, warnings: 0, infos: 0 }, passed: true };
  }

  // Standalone mode — skip strict continuity
  if (project?.series_flavor === 'standalone') {
    // Still check world rules and voice drift, but not thread/character obligations
    if (seriesBible) {
      allResults.push(...detectWorldRuleContradictions(text, seriesBible));
      allResults.push(...detectSeriesVoiceDrift(text, seriesBible, project));
    }
  } else {
    // Full continuity checks for 'continuation' and 'anthology_volume' modes
    if (seriesBible) {
      allResults.push(...detectDeadCharacterResurrection(text, seriesBible));
      allResults.push(...detectResolvedThreadReopened(text, seriesBible));
      allResults.push(...detectWorldRuleContradictions(text, seriesBible));
      allResults.push(...detectCharacterStatusContradictions(text, seriesBible, volumeBible));
      allResults.push(...detectSeriesVoiceDrift(text, seriesBible, project));
    }
  }

  // Entry contract checks
  if (options.entryContract) {
    allResults.push(...detectEntryContractViolations(text, options.entryContract));
  }

  // Exit contract checks — only for final chapter or export
  if (options.exitContract && (options.isFinalChapter || options.isExport)) {
    allResults.push(...detectExitContractViolations(text, options.exitContract));
  }

  const summary = {
    blocks: allResults.filter(r => r.severity === 'BLOCK').length,
    warnings: allResults.filter(r => r.severity === 'WARNING').length,
    infos: allResults.filter(r => r.severity === 'INFO').length,
  };

  const report = {
    results: allResults,
    summary,
    passed: summary.blocks === 0,
    timestamp: new Date().toISOString(),
    project_id: project?.id,
    series_bible_id: project?.series_bible_id || seriesBible?.id,
    series_flavor: project?.series_flavor,
  };

  // Store for debugging
  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SERIES_CONTRACT_REPORT = report;
    if (options.isExport) {
      window.__UBS_LAST_EXPORT_SERIES_REPORT = report;
    }
  }

  return report;
}

// ── Report Builder ─────────────────────────────────────────────────────────

/**
 * Build a human-readable report from contract gate results.
 *
 * @param {{results: Array, summary: object, passed: boolean}} report
 * @returns {string} - Markdown-formatted report
 */
export function buildSeriesContractReport(report) {
  if (!report || !report.results) return '# Series Contract Report\n\nNo results available.';

  const lines = [];
  lines.push('# Series Contract Report');
  lines.push('');
  lines.push(`**Generated:** ${report.timestamp || new Date().toISOString()}`);
  lines.push(`**Series Flavor:** ${report.series_flavor || 'unknown'}`);
  lines.push(`**Result:** ${report.passed ? '✅ PASSED' : '❌ BLOCKED'}`);
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| BLOCK | ${report.summary.blocks} |`);
  lines.push(`| WARNING | ${report.summary.warnings} |`);
  lines.push(`| INFO | ${report.summary.infos} |`);
  lines.push('');

  if (report.results.length === 0) {
    lines.push('No issues detected. Series continuity is maintained.');
  } else {
    // Group by severity
    const blocks = report.results.filter(r => r.severity === 'BLOCK');
    const warnings = report.results.filter(r => r.severity === 'WARNING');
    const infos = report.results.filter(r => r.severity === 'INFO');

    if (blocks.length > 0) {
      lines.push('## ❌ BLOCK — Must Fix');
      lines.push('');
      for (const r of blocks) {
        lines.push(`- **[${r.category}]** ${r.description}`);
      }
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push('## ⚠️ WARNING — Review Required');
      lines.push('');
      for (const r of warnings) {
        lines.push(`- **[${r.category}]** ${r.description}`);
      }
      lines.push('');
    }

    if (infos.length > 0) {
      lines.push('## ℹ️ INFO — Advisory');
      lines.push('');
      for (const r of infos) {
        lines.push(`- **[${r.category}]** ${r.description}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Staleness Detection ────────────────────────────────────────────────────

/**
 * Check if a volume bible is stale.
 *
 * @param {object} project - NovelProject record
 * @returns {{stale: boolean, reason: string|null, lastUpdated: string|null}}
 */
export function checkVolumeBibleStaleness(project) {
  if (!project) return { stale: false, reason: null, lastUpdated: null };
  if (!project.volume_bible_json) return { stale: true, reason: 'No volume bible extracted yet', lastUpdated: null };

  const bibleUpdated = project.volume_bible_updated_at;
  const projectUpdated = project.updated_date;

  if (!bibleUpdated) {
    // No timestamp — assume stale if project was updated after a reasonable window
    return { stale: true, reason: 'Volume bible has no timestamp — may be outdated', lastUpdated: null };
  }

  if (projectUpdated && new Date(projectUpdated) > new Date(bibleUpdated)) {
    return {
      stale: true,
      reason: `Project was updated (${projectUpdated}) after volume bible was extracted (${bibleUpdated})`,
      lastUpdated: bibleUpdated,
    };
  }

  return { stale: false, reason: null, lastUpdated: bibleUpdated };
}

/**
 * Compute a simple content hash for staleness comparison.
 * Uses chapter count + total word count + first/last chapter IDs as a fingerprint.
 *
 * @param {Array} chapters - Chapter records
 * @returns {string} - Hash string
 */
export function computeVolumeBibleSourceHash(chapters) {
  if (!chapters || chapters.length === 0) return 'empty';
  const sorted = [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  const totalWords = sorted.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
  const firstId = sorted[0]?.id || '?';
  const lastId = sorted[sorted.length - 1]?.id || '?';
  return `ch${sorted.length}-w${totalWords}-f${firstId}-l${lastId}`;
}
