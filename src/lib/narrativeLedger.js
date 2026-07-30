import { extractLimbFacts } from './sceneContractGate.js';

export function getTrustedCharacters(spec, ledger) {
  const trusted = new Set();
  const stopwords = new Set([
    'and','but','or','he','she','his','her','they','their','it',
    'for','from','with','above','below','into',
    'one','two','three','four','five','six','seven','eight','nine','ten',
    'light','dust','smoke','wind','ice','arctic','snow','water','fire',
    'the','a','an','then','when','if','as','to','in','on','at','by','of',
    'is','are','was','were','be','been','being',
    'do','does','did','have','has','had',
    'this','that','these','those',
    'here','there','where','why','how','what','which','who','whom',
    'chapter','scene','part', 'some', 'any', 'many', 'few', 'all'
  ]);

  const addFromText = (text) => {
    if (!text || typeof text !== 'string') return;
    const matches = text.match(/\b([A-Z][a-z]+)\b/g);
    if (matches) {
      for (const m of matches) {
        if (!stopwords.has(m.toLowerCase())) {
          trusted.add(m);
        }
      }
    }
  };

  if (spec) {
    addFromText(spec.scene_goal);
    addFromText(spec.entry_state);
    addFromText(spec.exit_state);
    addFromText(spec.pov);
    if (Array.isArray(spec.required_events)) spec.required_events.forEach(addFromText);
    if (Array.isArray(spec.forbidden_events)) spec.forbidden_events.forEach(addFromText);
    if (Array.isArray(spec.characters)) spec.characters.forEach(addFromText);
  }

  if (ledger) {
    if (Array.isArray(ledger.separatedCharacters)) ledger.separatedCharacters.forEach(c => trusted.add(c));
    if (Array.isArray(ledger.deadCharacters)) ledger.deadCharacters.forEach(c => trusted.add(c));
    for (const c in ledger.possessions) trusted.add(c);
  }

  return trusted;
}
// LEDGERFIX-1: capitalised words that are never character names. A death sentence
// that opens with one of these describes someone already known (or no one at all);
// recording it as a name poisons every downstream dead-character check.
const NON_CHARACTER_SUBJECTS = new Set([
  'he', 'she', 'they', 'it', 'we', 'you', 'i', 'him', 'her', 'them', 'me', 'us',
  'his', 'their', 'my', 'our', 'your', 'its', 'hers', 'theirs', 'mine', 'ours',
  'that', 'this', 'these', 'those', 'there', 'then', 'here', 'now',
  'everyone', 'everybody', 'everything', 'someone', 'somebody', 'something',
  'anyone', 'anybody', 'anything', 'nobody', 'none', 'nothing', 'no',
  'one', 'another', 'other', 'others', 'both', 'neither', 'either', 'each',
  'all', 'some', 'many', 'most', 'few', 'several', 'any',
  'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'and', 'but', 'the', 'a', 'an', 'if', 'because', 'so', 'yet', 'still',
]);

export function buildInitialLedger() {
  return {
    locations: {},
    objects: {},
    characterConditions: {},
    completedEvents: [],
    deadCharacters: [],
    unavailableObjects: [],
    possessions: {},
    droppedObjects: [],
    separatedCharacters: [],
    objectLocations: {},
  };
}

export function extractSceneLedgerUpdates(priorLedger, sceneProse, spec) {
  const ledger = JSON.parse(JSON.stringify(priorLedger)); // deep copy

  // 1. Add required events and exit state to completed events
  const requiredEvents = Array.isArray(spec?.required_events)
    ? spec.required_events.filter(Boolean)
    : [];
  
  for (const event of requiredEvents) {
    if (!ledger.completedEvents.includes(event)) {
      ledger.completedEvents.push(event);
    }
  }

  if (spec?.exit_state && !ledger.completedEvents.includes(spec.exit_state)) {
    ledger.completedEvents.push(spec.exit_state);
  }

  // 2. Parse prose and spec for limb conditions
  const limbFacts = extractLimbFacts(sceneProse);
  for (const fact of limbFacts) {
    if (!ledger.characterConditions[fact.character]) {
      ledger.characterConditions[fact.character] = [];
    }
    const conditionStr = `${fact.side} ${fact.kind === 'loss' ? 'amputated/severed' : fact.kind}`;
    if (!ledger.characterConditions[fact.character].includes(conditionStr)) {
      ledger.characterConditions[fact.character].push(conditionStr);
    }
  }

  // Look for exact names + "is dead" or "died" in the exit_state, required_events, AND prose itself
  const stateStrings = [...requiredEvents, spec?.exit_state || '', sceneProse || ''];
  for (const str of stateStrings) {
    if (!str) continue;
    
    // LEDGERFIX-1: /\b([A-Z][a-z]+)\s+(?:died|...)/ captures ANY capitalised word,
    // including a sentence-initial pronoun. "He died in the accident." registered a
    // character literally named "He", after which the DEAD_CHARACTER_ACTION gate
    // built /\bHe\b\s+(?:said|nodded|looked|...)/i and rejected every subsequent
    // scene — a chapter cannot be rewritten to avoid the word "he", so the bounded
    // repair could never clear it and drafting died. The object branch below already
    // guards against exactly this, so match its convention for characters.
    // Scan EVERY death in the string, not just the first. `String.match` without
    // /g returns one hit, so "He died in the accident. Reed died beside him."
    // stopped at the rejected pronoun and lost Reed entirely.
    const deathPattern = /\b([A-Z][a-z]+)\s+(?:is dead|died|is killed|dies|was killed)\b/g;
    let deathMatch;
    while ((deathMatch = deathPattern.exec(str)) !== null) {
      const charName = deathMatch[1];
      if (NON_CHARACTER_SUBJECTS.has(charName.toLowerCase())) continue;
      if (!ledger.deadCharacters.includes(charName)) {
        ledger.deadCharacters.push(charName);
      }
    }

    const destroyedMatch = str.match(/\b(?:the\s+)?([a-z\s]+)\s+(?:is|was)\s+(?:destroyed|shattered|crushed|burned)\b/i);
    if (destroyedMatch) {
      const objNameRaw = destroyedMatch[1].trim().toLowerCase();
      // Remove trailing punctuation from object name
      const objName = objNameRaw.replace(/[.,:;!?]+$/, '');
      // Ignore common verbs/adjectives mistaken for objects
      if (objName.length > 2 && objName.length < 25 && !['it', 'he', 'she', 'they', 'everything', 'nothing'].includes(objName)) {
        if (!ledger.unavailableObjects.includes(objName)) {
          ledger.unavailableObjects.push(objName);
          // If destroyed, remove from dropped and possessions
          ledger.droppedObjects = ledger.droppedObjects.filter(o => o !== objName);
          for (const c in ledger.possessions) {
            ledger.possessions[c] = ledger.possessions[c].filter(o => o !== objName);
          }
        }
      }
    }

    // Possession: Gives X to Y
    const givesMatch = str.match(/\b(?:gives|hands|passes)\s+(?:the\s+)?([a-z\s]+)\s+to\s+([A-Z][a-z]+)\b/);
    if (givesMatch) {
      const objNameRaw = givesMatch[1].trim().toLowerCase();
      const objName = objNameRaw.replace(/[.,:;!?]+$/, '');
      const receiver = givesMatch[2];
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.possessions[receiver]) ledger.possessions[receiver] = [];
        if (!ledger.possessions[receiver].includes(objName)) ledger.possessions[receiver].push(objName);
        ledger.droppedObjects = ledger.droppedObjects.filter(o => o !== objName);
      }
    }

    // Possession: X takes/grabs Y
    const takesMatch = str.match(/\b([A-Z][a-z]+)\s+(?:takes|grabs|picks up|retrieves|pockets|snatches)\s+(?:the\s+)?([a-z\s]+)\b/);
    if (takesMatch) {
      const taker = takesMatch[1];
      const objNameRaw = takesMatch[2].trim().toLowerCase();
      const objName = objNameRaw.replace(/[.,:;!?]+$/, '');
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.possessions[taker]) ledger.possessions[taker] = [];
        if (!ledger.possessions[taker].includes(objName)) ledger.possessions[taker].push(objName);
        ledger.droppedObjects = ledger.droppedObjects.filter(o => o !== objName);
        if (ledger.objectLocations && ledger.objectLocations[objName]) {
          delete ledger.objectLocations[objName];
        }
      }
    }

    // Dropped: placed X on Y, drops X
    const dropMatch = str.match(/\b(?:places|drops|leaves|inserts)\s+(?:the\s+)?([a-z\s]+)\s+(?:on|in|at|inside)\s+(?:the\s+)?([a-z\s]+)\b/i);
    if (dropMatch) {
      const objNameRaw = dropMatch[1].trim().toLowerCase();
      const objName = objNameRaw.replace(/[.,:;!?]+$/, '');
      const locationRaw = dropMatch[2].trim().toLowerCase();
      const location = locationRaw.split(' ')[0].replace(/[.,:;!?]+$/, ''); // Just grab the first noun-like word
      
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.droppedObjects.includes(objName)) ledger.droppedObjects.push(objName);
        if (!ledger.objectLocations) ledger.objectLocations = {};
        ledger.objectLocations[objName] = location;
        
        for (const c in ledger.possessions) {
          ledger.possessions[c] = ledger.possessions[c].filter(o => o !== objName);
        }
      }
    }

    const trusted = getTrustedCharacters(spec, ledger);
    const formatName = (n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

    // Character separation
    const sepRegexes = [
      /\b([A-Z][a-z]+)\s+(?:separates from|leaves)\s+([A-Z][a-z]+)\b/i,
      /\b([A-Z][a-z]+)\s+leaves\s+([A-Z][a-z]+)\s+behind\b/i,
      /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)\s+(?:split up|separate)\b/i,
      /\b([A-Z][a-z]+)\s+(?:climbs alone|leaves alone|escapes alone|is separated|climbs away|runs away)\b/i
    ];
    for (const rx of sepRegexes) {
      const match = str.match(rx);
      if (match) {
        const c1 = formatName(match[1]);
        if (c1 && trusted.has(c1) && !ledger.separatedCharacters.includes(c1)) {
          ledger.separatedCharacters.push(c1);
        }
        if (match[2]) {
          const c2 = formatName(match[2]);
          if (c2 && trusted.has(c2) && !ledger.separatedCharacters.includes(c2)) {
            ledger.separatedCharacters.push(c2);
          }
        }
      }
    }
    
    // Character reunion
    const reunionMatch = str.match(/\b([A-Z][a-z]+)\s+(?:reunites with|finds|returns to|meets back up with)\b/i);
    if (reunionMatch) {
      const character = formatName(reunionMatch[1]);
      if (trusted.has(character)) {
        ledger.separatedCharacters = ledger.separatedCharacters.filter(c => c !== character);
      }
    }
  }

  // Cap size
  if (ledger.completedEvents.length > 30) {
    ledger.completedEvents = ledger.completedEvents.slice(-30);
  }

  return ledger;
}

export function serializeLedger(ledger) {
  if (!ledger) return '';
  let out = '=== CURRENT NARRATIVE STATE LEDGER ===\n';
  
  if (ledger.deadCharacters && ledger.deadCharacters.length > 0) {
    out += `DEAD CHARACTERS (Cannot act, speak, or be interacted with as living): ${ledger.deadCharacters.join(', ')}\n`;
  }
  
  if (ledger.unavailableObjects && ledger.unavailableObjects.length > 0) {
    out += `DESTROYED/UNAVAILABLE OBJECTS (Cannot be used or found): ${ledger.unavailableObjects.join(', ')}\n`;
  }

  if (ledger.droppedObjects && ledger.droppedObjects.length > 0) {
    out += `DROPPED/PLACED OBJECTS (Currently not held by anyone): ${ledger.droppedObjects.join(', ')}\n`;
  }

  const possessors = Object.keys(ledger.possessions || {});
  if (possessors.length > 0) {
    out += `OBJECT POSSESSIONS:\n`;
    for (const char of possessors) {
      if (ledger.possessions[char].length > 0) {
        out += `- ${char} holds: ${ledger.possessions[char].join(', ')}\n`;
      }
    }
  }

  const conditions = Object.keys(ledger.characterConditions || {});
  if (conditions.length > 0) {
    out += `CHARACTER CONDITIONS:\n`;
    for (const char of conditions) {
      out += `- ${char}: ${ledger.characterConditions[char].join(', ')}\n`;
    }
  }

  if (ledger.completedEvents && ledger.completedEvents.length > 0) {
    out += `RECENT COMPLETED EVENTS (Do NOT replay these):\n`;
    const recent = ledger.completedEvents.slice(-10); // Only inject last 10 to keep prompt compact
    for (const event of recent) {
      out += `- ${event}\n`;
    }
  }
  
  return out.trim();
}

// ─── LEDGERSCOPE-1: book-scope ledger ────────────────────────────────────────
//
// The ledger was rebuilt from scratch at the top of every chapter
// (sceneWriter.js `runtimeLedger = buildInitialLedger()`) and was never returned
// to the caller, so no chapter could ever see what an earlier one established.
// Proven on the page in Brass Meridian TEST: Marcus's wrist breaks in Ch.3 and
// becomes a stump one scene later with no amputation ever written, then grows a
// palm back in Ch.4; the brass key teleports between pockets across the Ch.4/Ch.5
// boundary; the station is destroyed three separate times.
//
// These helpers are PURE - no imports, no I/O - so they can be unit-tested and so
// `narrativeLedger.js` stays free of the base44 client.
//
// Merge semantics are not uniform, and that is the whole design:
//   IRREVERSIBLE facts union. Death, destruction and a severed limb cannot be
//   undone by a later chapter, so they accumulate and never drop out.
//   MUTABLE state is overridden by the later chapter, per key, with untouched
//   keys preserved. Who holds an object and where people are standing change
//   constantly; the newest reading wins.
// Getting this backwards in either direction is a bug: unioning possessions makes
// one object held by three people at once, and overriding deadCharacters
// resurrects the dead.

/** Hard cap on stored completed events. serializeLedger only injects the last 10
 *  into a prompt, but the STORED array would grow without bound across 20+
 *  chapters and bloat every save. */
export const LEDGER_MAX_COMPLETED_EVENTS = 40;

const uniq = (arr) => [...new Set((arr || []).filter((x) => x !== null && x !== undefined && x !== ''))];
const cloneStrMap = (m) => Object.fromEntries(
  Object.entries(m || {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
);

export function cloneLedger(ledger) {
  const base = buildInitialLedger();
  if (!ledger || typeof ledger !== 'object') return base;
  return {
    locations: { ...(ledger.locations || {}) },
    objects: { ...(ledger.objects || {}) },
    objectLocations: { ...(ledger.objectLocations || {}) },
    characterConditions: cloneStrMap(ledger.characterConditions),
    possessions: cloneStrMap(ledger.possessions),
    completedEvents: [...(ledger.completedEvents || [])],
    deadCharacters: [...(ledger.deadCharacters || [])],
    unavailableObjects: [...(ledger.unavailableObjects || [])],
    droppedObjects: [...(ledger.droppedObjects || [])],
    separatedCharacters: [...(ledger.separatedCharacters || [])],
  };
}

/** Trim the stored ledger so it cannot grow without bound. Only completedEvents
 *  grows monotonically; every other field is bounded by the cast and the props. */
export function boundLedger(ledger, maxEvents = LEDGER_MAX_COMPLETED_EVENTS) {
  const out = cloneLedger(ledger);
  if (out.completedEvents.length > maxEvents) {
    out.completedEvents = out.completedEvents.slice(-maxEvents);
  }
  return out;
}

/**
 * Merge `incoming` (the LATER chapter) onto `base` (everything before it).
 * @param {object|null} base
 * @param {object|null} incoming
 * @returns {object} a new ledger; neither argument is mutated
 */
export function mergeLedgers(base, incoming) {
  const a = cloneLedger(base);
  if (!incoming || typeof incoming !== 'object') return a;
  const b = cloneLedger(incoming);

  // --- irreversible: union, never drops ---
  a.deadCharacters = uniq([...a.deadCharacters, ...b.deadCharacters]);
  a.unavailableObjects = uniq([...a.unavailableObjects, ...b.unavailableObjects]);
  for (const [char, conds] of Object.entries(b.characterConditions)) {
    a.characterConditions[char] = uniq([...(a.characterConditions[char] || []), ...(conds || [])]);
  }

  // --- mutable state: the later chapter wins, per key ---
  a.locations = { ...a.locations, ...b.locations };
  a.objects = { ...a.objects, ...b.objects };
  a.objectLocations = { ...a.objectLocations, ...b.objectLocations };
  for (const [char, objs] of Object.entries(b.possessions)) {
    a.possessions[char] = uniq(objs);
  }

  // --- mutable sets: a later non-empty reading replaces the earlier one ---
  if (b.droppedObjects.length) a.droppedObjects = uniq(b.droppedObjects);
  if (b.separatedCharacters.length) a.separatedCharacters = uniq(b.separatedCharacters);

  // --- history: append, dedupe, bound ---
  a.completedEvents = uniq([...a.completedEvents, ...b.completedEvents]);

  return boundLedger(a);
}

/** Fold an ordered list of per-chapter ledgers (earliest first) into one. */
export function foldChapterLedgers(ledgers) {
  let acc = buildInitialLedger();
  for (const l of ledgers || []) acc = mergeLedgers(acc, l);
  return acc;
}

/** One-line telemetry for the console. */
export function summarizeLedger(ledger) {
  const l = cloneLedger(ledger);
  const conds = Object.values(l.characterConditions).reduce((n, v) => n + (v || []).length, 0);
  const held = Object.values(l.possessions).reduce((n, v) => n + (v || []).length, 0);
  return `dead=${l.deadCharacters.length} conditions=${conds} destroyed=${l.unavailableObjects.length} held=${held} events=${l.completedEvents.length}`;
}
