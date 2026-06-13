// tests/verifiedChapterSave.test.js
// Behavioral test for the verify-and-retry save mechanism.
//
// Uses a mocked entity layer that drops the first write (returns mismatched
// content on read-back) then succeeds on retry, verifying that the retry
// logic fires and eventually produces a verified save.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the dependencies BEFORE importing the module under test ─────────

// Track call counts for assertions
let updateCallCount = 0;
let filterCallCount = 0;
const WRITTEN_CONTENT = 'This is the chapter content that should persist after a verified save.';

vi.mock('@/api/base44Client.js', () => ({
  base44: {
    entities: {
      Chapter: {
        update: vi.fn(async (_id, _payload) => {
          updateCallCount++;
          return { ok: true };
        }),
        filter: vi.fn(async ({ id }) => {
          filterCallCount++;
          // First call: simulate a dropped write (empty content)
          // Second call: simulate success
          if (filterCallCount === 1) {
            return [{ id, content_md: '' }];
          }
          return [{ id, content_md: WRITTEN_CONTENT }];
        }),
      },
    },
  },
}));

vi.mock('@/lib/chapterStorage.js', () => ({
  resolveChapterContent: vi.fn(async (record) => {
    // Return whatever content_md the mock filter gave us
    return record?.content_md || '';
  }),
}));

vi.mock('@/lib/requestRetry.js', () => ({
  runWithNetworkRetry: vi.fn(async (fn) => fn()),
}));

// ── Import module under test AFTER mocks are set up ──────────────────────

const { verifiedChapterSave } = await import('../src/lib/verifiedChapterSave.js');

describe('verifiedChapterSave', () => {
  beforeEach(async () => {
    updateCallCount = 0;
    filterCallCount = 0;
    // Re-apply default implementations (clearAllMocks strips them)
    const { base44 } = await import('@/api/base44Client.js');
    base44.entities.Chapter.update.mockImplementation(async (_id, _payload) => {
      updateCallCount++;
      return { ok: true };
    });
    base44.entities.Chapter.filter.mockImplementation(async ({ id }) => {
      filterCallCount++;
      // Default: first call returns empty, second returns content
      if (filterCallCount === 1) {
        return [{ id, content_md: '' }];
      }
      return [{ id, content_md: WRITTEN_CONTENT }];
    });
  });

  it('retries on first-write mismatch and succeeds on second attempt', async () => {
    const result = await verifiedChapterSave({
      chapterId: 'ch-test-1',
      savePayload: { content_md: WRITTEN_CONTENT, word_count: 12 },
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2); // first attempt fails verify, second succeeds
    expect(updateCallCount).toBe(2); // wrote twice
    expect(filterCallCount).toBe(2); // verified twice
  });

  it('succeeds immediately when first write verifies', async () => {
    // Override filter to always return matching content
    const { base44 } = await import('@/api/base44Client.js');
    base44.entities.Chapter.filter.mockImplementation(async ({ id }) => {
      filterCallCount++;
      return [{ id, content_md: WRITTEN_CONTENT }];
    });

    const result = await verifiedChapterSave({
      chapterId: 'ch-test-2',
      savePayload: { content_md: WRITTEN_CONTENT },
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('returns ok:false after exhausting all retries', async () => {
    // Override filter to always return empty (simulates persistent failure)
    const { base44 } = await import('@/api/base44Client.js');
    base44.entities.Chapter.filter.mockImplementation(async ({ id }) => {
      filterCallCount++;
      return [{ id, content_md: '' }];
    });

    const result = await verifiedChapterSave({
      chapterId: 'ch-test-3',
      savePayload: { content_md: WRITTEN_CONTENT },
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 3,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(4); // 1 initial + 3 retries
    expect(result.reason).toContain('mismatch');
  });

  it('returns ok:false when update throws persistently', async () => {
    const { base44 } = await import('@/api/base44Client.js');
    base44.entities.Chapter.update.mockImplementation(async () => {
      throw new Error('Network error');
    });

    const result = await verifiedChapterSave({
      chapterId: 'ch-test-4',
      savePayload: {},
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 4,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(4);
    expect(result.reason).toContain('Network error');
  });

  it('tolerates content within 5% length difference', async () => {
    const { base44 } = await import('@/api/base44Client.js');
    // Return content that's ~3% shorter (within 5% tolerance)
    const slightlyShort = WRITTEN_CONTENT.slice(0, Math.ceil(WRITTEN_CONTENT.length * 0.97));
    base44.entities.Chapter.filter.mockImplementation(async ({ id }) => {
      filterCallCount++;
      return [{ id, content_md: slightlyShort }];
    });

    const result = await verifiedChapterSave({
      chapterId: 'ch-test-5',
      savePayload: {},
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('rejects content beyond 5% length difference', async () => {
    const { base44 } = await import('@/api/base44Client.js');
    // Return content that's 50% shorter (well beyond 5% tolerance)
    const wayTooShort = WRITTEN_CONTENT.slice(0, Math.ceil(WRITTEN_CONTENT.length * 0.5));
    base44.entities.Chapter.filter.mockImplementation(async ({ id }) => {
      filterCallCount++;
      return [{ id, content_md: wayTooShort }];
    });

    const result = await verifiedChapterSave({
      chapterId: 'ch-test-6',
      savePayload: {},
      writtenContent: WRITTEN_CONTENT,
      chapterNumber: 6,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(4);
  });
});
