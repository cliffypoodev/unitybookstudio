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

export function filterConcreteCriticFindings(findings, generatedScenes) {
  if (!Array.isArray(findings)) return [];

  return findings.filter((finding) => {
    const value = String(finding || '').trim();
    if (!value) return false;

    const uncertain = /\b(may|might|could|possibly|perhaps|appears?|seems?|unclear|uncertain|depending on|potential(?:ly)?|suggests?)\b/i;
    const missingContext = /\bmissing scene contract\b/i;

    if (uncertain.test(value) || missingContext.test(value)) return false;

    // Check false-positive object destruction
    const destructionTerms = /\b(destroyed|destroys|breaks?|burns?|shatters?|ruins?)\b/i;
    const contradictTerms = /\b(contradicts?|violates?|interferes?|planned use)\b/i;
    
    if (destructionTerms.test(value) && contradictTerms.test(value) && Array.isArray(generatedScenes)) {
      // Find nouns in the critic claim to identify the object
      const words = value.replace(/[^\w\s]/g, '').toLowerCase().split(/\s+/);
      const stops = new Set(['the','a','an','is','are','was','were','in','manner','that','contradicts','its','planned','use','narrative','destroyed','destroys','breaks','burns','with','from','for','about','and','but','or']);
      const candidateObjects = words.filter(w => w.length > 2 && !stops.has(w));
      
      let destructionSceneIndex = -1;
      for (let i = 0; i < generatedScenes.length; i++) {
        const sc = generatedScenes[i];
        const spec = sc.spec || {};
        const reqEvents = Array.isArray(spec.required_events) ? spec.required_events.join(' ') : '';
        const exitState = spec.exit_state || '';
        const combinedCurrent = (reqEvents + ' ' + exitState).toLowerCase();
        
        if (destructionTerms.test(combinedCurrent)) {
          const matchesObject = candidateObjects.some(obj => combinedCurrent.includes(obj));
          if (matchesObject || candidateObjects.length === 0) {
            destructionSceneIndex = i;
            break;
          }
        }
      }

      if (destructionSceneIndex !== -1) {
        let laterRequiresIntact = false;
        for (let j = destructionSceneIndex + 1; j < generatedScenes.length; j++) {
          const futSpec = generatedScenes[j].spec || {};
          const futReq = Array.isArray(futSpec.required_events) ? futSpec.required_events.join(' ') : '';
          const futEntry = futSpec.entry_state || '';
          const futExit = futSpec.exit_state || '';
          const futCombined = (futReq + ' ' + futEntry + ' ' + futExit).toLowerCase();
          
          const mentionsObject = candidateObjects.length === 0 || candidateObjects.some(obj => futCombined.includes(obj));
          if (mentionsObject && /\b(intact|uses|usable|unbroken|unlocks?|inserts?)\b/i.test(futCombined)) {
            laterRequiresIntact = true;
            break;
          }
        }

        if (!laterRequiresIntact) {
          return false; // Not a hard violation, just advisory
        }
      }
    }

    return true;
  });
}
