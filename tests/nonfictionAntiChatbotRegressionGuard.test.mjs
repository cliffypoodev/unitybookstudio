/**
 * nonfictionAntiChatbotRegressionGuard.test.mjs
 *
 * Regression guard: verifies that nonfiction rules do NOT contain
 * fiction-biased instructions and DO contain nonfiction-appropriate rules.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  NONFICTION_AUTHORITY_BLOCK,
  FICTION_SIGNATURE_VOICE_BLOCK,
  THRILLER_SIGNATURE_VOICE_BLOCK,
  TRAINING_MANUAL_CLARITY_BLOCK,
  MEMOIR_VOICE_BLOCK,
  DEFAULT_ANTI_CHATBOT_BLOCK,
  POLISHER_NONFICTION_RULES,
  POLISHER_FICTION_RULES,
  getAntiChatbotRulesForProject,
  analyzeProseTexture,
} from '../src/lib/antiChatbotProse.js';

// ─── Helper: case-insensitive contains ───────────────────────────────────────
const contains = (block, phrase) =>
  block.toLowerCase().includes(phrase.toLowerCase());

// ═══════════════════════════════════════════════════════════════════════════════
// 1 & 2  – NONFICTION_AUTHORITY_BLOCK content checks
// ═══════════════════════════════════════════════════════════════════════════════

describe('Nonfiction Block Content', () => {
  // ── Fiction-biased instructions MUST be absent ──

  it('does NOT instruct to use fragments deliberately (fiction phrasing)', () => {
    // The block *does* say "Do NOT use forced literary fragments" (a prohibition).
    // It must NOT contain the fiction instruction "Use fragments deliberately".
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'Use fragments deliberately'),
      'Nonfiction block should not contain the fiction instruction "Use fragments deliberately"'
    );
  });

  it('does NOT contain "sensory overload" as an instruction to add it', () => {
    // The block says "Do NOT inject fictional sensory overload" — a prohibition.
    // The phrase appears only as something to AVOID, which is correct.
    // Verify the positive instruction form is absent:
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'add sensory overload'),
      'Nonfiction block should not instruct adding sensory overload'
    );
  });

  it('does NOT contain "noir" as a style instruction (only as a prohibition)', () => {
    // The block says "Do NOT compress into noir or grit texture" — prohibition.
    // Verify the block doesn't instruct TO write in noir style.
    const idx = NONFICTION_AUTHORITY_BLOCK.toLowerCase().indexOf('noir');
    if (idx !== -1) {
      // If 'noir' appears, it must be inside a prohibition (preceded by "NOT")
      const context = NONFICTION_AUTHORITY_BLOCK.substring(Math.max(0, idx - 60), idx + 30);
      assert.ok(
        context.includes('NOT'),
        `"noir" appears in nonfiction block but not as a prohibition: "${context}"`
      );
    }
    // If 'noir' doesn't appear at all, that's also fine.
  });

  it('does NOT contain "grit texture" as a positive instruction', () => {
    const idx = NONFICTION_AUTHORITY_BLOCK.toLowerCase().indexOf('grit texture');
    if (idx !== -1) {
      const context = NONFICTION_AUTHORITY_BLOCK.substring(Math.max(0, idx - 60), idx + 30);
      assert.ok(
        context.includes('NOT'),
        `"grit texture" appears but not as a prohibition: "${context}"`
      );
    }
  });

  it('does NOT contain "lyricism" as an instruction', () => {
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'lyricism'),
      'Nonfiction block should not reference "lyricism"'
    );
  });

  it('does NOT contain "scene pressure" as a fiction concept to apply', () => {
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'scene pressure'),
      'Nonfiction block should not reference "scene pressure"'
    );
  });

  // ── Nonfiction-appropriate rules MUST be present ──

  it('DOES contain "authority"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'authority'),
      'Nonfiction block must contain "authority"'
    );
  });

  it('DOES contain "concrete"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'concrete'),
      'Nonfiction block must contain "concrete"'
    );
  });

  it('DOES contain "active voice"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'active voice'),
      'Nonfiction block must contain "active voice"'
    );
  });

  it('DOES contain "thesis"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'thesis'),
      'Nonfiction block must contain "thesis"'
    );
  });

  it('DOES contain "source discipline"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'source discipline'),
      'Nonfiction block must contain "source discipline"'
    );
  });

  it('DOES contain "citation"', () => {
    assert.ok(
      contains(NONFICTION_AUTHORITY_BLOCK, 'citation'),
      'Nonfiction block must contain "citation"'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 & 4  – POLISHER_NONFICTION_RULES content checks
// ═══════════════════════════════════════════════════════════════════════════════

describe('Polisher Nonfiction Rules', () => {
  // ── Fiction-biased concepts MUST be absent ──

  it('does NOT contain "Use fragments deliberately"', () => {
    assert.ok(
      !contains(POLISHER_NONFICTION_RULES, 'Use fragments deliberately'),
      'Polisher nonfiction rules should not instruct using fragments'
    );
  });

  it('does NOT contain "sensory" as a positive instruction', () => {
    // The block says "Do NOT add fragments, sensory overload, noir texture,
    // or literary compression." — that's a prohibition.
    // Verify no POSITIVE mention of sensory:
    const lines = POLISHER_NONFICTION_RULES.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('sensory')) {
        assert.ok(
          line.includes('NOT') || line.includes('Do not'),
          `"sensory" appears as a positive instruction: "${line.trim()}"`
        );
      }
    }
  });

  it('does NOT contain "noir" as a positive instruction', () => {
    const lines = POLISHER_NONFICTION_RULES.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('noir')) {
        assert.ok(
          line.includes('NOT') || line.includes('Do not'),
          `"noir" appears as a positive instruction: "${line.trim()}"`
        );
      }
    }
  });

  it('does NOT contain "literary compression" as a positive instruction', () => {
    const lines = POLISHER_NONFICTION_RULES.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('literary compression')) {
        assert.ok(
          line.includes('NOT') || line.includes('Do not'),
          `"literary compression" appears as positive instruction: "${line.trim()}"`
        );
      }
    }
  });

  // ── Nonfiction-appropriate content MUST be present ──

  it('DOES contain "paragraph opening"', () => {
    assert.ok(
      contains(POLISHER_NONFICTION_RULES, 'paragraph opening'),
      'Polisher nonfiction rules must mention paragraph openings'
    );
  });

  it('DOES contain "paragraph ending"', () => {
    assert.ok(
      contains(POLISHER_NONFICTION_RULES, 'paragraph ending'),
      'Polisher nonfiction rules must mention paragraph endings'
    );
  });

  it('DOES contain "citation"', () => {
    assert.ok(
      contains(POLISHER_NONFICTION_RULES, 'citation'),
      'Polisher nonfiction rules must mention citations'
    );
  });

  it('DOES contain "data"', () => {
    assert.ok(
      contains(POLISHER_NONFICTION_RULES, 'data'),
      'Polisher nonfiction rules must mention data preservation'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5  – Fiction vs Nonfiction Separation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fiction vs Nonfiction Separation', () => {
  it('fiction rules contain "Use fragments deliberately"', () => {
    assert.ok(
      contains(POLISHER_FICTION_RULES, 'fragment') ||
      contains(FICTION_SIGNATURE_VOICE_BLOCK, 'Use fragments deliberately'),
      'Fiction rules should instruct using fragments'
    );
  });

  it('fiction voice block contains "sensory"', () => {
    assert.ok(
      contains(FICTION_SIGNATURE_VOICE_BLOCK, 'sensory'),
      'Fiction voice block should reference sensory details'
    );
  });

  it('nonfiction block does NOT contain "Use fragments deliberately"', () => {
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'Use fragments deliberately'),
      'Nonfiction must not instruct using fragments'
    );
  });

  it('nonfiction polisher does NOT positively instruct "sensory"', () => {
    // Sensory only appears in a prohibition line in nonfiction polisher
    const lines = POLISHER_NONFICTION_RULES.split('\n');
    const sensoryLines = lines.filter(l => l.toLowerCase().includes('sensory'));
    for (const line of sensoryLines) {
      assert.ok(
        line.includes('NOT'),
        `Nonfiction polisher mentions "sensory" positively: "${line.trim()}"`
      );
    }
  });

  it('fiction voice block uses fragment instruction that nonfiction does not', () => {
    assert.ok(
      contains(FICTION_SIGNATURE_VOICE_BLOCK, 'Use fragments deliberately'),
      'Fiction should instruct "Use fragments deliberately"'
    );
    assert.ok(
      !contains(NONFICTION_AUTHORITY_BLOCK, 'Use fragments deliberately'),
      'Nonfiction should NOT instruct "Use fragments deliberately"'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6–8  – Resolver Correctness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Resolver Correctness', () => {
  it('nonfiction project gets nonfiction profile', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'nonfiction' });
    assert.strictEqual(result.profileKey, 'nonfiction');
  });

  it('fiction project gets fiction profile', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('training project gets training_manual profile', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'training' });
    assert.strictEqual(result.profileKey, 'training_manual');
  });

  it('thriller subgenre gets thriller profile', () => {
    const result = getAntiChatbotRulesForProject({ subgenre: 'thriller' });
    assert.strictEqual(result.profileKey, 'thriller');
  });

  it('memoir genre gets memoir profile', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'memoir' });
    assert.strictEqual(result.profileKey, 'memoir');
  });

  it('unknown genre falls back to default profile', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'unknown_genre_xyz' });
    assert.strictEqual(result.profileKey, 'default');
  });

  it('empty project falls back to default profile', () => {
    const result = getAntiChatbotRulesForProject({});
    assert.strictEqual(result.profileKey, 'default');
  });

  it('null project falls back to default profile', () => {
    const result = getAntiChatbotRulesForProject(null);
    assert.strictEqual(result.profileKey, 'default');
  });

  it('nonfiction result includes the NONFICTION_AUTHORITY_BLOCK as voiceBlock', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'nonfiction' });
    assert.strictEqual(result.voiceBlock, NONFICTION_AUTHORITY_BLOCK);
  });

  it('fiction result includes FICTION_SIGNATURE_VOICE_BLOCK as voiceBlock', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction' });
    assert.strictEqual(result.voiceBlock, FICTION_SIGNATURE_VOICE_BLOCK);
  });

  it('training result includes TRAINING_MANUAL_CLARITY_BLOCK as voiceBlock', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'training' });
    assert.strictEqual(result.voiceBlock, TRAINING_MANUAL_CLARITY_BLOCK);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9 & 10  – TRAINING_MANUAL_CLARITY_BLOCK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Training Manual Rules', () => {
  it('does NOT contain "Use fragments deliberately"', () => {
    assert.ok(
      !contains(TRAINING_MANUAL_CLARITY_BLOCK, 'Use fragments deliberately'),
      'Training manual should not instruct using fragments'
    );
  });

  it('does NOT contain "fragment" as a positive fiction instruction', () => {
    // Training manual should not reference fragments at all
    assert.ok(
      !contains(TRAINING_MANUAL_CLARITY_BLOCK, 'fragment'),
      'Training manual should not reference "fragment"'
    );
  });

  it('does NOT contain "sensory"', () => {
    assert.ok(
      !contains(TRAINING_MANUAL_CLARITY_BLOCK, 'sensory'),
      'Training manual should not reference "sensory"'
    );
  });

  it('does NOT contain "scene pressure"', () => {
    assert.ok(
      !contains(TRAINING_MANUAL_CLARITY_BLOCK, 'scene pressure'),
      'Training manual should not reference "scene pressure"'
    );
  });

  it('DOES contain "imperative"', () => {
    assert.ok(
      contains(TRAINING_MANUAL_CLARITY_BLOCK, 'imperative'),
      'Training manual must mention imperative mood'
    );
  });

  it('DOES contain "structure"', () => {
    assert.ok(
      contains(TRAINING_MANUAL_CLARITY_BLOCK, 'structure'),
      'Training manual must mention structure preservation'
    );
  });

  it('DOES contain "compliance"', () => {
    assert.ok(
      contains(TRAINING_MANUAL_CLARITY_BLOCK, 'compliance'),
      'Training manual must mention compliance'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11 & 12  – MEMOIR_VOICE_BLOCK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Memoir Rules', () => {
  it('does NOT contain "noir"', () => {
    assert.ok(
      !contains(MEMOIR_VOICE_BLOCK, 'noir'),
      'Memoir block should not reference "noir"'
    );
  });

  it('does NOT contain "grit"', () => {
    assert.ok(
      !contains(MEMOIR_VOICE_BLOCK, 'grit'),
      'Memoir block should not reference "grit"'
    );
  });

  it('does NOT contain "velocity"', () => {
    assert.ok(
      !contains(MEMOIR_VOICE_BLOCK, 'velocity'),
      'Memoir block should not reference "velocity"'
    );
  });

  it('DOES contain "voice preservation"', () => {
    assert.ok(
      contains(MEMOIR_VOICE_BLOCK, 'voice preservation'),
      'Memoir block must mention "voice preservation"'
    );
  });

  it('DOES contain "filter verbs"', () => {
    assert.ok(
      contains(MEMOIR_VOICE_BLOCK, 'filter verbs'),
      'Memoir block must mention "filter verbs"'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13 & 14  – DEFAULT_ANTI_CHATBOT_BLOCK
// ═══════════════════════════════════════════════════════════════════════════════

describe('Default Rules', () => {
  it('does NOT contain "Use fragments deliberately"', () => {
    assert.ok(
      !contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'Use fragments deliberately'),
      'Default block should not instruct using fragments'
    );
  });

  it('does NOT contain "fragment"', () => {
    assert.ok(
      !contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'fragment'),
      'Default block should not reference "fragment"'
    );
  });

  it('does NOT contain "sensory overload"', () => {
    assert.ok(
      !contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'sensory overload'),
      'Default block should not reference "sensory overload"'
    );
  });

  it('does NOT contain "noir"', () => {
    assert.ok(
      !contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'noir'),
      'Default block should not reference "noir"'
    );
  });

  it('DOES contain "active voice"', () => {
    assert.ok(
      contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'active voice'),
      'Default block must mention "active voice"'
    );
  });

  it('DOES contain "preservation"', () => {
    assert.ok(
      contains(DEFAULT_ANTI_CHATBOT_BLOCK, 'preservation'),
      'Default block must mention "preservation"'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15  – Nonfiction rules do not cause fragment-forcing or sensory-overload
//       instructions when used in polish
// ═══════════════════════════════════════════════════════════════════════════════

describe('Nonfiction Block Content', () => {
  it('nonfiction rules do not cause fragment-forcing or sensory-overload instructions when used in polish', () => {
    // Simulate composing a nonfiction polish prompt
    const nfResult = getAntiChatbotRulesForProject({ genre: 'nonfiction' });
    const fullPrompt = `${nfResult.voiceBlock}\n\n${nfResult.polisherRules}`;

    // The combined prompt should not contain positive fragment instructions
    assert.ok(
      !contains(fullPrompt, 'Use fragments deliberately'),
      'Combined nonfiction prompt must not instruct fragment use'
    );

    // "sensory" may appear only in prohibition context
    const lines = fullPrompt.split('\n');
    const sensoryLines = lines.filter(l => l.toLowerCase().includes('sensory'));
    for (const line of sensoryLines) {
      assert.ok(
        line.includes('NOT') || line.includes('not'),
        `Combined prompt mentions "sensory" positively: "${line.trim()}"`
      );
    }

    // "noir" may appear only in prohibition context
    const noirLines = lines.filter(l => l.toLowerCase().includes('noir'));
    for (const line of noirLines) {
      assert.ok(
        line.includes('NOT') || line.includes('not'),
        `Combined prompt mentions "noir" positively: "${line.trim()}"`
      );
    }

    // analyzeProseTexture should run without error on clean nonfiction sample
    const cleanNonfiction = `The algorithm scored applicants on 23 metrics derived from employment history. Applicants with scores below the 40th percentile were excluded from the candidate pool automatically. Between January and March 2024, the system processed 14,200 applications across twelve regional offices. The rejection rate climbed to 67 percent in the Northeast corridor, where hiring managers had tightened the threshold by fifteen percentile points without notifying the compliance team. Internal audits later revealed that three of the metrics correlated with zip code, effectively penalizing candidates from lower-income neighborhoods.`;
    const result = analyzeProseTexture(cleanNonfiction);
    assert.ok(result.compositeScore >= 0, 'analyzeProseTexture should return a non-negative composite score');
    assert.ok(result.grade !== 'INSUFFICIENT_TEXT', 'Clean nonfiction sample should be long enough to analyze');
    assert.ok(Array.isArray(result.diagnostics), 'diagnostics should be an array');
  });
});
