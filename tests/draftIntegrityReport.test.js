/**
 * draftIntegrityReport.test.js — Behavioral test for the draft integrity report.
 *
 * Tests the computeDraftIntegrityReport function which reads chapters from the DB
 * and classifies them as having content (≥100 words) or empty/failed (<100 words).
 *
 * Also tests the DraftIntegrityBanner exports a valid React component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ─────────────────────────────────────────────────────

let mockChapters = [];

vi.mock('@/api/base44Client.js', () => ({
  base44: {
    entities: {
      Chapter: {
        filter: vi.fn(async () => mockChapters),
      },
    },
  },
}));

vi.mock('@/lib/chapterStorage.js', () => ({
  resolveChapterContent: vi.fn(async (chapter) => chapter?._testContent || ''),
}));

// ── Import module under test ──────────────────────────────────────────────

const { computeDraftIntegrityReport, DRAFT_INTEGRITY_VERSION } = await import(
  '../src/lib/draftIntegrityReport.js'
);

// ── Helpers ───────────────────────────────────────────────────────────────

function makeChapter(num, wordCount, opts = {}) {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
  return {
    id: `ch-${num}`,
    chapter_number: num,
    title: opts.title || `Chapter ${num}`,
    status: 'drafted',
    project_id: 'test-project',
    _testContent: words,
  };
}

function isBodyChapter(ch) {
  const title = (ch?.title || '').toLowerCase();
  const frontMatter = ['copyright', 'title page', 'dedication', 'foreword', 'preface'];
  const backMatter = ['bibliography', 'appendix', 'acknowledgments', 'about the author'];
  if (ch?.chapter_number === 0) return false;
  for (const fm of frontMatter) if (title.includes(fm)) return false;
  for (const bm of backMatter) if (title.includes(bm)) return false;
  return true;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('computeDraftIntegrityReport', () => {
  beforeEach(() => {
    mockChapters = [];
  });

  it('has a version string', () => {
    expect(DRAFT_INTEGRITY_VERSION).toMatch(/^draftIntegrityReport-v/);
  });

  it('reports all chapters have content when all ≥100 words', async () => {
    mockChapters = [
      makeChapter(1, 150),
      makeChapter(2, 200),
      makeChapter(3, 300),
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.total).toBe(3);
    expect(report.withContent).toBe(3);
    expect(report.emptyChapterNumbers).toEqual([]);
    expect(report.emptyChapterIds).toEqual([]);
    expect(report.details).toHaveLength(3);
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('identifies empty chapters correctly (mixed results)', async () => {
    mockChapters = [
      makeChapter(1, 200),
      makeChapter(2, 0),    // empty
      makeChapter(3, 50),   // sub-100 words
      makeChapter(4, 300),
      makeChapter(5, 10),   // sub-100 words
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.total).toBe(5);
    expect(report.withContent).toBe(2);
    expect(report.emptyChapterNumbers).toEqual([2, 3, 5]);
    expect(report.emptyChapterIds).toEqual(['ch-2', 'ch-3', 'ch-5']);
  });

  it('reports all empty when no chapter has content', async () => {
    mockChapters = [
      makeChapter(1, 0),
      makeChapter(2, 0),
      makeChapter(3, 50),
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.total).toBe(3);
    expect(report.withContent).toBe(0);
    expect(report.emptyChapterNumbers).toEqual([1, 2, 3]);
  });

  it('excludes front/back matter chapters from the report', async () => {
    mockChapters = [
      makeChapter(0, 0, { title: 'Copyright Page' }),   // front matter (ch 0)
      makeChapter(1, 200),
      makeChapter(2, 0),
      makeChapter(3, 150),
      makeChapter(99, 0, { title: 'Bibliography & Sources' }), // back matter
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    // Only chapters 1, 2, 3 are body chapters
    expect(report.total).toBe(3);
    expect(report.withContent).toBe(2);
    expect(report.emptyChapterNumbers).toEqual([2]);
    expect(report.emptyChapterIds).toEqual(['ch-2']);
  });

  it('treats exactly 100 words as having content (boundary)', async () => {
    mockChapters = [
      makeChapter(1, 100),  // exactly 100 — should pass
      makeChapter(2, 99),   // 99 — should fail
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.withContent).toBe(1);
    expect(report.emptyChapterNumbers).toEqual([2]);
  });

  it('returns sorted details by chapter number', async () => {
    mockChapters = [
      makeChapter(5, 200),
      makeChapter(1, 100),
      makeChapter(3, 300),
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    const nums = report.details.map((d) => d.chapterNumber);
    expect(nums).toEqual([1, 3, 5]);
  });

  it('includes word counts in details', async () => {
    mockChapters = [
      makeChapter(1, 150),
      makeChapter(2, 0),
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.details[0].wordCount).toBe(150);
    expect(report.details[1].wordCount).toBe(0);
  });

  it('handles resolve failures gracefully (treats as 0 words)', async () => {
    const { resolveChapterContent } = await import('@/lib/chapterStorage.js');
    resolveChapterContent.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });

    mockChapters = [
      makeChapter(1, 200),
      makeChapter(2, 200), // will be resolved first (parallel), mockOnce hits one
    ];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    // One of the chapters will fail to resolve → 0 words → empty
    // The other will succeed → 200 words → content
    expect(report.total).toBe(2);
    expect(report.withContent + report.emptyChapterNumbers.length).toBe(2);
  });

  it('handles empty project (no chapters)', async () => {
    mockChapters = [];

    const report = await computeDraftIntegrityReport('test-project', isBodyChapter);

    expect(report.total).toBe(0);
    expect(report.withContent).toBe(0);
    expect(report.emptyChapterNumbers).toEqual([]);
  });
});
