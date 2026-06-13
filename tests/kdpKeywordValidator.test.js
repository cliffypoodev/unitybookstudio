/**
 * kdpKeywordValidator — unit tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateKeyword,
  validateKeywordSet,
  KDP_KEYWORD_CHAR_LIMIT,
} from '../src/lib/kdpKeywordValidator.js';

describe('kdpKeywordValidator', () => {
  describe('validateKeyword', () => {
    it('accepts a valid keyword', () => {
      const result = validateKeyword('slow burn romantic thriller');
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.charCount).toBe(27);
    });

    it('rejects empty keyword', () => {
      const result = validateKeyword('');
      expect(result.valid).toBe(false);
    });

    it('warns on over-limit keywords', () => {
      const longKeyword = 'a'.repeat(KDP_KEYWORD_CHAR_LIMIT + 1);
      const result = validateKeyword(longKeyword);
      expect(result.warnings.some(w => w.includes('limit'))).toBe(true);
    });

    it('detects banned words', () => {
      const result = validateKeyword('bestseller fiction thriller');
      expect(result.warnings.some(w => w.includes('banned'))).toBe(true);
    });

    it('detects author name violations', () => {
      const result = validateKeyword('like stephen king thriller');
      expect(result.warnings.some(w => w.includes('author name'))).toBe(true);
    });

    it('warns on title redundancy', () => {
      const result = validateKeyword('shadow garden', {
        title: 'The Shadow Garden',
      });
      expect(result.warnings.some(w => w.includes('title'))).toBe(true);
    });

    it('warns on single short generic word', () => {
      const result = validateKeyword('book');
      expect(result.warnings.some(w => w.includes('generic'))).toBe(true);
    });
  });

  describe('validateKeywordSet', () => {
    it('validates a full set of keywords', () => {
      const keywords = [
        { keyword: 'slow burn romance' },
        { keyword: 'enemies to lovers' },
        { keyword: 'a'.repeat(55) },
      ];
      const result = validateKeywordSet(keywords);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(1);
      expect(result.results).toHaveLength(3);
    });
  });
});
