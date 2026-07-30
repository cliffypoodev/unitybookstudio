/**
 * Chapter Cohesion System — Rolling Context, Anti-Repetition, and Continuity
 * 
 * Three systems that work together:
 * 1. Chapter Summary Memory — compressed summaries injected as rolling context
 * 2. Anti-Repetition Rules — 10 mandatory rules in every prose prompt
 * 3. Previous Chapter Ending — last ~500 words for voice/rhythm continuity
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel } from '@/lib/modelRouting';
import { base44 } from '@/api/base44Client';
import { resolveChapterContent } from '@/lib/chapterStorage';

// ── SYSTEM 1: Chapter Summary Generation ─────────────────────────────────

export async function generateChapterSummary(chapterContent, chapterNumber) {
  const summaryPrompt = `Read this chapter and produce a compressed summary for continuity tracking. Respond ONLY in JSON, no markdown, no backticks.

CHAPTER ${chapterNumber} TEXT:
${chapterContent.substring(0, 12000)}

Extract:
{
  "chapter": ${chapterNumber},
  "events": "What literally happened, in order. 3-5 sentences max.",
  "emotional_state_end": "Where each named character's emotional state is at the END of this chapter. One sentence per character.",
  "revelations": "Any new information revealed to characters or the reader. List each one.",
  "metaphors_used": "List the 3-5 most distinctive metaphors, similes, or recurring images used in this chapter. Be specific — not 'darkness metaphor' but 'compared the silence to a held breath' or 'described the cold as a living thing pressing against the glass'.",
  "dialogue_moments": "The 2-3 most important things said in dialogue. Paraphrase, don't quote.",
  "unresolved": "What tension, question, or cliffhanger is the reader left with at chapter end?",
  "physical_state": "Location, time of day, injuries, items held, weather — the tangible situation at chapter end."
}`;

  const result = await invokeLLMWithRetry({
    task_type: 'prose',
    prompt: summaryPrompt,
    model: pickModel('foundation'),
    temperature: 0,
  });

  let summary;
  try {
    let sText = typeof result === 'string' ? result : result?.text || result?.content || JSON.stringify(result);
    sText = sText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    summary = JSON.parse(sText);
  } catch (e) {
    console.warn('[COHESION] Summary parse failed for Ch.' + chapterNumber + ':', e.message);
    summary = {
      chapter: chapterNumber,
      events: chapterContent.substring(0, 300),
      emotional_state_end: '',
      revelations: '',
      metaphors_used: '',
      dialogue_moments: '',
      unresolved: '',
      physical_state: '',
    };
  }

  return summary;
}

/**
 * Generate and save a chapter summary after drafting.
 * Call this after chapter prose is saved.
 */
export async function generateAndSaveSummary(chapterId, chapterContent, chapterNumber) {
  const summary = await generateChapterSummary(chapterContent, chapterNumber);
  await base44.entities.Chapter.update(chapterId, {
    summary_json: JSON.stringify(summary),
  });
  console.log('[COHESION] Summary saved for Ch.' + chapterNumber);
  return summary;
}

// ── SYSTEM 1B: Build Rolling Context from Previous Summaries ─────────────

export async function buildRollingContext(projectId, currentChapterNumber) {
  const allChapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    200
  );

  // Only consider chapters earlier than the current one
  const earlierChapters = allChapters
    .filter(c => c.chapter_number < currentChapterNumber)
    .sort((a, b) => a.chapter_number - b.chapter_number);

  if (earlierChapters.length === 0) return '';

  // Bucket prior chapters by how much context we have on each:
  //   - hasFullSummary: summary_json exists and parses (best)
  //   - hasDraftedContent: summary missing but chapter is drafted (fallback — extract from prose)
  //   - beatOnly: chapter is planned/outlined but not yet drafted (beat summary only)
  //
  // The last category is the CRITICAL new behavior: even when drafting Ch N
  // in parallel with all sibling chapters (Draft All mode), we can still tell
  // the LLM what EACH prior chapter's beat plans to cover. The LLM then
  // knows NOT to cover those beats in Ch N — preventing the "rewinding
  // chapters" bug where Ch 3 re-opens the crash scene because Ch 1's summary
  // wasn't saved yet when Ch 3's generation kicked off.
  let rollingContext = '\n=== WHAT HAS ALREADY BEEN COVERED (do NOT repeat) ===\n';

  const halfPoint = Math.floor(earlierChapters.length / 2);

  for (let i = 0; i < earlierChapters.length; i++) {
    const ch = earlierChapters[i];
    rollingContext += '\n--- Chapter ' + ch.chapter_number + ': ' + (ch.title || 'Untitled') + ' ---\n';

    let summary = null;
    if (ch.summary_json) {
      try {
        summary = JSON.parse(ch.summary_json);
      } catch {
        summary = null;
      }
    }

    if (summary) {
      // BEST: full summary is available
      if (earlierChapters.length > 10 && i < halfPoint) {
        rollingContext += 'Metaphors ALREADY USED (do not reuse): ' + (summary.metaphors_used || '') + '\n';
        rollingContext += 'Revelations: ' + (summary.revelations || '') + '\n';
      } else {
        rollingContext += 'Events: ' + (summary.events || '') + '\n';
        rollingContext += 'Emotional state at end: ' + (summary.emotional_state_end || '') + '\n';
        rollingContext += 'Revelations: ' + (summary.revelations || '') + '\n';
        rollingContext += 'Metaphors ALREADY USED (do not reuse): ' + (summary.metaphors_used || '') + '\n';
        rollingContext += 'Key dialogue moments: ' + (summary.dialogue_moments || '') + '\n';
        rollingContext += 'Unresolved tension: ' + (summary.unresolved || '') + '\n';
        rollingContext += 'Physical state: ' + (summary.physical_state || '') + '\n';
      }
    } else if (ch.beat_summary || ch.title) {
      // FALLBACK: no summary yet (either chapter still drafting in parallel,
      // or summary generation failed silently). Use the beat summary from
      // the outline as a structural stand-in. This alone is enough to
      // prevent the "rewinding chapters" bug because the LLM now knows the
      // beats this earlier chapter is claiming, even if the prose hasn't
      // finished yet.
      rollingContext += 'Beat plan (chapter is being drafted or summary pending): ' + (ch.beat_summary || ch.title || '') + '\n';
      rollingContext += 'NOTE: Do NOT cover these beats again in the current chapter, even if prior chapter is not yet finalized.\n';
    }
  }

  if (earlierChapters.length > 10) {
    rollingContext += '\nNOTE: For chapters 1-' + halfPoint + ', only the metaphors and revelations lists are shown (when available). Do not re-explain early events.\n';
  }

  rollingContext += '===\n';
  return rollingContext;
}

/**
 * Build a "sibling chapter awareness" block for use during parallel Draft All
 * operations. Unlike buildRollingContext which only looks at EARLIER chapters,
 * this looks at ALL other chapters (siblings) to help each parallel-generating
 * chapter know what its siblings are covering — so two sibling chapters don't
 * both include the crash scene, for example.
 *
 * Used as a SUPPLEMENT to buildRollingContext, not a replacement. Activated
 * in Draft All and Rewrite All flows only, where race conditions mean
 * summary_json is genuinely not available yet for siblings.
 */
export async function buildSiblingAwarenessContext(projectId, currentChapterNumber) {
  const allChapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    200
  );
  const siblings = allChapters
    .filter(c => c.chapter_number !== currentChapterNumber)
    .sort((a, b) => a.chapter_number - b.chapter_number);

  if (siblings.length === 0) return '';

  let ctx = '\n=== SIBLING CHAPTER BEATS (for parallel awareness) ===\n';
  ctx += 'Other chapters in this book (being drafted in parallel OR already drafted) cover these beats. Your chapter must ONLY cover its own assigned beats — do NOT overlap with these:\n';

  for (const s of siblings) {
    const marker = s.chapter_number < currentChapterNumber ? '(EARLIER — already happened)' : '(LATER — do not foreshadow in detail)';
    ctx += `\n  Ch ${s.chapter_number} ${marker}: "${s.title || 'Untitled'}" — ${(s.beat_summary || '').slice(0, 200).trim()}`;
  }

  ctx += '\n\nIMPORTANT: If another chapter covers a beat (e.g., "the crash", "meeting the local"), you MUST NOT also write that beat. Stay in your assigned lane.\n===\n';
  return ctx;
}

// ── SYSTEM 2: Anti-Repetition Rules ──────────────────────────────────────

export const ANTI_REPETITION_RULES = `
=== ANTI-REPETITION RULES (MANDATORY) ===

1. METAPHOR UNIQUENESS: Every metaphor, simile, and figurative comparison in this chapter must be ORIGINAL. Check the "Metaphors ALREADY USED" list from previous chapters. If you have already compared silence to a held breath, you cannot use that image again. Find a new way to describe silence.

2. NO RE-EXPLAINING: If a character's motivation, backstory, or emotional wound has been established in a previous chapter, do NOT re-explain it. The reader remembers. Reference it obliquely — a glance, a flinch, a refusal to answer — but do not deliver the same internal monologue twice.

3. NO RECYCLED REALIZATIONS: If a character has already had a realization (e.g., "she couldn't trust anyone"), that realization is DONE. The character now ACTS on it. They don't re-discover the same insight. Their behavior changes — they don't re-narrate the same thought.

4. SCENE OPENINGS MUST VARY: Do not start scenes the same way as previous chapters. If the last chapter opened with a character waking up, this chapter cannot. If the last chapter opened with weather, this cannot. If the last chapter opened with dialogue, this chapter should open differently. Check the previous chapter summary for its opening approach and choose a different one.

5. PHYSICAL CONTINUITY FROM PREVIOUS CHAPTER: The previous chapter's "physical state" (location, time, injuries, items) is your STARTING POINT. Do not teleport characters, heal injuries without explanation, or change time of day without transition.

6. EMOTIONAL CONTINUITY: The previous chapter's "emotional state at end" is this chapter's STARTING emotional state. A character who ended the last chapter in despair does not begin this chapter cheerful without a reason.

7. DO NOT RE-DESCRIBE SETTINGS: If a location has been described in detail in a previous chapter and the characters return to it, do NOT re-describe it at the same length. A brief sensory anchor ("the basement smelled the same — ozone and damp concrete") is sufficient.

8. DIALOGUE MUST NOT REPEAT CONVERSATIONS: If two characters already discussed a topic (e.g., whether to trust the stranger), they do not have the same conversation again. They may REFERENCE it ("We already talked about this.") but they do not re-argue the same points.

9. CHAPTER ENDING VARIETY: Do not end every chapter the same way. If the last chapter ended with a cliffhanger, this one should end differently — a quiet realization, a decision made, a sensory detail that carries weight. Alternate between propulsive endings and contemplative ones.

10. THE MOST IMPORTANT RULE: If you find yourself writing a sentence and it feels like you've written it before in a previous chapter, STOP. Write something different. The reader is paying attention. Repetition is the fastest way to break immersion.
===
`;

// ── SYSTEM 3: Previous Chapter Ending ────────────────────────────────────

export async function getPreviousChapterEnding(projectId, currentChapterNumber) {
  if (currentChapterNumber <= 1) return '';

  const allChapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    200
  );
  const prevChapter = allChapters.find(
    c => c.chapter_number === currentChapterNumber - 1
  );

  if (!prevChapter) return '';

  let content = '';
  try {
    content = await resolveChapterContent(prevChapter);
  } catch (e) {
    console.warn('[COHESION] Could not resolve previous chapter content:', e.message);
    return '';
  }

  if (!content) return '';

  // Get last ~500 words
  const words = content.split(/\s+/);
  const lastWords = words.slice(-500).join(' ');

  return '\n=== PREVIOUS CHAPTER ENDING (last 500 words — continue from here) ===\n' + lastWords + '\n===\n';
}

// ── Utility: Regenerate All Summaries ────────────────────────────────────

export async function regenerateAllSummaries(projectId, onProgress) {
  const chapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    200
  );
  const draftedChapters = chapters
    .filter(c => c.status === 'drafted' || c.status === 'reviewed')
    .sort((a, b) => a.chapter_number - b.chapter_number);

  let count = 0;
  for (const ch of draftedChapters) {
    let content = '';
    try {
      content = await resolveChapterContent(ch);
    } catch (e) {
      console.warn('[COHESION] Could not resolve content for Ch.' + ch.chapter_number);
      continue;
    }
    if (!content) continue;

    onProgress?.(`Generating summary for Chapter ${ch.chapter_number}…`);
    const summary = await generateChapterSummary(content, ch.chapter_number);
    await base44.entities.Chapter.update(ch.id, {
      summary_json: JSON.stringify(summary),
    });
    console.log('[COHESION] Summary generated for Ch.' + ch.chapter_number);
    count++;
  }

  console.log('[COHESION] Regenerated summaries for', count, 'chapters');
  return count;
}

// ── LEDGERSCOPE-1: book-scope narrative ledger persistence ───────────────────
//
// Mirrors the summary_json pattern above exactly: write one JSON blob per chapter
// on the Chapter entity, read the earlier ones back before drafting the next.
//
// PARALLEL-SAFE BY DESIGN. "Draft All" drafts siblings concurrently, so Ch.4 may
// start before Ch.3 has saved its ledger. This reads every EARLIER chapter that
// HAS a ledger and folds them in chapter order. A missing one means the fold sees
// fewer facts, never wrong ones - the ledger only ever ADDS constraints (this
// character is dead, that hand is gone), so a gap degrades to the old behaviour
// instead of fabricating state. Fails safe in the only direction that matters.

export async function saveChapterLedger(chapterId, ledger, chapterNumber) {
  if (!chapterId || !ledger) return false;
  try {
    const { boundLedger, summarizeLedger } = await import('@/lib/narrativeLedger');
    const bounded = boundLedger(ledger);
    await base44.entities.Chapter.update(chapterId, {
      narrative_ledger_json: JSON.stringify(bounded),
    });
    console.log(`[NARRATIVE-LEDGER] Saved Ch.${chapterNumber} ledger: ${summarizeLedger(bounded)}`);
    return true;
  } catch (e) {
    // Never let a telemetry save kill a drafted chapter.
    console.warn(`[NARRATIVE-LEDGER] Could not save Ch.${chapterNumber} ledger: ${e?.message || e}`);
    return false;
  }
}

export async function buildPriorLedger(projectId, currentChapterNumber) {
  if (!projectId || !Number.isFinite(Number(currentChapterNumber))) return null;
  try {
    const { foldChapterLedgers, summarizeLedger } = await import('@/lib/narrativeLedger');
    const allChapters = await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number',
      200
    );
    const earlier = (allChapters || [])
      .filter((c) => Number(c.chapter_number) < Number(currentChapterNumber))
      .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
    if (earlier.length === 0) return null;

    const ledgers = [];
    const missing = [];
    for (const ch of earlier) {
      const raw = ch?.narrative_ledger_json;
      if (!raw) { missing.push(ch.chapter_number); continue; }
      try {
        ledgers.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch (e) {
        missing.push(ch.chapter_number);
      }
    }
    if (missing.length > 0) {
      console.warn(`[NARRATIVE-LEDGER] Ch.${currentChapterNumber}: no saved ledger for chapter(s) ${missing.join(', ')} — continuing with the ${ledgers.length} that exist. State from the missing chapter(s) will not be enforced.`);
    }
    if (ledgers.length === 0) return null;

    const folded = foldChapterLedgers(ledgers);
    console.log(`[NARRATIVE-LEDGER] Ch.${currentChapterNumber}: folded ${ledgers.length} prior chapter ledger(s) → ${summarizeLedger(folded)}`);
    return folded;
  } catch (e) {
    console.warn(`[NARRATIVE-LEDGER] Could not build prior ledger for Ch.${currentChapterNumber}: ${e?.message || e}`);
    return null;
  }
}