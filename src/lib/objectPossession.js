// KEYLEDGER-1b — closed-world object-possession continuity.
//
// WHY THIS IS NOT ANOTHER VERB-SHAPE GATE. The tracked-object set is CLOSED and
// comes from the plan (props_present + entry/exit states), never from prose
// parsing. Inside that closed set EVERY mention of the object is classified, and
// possession may change ONLY through an explicit transfer written on the page. A
// holder assertion that disagrees with the established holder with no transfer
// between them is a fabricated fact, and is reported with both sentences quoted.
// Same discipline as the quote gates: the fact exists in the evidence, or it does
// not ship.
//
// MEASURED on the live Brass Meridian TEST saves (ch.1-5, 21,344 words, 161 object
// mentions) with per-chapter scene casts: ch1 0 · ch2 0 · ch3 0 · ch4 2 · ch5 3
// violations. All three ch.5 hits are the defects manuscript audit #6 confirmed by
// hand. The old machinery scored 0 possession facts and 0 violations on the same
// text — it was inert, not merely imprecise.

import {
  escapeRx, normalizeCast, resolveReferent, resolveClauseSubject, trackLastNamed,
} from './referentResolver.js';

const HOLD_V = /\b(held|holds|holding|gripped|grips|gripping|clutched|clutches|clutching|palmed|carried|carries|carrying|kept|keeps)\b/i;
// Offering is NOT a transfer: the offerer still holds it until someone takes it.
const OFFER_V = /\b(?:held|holds|holding|hold)\s+(?:it|them|the\s+[a-z ]{1,24}?)?\s*\b(?:out|up)\b|\boffered\b|\bextended\b/i;
const TAKE_V = /\b(took|takes|taking|grabbed|grabs|snatched|snatches|retrieved|retrieves|accepted|accepts)\b|\bpicked\s+(?:it\s+|them\s+)?up\b|\bclosed\s+(?:his|her|their)\s+(?:fingers|hand|fist)\s+(?:around|over)\b|\b(?:his|her|their)\s+(?:fingers|hand|fist)\s+closed\s+(?:around|over)\b|\btightened\s+(?:his|her|their)\s+grip\b/i;
const GIVE_V = /\b(handed|hands|gave|gives|passed|passes|pressed|presses|tossed|threw|throws|surrendered|returned)\b/i;
const STOW_V = /\b(slipped|slid|tucked|dropped|pushed|shoved|put|jammed|returned|buried)\b/i;
const RETRIEVE_V = /\b(drew|draws|fished|fishes|pulled|pulls|dug|digs|took|takes)\b/i;
const GONE_V = /\b(?:was|is|were)\s+gone\b|\bvanished\b|\bdisappeared\b|\bswallowed\b|\bshattered\b|\bdestroyed\b/i;
// A clause that reports someone LOOKING at the object asserts nothing about who holds it.
const PERCEPTION_V = /\b(saw|sees|seeing|looked|looks|looking|watched|watches|watching|stared|stares|staring|knew|knows|noticed|notices|thought|thinks|glanced|glances|studied|studies|examined|examines|eyed|eyes)\b/i;
// Recollection and hypotheticals report the past, not the present scene state.
const MEMORY_V = /\b(?:the\s+)?(?:memory|memories|recollection)\s+of\b|\bremembered\b|\bremembering\b|\bhad\s+(?:held|taken|carried|kept|given|handed)\b|\bwould\s+have\b|\bimagined\b|\bdreamed\b|\bwished\b|\bused\s+to\b/i;

const BODY_N = '(?:hand|hands|palm|palms|fist|fingers|grip|pocket|pockets)';
const BODY_OWNER = new RegExp(
  `\\b(his|her|their|[A-Z][a-z]+(?:'s|’s))\\s+(?:right\\s+|left\\s+|coat\\s+|jacket\\s+|parka\\s+|open\\s+|gloved\\s+|bare\\s+|front\\s+|breast\\s+)*${BODY_N}\\b`
);

export function splitSentences(text) {
  return String(text || '').replace(/\r/g, '')
    .split(/(?<=[.!?]["”’']?)\s+|\n{2,}/)
    .map((s) => s.trim()).filter(Boolean);
}

/** Aliases for a tracked object phrase: the full phrase and its head noun. */
export function objectAliases(phrase) {
  const p = String(phrase || '').trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '');
  if (!p) return [];
  const words = p.split(/\s+/);
  const head = words[words.length - 1];
  const out = new Set([p]);
  if (head && head.length > 2) out.add(head);
  return [...out];
}

/** KEYLEDGER-2d — one object, one tracking stream. "Brass Key" and "key" were
 *  tracked as two objects on the live ch.4 run; both alias to the head noun
 *  "key", so every key sentence would produce two violation streams once the
 *  gate engages. An object whose alias set is contained in another tracked
 *  object's alias set is the same object - keep the more specific phrase. */
export function dedupeTrackedObjects(objects) {
  const entries = [...new Set((objects || []).map((o) => String(o || '').trim()).filter(Boolean))]
    .map((o) => ({ o, aliases: new Set(objectAliases(o)) }));
  return entries
    .filter((e) => !entries.some(
      (other) => other !== e &&
        other.aliases.size >= e.aliases.size &&
        [...e.aliases].every((a) => other.aliases.has(a)) &&
        (other.aliases.size > e.aliases.size || other.o.length > e.o.length)
    ))
    .map((e) => e.o);
}

// KEYLEDGER-3: possession verbs whose direct object in a BEAT STATE names a
// tracked object. This parses the PLAN, never the prose - beat contracts are
// closed-world by definition. Measured disease: the ch.1 re-draft logged
// "tracked objects: (none)" while its own exit_state said "Lena holds the brass
// key" - first-acquisition chapters tracked nothing because the architect
// omitted props_present and chapter 1 has no prior ledger.
const SPEC_POSSESSION_RX = /\b(?:holds?|holding|carr(?:y|ies|ying)|has|retrieves?|picks?\s+up|takes?|grabs?|pockets?|clutch(?:es)?|keeps?)\s+(?:the|a|an|his|her|their)\s+((?:[a-z][a-z-]*\s+){0,2}[a-z][a-z-]*)\b/gi;
const SPEC_POSSESSIVE_RX = /\bthe\s+((?:[a-z][a-z-]*\s+){0,2}[a-z][a-z-]*)\s+(?:is|remains?|stays?)\s+in\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?['’]s\s+possession\b/gi;
const SPEC_OBJECT_STOPWORDS = new Set([
  'truth', 'secret', 'secrets', 'past', 'lead', 'way', 'stairs', 'group', 'situation',
  'moment', 'time', 'silence', 'darkness', 'cold', 'air', 'wall', 'walls', 'floor',
  'door', 'doors', 'corridor', 'station', 'tunnel', 'chamber', 'room', 'hall',
  'entrance', 'exit', 'surface', 'ice', 'snow', 'water', 'light', 'lights',
  // body/idiom objects of possession verbs that are not props
  'breath', 'breaths', 'hand', 'hands', 'eyes', 'gaze', 'balance', 'ground',
  'pace', 'step', 'steps', 'distance', 'watch', 'point', 'charge', 'command',
  'initiative', 'advantage', 'chance', 'risk', 'look', 'seat', 'position',
]);

/** Extract tracked-object phrases from the beat contract's own state strings. */
export function seedTrackedObjectsFromSpecStates(specs) {
  const seen = new Map();
  // SEPARATION-1c/OBJSEED-1: the plan's own cast is the closed world of who is a
  // PERSON. A seeded phrase containing a character name is never an object -
  // the live ch.3 run tracked "key and marcus" (head noun "marcus"), which would
  // have made the possession scanner treat a person as a prop.
  const castTokens = new Set();
  for (const spec of Array.isArray(specs) ? specs : []) {
    const names = [
      ...(Array.isArray(spec?.characters_present) ? spec.characters_present : []),
      ...(Array.isArray(spec?.characters) ? spec.characters : []),
    ];
    for (const n of names) {
      for (const tok of String(n || '').toLowerCase().split(/\s+/)) {
        const t = tok.replace(/[^a-z-]/g, '');
        if (t.length > 2 && !['dr', 'mr', 'mrs', 'ms', 'the'].includes(t)) castTokens.add(t);
      }
    }
  }
  const harvest = (text) => {
    const str = String(text || '');
    for (const rx of [SPEC_POSSESSION_RX, SPEC_POSSESSIVE_RX]) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(str)) !== null) {
        let phrase = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
        // SEPARATION-1c: trim the phrase at the first FUNCTION word - "takes
        // the key to explore another section" must seed "key", not the phantom
        // object "key to explore" (which the live ch.3 run tracked, alias
        // "explore"). Function words end the noun phrase; content stopwords
        // below still reject the whole phrase.
        const FN_WORDS = new Set(['to', 'into', 'with', 'for', 'from', 'at', 'on', 'onto', 'toward', 'towards', 'through', 'under', 'behind', 'and', 'or', 'but', 'while', 'as', 'so']);
        const rawWords = phrase.split(' ');
        const fnIdx = rawWords.findIndex((w) => FN_WORDS.has(w));
        if (fnIdx >= 0) phrase = rawWords.slice(0, fnIdx).join(' ');
        const words = phrase.split(' ').filter(Boolean);
        if (phrase.length < 3 || phrase.length > 40) continue;
        // Any stopword ANYWHERE in the phrase disqualifies it ("takes the stairs
        // down" must not track "stairs down"), and a phrase ending in a direction
        // word is motion, not an object.
        if (words.some((w) => SPEC_OBJECT_STOPWORDS.has(w))) continue;
        if (words.some((w) => castTokens.has(w))) continue;
        if (/^(?:down|up|back|away|out|off|over|again|inside|outside|forward|ahead)$/.test(words[words.length - 1])) continue;
        seen.set(phrase, phrase);
      }
    }
  };
  for (const spec of Array.isArray(specs) ? specs : []) {
    harvest(spec?.entry_state);
    harvest(spec?.exit_state);
    for (const ev of Array.isArray(spec?.required_events) ? spec.required_events : []) harvest(ev);
  }
  return dedupeTrackedObjects([...seen.values()]);
}

/** The CLOSED tracked-object set, derived from the plan and nothing else. */
export function trackedObjectsFromSpecs(specs) {
  const seen = new Map();
  for (const spec of Array.isArray(specs) ? specs : []) {
    for (const prop of Array.isArray(spec?.props_present) ? spec.props_present : []) {
      const p = String(prop || '').trim();
      if (p.length > 2 && p.length < 40) seen.set(p.toLowerCase(), p);
    }
  }
  // KEYLEDGER-3: the plan's own state text fills the gap when props_present is
  // missing - both sources are plan-side, so the world stays closed.
  for (const seeded of seedTrackedObjectsFromSpecStates(specs)) {
    if (!seen.has(seeded.toLowerCase())) seen.set(seeded.toLowerCase(), seeded);
  }
  return dedupeTrackedObjects([...seen.values()]);
}

const objectRx = (aliases) => new RegExp(`\\b(?:${aliases.map(escapeRx).join('|')})\\b`, 'i');

function quotedSpans(text) {
  const spans = [];
  const rx = /[“"]([^“”"]{1,600})[”"]/g;
  let m;
  while ((m = rx.exec(text)) !== null) spans.push([m.index, m.index + m[0].length]);
  return spans;
}
const inSpans = (spans, i) => spans.some(([a, b]) => i >= a && i < b);

/** Split a sentence so a subordinate possession clause ("the way HE held the key")
 *  is not attributed to the main subject ("SHE saw"). */
export function splitClauses(sentence) {
  return String(sentence || '')
    .split(/,\s+|;\s+|—|\bbut\b|\band then\b|\bwhile\b|\bas\b|\bthe way\b|\bwhen\b|\bthat\b|\bwhere\b/i)
    .map((c) => c.trim()).filter(Boolean);
}

/** The object must be the DIRECT OBJECT of the verb: verb + optional adverb +
 *  determiner + at most two modifiers + the object. "held the brass key" passes;
 *  "kept his eyes on the key" does not. */
function isDirectObject(clause, verbSource, aliases) {
  const alt = aliases.map(escapeRx).join('|');
  return new RegExp(
    `${verbSource}\\s+(?:\\w+ly\\s+)?(?:out\\s+|up\\s+)?(?:the|his|her|their|that|this|a|one)?\\s*(?:\\w+\\s+){0,2}(?:${alt})\\b`,
    'i'
  ).test(clause);
}

/**
 * Ordered event timeline for one tracked object.
 * kind ∈ HOLD | TAKE | GIVE | STOW | RETRIEVE | OFFER | GONE | NEUTRAL
 * Every event carries { holder, confidence } — see referentResolver.js.
 */
export function scanObjectTimeline({ prose, object, cast }) {
  const roster = normalizeCast(cast);
  const aliases = objectAliases(object);
  if (!aliases.length || !roster.length) return [];
  const objRx = objectRx(aliases);
  const text = String(prose || '');
  const spans = quotedSpans(text);
  const sentences = splitSentences(text);
  const lastNamedByGender = {};
  const events = [];
  let cursor = 0;

  let lastMentionIndex = -1;

  sentences.forEach((sentence, i) => {
    const at = text.indexOf(sentence, cursor);
    if (at >= 0) cursor = at + sentence.length;
    trackLastNamed(sentence, roster, lastNamedByGender);
    if (!objRx.test(sentence)) {
      // KEYLEDGER-2b: a handover written with a PRONOUN object is a real transfer.
      // Measured on the live ch.4 draft: "He pressed it into her hand." carries the
      // key from Marcus to Lena but never names the key, so the scanner was blind
      // to it and the continuity check accused a transfer that WAS on the page.
      // Only honored within two sentences of the last mention of THIS object, and
      // only with an explicit recipient - anything looser re-imports ambiguity.
      if (lastMentionIndex >= 0 && i - lastMentionIndex <= 2 && !(at >= 0 && inSpans(spans, at))) {
        const give = /\b(handed|hands|gave|gives|passed|passes|pressed|presses|slid|slides|tossed|threw)\s+(?:it|them)\b/i.exec(sentence);
        const take = /\b(took|takes|grabbed|grabs|snatched|snatches|accepted|accepts)\s+(?:it|them)\b|\bclosed\s+(?:his|her|their)\s+(?:fingers|hand|fist)\s+(?:around|over)\s+(?:it|them)\b/i.exec(sentence);
        if (give) {
          const into = /\b(?:into|in)\s+([A-Z][a-z]+(?:'s|\u2019s)|his|her|their)\s+(?:open\s+|gloved\s+|right\s+|left\s+)*(?:palm|hand|hands|fingers|fist)\b/.exec(sentence);
          const to = /\bto\s+(him|her|[A-Z][a-z]+)\b/.exec(sentence);
          const raw = (into && into[1]) || (to && to[1]) || null;
          const recipientRef = resolveReferent(raw, roster, lastNamedByGender);
          if (recipientRef) {
            lastMentionIndex = i;
            events.push({ index: i, kind: 'GIVE', holder: recipientRef.name, sentence, reason: 'pronoun-transfer-out', confidence: recipientRef.confidence });
            return;
          }
        }
        if (take) {
          const subjectRef = resolveClauseSubject(sentence, roster, lastNamedByGender);
          if (subjectRef) {
            lastMentionIndex = i;
            events.push({ index: i, kind: 'TAKE', holder: subjectRef.name, sentence, reason: 'pronoun-transfer-in', confidence: subjectRef.confidence });
            return;
          }
        }
      }
      return;
    }
    lastMentionIndex = i;

    const push = (kind, holder, reason, confidence) => {
      events.push({ index: i, kind, holder: holder || null, sentence, reason, confidence: confidence || null });
    };

    // Dialogue is talk ABOUT the object, not a claim about who is holding it.
    if (at >= 0 && inSpans(spans, at + sentence.search(objRx))) return push('NEUTRAL', null, 'quoted');

    const clauses = splitClauses(sentence);
    const objClauseIdx = clauses.findIndex((c) => objRx.test(c));
    const objClause = objClauseIdx >= 0 ? clauses[objClauseIdx] : sentence;
    const subjectRef = resolveClauseSubject(objClause, roster, lastNamedByGender)
      || (objClauseIdx > 0 ? resolveClauseSubject(clauses[objClauseIdx - 1], roster, lastNamedByGender) : null);
    const subject = subjectRef ? subjectRef.name : null;
    const subjectConf = subjectRef ? subjectRef.confidence : null;

    if (MEMORY_V.test(objClause)) return push('NEUTRAL', null, 'memory');
    if (GONE_V.test(objClause) && !TAKE_V.test(objClause)) return push('GONE', null, 'gone');

    if (GIVE_V.test(objClause)) {
      const into = /\b(?:into|in)\s+([A-Z][a-z]+(?:'s|’s)|his|her|their)\s+(?:open\s+|gloved\s+|right\s+|left\s+)*(?:palm|hand|fingers|fist)\b/.exec(objClause);
      const to = /\bto\s+([A-Z][a-z]+)\b/.exec(objClause);
      const indirect = new RegExp(`\\b(?:handed|hands|gave|gives|passed|passes|tossed|threw|throws)\\s+(him|her|them|${roster.map((c) => escapeRx(c.name)).join('|')})\\b`, 'i').exec(objClause);
      const raw = (into && into[1]) || (to && to[1]) || (indirect && indirect[1]) || null;
      const recipientRef = resolveReferent(raw, roster, lastNamedByGender);
      // "slipped it into HIS pocket" with a male subject is a stow, not a gift.
      if (recipientRef && !(recipientRef.name === subject && /^(his|her|their)$/i.test(String(raw)))) {
        return push('GIVE', recipientRef.name, 'transfer-out', recipientRef.confidence);
      }
      return push('NEUTRAL', null, 'give-no-recipient');
    }

    if (TAKE_V.test(objClause) && (isDirectObject(objClause, TAKE_V.source, aliases) || /\b(?:around|over)\b/i.test(objClause))) {
      return push('TAKE', subject, 'transfer-in', subjectConf);
    }

    const body = BODY_OWNER.exec(objClause);
    if (body && /pocket/i.test(body[0])) {
      const ownerRef = resolveReferent(body[1], roster, lastNamedByGender);
      const owner = ownerRef ? ownerRef.name : null;
      const conf = ownerRef ? ownerRef.confidence : subjectConf;
      if (STOW_V.test(objClause)) return push('STOW', owner || subject, 'stow', owner ? conf : subjectConf);
      if (RETRIEVE_V.test(objClause)) return push('RETRIEVE', owner || subject, 'retrieve', owner ? conf : subjectConf);
      if (!PERCEPTION_V.test(objClause)) return push('HOLD', owner || subject, 'in-pocket', owner ? conf : subjectConf);
      return push('HOLD', owner, 'perceived-in-pocket', conf);
    }

    if (OFFER_V.test(objClause)) return push('OFFER', subject, 'offer', subjectConf);

    if (body) {
      const ownerRef = resolveReferent(body[1], roster, lastNamedByGender);
      if (ownerRef) return push('HOLD', ownerRef.name, 'locative', ownerRef.confidence);
    }

    if (HOLD_V.test(objClause) && isDirectObject(objClause, HOLD_V.source, aliases)) {
      if (PERCEPTION_V.test(objClause) && !HOLD_V.test(objClause.replace(PERCEPTION_V, ''))) {
        return push('NEUTRAL', null, 'perception');
      }
      return push('HOLD', subject, 'hold-verb', subjectConf);
    }

    return push('NEUTRAL', null, 'mention');
  });

  return events;
}

/**
 * Closed-world continuity check for one tracked object.
 * @param entryHolder who holds it when the prose opens (from the ledger)
 * @returns { events, violations, exitHolder }
 */
export function checkPossessionContinuity({ prose, object, cast, entryHolder = null }) {
  const events = scanObjectTimeline({ prose, object, cast });
  const violations = [];
  let holder = entryHolder || null;
  let holderConf = entryHolder ? 'high' : null;
  let holderSentence = null;

  for (const ev of events) {
    if (ev.kind === 'GONE') { holder = null; holderConf = 'high'; holderSentence = ev.sentence; continue; }
    if (ev.kind === 'OFFER' || ev.kind === 'NEUTRAL') continue;
    if (ev.kind === 'TAKE' || ev.kind === 'GIVE') {
      if (ev.holder && ev.confidence === 'high') { holder = ev.holder; holderConf = 'high'; holderSentence = ev.sentence; }
      continue;
    }
    // HOLD / STOW / RETRIEVE assert who has it right now.
    if (!ev.holder) continue;
    if (ev.confidence !== 'high') continue; // ambiguous reference: neither assert nor accuse
    if (holder === null) { holder = ev.holder; holderConf = 'high'; holderSentence = ev.sentence; continue; }
    if (ev.holder !== holder && holderConf === 'high') {
      violations.push({
        code: 'OBJECT_POSSESSION_TELEPORT',
        object,
        from: holder,
        to: ev.holder,
        sentence: ev.sentence,
        priorSentence: holderSentence,
        message:
          `"${object}" was last established with ${holder}` +
          (holderSentence ? ` ("${holderSentence.slice(0, 120)}")` : '') +
          `, then appears in ${ev.holder}'s possession with no transfer written between them: ` +
          `"${ev.sentence.slice(0, 160)}". Either write the handover or keep it with ${holder}.`,
      });
      holder = ev.holder;
      holderSentence = ev.sentence;
    } else if (ev.holder === holder) {
      holderSentence = ev.sentence;
    }
  }

  return { events, violations, exitHolder: holder };
}
