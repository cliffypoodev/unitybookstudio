// INTRODUP-1 — in-chapter duplicate self-introduction guard.
//
// The defect (external audit of REDUX v3): in Ch3 the antagonist introduces
// himself twice in the same conversation — "I am Nolan. And these … are my
// associates." then, fourteen sentences later, "I'm Nolan. I collect things."
// A character who has already told the room their name does not re-announce it;
// the second self-introduction reads as a continuity slip.
//
// This is a WARNING, never a hard block — like the pronoun gates, a narrative
// issue must never stop an export. It is deterministic and closed-world: it
// fires only when a KNOWN cast name is spoken as a FIRST-PERSON self-reference
// ("I am NAME", "I'm NAME", "My name is NAME", "Call me NAME", "NAME's the
// name") two or more times inside one chapter. Third-person naming ("He was
// Nolan"), possessives ("I am Nolan's associate"), and other characters saying
// the name are never counted.

export const INTRO_GUARD_VERSION = 'intro-guard-v1';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The five first-person self-introduction shapes. Each captures nothing; the
// cast name is baked in. A trailing (?!['’]s) rejects the possessive
// "I am Nolan's associate" (the speaker is NOT Nolan there).
function selfIntroPatterns(name) {
  const n = escapeRegExp(name);
  const notPossessive = `(?![’'\\w])`; // name must end here — not "'s", not more letters
  return [
    `\\bI(?:\\s+am|[’']m)\\s+${n}${notPossessive}`,
    `\\bmy\\s+name(?:\\s+is|[’']s)\\s+${n}${notPossessive}`,
    `\\bcall\\s+me\\s+${n}${notPossessive}`,
    `\\bthe\\s+name(?:\\s+is|[’']s)\\s+${n}${notPossessive}`,
    `\\b${n}[’']s\\s+the\\s+name\\b`,
  ];
}

/**
 * Characters who self-introduce 2+ times within one chapter's text.
 * Returns [{ name, count, excerpts: [string] }] — one entry per over-introduced
 * character. `castNames` is the resolved cast list (harvestCastNames output).
 */
export function scanDuplicateIntroductions(text, castNames = []) {
  const t = String(text || '');
  if (!t || !Array.isArray(castNames) || !castNames.length) return [];
  const findings = [];
  for (const name of castNames) {
    if (!name) continue;
    const hits = [];
    for (const pat of selfIntroPatterns(name)) {
      let rx;
      try { rx = new RegExp(pat, 'gi'); } catch { continue; }
      for (const m of t.matchAll(rx)) hits.push({ index: m.index, text: m[0] });
    }
    if (hits.length < 2) continue;
    // Collapse matches that land on (nearly) the same span — a single phrase
    // caught by two overlapping shapes must count once.
    hits.sort((a, b) => a.index - b.index);
    const distinct = [];
    for (const h of hits) {
      const prev = distinct[distinct.length - 1];
      if (!prev || h.index - prev.index > 3) distinct.push(h);
    }
    if (distinct.length >= 2) {
      findings.push({
        name,
        count: distinct.length,
        excerpts: distinct.slice(0, 3).map((h) => t.slice(Math.max(0, h.index - 8), h.index + 40).replace(/\s+/g, ' ').trim()),
      });
    }
  }
  return findings;
}
