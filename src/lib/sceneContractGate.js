import { getTrustedCharacters } from './narrativeLedger.js';

const STOPWORDS = new Set([
  'about','after','again','against','before','being','between','could','every',
  'from','have','into','just','more','must','only','other','should','their',
  'there','these','they','this','through','under','until','very','what','when',
  'where','which','while','with','would','scene','event','state','then','than',
  'that','the','and','for','was','were','are','has','had','not','but','his',
  'her','him','she','them','its','out','all','one','two','three'
]);

const TOKEN_CANON = new Map([
  ['activate', 'activate'],
  ['activated', 'activate'],
  ['activating', 'activate'],
  ['activates', 'activate'],
  ['trigger', 'activate'],
  ['triggered', 'activate'],
  ['triggering', 'activate'],
  ['triggers', 'activate'],
  ['arrive', 'arrive'],
  ['arrived', 'arrive'],
  ['arriving', 'arrive'],
  ['arrives', 'arrive'],
  ['separate', 'separate'],
  ['separated', 'separate'],
  ['separating', 'separate'],
  ['separates', 'separate'],
  ['divide', 'separate'],
  ['divided', 'separate'],
  ['dividing', 'separate'],
  ['divides', 'separate'],
  ['isolate', 'separate'],
  ['isolated', 'separate'],
  ['isolating', 'separate'],
  ['isolates', 'separate'],
  ['strand', 'separate'],
  ['stranded', 'separate'],
  ['stranding', 'separate'],
  ['cutoff', 'separate'],
  ['place', 'give'],
  ['placed', 'give'],
  ['placing', 'give'],
  ['places', 'give'],
  ['pass', 'give'],
  ['passed', 'give'],
  ['passing', 'give'],
  ['passes', 'give'],
  ['handed', 'give'],
  ['handing', 'give'],
  ['hands', 'give'],
  ['offer', 'give'],
  ['offered', 'give'],
  ['offering', 'give'],
  ['dies', 'die'],
  ['died', 'die'],
  ['dead', 'die'],
  ['death', 'die'],
  ['dying', 'die'],
  ['killed', 'die'],
  ['killing', 'die'],
  ['kills', 'die'],

  ['stabilized', 'stabilize'],
  ['stabilizing', 'stabilize'],
  ['stabilizes', 'stabilize'],

  ['forced', 'force'],
  ['forcing', 'force'],
  ['forces', 'force'],

  ['opened', 'open'],
  ['opening', 'open'],
  ['opens', 'open'],

  ['used', 'use'],
  ['using', 'use'],
  ['uses', 'use'],

  ['crushed', 'crush'],
  ['crushing', 'crush'],
  ['crushes', 'crush'],

  ['severed', 'sever'],
  ['severing', 'sever'],
  ['severs', 'sever'],

  ['lost', 'lose'],
  ['losing', 'lose'],

  ['systems', 'system'],
  ['valves', 'valve'],
  ['levers', 'lever'],
  ['doors', 'door'],
  ['archives', 'archive'],
]);

const CONTROL_TERMS = new Set([
  'system',
  'lever',
  'valve',
  'mechanism',
  'control',
  'controls',
]);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalToken(word) {
  let token = TOKEN_CANON.get(word) || word;

  if (token.endsWith('ies') && token.length > 5) {
    token = `${token.slice(0, -3)}y`;
  } else if (token.endsWith('ing') && token.length > 6) {
    token = token.slice(0, -3);
  } else if (token.endsWith('ed') && token.length > 5) {
    token = token.slice(0, -2);
  } else if (token.endsWith('es') && token.length > 5) {
    token = token.slice(0, -2);
  } else if (token.endsWith('s') && token.length > 4) {
    token = token.slice(0, -1);
  }

  if (CONTROL_TERMS.has(token)) {
    token = 'control';
  }

  return TOKEN_CANON.get(token) || token;
}

function signature(value) {
  const seen = new Set();

  return normalize(value)
    .split(' ')
    .map(canonicalToken)
    .filter((word) => {
      if (
        word.length < 3 ||
        STOPWORDS.has(word) ||
        seen.has(word)
      ) {
        return false;
      }

      seen.add(word);
      return true;
    });
}

function coverage(eventText, proseText) {
  const tokens = signature(eventText);

  if (tokens.length < 2) {
    return {
      hit: false,
      ratio: 0,
      matched: 0,
      tokens,
    };
  }

  const proseTokens = new Set(signature(proseText));
  let matched = 0;

  for (const token of tokens) {
    if (proseTokens.has(token)) {
      matched += 1;
    }
  }

  const ratio = matched / tokens.length;
  const minimumMatched =
    tokens.length >= 6
      ? 4
      : Math.min(3, tokens.length);

  return {
    hit:
      matched >= minimumMatched &&
      ratio >= 0.62,
    ratio,
    matched,
    tokens,
  };
}

const STATEFUL_EVENT_PATTERNS = [
  /\b(?:discover|find|locate|uncover|reveal|learn|realize|recognize|identify)\w*\b/i,
  /\b(?:open|unlock|seal|close|enter|exit|escape|arrive|leave|depart|return)\w*\b/i,
  /\b(?:give|hand|transfer|take|steal|drop|lose|recover|retrieve|destroy|burn|hide|bury)\w*\b/i,
  /\b(?:separate|split|abandon|follow|join|reunite)\w*\b/i,
  /\b(?:die|dead|death|kill|murder|drown|sacrifice|collapse)\w*\b/i,
  /\b(?:injure|wound|crush|sever|amputat|break|fracture|lose\s+(?:his|her|their)?\s*(?:hand|arm|leg|foot))\w*\b/i,
  /\b(?:confess|admit|betray|accuse|forgive|refuse|decide|choose|agree|promise)\w*\b/i,
  /\b(?:activate|deactivate|override|disable|enable|repair|stabilize|vent|trigger)\w*\b/i,
  /\b(?:key|weapon|document|folder|ledger|journal|evidence|body|corpse)\b.*\b(?:give|take|drop|lose|find|destroy|hide|recover)\w*\b/i,
];

const SOFT_EVENT_PATTERNS = [
  /\b(?:notice|feel|sense|smell|taste|hear|watch|look|remember|think|wonder)\w*\b/i,
  /\b(?:cold|heat|rust|metallic|dark|silence|uneasy|hopeful|suspicious|afraid|fear|tension|connection)\b/i,
  /\b(?:air|wind|light|shadow|odor|smell|sound|temperature|atmosphere)\b/i,
];

function isStatefulEvent(eventText) {
  const event = String(eventText || '').trim();
  if (!event) return false;

  const hasHardTransition = STATEFUL_EVENT_PATTERNS.some((pattern) =>
    pattern.test(event)
  );

  if (hasHardTransition) return true;

  const isSoftDescription = SOFT_EVENT_PATTERNS.some((pattern) =>
    pattern.test(event)
  );

  return !isSoftDescription && signature(event).length >= 5;
}

const NON_ENACTMENT_PATTERNS = [
  /\b(?:had|has)\s+(?:already\s+)?\w+(?:ed|en)\b/i,
  /\b(?:previously|earlier|already|before now|minutes earlier|hours earlier|days earlier)\b/i,
  /\b(?:since|after)\s+(?:they|he|she|the group|lena|marcus|vale)\b/i,
  /\b(?:remember|remembered|recall|recalled|memory|memories)\b/i,
  /\b(?:mention|mentioned|reference|referenced|describe|described)\b/i,
  /\b(?:thought of|thought about|reminded of|reminder of)\b/i,
  /\b(?:the fact that|the knowledge that|the realization that)\b/i,
  /\b(?:imagined|dreamed|planned|intended|wanted|hoped|feared|considered)\b/i,
  /\b(?:might|could|would|may|perhaps|possibly|if)\b/i,
];

const ACTIVE_EVENT_VERBS = new Set([
  'arrive',
  'leave',
  'enter',
  'exit',
  'escape',
  'return',
  'discover',
  'find',
  'locate',
  'uncover',
  'reveal',
  'learn',
  'realize',
  'recognize',
  'identify',
  'open',
  'unlock',
  'seal',
  'close',
  'give',
  'hand',
  'transfer',
  'take',
  'steal',
  'drop',
  'lose',
  'recover',
  'retrieve',
  'destroy',
  'burn',
  'hide',
  'bury',
  'separate',
  'split',
  'abandon',
  'follow',
  'join',
  'reunite',
  'die',
  'kill',
  'drown',
  'collapse',
  'injure',
  'wound',
  'crush',
  'sever',
  'amputate',
  'break',
  'fracture',
  'confess',
  'admit',
  'betray',
  'accuse',
  'forgive',
  'refuse',
  'decide',
  'choose',
  'agree',
  'promise',
  'activate',
  'deactivate',
  'override',
  'disable',
  'enable',
  'repair',
  'stabilize',
  'vent',
  'trigger',
]);

function splitIntoEventWindows(proseText) {
  const protectedText = String(proseText || '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St)\./g, '$1<ABBR>')
    .replace(/\b([A-Z])\./g, '$1<INITIAL>');

  return protectedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) =>
      part
        .replace(/<ABBR>/g, '.')
        .replace(/<INITIAL>/g, '.')
        .trim()
    )
    .filter((part) => part.length >= 20);
}

function hasActiveEventVerb(eventText, sentenceText) {
  const eventTokens = signature(eventText);
  const sentenceTokens = new Set(signature(sentenceText));

  return eventTokens.some(
    (token) =>
      ACTIVE_EVENT_VERBS.has(token) &&
      sentenceTokens.has(token)
  );
}

function isNonEnactedReference(sentenceText) {
  const sentence = String(sentenceText || '');

  return NON_ENACTMENT_PATTERNS.some((pattern) =>
    pattern.test(sentence)
  );
}

function detectEventEnactment(eventText, proseText) {
  const windows = splitIntoEventWindows(proseText);
  const matches = [];

  for (let index = 0; index < windows.length; index += 1) {
    const sentence = windows[index];
    const result = coverage(eventText, sentence);

    if (!result.hit) continue;
    if (!hasActiveEventVerb(eventText, sentence)) continue;
    if (isNonEnactedReference(sentence)) continue;

    matches.push({
      index,
      sentence,
      result,
    });
  }

  return {
    hit: matches.length > 0,
    matches,
  };
}

function paragraphHits(eventText, proseText) {
  return String(proseText || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 80)
    .map((part, index) => ({ index, result: coverage(eventText, part) }))
    .filter((entry) => entry.result.hit);
}

export function extractLimbFacts(text) {
  const source = String(text || '');
  const facts = [];
  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  let lastCharacter = null;

  const ignoredNames = new Set([
    'The',
    'Then',
    'When',
    'Where',
    'After',
    'Before',
    'Scene',
    'Chapter',
    'His',
    'Her',
    'He',
    'She',
    'They',
    'It',
  ]);

  function canonicalCharacter(sentence) {
    const possessive = sentence.match(/\b([A-Z][a-z]{2,})['’]s\b/);
    if (possessive && !ignoredNames.has(possessive[1])) {
      return possessive[1];
    }

    const direct = sentence.match(/\b([A-Z][a-z]{2,})\b/);
    if (direct && !ignoredNames.has(direct[1])) {
      return direct[1];
    }

    if (
      lastCharacter &&
      /\b(?:he|his|him|she|her|hers)\b/i.test(sentence)
    ) {
      return lastCharacter;
    }

    return null;
  }

  function addFact(character, side, sentence, kind) {
    if (!character || !side) return;

    facts.push({
      character: character.toLowerCase(),
      displayName: character,
      side: side.toLowerCase(),
      sentence,
      kind,
    });
  }

  for (const sentence of sentences) {
    const character = canonicalCharacter(sentence);

    if (
      character &&
      !/\b(?:he|his|him|she|her|hers)\b/i.test(character)
    ) {
      lastCharacter = character;
    }

    const owner = character || lastCharacter;
    if (!owner) continue;

    const patterns = [
      {
        kind: 'loss',
        regex:
          /\b(?:lost|lose|losing|severed|severing|amputated|amputation|crushed|crushing|missing|gone)\b[^.!?\n]{0,70}\b(left|right)\s+(?:forearm|arm|hand|wrist)\b/i,
      },
      {
        kind: 'loss',
        regex:
          /\b(left|right)\s+(?:forearm|arm|hand|wrist)\b[^.!?\n]{0,70}\b(?:lost|lose|losing|severed|severing|amputated|amputation|crushed|crushing|missing|gone)\b/i,
      },
      {
        kind: 'stump',
        regex:
          /\b(?:his|her|the|[A-Z][a-z]{2,}['’]s)?\s*(left|right)\s+(?:forearm|arm|hand|wrist)?\s*stump\b/i,
      },
      {
        kind: 'stump',
        regex:
          /\bstump\s+of\s+(?:his|her|the|[A-Z][a-z]{2,}['’]s)?\s*(left|right)\s+(?:forearm|arm|hand|wrist)\b/i,
      },
      {
        kind: 'empty-sleeve',
        regex:
          /\b(left|right)\s+sleeve\b[^.!?\n]{0,60}\b(?:empty|limp|pinned|hanging|flapping|unused)\b/i,
      },
      {
        kind: 'empty-sleeve',
        regex:
          /\b(?:empty|limp|pinned|hanging|flapping|unused)\b[^.!?\n]{0,60}\b(left|right)\s+sleeve\b/i,
      },
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern.regex);
      if (match) {
        addFact(owner, match[1], sentence, pattern.kind);
      }
    }
  }

  return facts;
}

function findLimbContradictions(accumulatedProse, sceneProse) {
  const prior = extractLimbFacts(accumulatedProse);
  const current = extractLimbFacts(sceneProse);
  const issues = [];

  for (const fact of current) {
    const previous = prior.find((item) => item.character === fact.character);
    if (previous && previous.side !== fact.side) {
      issues.push(
        `${fact.displayName}'s injured limb changed from ${previous.side} to ${fact.side}`
      );
    }
  }

  return issues;
}

function findInstantProsthetics(accumulatedProse, sceneProse) {
  const priorFacts = extractLimbFacts(accumulatedProse);
  if (!priorFacts.length || !/\bprosthetic\b/i.test(sceneProse)) return [];

  const normalizedScene = normalize(sceneProse);
  const issues = [];

  for (const fact of priorFacts) {
    if (
      normalizedScene.includes(fact.character) &&
      normalizedScene.includes('prosthetic')
    ) {
      issues.push(
        `${fact.displayName} received an unexplained prosthetic immediately after a fresh injury`
      );
    }
  }

  return issues;
}

export function auditSceneAgainstLedger({
  prose,
  accumulatedProse = '',
  spec = {},
  runtimeLedger = null,
} = {}) {
  const issues = [];

  const priorEvents = Array.isArray(spec?.prior_completed_events)
    ? spec.prior_completed_events.filter(Boolean)
    : [];

  // Also check ledger completed events for replays
  if (runtimeLedger && Array.isArray(runtimeLedger.completedEvents)) {
    for (const ev of runtimeLedger.completedEvents) {
      if (!priorEvents.includes(ev)) priorEvents.push(ev);
    }
  }

  const futureEvents = Array.isArray(spec?.future_reserved_events)
    ? spec.future_reserved_events.filter(Boolean)
    : [];

  const requiredEvents = Array.isArray(spec?.required_events)
    ? spec.required_events.filter(Boolean)
    : [];

  for (const event of priorEvents.filter(isStatefulEvent)) {
    const result = detectEventEnactment(event, prose);
    if (result.hit) {
      issues.push({
        code: 'PRIOR_EVENT_REPLAY',
        message: `Replayed completed event: ${event}`,
        event,
        evidence: result,
      });
    }
  }

  for (const event of futureEvents.filter(isStatefulEvent)) {
    const result = detectEventEnactment(event, prose);
    if (result.hit) {
      issues.push({
        code: 'FUTURE_EVENT_STOLEN',
        message: `Performed later-scene event too early: ${event}`,
        event,
        evidence: result,
      });
    }
  }

  for (const event of requiredEvents) {
    const hits = paragraphHits(event, prose);
    if (hits.length >= 2 && hits[hits.length - 1].index - hits[0].index >= 2) {
      issues.push({
        code: 'CURRENT_EVENT_DUPLICATED',
        message: `Repeated this scene's required event in multiple separated passages: ${event}`,
        event,
        paragraphHits: hits.map((hit) => hit.index),
      });
    }
  }

  for (const message of findLimbContradictions(accumulatedProse, prose)) {
    issues.push({
      code: 'LIMB_STATE_CONTRADICTION',
      message,
    });
  }

  for (const message of findInstantProsthetics(accumulatedProse, prose)) {
    issues.push({
      code: 'IMPOSSIBLE_PROSTHETIC',
      message,
    });
  }

  if (runtimeLedger) {
    if (Array.isArray(runtimeLedger.deadCharacters)) {
      for (const deadChar of runtimeLedger.deadCharacters) {
        // Simplistic check for dead character acting
        const deadRegex = new RegExp(`\\b${deadChar}\\b\\s+(?:said|nodded|walked|looked|sighed|smiled|shook|turned|asked|replied)\\b`, 'i');
        if (deadRegex.test(prose)) {
          issues.push({
            code: 'DEAD_CHARACTER_ACTION',
            message: `Dead character "${deadChar}" performed an action in this scene.`,
          });
        }
      }
    }

    if (Array.isArray(runtimeLedger.unavailableObjects)) {
      for (const obj of runtimeLedger.unavailableObjects) {
        // Simplistic check for unavailable object usage
        const objRegex = new RegExp(`\\b(?:used|inserted|turned|opened\\s+with|fired|wielded)\\s+(?:the\\s+)?${obj}\\b`, 'i');
        if (objRegex.test(prose)) {
          issues.push({
            code: 'UNAVAILABLE_OBJECT_USAGE',
            message: `Destroyed or unavailable object "${obj}" was used in this scene.`,
          });
        }
      }
    }
    if (Array.isArray(runtimeLedger.separatedCharacters)) {
      const trusted = getTrustedCharacters(spec, runtimeLedger);
      
      for (const sepChar of runtimeLedger.separatedCharacters) {
        const nameRegex = new RegExp(`\\b${sepChar}\\b`);
        if (nameRegex.test(prose)) {
          const sentences = prose.split(/(?<=[.!?])\s+/);
          for (const sentence of sentences) {
            if (nameRegex.test(sentence)) {
              const otherCharMatch = sentence.match(/\b([A-Z][a-z]+)\b/g);
              if (otherCharMatch) {
                // Filter out non-trusted characters and stopwords
                const others = otherCharMatch.filter(c => c !== sepChar && trusted.has(c));
                // Ensure unique
                const uniqueOthers = [...new Set(others)];
                if (uniqueOthers.length > 0) {
                  issues.push({
                    code: 'CHARACTER_SEPARATION_VIOLATION',
                    message: `${sepChar} is separated from the group but appears to interact with ${uniqueOthers.join(', ')} in the same scene without a reunion event.`,
                    severity: 'critical'
                  });
                }
              }
            }
          }
        }
      }
    }

    if (Array.isArray(runtimeLedger.droppedObjects)) {
      for (const obj of runtimeLedger.droppedObjects) {
        // If someone holds or possesses a dropped object
        const objRegex = new RegExp(`\\b([A-Z][a-z]+)\\s+(?:holds|grips|clutches|has|pulls)\\s+(?:the\\s+)?${obj}\\b`, 'i');
        const match = prose.match(objRegex);
        if (match) {
          issues.push({
            code: 'OBJECT_POSSESSION_VIOLATION',
            message: `Character "${match[1]}" holds "${obj}", but it was placed down and not retrieved.`,
          });
        }
      }
    }

    if (runtimeLedger.possessions) {
      for (const char in runtimeLedger.possessions) {
        for (const obj of runtimeLedger.possessions[char]) {
          // If someone else holds it
          const objRegex = new RegExp(`\\b([A-Z][a-z]+)\\s+(?:holds|grips|clutches|has|pulls)\\s+(?:the\\s+)?${obj}\\b`, 'i');
          const match = prose.match(objRegex);
          if (match && match[1] !== char) {
            issues.push({
              code: 'OBJECT_POSSESSION_VIOLATION',
              message: `Character "${match[1]}" holds "${obj}", but it is possessed by "${char}".`,
            });
          }
        }
      }
    }

    // "all evidence is gone" violation
    const hasExistingObjects = (runtimeLedger.droppedObjects && runtimeLedger.droppedObjects.length > 0) || (runtimeLedger.possessions && Object.keys(runtimeLedger.possessions).length > 0);
    if (hasExistingObjects && prose.match(/\b(?:all evidence is gone|no proof remains|destroyed all evidence|no evidence left)\b/i)) {
      issues.push({
        code: 'EVIDENCE_AVAILABILITY_VIOLATION',
        message: `Prose claims all evidence is gone, but objects still exist in the ledger.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    report: issues.map((issue) => issue.message).join(' | '),
  };
}

export function buildSceneContractRepairInstruction(audit) {
  const problems = Array.isArray(audit?.issues)
    ? audit.issues.map((issue, index) => `${index + 1}. ${issue.message}`).join('\n')
    : 'Unknown scene-contract violation.';

  return `HARD SCENE-CONTRACT REPAIR

The previous scene draft was rejected before assembly.

VIOLATIONS:
${problems}

Rewrite ONLY the current contracted scene from scratch.

MANDATORY:
- Do not replay any event completed in an earlier scene.
- Do not perform any event reserved for a later scene.
- Perform each current required event exactly once.
- Preserve all established injuries, deaths, locations, knowledge, possessions, and decisions.
- Do not introduce a prosthetic, recovery, resurrection, replacement object, or reversed injury unless the current contract explicitly requires it.
- Continue chronologically from the prior scene's final state.
- Return manuscript prose only.`;
}

export function auditChapterLedgerContinuity({ generatedScenes, cleanedScenes }, buildInitialLedger, extractSceneLedgerUpdates) {
  if (!Array.isArray(generatedScenes) || !Array.isArray(cleanedScenes)) {
    return;
  }

  if (cleanedScenes.length !== generatedScenes.length) {
    const error = new Error(`Cannot run final chapter-level continuity audit: segment count (${cleanedScenes.length}) does not match generated scenes (${generatedScenes.length}).`);
    error.name = 'NarrativeInvariantError';
    error.code = 'FINAL_CHAPTER_CONTINUITY_AUDIT_UNAVAILABLE';
    throw error;
  }

  let runtimeLedger = buildInitialLedger();
  let accumulatedProse = '';

  for (let i = 0; i < generatedScenes.length; i++) {
    const sceneProse = cleanedScenes[i];
    const spec = generatedScenes[i].spec;

    const audit = auditSceneAgainstLedger({
      prose: sceneProse,
      accumulatedProse,
      spec,
      runtimeLedger
    });

    if (!audit.ok) {
      const error = new Error(`Chapter rejected after final cleanup due to scene ${i+1} continuity violation: ${audit.report}`);
      error.name = 'NarrativeInvariantError';
      error.code = 'SCENE_STATE_CONTRACT_UNRESOLVED_AFTER_CLEANUP';
      error.narrativeContract = true;
      error.audit = audit;
      throw error;
    }

    runtimeLedger = extractSceneLedgerUpdates(runtimeLedger, sceneProse, spec);
    accumulatedProse = [accumulatedProse, sceneProse].filter(Boolean).join('\n\n* * *\n\n');
  }
}

export function classifyCriticFinding(finding, generatedScenes, deterministicReports) {
  const value = String(finding || '').trim();
  if (!value) return { hard: false, category: 'empty', reason: 'Empty finding' };

  const uncertain = /\b(may|might|could|possibly|perhaps|appears?|seems?|unclear|uncertain|depending on|potential(?:ly)?|suggests?)\b/i;
  const missingContext = /\bmissing scene contract\b/i;

  if (uncertain.test(value) || missingContext.test(value)) {
    return { hard: false, category: 'advisory_uncertain', reason: 'Uncertain or missing context' };
  }

  const v = value.toLowerCase();

  // Advisory Categories (explicitly checked for clarity, though default is advisory anyway)
  if (/\b(emotion(?:al)?|arcs? overlap|feeling|tone|atmosphere|pacing|feels redundant|repetitive|contrast)\b/.test(v)) {
    return { hard: false, category: 'advisory_emotional_continuity', reason: 'Stylistic or emotional overlap is advisory' };
  }

  if (/\b(mentioned in both|same room appears|appears in two|same location|mentioned multiple)\b/.test(v)) {
    return { hard: false, category: 'advisory_location_reference', reason: 'Repeated mentions of locations are advisory' };
  }

  if (/\b(redundant|similar|repeated atmosphere|thematic overlap|chapter feels repetitive)\b/.test(v)) {
    return { hard: false, category: 'advisory_thematic', reason: 'Thematic overlap or redundancy is advisory' };
  }

  // Hard Categories
  if (/\b(dead|died)\b/.test(v) && /\b(speaks?|talks?|walks?|acts?|alive)\b/.test(v)) {
    return { hard: true, category: 'hard_dead_character_acts', reason: 'Dead character acts alive' };
  }

  if (/\b(destroyed|destroys|breaks?|burns?|ruins?)\b/.test(v) && /\b(contradicts?|violates?|interferes?|planned use)\b/.test(v)) {
    // Ground against scene contracts
    if (Array.isArray(generatedScenes)) {
      const words = v.replace(/[^\w\s]/g, '').split(/\s+/);
      const stops = new Set(['the','a','an','is','are','was','were','in','manner','that','contradicts','its','planned','use','narrative','destroyed','destroys','breaks','burns','with','from','for','about','and','but','or']);
      const candidateObjects = words.filter(w => w.length > 2 && !stops.has(w));
      
      let destructionSceneIndex = -1;
      for (let i = 0; i < generatedScenes.length; i++) {
        const sc = generatedScenes[i];
        const spec = sc.spec || {};
        const combinedCurrent = ((spec.required_events||[]).join(' ') + ' ' + (spec.exit_state||'')).toLowerCase();
        
        if (/\b(destroyed|destroys|breaks?|burns?|ruins?)\b/.test(combinedCurrent)) {
          const matchesObject = candidateObjects.length === 0 || candidateObjects.some(obj => combinedCurrent.includes(obj));
          if (matchesObject) {
            destructionSceneIndex = i;
            break;
          }
        }
      }

      if (destructionSceneIndex !== -1) {
        let laterRequiresIntact = false;
        for (let j = destructionSceneIndex + 1; j < generatedScenes.length; j++) {
          const futSpec = generatedScenes[j].spec || {};
          const futCombined = ((futSpec.required_events||[]).join(' ') + ' ' + (futSpec.entry_state||'') + ' ' + (futSpec.exit_state||'')).toLowerCase();
          
          const mentionsObject = candidateObjects.length === 0 || candidateObjects.some(obj => futCombined.includes(obj));
          if (mentionsObject && /\b(intact|uses|usable|unbroken|unlocks?|inserts?)\b/.test(futCombined)) {
            laterRequiresIntact = true;
            break;
          }
        }

        if (!laterRequiresIntact) {
          return { hard: false, category: 'advisory_object_destruction', reason: 'Destruction is required and not contradicted later' };
        } else {
          return { hard: true, category: 'hard_object_destruction', reason: 'Destruction contradicts later planned use' };
        }
      }
    }
  }

  if (/\b(destroyed|destroys|breaks?|burns?|ruins?)\b/.test(v) && /\b(used|uses|intact)\b/.test(v)) {
    return { hard: true, category: 'hard_destroyed_object_used', reason: 'Destroyed object used again' };
  }

  if (/\b(prematurely|early)\b/.test(v)) {
    return { hard: true, category: 'hard_future_event_early', reason: 'Future event occurs early' };
  }

  if (/\b(separate|separation)\b/.test(v) && /\b(reunion|reunite|converse|interact)\b/.test(v)) {
    return { hard: true, category: 'hard_separation_violation', reason: 'Separated characters interact without reunion' };
  }

  if (/\b(omitted|missing required|fails to perform)\b/.test(v)) {
    return { hard: true, category: 'hard_required_event_omitted', reason: 'Required event omitted' };
  }

  if (/\b(forbidden|banned)\b/.test(v)) {
    return { hard: true, category: 'hard_forbidden_event_performed', reason: 'Forbidden event performed' };
  }

  if (/\b(replayed|repeated required|already happened)\b/.test(v)) {
    return { hard: true, category: 'hard_irreversible_event_replayed', reason: 'Completed irreversible event replayed' };
  }

  if (/\b(contradicts prior exit|contradicts exit state)\b/.test(v)) {
    return { hard: true, category: 'hard_exit_state_contradiction', reason: 'Contradicts prior exit state' };
  }

  if (/\b(contradicts current entry|contradicts entry state)\b/.test(v)) {
    return { hard: true, category: 'hard_entry_state_contradiction', reason: 'Contradicts current entry state' };
  }

  if (/\b(possession contradiction)\b/.test(v)) {
    return { hard: true, category: 'hard_possession_contradiction', reason: 'Explicit possession contradiction' };
  }

  if (/\b(explicit location contradiction)\b/.test(v)) {
    return { hard: true, category: 'hard_location_contradiction', reason: 'Explicit location contradiction' };
  }

  if (/\b(canon fact contradiction|contradicts canon)\b/.test(v)) {
    return { hard: true, category: 'hard_canon_contradiction', reason: 'Explicit canon fact contradiction' };
  }

  if (/\b(planning leak|process text leaked)\b/.test(v)) {
    return { hard: true, category: 'hard_process_leak', reason: 'Internal planning text leaked' };
  }

  if (/\b(malformed|truncated prose)\b/.test(v)) {
    return { hard: true, category: 'hard_malformed_prose', reason: 'Malformed or truncated prose confirmed' };
  }

  // Ensure default is advisory
  return { hard: false, category: 'advisory_general', reason: 'Unmapped confident wording remains advisory' };
}

export function filterConcreteCriticFindings(findings, generatedScenes, deterministicReports) {
  if (!Array.isArray(findings)) return [];
  return findings.filter((finding) => classifyCriticFinding(finding, generatedScenes, deterministicReports).hard === true);
}
