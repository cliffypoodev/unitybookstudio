// src/lib/bibliographyEntryShape.js — NFEXPORT-BIB-1
//
// A title test is not a Sources section. A back-matter chapter can be a
// mistitled or leftover chapter from a different book (the flagship's
// "Bibliography & Sources" holding another book's fiction is a live case) —
// the title only says where to LOOK; this module says whether what is there
// actually looks like a bibliography. No dependencies, so both
// bibliographyGenerator.js and exportSafetyGate.js can use it, and it is
// directly testable without the Vite alias loader.

export const BIBLIOGRAPHY_ENTRY_SHAPE_VERSION = 'bibliography-entry-shape-v1';

// A line "looks like an entry" when it leads with a bullet/number (an
// explicit list item) — the ONLY single-signal case, since a list marker is
// unambiguous on its own.
export const BIB_ENTRY_RX = /^(?:[-*•]\s+\S|\d+[.)]\s+\S)/;

const BIB_URL_RX = /https?:\/\/\S+/;
const BIB_YEAR_RX = /\b(?:1[5-9]\d{2}|20\d{2})\b/;
const BIB_QUOTE_TITLE_RX = /"[^"]{3,140}"/;
const BIB_AUTHOR_LEAD_RX = /^[A-Z][A-Za-z.&'’\- ]{2,80}\.\s+\S/;

// Otherwise a citation needs TWO independent signals together (a URL, a
// year, a quoted title, an author/institution lead) — one alone is too
// common in ordinary narrative prose (a quote, a year) to count by itself.
function isLikelyBibliographyEntryLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (BIB_ENTRY_RX.test(s)) return true;
  const signals = [BIB_URL_RX.test(s), BIB_YEAR_RX.test(s), BIB_QUOTE_TITLE_RX.test(s), BIB_AUTHOR_LEAD_RX.test(s)]
    .filter(Boolean).length;
  return signals >= 2;
}

/** Count lines in `text` that look like bibliography entries. */
export function countBibliographyEntries(text) {
  return String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(isLikelyBibliographyEntryLine)
    .length;
}
