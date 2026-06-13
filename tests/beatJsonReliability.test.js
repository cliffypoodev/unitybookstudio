/**
 * beatJsonReliability.test.js — Behavioral tests for JSON salvage and retry.
 *
 * Tests:
 * (a) System-prompt-leaked preamble + valid JSON → salvages the JSON
 * (b) Reasoning preamble + valid JSON → salvages the JSON
 * (c) Pure preamble with no JSON → returns null
 * (d) Clean JSON → parses directly
 * (e) 422 JSON-parse path is now retryable (mock callAgent: garbage then valid)
 * (f) isRetryableError includes 422
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock localLLM before importing integrationRetry ───────────────────────

let mockCallAgentImpl = async () => '';

vi.mock('@/lib/localLLM.js', () => ({
  callAgent: vi.fn(async (...args) => mockCallAgentImpl(...args)),
  callOllama: vi.fn(),
  AGENT_MODELS: {
    ghostwriter: 'ghostwriter',
    ghostwriter_nsfw: 'ghostwriter',
    architect: 'story-architect',
    researcher: 'researcher',
    critic: 'publishing-critic',
    polisher: 'prose-polisher',
  },
  AGENT_TEMPERATURES: { ghostwriter: 0.75, architect: 0.6 },
  resolveAgent: vi.fn(() => 'architect'),
  AGENT_NUM_CTX: 16384,
}));

vi.mock('@/lib/writingModel.js', () => ({
  resolveWritingModel: vi.fn(() => null),
  normalizeWritingModel: vi.fn((m) => m),
  logWritingModelUsage: vi.fn(),
  isWritingTask: vi.fn(() => true),
}));

// ── Import the module under test ──────────────────────────────────────────

const {
  _attemptJsonSalvage: attemptJsonSalvage,
  _isRetryableError: isRetryableError,
  invokeLLMWithRetry,
} = await import('../src/lib/integrationRetry.js');

const { callAgent } = await import('@/lib/localLLM.js');

// ── Real production failure fixtures ──────────────────────────────────────

const SYSTEM_PROMPT_PREAMBLE = `, you are the Unity Story Architect. Your role is to plan narrative structures, develop character arcs, and create detailed scene breakdowns. You specialize in pacing, conflict escalation, and thematic development.

Okay, let's tackle this chapter's scene beats. The user wants a nonfiction chapter about the historical evolution of cryptographic methods.

`;

const REASONING_PREAMBLE = `Okay, let me tackle this step by step. First, I need to understand the chapter's context. The user wants beats for Chapter 3 which covers the development of public-key cryptography. Let me think about how to structure this...

`;

const VALID_JSON = '{"scenes":[{"beat":"Introduction to the chapter topic","setting":"Academic overview","characters":["narrator"],"conflict":"Establishing the knowledge gap","resolution":"Preview of key concepts"}]}';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('attemptJsonSalvage — preamble handling', () => {
  it('(a) salvages JSON from system-prompt-leaked preamble', () => {
    const input = SYSTEM_PROMPT_PREAMBLE + VALID_JSON;
    const result = attemptJsonSalvage(input);
    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].beat).toBe('Introduction to the chapter topic');
  });

  it('(b) salvages JSON from reasoning preamble', () => {
    const input = REASONING_PREAMBLE + VALID_JSON;
    const result = attemptJsonSalvage(input);
    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
    expect(result.scenes).toHaveLength(1);
  });

  it('(c) pure preamble with no JSON returns null', () => {
    const purePreamble = `Okay, let me tackle this step by step. First, I need to understand the chapter's context. The user wants beats for Chapter 3 which covers the development of public-key cryptography. Let me think about how to structure this. I should consider the key historical events and the major breakthroughs. This is going to be a comprehensive overview.`;
    const result = attemptJsonSalvage(purePreamble);
    expect(result).toBeNull();
  });

  it('(d) clean JSON parses directly', () => {
    const result = attemptJsonSalvage(VALID_JSON);
    expect(result).not.toBeNull();
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].beat).toBe('Introduction to the chapter topic');
  });

  it('handles null/undefined input', () => {
    expect(attemptJsonSalvage(null)).toBeNull();
    expect(attemptJsonSalvage(undefined)).toBeNull();
    expect(attemptJsonSalvage('')).toBeNull();
  });

  it('handles <think> blocks before JSON', () => {
    const input = '<think>Let me reason about this...</think>' + VALID_JSON;
    const result = attemptJsonSalvage(input);
    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
  });

  it('handles markdown-fenced JSON', () => {
    const input = '```json\n' + VALID_JSON + '\n```';
    const result = attemptJsonSalvage(input);
    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
  });

  it('prefers largest balanced JSON when preamble contains stray braces', () => {
    // Preamble mentions "the structure {outline}" then the real JSON follows
    const input = 'Let me think about the structure {outline} and now here is the answer: ' + VALID_JSON;
    const result = attemptJsonSalvage(input);
    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
    expect(result.scenes).toHaveLength(1);
  });
});

describe('isRetryableError', () => {
  it('(f) treats 422 as retryable', () => {
    const err = new Error('LLM response was not valid JSON');
    err.status = 422;
    err.response = { status: 422 };
    expect(isRetryableError(err)).toBe(true);
  });

  it('treats 429 as retryable', () => {
    const err = new Error('Rate limit');
    err.status = 429;
    expect(isRetryableError(err)).toBe(true);
  });

  it('treats 503 as retryable', () => {
    const err = new Error('Ollama unavailable');
    err.status = 503;
    expect(isRetryableError(err)).toBe(true);
  });

  it('treats 403 as NOT retryable', () => {
    const err = new Error('Forbidden');
    err.status = 403;
    expect(isRetryableError(err)).toBe(false);
  });
});

describe('invokeLLMWithRetry — JSON retry behavior', () => {
  beforeEach(() => {
    callAgent.mockReset();
  });

  it('(e) retries on garbage response then succeeds on valid JSON', async () => {
    const garbage = 'Okay let me think about this... no JSON here at all, just reasoning and preamble text without any braces';
    let callCount = 0;
    callAgent.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return garbage;
      return VALID_JSON;
    });

    const result = await invokeLLMWithRetry({
      prompt: 'Generate beats',
      task_type: 'beats',
      response_json_schema: { type: 'object' },
    });

    expect(result).not.toBeNull();
    expect(result.scenes).toBeDefined();
    expect(callCount).toBe(3); // 2 garbage + 1 valid
  });

  it('throws after all JSON retries exhausted', async () => {
    const garbage = 'Pure preamble with no JSON whatsoever, just text and more text and reasoning';
    callAgent.mockImplementation(async () => garbage);

    await expect(
      invokeLLMWithRetry({
        prompt: 'Generate beats',
        task_type: 'beats',
        response_json_schema: { type: 'object' },
      }, 1) // 1 outer attempt = only inner JSON retries
    ).rejects.toThrow('LLM response was not valid JSON');

    // 3 JSON retries (inner loop) × 1 outer attempt
    expect(callAgent).toHaveBeenCalledTimes(3);
  });

  it('does not JSON-retry for non-schema (prose) calls', async () => {
    callAgent.mockImplementation(async () => 'Some prose text');

    const result = await invokeLLMWithRetry({
      prompt: 'Write chapter',
      task_type: 'prose',
    });

    expect(result).toBe('Some prose text');
    expect(callAgent).toHaveBeenCalledTimes(1);
  });
});
