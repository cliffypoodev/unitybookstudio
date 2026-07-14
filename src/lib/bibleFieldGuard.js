// =============================================================
// bibleFieldGuard.js - FIELDGUARD-1: deterministic bible-field length floors.
//
// Observed failure: a bible batch call returned an empty characters_md and
// the save went through silently - the project shipped with "Not generated"
// where the character document belongs, gutting entity discipline and the
// contamination guard's allowed-names list. Contract: every bible field
// meets its floor, or the field is retried ONCE with an explicit length
// demand, or the whole build throws (error toast, nothing saved).
// Blank beats fabricated; silent blank beats nothing at all.
// ASCII-only source on purpose.
// =============================================================

export const BIBLE_FIELD_FLOORS = {
  world_md: 1200,
  characters_md: 1200,
  voice_md: 600,
  canon_md: 1000,
  mystery_md: 400,
};

export function fieldLengthOk(field, text) {
  const floor = BIBLE_FIELD_FLOORS[field] || 0;
  return String(text || '').trim().length >= floor;
}

export function buildFieldRetryAppendix(field, floor) {
  return `

=== LENGTH ENFORCEMENT ===
Your previous response for ${field} was missing or far too short. This document is REQUIRED and must be COMPLETE: at least ${Math.round(floor / 6)} words (${floor}+ characters) of substantive, specific content grounded in the premise. Do not summarize. Do not apologize or explain. Return ONLY the JSON object with the complete ${field} document.
=== END LENGTH ENFORCEMENT ===`;
}

console.log('[FIELD-GUARD] FIELDGUARD-1 loaded: bible-field length floors + single retry');
