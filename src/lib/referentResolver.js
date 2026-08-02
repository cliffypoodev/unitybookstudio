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
export function normalizeCast(cast) {
  return (Array.isArray(cast) ? cast : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { name: entry.trim(), gender: null };
      const name = String(entry.name || '').trim();
      if (!name) return null;
      const g = String(entry.gender || '').trim().toLowerCase();
      return { name, gender: g === 'm' || g === 'male' ? 'm' : g === 'f' || g === 'female' ? 'f' : null };
    })
    .filter((c) => c && c.name);
}

/** Infer gender per cast member from the prose itself: the pronoun that most often
 *  follows the name within a short window. Deterministic, no model call. Used only
 *  when the story bible does not carry a gender for the character. */
export function inferCastGenders(prose, cast) {
  const text = String(prose || '');
  const roster = normalizeCast(cast);
  const names = roster.map((c) => escapeRx(c.name)).join('|');
  return roster.map((c) => {
    if (c.gender) return c;
    // Only count a pronoun that follows the name closely with NO other cast name
    // in between — "Marcus turned. Lena watched her father" must not make Marcus
    // female. Short window, exclusive of other names, or no verdict at all.
    const rx = new RegExp(`\\b${escapeRx(c.name)}\\b((?:(?!\\b(?:${names})\\b)[^.!?]){0,60}?)\\b(he|his|him|himself|she|her|hers|herself)\\b`, 'gi');
    let m; let male = 0; let female = 0;
    while ((m = rx.exec(text)) !== null) {
      if (genderOfPronoun(m[2]) === 'm') male += 1; else female += 1;
    }
    if (male >= 3 && male > female) return { ...c, gender: 'm' };
    if (female >= 3 && female > male) return { ...c, gender: 'f' };
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

  const named = roster.find((c) => c.name.toLowerCase() === bare.toLowerCase());
  if (named) return { name: named.name, confidence: 'high' };

  const g = genderOfPronoun(bare);
  if (!g) return null;

  const candidates = roster.filter((c) => c.gender === g);
  if (candidates.length === 1) return { name: candidates[0].name, confidence: 'high' };
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
  const names = roster.map((c) => escapeRx(c.name)).join('|');
  const rx = new RegExp(`\\b(${names}|he|she|him|her|his|hers)\\b`, 'i');
  const m = rx.exec(String(clause || ''));
  return m ? resolveReferent(m[1], roster, lastNamedByGender) : null;
}

/** Update the running "last named person of each gender" map from a sentence. */
export function trackLastNamed(sentence, cast, lastNamedByGender) {
  for (const c of normalizeCast(cast)) {
    if (c.gender && new RegExp(`\\b${escapeRx(c.name)}\\b`).test(String(sentence || ''))) {
      lastNamedByGender[c.gender] = c.name;
    }
  }
  return lastNamedByGender;
}
