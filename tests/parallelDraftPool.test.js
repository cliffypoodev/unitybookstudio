/**
 * parallelDraftPool — unit tests
 */
import { describe, it, expect } from 'vitest';
import { runParallelDraftPool, PARALLEL_DRAFT_LANE_LIMIT } from '../src/lib/parallelDraftPool.js';

describe('parallelDraftPool', () => {
  it('exports PARALLEL_DRAFT_LANE_LIMIT as 4', () => {
    expect(PARALLEL_DRAFT_LANE_LIMIT).toBe(4);
  });

  it('processes all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runParallelDraftPool(
      items,
      async (item) => item * 2,
      { limit: 2 }
    );
    expect(results).toHaveLength(5);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    expect(results.map(r => r.value)).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects concurrency limit', async () => {
    let maxConcurrent = 0;
    let current = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await runParallelDraftPool(
      items,
      async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 50));
        current--;
      },
      { limit: 3 }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('handles empty array', async () => {
    const results = await runParallelDraftPool([], async () => {}, { limit: 4 });
    expect(results).toEqual([]);
  });

  it('captures failures as rejected results', async () => {
    const items = [1, 2, 3];
    const results = await runParallelDraftPool(
      items,
      async (item) => {
        if (item === 2) throw new Error('fail');
        return item;
      },
      { limit: 2 }
    );
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
  });

  it('defaults to PARALLEL_DRAFT_LANE_LIMIT when no limit specified', async () => {
    let maxConcurrent = 0;
    let current = 0;
    const items = Array.from({ length: 8 }, (_, i) => i);

    await runParallelDraftPool(
      items,
      async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 30));
        current--;
      }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(PARALLEL_DRAFT_LANE_LIMIT);
  });
});
