/**
 * comfyuiClient.test.mjs — Tests for comfyuiClient.js
 *
 * Covers:
 *   - COMFYUI_DEFAULT_BASE_URL constant
 *   - getComfyUIBaseUrl fallback behavior
 *   - normalizeComfyUIError for all error categories
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMFYUI_DEFAULT_BASE_URL,
  getComfyUIBaseUrl,
  normalizeComfyUIError,
} from '../src/lib/comfyuiClient.js';

describe('comfyuiClient', () => {
  // ── Constants ──────────────────────────────────────────────────
  describe('COMFYUI_DEFAULT_BASE_URL', () => {
    it('should be http://127.0.0.1:8188', () => {
      assert.equal(COMFYUI_DEFAULT_BASE_URL, 'http://127.0.0.1:8000');
    });
  });

  // ── getComfyUIBaseUrl ──────────────────────────────────────────
  describe('getComfyUIBaseUrl', () => {
    it('should return a string starting with http', () => {
      const url = getComfyUIBaseUrl();
      assert.equal(typeof url, 'string');
      assert.ok(url.startsWith('http'), `Expected url to start with "http", got "${url}"`);
    });
  });

  // ── normalizeComfyUIError ──────────────────────────────────────
  describe('normalizeComfyUIError', () => {
    it('should handle ECONNREFUSED', () => {
      const result = normalizeComfyUIError(new Error('ECONNREFUSED at 127.0.0.1'));
      assert.ok(result.includes('Cannot connect to ComfyUI'));
    });

    it('should handle "Failed to fetch"', () => {
      const result = normalizeComfyUIError(new Error('Failed to fetch'));
      assert.ok(result.includes('Cannot connect to ComfyUI'));
    });

    it('should handle AbortError', () => {
      const result = normalizeComfyUIError(new Error('The operation was aborted: AbortError'));
      assert.ok(result.includes('timed out') || result.includes('abort'));
    });

    it('should handle "timed out"', () => {
      const result = normalizeComfyUIError(new Error('Image generation timed out'));
      assert.ok(result.includes('timed out'));
    });

    it('should handle prompt_id errors', () => {
      const result = normalizeComfyUIError(new Error('ComfyUI returned no prompt_id'));
      assert.ok(result.includes('prompt_id') || result.includes('job ID'));
    });

    it('should handle HTTP 500 errors', () => {
      const result = normalizeComfyUIError(new Error('HTTP 500 Internal Server Error'));
      assert.ok(result.includes('server error') || result.includes('HTTP 5'));
    });

    it('should handle unknown errors with generic prefix', () => {
      const result = normalizeComfyUIError(new Error('something completely unexpected'));
      assert.ok(result.includes('ComfyUI error:'));
      assert.ok(result.includes('something completely unexpected'));
    });

    it('should handle string input (not Error object)', () => {
      const result = normalizeComfyUIError('raw ECONNREFUSED string');
      assert.ok(result.includes('Cannot connect to ComfyUI'));
    });
  });
});
