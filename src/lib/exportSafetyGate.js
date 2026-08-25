// =============================================================
// exportSafetyGate.js — Pre-export safety enforcement
//
// Extracted from ExportTab.jsx for testability and strict enforcement.
// This module scans all resolved export chapters and BLOCKS export
// if any hard failures are found.
//
// Unlike the previous window.confirm approach, this module:
// - Returns a structured report
// - Does NOT produce DOCX for hard failures
// - Logs all results to console AND window.__UBS_LAST_SAFETY_REPORT
// - Only allows override via explicit ALLOW_UNSAFE_EXPORT flag
// =============================================================

export function createExportHardBlockError(code, message, details) {
  const err = new Error(message);
  err.name = 'ExportHardBlockError';
  err.code = code;
  err.isSafetyGateBlock = true;
  if (details) err.details = details;
  return err;
}

export function assertExportSafetyAllowed(report) {
  if (report && report.blocked) {
    const formatted = formatExportSafetyFailure(report);
    throw createExportHardBlockError('SAFETY_GATE_BLOCKED', formatted, report);
  }
  return report;
}

export function assertExportSnapshotIntegrity({
  resolving,
  chapterCount,
  bodyChapterCount,
  missingBodyChapterCount,
  totalChars,
  planningMetadataBlocked,
  forbiddenArtifactsBlocked,
}) {
  if (resolving) throw createExportHardBlockError('RESOLVING_IN_PROGRESS', 'Export blocked: chapter content resolution is still in progress.');
  if (chapterCount === 0) throw createExportHardBlockError('ZERO_CHAPTERS', 'Export blocked: no chapters resolved for export.');
  if (bodyChapterCount === 0) throw createExportHardBlockError('ZERO_BODY_CHAPTERS', 'Export blocked: no body chapters found.');
  if (missingBodyChapterCount > 0) throw createExportHardBlockError('MISSING_BODY_CONTENT', `Export blocked: ${missingBodyChapterCount} body chapter(s) have missing content.`);
  if (totalChars === 0) throw createExportHardBlockError('ZERO_CHARS', 'Export blocked: manuscript is entirely empty.');
  if (planningMetadataBlocked) throw createExportHardBlockError('PLANNING_METADATA_SURVIVED', 'Export blocked: planning/outline metadata masquerading as chapter body.');
  if (forbiddenArtifactsBlocked) throw createExportHardBlockError('FORBIDDEN_ARTIFACTS_SURVIVED', 'Export blocked: forbidden internal pipeline artifact text survived final cleanup.');
}

import { runManuscriptSafetyGate } from './manuscriptSafetyGate.js';
import { buildFactLedger, checkClockTimeViolations, checkFateViolations, checkTemporalViolations } from './nfContentGuard.js'; // ARCH-1C / TEMPORAL-1
import { ensureResearchEvidence } from './researchStorage.js'; // RESEARCHQUALITY-2C
import { runReferenceIntegrityGate } from './referenceIntegrityGate.js';
import { checkStructuralIntegrity, checkBookIntegrity } from './pipelineValidator.js';
import { analyzeProse } from './proseGrammarGate.js';

// Lazy-loaded to avoid circular imports
let _detectDialogueQuoteIssues = null;
async function getDialogueDetector() {
  if (!_detectDialogueQuoteIssues) {
    try {
      const mod = await import('./dialogueMechanicsRepair.js');
      _detectDialogueQuoteIssues = mod.detectDialogueQuoteIssues;
    } catch (_e) {
      // Module may not exist yet — use null sentinel
    }
  }
  return _detectDialogueQuoteIssues;
}

/**
 * Run pre-export safety gate on all resolved chapters.
 *
 * @param {Array} chapters - Resolved export chapters with content_md
 * @param {object} options - { project, stage }
 * @returns {{
 *   blocked: boolean,
 *   hardFailures: Array,
 *   warnings: Array,
 *   passed: Array,
 *   summary: string,
 *   timestamp: string,
 * }}
 */
import { buildPronounCanon, harvestCastNames, scanPronounViolations, scanContextVariablePronounDrift } from './pronounLock.js'; // PRONOUNLOCK-1 / PRONOUNVAR-1
import { scanDuplicateIntroductions } from './introGuard.js'; // INTRODUP-1
import { scanMalformedSentences, MALFORMEDSENT_HARD_BLOCK } from './malformedSentence.js'; // MALFORMEDSENT-1 / GATEPROMOTE-1
import { buildBookStyleLedger, measureSimileDensity, SIMILE_DENSITY_BUDGET_PER_1K } from './aiSlopReduction.js'; // STYLEBUDGET-1
import { findCrossChapterDuplicateSentences } from './crossChapterDedupe.js'; // CROSSDEDUPE-1 / GATEREPORT-1
import { checkFoundationRoleConsistency, parseCanonCast, findNameVariants, scanRoleReferenceDrift } from './canonRoles.js'; // CANON-2 / CHARSTATE-1
import { buildCharacterState, auditProseAgainstCharacterState, extractBeatDeclaredStateUpdates, collectChapterBeatEvents } from './characterStateLedger.js'; // CHARSTATE-1 / CHARSTATE-2
import { isFictionProject, isNonfictionProject } from './projectType.js'; // GATEPROMOTE-1 / NFEXPORT-BIB-1
import { isBackMatter, NF_BIBLIOGRAPHY_HARD_BLOCK } from './bibliographyGenerator.js'; // NFEXPORT-BIB-1
import { countBibliographyEntries } from './bibliographyEntryShape.js'; // NFEXPORT-BIB-1

export async function runPreExportSafetyGate(chapters = [], options = {}) {
  let { project, stage = 'pre-export' } = options;
  // RESEARCHQUALITY-2C: hydrate URL-backed research evidence so the export-lane
  // ledger sees the same closed world as drafting. Fail-open.
  project = await ensureResearchEvidence(project);
  const timestamp = new Date().toISOString();

  const hardFailures = [];
  const warnings = [];
  const passed = [];
  const skipped = [];
  let gatePromoteCount = 0; // GATEPROMOTE-1: incremented at every promotion site (CHARSTATE-1 + MALFORMEDSENT-1)

  for (const ch of chapters) {
    const content = ch?.content_md || '';
    if (content.length < 100) {
      // EXPORTSCRUB-1: this used to push onto `passed`, so a stub chapter was counted
      // in the "All N chapter(s) passed safety gate" line and never reached BOOKGATE-2.
      // Unscanned is not passed. It goes in its own bucket and is reported by name.
      skipped.push({
        chapterNumber: ch?.chapter_number,
        title: ch?.title || '',
        skipped: true,
        reason: `Too short to scan (${content.length} chars)`,
      });
      continue;
    }

    // PROSEGATE-1B: no hard grammar defect ships. POS-aware analysis (retext) —
    // high-precision classes only (a/an mismatch, doubled words, dropped nouns);
    // everything softer stays advisory. Flag-not-fix: repair happens upstream
    // (DRAFTGATE-3C healer, redraft); the gate is the guarantee.
    try {
      const prose = await analyzeProse(content);
      if (prose.hard.length > 0) {
        console.error(`[PROSEGATE-1] Ch.${ch?.chapter_number} BLOCKED: ${prose.hard.length} hard grammar defect(s): ` + prose.hard.slice(0, 3).map((h) => `[p${h.paragraph}] ${h.rule}: "${h.snippet}"`).join(' | '));
        hardFailures.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          reasons: prose.hard.map((h) => `Grammar (${h.rule}) paragraph ${h.paragraph}: "${h.snippet}"`),
        });
        continue;
      }
      if (prose.advisory.length > 0) {
        warnings.push({ chapterNumber: ch?.chapter_number, title: ch?.title || '', reasons: [`${prose.advisory.length} prose advisories (PROSEGATE-1)`] });
      }
    } catch (e) { console.error('[PROSEGATE-1] analyzer unavailable — chapter NOT grammar-verified:', e?.message); }

    // LENGTHGATE-1B: a chapter that assembled far under its explicit target does not
    // ship. Draft-time repair (LENGTHGATE-1A) is best-effort; this is the guarantee.
    // The target comes from chapter/project fields (book data), so the check is
    // book-agnostic. Enforced ONLY when an explicit length target exists — books with
    // no configured target keep the advisory median-relative shortChapters check in
    // checkBookIntegrity and nothing more. Deliberately NOT in the chain:
    // project.chapter_target — that field holds the CHAPTER COUNT, not a word length.
    const explicitChapterTarget = Number(
      ch?.target_words || ch?.targetWords ||
      project?.target_chapter_words || project?.chapter_length_target || 0
    );
    if (explicitChapterTarget > 0) {
      const chapterWordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const chapterWordFloor = Math.round(explicitChapterTarget * 0.75);
      if (chapterWordCount < chapterWordFloor) {
        console.error(`[LENGTHGATE-1B] Ch.${ch?.chapter_number} BLOCKED: ${chapterWordCount} words against a ${explicitChapterTarget}-word target (floor ${chapterWordFloor}).`);
        hardFailures.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          reasons: [`[LENGTHGATE-1B] Chapter assembled at ${chapterWordCount} words against a ${explicitChapterTarget}-word target (floor ${chapterWordFloor}). Under-length chapters do not export — expand or redraft this chapter.`],
        });
        continue;
      }
    }

    // ARCH-1C: no un-evidenced clock time or life-outcome claim ships. The
    // draft lane blocks and strips; polish heals saved chapters; this is the
    // guarantee. Ledger-driven: projects without research build no ledger and
    // skip cleanly.
    try {
      const flLedger = buildFactLedger(project);
      const flClock = checkClockTimeViolations(content, flLedger);
      const flFate = checkFateViolations(content, flLedger);
      if (flClock.length + flFate.length > 0) {
        console.error(`[FATE-GATE] Ch.${ch?.chapter_number} BLOCKED: ${flClock.length} clock-time + ${flFate.length} fate violation(s): ` + [...flClock, ...flFate].slice(0, 3).map((v) => `[${v.atom}] "${v.snippet.slice(0, 60)}"`).join(' | '));
        hardFailures.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          reasons: [...flClock, ...flFate].slice(0, 5).map((v) => `[ARCH-1C] ${v.type} not in evidence (${v.atom}): "${v.snippet.slice(0, 90)}"`),
        });
        continue;
      }
    } catch (e) { console.error('[FATE-GATE] check unavailable — clock/fate NOT verified:', e?.message); }

    // TEMPORAL-1: a relative-time claim ("nearly two years later") that
    // contradicts the research timeline's own order or gap does not ship.
    // Precision over recall: only claims naming two unambiguous, dated
    // ledger events are checkable; everything else is counted but skipped.
    try {
      const flLedger = buildFactLedger(project);
      const temporalV = checkTemporalViolations(content, flLedger);
      const stats = temporalV.stats || { R: 0, C: 0, K: temporalV.length };
      console.log(`[TEMPORAL-1] Ch.${ch?.chapter_number}: ${stats.R} relative-time claim(s), ${stats.C} checkable, ${stats.K} contradiction(s)`);
      if (temporalV.length > 0) {
        console.error(`[TEMPORAL-1] Ch.${ch?.chapter_number} BLOCKED: ${temporalV.length} temporal contradiction(s): ` + temporalV.slice(0, 3).map((v) => `[${v.reason}] "${v.snippet.slice(0, 80)}"`).join(' | '));
        hardFailures.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          recommendedAction: 'REJECT_REGENERATE',
          reasons: temporalV.slice(0, 5).map((v) => `[TEMPORAL-1] ${v.reason} — "${v.snippet.slice(0, 120)}"`),
        });
        continue;
      }
    } catch (e) { console.error('[TEMPORAL-1] check unavailable — temporal claims NOT verified:', e?.message); }

    const gate = runManuscriptSafetyGate(content, {
      project,
      chapter: ch,
      stage,
    });

    // Dialogue issue detection (soft, non-blocking for < 6 issues)
    let dialogueIssueCount = 0;
    try {
      // Inline lightweight detection (same as quality gate)
      const dqIssues = detectExportDialogueIssues(content);
      dialogueIssueCount = dqIssues.count;
    } catch (_e) { /* detection unavailable */ }

    // Quote cluster detection (hard block)
    let quoteClusterCount = 0;
    const quoteClusterMatches = [];
    try {
      for (const m of content.matchAll(/(["“”]{3,})/g)) {
        quoteClusterCount++;
        if (quoteClusterMatches.length < 3) {
          const snippet = content.substring(Math.max(0, m.index - 30), Math.min(content.length, m.index + m[0].length + 30)).replace(/\n/g, ' ');
          quoteClusterMatches.push({ type: 'quote-cluster', phrase: m[0], snippet });
        }
      }
    } catch (_e) { /* counting unavailable */ }

    // Slop density check (warning only)
    let slopTotal = 0;
    try {
      const SLOP_RX = [
        /\bnot just\b/gi, /\bwasn[\u2019']t just\b/gi, /\bdidn[\u2019']t just\b/gi,
        /\bisn[\u2019']t just\b/gi, /\bthe weight of\b/gi, /\bfelt\b/gi,
        /\brealized\b/gi, /\bnarrative\b/gi, /\bperformance\b/gi,
        /\bpalpable\b/gi, /\bmeticulously\b/gi, /\bluminous\b/gi, /\brelentless\b/gi,
      ];
      for (const rx of SLOP_RX) {
        rx.lastIndex = 0;
        slopTotal += (content.match(rx) || []).length;
      }
    } catch (_e) { /* counting unavailable */ }

    const entry = {
      chapterNumber: ch?.chapter_number || ch?.__exportIndex + 1,
      title: ch?.title || '',
      ok: gate.ok,
      recommendedAction: gate.recommendedAction,
      processLeakCount: gate.processLeaks.matches.length,
      contaminationCount: gate.contamination.matches.length,
      malformedCount: gate.malformed.matches.length,
      dialogueIssueCount,
      quoteClusterCount,
      slopTotal,
      reasons: gate.reasons,
      snippets: [
        ...gate.processLeaks.matches.slice(0, 3).map(m => ({ type: 'process-leak', phrase: m.phrase, snippet: m.snippet })),
        ...gate.contamination.matches.slice(0, 3).map(m => ({ type: 'contamination', phrase: m.phrase, snippet: m.snippet })),
        ...gate.malformed.matches.slice(0, 2).map(m => ({ type: 'malformed', phrase: m.phrase, snippet: m.snippet })),
        ...quoteClusterMatches,
      ],
    };

    // Log every chapter result
    console.log(
      `[SAFETY-GATE] stage=${stage} chapter=${entry.chapterNumber}/${entry.title} ok=${gate.ok} ` +
      `action=${gate.recommendedAction} processLeaks=${entry.processLeakCount} ` +
      `contamination=${entry.contaminationCount} malformed=${entry.malformedCount} ` +
      `dialogue=${dialogueIssueCount} quoteClusters=${quoteClusterCount} slop=${slopTotal}`
    );

    // Hard-block for dialogue issues exceeding threshold.
    // The pre-export surface repair pass runs BEFORE this gate, so any
    // issues remaining here are unfixable and must block export.
    if (dialogueIssueCount > 5 && gate.ok) {
      entry.ok = false;
      entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
      entry.reasons = [...(entry.reasons || []), `${dialogueIssueCount} missing opening quote dialogue issues (threshold: 5)`];
    }
    
    // Hard-block for 3+ consecutive quotation marks
    if (quoteClusterCount > 0) {
      entry.ok = false;
      entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
      entry.reasons = [...(entry.reasons || []), `${quoteClusterCount} malformed runs of 3+ consecutive quotation marks (hard blocker)`];
    }

    // BOOKGATE-2: structural integrity of the SAVED text, book-agnostic, hard block.
    //
    // Every other check on this path was written against a defect someone noticed
    // in a draft. This one exists because ch.3 of Brass Meridian TEST could reach
    // export with 96 opening quotes and 57 closing ones - 39 lines of dialogue
    // that open and never close - and every gate here said yes. The dialogue check
    // above counts MISSING OPENERS; nothing counted missing closers.
    //
    // Unclosed dialogue is not a style opinion. It is broken text, it is visible
    // on the page, and no reader-facing artifact should be producible with it.
    try {
      const structural = checkStructuralIntegrity(content, entry.chapterNumber);
      entry.structural = structural;
      if (!structural.quoteBalance.pass) {
        entry.ok = false;
        entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
        entry.reasons = [...(entry.reasons || []),
          `${structural.quoteBalance.unbalancedParagraphs} paragraph(s) with unclosed dialogue ` +
          `(${structural.quoteBalance.open} open / ${structural.quoteBalance.close} close) - hard blocker`];
        entry.snippets = [...(entry.snippets || []), ...structural.quoteBalance.details.slice(0, 3)
          .map((d) => ({ type: 'unclosed-dialogue', phrase: `${d.open}/${d.close}`, snippet: d.excerpt }))];
      }
      if (!structural.gluedWords.pass) {
        entry.ok = false;
        entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
        entry.reasons = [...(entry.reasons || []),
          `${structural.gluedWords.count} glued word(s) from collapsed dialogue: ` +
          `${structural.gluedWords.details.slice(0, 5).join(', ')} - hard blocker`];
      }
      if (!structural.unterminatedParagraphs.pass) {
        entry.ok = false;
        entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
        entry.reasons = [...(entry.reasons || []),
          `${structural.unterminatedParagraphs.count} paragraph(s) end without terminal punctuation - hard blocker`];
      }
      // EXPORTSCRUB-1: checkStructuralIntegrity returns four verdicts and folds all
      // four into structural.pass; the gate acted on three. The typography verdict —
      // mixed straight and curly quotes, a hard failure by that function's own
      // contract — was computed, printed as pass=false, and then ignored, so the book
      // shipped with inconsistent quotes while the console said it had failed. Mixed
      // typography is visible on the page, so it blocks like the other three.
      if (structural.typography && !structural.typography.pass) {
        entry.ok = false;
        entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
        entry.reasons = [...(entry.reasons || []),
          `mixed straight and curly quotation marks (${structural.typography.straightQuotes} straight / `
          + `${structural.typography.curlyOpen} curly) - hard blocker`];
      }
      console.log(
        `[BOOKGATE-2] chapter=${entry.chapterNumber} quotes=${structural.quoteBalance.open}/` +
        `${structural.quoteBalance.close} unbalancedParas=${structural.quoteBalance.unbalancedParagraphs} ` +
        `glued=${structural.gluedWords.count} unterminated=${structural.unterminatedParagraphs.count} ` +
        `pass=${structural.pass}`
      );
    } catch (e) {
      // A gate that cannot run must not silently pass the manuscript.
      entry.ok = false;
      entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
      entry.reasons = [...(entry.reasons || []), `BOOKGATE-2 structural check failed to execute: ${e?.message || e}`];
      console.error('[BOOKGATE-2] check threw; blocking export rather than passing unchecked:', e);
    }

    if (!entry.ok) {
      // Log failure snippets
      for (const s of entry.snippets.slice(0, 3)) {
        console.error(
          `[SAFETY-GATE:FAIL] chapter=${entry.chapterNumber} type=${s.type} phrase="${s.phrase}" ` +
          `snippet="${(s.snippet || '').substring(0, 80)}"`
        );
      }

      if (entry.recommendedAction === 'REJECT_REGENERATE' || entry.recommendedAction === 'REJECT_MANUAL_REVIEW') {
        hardFailures.push(entry);
      } else {
        warnings.push(entry);
      }
    } else {
      // Slop density warnings (non-blocking)
      if (slopTotal > 40) {
        warnings.push({ ...entry, slopWarning: true, reason: `High AI-slop density: ${slopTotal} hits` });
        console.warn(`[SAFETY-GATE:SLOP] chapter=${entry.chapterNumber} slopTotal=${slopTotal} (warning, not blocking)`);
      } else {
        passed.push(entry);
      }
    }
  }

  // ── BOOKGATE-3: verbatim cross-chapter duplication (whole-manuscript, HARD) ──
  // Exact 12+-word sentences in 2+ chapters are duplicated text a reader will
  // catch — different class from BOOKGATE-2's advisory echoes. The polish
  // pre-pass heals these; the gate guarantees none survive to export.
  try {
    // BOOKGATE-3B: resolved export chapters carry content_md (see
    // applyFinalExportCleanup), never a bare content field — the live store
    // has zero Chapter records with one. Reading ch.content scanned empty
    // strings, so this hard gate had been dead code since it landed; the
    // polish pre-pass heal masked it. content stays as a fallback for any
    // caller that shapes chapters that way.
    //
    // CROSSDEDUPE-1: detection is single-sourced in crossChapterDedupe.js —
    // the polish-lane healer hunts exactly what this gate blocks.
    // GATEREPORT-1: report EVERY duplicate, uncapped. The old slice(0, 5)
    // meant an author fixed three sentences, re-exported, and discovered two
    // more the gate had known about all along — whack-a-mole by design.
    const dupX = findCrossChapterDuplicateSentences(
      chapters.map((ch) => ({ chapterNumber: ch?.chapter_number, text: String(ch?.content_md || ch?.content || '') }))
    );
    if (dupX.length > 0) {
      console.error(`[BOOKGATE-3] BLOCKED: ${dupX.length} verbatim cross-chapter duplicate sentence(s): ` + dupX.map((d) => `ch${d.a}=ch${d.b} "${d.norm.slice(0, 80)}"`).join(' | '));
      hardFailures.push({
        chapterNumber: dupX[0].b,
        title: 'Cross-chapter duplication',
        reportAllReasons: true,
        reasons: dupX.map((d) => `Verbatim sentence in ch.${d.a} and ch.${d.b}: "${d.norm.slice(0, 80)}"`),
      });
    }
  } catch (e) { console.error('[BOOKGATE-3] check unavailable — duplication NOT verified:', e?.message); }

  // ── BOOKGATE-2: cross-chapter integrity (whole-manuscript, ADVISORY) ──
  //
  // Deliberately NOT a hard block. Repeated phrasing and an under-length chapter
  // are craft problems, not broken text — blocking a finished book on an echo
  // would make the gate something to route around, and a gate people route
  // around protects nothing. These surface loudly and go in the report.
  try {
    const bookReport = checkBookIntegrity(chapters.map((ch) => ch?.content_md || ''));
    if (typeof window !== 'undefined') window.__UBS_LAST_BOOK_INTEGRITY = bookReport;
    console.log(
      `[BOOKGATE-2] cross-chapter: echoes=${bookReport.crossChapterEchoes.count} ` +
      `openingEchoes=${bookReport.openingEchoes.count} ` +
      `shortChapters=${bookReport.shortChapters.details.length} ` +
      `(median ${bookReport.medianWords} words, floor ${bookReport.shortChapters.floor})`
    );
    for (const d of bookReport.openingEchoes.details) {
      console.warn(`[BOOKGATE-2:OPENING-ECHO] ch${d.chapters[0]} + ch${d.chapters[1]} share ${JSON.stringify(d.shared)}`);
    }
    for (const d of bookReport.shortChapters.details) {
      console.warn(`[BOOKGATE-2:SHORT] ch${d.n} is ${d.words} words, below the ${bookReport.shortChapters.floor}-word floor`);
    }
    if (!bookReport.pass) {
      warnings.push({
        chapterNumber: 'book',
        title: 'Cross-chapter integrity',
        bookIntegrity: true,
        reasons: [
          `${bookReport.crossChapterEchoes.count} phrase(s) repeated across chapters`,
          `${bookReport.openingEchoes.count} chapter pair(s) opening on the same image`,
          `${bookReport.shortChapters.details.length} chapter(s) below the length floor`,
        ],
        details: bookReport,
      });
    }
  } catch (e) {
    console.error('[BOOKGATE-2] cross-chapter check failed (advisory, not blocking):', e);
  }

  // ── Reference Integrity Gate (whole-manuscript) ──
  // Runs on the full assembled text to check bibliography/reference sections,
  // inline citations, fabrication indicators, and unsupported claims.
  const fullText = chapters.map(ch => ch?.content_md || '').join('\n\n');
  let referenceReport = null;
  if (fullText.length > 200) {
    referenceReport = runReferenceIntegrityGate(fullText, project);
    if (typeof window !== 'undefined') {
      window.__UBS_LAST_EXPORT_REFERENCE_REPORT = referenceReport;
      console.log('[SAFETY-GATE:REF] Reference integrity report stored at window.__UBS_LAST_EXPORT_REFERENCE_REPORT');
      console.log('[SAFETY-GATE:REF]', referenceReport.summary);
    }

    // Blocking reference issues → hardFailures (block export)
    for (const issue of referenceReport.blockingIssues) {
      hardFailures.push({
        chapterNumber: 'manuscript',
        title: 'Reference Integrity',
        ok: false,
        recommendedAction: 'REJECT_MANUAL_REVIEW',
        processLeakCount: 0,
        contaminationCount: 0,
        malformedCount: 0,
        dialogueIssueCount: 0,
        slopTotal: 0,
        reasons: [`Reference: ${issue.reason || issue.detail || 'Blocking reference issue'}`],
        snippets: [],
        referenceIssue: true,
      });
    }

    // Warning-level reference issues → warnings (do not block)
    for (const warn of referenceReport.warnings.slice(0, 5)) {
      warnings.push({
        chapterNumber: 'manuscript',
        title: 'Reference Integrity',
        ok: true,
        reasons: [`Reference: ${warn.reason || warn.detail || 'Reference warning'}`],
        snippets: [],
        referenceWarning: true,
      });
    }
  }

  // ── NFEXPORT-BIB-1: a nonfiction book without a Sources section is not
  // done. A title test alone is not enough — the flagship's chapter 21 is
  // titled "Bibliography & Sources" but holds a different book's fiction.
  // Every back-matter chapter is checked against the entry SHAPE; the book
  // is clean when at least one has >= 4 bibliography-shaped entries (the
  // same floor generateBibliography enforces). Same try/catch discipline as
  // every other whole-manuscript check above: fail open, never crash export.
  try {
    if (isNonfictionProject(project)) {
      const backMatterChapters = chapters.filter((ch) => isBackMatter(ch));
      let bestEntryCount = 0;
      let sourcesFound = false;
      const namedFailures = [];
      for (const ch of backMatterChapters) {
        const entryCount = countBibliographyEntries(ch?.content_md || '');
        if (entryCount > bestEntryCount) bestEntryCount = entryCount;
        if (entryCount >= 4) {
          sourcesFound = true;
        } else {
          namedFailures.push(`NFEXPORT-BIB-1: "${ch?.title || 'untitled'}" is titled as Sources but has ${entryCount} entries`);
        }
      }
      console.log(`[NFEXPORT-BIB-1] Gate scan: sources=${sourcesFound ? 'yes' : 'no'} entries=${bestEntryCount}`);
      if (!sourcesFound) {
        const reasons = namedFailures.length
          ? namedFailures
          : ['NFEXPORT-BIB-1: no Sources section (a back-matter chapter with ≥ 4 bibliography entries)'];
        const entry = {
          chapterNumber: 'book',
          title: 'Sources',
          reasons,
          recommendedAction: 'REJECT_MANUAL_REVIEW',
        };
        if (NF_BIBLIOGRAPHY_HARD_BLOCK) {
          hardFailures.push(entry);
        } else {
          warnings.push(entry);
        }
      }
    }
  } catch (bibErr) {
    console.error('[NFEXPORT-BIB-1] Sources scan failed (non-fatal):', bibErr?.message || bibErr);
  }

  // ── Series Contract Gate (whole-manuscript for linked series) ──
  // Validates series canon constraints: dead characters, resolved threads,
  // world rules, entry/exit contracts, voice drift.
  let seriesReport = null;
  if (project?.series_bible_id && fullText.length > 200) {
    try {
      const { runSeriesContractGate } = await import('./seriesContractGate.js');
      const { base44 } = await import('@/api/base44Client');

      let seriesBible = null;
      try {
        const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
        seriesBible = bibles?.[0] || null;
      } catch {}

      if (seriesBible) {
        let entryContract = null;
        let exitContract = null;
        try { entryContract = project.entry_contract_json ? JSON.parse(project.entry_contract_json) : null; } catch {}
        try { exitContract = project.exit_contract_json ? JSON.parse(project.exit_contract_json) : null; } catch {}

        seriesReport = runSeriesContractGate(fullText, project, seriesBible, null, {
          entryContract,
          exitContract,
          isFinalChapter: true, // export = full manuscript = final chapter check
          isExport: true,
        });

        if (typeof window !== 'undefined') {
          window.__UBS_LAST_EXPORT_SERIES_REPORT = seriesReport;
          console.log('[SAFETY-GATE:SERIES] Series contract report stored at window.__UBS_LAST_EXPORT_SERIES_REPORT');
        }

        const flavor = project.series_flavor || 'continuation';

        // For true continuation: blocks become hard failures
        if (flavor === 'continuation') {
          for (const r of seriesReport.results.filter(r => r.severity === 'BLOCK')) {
            hardFailures.push({
              chapterNumber: 'manuscript',
              title: 'Series Continuity',
              ok: false,
              recommendedAction: 'REJECT_MANUAL_REVIEW',
              processLeakCount: 0,
              contaminationCount: 0,
              malformedCount: 0,
              dialogueIssueCount: 0,
              slopTotal: 0,
              reasons: [`Series: ${r.description}`],
              snippets: [],
              seriesViolation: true,
            });
          }
        }

        // All flavors: warnings are non-blocking
        for (const r of seriesReport.results.filter(r => r.severity === 'WARNING').slice(0, 5)) {
          warnings.push({
            chapterNumber: 'manuscript',
            title: 'Series Continuity',
            ok: true,
            reasons: [`Series: ${r.description}`],
            snippets: [],
            seriesWarning: true,
          });
        }

        // Log summary
        console.log(
          `[SAFETY-GATE:SERIES] flavor=${flavor} blocks=${seriesReport.summary.blocks} warnings=${seriesReport.summary.warnings} passed=${seriesReport.passed}`
        );
      }
    } catch (seriesErr) {
      console.warn('[SAFETY-GATE:SERIES] Series contract gate error (non-fatal):', seriesErr?.message);
    }
  }

  // PRONOUNLOCK-1: pronoun drift is reported, never hard-blocked — disguise
  // plots make gendered pronouns legitimately unstable in deliberate prose,
  // and a heuristic must not refuse a book. Fail open on any error.
  try {
    const bodies = chapters.map((ch) => String(ch?.content_md || '')).filter((body) => body.length > 200);
    const castNames = harvestCastNames(options?.project?.characters_md, bodies);
    if (castNames.length) {
      const pronounCanon = buildPronounCanon(options?.project, bodies, castNames);
      for (const ch of chapters) {
        const body = String(ch?.content_md || '');
        if (body.length <= 200) continue;
        const drift = scanPronounViolations(body, pronounCanon.canon, castNames);
        if (drift.length >= 3) {
          warnings.push({
            chapterNumber: ch?.chapter_number,
            title: ch?.title || '',
            reasons: [`PRONOUNLOCK-1: ${drift.length} sentence(s) where a character's pronoun contradicts canon (${drift.slice(0, 2).map((f) => `${f.name} expected ${f.expected}`).join('; ')})`],
          });
        }
      }
      if (pronounCanon.unresolved.length) {
        warnings.push({
          chapterNumber: 'manuscript',
          title: 'Pronoun canon',
          reasons: [`PRONOUNLOCK-1: ${pronounCanon.unresolved.length} character(s) with heavy MIXED pronoun usage and no declaration — declare pronouns in the character sheet (e.g. "Name (they/them)"): ${pronounCanon.unresolved.map((entry) => `${entry.name} (he ${entry.he} / she ${entry.she})`).join(', ')}`],
        });
      }
      // PRONOUNVAR-1: a context-variable character may present differently in
      // different scenes, but WITHIN one scene the pronouns must be uniform.
      if (Array.isArray(pronounCanon.variable) && pronounCanon.variable.length) {
        for (const ch of chapters) {
          const body = String(ch?.content_md || '');
          if (body.length <= 200) continue;
          const vdrift = scanContextVariablePronounDrift(body, pronounCanon.variable, castNames);
          for (const d of vdrift) {
            warnings.push({
              chapterNumber: ch?.chapter_number,
              title: ch?.title || '',
              reasons: [`PRONOUNVAR-1: ${d.name} (context-variable) mixes he and she WITHIN one scene (he ${d.he} / she ${d.she}) — pick one presentation per scene ("${d.excerpt}").`],
            });
          }
        }
      }
      console.log(`[PRONOUNLOCK] Gate scan: canon for ${Object.keys(pronounCanon.canon).length} character(s), ${pronounCanon.unresolved.length} unresolved, ${(pronounCanon.variable || []).length} context-variable`);
    }
  } catch (pronounError) {
    console.warn('[PRONOUNLOCK] Gate scan failed (non-fatal):', pronounError?.message || pronounError);
  }

  // INTRODUP-1: a character who has already introduced themselves does not
  // re-announce their name later in the same chapter. Warning only, closed-world
  // (a KNOWN cast name spoken as a first-person self-reference 2+ times). Fail
  // open — a narrative slip must never stop an export.
  try {
    const introBodies = chapters.map((ch) => String(ch?.content_md || '')).filter((body) => body.length > 200);
    const introCast = harvestCastNames(options?.project?.characters_md, introBodies);
    if (introCast.length) {
      let introTotal = 0;
      for (const ch of chapters) {
        const body = String(ch?.content_md || '');
        if (body.length <= 200) continue;
        const dups = scanDuplicateIntroductions(body, introCast);
        for (const d of dups) {
          introTotal += 1;
          warnings.push({
            chapterNumber: ch?.chapter_number,
            title: ch?.title || '',
            reasons: [`INTRODUP-1: ${d.name} introduces themselves ${d.count} times in this chapter — keep one self-introduction ("${d.excerpts[0]}").`],
          });
        }
      }
      console.log(`[INTRODUP] Gate scan: ${introTotal} duplicate self-introduction(s) across ${chapters.length} chapter(s)`);
    }
  } catch (introError) {
    console.warn('[INTRODUP] Gate scan failed (non-fatal):', introError?.message || introError);
  }

  // MALFORMEDSENT-1: sentences left malformed by the pipeline's own passes —
  // dropped subjects ("Were a ragtag collection…", "Looked at Rodge."), singular
  // + were agreement ("Zin were ridiculous"), bare-verb fragments ("A strange
  // sense of relief wash over her."), name-echo ("JB looked at JB."). Warning
  // only, and NEVER a mutation: a flagged sentence is one to REGENERATE, not to
  // regex-edit — auto-editing prose is what produced these in the first place.
  try {
    const msBodies = chapters.map((ch) => String(ch?.content_md || '')).filter((body) => body.length > 200);
    const msCast = harvestCastNames(options?.project?.characters_md, msBodies);
    let msTotal = 0;
    for (const ch of chapters) {
      const body = String(ch?.content_md || '');
      if (body.length <= 200) continue;
      const bad = scanMalformedSentences(body, msCast);
      if (!bad.length) continue;
      msTotal += bad.length;
      const byKind = bad.reduce((a, f) => { a[f.kind] = (a[f.kind] || 0) + 1; return a; }, {});
      const summary = Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ');
      const msReasons = [`MALFORMEDSENT-1: ${bad.length} malformed sentence(s) (${summary}) — regenerate, do not regex-edit. e.g. "${bad[0].sentence}"`];
      // GATEPROMOTE-1: stays a warning until MALFORMEDSENT_HARD_BLOCK is
      // flipped to true (two consecutive clean exports) — do not flip it here.
      if (isFictionProject(project) && MALFORMEDSENT_HARD_BLOCK) {
        hardFailures.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          ok: false,
          recommendedAction: 'REJECT_REGENERATE',
          processLeakCount: 0,
          contaminationCount: 0,
          malformedCount: bad.length,
          dialogueIssueCount: 0,
          slopTotal: 0,
          reasons: msReasons,
          snippets: [],
        });
        console.warn(`[GATEPROMOTE] Ch.${ch?.chapter_number}: MALFORMEDSENT-1 promoted to hard block`);
        gatePromoteCount += 1;
      } else {
        warnings.push({
          chapterNumber: ch?.chapter_number,
          title: ch?.title || '',
          reasons: msReasons,
        });
      }
    }
    console.log(`[MALFORMEDSENT] Gate scan: ${msTotal} malformed sentence(s) across ${chapters.length} chapter(s)`);
  } catch (msError) {
    console.warn('[MALFORMEDSENT] Gate scan failed (non-fatal):', msError?.message || msError);
  }

  // STYLEBUDGET-1: book-level style telemetry — warnings only. Style is a
  // craft dial, not broken text; the gate makes the spend visible.
  try {
    const styleBodies = chapters.map((ch) => String(ch?.content_md || '')).filter((body) => body.length > 200);
    if (styleBodies.length) {
      const styleLedger = buildBookStyleLedger(styleBodies);
      const exhausted = styleLedger.families.filter((family) => family.exhausted);
      if (exhausted.length) {
        warnings.push({
          chapterNumber: 'manuscript',
          title: 'Style budget',
          reasons: [`STYLEBUDGET-1: book-level allowance exceeded for ${exhausted.map((family) => `${family.name} (${family.spent}/${family.bookBudget})`).join(', ')}`],
        });
      }
      for (const ch of chapters) {
        const body = String(ch?.content_md || '');
        if (body.length <= 200) continue;
        const simile = measureSimileDensity(body);
        if (simile.wordCount > 800 && simile.per1k > SIMILE_DENSITY_BUDGET_PER_1K * 1.5) {
          warnings.push({
            chapterNumber: ch?.chapter_number,
            title: ch?.title || '',
            reasons: [`STYLEBUDGET-1: ${simile.per1k} similes per 1k words ("like a" ${simile.likeA}, "as if" ${simile.asIf}) — budget is ${SIMILE_DENSITY_BUDGET_PER_1K}/1k`],
          });
        }
      }
      console.log(`[STYLEBUDGET] Gate telemetry: ${exhausted.length} exhausted famil(ies), book simile density ${styleLedger.simile.per1k}/1k`);
    }
  } catch (styleError) {
    console.warn('[STYLEBUDGET] Gate telemetry failed (non-fatal):', styleError?.message || styleError);
  }

  // CANON-2: canon integrity — warnings only, but loud. A foundation that
  // disagrees with itself (REDUX: characters_md made Zin the navigator while
  // world_md AND canon_md called Sadie "the ship's navigator") is an author
  // decision to make, not an auto-fix; the gate makes it impossible to miss.
  // Name variants that survived polish are listed the same way.
  try {
    const contradictions = checkFoundationRoleConsistency(project);
    for (const contradiction of contradictions) {
      warnings.push({
        chapterNumber: 'foundation',
        title: 'Canon contradiction',
        reasons: [`CANON-2: the role "${contradiction.role}" is claimed for ${contradiction.distinctNames.join(' AND ')} — ${contradiction.holders.map((h) => `${h.name} in ${h.field}${h.snippet ? ` ("${h.snippet}")` : ''}`).join('; ')}. Fix the story bible: one character owns this role.`],
      });
      console.warn(`[CANON-2] Foundation contradiction: "${contradiction.role}" claimed for ${contradiction.distinctNames.join(' and ')}`);
    }
    const canonCast = parseCanonCast(project?.characters_md);
    if (canonCast.length) {
      for (const ch of chapters) {
        const body = String(ch?.content_md || '');
        if (body.length <= 200) continue;
        const variants = findNameVariants(body, canonCast);
        for (const variant of variants) {
          warnings.push({
            chapterNumber: ch?.chapter_number,
            title: ch?.title || '',
            reasons: [`CANON-2: probable name drift — "${variant.variant}" (${variant.count}x) is a near-miss of canonical "${variant.canonical}".`],
          });
        }
      }
    }
  } catch (canonError) {
    console.warn('[CANON-2] Gate canon telemetry failed (non-fatal):', canonError?.message || canonError);
  }

  // CHARSTATE-1: manuscript-level state-machine telemetry — warnings, loud.
  // Resurrections (a departed character acting in a later chapter with no
  // written return — live: JB departed ch.9, "fidgeted near the counter" in
  // ch.10) and role-reference drift ("The navigator" pointing at the wrong
  // character — live: Sadie in ch.11). Warnings, not hard blocks: both need
  // an author decision (write the return / fix the sentence), and the fix is
  // a redraft, not a mechanical repair.
  let charstateViolationCount = 0;
  try {
    const canonCastForState = parseCanonCast(project?.characters_md);
    const orderedChapters = [...chapters]
      .filter((ch) => Number(ch?.chapter_number) > 0)
      .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number))
      .map((ch) => ({ chapterNumber: Number(ch.chapter_number), title: ch?.title || '', text: String(ch?.content_md || ch?.content || ''), beatEvents: collectChapterBeatEvents(ch) })); // CHARSTATE-2: declared beat events ride along
    const stateCastNames = harvestCastNames(project?.characters_md, orderedChapters.map((c) => c.text));
    if (stateCastNames.length) {
      for (let i = 1; i < orderedChapters.length; i += 1) {
        const priorState = buildCharacterState(orderedChapters.slice(0, i), stateCastNames);
        // CHARSTATE-2: a chapter whose own beat contract declares a return is
        // not a resurrection — the plan staged it, even when the prose phrases
        // the return outside the narrow patterns.
        const declaredHere = extractBeatDeclaredStateUpdates(orderedChapters[i].beatEvents, stateCastNames).returns;
        const violations = auditProseAgainstCharacterState(orderedChapters[i].text, priorState, stateCastNames, { declaredReturns: declaredHere });
        for (const violation of violations) {
          charstateViolationCount += 1;
          console.warn(`[CHARSTATE] Ch.${orderedChapters[i].chapterNumber}: ${violation.code} — ${violation.name}`);
          // GATEPROMOTE-1: in fiction, a resurrection (a departed character
          // acting with no written return) or a duplicate cross-chapter
          // self-introduction is a continuity break, not an advisory —
          // promote to a hard failure. Role drift (below) stays a warning.
          if (isFictionProject(project) && (violation.code === 'DEPARTED_CHARACTER_ACTIVE' || violation.code === 'DUPLICATE_INTRODUCTION')) {
            hardFailures.push({
              chapterNumber: orderedChapters[i].chapterNumber,
              title: orderedChapters[i].title,
              ok: false,
              recommendedAction: 'REJECT_REGENERATE',
              processLeakCount: 0,
              contaminationCount: 0,
              malformedCount: 0,
              dialogueIssueCount: 0,
              slopTotal: 0,
              code: violation.code,
              reasons: [`CHARSTATE-1: ${violation.message}`],
              snippets: [],
            });
            console.warn(`[GATEPROMOTE] Ch.${orderedChapters[i].chapterNumber}: ${violation.code} promoted to hard block`);
            gatePromoteCount += 1;
          } else {
            warnings.push({
              chapterNumber: orderedChapters[i].chapterNumber,
              title: orderedChapters[i].title,
              reasons: [`CHARSTATE-1: ${violation.message}`],
            });
          }
        }
      }
    }
    if (canonCastForState.length) {
      for (const ch of orderedChapters) {
        for (const drift of scanRoleReferenceDrift(ch.text, canonCastForState, stateCastNames)) {
          charstateViolationCount += 1;
          warnings.push({
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            reasons: [`CHARSTATE-1: narration refers to ${drift.referredTo} as "the ${drift.role}" but canon assigns that role to ${drift.holder} ("${drift.snippet}").`],
          });
          console.warn(`[CHARSTATE] Ch.${ch.chapterNumber}: role drift — "${drift.role}" attributed to ${drift.referredTo}, canon holder ${drift.holder}`);
        }
      }
    }
  } catch (stateError) {
    console.warn('[CHARSTATE] Gate telemetry failed (non-fatal):', stateError?.message || stateError);
  }
  // GATEPROMOTE-1B: finding 20 — the promotion/violation console lines were
  // silent at zero, so a live proof could not tell "ran clean" from "never
  // ran" (same class as finding 17). Summary lines next to the other
  // "Gate scan:" lines.
  console.log(`[CHARSTATE] Gate scan: ${charstateViolationCount} violation(s)`);
  console.log(`[GATEPROMOTE] Gate scan: ${gatePromoteCount} promotion(s) across ${chapters.length} chapter(s)`);

  const blocked = hardFailures.length > 0;

  const summary = blocked
    ? `EXPORT BLOCKED: ${hardFailures.length} chapter(s) have hard safety failures.\n` +
      hardFailures.map(f =>
        `  Ch.${f.chapterNumber} (${f.title}): ${f.reasons.join('; ')}`
      ).join('\n') +
      `\n\nRun Fix/Regenerate on rejected chapters before exporting.`
    : warnings.length > 0
      ? `EXPORT WARNING: ${warnings.length} chapter(s) have minor issues.\n` +
        warnings.map(w =>
          `  Ch.${w.chapterNumber} (${w.title}): ${w.reasons.join('; ')}`
        ).join('\n')
      : `EXPORT CLEAR: ${passed.length} chapter(s) passed safety gate.`
        // EXPORTSCRUB-1: never say "All N passed" while N excludes the chapters
        // that were too short to scan. A silent cap reads as full coverage.
        + (skipped.length
          ? `\n${skipped.length} chapter(s) were NOT scanned: `
            + skipped.map((k) => `Ch.${k.chapterNumber} (${k.title || 'untitled'}) - ${k.reason}`).join('; ')
          : '');

  const report = {
    blocked,
    hardFailures,
    warnings,
    passed,
    skipped,
    summary,
    timestamp,
    stage,
    totalChapters: chapters.length,
    scannedChapters: hardFailures.length + warnings.length + passed.length,
    referenceReport,
    seriesReport,
  };

  // Store report globally for live inspection
  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SAFETY_REPORT = report;
    console.log('[SAFETY-GATE] Report stored at window.__UBS_LAST_SAFETY_REPORT');
  }

  return report;
}

/**
 * Format a safety gate failure report as a user-visible string.
 */
export function formatExportSafetyFailure(report) {
  if (!report?.blocked) return '';

  const lines = [
    `⛔ MANUSCRIPT SAFETY GATE — EXPORT BLOCKED`,
    ``,
    `${report.hardFailures.length} chapter(s) failed safety checks:`,
    ``,
  ];

  for (const f of report.hardFailures) {
    lines.push(`  Chapter ${f.chapterNumber}: ${f.title}`);
    lines.push(`    Action: ${f.recommendedAction || 'FIX_OR_REDRAFT'}`);
    // GATEREPORT-1: manuscript-level failures (reportAllReasons) list every
    // defect in one run — a capped report turns export into whack-a-mole.
    const reasonCap = f.reportAllReasons ? (f.reasons || []).length : 3;
    for (const r of (f.reasons || []).slice(0, reasonCap)) {
      lines.push(`    → ${r}`);
    }
    if (f.processLeakCount > 0) lines.push(`    Process leaks: ${f.processLeakCount}`);
    if (f.contaminationCount > 0) lines.push(`    Contamination: ${f.contaminationCount}`);
    if (f.malformedCount > 0) lines.push(`    Malformed grammar: ${f.malformedCount}`);
    if (f.dialogueIssueCount > 0) lines.push(`    Dialogue issues: ${f.dialogueIssueCount}`);
    if (f.quoteClusterCount > 0) lines.push(`    Quote clusters (3+): ${f.quoteClusterCount}`);
    if (f.slopTotal > 40) lines.push(`    AI-slop density: ${f.slopTotal} (high)`);
    for (const s of (f.snippets || []).slice(0, 3)) {
      lines.push(`    → [${s.type}] "${s.phrase}"`);
    }
    lines.push('');
  }

  lines.push(`Fix: Run Regenerate or Fix/Polish on the rejected chapters, then re-export.`);
  lines.push(`Override: Set window.ALLOW_UNSAFE_EXPORT = true in browser console to force export.`);

  return lines.join('\n');
}

// Inline lightweight dialogue detection for export gate (avoids import cycle)
// Uses backward scanning to find nearest opening quote for each closing quote.
function detectExportDialogueIssues(text) {
  const issues = [];
  const lines = text.split('\n');
  const closeTagRx = /([,\.!\?])([\"\u201d])\s+((?:she|he|they|it|the\s+system|the\s+voice|the\s+AI|the\s+guide|the\s+director|[A-Z][a-z]{1,15})\s+(?:said|asked|replied|countered|retorted|corrected|whispered|murmured|demanded|challenged|confirmed|repeated|continued|interrupted|admitted|added|protested|agreed|insisted|observed|noted|announced|warned|explained|suggested|muttered|snapped|snarled|growled|answered|breathed|shouted|called|pressed|objected|exclaimed|declared))/gi;
  const closeTagRx2 = /([,\.!\?])([\"\u201d])\s+((?:she|he|they|it|the\s+system|the\s+voice|the\s+AI|the\s+guide|the\s+director|[A-Z][a-z]{1,15})\s+(?:shot\s+back|called\s+out|fired\s+back|lashed\s+out|bit\s+out|threw\s+back|cried\s+out|pointed\s+out))/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const seenIdx = new Set();
    for (const rx of [closeTagRx, closeTagRx2]) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(line)) !== null) {
        if (seenIdx.has(m.index)) continue;
        seenIdx.add(m.index);
        const beforeMatch = line.substring(0, m.index);
        let hasMatchingOpener = false;

        for (let j = beforeMatch.length - 1; j >= 0; j--) {
          const ch = beforeMatch[j];
          if (ch === '\u201c') { hasMatchingOpener = true; break; }
          if (ch === '\u201d') { break; }
          if (ch === '"') {
            const nextChar = j + 1 < beforeMatch.length ? beforeMatch[j + 1] : '';
            const prevChar = j > 0 ? beforeMatch[j - 1] : '';
            if (/[A-Za-z]/.test(nextChar)) { hasMatchingOpener = true; break; }
            else if (/[,\.!\?a-z]/.test(prevChar)) { break; }
          }
        }

        if (!hasMatchingOpener) {
          issues.push({ line: i + 1, snippet: line.substring(Math.max(0, m.index - 40), m.index + m[0].length).substring(0, 100) });
        }
      }
    }
  }
  return { count: issues.length, issues };
}

console.log('[EXPORT-SAFETY-GATE] v2 loaded: dialogue issue detection + slop density warnings');
