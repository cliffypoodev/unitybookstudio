/**
 * evidenceContext — tests for buildProjectContext with evidence + checkProperNouns
 */
import { describe, it, expect } from 'vitest';
import { buildProjectContext, checkProperNouns } from '../src/lib/publishingPrompts.js';

describe('buildProjectContext with evidence', () => {
  const project = {
    title: 'The Shadow Garden',
    genre: 'Thriller',
    project_type: 'fiction',
    author_name: 'Jane Smith',
    tagline: 'A gripping mystery',
  };

  it('returns context without evidence when none supplied', () => {
    const ctx = buildProjectContext(project, []);
    expect(ctx).toContain('The Shadow Garden');
    expect(ctx).not.toContain('MANUSCRIPT EVIDENCE');
  });

  it('injects evidence metrics when supplied', () => {
    const evidence = {
      manuscript: {
        totalWords: 85000,
        chapterCount: 24,
        ttr: 0.42,
        pacingCurve: [3000, 3500, 4000],
        dialogueRatioCurve: [0.3, 0.4, 0.35],
        slopScoreCurve: [1.2, 2.1, 0.8],
      },
    };
    const ctx = buildProjectContext(project, [], 'project', null, evidence);
    expect(ctx).toContain('MANUSCRIPT EVIDENCE');
    expect(ctx).toContain('85,000');
    expect(ctx).toContain('24');
    expect(ctx).toContain('0.42');
    expect(ctx).toContain('must be supported');
  });
});

describe('checkProperNouns', () => {
  const project = {
    title: 'The Shadow Garden',
    author_name: 'Jane Smith',
    characters_md: 'Elena is a detective. Marcus is her partner.',
  };

  it('returns empty when all names are known', () => {
    const text = 'Elena spoke with Marcus about the case.';
    const result = checkProperNouns(text, project);
    expect(result).toEqual([]);
  });

  it('flags unknown proper nouns', () => {
    const text = 'Benjamin Torres confronted Elena in the alley.';
    const result = checkProperNouns(text, project);
    expect(result).toContain('Benjamin Torres');
  });

  it('skips common English words', () => {
    const text = 'The first chapter was good.';
    const result = checkProperNouns(text, project);
    expect(result).toEqual([]);
  });

  it('handles null inputs', () => {
    expect(checkProperNouns(null, project)).toEqual([]);
    expect(checkProperNouns('text', null)).toEqual([]);
  });
});
