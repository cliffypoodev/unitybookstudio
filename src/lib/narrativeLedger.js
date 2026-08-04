import { extractLimbFacts, extractCharacterStateFacts } from './sceneContractGate.js';
import { checkPossessionContinuity, objectAliases, isPortablePropPhrase } from './objectPossession.js';

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
  // KEYLEDGER-2c: capitalised kinship words. "You're the reason Dad died." on the
  // live ch.5 draft registered a dead character literally named "Dad", which the
  // DEAD_CHARACTER_ACTION gate would then hunt through every later memory line.
  'dad', 'mom', 'mum', 'papa', 'mama', 'father', 'mother', 'grandpa', 'grandma',
  'uncle', 'aunt', 'son', 'daughter', 'brother', 'sister',
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
    objectConditions: {},
  };
}

/**
 * KEYLEDGER-1e — an object has exactly ONE holder. Setting a holder removes the
 * object from every other character and from droppedObjects. Passing holder=null
 * removes it from everyone (the object is in play but unheld).
 */
export function setHolderOfRecord(ledger, objName, holder) {
  const obj = String(objName || '').trim();
  if (!obj) return ledger;
  ledger.possessions = ledger.possessions || {};
  for (const char of Object.keys(ledger.possessions)) {
    ledger.possessions[char] = (ledger.possessions[char] || []).filter(
      (o) => String(o).toLowerCase() !== obj.toLowerCase()
    );
    if (!ledger.possessions[char].length) delete ledger.possessions[char];
  }
  if (holder) {
    ledger.possessions[holder] = ledger.possessions[holder] || [];
    ledger.possessions[holder].push(obj);
    ledger.droppedObjects = (ledger.droppedObjects || []).filter(
      (o) => String(o).toLowerCase() !== obj.toLowerCase()
    );
    if (ledger.objectLocations) delete ledger.objectLocations[obj];
  }
  return ledger;
}

export function extractSceneLedgerUpdates(priorLedger, sceneProse, spec, options = {}) {
  const ledger = JSON.parse(JSON.stringify(priorLedger)); // deep copy
  // KEYLEDGER-1e: { sceneCast, trackedObjects }. With both present, the holder of
  // record for each tracked object is read off the prose scanner's exit holder.
  // Without them nothing here changes — fail-open, exactly as before.
  const sceneCast = Array.isArray(options.sceneCast) ? options.sceneCast : null;
  const trackedObjects = Array.isArray(options.trackedObjects) ? options.trackedObjects : [];

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
  // 2. Parse prose and spec for limb conditions
  const limbFacts = extractLimbFacts(sceneProse);
  for (const fact of limbFacts) {
    if (!ledger.characterConditions[fact.character]) {
      ledger.characterConditions[fact.character] = [];
    }
    // INJURYSCALE-1a: the stored condition names the body part when the prose
    // named one - "left thumb amputated/severed" instead of "left
    // amputated/severed" - so inflation (thumb becoming an arm) is checkable.
    const conditionStr = `${fact.side}${fact.part ? ` ${fact.part}` : ''} ${fact.kind === 'loss' ? 'amputated/severed' : fact.kind}`;
    if (!ledger.characterConditions[fact.character].includes(conditionStr)) {
      ledger.characterConditions[fact.character].push(conditionStr);
    }
  }

  // STATEFIX-1: everything a character can permanently BECOME that is not an arm.
  // The limb extractor above knows four body parts and three conditions; a character
  // blinded, deafened, paralysed, scarred, burned, made pregnant, or missing a leg,
  // foot or eye was invisible to the ledger and therefore recovered silently in the
  // next chapter. Same storage, same union semantics, same irreversibility.
  // `side` is null for states that are not lateral, so the label stands alone.
  for (const fact of extractCharacterStateFacts(sceneProse)) {
    if (!ledger.characterConditions[fact.character]) {
      ledger.characterConditions[fact.character] = [];
    }
    const conditionStr = fact.side ? `${fact.side} ${fact.label}` : fact.label;
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
    // EXTRACTFIX-1: additional death forms. The NAME-ADJACENT structure is unchanged -
    // the character name must still be immediately followed by the phrase, which is what
    // keeps the LEDGERFIX-1 pronoun disaster fixed. These are more ways of saying the same
    // thing, not a looser match.
    //
    // KNOWN GAP, stated so nobody assumes otherwise: this does NOT catch a death phrased
    // with words between the name and the verb, e.g. the Ch.4 beat "Dr. Vale collapses from
    // exhaustion and injuries, dying in the corridor." Closing that needs a gap-tolerant
    // pattern, which is exactly the blind widening that produced LEDGERFIX-1. Not done here.
    // KEYLEDGER-2c: a death recounted inside quoted DIALOGUE is memory, not a
    // scene event. "I told him Ortiz died in the flood." on the live ch.5 draft
    // registered Ortiz (dead twenty years before page one) as a scene death.
    // Spec strings (exit_state, required_events) carry no dialogue and are
    // unaffected; only matches inside quote spans of the PROSE are skipped.
    const quoteSpans = [];
    {
      const qrx = /[\u201c"]([^\u201c\u201d"]{1,600})[\u201d"]/g;
      let qm;
      while ((qm = qrx.exec(str)) !== null) quoteSpans.push([qm.index, qm.index + qm[0].length]);
    }
    const inQuote = (idx) => quoteSpans.some(([a, b]) => idx >= a && idx < b);

    const deathPattern = /\b([A-Z][a-z]+)\s+(?:is dead|died|is killed|dies|was killed|is dying|was dying|lay dying|lies dead|lay dead|bled out|bleeds out)\b/g;
    let deathMatch;
    while ((deathMatch = deathPattern.exec(str)) !== null) {
      const charName = deathMatch[1];
      if (NON_CHARACTER_SUBJECTS.has(charName.toLowerCase())) continue;
      if (inQuote(deathMatch.index)) continue;
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

    // KEYLEDGER-1e. The two blocks removed here matched beat-sheet phrasing only
    // ("hands the key to Lena", "Marcus takes the key") and scored ZERO possession
    // facts across all five live Brass Meridian saves — 21,344 words. Worse, when
    // they did fire they were additive: "Marcus takes the brass key" left the key
    // held by Lena AND Marcus at the same time. Possession is now set by the
    // prose scanner (see setHolderOfRecord below), which enforces one holder.

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
    
    // Character reunion. SEPARATION-1: the old regex was present-tense only
    // ("finds" never matched the past-tense narration "found") and cleared only
    // the SUBJECT of the reunion sentence - "Lena reached Marcus" un-separated
    // Lena, who was never separated, and left Marcus flagged. Now: closed verb
    // list in both tenses, and every trusted character named in a
    // reunion-verb sentence is cleared - a reunion reunites everyone in it.
    const reunionRx = /\b(?:reunites? with|reunited with|finds|found|returns? to|returned to|meets? (?:back )?up with|met (?:back )?up with|joins|joined|reach(?:es|ed)|catch(?:es)? up with|caught up with|rush(?:es|ed) to)\b/i;
    for (const sentence of str.split(/(?<=[.!?])\s+/)) {
      if (!reunionRx.test(sentence)) continue;
      const namesInSentence = (sentence.match(/\b([A-Z][a-z]+)\b/g) || [])
        .map(formatName).filter((n) => trusted.has(n));
      if (namesInSentence.length) {
        ledger.separatedCharacters = ledger.separatedCharacters.filter((c) => !namesInSentence.includes(c));
      }
    }
  }

  // KEYLEDGER-1e: holder of record, read off the prose, one holder per object.
  if (sceneCast && sceneCast.length && trackedObjects.length) {
    for (const obj of trackedObjects) {
      const entryHolder =
        Object.keys(ledger.possessions || {}).find((char) =>
          (ledger.possessions[char] || []).some(
            (held) => String(held).toLowerCase() === String(obj).toLowerCase()
          )
        ) || null;
      const { exitHolder } = checkPossessionContinuity({
        prose: sceneProse, object: obj, cast: sceneCast, entryHolder,
      });
      if (exitHolder !== entryHolder) setHolderOfRecord(ledger, obj, exitHolder);
    }
  }

  // OBJECTSTATE-1: physical object condition, read off the PROSE, per tracked
  // object. Proven need on Brass Meridian TEST: the key SNAPS IN HALF in ch.3
  // ("The key snapped. ... The bottom half fell into the water") and ch.4-5
  // depict it whole and working - the ledger tracked who HELD it but not what
  // STATE it was in. Closed world: only tracked objects can carry a condition;
  // prose is the sole source (a beat plan asserting damage that never got
  // written must not bind future chapters); quoted dialogue is skipped (a
  // spoken claim is not a scene event); break and repair events are applied in
  // prose order so the LAST written state wins. A repair is stored as the
  // explicit value ['repaired'] - never as an absence - so the chapter fold
  // cannot resurrect a cleared break.
  if (trackedObjects.length && sceneProse) {
    ledger.objectConditions = ledger.objectConditions || {};
    const oProse = String(sceneProse);
    const oQuoteSpans = [];
    {
      const qrx = /[\u201c"]([^\u201c\u201d"]{1,600})[\u201d"]/g;
      let qm;
      while ((qm = qrx.exec(oProse)) !== null) oQuoteSpans.push([qm.index, qm.index + qm[0].length]);
    }
    const oInQuote = (idx) => oQuoteSpans.some(([a, b]) => idx >= a && idx < b);
    const escapeObjRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const obj of trackedObjects) {
      const aliases = objectAliases(obj).map(escapeObjRx);
      if (!aliases.length) continue;
      const aliasAlt = aliases.join('|');
      const breakRx = new RegExp(
        `\\b(?:the|a|an|his|her|their)\\s+(?:${aliasAlt})\\s+(?:snapped|broke|cracked|split|bent)\\b` +
        `|\\b(?:the|a|an|his|her|their)\\s+(?:${aliasAlt})\\s+(?:was|is|had)\\s+(?:snapped|broken|cracked|split|bent)\\b` +
        `|\\b(?:top|bottom|upper|lower)\\s+half\\s+of\\s+the\\s+(?:${aliasAlt})\\b`,
        'gi'
      );
      const repairRx = new RegExp(
        `\\b(?:repaired|mended|fused|welded|reassembled)\\s+(?:the|a|an|his|her|their)\\s+(?:${aliasAlt})\\b` +
        `|\\b(?:the|a|an|his|her|their)\\s+(?:${aliasAlt})\\s+(?:was|is|had\\s+been)\\s+(?:repaired|mended|fused|welded|whole\\s+again)\\b`,
        'gi'
      );
      const events = [];
      let m;
      while ((m = breakRx.exec(oProse)) !== null) {
        if (oInQuote(m.index)) continue;
        const verb = (m[0].match(/(snapped|broke|broken|cracked|split|bent|half)/i) || ['damaged'])[0].toLowerCase();
        events.push({ idx: m.index, kind: 'break', cond: verb === 'half' ? 'broken - only part of it remains' : `broken (${verb})` });
      }
      while ((m = repairRx.exec(oProse)) !== null) {
        if (oInQuote(m.index)) continue;
        events.push({ idx: m.index, kind: 'repair' });
      }
      events.sort((x, y) => x.idx - y.idx);
      for (const ev of events) {
        if (ev.kind === 'repair') {
          ledger.objectConditions[obj] = ['repaired'];
        } else {
          const cur = (ledger.objectConditions[obj] || []).filter((c) => c !== 'repaired');
          if (!cur.includes(ev.cond)) cur.push(ev.cond);
          ledger.objectConditions[obj] = cur;
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
    out += `HOLDER OF RECORD (who physically has each object RIGHT NOW — an object cannot change hands off-page; if it moves, write the handover):\n`;
    for (const char of possessors) {
      if (ledger.possessions[char].length > 0) {
        out += `- ${char} has: ${ledger.possessions[char].join(', ')}\n`;
      }
    }
  }

  const conditions = Object.keys(ledger.characterConditions || {});
  if (conditions.length > 0) {
    out += `CHARACTER CONDITIONS (permanent - the injury is EXACTLY this, no more and no less):\n`;
    for (const char of conditions) {
      const rendered = ledger.characterConditions[char].map((cond) => {
        // INJURYSCALE-1a: a small-part loss must not inflate into a missing limb.
        if (/\b(left|right)\s+(thumb|finger)\b/i.test(cond)) {
          return `${cond} (ONLY the digit - the hand and arm above it are intact; no empty sleeve, no hand stump)`;
        }
        return cond;
      });
      out += `- ${char}: ${rendered.join(', ')}\n`;
    }
  }

  const objConds = Object.entries(ledger.objectConditions || {})
    .map(([obj, conds]) => [obj, (conds || []).filter((c) => c !== 'repaired')])
    .filter(([, conds]) => conds.length > 0);
  if (objConds.length > 0) {
    out += `OBJECT CONDITIONS (physical damage is permanent until a repair is written on the page):\n`;
    for (const [obj, conds] of objConds) {
      out += `- ${obj}: ${conds.join(', ')} - it cannot appear or function as an intact object; depict the damage every time it is used\n`;
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
    objectConditions: cloneStrMap(ledger.objectConditions),
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

// HOLDER-1 — one person, one name; one object, one holder; across chapters too.
//
// setHolderOfRecord enforces the single-holder invariant INSIDE one ledger. The
// cross-chapter fold did not: mergeLedgers walked possessions BY CHARACTER
// (`for (const [char, objs] of Object.entries(b.possessions))`), so an object
// held by Lena in ch.4 and by Marcus in ch.5 survived under BOTH. Proven by
// folding two real ledgers, which reproduces the live ch.5 holder line exactly:
//
//   {"Lena Ortiz":["key",...],"Marcus":["key"],"Marcus Reed":["broken brass key"]}
//
// Three defects visible in that one line, all fixed here:
//   1. "key" has two holders.
//   2. "Marcus" and "Marcus Reed" are one person tracked as two holders.
//   3. "Hidden console" and "severely injured left" are phantoms OBJSEED-2 stops
//      generating but cannot retract - they are already written into saved
//      ledgers, and the fold carries them forward forever.
//
// Downstream this is what hard-blocked ch.5: the possession audit found the key
// "last established with Marcus Reed", demanded a handover Lena never wrote, and
// the repair could not satisfy it because the premise was an artefact of the
// split identity, not of the prose.

/** Whitespace-delimited tokens of a character name, lowercased. */
function nameTokens(name) {
  return String(name || '').toLowerCase().replace(/[.,]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

/**
 * HOLDER-1a — collapse split identities to one canonical spelling.
 * Two names are the same person when one's tokens are a subset of the other's
 * AND either it is a leading prefix ("Marcus" -> "Marcus Reed") or they share a
 * final token ("Dr. Vale" -> "Dr. Nolan Vale"). The longer spelling wins.
 * "Marcus Reed" and "Marcus Aurelius" share neither test and stay distinct.
 */
export function canonicalizeHolderNames(names) {
  const list = [...new Set((names || []).map((n) => String(n || '').trim()).filter(Boolean))];
  const map = new Map();
  for (const n of list) {
    const tn = nameTokens(n);
    let winner = n;
    for (const other of list) {
      if (other === n) continue;
      const to = nameTokens(other);
      if (to.length <= tn.length) continue;
      const subset = tn.every((t) => to.includes(t));
      if (!subset) continue;
      const isPrefix = tn.every((t, i) => to[i] === t);
      const sameLast = tn.length > 0 && to.length > 0 && tn[tn.length - 1] === to[to.length - 1];
      if (!isPrefix && !sameLast) continue;
      if (nameTokens(winner).length < to.length) winner = other;
    }
    map.set(n, winner);
  }
  return map;
}

/** Content words of an object phrase, lowercased, articles removed. */
function objectWords(obj) {
  return new Set(
    String(obj || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/).filter((w) => w && !['the', 'a', 'an', 'his', 'her', 'their'].includes(w))
  );
}

/**
 * HOLDER-1b — group object spellings that name the SAME object.
 * One phrase's word set being a subset of another's means the same thing more
 * specifically described: key ⊂ broken brass key ⊂ broken brass key handle, and
 * cane ⊂ broken cane. Grouping is transitive, so a chain collapses to one entity.
 * "brass key" and "iron key" are neither a subset of the other and stay apart.
 *
 * The live ch.5 ledger carried the same physical prop under four spellings, and
 * each one accumulated its own holder - which is how the possession audit came
 * to believe the key was in two places at once.
 */
export function groupObjectSpellings(objects) {
  const items = [...new Set((objects || []).map((o) => String(o || '').trim()).filter(Boolean))]
    .map((o) => ({ o, w: objectWords(o) }));
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => { const a = find(i); const b = find(j); if (a !== b) parent[b] = a; };
  const subset = (small, big) => small.size <= big.size && [...small].every((w) => big.has(w));
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (subset(items[i].w, items[j].w) || subset(items[j].w, items[i].w)) union(i, j);
    }
  }
  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    const g = groups.get(root) || [];
    g.push(item.o);
    groups.set(root, g);
  });
  // key: the group's most specific spelling; value: every spelling in it
  const out = new Map();
  for (const g of groups.values()) {
    const canonical = g.reduce((best, cur) => (cur.length > best.length ? cur : best), g[0]);
    for (const spelling of g) out.set(spelling, canonical);
  }
  return out;
}

/**
 * HOLDER-1 — rebuild a possessions map so that every object has exactly one
 * holder and every holder has exactly one name. Later assignments win, which is
 * what a chapter fold means: the most recent chapter is the current state.
 * Non-portable phrases are dropped, which retires phantoms already written into
 * saved ledgers.
 */
export function normalizePossessions(...maps) {
  const pairs = [];
  for (const m of maps) {
    for (const [char, objs] of Object.entries(m || {})) {
      for (const obj of Array.isArray(objs) ? objs : []) {
        const o = String(obj || '').trim();
        if (o) pairs.push([String(char || '').trim(), o]);
      }
    }
  }
  const nameMap = canonicalizeHolderNames(pairs.map(([c]) => c));
  const portable = pairs.filter(([, obj]) => isPortablePropPhrase(obj));
  const groupMap = groupObjectSpellings(portable.map(([, obj]) => obj));

  // canonical object -> holder ; later pairs overwrite earlier ones, because a
  // fold is ordered oldest-first and the newest chapter is the current state.
  const holderOf = new Map();
  for (const [char, obj] of portable) {
    const holder = nameMap.get(char) || char;
    if (!holder) continue;
    holderOf.set(groupMap.get(obj) || obj, holder);
  }

  const out = {};
  for (const [obj, holder] of holderOf) {
    out[holder] = out[holder] || [];
    if (!out[holder].some((o) => o.toLowerCase() === obj.toLowerCase())) out[holder].push(obj);
  }
  return out;
}

/** HOLDER-1a — apply canonical names to any character-keyed map. */
function canonicalizeCharacterMap(map) {
  const nameMap = canonicalizeHolderNames(Object.keys(map || {}));
  const out = {};
  for (const [char, val] of Object.entries(map || {})) {
    const key = nameMap.get(char) || char;
    out[key] = uniq([...(out[key] || []), ...(Array.isArray(val) ? val : [val])]);
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
  // HOLDER-1: object-first, not character-first. The old loop copied the later
  // ledger's characters over the earlier one's WITHOUT removing the object from
  // whoever held it before, so a handover across a chapter boundary left two
  // holders standing. Order matters: `a` first, `b` second, so the later chapter
  // wins each object.
  a.possessions = normalizePossessions(a.possessions, b.possessions);
  // OBJECTSTATE-1: per-key override, NOT union. Saved ledgers are cumulative
  // (each chapter's ledger starts from the fold of everything before it), so a
  // later chapter always carries the inherited condition forward - and a repair
  // is stored as the explicit value ['repaired'], never as an absence, so a
  // union here would resurrect the break a written repair cleared.
  for (const [obj, conds] of Object.entries(b.objectConditions)) {
    a.objectConditions[obj] = uniq(conds);
  }

  // --- mutable sets: a later non-empty reading replaces the earlier one ---
  if (b.droppedObjects.length) a.droppedObjects = uniq(b.droppedObjects);
  if (b.separatedCharacters.length) a.separatedCharacters = uniq(b.separatedCharacters);

  // --- history: append, dedupe, bound ---
  a.completedEvents = uniq([...a.completedEvents, ...b.completedEvents]);

  // HOLDER-1a: a split identity in the condition or death lists causes the same
  // class of bug as a split holder - a character who is dead under one spelling
  // and alive under another.
  a.characterConditions = canonicalizeCharacterMap(a.characterConditions);
  {
    const nameMap = canonicalizeHolderNames(a.deadCharacters);
    a.deadCharacters = uniq(a.deadCharacters.map((n) => nameMap.get(n) || n));
  }

  return boundLedger(a);
}

/** Fold an ordered list of per-chapter ledgers (earliest first) into one. */
export function foldChapterLedgers(ledgers) {
  let acc = buildInitialLedger();
  for (const l of ledgers || []) acc = mergeLedgers(acc, l);

  // HOLDER-1a: a pairwise merge can only canonicalise against the names present
  // in those two ledgers. If ch.4 says "Lena Ortiz" and ch.6 says "Lena", the
  // ch.4 spelling is already gone by the time ch.6 merges. Resolve once more
  // against every name seen ANYWHERE in the fold, which is the whole cast.
  const allNames = [];
  for (const l of ledgers || []) {
    allNames.push(
      ...Object.keys(l?.possessions || {}),
      ...Object.keys(l?.characterConditions || {}),
      ...(Array.isArray(l?.deadCharacters) ? l.deadCharacters : [])
    );
  }
  const nameMap = canonicalizeHolderNames([...allNames, ...Object.keys(acc.possessions || {})]);
  const canon = (n) => nameMap.get(n) || n;

  const possessions = {};
  for (const [char, objs] of Object.entries(acc.possessions || {})) {
    const key = canon(char);
    possessions[key] = uniq([...(possessions[key] || []), ...(objs || [])]);
  }
  acc.possessions = possessions;

  const conditions = {};
  for (const [char, conds] of Object.entries(acc.characterConditions || {})) {
    const key = canon(char);
    conditions[key] = uniq([...(conditions[key] || []), ...(conds || [])]);
  }
  acc.characterConditions = conditions;
  acc.deadCharacters = uniq((acc.deadCharacters || []).map(canon));

  return acc;
}

/** One-line telemetry for the console. */
export function summarizeLedger(ledger) {
  const l = cloneLedger(ledger);
  const conds = Object.values(l.characterConditions).reduce((n, v) => n + (v || []).length, 0);
  const held = Object.values(l.possessions).reduce((n, v) => n + (v || []).length, 0);
  return `dead=${l.deadCharacters.length} conditions=${conds} destroyed=${l.unavailableObjects.length} held=${held} events=${l.completedEvents.length}`;
}
