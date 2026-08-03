import { getTrustedCharacters } from './narrativeLedger.js';
import { normalizeCast, resolveReferent, trackLastNamed } from './referentResolver.js';
import { checkPossessionContinuity } from './objectPossession.js';

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

// DUPEVENTFIX-1: content-stem overlap between two passages. Used to decide whether
// two paragraphs are the SAME retelling rather than two parts of one unfolding beat.
const DUPLICATE_PASSAGE_MIN_SIMILARITY = 0.5;

function paragraphSimilarity(a, b) {
  const A = signature(a || '');
  const B = signature(b || '');
  if (!A.length || !B.length) return 0;
  const bSet = new Set(B);
  let shared = 0;
  for (const token of new Set(A)) {
    if (bSet.has(token)) shared += 1;
  }
  const union = new Set([...A, ...B]).size;
  return union ? shared / union : 0;
}

function paragraphHits(eventText, proseText) {
  return String(proseText || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 80)
    .map((part, index) => ({ index, result: coverage(eventText, part) }))
    .filter((entry) => entry.result.hit);
}

// DEADSPEECH-1: true when `index` falls inside an open quotation. Counts smart quote
// boundaries from the start of the text; straight quotes are ambiguous (apostrophes) and
// are deliberately NOT counted, so a passage using them behaves exactly as before.
function isInsideQuotedSpan(text, index) {
  let inside = false;
  for (let i = 0; i < index && i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\u201c') inside = true;
    else if (ch === '\u201d') inside = false;
  }
  return inside;
}

export function extractLimbFacts(text, cast = null) {
  const source = String(text || '');
  // KEYLEDGER-1c: with a cast in hand, ownership is resolved gender-consistently.
  // Called with no cast, behaviour is unchanged.
  const roster = cast ? normalizeCast(cast) : [];
  const lastNamedByGender = {};
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
      // KEYLEDGER-2e: with a cast in hand, only a cast member can own a condition.
      if (roster.length) {
        const ref = resolveReferent(possessive[1], roster, lastNamedByGender);
        if (ref && ref.confidence === 'high') return ref.name;
      } else {
        return possessive[1];
      }
    }

    const direct = sentence.match(/\b([A-Z][a-z]{2,})\b/);
    if (direct && !ignoredNames.has(direct[1])) {
      // KEYLEDGER-2e: the first capitalised word is often not a person at all.
      // Measured on the live ch.5 draft: "Now he stood ten feet away, his left
      // sleeve pinned flat" recorded a character literally named "Now" with an
      // empty sleeve. With a cast, an unrecognised capitalised word falls
      // through to the pronoun branch - "Now HE stood" is about HE.
      if (roster.length) {
        const ref = resolveReferent(direct[1], roster, lastNamedByGender);
        if (ref && ref.confidence === 'high') return ref.name;
      } else {
        return direct[1];
      }
    }

    // KEYLEDGER-1c — GENDER LOCK. The old fallback handed the sentence to whoever
    // was named last, with no gender check. Measured on the live ch.4 save,
    // "His left hand, the one missing its fingers, rested against his chest"
    // was recorded as LENA's limb because Lena was named in the previous
    // sentence. A male pronoun cannot refer to a female character.
    const pronoun = sentence.match(/\b(he|his|him|she|her|hers)\b/i);
    if (pronoun) {
      if (roster.length) {
        const ref = resolveReferent(pronoun[1], roster, lastNamedByGender);
        return ref && ref.confidence === 'high' ? ref.name : null;
      }
      if (lastCharacter) return lastCharacter;
    }

    return null;
  }

  function addFact(character, side, sentence, kind, part = null) {
    if (!character || !side) return;

    facts.push({
      character: character.toLowerCase(),
      displayName: character,
      side: side.toLowerCase(),
      part: part ? String(part).toLowerCase() : null,
      sentence,
      kind,
    });
  }

  for (const sentence of sentences) {
    if (roster.length) trackLastNamed(sentence, roster, lastNamedByGender);
    const character = canonicalCharacter(sentence);

    if (
      character &&
      !/\b(?:he|his|him|she|her|hers)\b/i.test(character)
    ) {
      lastCharacter = character;
    }

    // KEYLEDGER-1c: with a cast, an unresolved pronoun sentence is DROPPED rather
    // than handed to whoever was named last — that fallback is exactly how
    // Marcus's severed hand was recorded against Lena on the live ch.4 save.
    const owner = character || (roster.length ? null : lastCharacter);
    if (!owner) continue;

    // EXTRACTFIX-1: the limb vocabulary gained the words real trauma prose actually
    // uses. Audit of brassmeridiantest 7 (2026-07-30): Chapter 3 amputates Marcus's
    // left hand on the page, Chapter 4 then writes "the injury in his left hand was
    // throbbing; she could see the tremor in his fingers" - fingers on a hand that is
    // gone. Cause was NOT the ledger transport, which works. It was here: the ONE
    // sentence that establishes the injury is
    //
    //   "Marcus stood frozen. His left arm hung at his side, the hand a mangled mess
    //    of red and white, fingers splayed at unnatural angles..."
    //
    // `left arm` matched, the owner resolved correctly to Marcus, and then nothing
    // fired because `mangled` was not a loss word. So Ch.3 saved conditions=0, Ch.4
    // was told nothing, and Ch.4 wrote "hand".
    //
    // These are ADDITIONS TO AN EXISTING CATEGORY - words that mean this limb is
    // destroyed - not a widening of the matcher. The structure is untouched: a side
    // (left|right) and a limb noun are still both required, still within 70 characters,
    // still in the same sentence, still needing a resolvable owner. Regression test 30
    // documents a blind chronology-verb widening that had to be reverted; do not repeat it.
    // INJURYSCALE-1a: each pattern now CAPTURES the body part alongside the side.
    // Measured disease (Brass Meridian export 12): ch.3 severs Marcus's THUMB at
    // the second joint, ch.5 gives him an empty pinned SLEEVE - a whole arm. The
    // ledger stored "left amputated/severed" with no part, so nothing could see
    // the wound growing. The part list gains thumb|finger (the exact parts the
    // live book uses); the structure - side + part + loss word, same sentence -
    // is unchanged, per the EXTRACTFIX-1 rule against blind widening.
    const patterns = [
      {
        kind: 'loss',
        regex:
          /\b(?:lost|lose|losing|severed|severing|amputated|amputation|crushed|crushing|missing|gone|mangled|mauled|pulped|shredded|maimed|ruined)\b[^.!?\n]{0,70}\b(left|right)\s+(forearm|arm|hand|wrist|thumb|finger)\b/i,
      },
      {
        kind: 'loss',
        regex:
          /\b(left|right)\s+(forearm|arm|hand|wrist|thumb|finger)\b[^.!?\n]{0,70}\b(?:lost|lose|losing|severed|severing|amputated|amputation|crushed|crushing|missing|gone|mangled|mauled|pulped|shredded|maimed|ruined)\b/i,
      },
      {
        kind: 'stump',
        regex:
          /\b(?:his|her|the|[A-Z][a-z]{2,}['’]s)?\s*(left|right)\s+(forearm|arm|hand|wrist|thumb)?\s*stump\b/i,
      },
      {
        kind: 'stump',
        regex:
          /\bstump\s+of\s+(?:his|her|the|[A-Z][a-z]{2,}['’]s)?\s*(left|right)\s+(forearm|arm|hand|wrist|thumb)\b/i,
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
        // An empty sleeve IS an arm-level loss; a stump with no named part stays
        // unknown rather than guessed (precision over recall).
        const part = pattern.kind === 'empty-sleeve' ? 'arm' : (match[2] ? match[2].toLowerCase() : null);
        addFact(owner, match[1], sentence, pattern.kind, part);
      }
    }
  }

  return facts;
}

// ─── STATEFIX-1: character state is not just arms ────────────────────────────
//
// extractLimbFacts understands exactly four body parts - forearm, arm, hand, wrist -
// and three conditions - loss, stump, empty sleeve. Everything else a character can
// permanently become is invisible to the ledger. A character blinded in Chapter 3 is
// seeing again in Chapter 5 and nothing notices, which is precisely the defect that
// took nine fixes to kill for a hand.
//
// This is a SEPARATE extractor, not a widening of the limb one. extractLimbFacts keeps
// its exact behaviour because findLimbContradictions and findInstantProsthetics depend
// on its `side` field and on it never firing outside arms.
//
// THREE RULES, all learned the hard way:
//
// 1. IRREVERSIBLE ONLY. The ledger unions conditions and never drops them, so anything
//    recorded here is permanent for the rest of the book. "Marcus was exhausted" must
//    never land here. Only states a character does not recover from.
// 2. PRECISION OVER RECALL. A missed condition is drift the author can catch. A FALSE
//    condition puts a false constraint into every later prompt and actively damages the
//    prose - it would tell the writer a sighted character is blind. When the phrasing is
//    ambiguous, record nothing.
// 3. ADD CATEGORIES, NEVER WIDEN. Each state gets its own explicit pattern plus its own
//    exclusions. Regression test 30 documents a blind verb-sweep that had to be reverted.
//
// The exclusions matter as much as the patterns. "blinded by the glare", "deafening
// roar", "paralysed with fear", "burned with shame" are all TEMPORARY or figurative and
// are explicitly refused below.

const TEMPORARY_BLINDNESS = /\bblind(?:ed|ing)?\s+(?:by|with)\s+(?:the\s+)?(?:light|glare|flash|sun|snow|tears|rage|fury|anger|pain|panic)\b|\bblind\s+(?:corner|spot|alley|faith|luck|guess|panic|rage)\b/i;
const FIGURATIVE_PARALYSIS = /\bparal(?:ysed|yzed)\s+(?:by|with)\s+(?:fear|fright|terror|shock|indecision|doubt|grief|panic)\b/i;
const FIGURATIVE_BURN = /\bburn(?:ed|ing|t)?\s+(?:with|in)\s+(?:shame|rage|anger|embarrassment|fury|desire|curiosity)\b|\b(?:cheeks|face|ears|eyes|throat|lungs|chest)\s+burn/i;

// Lateral body parts the limb extractor does not cover. Same proven pattern shape as
// extractLimbFacts: a side, a body part, and an injury word in the same sentence.
const EXTRA_LATERAL_PARTS = 'leg|foot|ankle|knee|thigh|shin|calf|eye|ear|finger|thumb|toe|shoulder';
const LIMB_LOSS_WORDS = 'lost|lose|losing|severed|severing|amputated|amputation|crushed|crushing|missing|gone|mangled|mauled|pulped|shredded|maimed|ruined';

/**
 * STATEFIX-1: durable character states beyond arm injuries.
 * Returns [{ character, displayName, side, sentence, kind, label }].
 * `side` is null for conditions that are not lateral (blindness, pregnancy...).
 */
export function extractCharacterStateFacts(text) {
  const source = String(text || '');
  const facts = [];
  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  let lastCharacter = null;

  const ignoredNames = new Set([
    'The', 'Then', 'When', 'Where', 'After', 'Before', 'Scene', 'Chapter',
    'His', 'Her', 'He', 'She', 'They', 'It', 'But', 'And', 'That', 'This',
  ]);

  function canonicalCharacter(sentence) {
    const possessive = sentence.match(/\b([A-Z][a-z]{2,})['\u2019]s\b/);
    if (possessive && !ignoredNames.has(possessive[1])) return possessive[1];
    const direct = sentence.match(/\b([A-Z][a-z]{2,})\b/);
    if (direct && !ignoredNames.has(direct[1])) return direct[1];
    if (lastCharacter && /\b(?:he|his|him|she|her|hers|they|their)\b/i.test(sentence)) {
      return lastCharacter;
    }
    return null;
  }

  // Every pattern must name a PERSON-owned state. `requiresPossessive` demands a
  // his/her/their or Name's immediately governing the body part, so "the left leg of
  // the table was crushed" cannot become a character condition.
  const patterns = [
    {
      kind: 'sense-loss',
      label: 'blind',
      // NOTE the deliberate absence of a bare `blinded him/her/them`. "The acid blinded
      // her" and "the glare blinded her" are structurally identical and only one is
      // permanent, so the bare form is refused and explicit permanence is required.
      regex: /\b(?:was|is|went|left\s+(?:him|her|them))\s+(?:permanently\s+|completely\s+|totally\s+)?blind\b|\bblinded\s+(?:him|her|them|[A-Z][a-z]{2,})\s+(?:permanently|for\s+life|for\s+good)\b|\blost\s+(?:his|her|their)\s+(?:sight|vision)\b|\bsightless\b/i,
      // When the sentence NAMES the victim ("blinded Ana for life") take the owner from
      // the phrase itself. Sentence-level resolution checks only the FIRST capitalised
      // word and abandons the sentence if it is an article like "The", so "The shard
      // blinded Ana for life" would otherwise resolve to nobody and record nothing.
      ownerRegex: /\bblinded\s+([A-Z][a-z]{2,})\s+(?:permanently|for\s+life|for\s+good)\b/,
      exclude: TEMPORARY_BLINDNESS,
    },
    {
      kind: 'sense-loss',
      label: 'deaf',
      // Same refusal as blindness: a bare `deafened him` may be one loud bang.
      regex: /\b(?:was|is|went|left\s+(?:him|her|them))\s+(?:permanently\s+|completely\s+|stone\s+)?deaf\b|\bdeafened\s+(?:him|her|them|[A-Z][a-z]{2,})\s+(?:permanently|for\s+life|for\s+good)\b|\blost\s+(?:his|her|their)\s+hearing\b/i,
      ownerRegex: /\bdeafened\s+([A-Z][a-z]{2,})\s+(?:permanently|for\s+life|for\s+good)\b/,
      exclude: /\bdeafening\b/i,
    },
    {
      kind: 'paralysis',
      label: 'paralysed',
      regex: /\bparal(?:ysed|yzed)\b|\bparapleg(?:ic|ia)\b|\bquadripleg(?:ic|ia)\b|\bbroke\s+(?:his|her|their)\s+(?:back|neck|spine)\b/i,
      exclude: FIGURATIVE_PARALYSIS,
    },
    {
      kind: 'disfigurement',
      label: 'scarred',
      regex: /\b(?:badly|permanently|horribly|deeply)\s+scarred\b|\bdisfigur(?:ed|ement)\b|\bscarred\s+for\s+life\b/i,
      exclude: null,
    },
    {
      kind: 'burn',
      label: 'burned',
      regex: /\b(?:severe|third-degree|second-degree|badly)\s+burn(?:s|ed|t)?\b|\bburn(?:s|ed|t)\s+(?:covered|ran\s+down)\s+(?:his|her|their)\b/i,
      exclude: FIGURATIVE_BURN,
    },
    {
      kind: 'pregnancy',
      label: 'pregnant',
      regex: /\b(?:was|is|got|fell)\s+pregnant\b|\b(?:months?)\s+pregnant\b/i,
      exclude: null,
    },
  ];

  const lateralLoss = [
    new RegExp(`\\b(?:his|her|their|[A-Z][a-z]{2,}['\u2019]s)\\s+(left|right)\\s+(?:${EXTRA_LATERAL_PARTS})\\b[^.!?\\n]{0,70}\\b(?:${LIMB_LOSS_WORDS})\\b`, 'i'),
    new RegExp(`\\b(?:${LIMB_LOSS_WORDS})\\b[^.!?\\n]{0,70}\\b(?:his|her|their|[A-Z][a-z]{2,}['\u2019]s)\\s+(left|right)\\s+(?:${EXTRA_LATERAL_PARTS})\\b`, 'i'),
  ];

  for (const sentence of sentences) {
    const character = canonicalCharacter(sentence);
    if (character && !/\b(?:he|his|him|she|her|hers|they|their)\b/i.test(character)) {
      lastCharacter = character;
    }
    const owner = character || lastCharacter;

    for (const pattern of patterns) {
      if (!owner && !pattern.ownerRegex) continue;
      if (pattern.exclude && pattern.exclude.test(sentence)) continue;
      if (!pattern.regex.test(sentence)) continue;
      const named = pattern.ownerRegex ? sentence.match(pattern.ownerRegex) : null;
      const subject = named && !ignoredNames.has(named[1]) ? named[1] : owner;
      facts.push({
        character: subject.toLowerCase(),
        displayName: subject,
        side: null,
        sentence,
        kind: pattern.kind,
        label: pattern.label,
      });
    }

    if (!owner) continue;
    for (const regex of lateralLoss) {
      const match = sentence.match(regex);
      if (match) {
        const part = (sentence.match(new RegExp(`(left|right)\\s+(${EXTRA_LATERAL_PARTS})`, 'i')) || [])[2] || 'limb';
        facts.push({
          character: owner.toLowerCase(),
          displayName: owner,
          side: match[1].toLowerCase(),
          sentence,
          kind: 'loss',
          label: `${part.toLowerCase()} amputated/severed`,
        });
        break;
      }
    }
  }

  return facts;
}

// DEADCHARFIX-1: pull the sentence containing a match so a gate can quote its own
// evidence. A gate that cannot show the offending line cannot be told apart from a
// gate that is simply wrong.
function extractSentenceAround(text, index, maxLen = 240) {
  if (typeof text !== 'string' || !text.length) return '';
  const safeIndex = Math.max(0, Math.min(index, text.length - 1));
  let start = safeIndex;
  while (start > 0 && !'.!?\n'.includes(text[start - 1])) start -= 1;
  let end = safeIndex;
  while (end < text.length && !'.!?\n'.includes(text[end])) end += 1;
  if (end < text.length) end += 1;
  const sentence = text.slice(start, end).trim().replace(/\s+/g, ' ');
  return sentence.length > maxLen ? sentence.slice(0, maxLen - 1) + '\u2026' : sentence;
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
  // KEYLEDGER-1d: [{ name, gender }] for the characters in THIS scene. Absent or
  // empty, the possession and condition checks are skipped entirely (fail-open) —
  // they cannot resolve a pronoun without a cast, and a guess is worse than silence.
  sceneCast = null,
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

  // DUPEVENTFIX-1 — detect a DUPLICATED PASSAGE, not a "covered" event.
  //
  // The old rule flagged an event whenever two separated paragraphs both scored
  // >= 0.62 bag-of-words `coverage()` against the event TEXT. Measured on real
  // drafts that primitive fails in both directions at once:
  //
  //   false positive — "Lena confronts Marcus and Dr. Vale." is matched by any
  //     paragraph merely NAMING those three; the verb never has to appear. A clean
  //     three-hander confrontation self-reported as duplicated in 4 of 5 paragraphs,
  //     and no rewrite can fix it — you cannot stage a confrontation between three
  //     named people without naming them more than once.
  //
  //   false negative — "Marcus hands Lena the hidden report." scores 3/5 = 0.60
  //     against the paragraph that literally IS that beat, because the prose never
  //     calls the report "hidden". Under threshold. So a genuine verbatim repeat of
  //     that beat was invisible to the old check.
  //
  // The defect this gate exists for is the model WRITING THE SAME PASSAGE TWICE.
  // That is a property of the prose alone and needs no semantic guessing: compare
  // the paragraphs to EACH OTHER. Measured — distinct paragraphs of one continuous
  // confrontation score 0.085-0.100 against each other; the same beat written twice
  // scores 0.941. The bar sits between them with an order of magnitude to spare.
  // A fully PARAPHRASED second telling scores 0.238 and is not caught: the same
  // declared gap as REPLAYFIX-2, which needs the persisted ledger to close.
  //
  // Unlike the old message, this one is actionable — the repair pass is told which
  // two passages to merge.
  {
    const paragraphs = String(prose || '')
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 80);

    let duplicatePair = null;
    for (let a = 0; a < paragraphs.length && !duplicatePair; a += 1) {
      for (let b = a + 2; b < paragraphs.length; b += 1) {
        const similarity = paragraphSimilarity(paragraphs[a], paragraphs[b]);
        if (similarity >= DUPLICATE_PASSAGE_MIN_SIMILARITY) {
          duplicatePair = { a, b, similarity };
          break;
        }
      }
    }

    if (duplicatePair) {
      // Name the required event these passages belong to, when one plainly does.
      const owningEvent =
        requiredEvents.find((event) =>
          coverage(event, paragraphs[duplicatePair.a]).hit ||
          coverage(event, paragraphs[duplicatePair.b]).hit
        ) || null;

      issues.push({
        code: 'CURRENT_EVENT_DUPLICATED',
        message:
          `Passages ${duplicatePair.a + 1} and ${duplicatePair.b + 1} of this scene are ` +
          `near-identical retellings of the same moment` +
          (owningEvent ? ` (${owningEvent})` : '') +
          `. Keep one and cut the other.`,
        event: owningEvent,
        paragraphHits: [duplicatePair.a, duplicatePair.b],
        similarity: Number(duplicatePair.similarity.toFixed(3)),
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
        // DEADCHARFIX-1: this is still the same deliberately simple check — a dead
        // character acting puts something FALSE on the page, so it stays a hard
        // failure. What was missing is the EVIDENCE. The message said only that
        // "Vale performed an action" and never showed the sentence, so a real
        // violation and a false positive (a remembered line, a body being moved)
        // were indistinguishable from the console, and the repair prompt had
        // nothing concrete to work from. Quote it.
        //
        // DEADSPEECH-1: the verb list is UNCHANGED and the gate still fails closed. The
        // only thing removed is one false-positive SHAPE: reported speech. On 2026-07-30
        // this killed Chapter 4. The repair fixed the real violation on pass 1, then the
        // detector fired on `"Vale said the key opens the archive," Lena said.` - which is
        // Lena talking ABOUT Vale, not Vale acting - and burned the remaining budget until
        // the chapter was hard-rejected. A dead man named inside another character's quoted
        // line is memory, not action. Match only OUTSIDE quoted spans.
        const deadRegex = new RegExp(`\\b${deadChar}\\b\\s+(?:said|nodded|walked|looked|sighed|smiled|shook|turned|asked|replied)\\b`, 'gi');
        let deadMatch = null;
        for (let m = deadRegex.exec(prose); m; m = deadRegex.exec(prose)) {
          if (!isInsideQuotedSpan(prose, m.index)) { deadMatch = m; break; }
        }
        if (deadMatch) {
          issues.push({
            code: 'DEAD_CHARACTER_ACTION',
            message:
              `Dead character "${deadChar}" performed an action in this scene: ` +
              `"${extractSentenceAround(prose, deadMatch.index)}"`,
            excerpt: extractSentenceAround(prose, deadMatch.index),
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
    
    if (runtimeLedger.objectLocations) {
      for (const [obj, loc] of Object.entries(runtimeLedger.objectLocations)) {
        // If an object is left somewhere, and later seen somewhere else without being taken
        // A simple check: if the prose describes the object "on the X" but it was on the "Y"
        const wrongLocRegex = new RegExp(`\\b(?:the\\s+)?${obj}\\s+(?:is|lies|rests|sits|is resting|is lying|is sitting)\\s+(?:on|in|at)\\s+(?:the\\s+)?([a-z]+)\\b`, 'i');
        const match = prose.match(wrongLocRegex);
        if (match) {
          const newLoc = match[1].toLowerCase();
          if (newLoc !== loc) {
            // Did someone pick it up first?
            const pickUpRegex = new RegExp(`\\b(?:takes|grabs|picks up|retrieves|pockets|snatches)\\s+(?:the\\s+)?${obj}\\b`, 'i');
            if (!pickUpRegex.test(prose) && !prose.toLowerCase().includes(`takes the ${obj}`)) {
              issues.push({
                code: 'INVALID_OBJECT_TRANSITION',
                message: `Object "${obj}" was at ${loc} but is now at ${newLoc} without being moved.`,
              });
            }
          }
        }
      }
    }
    if (Array.isArray(runtimeLedger.separatedCharacters)) {
      const trusted = getTrustedCharacters(spec, runtimeLedger);
      // SEPARATION-1: the PLAN is the closed world for who shares a scene. When
      // this scene's own contract names the separated character together with
      // another cast member (scene goal, entry/exit state, or a required
      // event), the plan has reunited them - co-presence is what the beats
      // ORDER, not a violation. Without this the scene is unwinnable: the gate
      // audits against the ENTRY ledger, so no reunion sentence inside the
      // scene can ever clear the flag, every co-mention sentence fires, the
      // bounded repair burns all passes, and the chapter hard-blocks (ch.3
      // live failure, 2026-08-03: s1 exit separated Marcus, s2 required
      // "Lena and Dr. Vale rush to help Marcus").
      // Only what the scene must DO counts as authorization: required events and
      // the scene goal. entry_state/exit_state are POSITION statements and often
      // name a character precisely to say they are elsewhere ("Marcus is
      // elsewhere in the station"), which must not read as a reunion.
      const sepPlanText = [
        spec?.scene_goal,
        ...(Array.isArray(spec?.required_events) ? spec.required_events : []),
      ].filter(Boolean).join(' ');
      const planReunites = (name) => {
        if (!new RegExp(`\\b${name}\\b`).test(sepPlanText)) return false;
        for (const other of trusted) {
          if (other !== name && new RegExp(`\\b${other}\\b`).test(sepPlanText)) return true;
        }
        return false;
      };

      for (const sepChar of runtimeLedger.separatedCharacters) {
        if (planReunites(sepChar)) continue;
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

    // KEYLEDGER-1d. The block this replaces required a capitalised name plus a
    // PRESENT-TENSE verb from a five-word list. Measured against the live saves it
    // never fired once in 21,344 words: the manuscript writes "He held the brass
    // key.", not "Marcus holds the brass key." The replacement scans EVERY mention
    // of each tracked object and reports a holder change that has no transfer
    // written between the two states. Low-confidence referents are ignored by the
    // scanner, so ambiguity produces silence, not a false accusation.
    if (runtimeLedger.possessions && Array.isArray(sceneCast) && sceneCast.length) {
      const tracked = new Set();
      for (const objs of Object.values(runtimeLedger.possessions)) {
        for (const obj of objs || []) tracked.add(obj);
      }
      for (const obj of Array.isArray(spec?.props_present) ? spec.props_present : []) {
        if (obj && String(obj).trim().length > 2) tracked.add(String(obj).trim());
      }
      for (const obj of tracked) {
        const entryHolder =
          Object.keys(runtimeLedger.possessions).find((char) =>
            (runtimeLedger.possessions[char] || []).some(
              (held) => String(held).toLowerCase() === String(obj).toLowerCase()
            )
          ) || null;
        const result = checkPossessionContinuity({
          prose, object: obj, cast: sceneCast, entryHolder,
        });
        for (const violation of result.violations) {
          issues.push({
            code: violation.code,
            message: violation.message,
            object: violation.object,
            excerpt: violation.sentence,
          });
        }
      }
    }

    // KEYLEDGER-1c: a durable condition may not change owner off-page. Guarded on
    // the cast for the same reason as the possession check — without it,
    // extractLimbFacts falls back to nearest-name and would accuse on its own
    // mis-attribution.
    if (Array.isArray(sceneCast) && sceneCast.length) {
      const castLimbFacts = extractLimbFacts(prose, sceneCast);
      for (const issue of checkConditionAttribution({
        facts: castLimbFacts,
        ledgerConditions: runtimeLedger.characterConditions,
      })) {
        issues.push(issue);
      }
      // INJURYSCALE-1b: and it may not GROW off-page either.
      for (const issue of checkConditionInflation({
        facts: castLimbFacts,
        ledgerConditions: runtimeLedger.characterConditions,
      })) {
        issues.push(issue);
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

  // CRITGUARD-1: closed-world sanity check before any hard category fires.
  // A live ch.3 run was killed by the critic finding "Marcus losing his left
  // hand occurs in scene 2, which was forbidden in scene 1" — but the accepted
  // beat contract ASSIGNS that event to scene 2. An event occurring in its OWN
  // owning scene is the plan being executed, not a violation; the word
  // "forbidden" alone made it a hard block while every deterministic gate had
  // passed. If the finding names an occurrence scene and substantially matches
  // a required event OWNED by that same scene, it is self-refuting: downgrade
  // to advisory. A real early/replay violation names an occurrence scene that
  // DIFFERS from the owning scene, so this cannot mask a true finding.
  if (Array.isArray(generatedScenes) && generatedScenes.length) {
    const occMatch = v.match(/\b(?:occurs?|occurred|happens?|happened|performed|takes?\s+place)\s+in\s+scene\s+(\d+)/);
    if (occMatch) {
      const occScene = Number(occMatch[1]);
      const normWord = (w) => w.toLowerCase().replace(/(?:ing|ed|es|s)$/, '');
      const stopWords = new Set(['the','a','an','in','of','to','his','her','their','its','and','or','with','which','was','is','that','this','scene','for','from','was','were']);
      const findingWords = new Set(v.replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)).map(normWord));
      for (const sc of generatedScenes) {
        const spec = sc?.spec || sc || {};
        const owningScene = Number(sc?.sceneNumber || spec.scene_number || spec.sceneNumber || 0);
        if (owningScene !== occScene) continue;
        for (const ev of (Array.isArray(spec.required_events) ? spec.required_events : [])) {
          const evWords = String(ev).replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)).map(normWord);
          if (!evWords.length) continue;
          const hits = evWords.filter((w) => findingWords.has(w)).length;
          if (hits >= 3 || hits / evWords.length >= 0.6) {
            return { hard: false, category: 'advisory_event_in_owning_scene', reason: `Finding describes a required event of scene ${occScene} occurring in scene ${occScene} — the contract executed as planned` };
          }
        }
      }
    }
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

// ─── KEYLEDGER-1c: condition attribution drift ───────────────────────────────
// A durable condition belongs to the character who acquired it ON THE PAGE. When
// a later scene attaches the SAME condition to a different character with no
// acquisition of their own, that is a fabricated fact — measured on ch.5, where
// Marcus's empty left sleeve reattaches to Lena. Closed-world: the ledger owns
// the fact, the prose may not reassign it.
const CONDITION_FAMILIES = {
  loss: 'arm-gone',
  stump: 'arm-gone',
  'empty-sleeve': 'arm-gone',
};

export function conditionFamily(kindOrLabel) {
  const k = String(kindOrLabel || '').toLowerCase();
  if (CONDITION_FAMILIES[k]) return CONDITION_FAMILIES[k];
  if (/amputat|sever|stump|empty sleeve/.test(k)) return 'arm-gone';
  return null;
}

/**
 * @param facts            output of extractLimbFacts for the CURRENT scene
 * @param ledgerConditions runtimeLedger.characterConditions
 * @returns issue objects, [] when clean
 */
export function checkConditionAttribution({ facts, ledgerConditions = {} } = {}) {
  const owners = new Map();
  for (const [char, conds] of Object.entries(ledgerConditions || {})) {
    for (const cond of conds || []) {
      const side = (String(cond).match(/\b(left|right)\b/i) || [])[1] || '';
      const family = conditionFamily(cond);
      if (family) owners.set(`${family}:${side.toLowerCase()}`, char);
    }
  }

  const issues = [];
  for (const fact of facts || []) {
    const family = conditionFamily(fact.kind);
    if (!family) continue;
    const owner = owners.get(`${family}:${String(fact.side || '').toLowerCase()}`);
    if (owner && owner.toLowerCase() !== String(fact.character).toLowerCase()) {
      issues.push({
        code: 'CONDITION_ATTRIBUTION_DRIFT',
        message:
          `"${String(fact.sentence).trim().slice(0, 150)}" gives ${fact.displayName} the ` +
          `${fact.side} ${family.replace('-', ' ')} that the ledger records for ${owner}. ` +
          `Attribute it to ${owner} or cut it.`,
      });
    }
  }
  return issues;
}

// ─── INJURYSCALE-1b: an injury may not GROW off-page ─────────────────────────
// Measured disease (Brass Meridian export 12): ch.3 severs Marcus's THUMB at the
// second joint; ch.5 writes "his left sleeve pinned flat ... his empty sleeve" -
// a whole missing ARM. LEDGERSCOPE-1 killed the wound that HEALS; this is the
// wound that ESCALATES. Ranks are coarse on purpose and unknown parts are
// skipped entirely - a false inflation accusation would poison the repair loop
// (precision over recall, same as every condition rule in this file).
const PART_SEVERITY = {
  finger: 1,
  thumb: 1,
  hand: 3,
  wrist: 3,
  forearm: 4,
  arm: 5,
};

export function partSeverity(partOrCondition) {
  const text = String(partOrCondition || '').toLowerCase();
  for (const part of ['finger', 'thumb', 'forearm', 'wrist', 'hand', 'arm']) {
    if (new RegExp(`\\b${part}\\b`).test(text)) return { part, rank: PART_SEVERITY[part] };
  }
  return null;
}

/**
 * @param facts            extractLimbFacts output for the CURRENT scene
 * @param ledgerConditions runtimeLedger.characterConditions
 * @returns issues; [] when clean or when either side's part is unknown
 */
export function checkConditionInflation({ facts, ledgerConditions = {} } = {}) {
  const issues = [];
  for (const fact of facts || []) {
    const factSev = fact.part ? partSeverity(fact.part) : (fact.kind === 'empty-sleeve' ? { part: 'arm', rank: PART_SEVERITY.arm } : null);
    if (!factSev) continue;
    const charKey = Object.keys(ledgerConditions || {}).find(
      (c) => c.toLowerCase() === String(fact.character).toLowerCase()
    );
    if (!charKey) continue;
    for (const cond of ledgerConditions[charKey] || []) {
      if (!new RegExp(`\\b${fact.side}\\b`, 'i').test(cond)) continue;
      const ledgerSev = partSeverity(cond);
      if (!ledgerSev) continue;
      if (factSev.rank - ledgerSev.rank >= 2) {
        issues.push({
          code: 'CONDITION_INFLATION',
          message:
            `"${String(fact.sentence).trim().slice(0, 150)}" escalates ${fact.displayName}'s documented ` +
            `${fact.side} ${ledgerSev.part} injury into a missing ${factSev.part}. The ledger records ` +
            `"${cond}" - the injury is the ${ledgerSev.part}, nothing more. Rewrite the description to ` +
            `match the documented injury.`,
        });
        break;
      }
    }
  }
  return issues;
}
