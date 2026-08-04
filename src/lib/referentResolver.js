// KEYLEDGER-1a — cast-scoped, gender-aware referent resolution.
//
// Every continuity extractor in this app answers the same question — "who is this
// sentence about?" — and every one of them answers it with a different ad-hoc
// heuristic. `extractLimbFacts` takes the first capitalised word, then falls back
// to the last name it saw, with no gender check at all: measured on the live
// Brass Meridian ch.4 save, "His left hand, the one missing its fingers, rested
// against his chest" is recorded as LENA's limb, because Lena was named in the
// previous sentence. A male pronoun cannot refer to a female character. One
// resolver, one rule set, confidence-rated.
//
// CONFIDENCE contract, and why it matters: 'high' means the referent is named
// outright, or the pronoun's gender is unique inside the scene cast. 'low' means
// the answer rests on a nearest-antecedent guess. Callers that ACCUSE (gates) must
// ignore 'low' — a false positive burns the repair budget and can hard-reject a
// chapter, which is the DEADSPEECH-1 lesson. Ambiguity fails silent, not loud.

const PRONOUN_GENDER = {
  he: 'm', him: 'm', his: 'm', himself: 'm',
  she: 'f', her: 'f', hers: 'f', herself: 'f',
};

export const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Normalise a cast list into [{ name, gender }]. Unknown gender = null, which
 *  can never be matched by a pronoun and therefore never mis-attributes. */
// KEYLEDGER-2a: honorifics never identify a character on their own.
//
// HONORIFIC-1 — ONE honorific authority for the whole app.
//
// There were THREE lists and they disagreed: this one, HONORIFIC_DOT_RX in
// objectPossession.js (which had sr/jr/st/hon that this one lacked), and an inline
// ['dr','mr','mrs','ms','the'] inside seedTrackedObjectsFromSpecStates. The
// recurring defect shape: two components with private opinions about the same fact.
//
// It was also short. Measured: a cast containing "Judge Rennard" resolved the bare
// word "Judge" to that character, because 'judge' was in no list — so a scene that
// says "The judge nodded" credited an action to a specific person. Nothing about
// the old list was wrong; it was fitted to one book's cast (a doctor and some
// soldiers) and every genre outside that book had a title it had never seen.
//
// The list is exported so nothing has to keep a private copy again.
export const HONORIFICS = new Set([
  // civil
  'dr', 'doctor', 'mr', 'mister', 'mrs', 'ms', 'miss', 'sir', 'madam', 'madame',
  'dame', 'lady', 'lord',
  // academic and clerical
  'prof', 'professor', 'rev', 'reverend', 'fr', 'father', 'pastor', 'bishop',
  'cardinal', 'rabbi', 'imam', 'deacon', 'abbot', 'abbess', 'sister', 'brother',
  'mother', 'elder',
  // military and uniformed
  'capt', 'captain', 'sgt', 'sergeant', 'col', 'colonel', 'lt', 'lieutenant',
  'gen', 'general', 'maj', 'major', 'cpl', 'corporal', 'pvt', 'private',
  'adm', 'admiral', 'cmdr', 'commander', 'ens', 'ensign', 'chief', 'marshal',
  'sheriff', 'deputy', 'officer', 'det', 'detective', 'insp', 'inspector',
  'constable', 'agent', 'warden', 'sarge',
  // legal and civic
  'judge', 'justice', 'chancellor', 'magistrate', 'coroner', 'counsellor',
  'counselor', 'sen', 'senator', 'rep', 'gov', 'governor', 'mayor', 'pres',
  'president', 'amb', 'ambassador', 'consul', 'alderman', 'provost',
  // medical and trade
  'nurse', 'matron', 'surgeon', 'apothecary', 'midwife',
  // nobility and royalty
  'king', 'queen', 'prince', 'princess', 'duke', 'duchess', 'earl', 'count',
  'countess', 'baron', 'baroness', 'viscount', 'viscountess', 'marquess',
  'archduke', 'tsar', 'emperor', 'empress', 'sultan', 'sheikh', 'khan',
  'raja', 'maharaja',
  // saints and place-name leaders
  'st', 'saint',
]);

/** HONORIFIC-1 — tokens that TRAIL a name and identify nobody on their own. */
export const NAME_SUFFIXES = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'dds', 'esq', 'ret', 'obe', 'mbe',
]);

/** HONORIFIC-1 — the abbreviation form, derived from the SAME set, for callers
 *  that must stop an honorific's period from reading as a sentence boundary.
 *  Longest-first so "professor." cannot be matched as "prof" plus a stray "essor.".
 *  Global: callers use it with .replace(), never .exec() in a loop. */
export const HONORIFIC_ABBREV_RX = new RegExp(
  '\\b(?:' + [...HONORIFICS, ...NAME_SUFFIXES]
    .sort((a, b) => b.length - a.length).map(escapeRx).join('|') + ')\\.',
  'gi');

/** KEYLEDGER-2a — the prose tokens a cast name answers to.
 *  "Dr. Nolan Vale" → ['dr. nolan vale', 'nolan', 'vale']. The full name is
 *  always included; single tokens must be >= 3 chars and not an honorific. */
export function castNameTokens(name) {
  const clean = String(name || '').trim();
  if (!clean) return [];
  const out = new Set([clean.toLowerCase()]);
  const parts = clean.split(/\s+/);
  const norm = (raw) => String(raw).replace(/[.,]/g, '').toLowerCase();
  // HONORIFIC-1: a title LEADS a name; it is not stripped wherever it appears.
  // The old rule removed the token at any position, so a character surnamed King,
  // Bishop, Marshall, Chief or Young lost the only name the prose calls them by.
  // A leading RUN is stripped ("Chief Inspector Morse"), never the last token -
  // a mononym is always kept, whatever it happens to be.
  let lead = 0;
  while (lead < parts.length - 1 && HONORIFICS.has(norm(parts[lead]))) lead += 1;
  const last = parts.length - 1;
  parts.forEach((raw, i) => {
    const token = norm(raw);
    if (token.length < 3) return;
    if (i < lead) return;
    if (i === last && parts.length > 1 && NAME_SUFFIXES.has(token)) return;
    out.add(token);
  });
  return [...out];
}

export function normalizeCast(cast) {
  const roster = (Array.isArray(cast) ? cast : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { name: entry.trim(), gender: null };
      const name = String(entry.name || '').trim();
      if (!name) return null;
      const g = String(entry.gender || '').trim().toLowerCase();
      return { name, gender: g === 'm' || g === 'male' ? 'm' : g === 'f' || g === 'female' ? 'f' : null };
    })
    .filter((c) => c && c.name);

  // KEYLEDGER-2a: MEASURED DISEASE — the beat contracts carry full names
  // ("Lena Ortiz", "Marcus Reed") while the prose says "Lena" and "Marcus".
  // Exact-token matching resolved 0 of 11 holder events in the live ch.4 draft,
  // so the possession gate ran inert and two key teleports shipped. Every cast
  // member now answers to its unambiguous name tokens. A token claimed by two
  // cast members identifies nobody and is dropped (except the full name itself).
  const claims = new Map();
  for (const c of roster) {
    for (const t of castNameTokens(c.name)) claims.set(t, (claims.get(t) || 0) + 1);
  }
  for (const c of roster) {
    const full = c.name.toLowerCase();
    c.aliases = castNameTokens(c.name).filter((t) => t === full || claims.get(t) === 1);
    if (c.aliases.length === 0) c.aliases = [full];
  }
  return roster;
}

/** Infer gender per cast member from the prose itself: the pronoun that most often
 *  follows the name within a short window. Deterministic, no model call. Used only
 *  when the story bible does not carry a gender for the character. */
/**
 * KEYLEDGER-4a - gender inference rebuilt on high-precision evidence only.
 *
 * The original window heuristic ("alias ... pronoun within 60 chars") counted
 * evidence that is systematically FALSE in two-hander prose, proven on the live
 * ch.2 run where it voted Marcus Reed FEMALE and thereby handed every "he" to
 * Dr. Vale (the only confirmed male), fabricating "Dr. Nolan Vale: key" in the
 * saved ledger while the key never touched Vale's hands on the page:
 *   - object pronouns: "Marcus had looked at HER" is about Lena, not Marcus
 *   - vocatives: '"Marcus," she said' is Lena ADDRESSING Marcus
 *   - cross-referent possessives: "Lena watched HIS hands" is about Marcus
 * Per-shape exclusions do not converge (ARCH-1 lesson), so the rewrite keeps
 * only two shapes that BIND to the named character, measured at 95-100%
 * precision with 19-30 true votes per chapter on the live manuscript:
 *   E1 subject chain: a sentence whose ONLY cast alias is this character,
 *      followed by a sentence that OPENS with He/She and names nobody.
 *      ("Marcus stopped. He turned.")
 *   E2 absolute construction: same only-alias condition, then ", his/her ..."
 *      within the sentence - a participial absolute binds to the subject.
 *      ("Marcus said, his voice low." / "Lena followed, her eyes tracking...")
 * Quoted dialogue is blanked first so speech content and vocatives produce no
 * evidence. Thresholds unchanged: 3+ votes and a strict majority, or no verdict.
 */
export function inferCastGenders(prose, cast) {
  const roster = normalizeCast(cast);
  if (!roster.length) return roster;
  const text = String(prose || '').replace(/[\u201C"][^\u201C\u201D"]{0,400}?[\u201D"]/g, ' ');
  const sentences = text.split(/(?<=[.!?\u2026])\s+/);
  const aliasRx = new Map(
    roster.map((c) => [c.name, new RegExp(`\\b(?:${(c.aliases || [c.name]).map(escapeRx).join('|')})\\b`, 'i')])
  );
  const whoIn = (s) => roster.filter((c) => aliasRx.get(c.name).test(s));
  const votes = new Map(roster.map((c) => [c.name, { m: 0, f: 0 }]));

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const present = whoIn(s);
    if (present.length !== 1) continue;
    const c = present[0];
    // E1: next sentence opens with a bare subject pronoun and names nobody.
    if (i + 1 < sentences.length) {
      const next = sentences[i + 1].trim();
      const m = /^(He|She)\b/.exec(next);
      if (m && whoIn(next).length === 0) votes.get(c.name)[m[1] === 'He' ? 'm' : 'f'] += 1;
    }
    // E2: participial absolute after the alias: "Marcus said, his voice low".
    const abs = new RegExp(
      `\\b(?:${(c.aliases || [c.name]).map(escapeRx).join('|')})\\b[^,.!?;]{0,40},\\s*(his|her)\\b`, 'i'
    ).exec(s);
    if (abs) votes.get(c.name)[abs[1].toLowerCase() === 'his' ? 'm' : 'f'] += 1;
  }

  return roster.map((c) => {
    if (c.gender) return c;
    const v = votes.get(c.name);
    if (v.m >= 3 && v.m > v.f) return { ...c, gender: 'm' };
    if (v.f >= 3 && v.f > v.m) return { ...c, gender: 'f' };
    return c;
  });
}

export function genderOfPronoun(word) {
  return PRONOUN_GENDER[String(word || '').toLowerCase().replace(/(?:'s|’s)$/, '')] || null;
}

/**
 * Resolve one referring token against the scene cast.
 * @returns {{name: string, confidence: 'high'|'low'}|null}
 */
export function resolveReferent(token, cast, lastNamedByGender = {}) {
  if (!token) return null;
  const bare = String(token).replace(/(?:'s|’s)$/, '').trim();
  if (!bare) return null;
  const roster = normalizeCast(cast);

  const bareLower = bare.toLowerCase();
  const named = roster.find((c) => (c.aliases || [c.name.toLowerCase()]).includes(bareLower));
  if (named) return { name: named.name, confidence: 'high' };

  const g = genderOfPronoun(bare);
  if (!g) return null;

  const candidates = roster.filter((c) => c.gender === g);
  // KEYLEDGER-4b: gender-uniqueness is only closed-world when every OTHER cast
  // member has a CONFIRMED different gender. On the live ch.2 run, Marcus had
  // no verdict yet, Vale was male, and every "he" resolved to Vale at high
  // confidence - a fabricated holder. Unknown gender means possible candidate,
  // which means not unique.
  const othersConfirmedDifferent = roster
    .filter((c) => c.gender !== g)
    .every((c) => c.gender && c.gender !== g);
  if (candidates.length === 1 && othersConfirmedDifferent) {
    return { name: candidates[0].name, confidence: 'high' };
  }
  // GENDER LOCK: never hand a male pronoun to a female character, even as a guess.
  const last = lastNamedByGender[g];
  if (last && roster.some((c) => c.name === last && c.gender === g)) {
    return { name: last, confidence: 'low' };
  }
  return null;
}

/** Subject of a clause: the first name or pronoun that appears in it. */
export function resolveClauseSubject(clause, cast, lastNamedByGender = {}) {
  const roster = normalizeCast(cast);
  if (!roster.length) return null;
  const names = roster.flatMap((c) => c.aliases || [c.name]).map(escapeRx).join('|');
  const rx = new RegExp(`\\b(${names}|he|she|him|her|his|hers)\\b`, 'i');
  const m = rx.exec(String(clause || ''));
  return m ? resolveReferent(m[1], roster, lastNamedByGender) : null;
}

/** Update the running "last named person of each gender" map from a sentence. */
export function trackLastNamed(sentence, cast, lastNamedByGender) {
  const line = String(sentence || '');
  for (const c of normalizeCast(cast)) {
    if (c.gender && (c.aliases || [c.name]).some((a) => new RegExp(`\\b${escapeRx(a)}\\b`, 'i').test(line))) {
      lastNamedByGender[c.gender] = c.name;
    }
  }
  return lastNamedByGender;
}
