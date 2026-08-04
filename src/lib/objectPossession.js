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
export function objectContentWords(obj) {
  return new Set(
    String(obj || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/).filter((w) => w && !['the', 'a', 'an', 'his', 'her', 'their'].includes(w))
  );
}

export function dedupeTrackedObjects(objects) {
  const entries = [...new Set((objects || []).map((o) => String(o || '').trim()).filter(Boolean))]
    .map((o) => ({ o, aliases: new Set(objectAliases(o)), words: objectContentWords(o) }));
  // HOLDER-2b: the alias rule compares {full phrase, head noun}, so two spellings
  // with DIFFERENT head nouns never merged - the live ch.5 run tracked
  // "Broken brass key handle" and "broken key handle" as two objects (heads
  // "handle" and "handle" but distinct phrases), each accumulating its own
  // holder. One phrase's content words being a strict subset of another's is the
  // same thing described more specifically; keep the specific spelling.
  const strictSubset = (a, b) => a.size < b.size && [...a].every((w) => b.has(w));
  return entries
    .filter((e) => !entries.some(
      (other) => other !== e && (
        (
          other.aliases.size >= e.aliases.size &&
          [...e.aliases].every((a) => other.aliases.has(a)) &&
          (other.aliases.size > e.aliases.size || other.o.length > e.o.length)
        ) || strictSubset(e.words, other.words)
      )
    ))
    .map((e) => e.o);
}

// KEYLEDGER-3: possession verbs whose direct object in a BEAT STATE names a
// tracked object. This parses the PLAN, never the prose - beat contracts are
// closed-world by definition. Measured disease: the ch.1 re-draft logged
// "tracked objects: (none)" while its own exit_state said "Lena holds the brass
// key" - first-acquisition chapters tracked nothing because the architect
// omitted props_present and chapter 1 has no prior ledger.
// OBJSEED-2: the capture was hard-capped at THREE words, which truncated the
// noun phrase BEFORE its head noun - and therefore before the only word the
// stopword filter could have judged. Proven on the live ch.4 beat contract:
// "Marcus has a severely injured left hand" captured "severely injured left"
// and stopped. "hand" is in SPEC_OBJECT_STOPWORDS and would have rejected the
// phrase outright, but the filter never saw it. The fragment entered the CLOSED
// tracked-object set, acquired a holder, failed the ch.5 possession audit in
// every scene, and drove three STATE-CONTRACT-REPAIR passes that rewrote real
// prose to satisfy a constraint describing nothing that exists.
// The phrase now runs to its natural boundary - punctuation still ends it, and
// the SEPARATION-1c function-word trim and the stopword filter still cut it
// back - so the head noun is always present to be judged. Filter the whole
// phrase, never a fragment of it.
const SPEC_POSSESSION_RX = /\b(?:holds?|holding|carr(?:y|ies|ying)|has|retrieves?|picks?\s+up|takes?|grabs?|pockets?|clutch(?:es)?|keeps?)\s+(?:the|a|an|his|her|their)\s+((?:[a-z][a-z-]*\s+){0,5}[a-z][a-z-]*)\b/gi;
const SPEC_POSSESSIVE_RX = /\bthe\s+((?:[\p{L}][\p{L}\p{M}-]*\s+){0,5}[\p{L}][\p{L}\p{M}-]*)\s+(?:is|remains?|stays?)\s+in\s+((?:[\p{L}][\p{L}\p{M}'’.-]*)(?:\s+[\p{L}][\p{L}\p{M}'’.-]*){0,3})['’]s?\s+possession\b/giu;
// Non-global sibling built from the SAME source so the two can never drift, and
// so .exec() inside a loop carries no lastIndex state.
const SPEC_POSSESSIVE_ONE = new RegExp(SPEC_POSSESSIVE_RX.source, 'iu');

// HOLDER-4c: honorific abbreviations, so their trailing period is not mistaken
// for a clause boundary.
const HONORIFIC_DOT_RX = /\b(?:mr|mrs|ms|miss|dr|prof|professor|sr|jr|st|lt|sgt|capt|col|gen|maj|rev|hon|madam|lady|lord)\./gi;

// HOLDER-4c: aliases that identify nobody on their own. castNameTokens() admits
// any whitespace token of 3+ characters, so "Edmund Wexcombe the younger" answers
// to "the" - which matches every clause ever written and would resolve a holder
// from a definite article. The full-name alias is never filtered.
const ALIAS_FUNCTION_WORDS = new Set([
  'the', 'and', 'but', 'for', 'with', 'from', 'that', 'this', 'who', 'whom',
  'her', 'his', 'its', 'their', 'they', 'was', 'were', 'are', 'has', 'had',
  'not', 'all', 'one', 'two', 'new', 'old', 'out', 'off', 'into', 'than',
  'then', 'when', 'what', 'where', 'which', 'some', 'any', 'own', 'she', 'him',
]);

/**
 * HOLDER-4c — which cast members does this text name?
 *
 * Uses the SAME identity machinery as every other consumer (normalizeCast /
 * castNameTokens, KEYLEDGER-2a) instead of matching the first whitespace token,
 * which silently resolved nobody for any name the app had not been debugged
 * against: "Mrs. Aldous", "O'Brien", "José Ramírez", "Mary Anne Fitch", and both
 * Edmund Wexcombes.
 *
 * Boundaries are Unicode-safe. \b is ASCII, so \bjosé\b cannot match "José's" -
 * the accented letter is not a word character and the boundary never fires.
 *
 * A match wholly CONTAINED in another member's match is dropped, so
 * "Edmund Wexcombe the younger" is the younger brother and not both brothers.
 * That is HOLDER-1a's prefix rule applied at the resolution layer.
 */
export function castMembersIn(text, roster) {
  const str = String(text || '');
  if (!str.trim()) return [];
  const spans = [];
  for (const c of Array.isArray(roster) ? roster : []) {
    const full = String(c?.name || '').toLowerCase();
    for (const alias of (c?.aliases || [])) {
      if (alias !== full && ALIAS_FUNCTION_WORDS.has(alias)) continue;
      const rx = new RegExp(`(?:^|[^\\p{L}\\p{M}])(${escapeRx(alias)})(?![\\p{L}\\p{M}])`, 'giu');
      let m;
      while ((m = rx.exec(str)) !== null) {
        const start = m.index + m[0].length - m[1].length;
        spans.push({ name: c.name, start, end: start + m[1].length });
        rx.lastIndex = m.index + m[0].length;
      }
    }
  }
  const kept = spans.filter((s) => !spans.some((o) =>
    o.name !== s.name && o.start <= s.start && o.end >= s.end && (o.end - o.start) > (s.end - s.start)));
  return [...new Set(kept.map((s) => s.name))];
}
/**
 * OBJSEED-2e — ONE list of words that END a tracked-object phrase.
 *
 * There were two of these, inline, in two functions, and they had drifted: the
 * seeding list was missing 'together', 'still', 'tightly' and 'loosely', and
 * NEITHER list contained a single locative preposition. So the live ch.2 opening
 * contract "Lena holds the activated brass decoder key in her pocket" seeded the
 * tracked object "activated brass decoder key in her" - a phantom no sentence of
 * prose can ever match, which then demands a written handover that can never be
 * satisfied and blocks the scene.
 *
 * This is the session's recurring defect shape one more time: two components
 * disagreeing about the same fact with no single authority. One exported Set,
 * imported by every consumer, is the authority.
 *
 * The rule: a HOLD verb's object ends where the sentence stops naming the thing
 * and starts saying where it is, where it is going, or how it is held. 'of' is
 * deliberately absent - "sheaf of documents" and "set of winding keys" are single
 * objects, not an object plus a location.
 */
export const PHRASE_END_WORDS = new Set([
  // clause joiners
  'and', 'or', 'but', 'while', 'as', 'so', 'than', 'then',
  // purpose, direction, recipient
  'to', 'into', 'onto', 'toward', 'towards', 'for', 'from', 'with', 'through',
  // locative - where the object IS, which is not part of what it is
  'in', 'inside', 'within', 'outside', 'at', 'on', 'under', 'underneath',
  'beneath', 'behind', 'between', 'among', 'amongst', 'against', 'beside',
  'besides', 'near', 'atop', 'upon', 'over', 'above', 'below', 'across',
  'around', 'past', 'along', 'beyond', 'by',
  // particles that turn a hold into a gesture
  'up', 'down', 'out', 'off', 'back', 'away', 'aside', 'apart', 'forward',
  // manner adverbs
  'still', 'together', 'tightly', 'tight', 'loosely', 'firmly', 'gently',
  'carefully', 'protectively', 'awkwardly', 'lightly',
]);

const SPEC_OBJECT_STOPWORDS = new Set([
  'truth', 'secret', 'secrets', 'past', 'lead', 'way', 'stairs', 'group', 'situation',
  'moment', 'time', 'silence', 'darkness', 'cold', 'air', 'wall', 'walls', 'floor',
  'door', 'doors', 'corridor', 'station', 'tunnel', 'chamber', 'room', 'hall',
  'entrance', 'exit', 'surface', 'ice', 'snow', 'water', 'light', 'lights',
  // body/idiom objects of possession verbs that are not props
  'breath', 'breaths', 'hand', 'hands', 'eyes', 'gaze', 'balance', 'ground',
  'pace', 'step', 'steps', 'distance', 'watch', 'point', 'charge', 'command',
  'initiative', 'advantage', 'chance', 'risk', 'look', 'seat', 'position',
  // OBJSEED-2b: FIXTURES. A possession ledger tracks what can change hands. The
  // live ch.4 plan listed "Hidden console" as a prop; the ch.5 possession audit
  // then demanded a written handover of a console between two people, and the
  // repair complied by inventing a detail to make it holdable - "He ran his hand
  // over the console, feeling the texture of the worn leather." A bolted-down
  // fixture cannot be carried, so it cannot have a holder. This is a blocklist,
  // which does not generalise; the durable answer is a portability test on the
  // prop itself. Until that exists, these are the fixtures the plans produce.
  'console', 'panel', 'terminal', 'hatch', 'ladder', 'generator', 'pedestal',
  'shaft', 'vent', 'vents', 'grate', 'reactor', 'core', 'ceiling', 'roof',
  'window', 'bulkhead', 'lift', 'elevator', 'junction', 'valve', 'beam', 'pipe',
  'pipes', 'railing', 'handrail', 'seal', 'seals', 'lock', 'machinery',
  // HOLDER-2c: ABSTRACTIONS. Nobody hands anyone a decision. The live ch.5 run
  // seeded "weight of her decision" from the exit_state "Lena carries the weight
  // of her decision", and the possession audit then wanted a written handover
  // for it. Carrying a burden is a metaphor; the ledger tracks physical props.
  'weight', 'decision', 'decisions', 'guilt', 'burden', 'fate', 'blame',
  'consequence', 'consequences', 'responsibility', 'memory', 'memories',
  'trust', 'hope', 'fear', 'doubt', 'grief', 'anger', 'silence', 'knowledge',
]);

// HOLDER-1c: words that cannot END a noun phrase. A phrase finishing on a
// modifier is a truncated fragment, not a thing. OBJSEED-2 stopped GENERATING
// "severely injured left", but that fragment is already written into the saved
// ch.4 ledger and the chapter fold carries it forward forever unless it is also
// rejected on READ. Judged at the head-noun position only, so "left boot" and
// "broken brass key handle" are unaffected.
const NON_HEAD_WORDS = new Set([
  'left', 'right', 'upper', 'lower', 'front', 'rear', 'inner', 'outer',
  'injured', 'broken', 'damaged', 'wounded', 'severed', 'cracked', 'burned',
  'severely', 'badly', 'partially', 'hidden', 'small', 'large', 'old', 'new',
  'dark', 'pale', 'empty', 'full', 'heavy', 'light', 'other', 'same', 'own',
]);

/** OBJSEED-2b — is this phrase something a person could actually hold?
 *  Judged on the WHOLE phrase (head noun included) after any possessive owner
 *  prefix is stripped, so "Dr. Vale's cane" is judged on "cane". */
export function isPortablePropPhrase(phrase) {
  const p = String(phrase || '').trim().toLowerCase()
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/^(?:dr|mr|mrs|ms|prof|professor|doctor)\.?\s+/, '')
    .replace(/^[a-z][a-z-]*['’]s\s+/, '');
  const words = p.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (NON_HEAD_WORDS.has(words[words.length - 1])) return false;
  return !words.some((w) => SPEC_OBJECT_STOPWORDS.has(w.replace(/[^a-z-]/g, '')));
}

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
        // OBJSEED-2e: the shared list, not a private copy.
        const rawWords = phrase.split(' ');
        const fnIdx = rawWords.findIndex((w) => PHRASE_END_WORDS.has(w));
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

/**
 * HOLDER-4 — who holds what when the CHAPTER OPENS, according to the plan.
 *
 * The inherited ledger is a record of what previous chapters happened to write.
 * The first scene's `entry_state` is the contract the writer is actually handed,
 * and the prose will follow it. When the two disagree, every possession audit in
 * the chapter fails on the FIRST mention, because the prose obeys the plan and
 * the audit obeys the ledger.
 *
 * Live proof, ch.5 at ef5a0d16: entry_state said "Lena holds the broken brass
 * key handle"; the folded ledger said Marcus Reed held it. Scene 1 was rejected
 * on "Lena slipped the broken handle into her pocket." — the writer doing exactly
 * what it was told. Three repair passes could not fix a scene that was correct.
 *
 * Returns { object -> holder } read ONLY from the plan, with the cast as the
 * closed world of who can hold anything, and the same portability filter applied
 * to the object. A sentence naming two cast members before the verb is ambiguous
 * and is skipped rather than guessed at.
 */
export function holdersFromSpecState(spec, cast) {
  const out = new Map();
  const text = String(spec?.entry_state || '');
  if (!text.trim()) return out;
  const roster = normalizeCast(cast);
  if (!roster.length) return out;

  // Split on clause boundaries so "Lena holds the key, while Marcus has a hand"
  // is read as two independent claims.
  // Split on punctuation and "while" ONLY. Splitting on "and" would tear a
  // conjoined subject in half - "Lena and Marcus hold the key together" would
  // become a clause naming only Marcus and be credited to him. A clause naming
  // two cast members is ambiguous and is skipped below; that is the safe answer.
  // HOLDER-4c: an honorific's period is not a clause boundary. Splitting raw
  // text turned "the key is in Mrs. Aldous's possession" into "...is in Mrs"
  // plus " Aldous's possession", and neither half is a possession claim. The
  // period is masked for the split and restored immediately, so the split
  // TOKENS are unchanged - only the false boundary is removed.
  const MASK = '\u0001';
  const clauses = text
    .replace(HONORIFIC_DOT_RX, (h) => h.slice(0, -1) + MASK)
    .split(/[,.;]|\bwhile\b/i)
    .map((c) => c.split(MASK).join('.'));
  const VERB = /\b(?:holds?|holding|carr(?:y|ies|ying)|has|keeps?|clutch(?:es)?|grips?)\s+(?:the|a|an|his|her|their)\s+((?:[a-z][a-z-]*\s+){0,5}[a-z][a-z-]*)/i;
  for (const clause of clauses) {
    let holder = null;
    let raw = null;
    const m = VERB.exec(clause);
    if (m) {
      const named = castMembersIn(clause, roster);
      if (named.length !== 1) continue; // nobody, or ambiguous
      holder = named[0];
      raw = m[1];
    } else {
      // HOLDER-4b: the same claim in the PASSIVE voice. The architect writes
      // "The broken brass key handle is in Lena's possession" as often as it
      // writes "Lena holds the ...", and the active-only VERB left the opening
      // ledger empty on the live ch.5 run - HOLDER-4 never fired in production.
      const pm = SPEC_POSSESSIVE_ONE.exec(clause);
      if (!pm) continue;
      // Resolve the possessor NAMED IN THE TEXT, not whoever else the clause
      // mentions. Without this, "Lena knew the key is in Vale's possession"
      // credits the key to Lena - the clause names her, the text does not.
      const owner = castMembersIn(pm[2], roster);
      if (owner.length !== 1) continue;
      holder = owner[0];
      raw = pm[1];
    }
    let phrase = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    // OBJSEED-2e: the shared list, not a private copy.
    const words = phrase.split(' ');
    const fnIdx = words.findIndex((w) => PHRASE_END_WORDS.has(w));
    if (fnIdx >= 0) phrase = words.slice(0, fnIdx).join(' ');
    if (!phrase || !isPortablePropPhrase(phrase)) continue;
    out.set(phrase, holder);
  }
  return out;
}

/** The CLOSED tracked-object set, derived from the plan and nothing else. */
export function trackedObjectsFromSpecs(specs) {
  const seen = new Map();
  for (const spec of Array.isArray(specs) ? specs : []) {
    for (const prop of Array.isArray(spec?.props_present) ? spec.props_present : []) {
      const p = String(prop || '').trim();
      if (p.length <= 2 || p.length >= 40) continue;
      // OBJSEED-2b: props_present bypassed the stopword filter entirely - the
      // same blocklist that guards a SEEDED phrase was never applied to a
      // DECLARED one, so an architect listing "Hidden console" (or a door, or a
      // corridor) put a fixture straight into the possession ledger. Same world,
      // same rules, both doors.
      if (!isPortablePropPhrase(p)) continue;
      seen.set(p.toLowerCase(), p);
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
