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
  onProgress?.('Polish: Scanning stacked -ing clauses…');
  const changes = [];
  // POLISHSAFE-4: this used to delete the -ing clause's descriptive content
  // outright (dropped, not reported via a paragraph-count allowance) — not
  // one of rule 0.2/2's four allowed heals. Flag-only now.
  const stackingFixed = 0;

  // Pattern: <SubjectHead>, <verbing phrase up to 50 chars>, <verb phrase>
  // Anchored to start-of-sentence so we only catch the specific rhythm.
  // Skip short -ing clauses (under 4 words) because those are often just
  // natural participial phrases that don't create the stacking feel.
  const stackRx = /(^|\n|\. +|\! +|\? +|" +)((?:[A-Z][a-z]+(?:'s)?|[A-Z][a-z]+ [a-z]+|[A-Z][a-z]+ [A-Z][a-z]+|The [a-z]+|A [a-z]+|His [a-z]+|Her [a-z]+|Their [a-z]+),)\s+(\w+ing\s+(?:\w+\s+){2,8}?),\s+(\w+ed|\w+s)\b/g;

  const fullText = loaded.map(f => f.content).join('\n\n');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;
  const scaleFactor = totalWords / 50000;
  const globalCap = Math.max(20, Math.round(30 * scaleFactor));

  let totalHits = 0;
  for (const f of loaded) {
    const matches = f.content.match(stackRx) || [];
    totalHits += matches.length;
  }

  console.log('[POLISH] Stacked -ing clauses found:', totalHits, '(cap:', globalCap + ')');

  if (totalHits > globalCap) {
    changes.push('Stacked -ing clauses: ' + totalHits + ' found, ' + globalCap + ' allowed, ' + (totalHits - globalCap) + ' flagged - deletion retired (POLISHSAFE-4)');
  }

  return { stackingFixed, changes };
}