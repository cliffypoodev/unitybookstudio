import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import analyzeChapter from '@/lib/analyzeChapter';
import ChapterAnalysisPanel from '@/components/tools/ChapterAnalysisPanel';

export default function FixPassagesEditor({ chapter, chapterIndex, onSave, onBack, busyLabel, setBusyLabel }) {
  const [text, setText] = useState(chapter.content || '');
  const [selection, setSelection] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const textareaRef = useRef(null);

  // Analyze on mount
  useEffect(() => {
    setAnalysis(analyzeChapter(chapter.content || ''));
  }, []);

  const handleSelect = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }
    setSelection({
      start,
      end,
      text: text.substring(start, end),
    });
  }, [text]);

  const handleRewriteSelection = useCallback(async () => {
    if (!selection) return;
    setBusyLabel('Rewriting selected passage…');
    try {
      const contextBefore = text.substring(Math.max(0, selection.start - 500), selection.start);
      const contextAfter = text.substring(selection.end, Math.min(text.length, selection.end + 500));

      const prompt = `You are rewriting a specific passage from a manuscript. 
  
CONTEXT BEFORE THE PASSAGE:
${contextBefore}

PASSAGE TO REWRITE (rewrite ONLY this):
${selection.text}

CONTEXT AFTER THE PASSAGE:
${contextAfter}

Rewrite the passage to fix any issues with:
- AI vocabulary or banned words
- Repetitive phrasing
- Flat character descriptions
- Tell-not-show
- Weak dialogue attribution
- Pacing problems

Rules:
- Maintain the same POV, tense, and voice as the surrounding context
- Keep approximately the same word count (±20%)
- Do not change character names, plot events, or factual content
- Do not add new information — only improve the craft of existing content
- Return ONLY the rewritten passage, nothing else

Rewrite now:`;

      const response = await invokeLLMWithRetry({ prompt });
      const rewritten = typeof response === 'string' ? response : (response?.text || response?.content || response?.data || String(response || ''));

      if (rewritten.trim()) {
        const newText = text.substring(0, selection.start) + rewritten.trim() + text.substring(selection.end);
        setText(newText);
        setSelection(null);
        // Re-analyze after rewrite
        setAnalysis(analyzeChapter(newText));
      }
    } catch (err) {
      console.error('Rewrite failed:', err);
    } finally {
      setBusyLabel('');
    }
  }, [selection, text, setBusyLabel]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <h3 className="font-display text-lg">{chapter.title || `Chapter ${chapterIndex + 1}`}</h3>
        </div>
        <Button onClick={() => onSave(text)} className="rounded-full text-xs">
          Save & Close
        </Button>
      </div>

      {/* Selection toolbar */}
      {selection && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 shrink-0">
          <span className="text-xs text-amber-800 flex-1">
            Selected {selection.text.split(/\s+/).filter(Boolean).length} words
          </span>
          <Button
            onClick={handleRewriteSelection}
            disabled={!!busyLabel}
            size="sm"
            className="rounded-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
          >
            {busyLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Rewrite Selection
          </Button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground shrink-0">
        Select/highlight any passage, then click "Rewrite Selection" to improve just that part.
      </p>

      {/* Chapter Analysis */}
      <ChapterAnalysisPanel analysis={analysis} onReanalyze={() => setAnalysis(analyzeChapter(text))} />

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        className="w-full rounded-xl border border-border/70 bg-background p-4 text-sm leading-relaxed font-serif focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ minHeight: '500px', height: '70vh', resize: 'vertical' }}
        spellCheck
      />
    </div>
  );
}