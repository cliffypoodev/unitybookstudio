// src/lib/repetitionSweep.js
// SWEEP-1 (UBS_plan.md Phase 2A) — mechanical, whole-book, pairwise beat
// comparison. Report only: nothing here gates, blocks, cuts, or modifies
// prose, and nothing writes to Chapter/NovelProject.
//
// Relative imports only, no React — this module is imported directly by
// test/sweep1.acceptance.mjs under bare Node (same convention as
// beatLedger.js/sceneDelta.js). The one optional model call (entity
// aliasing) is injected via callLLM, same scope boundary as beatLedger.js:
// this file never resolves or calls a model itself.

// ── word-overlap similarity (the plan's stated default; no embeddings
// dependency added just for this — see docs/phase2-notes.md for the
// DISCOVER result on whether the local router exposes /v1/embeddings) ──
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'is', 'was', 'were', 'are', 'be', 'been', 'it', 'this', 'that',
  'he', 'she', 'they', 'his', 'her', 'their', 'as', 'by', 'from', 'into',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// `excludeTokens` strips participant-name tokens out of the content set —
// without this, two unrelated beats sharing a character ("Mara confronts
// Dov about the ledger" vs "Mara yells at Ilse about the boat") share the
// token "mara" from prose mentioning her name, inflating content similarity
// on nothing but a shared cast member. Participant overlap already has its
// own weighted component; content similarity should measure the EVENT, not
// who was in it.
function contentTokenSet(text, excludeTokens) {
  const tokens = tokenize(text).filter((t) => !STOPWORDS.has(t));
  return new Set(excludeTokens ? tokens.filter((t) => !excludeTokens.has(t)) : tokens);
}

// PARTICIPANT tokens keep stopword-free short tokens too (names are short,
// and "Mara"/"Mara Vale" must share the "mara" token — no stoplist needed
// for proper nouns, but reuse tokenize for case/punctuation normalization).
function participantTokenSet(participants) {
  const tokens = new Set();
  for (const p of participants || []) {
    for (const t of tokenize(p)) tokens.add(t);
  }
  return tokens;
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── compareBeats weights — named and commented, not magic. Sum to 1.0. ──
export const TYPE_MATCH_WEIGHT = 0.25;
export const PARTICIPANT_OVERLAP_WEIGHT = 0.25;
export const CONTENT_SIMILARITY_WEIGHT = 0.35; // subject+summary word overlap — the heaviest signal
export const EMOTIONAL_CORE_WEIGHT = 0.15;

// Sep 4 lesson: in a single-POV book the protagonist is in EVERY beat, so
// type+participant overlap alone matched everything — a flat "the
// protagonist is in both" is not evidence of a repeat. A pair must clear
// this minimum CONTENT (subject+summary) similarity before type and
// participant scores are allowed to complete a match at all. Below the
// floor, the whole score is scaled down proportionally to how far under it
// the content similarity sits, so a below-floor pair can't cross any
// reasonable threshold even with perfect type/participant overlap.
export const SUBJECT_SIMILARITY_FLOOR = 0.15;
// How hard the gate below the floor squeezes the score (0 = a below-floor
// pair with a content score near the floor still barely registers).
const BELOW_FLOOR_PENALTY = 0.3;

// Beat types the sweep treats as related (a confrontation can read as an
// emotional beat and vice versa) — partial credit, never a full type match.
const ADJACENT_TYPE_PAIRS = new Set([
  'confrontation|emotional_beat',
  'emotional_beat|confrontation',
  'revelation|decision',
  'decision|revelation',
  'relationship_shift|emotional_beat',
  'emotional_beat|relationship_shift',
]);
const ADJACENT_TYPE_SCORE = 0.5;

function typeMatchScore(typeA, typeB) {
  const a = String(typeA || '').toLowerCase().trim();
  const b = String(typeB || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  return ADJACENT_TYPE_PAIRS.has(`${a}|${b}`) ? ADJACENT_TYPE_SCORE : 0;
}

/**
 * Compares two beats (BeatLedgerEntry-shaped: beat_type, participants,
 * subject, summary, emotional_core) and returns a 0-1 score plus the
 * component breakdown a report can quote ("near-identical emotionalCore").
 */
export function compareBeats(a, b) {
  const typeScore = typeMatchScore(a?.beat_type, b?.beat_type);
  const participantsA = participantTokenSet(a?.participants);
  const participantsB = participantTokenSet(b?.participants);
  const participantScore = jaccard(participantsA, participantsB);
  // Strip either beat's participant-name tokens out of BOTH content sets —
  // participant overlap already has its own weighted component above.
  const nameTokens = new Set([...participantsA, ...participantsB]);
  const contentScore = jaccard(
    contentTokenSet(`${a?.subject || ''} ${a?.summary || ''}`, nameTokens),
    contentTokenSet(`${b?.subject || ''} ${b?.summary || ''}`, nameTokens)
  );
  const emotionalScore = jaccard(
    contentTokenSet(a?.emotional_core, nameTokens),
    contentTokenSet(b?.emotional_core, nameTokens)
  );

  const raw = typeScore * TYPE_MATCH_WEIGHT
    + participantScore * PARTICIPANT_OVERLAP_WEIGHT
    + contentScore * CONTENT_SIMILARITY_WEIGHT
    + emotionalScore * EMOTIONAL_CORE_WEIGHT;

  const components = { typeScore, participantScore, contentScore, emotionalScore };

  if (contentScore < SUBJECT_SIMILARITY_FLOOR) {
    const gate = SUBJECT_SIMILARITY_FLOOR > 0 ? contentScore / SUBJECT_SIMILARITY_FLOOR : 0;
    return { score: Math.min(1, raw * gate * BELOW_FLOOR_PENALTY), ...components, gated: true };
  }
  return { score: Math.min(1, raw), ...components, gated: false };
}

// ── compareUnits: best beat pair between two units, distance-boosted ──
// Scene-distance damping: near-adjacent scenes/chapters intentionally
// continue an arc (not a repeat); a repeat far apart is the one readers
// actually feel as a rerun. Capped so an extremely distant pair can't turn a
// weak beat match into a strong one on distance alone.
export const DISTANCE_BOOST_PER_UNIT = 0.01; // +1% per unit of ordinal distance between units
export const DISTANCE_BOOST_CAP = 0.35; // maximum +35% boost, regardless of distance

// A beat pair below this (unweighted-by-distance) score does not count as
// "matched" for recommendation purposes — it's noise, not a repeat.
export const MATCH_PAIR_THRESHOLD = 0.5;

function unitLabel(unit) {
  const scenePart = unit?.sceneNumber === null || unit?.sceneNumber === undefined ? '' : `/s${unit.sceneNumber}`;
  return `ch${unit?.chapterNumber ?? '?'}${scenePart}`;
}

/**
 * Compares every beat in unitA against every beat in unitB. `distance` is
 * the ordinal distance between the two units in book order (NOT chapter
 * number difference — two adjacent units are distance 1 regardless of how
 * many chapter numbers separate them, e.g. after filtering).
 */
export function compareUnits(unitA, unitB, distance = 0) {
  const beatsA = Array.isArray(unitA?.beats) ? unitA.beats : [];
  const beatsB = Array.isArray(unitB?.beats) ? unitB.beats : [];
  const matchedBeats = [];
  for (const beatA of beatsA) {
    for (const beatB of beatsB) {
      const cmp = compareBeats(beatA, beatB);
      matchedBeats.push({ beatA, beatB, ...cmp });
    }
  }
  matchedBeats.sort((x, y) => y.score - x.score);
  const rawScore = matchedBeats.length ? matchedBeats[0].score : 0;

  const boost = 1 + Math.min(DISTANCE_BOOST_CAP, Math.max(0, distance) * DISTANCE_BOOST_PER_UNIT);
  const score = Math.min(1, rawScore * boost);

  return {
    unitA: unitLabel(unitA),
    unitB: unitLabel(unitB),
    score,
    rawScore,
    distanceBoost: boost,
    bestPair: matchedBeats[0] || null,
    matchedBeats: matchedBeats.filter((m) => m.score >= MATCH_PAIR_THRESHOLD),
  };
}

// ── recommendation: novelty-weighted, never a flat "cut the later one" ──
// Sep 4 lesson: a flat "cut the later chapter" deleted a unique reveal. How
// much a reader would MISS this beat type if it were cut — high for beats
// that deliver new story information, low for reaction/transition beats.
export const BEAT_NOVELTY_WEIGHT = {
  revelation: 1.0,
  setpiece: 0.9,
  decision: 0.7,
  relationship_shift: 0.6,
  confrontation: 0.5,
  emotional_beat: 0.3,
};
const DEFAULT_NOVELTY_WEIGHT = 0.4;

// A later unit with at least one unmatched beat at or above this novelty
// weight is worth partially keeping, not fully cutting.
export const PARTIAL_COMPRESS_NOVELTY_FLOOR = 0.5;

function noveltyWeight(beatType) {
  const key = String(beatType || '').toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(BEAT_NOVELTY_WEIGHT, key) ? BEAT_NOVELTY_WEIGHT[key] : DEFAULT_NOVELTY_WEIGHT;
}

/**
 * Which of the two units comes later in book order: higher chapter_number,
 * then higher scene_number (null/undefined sorts as chapter-level, i.e.
 * before any specific scene of the same chapter).
 */
function isLater(candidate, other) {
  if (candidate.chapterNumber !== other.chapterNumber) return candidate.chapterNumber > other.chapterNumber;
  const cs = candidate.sceneNumber ?? -1;
  const os = other.sceneNumber ?? -1;
  return cs > os;
}

/**
 * Novelty-weighted recommendation for one matched unit pair. Never "cut the
 * later one" outright: the later unit's beats that were NOT matched to
 * anything in the earlier unit are scored by novelty; if any clears the
 * floor, the recommendation keeps those beats and only compresses the rest.
 */
export function recommendForUnitPair(unitA, unitB, matchedBeats) {
  const [earlier, later] = isLater(unitA, unitB) ? [unitB, unitA] : [unitA, unitB];
  const laterBeats = Array.isArray(later.beats) ? later.beats : [];
  // matchedBeats entries carry {beatA, beatB} in whatever order compareUnits
  // was originally called with — NOT necessarily {earlier, later} order — so
  // identify each matched beat by reference against the later unit's own
  // beats rather than assuming beatA/beatB maps to earlier/later.
  const laterBeatsSet = new Set(laterBeats);
  const matchedLaterBeats = new Set();
  for (const m of matchedBeats || []) {
    if (m.score < MATCH_PAIR_THRESHOLD) continue;
    if (laterBeatsSet.has(m.beatA)) matchedLaterBeats.add(m.beatA);
    if (laterBeatsSet.has(m.beatB)) matchedLaterBeats.add(m.beatB);
  }
  const unmatchedLaterBeats = laterBeats.filter((b) => !matchedLaterBeats.has(b));
  const maxNovelty = unmatchedLaterBeats.reduce((max, b) => Math.max(max, noveltyWeight(b.beat_type)), 0);

  if (maxNovelty >= PARTIAL_COMPRESS_NOVELTY_FLOOR) {
    const keep = unmatchedLaterBeats.filter((b) => noveltyWeight(b.beat_type) >= PARTIAL_COMPRESS_NOVELTY_FLOOR);
    const keepSet = new Set(keep);
    return {
      action: 'partial_compress_later',
      earlierUnit: unitLabel(earlier),
      laterUnit: unitLabel(later),
      keep,
      compress: laterBeats.filter((b) => !keepSet.has(b)),
    };
  }
  return {
    action: 'full_cut_later',
    earlierUnit: unitLabel(earlier),
    laterUnit: unitLabel(later),
    keep: [],
    compress: laterBeats,
  };
}
