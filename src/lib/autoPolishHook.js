/**
 * WAVE5-SETTINGS — auto-polish + final-check hooks.
 *
 * auto_polish_after_gen: when enabled in Settings, every freshly drafted
 * chapter gets a deterministic-only polish pass (no LLM) immediately after
 * its verified save, then re-saves through the full chapter-identity path.
 *
 * auto_final_check_after_polish: when enabled, a quality scan runs over the
 * polished chapters and its findings are appended to the polish report.
 *
 * Both are non-fatal by design — a hook failure logs and never breaks the
 * draft or polish flow that triggered it.
 */
import { getSetting } from './settingsRead.js';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from './requestRetry.js';
import { prepareChapterContent } from './chapterStorage.js';
import { countWords } from './autonovel.js';
import { isNonfictionProject } from './projectType.js';

export async function maybeAutoPolishChapter({ project, chapter, content, onProgress }) {
  if (!getSetting('auto_polish_after_gen', false)) return { ran: false };
  try {
    const { runManuscriptPolishPipeline } = await import('./manuscriptPolishRunner.js');
    const loaded = [{ chapter, content, original: content }];
    const mode = isNonfictionProject(project) ? 'nonfiction' : 'fiction';
    onProgress?.(`Auto-polish: Ch.${chapter.chapter_number || '?'}…`);
    const result = await runManuscriptPolishPipeline({
      loaded,
      project,
      onProgress: onProgress || (() => {}),
      allowLLM: false, // deterministic only — never surprise the user with LLM spend
      mode,
    });
    const polished = loaded[0]?.content || '';
    if (polished && polished !== content) {
      const cf = await prepareChapterContent(polished, project?.id, chapter.id, chapter);
      await runWithNetworkRetry(() =>
        base44.entities.Chapter.update(chapter.id, { ...cf, word_count: countWords(polished) })
      );
      return { ran: true, changed: true, changes: (result?.changes || []).length };
    }
    return { ran: true, changed: false };
  } catch (err) {
    console.warn('[AUTO-POLISH] Hook skipped:', err?.message || err);
    return { ran: false, error: err?.message || String(err) };
  }
}

export async function maybeFinalCheckAfterPolish({ project, loaded, onProgress }) {
  if (!getSetting('auto_final_check_after_polish', false)) return null;
  try {
    const { runQualityScan } = await import('./qualityScan.js');
    onProgress?.('Final check: scanning polished chapters…');
    const findings = [];
    for (const f of loaded || []) {
      const warnings = runQualityScan(f.content || '', project, f.chapter?.chapter_number || 0) || [];
      for (const w of warnings) {
        findings.push(`Ch.${f.chapter?.chapter_number || '?'}: ${typeof w === 'string' ? w : w.text || w.description || JSON.stringify(w)}`);
      }
    }
    return findings;
  } catch (err) {
    console.warn('[FINAL-CHECK] Hook skipped:', err?.message || err);
    return null;
  }
}
