import { extractLimbFacts } from './sceneContractGate.js';

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

  // 3. Generic deterministic death extraction
  // Look for exact names + "is dead" or "died" in the exit_state and required_events
  const stateStrings = [...requiredEvents, spec?.exit_state || ''];
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

    // Simplistic but safe deterministic object destruction match
    const destroyedMatch = str.match(/\b(?:the\s+)?([a-z\s]+)\s+(?:is|was)\s+(?:destroyed|shattered|crushed|burned)\b/i);
    if (destroyedMatch) {
      const objName = destroyedMatch[1].trim().toLowerCase();
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
      const objName = givesMatch[1].trim().toLowerCase();
      const receiver = givesMatch[2];
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.possessions[receiver]) ledger.possessions[receiver] = [];
        if (!ledger.possessions[receiver].includes(objName)) ledger.possessions[receiver].push(objName);
        ledger.droppedObjects = ledger.droppedObjects.filter(o => o !== objName);
      }
    }

    // Possession: X takes/grabs Y
    const takesMatch = str.match(/\b([A-Z][a-z]+)\s+(?:takes|grabs|picks up|retrieves)\s+(?:the\s+)?([a-z\s]+)\b/);
    if (takesMatch) {
      const taker = takesMatch[1];
      const objName = takesMatch[2].trim().toLowerCase();
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.possessions[taker]) ledger.possessions[taker] = [];
        if (!ledger.possessions[taker].includes(objName)) ledger.possessions[taker].push(objName);
        ledger.droppedObjects = ledger.droppedObjects.filter(o => o !== objName);
      }
    }

    // Dropped: placed X on Y, drops X
    const dropMatch = str.match(/\b(?:places|drops|leaves)\s+(?:the\s+)?([a-z\s]+)\s+(?:on|in|at)\b/);
    if (dropMatch) {
      const objName = dropMatch[1].trim().toLowerCase();
      if (objName.length > 2 && objName.length < 25) {
        if (!ledger.droppedObjects.includes(objName)) ledger.droppedObjects.push(objName);
        for (const c in ledger.possessions) {
          ledger.possessions[c] = ledger.possessions[c].filter(o => o !== objName);
        }
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
