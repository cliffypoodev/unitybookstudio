// =============================================================
// FindReplaceBar.jsx — Polished Find & Replace Panel
//
// Purpose:
// - Search within current editor section.
// - Replace current match in the active Quill editor.
// - Replace all matches in the active section.
// - Optional replace across all loaded manuscript sections.
// - Safe with undefined/null chapter data.
// - Compatible with existing ExportTab usage:
//
// <FindReplaceBar
//   quillRef={quillRef}
//   chapters={orderedWithEdits}
//   selectedChapterId={selectedChapterId}
//   onSelectChapter={handleChapterSelect}
//   onSaveChapter={handleFindReplaceSave}
//   onClose={() => setFindReplaceOpen(false)}
// />
//
// Notes:
// - Current editor replacements directly modify Quill.
// - Manuscript-wide replacements call onSaveChapter(chapterId, markdown).
// - This component does not touch export/DOCX/PDF logic.
// =============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  Replace,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function safeText(value = '') {
  return String(value || '');
}

function getEditor(quillRef) {
  try {
    return quillRef?.current?.getEditor?.() || null;
  } catch {
    return null;
  }
}

function escapeRegExp(value = '') {
  return safeText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(findText, options = {}) {
  if (!findText) return null;

  const source = options.useRegex ? findText : escapeRegExp(findText);
  const flags = options.matchCase ? 'g' : 'gi';

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

function getChapterContent(chapter) {
  return safeText(chapter?.content_md || chapter?.beat_summary || chapter?.content_html || '');
}

function getChapterTitle(chapter, fallback = 'Untitled Section') {
  if (!chapter) return fallback;
  return chapter.title || (chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : fallback);
}

function countMatchesInText(text = '', findText = '', options = {}) {
  if (!findText) return 0;

  const regex = buildRegex(findText, options);
  if (!regex) return 0;

  return safeText(text).match(regex)?.length || 0;
}

function replaceInText(text = '', findText = '', replaceText = '', options = {}) {
  const regex = buildRegex(findText, options);
  if (!regex) return safeText(text);

  return safeText(text).replace(regex, replaceText);
}

function getCurrentEditorText(quillRef) {
  const editor = getEditor(quillRef);
  if (!editor) return '';

  try {
    return editor.getText() || '';
  } catch {
    return '';
  }
}

function findMatchesInEditor(quillRef, findText = '', options = {}) {
  const editorText = getCurrentEditorText(quillRef);
  const regex = buildRegex(findText, options);

  if (!regex) return [];

  const matches = [];
  let match;

  while ((match = regex.exec(editorText)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
    });

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return matches;
}

function selectEditorMatch(quillRef, match) {
  const editor = getEditor(quillRef);
  if (!editor || !match) return;

  try {
    editor.focus();
    editor.setSelection(match.index, match.length, 'user');
  } catch {
    // no-op
  }
}

function replaceCurrentSelection(quillRef, replaceText = '') {
  const editor = getEditor(quillRef);
  if (!editor) return false;

  try {
    const range = editor.getSelection(true);
    if (!range || range.length <= 0) return false;

    editor.deleteText(range.index, range.length, 'user');
    editor.insertText(range.index, replaceText, 'user');
    editor.setSelection(range.index + replaceText.length, 0, 'user');

    return true;
  } catch {
    return false;
  }
}

function replaceAllInEditor(quillRef, findText = '', replaceText = '', options = {}) {
  const editor = getEditor(quillRef);
  if (!editor || !findText) return 0;

  const matches = findMatchesInEditor(quillRef, findText, options);

  if (!matches.length) return 0;

  try {
    editor.focus();

    [...matches].reverse().forEach((match) => {
      editor.deleteText(match.index, match.length, 'user');
      editor.insertText(match.index, replaceText, 'user');
    });

    return matches.length;
  } catch {
    return 0;
  }
}

function TogglePill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-full border px-3 text-[11px] font-black transition',
        active
          ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/75 px-3 py-2">
      <p className="text-xs font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function FindReplaceBar({
  quillRef,
  chapters = [],
  selectedChapterId,
  onSelectChapter,
  onSaveChapter,
  onClose,
}) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [scope, setScope] = useState('current');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [message, setMessage] = useState('');

  const findInputRef = useRef(null);

  const safeChapters = useMemo(() => {
    return Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  }, [chapters]);

  const selectedChapter = useMemo(() => {
    return safeChapters.find((chapter) => chapter?.id === selectedChapterId) || null;
  }, [safeChapters, selectedChapterId]);

  const options = useMemo(
    () => ({
      matchCase,
      useRegex,
    }),
    [matchCase, useRegex]
  );

  const editorMatches = useMemo(() => {
    if (!findText) return [];
    return findMatchesInEditor(quillRef, findText, options);
  }, [quillRef, findText, options]);

  const manuscriptMatches = useMemo(() => {
    if (!findText) return [];

    return safeChapters
      .map((chapter) => {
        const content = getChapterContent(chapter);
        const count = countMatchesInText(content, findText, options);

        return {
          chapter,
          count,
        };
      })
      .filter((item) => item.count > 0);
  }, [safeChapters, findText, options]);

  const totalManuscriptMatches = useMemo(() => {
    return manuscriptMatches.reduce((sum, item) => sum + item.count, 0);
  }, [manuscriptMatches]);

  const currentMatch = editorMatches[activeMatchIndex] || null;

  useEffect(() => {
    setActiveMatchIndex(0);
    setMessage('');
  }, [findText, matchCase, useRegex, selectedChapterId]);

  useEffect(() => {
    if (!currentMatch) return;
    selectEditorMatch(quillRef, currentMatch);
  }, [quillRef, currentMatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      findInputRef.current?.focus?.();
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        goNext();
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        goPrevious();
      }
    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMatches.length, activeMatchIndex, onClose]);

  const invalidRegex = useMemo(() => {
    if (!useRegex || !findText) return false;
    return !buildRegex(findText, options);
  }, [useRegex, findText, options]);

  const goNext = () => {
    if (!editorMatches.length) return;

    const next = activeMatchIndex + 1 >= editorMatches.length ? 0 : activeMatchIndex + 1;
    setActiveMatchIndex(next);
  };

  const goPrevious = () => {
    if (!editorMatches.length) return;

    const previous = activeMatchIndex - 1 < 0 ? editorMatches.length - 1 : activeMatchIndex - 1;
    setActiveMatchIndex(previous);
  };

  const handleReplaceCurrent = () => {
    if (!currentMatch) {
      setMessage('No current match selected.');
      return;
    }

    const ok = replaceCurrentSelection(quillRef, replaceText);

    if (!ok) {
      setMessage('Could not replace current selection.');
      return;
    }

    setMessage('Replaced current match.');
  };

  const handleReplaceAllCurrent = () => {
    if (!findText) {
      setMessage('Enter text to find first.');
      return;
    }

    const count = replaceAllInEditor(quillRef, findText, replaceText, options);
    setMessage(`Replaced ${count.toLocaleString()} match${count === 1 ? '' : 'es'} in current section.`);
  };

  const handleReplaceAllManuscript = async () => {
    if (!findText) {
      setMessage('Enter text to find first.');
      return;
    }

    if (!manuscriptMatches.length) {
      setMessage('No manuscript-wide matches found.');
      return;
    }

    const confirmed = window.confirm(
      `Replace ${totalManuscriptMatches.toLocaleString()} match${totalManuscriptMatches === 1 ? '' : 'es'} across ${manuscriptMatches.length.toLocaleString()} section${manuscriptMatches.length === 1 ? '' : 's'}?`
    );

    if (!confirmed) return;

    let changedSections = 0;
    let changedMatches = 0;

    for (const item of manuscriptMatches) {
      const chapter = item.chapter;
      const currentContent = getChapterContent(chapter);
      const nextContent = replaceInText(currentContent, findText, replaceText, options);

      if (nextContent !== currentContent) {
        changedSections += 1;
        changedMatches += item.count;

        if (typeof onSaveChapter === 'function') {
          // ExportTab handles the active editor update/backups through its save pathway.
          // This component only supplies the replacement markdown/content.
          // eslint-disable-next-line no-await-in-loop
          await onSaveChapter(chapter.id, nextContent);
        }
      }
    }

    setMessage(
      `Replaced ${changedMatches.toLocaleString()} match${changedMatches === 1 ? '' : 'es'} across ${changedSections.toLocaleString()} section${changedSections === 1 ? '' : 's'}.`
    );
  };

  const handleJumpToSection = async (chapterId) => {
    if (!chapterId) return;
    await onSelectChapter?.(chapterId);
  };

  return (
    <div className="shrink-0 border-b border-border/50 bg-background/95 shadow-sm">
      <div className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileSearch className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-foreground">Find & Replace</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {getChapterTitle(selectedChapter, 'Current Section')}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Close find and replace"
              aria-label="Close find and replace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                ref={findInputRef}
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
                placeholder="Find text…"
                className={cn(
                  'h-10 w-full rounded-2xl border bg-card pl-9 pr-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2',
                  invalidRegex
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-border focus:border-primary/50 focus:ring-primary/15'
                )}
              />
            </label>

            <label className="relative block">
              <Replace className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
                placeholder="Replace with…"
                className="h-10 w-full rounded-2xl border border-border bg-card pl-9 pr-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TogglePill active={matchCase} onClick={() => setMatchCase((value) => !value)}>
              Match Case
            </TogglePill>

            <TogglePill active={useRegex} onClick={() => setUseRegex((value) => !value)}>
              Regex
            </TogglePill>

            <div className="inline-flex h-8 overflow-hidden rounded-full border border-border bg-card">
              <button
                type="button"
                onClick={() => setScope('current')}
                className={cn(
                  'px-3 text-[11px] font-black transition',
                  scope === 'current'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Current
              </button>

              <button
                type="button"
                onClick={() => setScope('manuscript')}
                className={cn(
                  'border-l border-border px-3 text-[11px] font-black transition',
                  scope === 'manuscript'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Manuscript
              </button>
            </div>

            {invalidRegex && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Invalid regex
              </span>
            )}

            {message && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {message}
              </span>
            )}
          </div>
        </div>

        <div className="grid min-w-[260px] gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <div className="grid grid-cols-2 gap-2 sm:col-span-1 xl:grid-cols-2">
            <StatPill
              label="current"
              value={editorMatches.length ? `${activeMatchIndex + 1}/${editorMatches.length}` : '0'}
            />

            <StatPill label="book" value={totalManuscriptMatches.toLocaleString()} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:col-span-1 xl:grid-cols-2">
            <button
              type="button"
              onClick={goPrevious}
              disabled={!editorMatches.length}
              className="h-9 rounded-2xl border border-border bg-card text-xs font-black text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!editorMatches.length}
              className="h-9 rounded-2xl border border-border bg-card text-xs font-black text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <div className="grid gap-2 sm:col-span-1 xl:grid-cols-1">
            <button
              type="button"
              onClick={handleReplaceCurrent}
              disabled={!currentMatch}
              className="h-9 rounded-2xl border border-border bg-card text-xs font-black text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Replace Current
            </button>

            {scope === 'current' ? (
              <button
                type="button"
                onClick={handleReplaceAllCurrent}
                disabled={!findText || invalidRegex}
                className="h-9 rounded-2xl bg-primary text-xs font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Replace In Section
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReplaceAllManuscript}
                disabled={!findText || invalidRegex || !manuscriptMatches.length}
                className="h-9 rounded-2xl bg-primary text-xs font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Replace In Book
              </button>
            )}
          </div>
        </div>
      </div>

      {scope === 'manuscript' && findText && (
        <div className="border-t border-border/40 bg-muted/20 px-3 py-2">
          {manuscriptMatches.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {manuscriptMatches.map((item) => (
                <button
                  key={item.chapter?.id}
                  type="button"
                  onClick={() => handleJumpToSection(item.chapter?.id)}
                  className={cn(
                    'shrink-0 rounded-2xl border px-3 py-2 text-left transition hover:bg-muted',
                    item.chapter?.id === selectedChapterId
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  <p className="max-w-[180px] truncate text-xs font-black">
                    {getChapterTitle(item.chapter)}
                  </p>

                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.count.toLocaleString()} match{item.count === 1 ? '' : 'es'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              No manuscript-wide matches found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}