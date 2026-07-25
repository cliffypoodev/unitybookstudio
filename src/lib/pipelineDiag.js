/**
 * Pipeline Diagnostic Tool for Unity Book Studio
 *
 * Instruments the draft pipeline to capture prose snapshots at every stage.
 * After a draft completes, call `window.__UBS_PIPELINE.report()` in the console
 * to see exactly where the prose quality degrades.
 *
 * Usage:
 *   1. Refresh the app (this module auto-installs on import via main.jsx)
 *   2. Draft a single chapter
 *   3. Open the browser console and run:  __UBS_PIPELINE.report()
 *   4. Or run:  __UBS_PIPELINE.diff(stageA, stageB)  to compare two stages
 */

const snapshots = new Map();   // chapterId → [ { stage, text, words, chars, ts } ]

function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

function snapshot(chapterId, stage, text) {
  if (!chapterId || !text) return;
  if (!snapshots.has(chapterId)) snapshots.set(chapterId, []);
  const entry = {
    stage,
    text: String(text),
    words: countWords(text),
    chars: text.length,
    ts: Date.now(),
  };
  snapshots.get(chapterId).push(entry);
  console.log(`[PIPELINE-DIAG] Ch.${chapterId} | ${stage} | ${entry.words} words | ${entry.chars} chars`);
}

function report(chapterId) {
  const ids = chapterId ? [chapterId] : [...snapshots.keys()];
  if (!ids.length) {
    console.log('[PIPELINE-DIAG] No snapshots captured yet. Draft a chapter first.');
    return;
  }

  for (const id of ids) {
    const stages = snapshots.get(id);
    if (!stages?.length) continue;

    console.group(`📖 Pipeline Report: ${id}`);
    console.table(stages.map((s, i) => {
      const prev = i > 0 ? stages[i - 1] : null;
      const wordDelta = prev ? s.words - prev.words : 0;
      const charDelta = prev ? s.chars - prev.chars : 0;
      return {
        '#': i + 1,
        Stage: s.stage,
        Words: s.words,
        'Δ Words': i > 0 ? (wordDelta >= 0 ? '+' : '') + wordDelta : '—',
        Chars: s.chars,
        'Δ Chars': i > 0 ? (charDelta >= 0 ? '+' : '') + charDelta : '—',
        'Elapsed': i > 0 ? ((s.ts - stages[i - 1].ts) / 1000).toFixed(1) + 's' : '—',
      };
    }));

    // Flag stages with biggest drops
    let worstDrop = { stage: '', delta: 0 };
    for (let i = 1; i < stages.length; i++) {
      const delta = stages[i].words - stages[i - 1].words;
      if (delta < worstDrop.delta) {
        worstDrop = { stage: stages[i].stage, delta, from: stages[i - 1].words, to: stages[i].words };
      }
    }
    if (worstDrop.delta < -10) {
      console.warn(`⚠️ BIGGEST DROP: "${worstDrop.stage}" lost ${Math.abs(worstDrop.delta)} words (${worstDrop.from} → ${worstDrop.to})`);
    }

    console.groupEnd();
  }
}

function diff(chapterId, stageA, stageB) {
  const stages = snapshots.get(chapterId);
  if (!stages) { console.log('No snapshots for', chapterId); return; }

  const a = stages.find(s => s.stage === stageA);
  const b = stages.find(s => s.stage === stageB);
  if (!a || !b) {
    console.log('Available stages:', stages.map(s => s.stage));
    return;
  }

  console.group(`Diff: "${stageA}" → "${stageB}"`);
  console.log(`Words: ${a.words} → ${b.words} (${b.words - a.words})`);
  console.log(`Chars: ${a.chars} → ${b.chars} (${b.chars - a.chars})`);

  // Find sentences in A that are missing from B
  const sentA = a.text.match(/[^.!?]+[.!?]+/g) || [];
  const sentB = new Set((b.text.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()));
  const removed = sentA.filter(s => !sentB.has(s.trim()));
  if (removed.length) {
    console.warn(`${removed.length} sentence(s) REMOVED:`);
    removed.slice(0, 10).forEach(s => console.log('  −', s.trim()));
    if (removed.length > 10) console.log(`  ... and ${removed.length - 10} more`);
  }

  // Find sentences in B that are new
  const sentASet = new Set(sentA.map(s => s.trim()));
  const added = [...sentB].filter(s => !sentASet.has(s));
  if (added.length) {
    console.log(`${added.length} sentence(s) ADDED:`);
    added.slice(0, 10).forEach(s => console.log('  +', s));
  }

  console.groupEnd();
}

function getStageText(chapterId, stage) {
  const stages = snapshots.get(chapterId);
  return stages?.find(s => s.stage === stage)?.text || null;
}

function clear() {
  snapshots.clear();
  console.log('[PIPELINE-DIAG] All snapshots cleared.');
}

function listChapters() {
  return [...snapshots.keys()];
}

const replayDiagnostics = [];

function captureReplayDiagnostic(record) {
  try {
    const isNode = typeof process !== 'undefined' && process.env;
    const isViteDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
    const isDev = (isNode && process.env.NODE_ENV !== 'production') || isViteDev;
    if (!isDev) return;

    const runId = Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();
    const entry = { runId, timestamp, ...record };

    if (typeof window !== 'undefined') {
      replayDiagnostics.push(entry);
      console.log('[PIPELINE-DIAG] Captured replay diagnostic. Call __UBS_PIPELINE.exportReplayDiagnostics() to download.');
    } else if (typeof process !== 'undefined') {
      import('node:fs').then(fs => {
        import('node:path').then(path => {
          const diagDir = path.join(process.cwd(), 'diagnostics', 'replay');
          if (!fs.existsSync(diagDir)) fs.mkdirSync(diagDir, { recursive: true });
          fs.writeFileSync(
            path.join(diagDir, `replay-diagnostic-${timestamp.replace(/:/g, '-')}-${runId}.json`),
            JSON.stringify(entry, null, 2),
            'utf8'
          );
        });
      }).catch(err => {
        console.error('Failed to write diagnostic in Node environment', err);
      });
    }
  } catch (err) {
    console.error('Diagnostic capture failed (ignored):', err);
  }
}

function exportReplayDiagnostics() {
  if (typeof window === 'undefined') return;
  if (!replayDiagnostics.length) {
    console.log('[PIPELINE-DIAG] No replay diagnostics to export.');
    return;
  }
  const data = JSON.stringify(replayDiagnostics, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `replay-diagnostics-${new Date().getTime()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// Expose globally
if (typeof window !== 'undefined') {
  window.__UBS_PIPELINE = { snapshot, report, diff, getStageText, clear, listChapters, snapshots, captureReplayDiagnostic, exportReplayDiagnostics };
} else if (typeof global !== 'undefined') {
  global.__UBS_PIPELINE = { snapshot, report, diff, getStageText, clear, listChapters, snapshots, captureReplayDiagnostic, exportReplayDiagnostics };
}
export { snapshot, captureReplayDiagnostic, exportReplayDiagnostics };
export default { snapshot, captureReplayDiagnostic, exportReplayDiagnostics };
