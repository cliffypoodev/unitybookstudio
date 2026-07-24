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
    
    // Simplistic but safe deterministic character death match
    const deathMatch = str.match(/\b([A-Z][a-z]+)\s+(?:is dead|died|is killed|dies|was killed)\b/);
    if (deathMatch) {
      const charName = deathMatch[1];
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
      }
    }

    // Dropped: placed X on Y, drops X
    const dropMatch = str.match(/\b(?:places|drops|leaves)\s+(?:the\s+)?([a-z\s]+)\s+(?:on|in|at)\b/);
    if (dropMatch) {
      const objNameRaw = dropMatch[1].trim().toLowerCase();
      const objName = objNameRaw.replace(/[.,:;!?]+$/, '');
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.droppedObjects.includes(objName)) ledger.droppedObjects.push(objName);
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
