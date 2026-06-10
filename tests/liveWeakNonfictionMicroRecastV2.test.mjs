import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectNonfictionWeaknesses,
  runNonfictionDeterministicCleanup,
  splitNonfictionIntoMicroRecastUnits,
  buildNonfictionMicroRecastPrompt,
  shouldMicroRecastNonfictionUnit,
} from '../src/lib/nonfictionAntiChatbotCleanup.js';

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
} from '../src/lib/antiChatbotProse.js';

import {
  detectMarkdownHeadings,
  chooseRecastModel,
} from '../src/lib/recastModelRouting.js';

const NONFICTION_PROFILE = { genre: 'nonfiction', book_type: 'nonfiction' };

const FULL_WEAK_SAMPLE = `## The Quiet Crisis of Municipal Water Infrastructure

It felt like the kind of problem that could wait. For decades, municipal water systems across the American Midwest seemed to function well enough, delivering clean water to millions of households without attracting much public attention. Moreover, the systems appeared to be holding up despite their age. City officials noticed that maintenance costs were rising, but they realized that confronting the full scope of the problem would require political will that simply did not exist.

Furthermore, the scale of underinvestment was staggering. According to the American Society of Civil Engineers' 2021 Infrastructure Report Card, the nation's drinking water infrastructure received a grade of C-minus, with an estimated funding gap of $434 billion over the next twenty years (ASCE, 2021). It is important to note that this figure represents only federal and state-level estimates.

## The Human Cost of Deferred Maintenance

The consequences of this neglect were deeply felt across communities. Residents in Flint, Michigan watched their tap water turn brown and wondered whether the crisis would ever be resolved. They seemed to understand, on some fundamental level, that the system had failed them. The emotional toll was significant. Additionally, the health impacts were severe. Blood lead levels in children under six rose by 2.4 percentage points (Hanna-Attisha et al., 2016).

## Structural Barriers to Reform

The fundamental challenge felt almost insurmountable. Municipal water utilities operate within a web of regulatory, financial, and political constraints that make comprehensive reform difficult. Furthermore, the fragmented nature of water governance — with over 50,000 community water systems — means that no single policy intervention can address the problem.

A recent analysis found that consolidation could reduce per-household costs by 18 to 34 percent (Kearney & Liu, 2023). However, political resistance remained fierce. Local officials seemed to view consolidation as a loss of autonomy. Additionally, the workforce pipeline was drying up.`;

// ─── Deterministic Cleanup on Full Sample ─────────────────────────────────

describe('Live weak nonfiction cleanup', () => {
  it('1. deterministic cleanup reduces essay-bot transitions on weak sample', () => {
    const before = detectNonfictionWeaknesses(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    const result = runNonfictionDeterministicCleanup(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    const after = detectNonfictionWeaknesses(result.text, NONFICTION_PROFILE);
    assert.ok(after.essayBotTransitions < before.essayBotTransitions,
      `should reduce essay-bot transitions: before=${before.essayBotTransitions}, after=${after.essayBotTransitions}`);
  });

  it('2. deterministic cleanup preserves all headings (should be 3: ##)', () => {
    const result = runNonfictionDeterministicCleanup(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    const headingCount = detectMarkdownHeadings(result.text);
    assert.equal(headingCount, 3, `should preserve 3 headings, found ${headingCount}`);
  });

  it('3. deterministic cleanup preserves all citations', () => {
    const result = runNonfictionDeterministicCleanup(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    assert.ok(result.text.includes('(ASCE, 2021)'), 'should preserve (ASCE, 2021)');
    assert.ok(result.text.includes('(Hanna-Attisha et al., 2016)'), 'should preserve (Hanna-Attisha et al., 2016)');
    assert.ok(result.text.includes('(Kearney & Liu, 2023)'), 'should preserve (Kearney & Liu, 2023)');
  });

  it('4. word count ratio stays within safe range (90-110%) after cleanup', () => {
    const result = runNonfictionDeterministicCleanup(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    const origWords = FULL_WEAK_SAMPLE.split(/\s+/).filter(Boolean).length;
    const cleanedWords = result.text.split(/\s+/).filter(Boolean).length;
    const ratio = cleanedWords / origWords;
    assert.ok(ratio >= 0.90, `word ratio ${(ratio * 100).toFixed(1)}% is below 90%`);
    assert.ok(ratio <= 1.10, `word ratio ${(ratio * 100).toFixed(1)}% is above 110%`);
  });
});

// ─── Profile & Routing ───────────────────────────────────────────────────

describe('Profile and routing', () => {
  it('5. profile resolves to "nonfiction"', () => {
    const rules = getAntiChatbotRulesForProject(NONFICTION_PROFILE);
    assert.equal(rules.profileKey, 'nonfiction', `should resolve to nonfiction, got "${rules.profileKey}"`);
  });

  it('6. routing selects prose-recast-polisher for nonfiction micro-recast units', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const eligibleUnit = units.find(u => u.type === 'eligible');
    assert.ok(eligibleUnit, 'should have at least one eligible unit');

    const metrics = analyzeProseTexture(eligibleUnit.text);
    const routing = chooseRecastModel(NONFICTION_PROFILE, { text: eligibleUnit.text }, metrics);
    assert.equal(routing.model, 'prose-recast-polisher',
      `nonfiction should route to prose-recast-polisher, got "${routing.model}"`);
  });
});

// ─── Prompt Constraints ──────────────────────────────────────────────────

describe('Micro-recast prompt constraints', () => {
  it('7. micro-recast prompt includes paragraph-level word count constraints', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const eligibleUnit = units.find(u => u.type === 'eligible');
    assert.ok(eligibleUnit, 'should find eligible unit');

    const prompt = buildNonfictionMicroRecastPrompt(eligibleUnit, NONFICTION_PROFILE);
    const minWords = Math.floor(eligibleUnit.words * 0.95);
    const maxWords = Math.ceil(eligibleUnit.words * 1.15);
    assert.ok(prompt.includes(String(minWords)), `prompt should include min words ${minWords}`);
    assert.ok(prompt.includes(String(maxWords)), `prompt should include max words ${maxWords}`);
  });

  it('8. micro-recast prompt includes "Do not summarize"', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const eligibleUnit = units.find(u => u.type === 'eligible');
    const prompt = buildNonfictionMicroRecastPrompt(eligibleUnit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('Do not summarize'), 'prompt should include "Do not summarize"');
  });

  it('9. micro-recast prompt prohibits literary imagery', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const eligibleUnit = units.find(u => u.type === 'eligible');
    const prompt = buildNonfictionMicroRecastPrompt(eligibleUnit, NONFICTION_PROFILE);
    assert.ok(prompt.includes('literary imagery'), 'prompt should prohibit literary imagery');
  });
});

// ─── Unit Classification ─────────────────────────────────────────────────

describe('Unit classification on full sample', () => {
  it('10. eligible paragraphs detected from split units', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const eligible = units.filter(u => u.type === 'eligible');
    assert.ok(eligible.length >= 1, `should find at least 1 eligible unit, found ${eligible.length}`);
  });

  it('11. heading units are protected in split', () => {
    const { units } = splitNonfictionIntoMicroRecastUnits(FULL_WEAK_SAMPLE);
    const headingUnits = units.filter(u => u.type === 'heading');
    assert.equal(headingUnits.length, 3, `should find 3 heading units, found ${headingUnits.length}`);
    for (const u of headingUnits) {
      assert.equal(u.protected, true, `heading unit should be protected: "${u.text}"`);
    }
  });

  it('12. detectNonfictionWeaknesses finds essay-bot transitions', () => {
    const result = detectNonfictionWeaknesses(FULL_WEAK_SAMPLE, NONFICTION_PROFILE);
    // The sample has: Moreover, Furthermore (x2), Additionally (x2), It is important to note, plus filter verbs
    assert.ok(result.essayBotTransitions >= 5,
      `should find at least 5 essay-bot transitions, found ${result.essayBotTransitions}`);
    assert.equal(result.isNonfiction, true, 'should identify as nonfiction');
  });
});
