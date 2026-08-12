/**
 * WAVE8-APPLY — find one passage inside a chapter, or refuse.
 *
 * Split out of chapterBackup deliberately: this is the part that decides
 * whether a destructive edit is safe, and it has no imports, so it can be
 * exercised directly by the acceptance battery instead of being asserted
 * against by reading the source.
 *
 * The contract is conservative on purpose. A passage that appears twice is not
 * "replace the first one" — it is a refusal. Silently rewriting the wrong
 * paragraph of somebody's novel is the failure mode worth designing against.
 *
 * @module passageLocator
 */

/**
 * WAVE8-PROPORTION — is this rewrite plausibly a rewrite of THAT passage?
 *
 * Found by the end-to-end run: asked to humanize one 88-character sentence, the
 * model returned 19,122 characters — an entire chapter's worth of prose — and
 * the app pasted all of it in over the sentence. Nothing objected, because
 * verifiedChapterSave only checks that what persisted matches what we told it
 * to write, and we told it to write the wrong thing.
 *
 * A local model that loses the plot on a line-edit request is a normal Tuesday,
 * so the size of what comes back is worth checking before it lands in somebody's
 * manuscript. The bounds are deliberately loose: a legitimate "show, don't tell"
 * rewrite can easily run several times the original, and short passages need
 * absolute headroom that a pure ratio would not give them. This is here to catch
 * the model answering a different question, not to police style.
 */
export function assessReplacement(original, replacement) {
  const from = String(original || '').trim();
  const to = String(replacement || '').trim();

  if (!to) return { ok: false, reason: 'the rewrite is empty' };
  if (to === from) return { ok: false, reason: 'the rewrite is identical to the original' };

  const ceiling = from.length * 4 + 200;
  if (to.length > ceiling) {
    return {
      ok: false,
      reason: `the rewrite is ${to.length} characters for a ${from.length}-character passage — the model appears to have rewritten more than the passage`,
    };
  }

  const floor = Math.floor(from.length / 4) - 40;
  if (from.length > 120 && to.length < floor) {
    return {
      ok: false,
      reason: `the rewrite is ${to.length} characters for a ${from.length}-character passage — the model appears to have summarized rather than rewritten`,
    };
  }

  return { ok: true };
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a whitespace-tolerant matcher for a passage.
 *
 * The sentence heatmap reads from a normalized copy of the chapter, which
 * collapses trailing spaces and runs of blank lines. The stored content is
 * normalized too, so an exact match is the common case — but a passage that
 * straddles a paragraph break can differ by exactly the whitespace that was
 * collapsed. Matching runs of whitespace as `\s+` closes that gap without
 * loosening anything else.
 */
export function flexibleMatcher(passage) {
  const pattern = escapeRegex(String(passage).trim()).replace(/\s+/g, '\\s+');
  return new RegExp(pattern, 'g');
}

/**
 * Locate a passage inside a body of text, refusing anything ambiguous.
 *
 * @param {string} content  The full chapter text
 * @param {string} passage  The passage to find
 * @returns {{ found: boolean, count: number, start?: number, end?: number, exact?: boolean, reason?: string }}
 */
export function locatePassage(content, passage) {
  const needle = String(passage || '').trim();
  if (!needle) return { found: false, count: 0, reason: 'empty passage' };
  if (!content) return { found: false, count: 0, reason: 'chapter has no content' };

  // Exact first — cheapest and least surprising.
  const exact = [];
  let from = 0;
  for (;;) {
    const at = content.indexOf(needle, from);
    if (at === -1) break;
    exact.push(at);
    from = at + 1;
  }

  if (exact.length === 1) {
    return { found: true, count: 1, exact: true, start: exact[0], end: exact[0] + needle.length };
  }
  if (exact.length > 1) {
    return { found: false, count: exact.length, reason: `passage appears ${exact.length} times — too ambiguous to replace safely` };
  }

  // Whitespace-tolerant fallback.
  const rx = flexibleMatcher(needle);
  const loose = [];
  let m;
  while ((m = rx.exec(content)) !== null) {
    loose.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === rx.lastIndex) rx.lastIndex += 1;
  }

  if (loose.length === 1) return { found: true, count: 1, exact: false, ...loose[0] };
  if (loose.length > 1) {
    return { found: false, count: loose.length, reason: `passage appears ${loose.length} times — too ambiguous to replace safely` };
  }

  return { found: false, count: 0, reason: 'passage no longer appears in the chapter — it may have been edited since the scan' };
}
