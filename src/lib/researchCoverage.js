// =============================================================
// researchCoverage.js — ARCH2-1: advisory research-coverage precheck
//
// Before drafting, measure how much of a chapter's beat material exists in
// the project evidence (same closed-world evidence definition as
// closedWorldCheck in sceneWriter.js). Advisory only: callers may log the
// result; nothing in this module blocks or mutates anything.
// Book-agnostic: no book-specific names, thresholds, or topics in code.
// =============================================================

const MONTHS = 'january february march april may june july august september october november december';

const STOP = new Set(('the this that these those his her their its it in on at by for no yet but and a an or nor when where while so as if to from with of not never ' + MONTHS + ' monday tuesday wednesday thursday friday saturday sunday').split(' '));

// Beat-instruction verbs and scaffold words — chapter beats are written as
// instructions ("Establish the...", "Analyze..."), and those verbs are never
// factual atoms. Includes platform scaffold tokens that leak into beat JSON.
const BEAT_VERBS = new Set('establish establishes describe describes detail details explain explains discuss discusses analyze analyzes examine examines compare compares connect connects summarize summarizes introduce introduces present presents trace traces explore explores highlight highlights emphasize emphasizes note notes consider considers reveal reveals show shows open opens close closes end ends begin begins frame frames contrast contrasts transition transitions set sets use uses using demonstrate demonstrates reconstruct reconstructs full base44 chapter scene beat beats summary'.split(' '));

const normCW = (s) => String(s || '').toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function buildEvidence(project) {
  return ' ' + normCW([project?.research_data, project?.seed_concept, project?.world_md, project?.characters_md, project?.canon_md, project?.mystery_md, project?.outline_md, project?.voice_md].filter(Boolean).join(' ')) + ' ';
}

/**
 * Advisory research-coverage precheck.
 *
 * @param {object} chapter - chapter record (title, beat_summary, scene_beats_json, ...)
 * @param {object} project - project record (research_data + bible fields)
 * @returns {{ total, missingCount, coverage, missing } | null}
 *   null when there is not enough evidence or beat text to measure.
 */
export function researchCoverageCheck(chapter, project) {
  try {
    if (!chapter || !project) return null;
    const EV = buildEvidence(project);
    if (EV.trim().length < 200) return null;

    const inEV = (raw) => {
      let n = normCW(raw).replace(/^(major general|brigadier general|general|colonel|major|captain|lieutenant|reverend|president|governor|mr|mrs|ms|dr|aunt|the|a|an)\s+/, '');
      if (!n || STOP.has(n)) return true;
      if (EV.includes(' ' + n + ' ') || EV.includes(n)) return true;
      const alt = n.endsWith('s') ? n.slice(0, -1) : n + 's';
      return EV.includes(' ' + alt + ' ') || EV.includes(alt);
    };

    let sb = '';
    try {
      const j = JSON.parse(chapter.scene_beats_json || '[]');
      sb = JSON.stringify(j).replace(/[\[\]{}"]/g, ' ');
    } catch { sb = String(chapter.scene_beats_json || ''); }
    const beatText = [chapter.title, chapter.beat_summary, chapter.scene_beats, chapter.beats, chapter.summary, chapter.description, sb]
      .map((v) => (typeof v === 'string' ? v : ''))
      .filter(Boolean)
      .join('. ');
    if (beatText.trim().length < 40) return null;

    const atoms = new Set();
    // ARCH2-1B: extract per sentence segment so phrases can never glue across
    // a sentence boundary ("...Proclamation. Establish the..." is two segments).
    const segments = beatText.split(/[.!?;:]+\s*/);
    const pre = /(?:[A-Z][\w'’-]*)(?:\s+(?:of|the|and|No\.|[A-Z][\w'’-]*))*/g;
    let m;
    for (const segText of segments) {
    while ((m = pre.exec(segText)) !== null) {
      const toks = m[0].trim().split(/\s+/);
      while (toks.length && (STOP.has(normCW(toks[0])) || BEAT_VERBS.has(normCW(toks[0])))) toks.shift();
      if (!toks.length) continue;
      const contentWords = toks.filter((w) => !/^(of|the|and|its|their)$/i.test(w) && !BEAT_VERBS.has(normCW(w)));
      if (contentWords.length === 0) continue;
      if (contentWords.length === 1 && normCW(contentWords[0]).length < 5) continue;
      const ph = toks.join(' ');
      for (const seg of ph.split(/\s+and\s+/i)) {
        const st = seg.trim().replace(/^(?:Its|Their|His|Her)\s+/i, '');
        if (st && !STOP.has(normCW(st)) && !BEAT_VERBS.has(normCW(st))) atoms.add(st);
      }
    }
    }
    const MRE = new RegExp('\\b(' + MONTHS.split(' ').join('|') + ')\\s+(?:\\d{1,2},?\\s+)?(1[6-9]\\d\\d|20\\d\\d)\\b', 'gi');
    while ((m = MRE.exec(beatText)) !== null) atoms.add(m[0]);

    const list = [...atoms].slice(0, 60);
    if (!list.length) return null;
    const missing = list.filter((a) => !inEV(a));
    return {
      total: list.length,
      missingCount: missing.length,
      coverage: Math.round((100 * (list.length - missing.length)) / list.length),
      missing,
    };
  } catch (e) {
    return null;
  }
}

console.log('[RESEARCH-COVERAGE] ARCH2-1 loaded: advisory coverage precheck');
