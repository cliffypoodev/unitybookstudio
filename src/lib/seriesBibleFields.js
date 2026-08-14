/**
 * WAVE9-SILENTSERIES — read Series Bible JSON fields without losing the failure.
 *
 * SeriesManager stored most of its continuity data as JSON strings on the
 * SeriesBible entity (`characters_json`, `unresolved_threads`,
 * `secrets_remaining`, `deaths_and_losses`, per-volume `volume_bible_json`) and
 * parsed every one of them inside a bare `catch (e) {}`.
 *
 * That is not a harmless guard. These fields are what carry book N's state into
 * book N+1: the returning cast, the threads still open, the secrets not yet
 * revealed, and — most consequentially — the list headed "DEAD — DO NOT
 * RESURRECT". A single malformed field meant the next book's prompt was built
 * *without* that instruction, and nothing anywhere said so. The failure mode is
 * a character walking back into book four alive, discovered by the reader.
 *
 * So: still degrade to the fallback, because a broken field should not take the
 * page down. But record which field failed, so the caller can say so.
 *
 * @module seriesBibleFields
 */

/**
 * Parse one JSON-encoded Series Bible field.
 *
 * @param {*}      raw        The stored value (string, already-parsed value, or nullish)
 * @param {*}      fallback   Returned when the field is absent or unreadable
 * @param {string} label      Human-readable field name, used in the warning
 * @param {string[]} [sink]   Push-target collecting the labels that failed
 */
export function parseSeriesField(raw, fallback, label, sink) {
  if (raw === null || raw === undefined || raw === '') return fallback;

  // Already an object/array — the entity layer sometimes hands these back parsed.
  if (typeof raw !== 'string') return raw;

  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (err) {
    console.warn(`[SERIES-BIBLE] could not read "${label}" — ${err?.message || err}`);
    if (Array.isArray(sink)) sink.push(label);
    return fallback;
  }
}

/**
 * Build the sentence shown when one or more fields could not be read.
 * Returns '' when nothing failed, so callers can `if (msg) toast.warning(msg)`.
 */
export function describeFieldFailures(sink, context = '') {
  const failed = [...new Set(sink || [])].filter(Boolean);
  if (failed.length === 0) return '';

  const list = failed.length === 1
    ? failed[0]
    : `${failed.slice(0, -1).join(', ')} and ${failed[failed.length - 1]}`;

  return `Series Bible data could not be read: ${list}. ` +
    (context ? `${context} ` : '') +
    'That continuity will be missing — check the Series Bible before relying on this.';
}
