// NFGUARD-1 (POLISHFIX-8): content-equivalence check for the nonfiction polish
// path. Two texts are "polish-equivalent" when they differ only by quote glyphs
// (straight vs curly), whitespace, and collapsed runs of identical punctuation
// (",," → ","; " ," → ","). Everything else — a deleted appositive comma, a
// swapped word, a merged or rewritten sentence — is a CONTENT change. Three
// deterministic rewrite passes each independently damaged real nonfiction prose
// (POLISHFIX-7 and the run after it); on nonfiction, polish may fix typography
// and nothing else, and this predicate is what enforces it.
export function nfPolishNormalize(text) {
  return String(text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([,.;:!?])\1+/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nfContentEquivalent(before, after) {
  return nfPolishNormalize(before) === nfPolishNormalize(after);
}

// DRAFTGATE-2: deterministic dropped-word sentence strip. "Article + preposition
// + the" ("a to the", "an of the") is never valid prose — it is a model-dropped
// noun. LLM repair does not converge on it (the model re-drops the banned word
// every regeneration), so after repairs exhaust, the broken sentence is removed
// entirely. Blank beats broken; nothing is invented. Splits on sentence
// boundaries, preserves paragraph breaks, and returns what was removed so every
// call site can log loudly.
// DRAFTGATE-3B: widened dropped-word object net
// DRAFTGATE-3G: + bare-noun objects ("a to industrial might" — measured in a
// shipped export). a/an + preposition + word is never valid English; the space
// requirement excludes hyphenated compounds ("a to-do list"), and "at" stays
// det-only so "an at sign" never flags.
export const DROPPED_WORD_RX = /\b(?:a|an)\s+(?:(?:to|of|in|on|for|with|from|by|at)\s+(?:the|its|this|that|their|his|her|these|those|a|an)\b|(?:to|of|in|on|for|with|from|by)\s+(?=[a-z]))/i;

// DRAFTGATE-3H: model-mangle shapes that are broken beyond repair.
// (a) aux BE + past-tense intransitive that never takes a passive
//     ("bodies were remained embedded").
// (b) adjective censor-hole: a/an + noun-less adjective + preposition + object
//     ("served as a grim to the proximity") — the PROSEGATE lexicon, in regex form.
export const MANGLE_RX = /\b(?:was|were|is|are|be|been|being)\s+(?:remained|existed|persisted|lingered|elapsed|occurred|happened)\b|\b(?:a|an)\s+(?:silent|lasting|direct|grim|stark|solemn|enduring|poignant|somber|tangible)\s+(?:to|of|in|on|for|with|from|by|at)\s+(?:the|its|this|that|their|his|her|these|those|a|an)\b/i;
// DRAFTGATE-3H-FIXUP: two decidable stump shapes — a unit that ENDS with "v."
// (paragraph-final truncation), and a fused unit where "v." is followed by a
// sentence-starter function word ("Dorr v. The story of…") — real defendants
// are proper nouns (United States, Commonwealth), never articles/pronouns.
export const CITATION_STUMP_RX = /\bv\.$|\bv\.\s+(?:The|A|An|It|This|That|But|And|However|Yet)\s/;
export function stripMangledSentences(text) {
  const removed = [];
  const paragraphs = String(text || '').split(/(\n{2,})/);
  for (let pi = 0; pi < paragraphs.length; pi += 2) {
    const para = paragraphs[pi];
    if (!para || !para.trim()) continue;
    // DRAFTGATE-3H-FIXUP: protect legal "v." from the lightweight split so a
    // valid case name stays ONE unit (mirrors the DRAFTGATE-3F tokenizer rule).
    // Without this, "Dorr, trustee, v. United States…" split at "v." and the
    // stump rule beheaded the valid sentence — measured in sandbox before any
    // polish ran on this build.
    const PROT_V = String.fromCharCode(1);
    const work = para.replace(/\bv\.(?=\s)/g, 'v' + PROT_V);
    const sentences = work.split(/(?<=[.!?…”])\s+/).map((s) => s.split(PROT_V).join('.'));
    const kept = sentences.filter((s) => {
      const trimmed = s.trim();
      if (MANGLE_RX.test(trimmed) || CITATION_STUMP_RX.test(trimmed)) {
        removed.push(trimmed.slice(0, 90));
        return false;
      }
      return true;
    });
    if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
  }
  return { text: paragraphs.join(''), removed };
}

export function stripDroppedWordSentences(text) {
  const removed = [];
  const paragraphs = String(text || '').split(/(\n{2,})/);
  for (let pi = 0; pi < paragraphs.length; pi += 2) {
    const para = paragraphs[pi];
    if (!para || !para.trim()) continue;
    const sentences = para.split(/(?<=[.!?…”])\s+/);
    const kept = sentences.filter((s) => {
      if (DROPPED_WORD_RX.test(s)) { removed.push(s.trim().slice(0, 90)); return false; }
      return true;
    });
    if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
  }
  return { text: paragraphs.join(''), removed };
}

// DRAFTGATE-3C: a/an agreement — the one grammar fix that is provably safe to
// automate. Sound-based with the standard closed exception lexicon; anything
// ambiguous is left alone. Measured live: "a effort", "a enduring" shipped.
const AN_BEFORE = /^(?:[aeio]|u(?![a-z])|un(?!i)|honest|honor|hour|heir|herb\b|umbrella|uncle|urgent|ultimate)/i;
const A_BEFORE = /^(?:uni|use|user|usual|utility|utop|euro|eu|ewe|one\b|once\b|u[a-z]?-)/i;
export function fixIndefiniteArticles(text) {
  let fixed = 0;
  const out = String(text || '').replace(/\b(a|an|A|An)\s+([A-Za-z][a-z-]*)\b/g, (m, art, word) => {
    // GRAMMARREPAIR-2: capitalized words are judged only when they start with a
    // vowel LETTER ("an European" → "a European", "a Earl" → "an Earl");
    // consonant-initial proper nouns ("an Xylos", "an F-14") are left alone —
    // their sound is not knowable from spelling.
    if (/^[A-Z]/.test(word) && !/^[AEIOU]/.test(word)) return m;
    const wantsAn = A_BEFORE.test(word) ? false : AN_BEFORE.test(word);
    const isAn = art.toLowerCase() === 'an';
    if (wantsAn === isAn) return m;
    if (!wantsAn && (A_BEFORE.test(word) || !/^[aeiou]/i.test(word))) {
      // "an" before a consonant-SOUND word — "an unicorn", "an European",
      // "an banana" — always wrong. (GRAMMARREPAIR-2: the A_BEFORE branch used
      // to fall through unrepaired.)
      fixed++;
      return (art[0] === 'A' ? 'A' : 'a') + ' ' + word;
    }
    if (wantsAn) { fixed++; return (art[0] === 'A' ? 'An' : 'an') + ' ' + word; }
    return m;
  });
  return { text: out, fixed };
}

// BOOKGATE-3: exact 12+-word sentences appearing in MORE THAN ONE chapter are
// duplicated text, not echoes. Keep the first chapter's copy; strip the rest.
// Measured live: 15 such sentences shipped in one export — an entire rescue
// passage re-appeared one chapter later.
export function stripCrossChapterDuplicates(chapterTexts) {
  const seen = new Map(); // normalized sentence -> first chapter index
  const removedPerChapter = chapterTexts.map(() => []);
  const out = chapterTexts.map((text, ci) => {
    const paragraphs = String(text || '').split(/(\n{2,})/);
    for (let pi = 0; pi < paragraphs.length; pi += 2) {
      const para = paragraphs[pi];
      if (!para || !para.trim()) continue;
      const sentences = para.split(/(?<=[.!?…”])\s+/);
      const kept = sentences.filter((s) => {
        const norm = s.replace(/\s+/g, ' ').trim();
        if (norm.split(' ').length < 12) return true;
        const firstCi = seen.get(norm);
        if (firstCi === undefined) { seen.set(norm, ci); return true; }
        if (firstCi === ci) return true;
        removedPerChapter[ci].push(norm.slice(0, 90));
        return false;
      });
      if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
    }
    return paragraphs.join('');
  });
  return { texts: out, removedPerChapter };
}

// ── ARCH-1C: closed-world fact ledger (clock times + figure fates) ──
// The Molasses arc proved one defect class survives every other gate:
// predicate truth about researched people ("X died" / "X was rescued") and
// clock times ("12:07", "12:30 p.m.") that the evidence never states. The
// proper-noun/date/number closed-world check cannot see either: fate verbs are
// lowercase common words, and normalization strips the colon out of clock
// times before membership testing. This ledger closes both holes with the
// same principle: the fact is in the evidence or it does not ship.
const FATE_CLASSES = [
  { key: 'death', rx: /\b(?:died|dead|death|perished|drowned|killed|fatal(?:ly)?|succumbed|victims?|assassinat(?:ed|ion)|lynch(?:ed|ing|ings)?|murder(?:ed|s)?|slain|hanged)\b/i },
  { key: 'survival', rx: /\b(?:survived|survivor|rescued|saved|escaped?|unharmed|uninjured)\b/i },
  { key: 'injury', rx: /\b(?:injured|injur(?:y|ies)|wounded|maimed|hospitalized)\b/i },
];
// "the one hundred fifty injured", "hundreds died", "21 killed": a fate word
// quantified by a number is a casualty STATISTIC (the number gate's business),
// not an individual fate predicate. Measured FP on the shipped clean book:
// a victim's name in the same list as an aggregate injured-count flagged as
// (name, injury). Number-quantified occurrences are exempt.
const FATE_COUNT_RX = /^(?:\d+[,.\d]*|hundred(?:s)?|thousand(?:s)?|dozen(?:s)?|million(?:s)?|score(?:s)?|many|several|countless|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/i;
const FATE_TITLE_RX = /^(?:major general|brigadier general|general|colonel|major|captain|lieutenant|reverend|president|governor|mr|mrs|ms|dr|aunt|uncle)\s+/i;

// TEMPORAL-1: parse a research timeline/key_events date string into
// { y, m, d, precision }, at whatever precision it actually has —
// "June 19, 1865" (day), "March 1919" (month), "1915" (year). Unparseable
// strings return null (the event is not a checkable ledger entry).
const MONTHS_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseLedgerDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{3,4})$/);
  if (m) {
    const mo = MONTHS_MAP[m[1].toLowerCase()];
    if (mo) return { y: Number(m[3]), m: mo, d: Number(m[2]), precision: 'day' };
  }
  m = s.match(/^([A-Za-z]+)\s+(\d{3,4})$/);
  if (m) {
    const mo = MONTHS_MAP[m[1].toLowerCase()];
    if (mo) return { y: Number(m[2]), m: mo, d: null, precision: 'month' };
  }
  m = s.match(/^(\d{3,4})$/);
  if (m) return { y: Number(m[1]), m: null, d: null, precision: 'year' };
  return null;
}

export function buildFactLedger(project) {
  const empty = { ok: false, clockTimes: [], figures: [], events: [] };
  try {
    if (!project) return empty;
    const rawEvidence = [project.research_data, project.research_md, project.seed_concept]
      .filter(Boolean).map(String).join('\n');
    if (rawEvidence.trim().length < 200) return empty;

    // Clock times present in evidence, normalized to H:MM (no leading zero on the hour).
    const clockTimes = [];
    const seenClock = new Set();
    const CLOCK_RX = /\b(\d{1,2})[:.](\d{2})\b/g;
    let cm;
    while ((cm = CLOCK_RX.exec(rawEvidence)) !== null) {
      const h = parseInt(cm[1], 10);
      const mnt = cm[2];
      if (h < 1 || h > 23 || parseInt(mnt, 10) > 59) continue;
      const norm = `${h}:${mnt}`;
      if (!seenClock.has(norm)) { seenClock.add(norm); clockTimes.push(norm); }
    }

    // Figures from research_data.key_figures, with per-class evidence attestation.
    // ATTESTATION IS ENTRY-SCOPED, NEVER WINDOW-SCOPED: a flat proximity window
    // over concatenated evidence lets adjacent entries cross-contaminate (proven
    // in sandbox — a figure whose entry says only "trapped" inherited "death
    // attested" from the NEXT figure's entry ~200 chars away, which would have
    // silently passed the exact defect this ledger exists to catch). A class is
    // attested when (1) the figure's OWN key_figures entry contains a class word,
    // or (2) any single SENTENCE elsewhere in the evidence contains both the
    // surname and a class word. Verbatim quotes in prose auto-pass downstream
    // because a quote is a substring of the evidence by definition.
    const figures = [];
    let rd = project.research_data;
    if (typeof rd === 'string') { try { rd = JSON.parse(rd); } catch { rd = null; } }
    const kf = rd && Array.isArray(rd.key_figures) ? rd.key_figures : [];

    // Sentence corpus from everything EXCEPT key_figures entries: other
    // research_data sections' string values, plus research_md and seed_concept.
    const sentencePool = [];
    const collectStrings = (node) => {
      if (typeof node === 'string') { sentencePool.push(node); return; }
      if (Array.isArray(node)) { node.forEach(collectStrings); return; }
      if (node && typeof node === 'object') Object.values(node).forEach(collectStrings);
    };
    if (rd && typeof rd === 'object') {
      for (const [k, v] of Object.entries(rd)) { if (k !== 'key_figures') collectStrings(v); }
    }
    if (project.research_md) sentencePool.push(String(project.research_md));
    if (project.seed_concept) sentencePool.push(String(project.seed_concept));
    const evSentences = sentencePool
      .flatMap((t) => t.split(/(?<=[.!?…”])\s+/))
      .map((s) => s.toLowerCase());

    for (const fig of kf) {
      const rawName = String(fig?.name || '').trim();
      if (!rawName) continue;
      const stripped = rawName.replace(FATE_TITLE_RX, '').trim();
      const toks = stripped.split(/\s+/).filter(Boolean);
      const surname = toks.length ? toks[toks.length - 1].replace(/[^A-Za-z'-]/g, '') : '';
      if (surname.length < 3) continue;
      // Common-noun surname filter: key_figures can hold institutions ("United
      // States Industrial Alcohol" → last token "Alcohol"), and a last token the
      // evidence itself uses as an ordinary lowercase word would pair with fate
      // words in valid prose ("the alcohol that killed…"). If the evidence uses
      // the token lowercase-initial anywhere OUTSIDE a URL, it is not a
      // checkable surname. URLs are excluded because source slugs lowercase real
      // names ("…/hugh-ogden-issues-report…" — measured on live research_data,
      // where the unstripped test silently dropped a researched person).
      const lowerForm = new RegExp('\\b' + surname[0].toLowerCase() + surname.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (lowerForm.test(rawEvidence.replace(/https?:\/\/\S+/g, ' '))) continue;
      const attested = {};
      const ownEntry = (() => { try { return JSON.stringify(fig); } catch { return String(fig?.documented_actions || ''); } })();
      const surnameRx = new RegExp('\\b' + surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      for (const cls of FATE_CLASSES) {
        attested[cls.key] = cls.rx.test(ownEntry) ||
          evSentences.some((sent) => surnameRx.test(sent) && cls.rx.test(sent));
      }
      figures.push({ name: rawName, stripped, surname, attested });
    }

    // TEMPORAL-1: timeline ∪ key_events, keeping only entries with a
    // parseable date. `norm` uses the same normalization as substring
    // matching against prose elsewhere in this codebase's closed-world checks.
    const events = [];
    if (rd && typeof rd === 'object') {
      const timeline = Array.isArray(rd.timeline) ? rd.timeline : [];
      const keyEvents = Array.isArray(rd.key_events) ? rd.key_events : [];
      for (const e of [...timeline, ...keyEvents]) {
        const name = String(e?.event || '').trim();
        if (!name) continue;
        const date = parseLedgerDate(e?.date);
        if (!date) continue;
        const norm = name.toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!norm) continue;
        events.push({ name, date, norm });
      }
    }

    return { ok: true, clockTimes, figures, events };
  } catch (e) {
    console.warn('[FACT-LEDGER] ledger build failed — clock/fate closed-world NOT enforced this pass:', e?.message);
    return empty;
  }
}

// Sentence split with the DRAFTGATE-3H-FIXUP v-dot protection, shared by both checkers.
function splitLedgerSentences(para) {
  const PROT_V = String.fromCharCode(1);
  const work = para.replace(/\bv\.(?=\s)/g, 'v' + PROT_V);
  return work.split(/(?<=[.!?…”])\s+/).map((s) => s.split(PROT_V).join('.'));
}

export function checkClockTimeViolations(text, ledger) {
  if (!ledger || !ledger.ok) return [];
  const out = [];
  const allowed = new Set(ledger.clockTimes);
  const paragraphs = String(text || '').split(/\n{2,}/);
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    for (const s of splitLedgerSentences(para)) {
      const CLOCK_RX = /\b(\d{1,2}):(\d{2})\b/g;
      let m;
      while ((m = CLOCK_RX.exec(s)) !== null) {
        const h = parseInt(m[1], 10);
        if (h < 1 || h > 23 || parseInt(m[2], 10) > 59) continue;
        if (!allowed.has(`${h}:${m[2]}`)) {
          out.push({ type: 'clock-time', atom: `${m[1]}:${m[2]}`, snippet: s.trim() });
          break;
        }
      }
    }
  }
  return out;
}

// A fate claim pairs a researched surname with a fate-class word within 7 words
// in the same sentence. The pair must be evidence-attested for that class or the
// sentence flags. Distance bound is the precision knob: subject-verb fate
// assertions sit within a few words; aggregate statements ("the death toll…")
// sit further from the name they share a sentence with. The check is
// polarity-agnostic on purpose: "unable to escape" asserts a fate exactly as
// "escaped" does, and either needs evidence.
// SURNAME COLLISIONS (proven in sandbox — two researched family members, one
// death-attested and one not, flagged each other's VALID claims): figures are
// grouped by surname. A sentence containing a figure's FULL name resolves to
// that figure's own attestation; a surname-only mention resolves to the union
// of the group's attestation. Union errs permissive — an un-attested claim
// about one family member can ride a sibling's attestation — but the
// alternative flags valid attested prose, and false positives on valid prose
// are what the EVIDENCE-2 lesson forbids.
export function checkFateViolations(text, ledger) {
  if (!ledger || !ledger.ok || !ledger.figures.length) return [];
  const groups = new Map();
  for (const fig of ledger.figures) {
    let g = groups.get(fig.surname);
    if (!g) { g = { surname: fig.surname, figs: [], merged: {} }; groups.set(fig.surname, g); }
    g.figs.push(fig);
    for (const cls of FATE_CLASSES) g.merged[cls.key] = g.merged[cls.key] || fig.attested[cls.key];
  }
  const out = [];
  const paragraphs = String(text || '').split(/\n{2,}/);
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    for (const s of splitLedgerSentences(para)) {
      const words = s.split(/\s+/);
      let flagged = false;
      for (const g of groups.values()) {
        if (flagged) break;
        const nameIdx = [];
        words.forEach((w, i) => {
          const clean = w.replace(/[^A-Za-z'-]/g, '');
          if (clean !== g.surname && clean !== g.surname + 's') return;
          // A sentence-initial surname-homograph followed by a comma is the
          // adverbial/vocative pattern ("Still, thousands…"), not a name use.
          if (i === 0 && /,$/.test(w)) return;
          nameIdx.push(i);
        });
        if (!nameIdx.length) continue;
        const fullMatches = g.figs.filter((f) => f.stripped && s.includes(f.stripped));
        const attested = {};
        if (fullMatches.length) {
          for (const cls of FATE_CLASSES) attested[cls.key] = fullMatches.some((f) => f.attested[cls.key]);
        } else {
          Object.assign(attested, g.merged);
        }
        for (const cls of FATE_CLASSES) {
          if (flagged) break;
          if (attested[cls.key]) continue;
          for (let i = 0; i < words.length && !flagged; i++) {
            if (!cls.rx.test(words[i])) continue;
            const prev1 = (words[i - 1] || '').replace(/[^A-Za-z0-9,.]/g, '');
            const prev2 = (words[i - 2] || '').replace(/[^A-Za-z0-9,.]/g, '');
            if (FATE_COUNT_RX.test(prev1) || FATE_COUNT_RX.test(prev2)) continue;
            if (nameIdx.some((ni) => Math.abs(ni - i) <= 7)) {
              out.push({ type: 'fate', atom: `${g.surname}+${cls.key}`, snippet: s.trim() });
              flagged = true;
            }
          }
        }
      }
    }
  }
  return out;
}

// TEMPORAL-1: a relative-time claim ("nearly two years later", "the next
// morning") checked against two named, dated ledger events (timeline ∪
// key_events). Precision over recall: only a sentence naming exactly two
// UNAMBIGUOUS ledger events (each event name matches at most one date) with
// a parseable magnitude+unit is checkable; everything else is counted (in
// the R/C/K telemetry the caller logs) but not judged. Order/gap are
// compared at the COARSER of the two events' date precisions — a year-only
// date and a day-precision date are compared in years.
export const RELATIVE_TIME_RX = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|nearly\s+\w+)\s+(days?|weeks?|months?|years?)\s+(after|before|later|earlier)\b|\bthe\s+(next|following)\s+(day|morning|week|month|year)\b/gi;

const TEMPORAL_NUM_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const TEMPORAL_STOPWORDS = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'of', 'and', 'but', 'or']);

function temporalNormText(s) {
  return String(s || '').toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function temporalContentWordCount(norm) {
  return norm.split(' ').filter((w) => w.length >= 3 && !TEMPORAL_STOPWORDS.has(w)).length;
}

function parseTemporalMagnitude(raw) {
  const s = String(raw || '').trim();
  const nearlyM = s.match(/^nearly\s+(\w+)$/i);
  const token = nearlyM ? nearlyM[1] : s;
  if (/^\d+$/.test(token)) return Number(token);
  return TEMPORAL_NUM_WORDS[token.toLowerCase()] ?? null;
}

function normalizeTemporalUnit(u) {
  const s = String(u || '').toLowerCase();
  if (s.startsWith('day') || s === 'morning') return 'day';
  if (s.startsWith('week')) return 'week';
  if (s.startsWith('month')) return 'month';
  if (s.startsWith('year')) return 'year';
  return null;
}

const TEMPORAL_UNIT_DAYS = { day: 1, week: 7, month: 30.44, year: 365.25 };
const TEMPORAL_PRECISION_RANK = { year: 1, month: 2, day: 3 };

function temporalDateDaysAtPrecision(date, rank) {
  const y = date.y;
  const m = rank >= 2 ? (date.m || 1) : 1;
  const d = rank >= 3 ? (date.d || 1) : 1;
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function checkTemporalViolations(text, ledger) {
  const out = [];
  let R = 0;
  let C = 0;
  if (!ledger || !ledger.ok || !Array.isArray(ledger.events) || !ledger.events.length) {
    out.stats = { R, C, K: 0 };
    return out;
  }

  // Group events by normalized name: a name matching >1 ledger entry with
  // different dates is ambiguous — not checkable. Only names with >= 2
  // content words are candidates for matching against a sentence at all
  // (a one-word event name matches too much prose to be meaningful).
  const byNorm = new Map();
  for (const ev of ledger.events) {
    if (!byNorm.has(ev.norm)) byNorm.set(ev.norm, []);
    byNorm.get(ev.norm).push(ev);
  }
  const candidates = [...byNorm.entries()].filter(([norm]) => temporalContentWordCount(norm) >= 2);

  const paragraphs = String(text || '').split(/\n{2,}/);
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    for (const raw of splitLedgerSentences(para)) {
      const s = String(raw || '').trim();
      if (!s) continue;
      RELATIVE_TIME_RX.lastIndex = 0;
      const m = RELATIVE_TIME_RX.exec(s);
      if (!m) continue;
      R += 1;

      const sNorm = temporalNormText(s);
      const mentioned = [];
      for (const [norm, entries] of candidates) {
        const idx = sNorm.indexOf(norm);
        if (idx === -1) continue;
        mentioned.push({ norm, entries, idx });
      }
      if (mentioned.length !== 2) continue; // not exactly two named events — not checkable
      mentioned.sort((a, b) => a.idx - b.idx);
      const [ref, target] = mentioned;
      const ambiguous = new Set(ref.entries.map((e) => JSON.stringify(e.date))).size > 1 ||
        new Set(target.entries.map((e) => JSON.stringify(e.date))).size > 1;
      if (ambiguous) continue; // an event name matching >1 date — not checkable

      let magnitude;
      let unit;
      let direction;
      if (m[1] !== undefined) {
        magnitude = parseTemporalMagnitude(m[1]);
        unit = normalizeTemporalUnit(m[2]);
        direction = /after|later/i.test(m[3]) ? 'after' : 'before';
      } else {
        magnitude = 1;
        unit = normalizeTemporalUnit(m[5]);
        direction = 'after';
      }
      if (magnitude == null || !unit) continue; // e.g. "several" has no exact number — not checkable

      C += 1;

      const refDate = ref.entries[0].date;
      const targetDate = target.entries[0].date;
      const rank = Math.min(TEMPORAL_PRECISION_RANK[refDate.precision], TEMPORAL_PRECISION_RANK[targetDate.precision]);
      const deltaDays = temporalDateDaysAtPrecision(targetDate, rank) - temporalDateDaysAtPrecision(refDate, rank);
      const deltaInUnit = deltaDays / TEMPORAL_UNIT_DAYS[unit];
      const expectedSign = direction === 'after' ? 1 : -1;
      const actualSign = deltaInUnit > 0 ? 1 : deltaInUnit < 0 ? -1 : 0;

      if (actualSign !== 0 && actualSign !== expectedSign) {
        out.push({
          snippet: s,
          claim: `${magnitude} ${unit}(s) ${direction} ${ref.norm}`,
          eventA: ref.norm,
          eventB: target.norm,
          actual: `${deltaInUnit.toFixed(2)} ${unit}(s)`,
          reason: 'wrong-order',
        });
        continue;
      }
      const tolerance = Math.max(1, 0.25 * Math.abs(deltaInUnit));
      if (Math.abs(Math.abs(deltaInUnit) - magnitude) > tolerance) {
        out.push({
          snippet: s,
          claim: `${magnitude} ${unit}(s) ${direction} ${ref.norm}`,
          eventA: ref.norm,
          eventB: target.norm,
          actual: `${deltaInUnit.toFixed(2)} ${unit}(s)`,
          reason: 'gap-mismatch',
        });
      }
    }
  }
  out.stats = { R, C, K: out.length };
  return out;
}

export function stripFactLedgerViolations(text, ledger) {
  const removed = [];
  if (!ledger || !ledger.ok) return { text: String(text || ''), removed };
  const temporalViolations = checkTemporalViolations(text, ledger);
  for (const v of temporalViolations) {
    console.warn(`[TEMPORAL-1] stripped: ${v.snippet.slice(0, 90)}`);
  }
  const bad = new Set(
    [...checkClockTimeViolations(text, ledger), ...checkFateViolations(text, ledger), ...temporalViolations]
      .map((v) => v.snippet)
  );
  if (!bad.size) return { text: String(text || ''), removed };
  const paragraphs = String(text || '').split(/(\n{2,})/);
  for (let pi = 0; pi < paragraphs.length; pi += 2) {
    const para = paragraphs[pi];
    if (!para || !para.trim()) continue;
    const sentences = splitLedgerSentences(para);
    const kept = sentences.filter((s) => {
      if (bad.has(s.trim())) { removed.push(s.trim().slice(0, 90)); return false; }
      return true;
    });
    if (kept.length !== sentences.length) paragraphs[pi] = kept.join(' ');
  }
  return { text: paragraphs.join(''), removed };
}

export function buildFactLedgerPromptBlock(ledger) {
  if (!ledger || !ledger.ok) return '';
  const lines = [];
  lines.push('CLOSED-WORLD FACT LEDGER (deterministically enforced — violations are cut):');
  if (ledger.clockTimes.length) {
    lines.push(`- CLOCK TIMES: the research contains ONLY these clock times: ${ledger.clockTimes.slice(0, 20).join(', ')}. Never write any other clock time.`);
  } else {
    lines.push('- CLOCK TIMES: the research contains NO clock times. Never write a clock time (like 12:30) — use general phrasing (morning, midday, that afternoon) only if the research supports it.');
  }
  const attestedLines = [];
  const unattested = [];
  for (const f of ledger.figures.slice(0, 60)) {
    const has = Object.entries(f.attested).filter(([, v]) => v).map(([k]) => k);
    if (has.length) attestedLines.push(`  * ${f.name}: ${has.join(' and ')} attested in the research — you may state only what it states.`);
    else unattested.push(f.name);
  }
  if (attestedLines.length || unattested.length) {
    lines.push('- FIGURE FATES (the only permitted life-outcome claims):');
    lines.push(...attestedLines);
    if (unattested.length) {
      lines.push(`  * NO death, survival, or injury is attested for: ${unattested.join('; ')}. Do NOT state whether any of these people lived, died, escaped, were rescued, or were injured — write only what the research documents about them.`);
    }
  }
  if (Array.isArray(ledger.events) && ledger.events.length) {
    lines.push('- DATED EVENTS (a relative-time claim, "two years later" etc., must match the true order and gap between these):');
    for (const ev of ledger.events.slice(0, 40)) {
      const label = ev.date.precision === 'day'
        ? `${ev.date.y}-${String(ev.date.m).padStart(2, '0')}-${String(ev.date.d).padStart(2, '0')}`
        : ev.date.precision === 'month'
          ? `${ev.date.y}-${String(ev.date.m).padStart(2, '0')}`
          : `${ev.date.y}`;
      lines.push(`  * ${ev.name}: ${label}`);
    }
  }
  return lines.join('\n');
}
