// src/lib/repetitionRewrite.js
import { stripModelControlTokens } from './modelLeakGuard.js';

// Lazy import for LLM
let _callAgent = null;
async function getCallAgent() {
  if (!_callAgent) {
    const mod = await import(/* @vite-ignore */ '@/lib/localLLM');
    _callAgent = mod.callAgent;
  }
  return _callAgent;
}

// Capitalized words that are almost always sentence-opening filler, not facts.
const LEADING_STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'by', 'at', 'for', 'from', 'when', 'while',
  'and', 'but', 'as', 'of', 'to', 'with', 'after', 'before', 'during',
  'through', 'across', 'over', 'under', 'since', 'until', 'because',
  'this', 'that', 'these', 'those', 'his', 'her', 'its', 'our',
  'your', 'my', 'they', 'it', 'he', 'she', 'we', 'i', 'if', 'so', 'yet',
  'then', 'there', 'here', 'what', 'which', 'who', 'whom', 'whose',
  'where', 'how', 'why', 'no', 'not', 'nor', 'though', 'although', 'even'
]);

// Shared opening-normalizer so the detector and global stats agree exactly.
function normalizeOpening(words) {
  return words.join(' ').toLowerCase().replace(/[.,!?;:"'()[\]{}]/g, '');
}

// Extract proper-noun "cores" for the fact guard.
// IMPORTANT: a capitalized word is [A-Z][a-z]... and the run does NOT include
// periods. The previous version allowed '.' inside words, which merged sentence
// boundaries like "Civil War. The" into a fake proper noun that no rewrite could
// preserve — causing the fact guard to reject every rewrite. This version stops
// each run at sentence punctuation.
function coreProperNouns(text) {
  const raw = text.match(/\b[A-Z][a-z][A-Za-z'\u2019-]*(?:\s+[A-Z][a-z][A-Za-z'\u2019-]*)+\b/g) || [];
  const out = new Set();
  for (const phrase of raw) {
    let parts = phrase.split(/\s+/);
    while (parts.length > 1 && LEADING_STOPWORDS.has(parts[0].toLowerCase())) parts.shift();
    if (parts.some(w => !LEADING_STOPWORDS.has(w.toLowerCase()))) {
      out.add(parts.join(' ').toLowerCase());
    }
  }
  return out;
}

// Boundary-safe fact check for ONE paragraph: every multi-word proper-noun core
// and every 4-digit year present in the original must still appear (as a
// substring, so "1970"->"the 1970s" is fine) in the rewrite.
function factsPreserved(original, rewrite) {
  const rl = rewrite.toLowerCase();
  for (const n of coreProperNouns(original)) {
    if (!rl.includes(n)) return false;
  }
  const years = [...new Set(original.match(/\b[12]\d{3}\b/g) || [])];
  for (const y of years) {
    if (!rl.includes(y)) return false;
  }
  return true;
}

// Fiction guard: the rewrite must not INVENT a proper noun (new character/place)
// that wasn't in the original paragraph. Looser than factsPreserved (fiction has
// no facts to lock) but still blocks fabrication of names.
function noInventedProperNouns(original, rewrite) {
  const ol = original.toLowerCase();
  for (const n of coreProperNouns(rewrite)) {
    if (!ol.includes(n)) return false;
  }
  return true;
}

// Cadence tic detector for one paragraph.
function hasCadenceTic(pText) {
  const escalatingMatch = pText.match(/(\b[a-zA-Z]{4,}\b)[^.]{0,40}\bwas\b[^.]{0,40}\1\b/i);
  if (escalatingMatch) {
    const word = escalatingMatch[1].toLowerCase();
    const skipList = ['that', 'this', 'there', 'what', 'when', 'they', 'with', 'from', 'were', 'have', 'been', 'which', 'their', 'about', 'would', 'could', 'should', 'some', 'many', 'much', 'more', 'most'];
    if (!skipList.includes(word)) return true;
  }
  if (((pText.match(/(?:^|[.?!]\s+)And\b/g) || []).length) >= 3) return true;
  // FICTIONFIX-1: "It was" opener and "seemed to" pile-ups read as machine
  // cadence — two or more in one paragraph flags it for the guarded rewrite.
  if (((pText.match(/(?:^|[.?!]\s+|[.?!]["”]\s+)It was\b/g) || []).length) >= 2) return true;
  if (((pText.match(/\bseemed to\b/gi) || []).length) >= 2) return true;
  // FICTIONFIX-2: broken shapes no deterministic repair can fix — route the
  // paragraph to the guarded rewrite. Headless article+adjective sentences
  // ("Yet the different now."), recast echoes ("The chill remained merely
  // chill."), and dropped-subject sentences ("Had forgotten this existed." —
  // code must not guess pronouns; the model sees the whole paragraph).
  if (/(?:^|[.!?]\s+)(?:Yet|But|And|Still)?,?\s*(?:the|a|an)\s+(?:different|same|other|only|rest)\s+(?:now|then|here|there)\s*[.!?]/i.test(pText)) return true;
  if (/\b[Tt]he\s+(\w{3,})\s+(?:was|remained|seemed|stayed)\s+(?:merely|simply|just|plain|only)\s+\1\b/.test(pText)) return true;
  if (/(?:^|[.!?]["”]?\s+)Had(?:n['’]t)?\s+(?:\w+ed|forgotten|known|seen|been|made|taken|given|found|lost|kept|thought|heard|felt|gone|come|become|begun|held|meant|brought|caught|worn|written|told|paid|built|sent|spent|hidden|chosen|broken|spoken|driven|eaten|fallen|risen|grown|thrown|drawn|shown|flown|torn|sworn|understood|done|said|read|left|run|met|led|won|stood|sat|never|always|already|almost)\b/.test(pText)) return true;
  if (/\bwas\b[^.?!]{0,20}\b(real|true|fake|wrong|right)[.?!]\s*(?:And\s+)?[^.?!]{0,20}\bwas\b[^.?!]{0,20}\1\b/i.test(pText)) return true;
  return false;
}

// ── ACTION-BEAT REPETITION (fiction "he turned / he reached / he stepped" crutch) ──
// Movement and gesture verbs that turn into choreography crutches when one exact
// phrase recurs across a whole manuscript. Detection is book-wide; the rewrite
// varies the wording without deleting the action (so motifs like a recurring
// cough survive — they are just phrased differently each time).
const ACTION_BEAT_VERBS = 'turned|nodded|shrugged|sighed|stepped|paused|frowned|smiled|grinned|blinked|swallowed|glanced|stared|looked|reached|grabbed|gasped|flinched|exhaled|inhaled|breathed|coughed|froze|stiffened|trembled|shuddered|winced|crouched|knelt|gripped';
function actionBeatRegex() {
  return new RegExp('\\b(he|she|they|i)\\s+(' + ACTION_BEAT_VERBS + ')(\\s+(?:back|up|down|away|again|around|toward|over|out))?', 'gi');
}
function normalizeBeat(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
function countBeat(text, beat) {
  const re = new RegExp('\\b' + beat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
  return (text.match(re) || []).length;
}

/**
 * Manuscript-wide table of overused action beats. A beat phrase is "overused"
 * when it appears at least `floor` times AND at a rate of at least `ratePer1k`
 * occurrences per 1,000 words across the whole book — so the threshold scales
 * with manuscript length (a 90k novel needs more hits to flag than a 37k one).
 */
export function buildGlobalActionBeatStats(chapterTexts, { ratePer1k = 0.4, floor = 6 } = {}) {
  const counts = new Map();
  let totalWords = 0;
  const re = actionBeatRegex();
  for (const text of (chapterTexts || [])) {
    if (!text || typeof text !== 'string') continue;
    totalWords += (text.match(/\b[\w']+\b/g) || []).length;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const phrase = normalizeBeat(m[0]);
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }
  const minCount = Math.max(floor, Math.round((ratePer1k * totalWords) / 1000));
  const overused = new Set();
  for (const [phrase, c] of counts) {
    if (c >= minCount) overused.add(phrase);
  }
  return { counts, overused, minCount, totalWords };
}

/**
 * Manuscript-wide table of paragraph openings. Any opening used >= threshold
 * times across the whole book is "overused" so cross-chapter repetition is caught.
 */
export function buildGlobalOpeningStats(chapterTexts, threshold = 3) {
  const counts = new Map();
  for (const text of (chapterTexts || [])) {
    if (!text || typeof text !== 'string') continue;
    const paragraphs = text.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
    for (const p of paragraphs) {
      const words = p.trim().split(/\s+/).slice(0, 4);
      if (words.length < 4) continue;
      counts.set(normalizeOpening(words), (counts.get(normalizeOpening(words)) || 0) + 1);
    }
  }
  const overused = new Set();
  for (const [opening, c] of counts) {
    if (c >= threshold) overused.add(opening);
  }
  return { counts, overused };
}

/**
 * Detects repeated openings (within chapter + manuscript-wide), cadence tics,
 * and overused action beats (manuscript-wide). Returns flag lists; used for
 * reporting/logging and to drive the rewrite pass.
 */
export function detectRepetition(chapterText, globalOverused = null, globalActionBeats = null) {
  const flags = { openings: [], cadence: [], actionBeats: [], hasFlags: false };
  if (!chapterText || typeof chapterText !== 'string') return flags;

  const hasGlobal = globalOverused && typeof globalOverused.has === 'function';
  const hasBeats = globalActionBeats && typeof globalActionBeats.has === 'function';
  const paragraphs = chapterText.split(/(?:\r?\n\s*){2,}/).filter(p => p.trim().length > 0);
  const openingMap = new Map();

  for (let i = 0; i < paragraphs.length; i++) {
    const pText = paragraphs[i].trim();
    if (!pText) continue;

    const words = pText.split(/\s+/).slice(0, 4);
    if (words.length >= 4) {
      const opening = normalizeOpening(words);
      const seenInChapter = openingMap.has(opening);
      const overusedGlobally = hasGlobal && globalOverused.has(opening);
      if (!seenInChapter) {
        openingMap.set(opening, i);
        if (overusedGlobally) {
          flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'manuscript' });
          flags.hasFlags = true;
        }
      } else {
        flags.openings.push({ paragraphIndex: i, opening, paragraphText: pText, scope: 'chapter' });
        flags.hasFlags = true;
      }
    }

    if (hasCadenceTic(pText)) {
      flags.cadence.push({ sentence: pText });
      flags.hasFlags = true;
    }

    if (hasBeats) {
      const lower = pText.toLowerCase();
      for (const beat of globalActionBeats) {
        if (lower.includes(beat)) {
          flags.actionBeats.push({ paragraphIndex: i, beat, paragraphText: pText });
          flags.hasFlags = true;
          break; // one flag per paragraph is enough to trigger a rewrite
        }
      }
    }
  }

  return flags;
}

// Blank out quoted spans so witness testimony (handled by the quote ledger)
// never counts as narrative repetition. Curly quotes are directional; straight
// quotes pair up within a paragraph line.
function blankQuotedSpans(text) {
  let out = String(text || '').replace(/“[^”\n]{0,900}”/g, (m) => ' '.repeat(m.length));
  out = out.replace(/"[^"\n]{0,900}"/g, (m) => ' '.repeat(m.length));
  return out;
}

/**
 * Manuscript-wide table of repeated cross-chapter narrative phrases.
 * A phrase is flagged when the SAME literal run of `size` words (lowercased)
 * appears in at least `minChapters` different chapters, outside quotation
 * marks. Overlapping windows of one longer repeat collapse to their first
 * window. Ranked by chapter spread then count, capped at `cap` so the
 * downstream per-paragraph rewrite stays bounded.
 */
export function buildCrossChapterPhraseStats(chapterTexts, { size = 8, minChapters = 2, cap = 48 } = {}) {
  const seen = new Map(); // phrase -> { chapters:Set<number>, count, firstChapter, firstIdx }
  const texts = (chapterTexts || []).map((t) => blankQuotedSpans(String(t || '').toLowerCase()));

  for (let c = 0; c < texts.length; c++) {
    const text = texts[c];
    const tokens = [];
    const re = /[a-z0-9][a-z0-9’'-]*/g;
    let m;
    while ((m = re.exec(text)) !== null) tokens.push({ w: m[0], start: m.index, end: m.index + m[0].length });
    for (let i = 0; i + size <= tokens.length; i++) {
      const phrase = text.slice(tokens[i].start, tokens[i + size - 1].end);
      if (phrase.includes('\n')) continue;                 // stay within a paragraph
      let rec = seen.get(phrase);
      if (!rec) { rec = { chapters: new Set(), count: 0, firstChapter: c, firstIdx: tokens[i].start }; seen.set(phrase, rec); }
      rec.chapters.add(c);
      rec.count++;
    }
  }

  // candidates repeated across chapters
  const candidates = [];
  for (const [phrase, rec] of seen) {
    if (rec.chapters.size >= minChapters) candidates.push({ phrase, spread: rec.chapters.size, count: rec.count, firstChapter: rec.firstChapter, firstIdx: rec.firstIdx });
  }
  // collapse overlapping windows of the same repeat: sort by first occurrence
  // position; drop a candidate whose first occurrence overlaps the previous
  // kept candidate's window in the same chapter.
  candidates.sort((a, b) => a.firstChapter - b.firstChapter || a.firstIdx - b.firstIdx);
  const kept = [];
  let lastCh = -1; let lastEnd = -1;
  for (const cand of candidates) {
    const start = cand.firstIdx;
    const end = start + cand.phrase.length;
    if (cand.firstChapter === lastCh && start < lastEnd) { lastEnd = Math.max(lastEnd, end); continue; }
    kept.push(cand);
    lastCh = cand.firstChapter; lastEnd = end;
  }
  kept.sort((a, b) => b.spread - a.spread || b.count - a.count);
  const overused = new Set(kept.slice(0, cap).map((k) => k.phrase));
  return { overused, familiesFound: kept.length, candidates: kept };
}

/**
 * Rewrites repeated spots ONE PARAGRAPH AT A TIME.
 *
 * The model only ever sees a single repeated paragraph and returns a single
 * rewritten paragraph. The chapter is reassembled in code by swapping that exact
 * paragraph in place. This eliminates the previous failure mode where the model
 * was asked to echo back a whole 4,000-word chapter and returned a truncated one
 * (which the length guard then correctly rejected, producing zero changes).
 *
 * mode: 'nonfiction' uses the fact-preserving prompt + fact guard (unchanged).
 *       'fiction' uses a prose-variety prompt that also breaks overused action
 *       beats, guarded so it cannot invent characters/places.
 *
 * @param {Object} args
 * @param {string} args.chapterText
 * @param {Object} args.chapter
 * @param {Object} args.project
 * @param {Function|null} args.callLLM
 * @param {Set<string>|null} args.globalOverused
 * @param {Set<string>|null} args.globalActionBeats
 * @param {string} args.mode               - 'fiction' | 'nonfiction'
 * @param {number} args.maxRewrites        - cap per chapter (runtime guard)
 */
export async function rewriteFlaggedSpots({ chapterText, chapter, project, callLLM = null, globalOverused = null, globalActionBeats = null, mode = 'fiction', maxRewrites = 14 }) {
  if (!chapterText || typeof chapterText !== 'string') {
    return { ok: true, changed: false, text: chapterText, flags: { openings: [], cadence: [], actionBeats: [], hasFlags: false }, stats: { rewritten: 0, attempted: 0, skipped: 0 } };
  }

  const detection = detectRepetition(chapterText, globalOverused, globalActionBeats);
  if (!detection.hasFlags) {
    return { ok: true, changed: false, text: chapterText, flags: detection, stats: { rewritten: 0, attempted: 0, skipped: 0 } };
  }

  // Split into paragraphs AND separators so we can rejoin with exact whitespace.
  const segments = chapterText.split(/(\n{2,})/);
  const hasGlobal = globalOverused && typeof globalOverused.has === 'function';
  const hasBeats = globalActionBeats && typeof globalActionBeats.has === 'function';
  const isNonfiction = mode === 'nonfiction';
  const seenOpenings = new Set();

  // Resolve the LLM caller (small, focused, single-paragraph call).
  let _callFn = callLLM;
  if (!_callFn) {
    const agent = await getCallAgent();
    _callFn = (p, sp) => agent({
      prompt: p,
      taskType: 'polish',
      project,
      temperature: 0.4,
      maxTokens: 1200,
      systemPromptOverride: sp
    });
  }

  const nonfictionSystemPrompt = `You are a line editor reducing repetition in investigative nonfiction. You will receive ONE paragraph. Rewrite it so it does NOT begin with the same opening words it currently has, and so any repetitive sentence rhythm is broken. Keep the same length, meaning, and tone. CRITICAL: change ZERO facts — preserve every name, date, place, number, and document title EXACTLY as written. Do not add or remove information. Return ONLY the rewritten paragraph — no preamble, no labels, no commentary.`;

  const fictionSystemPrompt = `You are a line editor improving a novel's prose. You will receive ONE paragraph. Rewrite it to remove mechanical repetition: do not begin with the same opening words, break any monotonous sentence rhythm, and vary any overused physical action beats (for example "he turned", "he reached", "he stepped", "he looked up"). Keep the SAME events, meaning, tone, narrative voice, and sensory/bodily detail, and roughly the same length. Convey the same actions with fresh, varied wording — do NOT delete an action, and do NOT add new characters, events, dialogue, places, or facts. Return ONLY the rewritten paragraph — no preamble, no labels, no commentary.`;

  const systemPrompt = isNonfiction ? nonfictionSystemPrompt : fictionSystemPrompt;

  // Call the model on a small chunk and clean its output. Used for both whole small
  // paragraphs and individual sentences inside oversized blocks.
  async function callAndClean(textIn) {
    let rw = '';
    try {
      rw = await _callFn('PARAGRAPH:\n' + textIn, systemPrompt);
    } catch (err) {
      return '';
    }
    if (typeof rw !== 'string') rw = rw?.text || rw?.content || String(rw || '');
    rw = rw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    rw = stripModelControlTokens(rw).text;
    if (!rw) return '';

    rw = rw.split('\n').filter(line => {
      const l = line.trim().toLowerCase();
      return !(l.startsWith('here is') || l.startsWith('here are') || l.startsWith('rewritten') || l.startsWith('sure,') || l.startsWith('certainly') || l.startsWith('paragraph:'));
    }).join('\n').trim();
    // FICTIONFIX-1: LLM splices must be case-clean. A rewrite that begins
    // lowercase is capitalized; one that contains a fresh mid-text lowercase
    // sentence start is rejected (returns '' → caller skips, original kept).
    if (/^[a-z]/.test(rw)) rw = rw.charAt(0).toUpperCase() + rw.slice(1);
    if (/(?<!\.\.)[.!?]\s+[a-z]/.test(rw)) return '';
    return rw;
  }

  // Largest paragraph we send to the model whole. Bigger blocks (e.g. a chapter written
  // as one block) are rewritten sentence-by-sentence so the local model never receives a
  // chunk big enough to truncate — the failure that silently dropped half-chapters.
  const MAX_WHOLE_PARA_WORDS = 120;

  let rewritten = 0;
  let attempted = 0;
  let skipped = 0;

  for (let i = 0; i < segments.length; i += 2) {
    if (attempted >= maxRewrites) break;
    const seg = segments[i];
    if (!seg || !seg.trim()) continue;
    const trimmed = seg.trim();

    // Flag status for this paragraph.
    const words = trimmed.split(/\s+/).slice(0, 4);
    let flaggedOpening = false;
    let opening = null;
    if (words.length >= 4) {
      opening = normalizeOpening(words);
      const seen = seenOpenings.has(opening);
      const overused = hasGlobal && globalOverused.has(opening);
      if (seen || overused) flaggedOpening = true;
      seenOpenings.add(opening);
    }
    const flaggedCadence = hasCadenceTic(trimmed);

    // Action-beat flag (fiction): does this paragraph contain an overused beat?
    let flaggedBeat = false;
    const beatsHere = [];
    if (hasBeats) {
      const lower = trimmed.toLowerCase();
      for (const beat of globalActionBeats) {
        if (lower.includes(beat)) { flaggedBeat = true; beatsHere.push(beat); }
      }
    }

    if (!flaggedOpening && !flaggedCadence && !flaggedBeat) continue;

    const segWordCount = trimmed.split(/\s+/).length;

    // ── LARGE BLOCK: rewrite only the offending sentences, one at a time ──
    if (segWordCount > MAX_WHOLE_PARA_WORDS) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [trimmed];
      let segChanged = false;
      for (let s = 0; s < sentences.length; s++) {
        if (attempted >= maxRewrites) break;
        const sent = sentences[s];
        const sentTrim = sent.trim();
        if (sentTrim.split(/\s+/).length < 4) continue;
        const lowerSent = sentTrim.toLowerCase();
        const beatsInSent = beatsHere.filter(b => lowerSent.includes(b));
        // In big blocks the scattered problem is overused beats; rewrite those sentences only.
        if (!beatsInSent.length) continue;
        attempted++;
        const rwSent = await callAndClean(sentTrim);
        if (!rwSent) { skipped++; continue; }
        // Sentence-level length sanity: reject truncation/runaway.
        if (rwSent.length < sentTrim.length * 0.6 || rwSent.length > sentTrim.length * 1.8) { skipped++; continue; }
        if (isNonfiction) {
          if (!factsPreserved(sentTrim, rwSent)) { skipped++; continue; }
        } else {
          if (!noInventedProperNouns(sentTrim, rwSent)) { skipped++; continue; }
        }
        // Require the overused beat to actually drop in this sentence.
        let reduced = false;
        for (const beat of beatsInSent) {
          if (countBeat(rwSent, beat) < countBeat(sentTrim, beat)) { reduced = true; break; }
        }
        if (!reduced) { skipped++; continue; }
        const sLead = sent.match(/^\s*/)[0];
        const sTrail = sent.match(/\s*$/)[0];
        sentences[s] = sLead + rwSent + sTrail;
        rewritten++;
        segChanged = true;
      }
      if (segChanged) {
        const lead = seg.match(/^\s*/)[0];
        const trail = seg.match(/\s*$/)[0];
        segments[i] = lead + sentences.join('') + trail;
      }
      continue;
    }

    // ── NORMAL PARAGRAPH: rewrite the whole thing (original behavior) ──
    attempted++;
    const rw = await callAndClean(trimmed);
    if (!rw) { skipped++; continue; }
    // Per-paragraph length sanity (catch truncation/runaway).
    if (rw.length < trimmed.length * 0.5 || rw.length > trimmed.length * 2.2) { skipped++; continue; }
    if (isNonfiction) {
      if (!factsPreserved(trimmed, rw)) { skipped++; continue; }
    } else {
      if (!noInventedProperNouns(trimmed, rw)) { skipped++; continue; }
    }
    const newWords = rw.split(/\s+/).slice(0, 4);
    const newOpening = newWords.length >= 4 ? normalizeOpening(newWords) : null;
    if (flaggedOpening && !flaggedCadence && !flaggedBeat && newOpening === opening) { skipped++; continue; }
    if (flaggedBeat && !flaggedOpening && !flaggedCadence) {
      let reduced = false;
      for (const beat of beatsHere) {
        if (countBeat(rw, beat) < countBeat(trimmed, beat)) { reduced = true; break; }
      }
      if (!reduced) { skipped++; continue; }
    }
    const lead = seg.match(/^\s*/)[0];
    const trail = seg.match(/\s*$/)[0];
    segments[i] = lead + rw + trail;
    if (newOpening) seenOpenings.add(newOpening);
    rewritten++;
  }

  return {
    ok: true,
    changed: rewritten > 0,
    text: segments.join(''),
    flags: detection,
    stats: { rewritten, attempted, skipped }
  };
}
