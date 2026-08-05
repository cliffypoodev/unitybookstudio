/**
 * BOOKSCRUB-1 — per-project manuscript scrub rules.
 *
 * manuscriptFixer.js is a general repair engine, but it carried one specific book's
 * data inside it: regex/replacement pairs naming that manuscript's invented personas,
 * its canned credibility paragraphs, and the artefacts left behind when those names
 * were swapped for role labels. Twenty-nine lines across five regions in three
 * functions. A general engine that knows one book's cast is not general.
 *
 * The mechanism is here; the data is in data. A project carries its own rules on its
 * own record as `scrub_rules_json`, and the engine asks for them. The legacy set is
 * used only when a project has none, so an already-published manuscript is unaffected
 * — and it is announced when used, so it cannot quietly become the default forever.
 *
 * Shape of scrub_rules_json (all fields optional):
 *   {
 *     "cannedParagraphs":   ["<regex source>", ...],
 *     "personaRepairs":     [["<regex source>", "<replacement>", "<label>"], ...],
 *     "surnameRepairs":     [["<regex source>", "<replacement>", "<label>"], ...],
 *     "attributionRepairs": [["<regex source>", "<replacement>"], ...],
 *     "personaWarningNames": "<regex source>"
 *   }
 * Patterns are stored as strings because the record is JSON. They are compiled here,
 * and a pattern that will not compile is dropped with a warning rather than throwing
 * — a bad rule must never be able to kill a manuscript repair run.
 */
import { LEGACY_BOOK_SCRUB_RULES } from './legacyBookScrubRules.data.js';

const EMPTY = Object.freeze({
  cannedParagraphs: [],
  personaRepairs: [],
  surnameRepairs: [],
  attributionRepairs: [],
  personaWarningNames: null,
  cannedParagraphWarning: null,
});

const compile = (source, flags, where) => {
  try {
    return new RegExp(source, flags);
  } catch (err) {
    console.warn(`[BOOKSCRUB-1] dropping an uncompilable ${where} pattern: ${String(source).slice(0, 60)} — ${err.message}`);
    return null;
  }
};

const compilePairs = (rows, where, withLabel) => (Array.isArray(rows) ? rows : []).reduce((out, row) => {
  if (!Array.isArray(row) || !row.length) return out;
  const rx = compile(row[0], 'g', where);
  if (rx) out.push(withLabel ? [rx, String(row[1] ?? ''), String(row[2] ?? where)] : [rx, String(row[1] ?? '')]);
  return out;
}, []);

/** Parse a project's own scrub rules. Returns null when it has none. */
export function parseProjectScrubRules(project) {
  const raw = project?.scrub_rules_json;
  if (!raw) return null;
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch (err) {
      console.warn(`[BOOKSCRUB-1] scrub_rules_json on project ${project?.id || '(no id)'} is not valid JSON — ignoring it. ${err.message}`);
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  return Object.freeze({
    cannedParagraphs: (Array.isArray(data.cannedParagraphs) ? data.cannedParagraphs : [])
      .map((s) => compile(s, 'gi', 'cannedParagraphs')).filter(Boolean),
    personaRepairs: compilePairs(data.personaRepairs, 'personaRepairs', true),
    surnameRepairs: compilePairs(data.surnameRepairs, 'surnameRepairs', true),
    attributionRepairs: compilePairs(data.attributionRepairs, 'attributionRepairs', false),
    personaWarningNames: data.personaWarningNames ? compile(data.personaWarningNames, 'i', 'personaWarningNames') : null,
    cannedParagraphWarning: data.cannedParagraphWarning ? compile(data.cannedParagraphWarning, 'i', 'cannedParagraphWarning') : null,
  });
}

/**
 * The scrub rules for a project: its own if it has any, otherwise the legacy set.
 *
 * `allowLegacy` exists so a caller can prove a project is clean of another book's
 * data. A NEW project should never inherit one; that it currently does is a
 * deliberate, announced compatibility choice, not an accident.
 */
export function resolveScrubRules(project, { allowLegacy = true } = {}) {
  const own = parseProjectScrubRules(project);
  if (own) {
    console.log(`[BOOKSCRUB-1] project ${project?.id || '(no id)'} is using its own scrub rules`);
    return own;
  }
  if (!allowLegacy) return EMPTY;
  console.warn(
    `[BOOKSCRUB-1] project ${project?.id || '(no id)'} has no scrub_rules_json — falling back to the LEGACY set, `
    + 'which names one specific book\'s invented personas. Set scrub_rules_json on this project to stop that.',
  );
  return LEGACY_BOOK_SCRUB_RULES;
}

export { EMPTY as EMPTY_SCRUB_RULES };
