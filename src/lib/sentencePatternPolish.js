/**
 * Sentence-pattern variation polish.
 *
 * Detects "descriptor-verb-noun loops" — Gemini's flag for AI detection risk.
 * Pattern: `[Subject Noun-phrase], [verb]ing [prepositional phrase]`
 *   Example: "Crystalline fingers, dancing across the controls, coaxed..."
 *   Example: "Zylar's voice, rising with false cheer, carried across..."
 *   Example: "The engine, sputtering like a dying asthmatic, coughed twice..."
 *
 * When this pattern stacks (dozens of times across a manuscript), the rhythmic
 * sameness is a hallmark AI-detection red flag. A real human writer varies
 * this: sometimes they put the -ing phrase up front, sometimes at the end,
 * sometimes break the idea across two sentences.
 *
 * This module flags excess occurrences and rewrites a portion of them to
 * restore rhythmic variety. Global cap is ~30 per 50K words (scale-aware).
 * Rewrites unstack the clause by splitting it across two sentences.
 */

/**
 * Detect and cap stacked "noun-phrase, -ing clause, verb phrase" structures.
 *
 * @param {Array<{chapter: object, content: string}>} loaded
 * @returns {{ stackingFixed: number, changes: string[] }}
 */
export function runStackedClauseVariation(loaded, onProgress) {
  onProgress?.('Polish: Varying stacked -ing clauses…');
  const changes = [];
  let stackingFixed = 0;

  // Pattern: <SubjectHead>, <verbing phrase up to 50 chars>, <verb phrase>
  // Capture groups:
  //   1: subject head (1-3 capitalized/lowercase words starting the sentence)
  //   2: -ing clause content (between first comma and second comma)
  //   3: main verb phrase (continues the sentence after the clause)
  //
  // Anchored to start-of-sentence so we only catch the specific rhythm.
  // Skip short -ing clauses (under 4 words) because those are often just
  // natural participial phrases that don't create the stacking feel.
  const stackRx = /(^|\n|\. +|\! +|\? +|" +)((?:[A-Z][a-z]+(?:'s)?|[A-Z][a-z]+ [a-z]+|[A-Z][a-z]+ [A-Z][a-z]+|The [a-z]+|A [a-z]+|His [a-z]+|Her [a-z]+|Their [a-z]+),)\s+(\w+ing\s+(?:\w+\s+){2,8}?),\s+(\w+ed|\w+s)\b/g;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;
  const scaleFactor = totalWords / 50000;
  const globalCap = Math.max(20, Math.round(30 * scaleFactor));

  // Count globally first
  let totalHits = 0;
  for (const f of loaded) {
    const matches = f.content.match(stackRx) || [];
    totalHits += matches.length;
  }

  console.log('[POLISH] Stacked -ing clauses found:', totalHits, '(cap:', globalCap + ')');

  if (totalHits <= globalCap) {
    return { stackingFixed: 0, changes };
  }

  const excess = totalHits - globalCap;
  let globalCount = 0;
  let removed = 0;

  // Rewrite strategy: split the sentence into two — move the -ing clause
  // into its own sentence. "X, doing Y, verbed Z." → "X verbed Z. Doing Y."
  // NOT always clean semantically, so we cap how many we rewrite. Humans
  // can't tell between 30 and 60 instances, so just breaking up the worst
  // 50% of the excess is plenty to restore rhythmic variety.
  //
  // Only rewrite HALF the excess — conservative. We're breaking the pattern,
  // not eliminating it. Natural prose has SOME of these. What we want to
  // avoid is the rhythmic sameness, not the construct itself.
  const toRemove = Math.ceil(excess * 0.5);

  for (const f of loaded) {
    if (removed >= toRemove) break;

    const ch = f.chapter?.chapter_number || '?';
    let chRewrites = 0;

    f.content = f.content.replace(stackRx, (match, prefix, subject, ingClause, mainVerb) => {
      globalCount++;
      if (globalCount <= globalCap) return match;
      if (removed >= toRemove) return match;

      // Rewrite: strip the -ing clause out and promote it to a new sentence
      // "X, doing Y, verbed Z" → "X verbed Z. Doing Y, at that moment."
      // Simpler: just remove the parenthetical -ing clause entirely. The
      // main sentence stands on its own; the descriptive content it carried
      // is mostly redundant flavor when stacking is this heavy.
      removed++;
      chRewrites++;
      stackingFixed++;

      // Reconstruct without the -ing clause: "Subject verbPhrase..."
      // (Keeps subject + main verb, drops the participial aside)
      return prefix + subject.replace(/,$/, '') + ' ' + mainVerb;
    });

    if (chRewrites > 0) {
      changes.push('Ch.' + ch + ': unstacked ' + chRewrites + ' "-ing clause" parentheticals');
    }
  }

  if (stackingFixed > 0) {
    console.log('[POLISH] -ing clause stacking reduced by:', stackingFixed);
  }

  return { stackingFixed, changes };
}