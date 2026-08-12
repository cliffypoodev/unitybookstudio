/**
 * EXPORTSCRUB-1 — scope for book-specific export rules.
 *
 * The export path had accumulated cleanup rules written for individual manuscripts and
 * left running on all of them, each guarded by a detector that sniffed the project's
 * own PROSE to decide whether the rule applied. That is inference, not declaration, and
 * it was wrong in the dangerous direction. Sandbox-proven against the live file:
 *
 *   - isSongbirdExportProject returns true for any book whose premise contains the word
 *     "Songbird" — a codename, a bird, a nickname. It then enables an alias pass that
 *     renames every Arthur to Langston and every Cora to Clara in the exported DOCX.
 *   - looksLikeChapterOne is `no === 1 || title includes 'best glitch ever'`, so a
 *     truncating regex written for one book's chapter 1 is tested against EVERY book's
 *     chapter 1, and on a match discards everything after the cut.
 *   - repairStyleThinningArtifacts, called unconditionally, rewrites sentences
 *     containing Zonk, Blaze, Pip and a griffon in a sparkly waistcoat.
 *   - runNonfictionFinalExportScarTissueSweep replaces four named people with the
 *     phrase "one unnamed inmate" — gated by a detector that fires on a novel whose
 *     narration contains the word "guide", "source", "archive" or "memoir".
 *
 * The standing rule in this codebase is that book specifics belong in data, never in
 * code. These rules cannot simply be deleted — one already-published book still needs
 * them to reproduce. So they stay, and a project must ASK for them by name:
 *
 *     project.legacy_export_rules = ['songbird', 'glitch']
 *
 * Anything not asked for does not run. A book that has never heard of these rules
 * cannot be touched by them, which is the only property that matters here.
 */

export const LEGACY_EXPORT_RULE_KEYS = Object.freeze([
  // Alias/style pass written for one historical novel (Arthur→Langston, Cora→Clara).
  'songbird',
  // Chapter-1 hard cut written for one book's road-trip bleed.
  'glitch',
  // Sentence repairs naming one book's cast (Zonk, Blaze, Pip).
  'styleTicRepairs',
  // Source-ledger scar sweep for one nonfiction prison history, including the
  // persona replacement that turns named people into "one unnamed inmate".
  'prisonHistorySources',
]);

/**
 * Does this project ask for a named legacy export rule? Default: no.
 *
 * Accepts an array or a comma-separated string, so it can be set from a text field
 * in the UI without a schema change.
 */
export function exportRuleEnabled(project, key) {
  if (!key) return false;
  const raw = project?.legacy_export_rules;
  if (!raw) return false;

  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[,\s]+/);

  const wanted = String(key).toLowerCase();
  const enabled = list.some((entry) => String(entry || '').trim().toLowerCase() === wanted);

  if (enabled) {
    console.warn(
      `[EXPORTSCRUB-1] project ${project?.id || '(no id)'} has opted into the legacy export rule "${key}", `
      + 'which contains one specific book\'s names and phrases.',
    );
  }

  return enabled;
}

export default exportRuleEnabled;
