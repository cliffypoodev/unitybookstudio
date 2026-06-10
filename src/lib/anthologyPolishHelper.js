/**
 * Anthology Polish Helper — runs a polish sub-function per-chapter
 * instead of globally, then merges the results.
 *
 * For anthology projects, each chapter is a standalone story,
 * so caps and repetition checks must reset per chapter.
 *
 * @param {Array} loaded - full loaded chapters array
 * @param {Function} fn - polish sub-function (loaded, ...args) => { changes, ...counts }
 * @param {Array} extraArgs - additional arguments after loaded
 * @returns {object} merged result with accumulated changes and counts
 */
export function runPerChapter(loaded, fn, extraArgs = []) {
  const mergedChanges = [];
  const mergedCounts = {};

  for (const f of loaded) {
    const singleLoaded = [f];
    const result = fn(singleLoaded, ...extraArgs);

    if (result.changes) mergedChanges.push(...result.changes);

    // Accumulate all numeric fields
    for (const [key, val] of Object.entries(result)) {
      if (key === 'changes') continue;
      if (typeof val === 'number') {
        mergedCounts[key] = (mergedCounts[key] || 0) + val;
      }
    }
  }

  return { ...mergedCounts, changes: mergedChanges };
}