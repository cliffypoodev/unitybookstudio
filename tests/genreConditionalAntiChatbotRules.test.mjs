/**
 * genreConditionalAntiChatbotRules.test.mjs
 *
 * Tests genre-conditional rule resolution and backward compatibility.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  // Original exports (backward compat)
  SIGNATURE_VOICE_BLOCK,
  POLISHER_ANTI_CHATBOT_RULES,
  analyzeProseTexture,
  countChatbotPatterns,
  CHATBOT_PATTERNS,
  VERSION,
  // Genre-conditional voice blocks
  FICTION_SIGNATURE_VOICE_BLOCK,
  THRILLER_SIGNATURE_VOICE_BLOCK,
  LITERARY_SIGNATURE_VOICE_BLOCK,
  NONFICTION_AUTHORITY_BLOCK,
  TRAINING_MANUAL_CLARITY_BLOCK,
  BUSINESS_GUIDE_CLARITY_BLOCK,
  MEMOIR_VOICE_BLOCK,
  DEFAULT_ANTI_CHATBOT_BLOCK,
  // Genre-conditional polisher rules
  POLISHER_FICTION_RULES,
  POLISHER_NONFICTION_RULES,
  POLISHER_TRAINING_RULES,
  POLISHER_MEMOIR_RULES,
  // Resolver
  getAntiChatbotRulesForProject,
} from '../src/lib/antiChatbotProse.js';


// ═════════════════════════════════════════════════════════════════════════════
// 1. BACKWARD COMPATIBILITY
// ═════════════════════════════════════════════════════════════════════════════

describe('Backward Compatibility', () => {
  it('SIGNATURE_VOICE_BLOCK is still exported and non-empty', () => {
    assert.ok(typeof SIGNATURE_VOICE_BLOCK === 'string');
    assert.ok(SIGNATURE_VOICE_BLOCK.length > 100);
  });

  it('POLISHER_ANTI_CHATBOT_RULES is still exported and non-empty', () => {
    assert.ok(typeof POLISHER_ANTI_CHATBOT_RULES === 'string');
    assert.ok(POLISHER_ANTI_CHATBOT_RULES.length > 50);
  });

  it('analyzeProseTexture is still exported and functional', () => {
    assert.ok(typeof analyzeProseTexture === 'function');
    const result = analyzeProseTexture('The lock gave with a crack. She froze. Silence pressed against the walls of the narrow hallway.');
    assert.ok(typeof result.compositeScore === 'number');
    assert.ok(typeof result.grade === 'string');
  });

  it('countChatbotPatterns is still exported and functional', () => {
    assert.ok(typeof countChatbotPatterns === 'function');
    const result = countChatbotPatterns('She felt the weight of the moment. He noticed the change.');
    assert.ok(typeof result.total === 'number');
  });

  it('CHATBOT_PATTERNS is still exported', () => {
    assert.ok(Array.isArray(CHATBOT_PATTERNS));
    assert.ok(CHATBOT_PATTERNS.length > 0);
  });

  it('VERSION is updated to v2.0 GENRE-CONDITIONAL', () => {
    assert.ok(VERSION.includes('v2.0'));
    assert.ok(VERSION.includes('GENRE-CONDITIONAL'));
  });

  it('FICTION_SIGNATURE_VOICE_BLOCK is identical to SIGNATURE_VOICE_BLOCK', () => {
    assert.strictEqual(FICTION_SIGNATURE_VOICE_BLOCK, SIGNATURE_VOICE_BLOCK);
  });

  it('POLISHER_FICTION_RULES is identical to POLISHER_ANTI_CHATBOT_RULES', () => {
    assert.strictEqual(POLISHER_FICTION_RULES, POLISHER_ANTI_CHATBOT_RULES);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. ALL VOICE BLOCKS ARE NON-EMPTY STRINGS
// ═════════════════════════════════════════════════════════════════════════════

describe('All Voice Blocks Exported', () => {
  const blocks = {
    FICTION_SIGNATURE_VOICE_BLOCK,
    THRILLER_SIGNATURE_VOICE_BLOCK,
    LITERARY_SIGNATURE_VOICE_BLOCK,
    NONFICTION_AUTHORITY_BLOCK,
    TRAINING_MANUAL_CLARITY_BLOCK,
    BUSINESS_GUIDE_CLARITY_BLOCK,
    MEMOIR_VOICE_BLOCK,
    DEFAULT_ANTI_CHATBOT_BLOCK,
  };

  for (const [name, block] of Object.entries(blocks)) {
    it(`${name} is a non-empty string`, () => {
      assert.ok(typeof block === 'string', `${name} is not a string`);
      assert.ok(block.length > 100, `${name} is too short (${block.length} chars)`);
    });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. ALL POLISHER RULE VARIANTS ARE NON-EMPTY
// ═════════════════════════════════════════════════════════════════════════════

describe('All Polisher Rule Variants', () => {
  const rules = {
    POLISHER_FICTION_RULES,
    POLISHER_NONFICTION_RULES,
    POLISHER_TRAINING_RULES,
    POLISHER_MEMOIR_RULES,
  };

  for (const [name, rule] of Object.entries(rules)) {
    it(`${name} is a non-empty string`, () => {
      assert.ok(typeof rule === 'string', `${name} is not a string`);
      assert.ok(rule.length > 50, `${name} is too short (${rule.length} chars)`);
    });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// 4. RESOLVER: FICTION PROJECTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Fiction Projects', () => {
  it('genre:"fiction" → profileKey "fiction"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction' });
    assert.strictEqual(result.profileKey, 'fiction');
    assert.strictEqual(result.voiceBlock, FICTION_SIGNATURE_VOICE_BLOCK);
    assert.strictEqual(result.polisherRules, POLISHER_FICTION_RULES);
    assert.strictEqual(result.recastEligible, true);
  });

  it('genre:"fantasy" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fantasy' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('genre:"romance" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'romance' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('genre:"horror" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'horror' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('genre:"science fiction" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'science fiction' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('genre:"mystery" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'mystery' });
    assert.strictEqual(result.profileKey, 'fiction');
  });

  it('book_type:"anthology" → fiction', () => {
    const result = getAntiChatbotRulesForProject({ book_type: 'anthology' });
    assert.strictEqual(result.profileKey, 'fiction');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 5. RESOLVER: THRILLER SUBGENRE
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Thriller Projects', () => {
  it('subgenre:"thriller" → profileKey "thriller"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'thriller' });
    assert.strictEqual(result.profileKey, 'thriller');
    assert.strictEqual(result.voiceBlock, THRILLER_SIGNATURE_VOICE_BLOCK);
  });

  it('genre:"thriller" without subgenre → thriller', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'thriller' });
    assert.strictEqual(result.profileKey, 'thriller');
  });

  it('subgenre:"suspense" → thriller', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'suspense' });
    assert.strictEqual(result.profileKey, 'thriller');
  });

  it('subgenre:"action" → thriller', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'action' });
    assert.strictEqual(result.profileKey, 'thriller');
  });

  it('thriller voice block contains velocity/clock rules', () => {
    assert.ok(THRILLER_SIGNATURE_VOICE_BLOCK.includes('VELOCITY'));
    assert.ok(THRILLER_SIGNATURE_VOICE_BLOCK.includes('SHORT'));
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 6. RESOLVER: LITERARY SUBGENRE
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Literary Projects', () => {
  it('subgenre:"literary" → profileKey "literary"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'literary' });
    assert.strictEqual(result.profileKey, 'literary');
    assert.strictEqual(result.voiceBlock, LITERARY_SIGNATURE_VOICE_BLOCK);
  });

  it('subgenre:"speculative" → literary', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'speculative' });
    assert.strictEqual(result.profileKey, 'literary');
  });

  it('subgenre:"upmarket" → literary', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'upmarket' });
    assert.strictEqual(result.profileKey, 'literary');
  });

  it('literary voice block allows complex sentences', () => {
    assert.ok(LITERARY_SIGNATURE_VOICE_BLOCK.includes('Complex sentences are allowed'));
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 7. RESOLVER: NONFICTION PROJECTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Nonfiction Projects', () => {
  it('genre:"nonfiction" → profileKey "nonfiction"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'nonfiction' });
    assert.strictEqual(result.profileKey, 'nonfiction');
    assert.strictEqual(result.voiceBlock, NONFICTION_AUTHORITY_BLOCK);
    assert.strictEqual(result.polisherRules, POLISHER_NONFICTION_RULES);
  });

  it('book_type:"nonfiction" → nonfiction', () => {
    const result = getAntiChatbotRulesForProject({ book_type: 'nonfiction' });
    assert.strictEqual(result.profileKey, 'nonfiction');
  });

  it('genre:"investigative journalism" → nonfiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'investigative journalism' });
    assert.strictEqual(result.profileKey, 'nonfiction');
  });

  it('genre:"history" → nonfiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'history' });
    assert.strictEqual(result.profileKey, 'nonfiction');
  });

  it('genre:"biography" → nonfiction', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'biography' });
    assert.strictEqual(result.profileKey, 'nonfiction');
  });

  it('fiction rules are NOT applied to nonfiction', () => {
    const fiction = getAntiChatbotRulesForProject({ genre: 'fiction' });
    const nonfiction = getAntiChatbotRulesForProject({ genre: 'nonfiction' });
    assert.notStrictEqual(fiction.voiceBlock, nonfiction.voiceBlock);
    assert.notStrictEqual(fiction.polisherRules, nonfiction.polisherRules);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 8. RESOLVER: TRAINING MANUAL
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Training Manual Projects', () => {
  it('genre:"training" → profileKey "training_manual"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'training' });
    assert.strictEqual(result.profileKey, 'training_manual');
    assert.strictEqual(result.voiceBlock, TRAINING_MANUAL_CLARITY_BLOCK);
    assert.strictEqual(result.polisherRules, POLISHER_TRAINING_RULES);
  });

  it('project_type:"manual" → training_manual', () => {
    const result = getAntiChatbotRulesForProject({ project_type: 'manual' });
    assert.strictEqual(result.profileKey, 'training_manual');
  });

  it('genre:"caregiving" → training_manual', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'caregiving' });
    assert.strictEqual(result.profileKey, 'training_manual');
  });

  it('training_manual is not recast-eligible', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'training' });
    assert.strictEqual(result.recastEligible, false);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 9. RESOLVER: BUSINESS GUIDE
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Business Guide Projects', () => {
  it('genre:"business" → profileKey "business_guide"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'business' });
    assert.strictEqual(result.profileKey, 'business_guide');
    assert.strictEqual(result.voiceBlock, BUSINESS_GUIDE_CLARITY_BLOCK);
  });

  it('project_type:"guide" → business_guide', () => {
    const result = getAntiChatbotRulesForProject({ project_type: 'guide' });
    assert.strictEqual(result.profileKey, 'business_guide');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 10. RESOLVER: MEMOIR
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Memoir Projects', () => {
  it('genre:"memoir" → profileKey "memoir"', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'memoir' });
    assert.strictEqual(result.profileKey, 'memoir');
    assert.strictEqual(result.voiceBlock, MEMOIR_VOICE_BLOCK);
    assert.strictEqual(result.polisherRules, POLISHER_MEMOIR_RULES);
  });

  it('genre:"autobiography" → memoir', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'autobiography' });
    assert.strictEqual(result.profileKey, 'memoir');
  });

  it('project_type:"memoir" → memoir', () => {
    const result = getAntiChatbotRulesForProject({ project_type: 'memoir' });
    assert.strictEqual(result.profileKey, 'memoir');
  });

  it('memoir is recast-eligible', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'memoir' });
    assert.strictEqual(result.recastEligible, true);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 11. RESOLVER: DEFAULT / UNKNOWN
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver: Default/Unknown', () => {
  it('no project → profileKey "default"', () => {
    const result = getAntiChatbotRulesForProject();
    assert.strictEqual(result.profileKey, 'default');
    assert.strictEqual(result.voiceBlock, DEFAULT_ANTI_CHATBOT_BLOCK);
  });

  it('empty project → default', () => {
    const result = getAntiChatbotRulesForProject({});
    assert.strictEqual(result.profileKey, 'default');
  });

  it('unknown genre → default', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'xyzzy_unknown' });
    assert.strictEqual(result.profileKey, 'default');
  });

  it('default is not recast-eligible', () => {
    const result = getAntiChatbotRulesForProject({});
    assert.strictEqual(result.recastEligible, false);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 12. RESOLVER: RETURN SHAPE
// ═════════════════════════════════════════════════════════════════════════════

describe('Resolver Return Shape', () => {
  const profiles = [
    { genre: 'fiction' },
    { genre: 'nonfiction' },
    { genre: 'thriller' },
    { genre: 'memoir' },
    { genre: 'training' },
    { genre: 'business' },
    {},
  ];

  for (const p of profiles) {
    it(`${JSON.stringify(p)} returns voiceBlock, polisherRules, profileKey, recastEligible`, () => {
      const result = getAntiChatbotRulesForProject(p);
      assert.ok(typeof result.voiceBlock === 'string' && result.voiceBlock.length > 50);
      assert.ok(typeof result.polisherRules === 'string' && result.polisherRules.length > 30);
      assert.ok(typeof result.profileKey === 'string' && result.profileKey.length > 0);
      assert.ok(typeof result.recastEligible === 'boolean');
    });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// 13. SUBGENRE OVERRIDES GENRE
// ═════════════════════════════════════════════════════════════════════════════

describe('Subgenre Overrides Genre', () => {
  it('genre:"fiction" + subgenre:"thriller" → thriller (not generic fiction)', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'thriller' });
    assert.strictEqual(result.profileKey, 'thriller');
    assert.notStrictEqual(result.voiceBlock, FICTION_SIGNATURE_VOICE_BLOCK);
  });

  it('genre:"fiction" + subgenre:"literary" → literary (not generic fiction)', () => {
    const result = getAntiChatbotRulesForProject({ genre: 'fiction', subgenre: 'literary' });
    assert.strictEqual(result.profileKey, 'literary');
    assert.notStrictEqual(result.voiceBlock, FICTION_SIGNATURE_VOICE_BLOCK);
  });
});
