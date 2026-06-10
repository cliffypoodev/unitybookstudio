/**
 * Subject Restoration — targeted repair for legacy polish damage
 *
 * The parallel-sentence polish step had a bug that stripped grammatical
 * subjects from sentences when inserting a transition opener. The bug is
 * fixed in detectAndFixParallelSentences as of this release, but existing
 * manuscripts contain ~200+ damaged sentences that look like this:
 *
 *   "Without thinking, will be high-yield — Kaelen will authorize..."
 *   "Instead, checks a pressure gauge, nods, walks out."
 *   "By then, door closes."
 *
 * The generic AI Proofreader didn't catch these at a meaningful rate —
 * only 1 of 210 was repaired across a full chain run on The Absence.
 * Gemini sees the sentences but doesn't treat them as critical grammar
 * errors given the cap of 3-8 issues per chapter and the "quality over
 * quantity" instruction.
 *
 * This function runs a SURGICAL LLM pass:
 *   - Hunts only for subject-stripped sentences (same detector logic)
 *   - For each, builds a focused prompt with chapter context
 *   - Asks the LLM for a restored sentence — nothing else
 *   - Applies repairs that pass safety checks
 *   - Saves to DB using the standard content-storage helpers
 *
 * Batched per-chapter (5 chapters at a time) for speed. Skips cleanly if
 * no damage is detected in a given chapter.
 */

import { base44 } from '@/api/base44Client';
import { resolveChapterContent, chapterHasContent, prepareChapterContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel } from '@/lib/modelRouting';

// Keep this list in sync with TRANSITION_OPENERS in antiDetectionPolish.js
const OPENERS = [
  'Instead', 'By then', 'Still', 'And yet', 'Even so',
  'Meanwhile', 'Before long', 'Without thinking', 'At last',
  'In truth', 'For a moment', 'This time', 'Not that it mattered',
];

// Words that indicate a valid subject follows the opener — healthy sentence.
// This list is used to distinguish "Meanwhile, he checks..." (valid) from
// "Meanwhile, low hum of..." (subject-stripped damage). Expanded over time
// to reduce false positives:
//   - Numbers/quantifiers for noun-phrase subjects ("two technicians")
//   - "there"/"here" for existential constructions ("there is no polite beep")
//   - "only"/"not" for adverb-first valid fragments ("not with his eyes, but...")
const VALID_NEXT_WORDS = new Set([
  // Pronouns
  'he', 'she', 'they', 'it', 'we', 'you', 'i',
  'his', 'her', 'their', 'its', 'my', 'your', 'our',
  // Determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  // Quantifiers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'some', 'many', 'every', 'no', 'all', 'both', 'several', 'few', 'most',
  'each', 'another', 'other', 'another', 'multiple',
  // Existential / adverbial openers that typically precede a valid subject
  'there', 'here', 'only', 'not', 'nothing', 'someone', 'anyone',
  'everyone', 'nobody', 'something', 'anything', 'everything',
]);

// Subordinating conjunctions — when one of these follows the opener, the
// clause is a valid subordinate clause, not a subject-stripped sentence.
// Example: "At last, when Rooney's marriage failed..."
const SUBORDINATING_CONJUNCTIONS = new Set([
  'when', 'while', 'because', 'if', 'though', 'although', 'since',
  'whereas', 'until', 'unless', 'whenever', 'wherever', 'whether',
  'as', 'before', 'after',
]);

// Prepositions — when one of these starts the tail and the prep phrase ends
// with a comma within the next few words, what follows the comma is likely
// the real subject. Example: "Even so, for countless others, the cost was..."
const PREP_PHRASE_STARTERS = new Set([
  'in', 'on', 'at', 'by', 'for', 'from', 'with', 'without', 'through',
  'during', 'after', 'before', 'against', 'under', 'over', 'between',
  'among', 'across', 'behind', 'beside', 'beyond', 'despite', 'toward',
  'about', 'within',
]);

// To-be and auxiliary verbs — when one of these appears as the SECOND word
// after the opener, the first word IS a valid noun subject.
// Example: "Meanwhile, rape was treated..." / "doctors were not..."
// Trade-off: misses cases like "Instead, contrast was absolute" (originally
// subject-stripped from "Instead, the contrast was absolute"), but those
// read as valid standalone sentences anyway.
const TO_BE_AUX_VERBS = new Set([
  'was', 'were', 'is', 'are', 'am',
  'has', 'had', 'have',
  'will', 'would', 'could', 'should', 'might', 'must', 'shall', 'may',
  "'s", "'re", "'ve", "'d", "'ll",
]);

/**
 * Scan a single chapter for subject-stripped sentences.
 * Returns array of { damaged, charPos, opener } objects.
 *
 * Detector logic:
 *   1. Match the opener + next word via regex (\b boundary after opener).
 *   2. If next word is in VALID_NEXT_WORDS or is a proper noun → healthy, skip.
 *   3. If next word is a subordinating conjunction (when/while/if/etc.) →
 *      legitimate subordinate clause, skip. ("At last, when X happened...")
 *   4. If next word is a preposition AND there's a comma within ~30 chars →
 *      prep phrase + real subject after comma, skip. ("Even so, for countless
 *      others, the cost...")
 *   5. If next word is a common noun but the word AFTER it is a to-be/aux
 *      verb (was/were/is/are/has/had/will/etc.) → the noun IS the subject,
 *      skip. ("Meanwhile, rape was treated...")
 *   6. Otherwise → flag as damaged.
 *
 * Regex note: `\b` AFTER the opener is critical. Without it, "Still"
 * matches the start of "Stillness" (word boundary before, no boundary
 * required after) and "ness" gets captured as the next word — producing
 * a false positive on "Stillness weighs on the air."
 */
function findDamagedSentences(content) {
  const hits = [];
  for (const opener of OPENERS) {
    const openerEsc = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Capture TWO words after the opener so we can run rule 5
    // (noun + to-be verb). The second group is optional in case the opener
    // is end-of-line followed by a single word.
    const rx = new RegExp(
      '\\b' + openerEsc + '\\b[,.]?\\s*(?:—\\s*)?([A-Za-z]+)\\b(?:[\\s,]+([A-Za-z\']+))?',
      'g'
    );
    let m;
    while ((m = rx.exec(content)) !== null) {
      const nextWord = (m[1] || '').toLowerCase();
      const wordAfterNext = (m[2] || '').toLowerCase();
      const isProperNoun = /^[A-Z]/.test(m[1] || '');

      // Rule 2: healthy — valid subject or proper noun follows directly
      if (VALID_NEXT_WORDS.has(nextWord) || isProperNoun) continue;

      // Rule 3: subordinating conjunction = legitimate subordinate clause
      if (SUBORDINATING_CONJUNCTIONS.has(nextWord)) continue;

      // Rule 4: prep phrase starter + comma nearby = prep phrase then real subject
      if (PREP_PHRASE_STARTERS.has(nextWord)) {
        // Look ahead ~30 chars from the match end for a comma
        const lookAheadStart = m.index + m[0].length;
        const lookAhead = content.substring(lookAheadStart, lookAheadStart + 40);
        if (/,/.test(lookAhead)) continue;
      }

      // Rule 5: noun + to-be verb pattern = noun IS the subject
      if (TO_BE_AUX_VERBS.has(wordAfterNext)) continue;

      // Capture the full damaged sentence — up to next sentence boundary.
      const start = m.index;
      let end = content.length;
      const tail = content.substring(start);
      const endMatch = tail.search(/[.!?]["'\u201C\u201D\u2018\u2019]?\s+[A-Z]/);
      if (endMatch >= 0) end = start + endMatch + 1;

      const damaged = content.substring(start, end).trim();
      hits.push({ damaged, charPos: start, opener });
    }
  }
  return hits;
}

/**
 * Build an LLM prompt for repairing all damaged sentences in a chapter.
 * Includes ~600 chars of preceding context per sentence to help the LLM
 * infer the correct subject.
 */
function buildRepairPrompt(content, hits, project) {
  const pov = project?.pov_mode || 'Third person';
  const tense = project?.tense || 'past';

  // Per-sentence context blocks — give the LLM the local neighborhood, not the whole chapter
  const items = hits.map((h, i) => {
    const ctxStart = Math.max(0, h.charPos - 500);
    const context = content.substring(ctxStart, h.charPos).trim();
    return `SENTENCE ${i + 1}:
CONTEXT (text immediately before): "${context.slice(-500)}"
DAMAGED SENTENCE: "${h.damaged}"`;
  }).join('\n\n');

  return `You are repairing a specific mechanical defect in a ${project?.genre || 'thriller'} manuscript. A regex-based polish step had a bug that removed the grammatical SUBJECT from sentences beginning with certain transition phrases. Example of the damage:

BROKEN: "Without thinking, will be high-yield — Kaelen will authorize it."
FIXED:  "Without thinking, it will be high-yield — Kaelen will authorize it."

BROKEN: "Instead, checks a pressure gauge, nods, walks out."
FIXED:  "Instead, he checks a pressure gauge, nods, walks out."

Your job: for each damaged sentence below, return the SAME sentence with the missing subject restored. Use the preceding CONTEXT to determine the correct pronoun (he/she/they/it) or noun phrase.

MANUSCRIPT POV: ${pov}
MANUSCRIPT TENSE: ${tense}

REPAIR RULES:
1. Keep the transition phrase UNCHANGED (Instead, By then, Still, Without thinking, etc.)
2. Insert the subject immediately after the comma, before the verb.
3. Do NOT rewrite the rest of the sentence. Do NOT change punctuation elsewhere. Do NOT fix other issues.
4. If the damaged sentence appears to be a legitimate fragment (not subject-stripped), return the original unchanged.
5. If you genuinely cannot determine the subject from context, return the original unchanged.

${items}

Respond ONLY in JSON. No markdown fences, no commentary:

{"repairs":[{"idx":1,"restored":"<the fixed sentence>"},{"idx":2,"restored":"<...>"}]}`;
}

/**
 * Validate that a proposed repair is safe to apply.
 * Returns true only if:
 *  - restored is non-empty and reasonable length
 *  - restored starts with the same opener as the damaged sentence
 *  - the first word after the opener is a valid subject (pronoun/article/proper noun)
 *  - the LLM didn't pad the sentence with 3x+ length (prevents runaway rewrites)
 */
function isRepairSafe(damaged, restored, opener) {
  if (!restored || typeof restored !== 'string') return false;
  if (restored.length < opener.length + 5) return false;
  if (restored.length > damaged.length * 2.5) return false;

  // Must still start with the opener
  if (!restored.toLowerCase().startsWith(opener.toLowerCase())) return false;

  // The word right after "opener[,]? " must be a valid subject
  const openerEsc = opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(
    '^' + openerEsc + '[,.]?\\s*(?:—\\s*)?([A-Za-z]+)\\b',
    'i'
  );
  const m = restored.match(rx);
  if (!m) return false;
  const nextWord = m[1].toLowerCase();
  const isProperNoun = /^[A-Z]/.test(m[1]);
  if (!VALID_NEXT_WORDS.has(nextWord) && !isProperNoun) return false;

  return true;
}

/**
 * Runs the subject restoration pass across the manuscript.
 *
 * @param {Object} project - NovelProject (for POV/tense/genre context)
 * @param {Array} chapters - Chapter entities (re-fetched fresh from DB)
 * @param {Function} setBusyLabel - Progress reporter
 * @returns {Promise<{
 *   ran: boolean,             // true if any damage was detected
 *   totalDetected: number,    // sentences flagged as damaged
 *   totalRepaired: number,    // repairs that passed safety + applied
 *   totalUnsafe: number,      // LLM returned output that failed safety checks
 *   chaptersSaved: number,
 *   chaptersFailed: number,
 * }>}
 */
export async function runSubjectRestoration(project, chapters, setBusyLabel) {
  const noop = (label) => typeof setBusyLabel === 'function' && setBusyLabel(label);
  console.warn('[SUBJECT-RESTORE] ========== STARTING ==========');

  const bodyChapters = [...chapters]
    .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
    .sort((a, b) => a.chapter_number - b.chapter_number);

  // Phase 1: Load fresh content + scan for damage per chapter
  noop('Subject Restore: Loading chapters and scanning for damage…');
  const work = []; // { chapter, content, hits } per chapter with damage
  let totalDetected = 0;

  for (const ch of bodyChapters) {
    try {
      const freshCh = (await base44.entities.Chapter.filter({ id: ch.id }))?.[0];
      if (!freshCh) continue;
      const content = await resolveChapterContent(freshCh);
      if (!content || content.length < 100) continue;

      const hits = findDamagedSentences(content);
      if (hits.length > 0) {
        work.push({ chapter: freshCh, content, hits });
        totalDetected += hits.length;
        console.warn('[SUBJECT-RESTORE] Ch.' + (freshCh.chapter_number || '?') + ': ' + hits.length + ' damaged');
      }
    } catch (err) {
      console.warn('[SUBJECT-RESTORE] Scan failed Ch.' + (ch.chapter_number || '?') + ':', err.message);
    }
  }

  if (work.length === 0) {
    console.log('[SUBJECT-RESTORE] No damage detected — skipping LLM pass');
    noop('');
    return {
      ran: false, totalDetected: 0, totalRepaired: 0, totalUnsafe: 0,
      chaptersSaved: 0, chaptersFailed: 0,
    };
  }

  console.warn('[SUBJECT-RESTORE] Total: ' + totalDetected + ' damaged sentences across ' + work.length + ' chapters');

  // Phase 2: Batch chapters 5 at a time for concurrent LLM calls
  let totalRepaired = 0;
  let totalUnsafe = 0;
  let chaptersSaved = 0;
  let chaptersFailed = 0;

  // Sequential processing with an inter-call delay. Previous concurrent-batch
  // approach (5 chapters at once) succeeded on batch 1 but all subsequent
  // batches silently failed — most likely a Gemini/OpenRouter rate limit
  // triggered after the first burst. Sequential is slower but reliable:
  // roughly 2-4s per chapter × ~25 chapters = ~60-90 seconds for a full pass.
  const INTER_CALL_DELAY_MS = 400;

  for (let i = 0; i < work.length; i++) {
    const w = work[i];
    const chNum = w.chapter.chapter_number || '?';
    noop('Subject Restore: Ch.' + chNum + ' (' + (i + 1) + '/' + work.length + ') — ' + w.hits.length + ' sentences…');

    let applied = [];
    let unsafe = 0;
    let newContent = w.content;

    try {
      const prompt = buildRepairPrompt(w.content, w.hits, project);
      console.warn('[SUBJECT-RESTORE] Ch.' + chNum + ': calling LLM (' + w.hits.length + ' damaged, prompt ' + prompt.length + ' chars)');

      const response = await invokeLLMWithRetry({
    task_type: 'prose',
        prompt,
        model: pickModel('critique'),
        fallback_model: 'deepseek/deepseek-v3.2-20251201',
        temperature: 0.2,
      });
      let text = typeof response === 'string'
        ? response
        : (response?.text || response?.content || String(response || ''));
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        console.warn('[SUBJECT-RESTORE] Ch.' + chNum + ': JSON parse failed. Text length: ' + text.length + '. First 200 chars: "' + text.substring(0, 200) + '"');
        unsafe = w.hits.length;
        chaptersFailed++;
        // Continue to next chapter — don't abort the whole run
        if (i < work.length - 1) await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
        totalUnsafe += unsafe;
        continue;
      }

      const repairs = Array.isArray(parsed?.repairs) ? parsed.repairs : [];
      console.warn('[SUBJECT-RESTORE] Ch.' + chNum + ': LLM returned ' + repairs.length + ' repair entries');

      for (const r of repairs) {
        const idx = r.idx - 1;
        if (idx < 0 || idx >= w.hits.length) continue;
        const hit = w.hits[idx];
        const restored = (r.restored || '').trim();

        if (!isRepairSafe(hit.damaged, restored, hit.opener)) {
          unsafe++;
          continue;
        }
        if (restored === hit.damaged) continue; // LLM left it alone — respect that

        if (newContent.includes(hit.damaged)) {
          newContent = newContent.replace(hit.damaged, restored);
          applied.push({ from: hit.damaged, to: restored });
        } else {
          unsafe++;
        }
      }

      console.warn('[SUBJECT-RESTORE] Ch.' + chNum + ': applied=' + applied.length + ' unsafe=' + unsafe);
    } catch (err) {
      console.error('[SUBJECT-RESTORE] Ch.' + chNum + ' LLM call failed:', err.message, err.stack);
      unsafe = w.hits.length;
      chaptersFailed++;
      totalUnsafe += unsafe;
      if (i < work.length - 1) await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
      continue;
    }

    totalUnsafe += unsafe;

    // Save chapter if repairs were applied
    if (applied.length > 0 && newContent !== w.content) {
      noop('Subject Restore: Saving Ch.' + chNum + '…');
      try {
        const contentFields = await prepareChapterContent(newContent);
        await runWithNetworkRetry(() =>
          base44.entities.Chapter.update(w.chapter.id, {
            ...contentFields,
            word_count: countWords(newContent),
          })
        );
        totalRepaired += applied.length;
        chaptersSaved++;
        console.warn('[SUBJECT-RESTORE] Ch.' + chNum + ': SAVED ' + applied.length + ' repairs');
      } catch (err) {
        console.error('[SUBJECT-RESTORE] Save failed Ch.' + chNum + ':', err.message);
        chaptersFailed++;
      }
    }

    // Gentle inter-call pacing to avoid rate limits
    if (i < work.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
    }
  }

  noop('');
  console.log(
    '[SUBJECT-RESTORE] COMPLETE: detected=' + totalDetected +
    ' repaired=' + totalRepaired + ' unsafe=' + totalUnsafe +
    ' saved=' + chaptersSaved + ' failed=' + chaptersFailed
  );

  return {
    ran: true,
    totalDetected,
    totalRepaired,
    totalUnsafe,
    chaptersSaved,
    chaptersFailed,
  };
}

/**
 * One-line summary suitable for appending to a Polish toast.
 */
export function formatSubjectRestorationSummary(result) {
  if (!result || !result.ran) return '';
  const parts = ['\nSubject-restoration: ' + result.totalRepaired + '/' + result.totalDetected + ' legacy-damage sentences repaired across ' + result.chaptersSaved + ' chapters.'];
  if (result.totalUnsafe > 0) {
    parts.push(' (' + result.totalUnsafe + ' skipped — LLM output failed safety check or text drifted.)');
  }
  if (result.chaptersFailed > 0) {
    parts.push(' ⚠️ ' + result.chaptersFailed + ' chapters failed to save.');
  }
  return parts.join('');
}