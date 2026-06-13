/**
 * Parallel Draft Pool — work-stealing concurrency utility.
 *
 * Extracted from ProjectStudio.jsx for reuse across TransformSubPage
 * and any future batch-processing surfaces.
 *
 * @module parallelDraftPool
 */

/** Default number of concurrent lanes. */
export const PARALLEL_DRAFT_LANE_LIMIT = 4;

/**
 * Run `worker` over every item in `items` using a work-stealing pool
 * of `options.limit` concurrent lanes (default 4).
 *
 * Results mirror the `Promise.allSettled` shape:
 *   { status: 'fulfilled', value, chapter }
 *   { status: 'rejected',  reason, chapter }
 *
 * @param {Array}    items                Array of items to process.
 * @param {Function} worker               `async (item, currentIndex, laneIndex) => value`
 * @param {object}   [options]
 * @param {number}   [options.limit]       Max concurrent lanes (capped to items.length).
 * @param {Function} [options.onProgress]  `(currentIndex, result) => void` — called after each item.
 * @returns {Promise<Array>} results[] in the same order as items[].
 */
export async function runParallelDraftPool(items, worker, options = {}) {
  const limit = Math.max(1, Math.min(
    Math.max(1, Number(options.limit || PARALLEL_DRAFT_LANE_LIMIT) || PARALLEL_DRAFT_LANE_LIMIT),
    Math.max(1, items.length),
  ));
  const results = new Array(items.length);
  let cursor = 0;

  async function runLane(laneIndex) {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      const item = items[currentIndex];

      try {
        const value = await worker(item, currentIndex, laneIndex);
        results[currentIndex] = { status: 'fulfilled', value, chapter: item };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason, chapter: item };
      }

      if (typeof options.onProgress === 'function') {
        try { options.onProgress(currentIndex, results[currentIndex]); } catch { /* swallow */ }
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, (_, index) => runLane(index)));
  return results;
}
