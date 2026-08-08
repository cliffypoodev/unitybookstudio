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
export async function runPreExportSafetyGate(chapters = [], options = {}) {
  const { project, stage = 'pre-export' } = options;
  const timestamp = new Date().toISOString();

  const hardFailures = [];
  const warnings = [];
  const passed = [];
  const skipped = [];

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
    for (const r of (f.reasons || []).slice(0, 3)) {
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
