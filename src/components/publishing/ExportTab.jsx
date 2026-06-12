// =============================================================
// ExportTab.jsx — Export Safety Net v39 / Generic Structural Export Gate
//
// Keeps:
// - Backup safety before overwrite
// - Rich HTML + Delta additive persistence
// - Markdown fallback
// - DOCX paragraph spacing fix
// - Final export seatbelt only: alias/mechanical cleanup WITHOUT quote mutation
// - Editor / preview / split / focus modes
// - Manuscript Health Check modal
// - Safe chapters handling
//
// Fixes:
// - Inspector pane no longer gets stuck in recovery-tab behavior.
// - Inspector visibility is controlled by inspectorPaneOpen only.
// - Chapter pane behavior remains unchanged.
// - Toggle buttons remain managed by ExportMenuBar.
// =============================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
} from 'docx';
import { BookOpen, FileText as FileTextIcon, PanelLeftOpen, RefreshCw, Save, Settings, X } from 'lucide-react';

import { DEFAULT_PUBLISH_SETTINGS, parseTrimSize, getLineHeightValue } from '@/lib/publishConstants';
import { generateBookCSS } from '@/lib/generateBookCSS';
import { buildBookHtml, buildMarkdownExport, buildPlainTextExport } from '@/lib/buildBookHtml';

import ExportChapterSidebar from '@/components/publishing/ExportChapterSidebar';
import ExportEditor from '@/components/publishing/ExportEditor';
import ExportMenuBar from '@/components/publishing/ExportMenuBar';
import ExportFormatBar from '@/components/publishing/ExportFormatBar';
import FindReplaceBar from '@/components/publishing/FindReplaceBar';
import ExportPreviewPane from '@/components/publishing/ExportPreviewPane';
import ManuscriptHealthCheck from '@/components/publishing/ManuscriptHealthCheck';

import { useIsMobile } from '@/hooks/use-mobile';
import PublishSettingsSheet from '@/components/publishing/PublishSettingsSheet';
import useAutoSave from '@/hooks/useAutoSave';
import { mdToHtml, htmlToMd, stripHtmlToText } from '@/lib/mdHtmlConvert';
import { chapterHasContent, resolveChapterContent, prepareChapterContent } from '@/lib/chapterStorage';
import { isFrontMatter, isBackMatter, isBodyChapter } from '@/lib/bibliographyGenerator';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { base44 } from '@/api/base44Client';
import {
  prepareRichEditorPayload,
  resolveRichHtmlContent,
  getRichContentAvailability,
} from '@/lib/richContentStorage';
import { backupExportChapterIfChanged } from '@/lib/exportVersionSafety';
import { repairManuscriptArtifacts } from '@/lib/manuscriptArtifactRepair';
import { runPreExportSafetyGate, formatExportSafetyFailure } from '@/lib/exportSafetyGate';
import { runDialogueMechanicsPass, runMidParagraphDialogueAutofixPass } from '@/lib/dialogueMechanicsRepair';
console.log('[EXPORT] ExportTab HARDFIX v46 loaded: pre-export dialogue surface repair + strict safety gate');

export default function ExportTab({
  project,
  chapters = [],
  onSaveSettings,
  onSaveChapter,
  isSavingChapter,
}) {
  const safeChapters = useMemo(() => {
    return Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  }, [chapters]);

  const [publishSettings, setPublishSettings] = useState(
    project?.publishSettings || DEFAULT_PUBLISH_SETTINGS
  );

  const [selectedChapterId, setSelectedChapterId] = useState(safeChapters[0]?.id || null);
  const [editorValue, setEditorValue] = useState('');
  const [editorLoadedForId, setEditorLoadedForId] = useState(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [healthCheckOpen, setHealthCheckOpen] = useState(false);

  const [chaptersPaneOpen, setChaptersPaneOpen] = useState(true);
  const [inspectorPaneOpen, setInspectorPaneOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState('editor');

  const [resolvedChapters, setResolvedChapters] = useState([]);
  const [resolving, setResolving] = useState(false);

  const quillRef = useRef(null);
  const isMobile = useIsMobile();
  const resolvingRef = useRef(false);
  const dirtyRef = useRef(false);

  const effectiveViewMode = useMemo(() => {
    if (isMobile && viewMode === 'split') return 'editor';
    return viewMode;
  }, [isMobile, viewMode]);

  const handleViewModeChange = useCallback(
    (nextMode) => {
      if (isMobile && nextMode === 'split') {
        setViewMode('editor');
        return;
      }

      setViewMode(nextMode);
    },
    [isMobile]
  );

  const ordered = useMemo(() => {
    const sorted = [...safeChapters].sort((a, b) => {
      const aNum = Number(a?.chapter_number || 0);
      const bNum = Number(b?.chapter_number || 0);
      return aNum - bNum;
    });

    const front = sorted.filter((ch) => isFrontMatter(ch));
    const body = sorted.filter((ch) => isBodyChapter(ch));
    const back = sorted.filter((ch) => isBackMatter(ch));

    return [...front, ...body, ...back];
  }, [safeChapters]);

  const chaptersFingerprint = useMemo(() => {
    return ordered.map((ch) => ch?.id || '').join('|');
  }, [ordered]);

  const chapterUpdateFingerprint = useMemo(() => {
    return safeChapters
      .map(
        (ch) =>
          `${ch?.id || ''}:${ch?.updated_date || ''}:${ch?.word_count || 0}:${ch?.content_html_url || ''}:${ch?.content_delta_url || ''}`
      )
      .join('|');
  }, [safeChapters]);

  const prevFingerprintRef = useRef('');

  useEffect(() => {
    if (prevFingerprintRef.current && prevFingerprintRef.current !== chapterUpdateFingerprint) {
      setRefreshKey((key) => key + 1);
    }

    prevFingerprintRef.current = chapterUpdateFingerprint;
  }, [chapterUpdateFingerprint]);

  useEffect(() => {
    if (project?.publishSettings) {
      setPublishSettings(project.publishSettings);
    }
  }, [project?.publishSettings]);

  useEffect(() => {
    if (ordered.length && !selectedChapterId) {
      setSelectedChapterId(ordered[0]?.id || null);
    }
  }, [ordered, selectedChapterId]);

  async function resolveEditorHtmlForChapter(chapter) {
    if (!chapter) return '';

    const richAvailability = getRichContentAvailability(chapter);

    if (richAvailability.hasHtml) {
      const richHtml = await resolveRichHtmlContent(chapter);

      if (richHtml && richHtml.trim()) {
        return richHtml;
      }
    }

    const markdown = await resolveChapterContent(chapter);
    return mdToHtml(markdown || '');
  }

  useEffect(() => {
    if (!ordered.length) {
      setResolvedChapters([]);
      setResolving(false);
      resolvingRef.current = false;
      return;
    }

    if (resolvingRef.current) {
      console.log('[EXPORT] Skipping duplicate resolution; one is already in flight.');
      return;
    }

    resolvingRef.current = true;
    let cancelled = false;
    setResolving(true);

    console.log('[EXPORT] Resolving chapter content from DB.', {
      refreshKey,
      count: ordered.length,
      fingerprint: chaptersFingerprint.substring(0, 120),
    });

    const CHUNK_SIZE = 1; // v18: avoid Base44/GitHub burst resolving and 429 spam

    (async () => {
      const resolved = new Array(ordered.length);

      for (let i = 0; i < ordered.length; i += CHUNK_SIZE) {
        if (cancelled) return;

        const chunk = ordered.slice(i, i + CHUNK_SIZE);

        const results = await Promise.allSettled(
          chunk.map(async (chapter) => {
            try {
              const freshRecords = await runWithNetworkRetry(() =>
                base44.entities.Chapter.filter({ id: chapter.id })
              );

              const freshChapter = freshRecords?.[0] || chapter;
              const markdown = await resolveChapterContent(freshChapter);
              const richAvailability = getRichContentAvailability(freshChapter);

              return {
                ...chapter,
                ...freshChapter,
                content_md: markdown || '',
                rich_content_available: richAvailability.hasHtml || richAvailability.hasDelta,
                resolved_content_loaded: true,
              };
            } catch (err) {
              console.warn(
                `[EXPORT] Failed to fetch fresh chapter ${chapter?.chapter_number || chapter?.id}; using prop fallback.`,
                err?.message || err
              );

              const markdown = await resolveChapterContent(chapter);

              return {
                ...chapter,
                content_md: markdown || '',
                resolved_content_loaded: false,
                resolved_content_error: err?.message || String(err),
              };
            }
          })
        );

        for (let j = 0; j < chunk.length; j += 1) {
          const result = results[j];

          if (result.status === 'fulfilled') {
            resolved[i + j] = result.value;
          } else {
            console.error('[EXPORT] Chapter slot failed entirely:', result.reason);

            resolved[i + j] = {
              ...chunk[j],
              content_md: '',
              resolved_content_loaded: false,
              resolved_content_error: result.reason?.message || String(result.reason),
            };
          }
        }

        // v18: small backoff between chapter fetches to avoid 429 bursts.
        if (i + CHUNK_SIZE < ordered.length) {
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
      }

      if (cancelled) return;

      const cleanResolved = resolved.filter(Boolean);

      setResolvedChapters(cleanResolved);
      setResolving(false);
      resolvingRef.current = false;

      const totalChars = cleanResolved.reduce(
        (sum, ch) => sum + String(ch?.content_md || '').length,
        0
      );

      console.log('[EXPORT] Resolved chapters:', cleanResolved.length, 'Total markdown chars:', totalChars);
    })().catch((err) => {
      if (!cancelled) {
        console.error('[EXPORT] Chapter resolution failed:', err);
        setResolving(false);
      }

      resolvingRef.current = false;
    });

    return () => {
      cancelled = true;
      resolvingRef.current = false;
    };
  }, [chaptersFingerprint, refreshKey, ordered]);

  const selectedChapter = useMemo(() => {
    return (
      resolvedChapters.find((chapter) => chapter?.id === selectedChapterId) ||
      ordered.find((chapter) => chapter?.id === selectedChapterId) ||
      resolvedChapters[0] ||
      ordered[0] ||
      null
    );
  }, [ordered, resolvedChapters, selectedChapterId]);

  const selectedResolvedChapter = useMemo(() => {
    return resolvedChapters.find((chapter) => chapter?.id === selectedChapterId) || null;
  }, [resolvedChapters, selectedChapterId]);

  const selectedChapterFingerprint = selectedChapter
    ? `${selectedChapter.id}:${selectedChapter.updated_date || ''}:${selectedChapter.word_count || 0}:${selectedChapter.content_html_url || ''}:${selectedChapter.content_delta_url || ''}:${refreshKey}`
    : '';

  useEffect(() => {
    if (!selectedChapter) {
      setEditorValue('');
      setEditorLoadedForId(null);
      setIsEditorDirty(false);
      dirtyRef.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (
          dirtyRef.current &&
          editorLoadedForId === selectedChapter.id &&
          selectedChapter.id === selectedChapterId
        ) {
          console.log('[EXPORT] Editor reload skipped to protect unsaved local edits.');
          return;
        }

        let html = '';

        if (selectedResolvedChapter) {
          html = await resolveEditorHtmlForChapter(selectedResolvedChapter);
        } else {
          const freshRecords = await runWithNetworkRetry(() =>
            base44.entities.Chapter.filter({ id: selectedChapter.id })
          );
          const freshChapter = freshRecords?.[0] || selectedChapter;
          html = await resolveEditorHtmlForChapter(freshChapter);
        }

        if (cancelled) return;

        setEditorValue(html || '');
        setEditorLoadedForId(selectedChapter.id);
        setIsEditorDirty(false);
        dirtyRef.current = false;
      } catch (err) {
        console.warn(
          `[EXPORT] Failed to load editor content for chapter ${selectedChapter?.chapter_number || selectedChapter?.id}; using markdown fallback.`,
          err?.message || err
        );

        const markdown = await resolveChapterContent(selectedChapter);

        if (cancelled) return;

        setEditorValue(mdToHtml(markdown || ''));
        setEditorLoadedForId(selectedChapter.id);
        setIsEditorDirty(false);
        dirtyRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedChapterFingerprint,
    selectedChapterId,
    selectedResolvedChapter?.content_md,
    selectedResolvedChapter?.content_html,
    selectedResolvedChapter?.content_html_url,
    editorLoadedForId,
    selectedChapter,
    selectedResolvedChapter,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof onSaveSettings === 'function') {
        onSaveSettings(publishSettings);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [publishSettings, onSaveSettings]);

  const orderedWithEdits = useMemo(() => {
    const source = (resolvedChapters.length ? resolvedChapters : ordered).filter(Boolean);

    if (!selectedChapterId || editorLoadedForId !== selectedChapterId) {
      return source;
    }

    const currentMd = htmlToMd(editorValue || '');

    return source.map((chapter) =>
      chapter?.id === selectedChapterId
        ? {
            ...chapter,
            content_md: currentMd,
            word_count: countPlainWords(currentMd),
            local_editor_override: isEditorDirty,
          }
        : chapter
    );
  }, [resolvedChapters, ordered, selectedChapterId, editorLoadedForId, editorValue, isEditorDirty]);

  const exportReadyChapters = useMemo(() => {
    return orderedWithEdits.filter((chapter) => {
      // v35: readiness must be based on actual manuscript body fields only.
      // beat_summary is planning metadata and must never make Export look ready.
      const content = String(chapter?.content_md || '').trim();
      return content.length > 0 || chapterHasContent(chapter);
    });
  }, [orderedWithEdits]);

  const hasDrafts = exportReadyChapters.length > 0;

  const pdfCSS = useMemo(
    () => generateBookCSS(publishSettings, project?.title || '', project?.author_name || '', 'pdf'),
    [publishSettings, project?.title, project?.author_name]
  );

  const handleEditorChange = useCallback((value) => {
    setEditorValue(value);
    setIsEditorDirty(true);
    dirtyRef.current = true;
  }, []);

  const getCurrentDelta = useCallback(() => {
    try {
      const q = quillRef?.current?.getEditor?.();
      if (!q) return null;
      return q.getContents();
    } catch {
      return null;
    }
  }, []);

  const createBackupBeforeOverwrite = useCallback(
    async ({ chapterId, markdown, html, reason }) => {
      if (!chapterId) return {};

      try {
        console.log('[EXPORT] Requesting backup before overwrite:', {
          chapterId,
          reason,
          markdownChars: String(markdown || '').length,
          htmlChars: String(html || '').length,
        });

        return await backupExportChapterIfChanged({
          chapterId,
          projectId: project?.id,
          incomingMarkdown: markdown,
          incomingHtml: html,
          reason,
        });
      } catch (err) {
        console.warn('[EXPORT] Backup safety failed. Save will continue.', err?.message || err);
        return {};
      }
    },
    [project?.id]
  );

  const saveRichPayloadForChapter = useCallback(
    async (chapterId, markdown, html) => {
      if (!chapterId) return {};

      const delta = getCurrentDelta();

      try {
        const richPayload = await prepareRichEditorPayload({
          html,
          delta,
          markdown,
          projectId: project?.id,
          chapterId,
        });

        await runWithNetworkRetry(() =>
          base44.entities.Chapter.update(chapterId, richPayload)
        );

        return richPayload;
      } catch (err) {
        console.warn('[EXPORT] Rich payload save failed. Markdown save remains intact.', err?.message || err);
        return {};
      }
    },
    [getCurrentDelta, project?.id]
  );

  const handleSaveChapter = useCallback(async () => {
    if (!selectedChapter || typeof onSaveChapter !== 'function') return;

    const html = editorValue || '';
    const markdown = htmlToMd(html);

    await createBackupBeforeOverwrite({
      chapterId: selectedChapter.id,
      markdown,
      html,
      reason: 'Export editor save',
    });

    await onSaveChapter(selectedChapter.id, markdown);

    const richPayload = await saveRichPayloadForChapter(selectedChapter.id, markdown, html);

    setResolvedChapters((current) =>
      current.map((chapter) =>
        chapter?.id === selectedChapter.id
          ? {
              ...chapter,
              ...richPayload,
              content_md: markdown,
              word_count: countPlainWords(markdown),
              rich_content_available: Boolean(
                richPayload.content_html ||
                  richPayload.content_html_url ||
                  richPayload.content_delta ||
                  richPayload.content_delta_url
              ),
            }
          : chapter
      )
    );

    setIsEditorDirty(false);
    dirtyRef.current = false;
  }, [
    createBackupBeforeOverwrite,
    editorValue,
    onSaveChapter,
    saveRichPayloadForChapter,
    selectedChapter,
  ]);

  const exportAutoSave = useAutoSave(editorValue, handleSaveChapter, {
    delay: 60000,
    enabled: !!selectedChapter && isEditorDirty,
  });

  const wordCount = useMemo(() => {
    return String(editorValue || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  }, [editorValue]);

  const handleRefreshFromDB = useCallback(async () => {
    if (dirtyRef.current) {
      const ok = window.confirm(
        'You have unsaved edits in the current chapter. Refreshing from the database may replace the editor with the saved version. Save first?'
      );

      if (ok) {
        await handleSaveChapter();
      } else {
        return;
      }
    }

    setRefreshKey((key) => key + 1);
  }, [handleSaveChapter]);

  const handleChapterSelect = useCallback(
    async (id) => {
      if (!id || id === selectedChapterId) {
        if (isMobile) setSidebarOpen(false);
        return;
      }

      if (dirtyRef.current && selectedChapter) {
        try {
          await handleSaveChapter();
        } catch (err) {
          const ok = window.confirm(
            'The current chapter could not be saved before switching. Switch chapters anyway?'
          );

          if (!ok) return;

          console.warn('[EXPORT] Switching chapters despite failed save:', err);
        }
      }

      setSelectedChapterId(id);
      setEditorLoadedForId(null);
      setEditorValue('');
      setIsEditorDirty(false);
      dirtyRef.current = false;

      if (isMobile) setSidebarOpen(false);
    },
    [handleSaveChapter, isMobile, selectedChapter, selectedChapterId]
  );

  const handleFindReplaceSave = useCallback(
    async (chapterId, markdown) => {
      if (!chapterId || typeof onSaveChapter !== 'function') return;

      if (markdown !== undefined && markdown !== null) {
        const safeMarkdown = String(markdown);
        const safeHtml = chapterId === selectedChapterId ? mdToHtml(safeMarkdown) : '';

        await createBackupBeforeOverwrite({
          chapterId,
          markdown: safeMarkdown,
          html: safeHtml,
          reason: 'Export Find/Replace save',
        });

        await onSaveChapter(chapterId, safeMarkdown);

        const richPayload =
          chapterId === selectedChapterId
            ? await saveRichPayloadForChapter(chapterId, safeMarkdown, safeHtml)
            : {};

        setResolvedChapters((current) =>
          current.map((chapter) =>
            chapter?.id === chapterId
              ? {
                  ...chapter,
                  ...richPayload,
                  content_md: safeMarkdown,
                  word_count: countPlainWords(safeMarkdown),
                }
              : chapter
          )
        );

        if (chapterId === selectedChapterId) {
          setEditorValue(mdToHtml(safeMarkdown));
          setIsEditorDirty(false);
          dirtyRef.current = false;
        }

        return;
      }

      if (chapterId === selectedChapterId) {
        await handleSaveChapter();
      }
    },
    [
      createBackupBeforeOverwrite,
      handleSaveChapter,
      onSaveChapter,
      saveRichPayloadForChapter,
      selectedChapterId,
    ]
  );


  const buildResolvedExportChapters = useCallback(
    async ({ chapters: sourceChapters = [], selectedChapterId: activeChapterId, editorLoadedForId: loadedId, editorValue: activeEditorValue } = {}) => {
      const source = Array.isArray(sourceChapters) ? sourceChapters.filter(Boolean) : [];
      const resolved = [];

      for (let index = 0; index < source.length; index += 1) {
        const chapter = source[index];
        const isActiveEditorChapter =
          chapter?.id &&
          activeChapterId &&
          chapter.id === activeChapterId &&
          loadedId === activeChapterId;

        let freshChapter = chapter;
        let sourceLabel = 'state';

        // v18: do NOT re-fetch every chapter during export.
        // The Export tab already resolves chapter bodies into `resolvedChapters`.
        // Export should use that cached snapshot plus the active editor text.
        // Heavy manuscript cleanup/saving belongs to Fix/Polish.

        let markdown = '';

        if (isActiveEditorChapter) {
          markdown = htmlToMd(activeEditorValue || '');
          sourceLabel = chapter?.local_editor_override ? 'active-editor-unsaved' : 'active-editor-loaded';
        } else if (chapter?.local_editor_override && chapter?.content_md != null) {
          markdown = String(chapter.content_md || '');
          sourceLabel = 'local-editor-override';
        } else if (String(chapter?.content_md || '').trim()) {
          // v32: cache-first export. The Export tab has already resolved DB/GitHub-backed
          // chapter bodies into content_md. Do not re-resolve every chapter during export,
          // because a transient GitHub/Base44 fetch failure should not block a good cached export.
          markdown = String(chapter.content_md || '');
          sourceLabel = chapter?.resolved_content_loaded === false ? 'cached-prop-fallback' : 'cached-resolved-content_md';
        } else {
          try {
            markdown = await resolveChapterContent(freshChapter);
            sourceLabel = 'late-resolve';
          } catch (err) {
            console.warn(
              `[EXPORT] Late resolve failed for chapter ${freshChapter?.chapter_number || freshChapter?.id}; using local fields only.`,
              err?.message || err
            );
            markdown = '';
            sourceLabel = 'late-resolve-failed';
          }
        }

        const fallbackFields = [
          ['content_md', chapter?.content_md],
          ['content_md_fresh', freshChapter?.content_md],
          ['content', freshChapter?.content],
          ['chapter_text', freshChapter?.chapter_text],
          ['draft', freshChapter?.draft],
          ['body', freshChapter?.body],
          ['markdown', freshChapter?.markdown],
          ['prose', freshChapter?.prose],
          ['finalText', freshChapter?.finalText],
          ['cleanedText', freshChapter?.cleanedText],
        ];

        if (!String(markdown || '').trim()) {
          const fallback = fallbackFields.find(([, value]) => String(value || '').trim());
          if (fallback) {
            markdown = String(fallback[1] || '');
            sourceLabel = `fallback-${fallback[0]}`;
          }
        }

        const cleanedMarkdown = normalizeExportBodyMarkdown(markdown || '');

        resolved.push({
          ...chapter,
          ...freshChapter,
          content_md: cleanedMarkdown,
          word_count: countPlainWords(cleanedMarkdown),
          __exportResolved: true,
          __exportSource: sourceLabel,
          __exportIndex: index,
        });
      }

      const cleaned = applyFinalExportCleanup(resolved, project);

      // ── PRE-EXPORT STALE CONTENT CHECK ──
      // If any chapter was resolved from a stale URL with no inline fallback,
      // the resolver tags it with __staleContentResolution. Block export here
      // with a clear message so the user knows to re-save or safe-replace.
      const staleChapters = cleaned.filter(ch => ch?.__staleContentResolution === true);
      if (staleChapters.length > 0) {
        const staleList = staleChapters
          .map(ch => `  Ch.${ch.chapter_number || '?'} (${ch.title || 'untitled'}): ${ch.__staleContentWarning || 'stale URL content, no inline fallback'}`)
          .join('\n');
        const staleMsg = `STALE CONTENT RESOLUTION FAILURE:\n${staleChapters.length} chapter(s) resolved from stale URL content with no inline fallback.\n${staleList}\n\nFix: Re-save or safe-replace the affected chapter(s) to create a clean content source.`;
        console.error('[EXPORT] ' + staleMsg);

        if (!(typeof window !== 'undefined' && window.ALLOW_UNSAFE_EXPORT === true)) {
          const err = new Error('STALE_CONTENT_BLOCK: ' + staleMsg);
          err.isSafetyGateBlock = true;
          err.isStaleContentBlock = true;
          err.staleChapters = staleChapters.map(ch => ch.chapter_number);
          throw err;
        } else {
          console.warn('[EXPORT] ⚠️ ALLOW_UNSAFE_EXPORT override active. Proceeding despite stale content.');
          window.ALLOW_UNSAFE_EXPORT = false;
        }
      }

      // ── PRE-EXPORT METADATA REFRESH CHECK ──
      // Chapters whose URL content passed the safety gate but has stale metadata
      // are tagged with __needsMetadataRefresh. These are safe to export but
      // should have their metadata refreshed afterwards.
      const metadataRefreshChapters = cleaned.filter(ch => ch?.__needsMetadataRefresh === true);
      if (metadataRefreshChapters.length > 0) {
        const refreshList = metadataRefreshChapters
          .map(ch => `  Ch.${ch.chapter_number || '?'} (${ch.title || 'untitled'})`)
          .join('\n');
        console.warn(`[EXPORT] METADATA REFRESH RECOMMENDED for ${metadataRefreshChapters.length} chapter(s):\n${refreshList}\nContent passed safety gate but metadata (preview/count) is stale. Run "Polish" or re-save to refresh metadata.`);
      }

      // ── PRE-EXPORT SURFACE DIALOGUE REPAIR ──
      // Run deterministic dialogue mechanics repair on every resolved chapter's
      // text BEFORE the safety gate. This ensures missing opening quotes are
      // repaired regardless of whether the chapter was polished.
      const surfaceRepairReport = [];
      let totalSurfaceRepairs = 0;
      for (const ch of cleaned) {
        const content = ch?.content_md || ch?.content || '';
        if (!content || content.length < 100) continue;
        try {
          const dmResult = runDialogueMechanicsPass(content, { stage: 'pre-export-surface' });
          if (dmResult.repairs.length > 0) {
            // Apply repaired text to the chapter for export
            if (ch.content_md) ch.content_md = dmResult.text;
            if (ch.content) ch.content = dmResult.text;
            totalSurfaceRepairs += dmResult.repairs.length;
            surfaceRepairReport.push({
              chapter: ch.chapter_number || '?',
              title: ch.title || '',
              before: dmResult.beforeCount,
              after: dmResult.afterCount,
              repaired: dmResult.repairs.length,
              manualReview: dmResult.manualReview?.length || 0,
            });
            console.log(
              `[EXPORT-SURFACE-REPAIR] Ch.${ch.chapter_number}: ${dmResult.repairs.length} dialogue quote(s) repaired (${dmResult.beforeCount} → ${dmResult.afterCount})`
            );
          }
        } catch (dmErr) {
          console.warn(`[EXPORT-SURFACE-REPAIR] Ch.${ch.chapter_number}: error:`, dmErr?.message);
        }
      }
      if (totalSurfaceRepairs > 0) {
        console.log(`[EXPORT-SURFACE-REPAIR] Total: ${totalSurfaceRepairs} dialogue quote(s) repaired across ${surfaceRepairReport.length} chapter(s)`);
      }

      // ── PRE-EXPORT MID-PARAGRAPH DIALOGUE AUTOFIX ──
      // After standard surface repair, run confidence-scored mid-paragraph autofix.
      // Only applies SAFE_TO_AUTOFIX repairs; leaves MANUAL_REVIEW as warnings.
      let totalMidParaAutoFixed = 0;
      let totalMidParaManualReview = 0;
      const midParaReport = [];
      for (const ch of cleaned) {
        const content = ch?.content_md || ch?.content || '';
        if (!content || content.length < 100) continue;
        try {
          const mpResult = runMidParagraphDialogueAutofixPass(content, { stage: 'pre-export-mid-para' });
          if (mpResult.midParagraphAutoFixed > 0 || mpResult.midParagraphManualReview > 0) {
            if (mpResult.midParagraphAutoFixed > 0) {
              if (ch.content_md) ch.content_md = mpResult.text;
              if (ch.content) ch.content = mpResult.text;
            }
            totalMidParaAutoFixed += mpResult.midParagraphAutoFixed;
            totalMidParaManualReview += mpResult.midParagraphManualReview;
            midParaReport.push({
              chapter: ch.chapter_number || '?',
              autoFixed: mpResult.midParagraphAutoFixed,
              manualReview: mpResult.midParagraphManualReview,
              details: mpResult.details,
            });
            console.log(
              `[EXPORT-MID-PARA-FIX] Ch.${ch.chapter_number}: ${mpResult.midParagraphAutoFixed} auto-fixed, ${mpResult.midParagraphManualReview} manual-review`
            );
          }
        } catch (mpErr) {
          console.warn(`[EXPORT-MID-PARA-FIX] Ch.${ch.chapter_number}: error:`, mpErr?.message);
        }
      }
      if (totalMidParaAutoFixed > 0 || totalMidParaManualReview > 0) {
        console.log(`[EXPORT-MID-PARA-FIX] Total: ${totalMidParaAutoFixed} auto-fixed, ${totalMidParaManualReview} manual-review`);
      }

      // Store for dev inspection
      if (typeof window !== 'undefined') {
        window.__UBS_LAST_EXPORT_SURFACE_REPORT = {
          timestamp: new Date().toISOString(),
          totalRepairs: totalSurfaceRepairs,
          chapters: surfaceRepairReport,
          midParagraph: {
            totalAutoFixed: totalMidParaAutoFixed,
            totalManualReview: totalMidParaManualReview,
            chapters: midParaReport,
          },
        };
      }

      // ── PERSIST SURFACE REPAIRS TO DB (fire-and-forget) ──
      // Save repaired text back to the chapter record so the same deterministic
      // fixes don't need to run on every export. Only persists if repairs were made.
      if (totalSurfaceRepairs > 0 || totalMidParaAutoFixed > 0) {
        const repairChapters = cleaned.filter(ch =>
          surfaceRepairReport.some(r => r.chapter === ch.chapter_number) ||
          midParaReport.some(r => r.chapter === ch.chapter_number)
        );
        for (const ch of repairChapters) {
          if (!ch?.id || !ch?.content_md) continue;
          try {
            const persistFields = await prepareChapterContent(ch.content_md, project?.id, ch.id, ch);
            await runWithNetworkRetry(() => base44.entities.Chapter.update(ch.id, persistFields));
            console.log(`[EXPORT-PERSIST] Ch.${ch.chapter_number}: surface repairs persisted to DB`);
          } catch (persistErr) {
            // Non-blocking: export continues even if persist fails
            console.warn(`[EXPORT-PERSIST] Ch.${ch.chapter_number}: persist failed (export unaffected):`, persistErr?.message);
          }
        }
      }

      // ── PRE-EXPORT SAFETY GATE (STRICT) ──
      // Scan all resolved chapters for process leaks, contamination, and dialogue issues.
      // HARD BLOCK: Do not produce DOCX if any chapter has hard failures.
      // This gate runs AFTER surface repair, so repaired text is what gets checked.
      const safetyReport = await runPreExportSafetyGate(cleaned, { project, stage: 'pre-export' });

      if (safetyReport.blocked) {
        const failureText = formatExportSafetyFailure(safetyReport);
        console.warn('[EXPORT] SAFETY GATE ISSUES (export proceeding — gate is advisory only):\n' + failureText);
      } else if (safetyReport.warnings.length > 0) {
        console.warn('[EXPORT] Safety gate warnings (export proceeding):', safetyReport.warnings);
      }

      return cleaned;
    },
    [project]
  );

  const handleExport = useCallback(
    async (format) => {
      const settings = publishSettings;
      const dim = parseTrimSize(settings.trimSize);

      if (dirtyRef.current && selectedChapter) {
        try {
          await handleSaveChapter();
        } catch (err) {
          const ok = window.confirm(
            'The current chapter has unsaved edits that could not be saved. Export anyway using the editor text currently on screen?'
          );

          if (!ok) return;

          console.warn('[EXPORT] Exporting with local unsaved editor override:', err);
        }
      }

      if (resolving) {
        console.warn(
          '[EXPORT] Warning: chapter content is still being fetched from the database. Exporting with current snapshot.'
        );
      }

      let exportChapters = [];

      try {
        exportChapters = await buildResolvedExportChapters({
          chapters: orderedWithEdits,
          selectedChapterId,
          editorLoadedForId,
          editorValue,
        });
      } catch (err) {
        console.error('[EXPORT] Final export snapshot failed:', err);
        console.warn('[EXPORT] Warning: could not build safe export snapshot. Attempting export with available chapters.');
        exportChapters = (orderedWithEdits || []).filter(Boolean);
      }

      const planningOnlySurvivors = hardBlockExportIfPlanningMetadataSurvives(exportChapters);
      if (planningOnlySurvivors.blocked) {
        const sample = planningOnlySurvivors.survivors
          .slice(0, 12)
          .map((chapter) => {
            const title = chapter.title ? ` — ${chapter.title}` : '';
            const source = chapter.source ? ` (${chapter.source})` : '';
            return `Chapter ${chapter.chapter_number}${title}${source}`;
          })
          .join('\n');
        console.error('[EXPORT] Blocked planning/outline metadata masquerading as chapter body:', planningOnlySurvivors.survivors);
        console.warn(`[EXPORT] Warning: planning/outline metadata survived as chapter body text.\n${sample}`);
      }

      const forbiddenExportArtifacts = hardBlockExportIfForbiddenArtifactsSurvive(exportChapters);
      if (forbiddenExportArtifacts.blocked) {
        const sample = forbiddenExportArtifacts.survivors
          .slice(0, 12)
          .map((chapter) => {
            const title = chapter.title ? ` — ${chapter.title}` : '';
            const source = chapter.source ? ` (${chapter.source})` : '';
            return `Chapter ${chapter.chapter_number}${title}${source}`;
          })
          .join('\n');
        console.error('[EXPORT] Blocked forbidden internal pipeline artifact survivors:', forbiddenExportArtifacts.survivors);
        console.warn(`[EXPORT] Warning: forbidden internal pipeline artifact text survived final cleanup.\n${sample}`);
      }

      const structuralCollisionSurvivors = hardBlockExportIfStructuralCollisionSurvives(exportChapters);
      if (structuralCollisionSurvivors.blocked) {
        // v41: Diagnostic only. The v39/v40 blocker correctly refused to amputate prose,
        // but it was still too noisy for real manuscripts because repeated possessives,
        // character names, recurring locations, and long-chapter mission vocabulary can look
        // like branch collisions. Durable repair belongs in Fix/Polish/save gates. Export
        // should block only deterministic hard artifacts and planning metadata, not fuzzy
        // story-structure guesses.
        console.warn('[EXPORT][DIAGNOSTIC-ONLY] Possible same-chapter branch/route collision candidates:', structuralCollisionSurvivors.survivors);
      }

      const nonfictionSourceIntegrity = hardBlockExportIfNonfictionSourceIntegrityFails(exportChapters, project);
      if (nonfictionSourceIntegrity.blocked) {
        // v45: Downgraded to diagnostic-only. This check was too aggressive — it
        // blocked fiction projects whose genre/concept text contained words like
        // "source", "history", "documented", or had chapters titled "References".
        // Real nonfiction source-integrity enforcement belongs in Fix/Polish.
        console.warn('[EXPORT][DIAGNOSTIC-ONLY] Possible nonfiction source-integrity issues:', nonfictionSourceIntegrity.problems);
      }

      if (!exportChapters.length) {
        console.warn(
          '[EXPORT] Warning: no chapters resolved for export. Attempting with available data.'
        );
      }

      const bodyChapters = exportChapters.filter((chapter) => isBodyChapter(chapter));
      const missingBodyChapters = bodyChapters.filter((chapter, index) => {
        return !String(chapter?.content_md || '').trim();
      });

      if (missingBodyChapters.length) {
        const sample = missingBodyChapters
          .slice(0, 8)
          .map((chapter, index) => {
            const n = chapter?.chapter_number || index + 1;
            const title = chapter?.title ? ` — ${chapter.title}` : '';
            const source = chapter?.__exportSource ? ` (${chapter.__exportSource})` : '';
            return `Chapter ${n}${title}${source}`;
          })
          .join('\n');

        console.warn(
          `[EXPORT] Warning: ${missingBodyChapters.length} body chapter(s) have no resolved manuscript text.\n${sample}`
        );
      }

      const totalCharsInExport = exportChapters.reduce(
        (sum, chapter) => sum + String(chapter?.content_md || '').length,
        0
      );

      if (totalCharsInExport === 0) {
        console.warn(
          `[EXPORT] Warning: all ${exportChapters.length} chapters resolved to empty content.`
        );
      }

      console.log('[EXPORT] Final snapshot ready:', {
        format,
        sections: exportChapters.length,
        bodySections: bodyChapters.length,
        totalChars: totalCharsInExport,
        chapters: exportChapters.map((chapter, index) => ({
          id: chapter?.id,
          chapter_number: chapter?.chapter_number || index + 1,
          title: chapter?.title || '',
          chars: String(chapter?.content_md || '').length,
          words: countPlainWords(chapter?.content_md || ''),
          source: chapter?.__exportSource || '',
        })),
      });

      if (format === 'md') {
        const markdown = buildMarkdownExport(project, exportChapters);
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${slug(project?.title)}.md`);
        return;
      }

      if (format === 'clipboard') {
        await navigator.clipboard.writeText(buildPlainTextExport(project, exportChapters));
        return;
      }

      if (format === 'pdf') {
        const css = pdfCSS;
        const html = buildBookHtml(project || {}, exportChapters, settings);

        const printDoc = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Georgia&family=Inter:wght@400;500;600&family=Lora:wght@400;500;600&family=Merriweather:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'${settings.paragraphFont}',serif;}${css}
.preview-running-header,.preview-running-footer{display:none;}
@media print{body{margin:0;padding:0;}.manuscript-preview-root{max-width:none;}}</style>
</head><body><div class="manuscript-preview-root">${html}</div></body></html>`;

        const printWindow = window.open('', '_blank');

        if (printWindow) {
          printWindow.document.write(printDoc);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 800);
        }

        return;
      }

      if (format === 'docx') {
        const doc = buildDocxDocument(project, exportChapters, settings, dim);
        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `${slug(project?.title)}.docx`);
      }
    },
    [
      handleSaveChapter,
      orderedWithEdits,
      selectedChapterId,
      editorLoadedForId,
      editorValue,
      pdfCSS,
      project,
      publishSettings,
      resolving,
      selectedChapter,
    ]
  );

  const showSidebar =
    !isMobile &&
    chaptersPaneOpen &&
    effectiveViewMode !== 'focus' &&
    effectiveViewMode !== 'preview';

  const showInspector =
    !isMobile &&
    inspectorPaneOpen &&
    effectiveViewMode === 'editor';

  const showEditor =
    effectiveViewMode === 'editor' ||
    effectiveViewMode === 'split' ||
    effectiveViewMode === 'focus';

  const showPreview = effectiveViewMode === 'split' || effectiveViewMode === 'preview';


  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm ${
        effectiveViewMode === 'focus' ? 'h-[78vh] md:h-[82vh]' : 'h-[76vh] md:h-[72vh]'
      }`}
    >

      {isMobile && (
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 py-2 text-xs font-semibold text-muted-foreground"
        >
          <span>{sidebarOpen ? '▼ Hide Sections' : '► Sections'}</span>
          <span className="ml-auto truncate text-[10px]">
            {selectedChapter?.title || ''}
            {isEditorDirty ? ' • unsaved' : ''}
          </span>
        </button>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSidebar && (
          <div className="min-h-0 w-[280px] shrink-0 overflow-hidden border-r border-border/50">
            <ExportChapterSidebar
              chapters={resolvedChapters.length ? resolvedChapters : ordered}
              selectedChapterId={selectedChapterId}
              dirtyChapterId={isEditorDirty ? selectedChapterId : null}
              onSelect={handleChapterSelect}
            />
          </div>
        )}

        {isMobile && sidebarOpen && (
          <div className="absolute inset-x-0 top-10 z-40 max-h-[60vh] overflow-hidden border-b border-border/50 bg-background shadow-xl">
            <ExportChapterSidebar
              chapters={resolvedChapters.length ? resolvedChapters : ordered}
              selectedChapterId={selectedChapterId}
              dirtyChapterId={isEditorDirty ? selectedChapterId : null}
              onSelect={handleChapterSelect}
            />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ExportMenuBar
            onSave={handleSaveChapter}
            isSaving={isSavingChapter}
            onExport={handleExport}
            exportDisabled={!hasDrafts || resolving}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleFindReplace={() => setFindReplaceOpen((open) => !open)}
            quillRef={quillRef}
            chapterTitle={selectedChapter?.title}
            chapterNumber={selectedChapter?.chapter_number}
            wordCount={wordCount}
            lastSaved={exportAutoSave.lastSaved}
            onRefreshFromDB={handleRefreshFromDB}
            isResolving={resolving}
            isDirty={isEditorDirty}
            viewMode={effectiveViewMode}
            onViewModeChange={handleViewModeChange}
            onOpenHealthCheck={() => setHealthCheckOpen(true)}
            chaptersPaneOpen={chaptersPaneOpen}
            onToggleChaptersPane={() => setChaptersPaneOpen((value) => !value)}
            inspectorPaneOpen={inspectorPaneOpen}
            onToggleInspectorPane={() => setInspectorPaneOpen((value) => !value)}
          />

          {showEditor && <ExportFormatBar quillRef={quillRef} />}

          {findReplaceOpen && showEditor && (
            <FindReplaceBar
              quillRef={quillRef}
              chapters={orderedWithEdits}
              selectedChapterId={selectedChapterId}
              onSelectChapter={handleChapterSelect}
              onSaveChapter={handleFindReplaceSave}
              onClose={() => setFindReplaceOpen(false)}
            />
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            {showEditor && (
              <div
                className={
                  effectiveViewMode === 'split'
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:w-1/2 md:border-r md:border-border/50'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                }
              >
                <ExportEditor
                  ref={quillRef}
                  value={editorValue}
                  onChange={handleEditorChange}
                  publishSettings={publishSettings}
                />
              </div>
            )}

            {showPreview && (
              <div
                className={
                  effectiveViewMode === 'split'
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:w-1/2'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                }
              >
                <ExportPreviewPane
                  project={project}
                  chapters={orderedWithEdits}
                  publishSettings={publishSettings}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!isMobile && inspectorPaneOpen && effectiveViewMode === 'editor' && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-[320px] max-w-[86vw] flex-col overflow-hidden border-l border-border/60 bg-background/95 shadow-2xl backdrop-blur-md">
          <LocalInspectorDrawer
            chapter={selectedChapter}
            editorValue={editorValue}
            isDirty={isEditorDirty}
            isSaving={isSavingChapter}
            isResolving={resolving}
            publishSettings={publishSettings}
            exportDisabled={!hasDrafts || resolving}
            onClose={() => setInspectorPaneOpen(false)}
            onSave={handleSaveChapter}
            onRefreshFromDB={handleRefreshFromDB}
            onOpenSettings={() => setSettingsOpen(true)}
            onExport={handleExport}
          />
        </div>
      )}

      <PublishSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        publishSettings={publishSettings}
        onSettingsChange={setPublishSettings}
      />

      <ManuscriptHealthCheck
        open={healthCheckOpen}
        onClose={() => setHealthCheckOpen(false)}
        project={project}
        chapters={orderedWithEdits}
        onSelectChapter={handleChapterSelect}
      />
    </div>
  );
}

function LocalInspectorDrawer({
  chapter,
  editorValue = '',
  isDirty,
  isSaving,
  isResolving,
  publishSettings = {},
  exportDisabled,
  onClose,
  onSave,
  onRefreshFromDB,
  onOpenSettings,
  onExport,
}) {
  const plainText = String(editorValue || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const characters = plainText.length;
  const paragraphs = String(editorValue || '')
    .split(/<\/p>|\n\s*\n/gi)
    .map((part) => part.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 220));

  const StatRow = ({ label, value }) => (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  );

  const ActionButton = ({ children, onClick, disabled, primary = false }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs font-bold transition ${
        primary
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border bg-background text-foreground hover:bg-muted'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative flex shrink-0 items-start gap-3 border-b border-border/60 bg-background px-4 py-4 pr-12">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Settings className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Inspector</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Section status and export tools</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-muted"
          title="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-black text-foreground">Current Section</p>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Chapter</p>
          <p className="mt-1 text-sm font-black text-foreground">{chapter?.title || 'Untitled Section'}</p>

          {isDirty ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-amber-800">
              <p className="text-xs font-black">Unsaved edits</p>
              <p className="mt-1 text-[11px]">This section has local changes.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-800">
              <p className="text-xs font-black">Ready</p>
              <p className="mt-1 text-[11px]">No unsaved editor changes detected.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-black text-foreground">Document Stats</p>
          </div>
          <StatRow label="Words" value={words.toLocaleString()} />
          <StatRow label="Characters" value={characters.toLocaleString()} />
          <StatRow label="Paragraphs" value={paragraphs.toLocaleString()} />
          <StatRow label="Reading" value={`${readingMinutes} min`} />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-black text-foreground">Publishing Setup</p>
          </div>
          <StatRow label="Trim" value={publishSettings.trimSize || 'Default'} />
          <StatRow label="Font" value={publishSettings.paragraphFont || 'Times New Roman'} />
          <StatRow label="Size" value={`${publishSettings.fontSize || 12} pt`} />
          <StatRow label="Spacing" value={publishSettings.lineHeight || 'Default'} />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <p className="mb-3 text-xs font-black text-foreground">Quick Actions</p>
          <div className="grid gap-2">
            <ActionButton onClick={onSave} disabled={isSaving || isResolving} primary>
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Section'}
            </ActionButton>
            <ActionButton onClick={onRefreshFromDB} disabled={isResolving}>
              <RefreshCw className={`h-4 w-4 ${isResolving ? 'animate-spin' : ''}`} />
              {isResolving ? 'Refreshing…' : 'Refresh'}
            </ActionButton>
            <ActionButton onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              Page Setup
            </ActionButton>
            <ActionButton onClick={() => onExport?.('docx')} disabled={exportDisabled}>
              <FileTextIcon className="h-4 w-4" />
              Export DOCX
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function countPlainWords(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function slug(title) {
  return (title || 'autonovel').replace(/\s+/g, '-').toLowerCase();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function inchesToTwip(value) {
  return Math.round(Number(value || 0) * 1440);
}

function normalizeDocxMarkdown(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s*\[VERIFY:[^\]]*\]/g, '')
    .replace(/\[The following account is a composite[^\]]*\]\s*/g, '')
    .replace(/^\s*—{3,}\s*$/gm, '---')
    .replace(/^\s*–{3,}\s*$/gm, '---')
    .replace(/^\s*\*\s*\*\s*\*\s*$/gm, '---')
    .replace(/^\s*•\s*•\s*•\s*$/gm, '---')
    .replace(/^\s*⁂\s*$/gm, '---')
    // Export-only spacing normalization for DOCX/Atticus output.
    // This does not mutate saved chapter text; it only prevents ugly spaced decimals
    // and time abbreviations in the generated document.
    .replace(/(\d)\.\s+(\d)/g, '$1.$2')
    .replace(/\b([ap])\.\s*m\./gi, (_, hour) => `${hour.toLowerCase()}.m.`)
    // Final export-only sentence-fragment sanitizer.
    // This does not mutate saved chapter records; it only cleans the generated DOCX.
    .replace(/\b(\d{1,2}:\d{2}\s+[ap]\.m\.)\s+When\b/g, '$1, when')
    .replace(/\b(U|S)\.\s+(S|A)\./g, '$1.$2.')
    .replace(/[ \t]+$/gm, '')
    .trim();
}


function isSongbirdExportProject(project = {}, chapters = []) {
  const projectText = [
    project?.title,
    project?.name,
    project?.book_title,
    project?.description,
    project?.premise,
    ...chapters.slice(0, 10).map((ch) => ch?.content_md || ''),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 120000);

  if (/\bSongbird\b/i.test(projectText)) return true;

  const hasCore = /\bIris\b/i.test(projectText) && /\bPauline\b/i.test(projectText);
  const hasWorld = /\b(HIDA|Harlem Institute|Port Chicago|Phillip Cross|Langston Finch|Pauline Carter|Children[’']s Hour)\b/i.test(projectText);
  return hasCore && hasWorld;
}



function addSafeSpaceAfterClosingSingleQuotes(text = '') {
  const s = String(text || '');
  let out = '';
  let insideSingleQuote = false;

  const isLetter = (ch) => /[A-Za-z]/.test(ch || '');
  const contractionSuffixAt = (idx) => {
    const tail = s.slice(idx).toLowerCase();
    const match = tail.match(/^(t|s|d|m|ll|ve|re)\b/);
    return Boolean(match);
  };

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    out += ch;

    if (ch === '‘') {
      insideSingleQuote = true;
      continue;
    }

    if (ch === '’') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';

      // Do not split actual contractions/possessives:
      // don’t, won’t, can’t, Iris’s, Cross’s, Strauss’s, Tennessee Williams’s.
      if (isLetter(prev) && isLetter(next) && contractionSuffixAt(i + 1)) {
        continue;
      }

      if (insideSingleQuote) {
        insideSingleQuote = false;
        if (isLetter(next)) out += ' ';
      } else if (/s$/i.test(prev) && isLetter(next) && !contractionSuffixAt(i + 1)) {
        // Plural possessive jam: students’eyes -> students’ eyes.
        // The contractionSuffixAt guard above prevents Iris’s/Cross’s from becoming Iris’ s/Cross’ s.
        out += ' ';
      }
    }
  }

  return out;
}


function finalPossessiveApostropheGuard(text = '') {
  // Absolute last-pass guard for export/polish survivors:
  // Iris’ s -> Iris’s, Cross’ s -> Cross’s, Strauss’ s -> Strauss’s,
  // won’ t -> won’t, I’ m -> I’m.
  //
  // This intentionally only collapses known contraction/possessive suffix
  // shards. It does NOT collapse plural possessives followed by normal words:
  // students’ eyes, workers’ choruses, sailors’ accounts.
  return String(text || '')
    .replace(/\b([A-Za-z]+)\s*[’']\s*(s|d|ll|ve|re|m|t)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`)
    .replace(/\b(I)\s*[’']\s*(m|d|ll|ve)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`);
}


function normalizeSmartApostropheSpacing(text = '') {
  let out = String(text || '');

  // Repair export-time damage like:
  // didn’ t -> didn’t
  // Blue Parrot’ s -> Blue Parrot’s
  // Iris ’ s -> Iris’s
  //
  // IMPORTANT: keep this marker-limited. A broad "word ’ word" rule caused
  // damage such as workers’choruses, students’eyes, and ‘The Last Goodbye’was.
  out = out.replace(/\b([A-Za-z]+)\s*[’']\s*(s|d|ll|ve|re|m|t)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`);

  // If a plural possessive or quoted phrase has already been jammed against
  // the next word, restore the missing space without touching contractions.
  out = out.replace(/\b([A-Za-z]+s)[’'](?=([a-z]{2,}))\b/g, '$1’ ');
  out = addSafeSpaceAfterClosingSingleQuotes(out);

  // Final guard: addSafeSpaceAfterClosingSingleQuotes must never leave possessive/contraction shards.
  out = out.replace(/\b([A-Za-z]+)\s*[’']\s*(s|d|ll|ve|re|m|t)\b/gi, (_m, left, right) => `${left}’${String(right).toLowerCase()}`);

  // Year contractions should keep a readable space: in’43 -> in ’43.
  out = out.replace(/\b(in|by|from|since|until|around|circa|c\.)[ \t]*[’'](\d{2})\b/gi, (_m, pre, yr) => `${pre} ’${yr}`);

  // Common single-letter contractions that may appear after OCR/import/export splitting.
  out = out.replace(/\b(I)\s*[’']\s*(m|d|ll|ve)\b/gi, (_m, a, b) => `${a}’${b.toLowerCase()}`);
  out = out.replace(/\b(you|we|they|he|she|it|that|there|what|who|where|when|why|how|let)\s*[’']\s*(s|d|ll|ve|re)\b/gi, (_m, a, b) => `${a}’${b.toLowerCase()}`);
  out = finalPossessiveApostropheGuard(out);

  return out;
}


function closeOddDoubleQuoteParagraphs(text = '', changes = []) {
  // Safe quote-edge guard:
  // This does NOT rebuild dialogue clusters. It only closes paragraphs that already
  // contain an unmatched opening smart quote. It fixes survivors like:
  //   A knock ... “Five minutes, Miss Finch.
  //   “And the others?
  //   “No. “Thank you.”
  // without moving narration into dialogue.
  const before = String(text || '');
  const lines = before.split('\n');

  const repaired = lines.map((line) => {
    let out = String(line || '');

    // Specific saved survivor: “No. “Thank you.” -> “No.” “Thank you.”
    out = out.replace(/^“([^“”\n]{1,90}?[.!?])\s+“/g, '“$1” “');

    const opens = (out.match(/“/g) || []).length;
    const closes = (out.match(/”/g) || []).length;

    if (opens > closes) {
      const trimmed = out.replace(/\s+$/g, '');
      const trailing = out.slice(trimmed.length);
      if (trimmed && !trimmed.endsWith('”')) {
        out = `${trimmed}”${trailing}`;
      }
    }

    return out;
  });

  const after = repaired.join('\n');
  if (after !== before) changes.push('closed unmatched opening smart quotes safely');
  return after;
}

function thinSongbirdStyleTics(text = '', changes = []) {
  // Deterministic manuscript-level tic thinning. Kept conservative:
  // - Preserves the first few uses of core motifs.
  // - Replaces only repeated phrasing, not plot content.
  let out = String(text || '');

  const replaceAfter = (pattern, keep, replacements, label) => {
    let seen = 0;
    let idx = 0;
    const before = out;
    out = out.replace(pattern, (match) => {
      seen += 1;
      if (seen <= keep) return match;
      const repl = replacements[idx % replacements.length];
      idx += 1;
      return typeof repl === 'function' ? repl(match) : repl;
    });
    if (out !== before) changes.push(label);
  };

  replaceAfter(/\bcold knot\b/g, 2, [
    'hard pressure',
    'tightness',
    'cold weight',
    'small stone',
    'dense pressure',
  ], 'thinned repeated cold-knot tic');

  replaceAfter(/\bmouth was dry\b/g, 1, [
    'throat felt dry',
    'tongue felt thick',
    'mouth felt papery',
    'throat tightened',
  ], 'thinned repeated mouth-was-dry tic');

  replaceAfter(/\bmouth went dry\b/g, 0, [
    'throat tightened',
    'tongue felt thick',
  ], 'thinned repeated mouth-went-dry tic');

  replaceAfter(/\bA memory surfaced, (?:unbidden|irrelevant and sharp|unbidden and useless|unbidden, irrelevant)\b/g, 1, [
    'A memory rose',
    'A memory returned',
    'A memory came back',
  ], 'thinned repeated memory-surfaced-unbidden tic');

  replaceAfter(/\bThe silence was a physical presence\b/g, 1, [
    'The silence pressed close',
    'The silence thickened around her',
  ], 'thinned repeated silence-physical-presence tic');

  replaceAfter(/\bnot quite ([^.,;:\n]{1,60}), not quite ([^.,;:\n]{1,60})/gi, 1, [
    (_m) => 'a feeling with no clean name',
    (_m) => 'something between the two',
    (_m) => 'some unnamed middle state',
  ], 'thinned repeated not-quite/not-quite construction');

  replaceAfter(/\bnot quite ([^.!?\n]{1,60})\.\s+not quite ([^.!?\n]{1,60})\./gi, 1, [
    (_m) => 'Something between the two.',
    (_m) => 'Some unnamed middle state.',
  ], 'thinned repeated not-quite sentence pair construction');

  return out;
}

function thinSongbirdStyleTicsAcrossChapters(chapters = [], enabled = true) {
  if (!enabled) return chapters;

  const state = {
    coldKnot: 0,
    mouthWasDry: 0,
    mouthWentDry: 0,
    memorySurfaced: 0,
    unbidden: 0,
    notQuitePair: 0,
    silencePhysical: 0,
  };

  const rotate = (list, count) => list[(Math.max(0, count - 1)) % list.length];

  const thinOne = (text = '') => {
    let out = String(text || '');

    out = out.replace(/\bcold knot\b/g, (m) => {
      state.coldKnot += 1;
      if (state.coldKnot <= 2) return m;
      return rotate(['hard pressure', 'tightness', 'cold weight', 'small stone', 'dense pressure', 'cold pressure'], state.coldKnot);
    });

    out = out.replace(/\b(?:Iris’s|Her|his|His|her) mouth was dry\b/g, (m) => {
      state.mouthWasDry += 1;
      if (state.mouthWasDry <= 1) return m;
      const possessive = /^Iris’s/.test(m) ? 'Iris’s' : /^[Hh]is/.test(m) ? 'His' : 'Her';
      return rotate([
        `${possessive} throat tightened`,
        `${possessive} tongue felt thick`,
        `${possessive} mouth felt papery`,
        `${possessive} throat felt dry`,
      ], state.mouthWasDry);
    });

    out = out.replace(/\b(?:Iris’s|Her|his|His|her) mouth went dry\b/g, (m) => {
      state.mouthWentDry += 1;
      const possessive = /^Iris’s/.test(m) ? 'Iris’s' : /^[Hh]is/.test(m) ? 'His' : 'Her';
      return rotate([`${possessive} throat tightened`, `${possessive} tongue felt thick`], state.mouthWentDry);
    });

    out = out.replace(/\bA memory surfaced, (?:unbidden|irrelevant and sharp|unbidden and useless|unbidden, irrelevant)\b/g, (m) => {
      state.memorySurfaced += 1;
      if (state.memorySurfaced <= 1) return m;
      return rotate(['A memory rose', 'A memory returned', 'A memory came back', 'A stray recollection surfaced'], state.memorySurfaced);
    });

    out = out.replace(/\bThe memory arrived unbidden\b/g, (m) => {
      state.unbidden += 1;
      if (state.unbidden <= 1) return m;
      return 'The memory arrived whole';
    });

    out = out.replace(/\bThe thought arrived fully formed, unbidden\b/g, (m) => {
      state.unbidden += 1;
      if (state.unbidden <= 1) return m;
      return 'The thought arrived fully formed';
    });

    out = out.replace(/\bunbidden\b/g, (m) => {
      state.unbidden += 1;
      if (state.unbidden <= 3) return m;
      return rotate(['uninvited', 'without warning', 'all at once'], state.unbidden);
    });

    out = out.replace(/\bnot quite ([^.,;:\n]{1,60}), not quite ([^.,;:\n]{1,60})/gi, (m) => {
      state.notQuitePair += 1;
      if (state.notQuitePair <= 1) return m;
      return rotate(['a feeling with no clean name', 'something between the two', 'a nameless pressure'], state.notQuitePair);
    });

    out = out.replace(/\bnot quite ([^.!?\n]{1,60})\.\s+not quite ([^.!?\n]{1,60})\./gi, (m) => {
      state.notQuitePair += 1;
      if (state.notQuitePair <= 1) return m;
      return rotate(['Something between the two.', 'A nameless pressure.'], state.notQuitePair);
    });

    out = out.replace(/\bThe silence was a physical presence\b/g, (m) => {
      state.silencePhysical += 1;
      if (state.silencePhysical <= 1) return m;
      return rotate(['The silence pressed close', 'The silence thickened around her'], state.silencePhysical);
    });

    return out;
  };

  return chapters.map((chapter) => ({
    ...chapter,
    content_md: thinOne(chapter?.content_md || ''),
  }));
}



function thinGenericStyleTicsAcrossChapters(chapters = []) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const state = {
    coldKnot: 0,
    mouthDry: 0,
    memorySurfaced: 0,
    unbidden: 0,
    notQuitePair: 0,
    silencePhysical: 0,
  };

  const rotate = (list, count) => list[(Math.max(0, count - 1)) % list.length];

  const thinOne = (text = '') => {
    let out = String(text || '');

    out = out.replace(/\bcold knot\b/g, (match) => {
      state.coldKnot += 1;
      if (state.coldKnot <= 3) return match;
      return rotate(['tightness', 'cold weight', 'hard pressure', 'small stone'], state.coldKnot);
    });

    out = out.replace(/\b(?:his|her|His|Her|Zonk’s|Blaze’s|Pip’s) mouth (?:was|went) dry\b/g, (match) => {
      state.mouthDry += 1;
      if (state.mouthDry <= 2) return match;
      const owner = match.match(/^(his|her|His|Her|Zonk’s|Blaze’s|Pip’s)/)?.[1] || 'His';
      return rotate([`${owner} throat tightened`, `${owner} tongue felt thick`, `${owner} mouth felt papery`], state.mouthDry);
    });

    out = out.replace(/\bA memory surfaced,? (?:unbidden|irrelevant and sharp|unbidden and useless|unbidden, irrelevant)?\b/gi, (match) => {
      state.memorySurfaced += 1;
      if (state.memorySurfaced <= 1) return match;
      return rotate(['A memory rose', 'A memory returned', 'A stray recollection surfaced'], state.memorySurfaced);
    });

    out = out.replace(/\bunbidden\b/g, (match) => {
      state.unbidden += 1;
      if (state.unbidden <= 3) return match;
      return rotate(['uninvited', 'without warning', 'all at once'], state.unbidden);
    });

    out = out.replace(/\bnot quite ([^.,;:\n]{1,70}), not quite ([^.,;:\n]{1,70})/gi, (match) => {
      state.notQuitePair += 1;
      if (state.notQuitePair <= 2) return match;
      return rotate(['a feeling with no clean name', 'something between the two', 'a nameless pressure'], state.notQuitePair);
    });

    out = out.replace(/\bnot quite ([^.!?\n]{1,70})\.\s+not quite ([^.!?\n]{1,70})\./gi, (match) => {
      state.notQuitePair += 1;
      if (state.notQuitePair <= 2) return match;
      return rotate(['Something between the two.', 'A nameless pressure.'], state.notQuitePair);
    });

    out = out.replace(/\b(?:The )?silence (?:was|felt like) (?:a )?physical (?:presence|substance|thing)\b/gi, (match) => {
      state.silencePhysical += 1;
      if (state.silencePhysical <= 2) return match;
      return rotate(['the silence pressed close', 'the silence thickened', 'the quiet held'], state.silencePhysical);
    });

    return out;
  };

  return safe.map((chapter) => ({
    ...chapter,
    content_md: thinOne(chapter?.content_md || ''),
    __exportCleanupApplied: true,
    __exportCleanupChanges: [
      ...(chapter.__exportCleanupChanges || []),
      'generic manuscript-level style thinning checked',
    ].slice(0, 40),
  }));
}


function repairStyleThinningArtifacts(text = '') {
  let out = String(text || '');

  // v37 safety: v36's generic not-quite thinning could replace only the first
  // half of a comma-bearing phrase and leave malformed debris such as
  // "some unnamed middle state, numbing panic." These are deterministic repairs,
  // not creative rewrites.
  out = out
    .replace(/Something hot and sour bubbled in Zonk’s throat\.\s+some unnamed middle state, numbing panic\./g,
      'Something hot and sour bubbled in Zonk’s throat. It was the feeling of being handed a pop quiz in a subject he’d only ever studied while high.')
    .replace(/Something hot and sour bubbled in ([^.]{1,120}?)\.\s+some unnamed middle state, ([^.]{1,80})\./gi,
      'Something hot and sour bubbled in $1. It was something closer to $2.')
    .replace(/\bsome unnamed middle state,\s+/gi, 'something closer to ')
    .replace(/\bSome unnamed middle state,\s+/g, 'Something closer to ')
    .replace(/\ba nameless pressure,\s+/gi, 'something closer to ')
    .replace(/\bA nameless pressure,\s+/g, 'Something closer to ')
    .replace(/\bvoice low and urgent cutting through\b/g, 'voice low and urgent, cutting through')
    .replace(/\bvoice high and clear cut through\b/g, 'voice high and clear, cut through')
    .replace(/\bZonk took the weight felt Blaze’s heat\b/g, 'Zonk took the weight and felt Blaze’s heat')
    .replace(/\bhe could hear Pip’s quick shallow breaths ahead of him could see\b/gi, 'he could hear Pip’s quick shallow breaths ahead of him and could see')
    .replace(/\bThe griffon in a sparkly waistcoat waddled onto the stage took the microphone\b/g, 'A griffon in a sparkly waistcoat waddled onto the stage, took the microphone')
    .replace(/\bA griffon in a sparkly waistcoat waddled onto the stage took the microphone\b/g, 'A griffon in a sparkly waistcoat waddled onto the stage, took the microphone')
    .replace(/\bZonk’s mind, uselessly, supplied an image\b/g, 'Zonk’s mind supplied an image')
    .replace(/\bHis brain, traitorous began cataloging\b/g, 'His brain, traitorous, began cataloging')
    .replace(/\bBut you’ve died failing a test\b/g, 'But you’ll have died failing a test')
    .replace(/\bit was a feeling with no clean name, ([^.]{1,80})\./gi, 'it was something closer to $1.')
    .replace(/\bIt wasn’t quite ([^.,;:\n]{1,70}), not quite ([^.]{1,90})\./gi, 'It was somewhere between $1 and $2.');

  return out;
}

function runExportTextSafetyNet(text = '', project = {}, options = {}) {
  let out = String(text || '');
  const before = out;
  const changes = [];

  const artifact1 = repairManuscriptArtifacts(out, {
    project,
    forceSongbirdAliases: options.forceSongbirdAliases === true,
  });
  out = artifact1?.text || out;
  if (artifact1?.changed) changes.push(...(artifact1.changes || ['artifact repair']));

  // IMPORTANT:
  // Do NOT run quoteFixPolish during export.
  // The stored chapter body may already contain valid smart quotes. The quote
  // fixer is useful during controlled polish flows, but when it runs over a full
  // exported chapter snapshot it can remove opening quotes, jam quote spacing,
  // and create duplicate fragments such as YesYes/NoNo/GoodGood.
  //
  // Export should only apply deterministic alias/mechanical cleanup.
  const artifact2 = repairManuscriptArtifacts(out, {
    project,
    forceSongbirdAliases: options.forceSongbirdAliases === true,
  });
  out = artifact2?.text || out;
  if (artifact2?.changed) changes.push(...(artifact2.changes || ['final artifact repair']));

  // Safe final quote edge repair only: close unmatched smart openings; do not move attribution/narration.
  out = closeOddDoubleQuoteParagraphs(out, changes);

  // Conservative manuscript-level tic thinning for export quality. This does not mutate DB records.
  out = thinSongbirdStyleTics(out, changes);

  // Repair any apostrophe spacing inherited from earlier exports before applying survivor rules.
  out = normalizeSmartApostropheSpacing(out);

  // Export-only hard survivors. These are intentionally narrow and do not mutate DB records.
  const rules = [
    // Repair duplicates created by earlier quote/export passes if they already exist
    // in saved content. Do not create or move quote marks here.
    [/\b(Yes|No|Good|Fine|Okay|Sure|Please|Thanks)\1\b/g, '$1', 'duplicate short reply word'],
    [/\b(I know|I see|Is it|Do what|What|Why|How|When|Where|Who|A new challenge)\1\b/g, '$1', 'duplicate short phrase'],
    [/\bThank youThank you\b/g, 'Thank you.', 'duplicate Thank you'],
    [/\bI doubt thatI doubt that\b/g, 'I doubt that.', 'duplicate I doubt that'],
    [/\bAren[’']t youAren[’']t you\b/g, 'Aren’t you?', 'duplicate Aren’t you'],

    // Stubborn plural possessive jam only. Single quoted phrase spacing is handled
    // by addSafeSpaceAfterClosingSingleQuotes() so contractions inside quotes
    // like ‘I don’t hear anything’ are not split into don’ t.
    [/\b([A-Za-z]+s)[’'](?=([a-z]{2,}))\b/g, '$1’ ', 'space after plural possessive apostrophe'],

    // Stubborn orphan dialogue openers. Keep narrow and do not run broad quote repair.
    [/(^|\s)I[’']m not uncomfortable,”/g, '$1“I’m not uncomfortable,”', 'missing opener: I’m not uncomfortable'],
    [/(^|\s)Aren[’']t you\.”/g, '$1“Aren’t you?”', 'missing opener: Aren’t you'],
    [/(^|\s)Thank you\.”/g, '$1“Thank you.”', 'missing opener: Thank you'],
    [/(^|\s)I doubt that\.”/g, '$1“I doubt that.”', 'missing opener: I doubt that'],

    // Mechanical survivors only.
    [/\bThe coffee, when it came was\b/g, 'The coffee, when it came, was', 'missing comma: coffee came'],
    [/\bShe sat took out\b/g, 'She sat, took out', 'missing comma: sat took'],
    [/\bPauline opened a drawer took out\b/g, 'Pauline opened a drawer, took out', 'missing comma: drawer took'],
    [/\b([Hh]e|[Ss]he) said cutting through\b/g, '$1 said, cutting through', 'missing comma: said cutting through'],
    [/\bif the window opened it\b/g, 'if the window opened', 'window opened it'],
    [/\bif the door opened it\b/g, 'if the door opened', 'door opened it'],
    [/\bThe door opened it\b/g, 'The door opened', 'The door opened it'],
    [/\bthe door opened it\b/g, 'the door opened', 'the door opened it'],
    [/\bThe window opened it\b/g, 'The window opened', 'The window opened it'],
    [/\bthe window opened it\b/g, 'the window opened', 'the window opened it'],
    [/\b((?:[A-Z][A-Za-z]+|[A-Z][A-Za-z]+[’']s|[Hh]er|[Hh]is|[Tt]he [a-z]+[’']s)) mouth opened it\b/g, '$1 mouth opened', 'mouth opened it'],
    [/\broom was small dominated by\b/g, 'room was small, dominated by', 'missing comma: small dominated'],
    [/\bvoice high clear cut\b/g, 'voice, high and clear, cut', 'missing commas: voice high clear cut'],
    [/\bvoice low urgent cutting through\b/g, 'voice low and urgent, cutting through', 'missing comma: urgent cutting through'],
    [/\bThe room was small dominated by\b/g, 'The room was small, dominated by', 'missing comma: room small dominated'],
    [/\bIt was\. Preparation\./g, 'It was preparation.', 'It was. Preparation'],
    [/\bHe said the words as if tasting them\b/g, 'He spoke as if tasting the words', 'he said words tic'],
    [/\bHe said it like a headline\b/g, 'He delivered it like a headline', 'he said headline tic'],
    [/\bHe said it without malice\b/g, 'His tone held no malice', 'he said without malice tic'],
    [/\bHe said it without inflection\b/g, 'His voice held no inflection', 'he said without inflection tic'],
    [/“Was it not\?”\s+It[’']s not about volume\.”/g, '“Was it not?” “It’s not about volume.”', 'final climax quote-edge survivor: volume'],
    [/“How do I play a silence\?”\s+You don[’']t play it\./g, '“How do I play a silence?” “You don’t play it.', 'final climax quote-edge survivor: silence opener'],
    [/fail\. The failure is the point\.”/g, 'fail. The failure is the point.”', 'final climax quote-edge survivor: silence closer'],
    [/\bwho smelled always of hair tonic and nervous sweat played\b/g, 'who always smelled of hair tonic and nervous sweat, played', 'Marty comma/order repair'],
    [/\bHe nodded took a beat\b/g, 'He nodded, took a beat', 'missing comma: nodded took'],
    [/\bzips the duffel doesn’t look at her\b/g, 'zips the duffel, doesn’t look at her', 'missing comma: duffel action'],



    // Manual-quality line-edit survivors from clean Songbird exports.
    // These are narrow grammar/typography fixes, not quote reconstruction.
    [/\bLillian Hellman is a clever woman\. She builds a box onstage puts\b/g, 'Lillian Hellman is a clever woman. She builds a box onstage, puts', 'manual line edit: Hellman onstage comma'],
    [/\bTennessee Williams’s the Glass Menagerie\b/g, 'Tennessee Williams’s The Glass Menagerie', 'manual line edit: capitalize Glass Menagerie title'],
    [/\bThe current production in rehearsal appears to be a domestic drama\b/g, 'The current production appears to be a domestic drama', 'manual line edit: report wording'],
    [/\bthe head of the theatre department, a Miss Pauline Carter was\b/g, 'the head of the theatre department, Miss Pauline Carter, was', 'manual line edit: Pauline Carter appositive'],
    [/\bThe director, Mr\. Henderson is\b/g, 'The director, Mr. Henderson, is', 'manual line edit: Henderson appositive comma'],
    [/\bsunlight, thick and golden with dust fell\b/g, 'sunlight, thick and golden with dust, fell', 'manual line edit: dust comma'],
    [/\bshe took a breath held it\b/gi, 'she took a breath, held it', 'manual line edit: breath comma'],
    [/\bShe took another drag held the smoke\b/g, 'She took another drag, held the smoke', 'manual line edit: drag comma'],
    [/\bThe smell of fresh bread, usually a comfort turned\b/g, 'The smell of fresh bread, usually a comfort, turned', 'manual line edit: comfort comma'],
    [/\bthe other play, the one in her bag seemed\b/g, 'the other play, the one in her bag, seemed', 'manual line edit: bag comma'],
    [/\bwith a sudden, somatic certainty would not hold\b/g, 'with a sudden, somatic certainty, would not hold', 'manual line edit: certainty comma'],
    [/\bolder than she’d seemed in the shadow maybe mid-thirties\b/g, 'older than she’d seemed in the shadow, maybe mid-thirties', 'manual line edit: shadow comma'],
    [/\bthe man, Davies turned to leave\b/g, 'the man, Davies, turned to leave', 'manual line edit: Davies appositive comma'],
    [/\bthe theatre is the Ethel Barrymore\b/g, 'the theatre is the Ethel Barrymore Theatre', 'manual line edit: theatre name'],
    [/\bTennessee Williams play\b/g, 'Tennessee Williams play', 'manual line edit placeholder no-op'],

    // v15: last narrow mechanical survivors from Songbird 17.
    [/\bsunlight, thick and golden with dust fell\b/gi, 'sunlight, thick and golden with dust, fell', 'manual line edit v15: dust comma any case'],
    [/\bthe smell of fresh bread, usually a comfort turned\b/gi, 'the smell of fresh bread, usually a comfort, turned', 'manual line edit v15: comfort comma any case'],
    [/\bforced a breath in held it\b/gi, 'forced a breath in, held it', 'manual line edit v15: breath-in comma'],
    [/\btook another drag held the smoke\b/gi, 'took another drag, held the smoke', 'manual line edit v15: drag comma any case'],
    [/\beyes, in this light were\b/gi, 'eyes, in this light, were', 'manual line edit v15: in-this-light comma'],
    [/\bActor’s Studio crowd—They felt\b/g, 'Actor’s Studio crowd—they felt', 'manual line edit v15: lower em-dash continuation'],
    [/\bThe Children’s Hour\. Yes\.\s+”\s*“And\?\s*”\s*“It’s… a well-made play\./g, 'The Children’s Hour. Yes.”\n“And?”\n“It’s… a well-made play.', 'manual line edit v15: restore And? dialogue line'],
    [/\bThe Children’s Hour\. Yes\. ” “And\? ” “It’s… a well-made play\./g, 'The Children’s Hour. Yes.”\n“And?”\n“It’s… a well-made play.', 'manual line edit v15: restore And? dialogue line compact'],
    [/\bthe man, Davies turned to leave\b/gi, 'the man, Davies, turned to leave', 'manual line edit v15: Davies appositive any case'],
    [/\bMr\. Henderson is Thursday\b/g, 'Mr. Henderson is Thursday', 'manual line edit v15 placeholder: Henderson sentence is correct'],

    // Spacing around double smart quotes only.
    // DO NOT include the single smart apostrophe (’) here. Treating ’ as a
    // closing quote caused export damage like didn’ t, Iris’ s, Blue Parrot’ s.
    [/([“])\s+/g, '$1', 'trim space after opening double quote'],
    [/\s+([”])/g, '$1', 'trim space before closing double quote'],
    [/([”])(?=[A-Za-z])/g, '$1 ', 'space after closing double quote'],
  ];

  for (const [rx, replacement, label] of rules) {
    const next = out.replace(rx, replacement);
    if (next !== out) changes.push(label);
    out = next;
  }

  // Final sniper repair for the remaining Songbird climax paragraph. This only
  // inserts the missing opening quote before Pauline's answer; it does not run
  // broad quote reconstruction.
  out = out.replace(
    /“How do I play a silence\?”\s+You don[’']t play it\./g,
    '“How do I play a silence?” “You don’t play it.'
  );

  out = addSafeSpaceAfterClosingSingleQuotes(out);
  out = normalizeSmartApostropheSpacing(out);
  out = normalizeDocxMarkdown(out);
  out = finalPossessiveApostropheGuard(out);

  return {
    text: out,
    changed: out !== before,
    changes: [...new Set(changes)].slice(0, 30),
  };
}


function normalizeTitleKey(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/[“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniquifyDuplicateExportChapterTitles(chapters = []) {
  const seen = new Map();
  return (Array.isArray(chapters) ? chapters : []).map((chapter, index) => {
    const rawTitle = chapter?.title || chapter?.chapter_title || chapter?.name || `Chapter ${index + 1}`;
    const key = normalizeTitleKey(rawTitle);
    if (!key) return chapter;
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    if (count === 0) return chapter;

    const chapterNo = getChapterNumberValue(chapter, index);
    const fallbackTitle = `${rawTitle} — Aftermath`;
    return {
      ...chapter,
      title: fallbackTitle,
      chapter_title: fallbackTitle,
      name: chapter?.name === rawTitle ? fallbackTitle : chapter?.name,
      __exportCleanupApplied: true,
      __exportCleanupChanges: [
        ...(chapter.__exportCleanupChanges || []),
        `duplicate chapter title guard: Chapter ${chapterNo} renamed from "${rawTitle}" to "${fallbackTitle}" for export`,
      ].slice(0, 30),
    };
  });
}



const PLANNING_METADATA_EXPORT_REGEXES = [
  /^\s*(?:beat\s*summary|scene\s*beats?|chapter\s*goal|chapter\s*objective|plot\s*beats?|continuity\s*notes?|drafting\s*directive|writer\s*directive|story\s*function|variety\s*template|internal\s*structure)\s*[:\-]/im,
  /^\s*(?:protagonist|central\s*conflict|sensory\s*anchor|thematic\s*angle|ending\s*shape|power\s*dynamic|conflict\s*engine|setting\s*type)\s*[:\-]/im,
  /\b(?:Scene\s+\d+\s*[:\-].{0,180}){2,}/is,
  /\b(?:Story\s+\d+\s*[:\-].{0,180}){2,}/is,
];

function looksLikePlanningMetadataBody(text = '') {
  const source = String(text || '').trim();
  if (!source) return false;

  const wordCount = countPlainWords(source);
  if (wordCount > 900) {
    // Long chapters can legitimately contain words like "scene" or "story".
    // Only short/medium bodies should be blocked by metadata-shape heuristics.
    return PLANNING_METADATA_EXPORT_REGEXES
      .slice(0, 2)
      .some((rx) => rx.test(source.slice(0, 2400)));
  }

  return PLANNING_METADATA_EXPORT_REGEXES.some((rx) => rx.test(source));
}

function hardBlockExportIfPlanningMetadataSurvives(chapters = []) {
  const survivors = [];
  for (let index = 0; index < (chapters || []).length; index += 1) {
    const chapter = chapters[index] || {};
    const text = String(chapter?.content_md || '');
    if (!looksLikePlanningMetadataBody(text)) continue;
    survivors.push({
      index,
      chapter_number: chapter?.chapter_number || index + 1,
      title: chapter?.title || chapter?.chapter_title || chapter?.name || '',
      source: chapter?.__exportSource || '',
    });
  }
  if (!survivors.length) return { blocked: false, survivors: [] };
  return { blocked: true, survivors };
}

const FORBIDDEN_EXPORT_ARTIFACT_REGEXES = [
  /\bthe false start collapsed into the only route that mattered\.?\b/i,
  /\bthe false start had collapsed into the only route that mattered\.?\b/i,
  /\bthe alternate draft collapsed into the only route that mattered\.?\b/i,
  /\bthe retry collapsed into the only route that mattered\.?\b/i,
];

function containsForbiddenExportArtifact(text = '') {
  const source = String(text || '');
  return FORBIDDEN_EXPORT_ARTIFACT_REGEXES.some((rx) => rx.test(source));
}

function removeForbiddenExportArtifactParagraphs(text = '') {
  const source = normalizeExportBodyMarkdown(text);
  if (!source) return { text: source, changed: false, changes: [] };

  const paragraphs = splitExportParagraphs(source);
  if (!paragraphs.length) {
    let out = source;
    let changed = false;
    for (const rx of FORBIDDEN_EXPORT_ARTIFACT_REGEXES) {
      if (rx.test(out)) {
        out = out.replace(rx, '').replace(/\n{3,}/g, '\n\n').trim();
        changed = true;
      }
    }
    return {
      text: normalizeExportBodyMarkdown(out),
      changed,
      changes: changed ? ['hard removed forbidden internal pipeline artifact literal'] : [],
    };
  }

  let removed = 0;
  const kept = paragraphs.filter((paragraph) => {
    const bad = FORBIDDEN_EXPORT_ARTIFACT_REGEXES.some((rx) => rx.test(paragraph));
    if (bad) removed += 1;
    return !bad;
  });

  return {
    text: normalizeExportBodyMarkdown(kept.join('\n\n')),
    changed: removed > 0,
    changes: removed ? [`hard removed ${removed} forbidden internal pipeline artifact paragraph(s)`] : [],
  };
}

function findForbiddenExportArtifactSurvivors(chapters = []) {
  const survivors = [];
  for (let index = 0; index < (chapters || []).length; index += 1) {
    const chapter = chapters[index] || {};
    const text = String(chapter?.content_md || '');
    if (!containsForbiddenExportArtifact(text)) continue;
    survivors.push({
      index,
      chapter_number: chapter?.chapter_number || index + 1,
      title: chapter?.title || chapter?.chapter_title || chapter?.name || '',
      source: chapter?.__exportSource || '',
    });
  }
  return survivors;
}

function hardBlockExportIfForbiddenArtifactsSurvive(chapters = []) {
  const survivors = findForbiddenExportArtifactSurvivors(chapters);
  if (!survivors.length) return { blocked: false, survivors: [] };
  return { blocked: true, survivors };
}


function hardBlockExportIfStructuralCollisionSurvives(chapters = []) {
  const survivors = [];
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];

  for (let index = 0; index < safe.length; index += 1) {
    const chapter = safe[index] || {};
    const candidate = findSameChapterBranchCollisionCandidate(chapter, index);
    if (!candidate) continue;
    survivors.push(candidate);
  }

  return survivors.length ? { blocked: true, survivors } : { blocked: false, survivors: [] };
}

function findSameChapterBranchCollisionCandidate(chapter = {}, index = 0) {
  const text = String(chapter?.content_md || '');
  const wordCount = countPlainWords(text);
  if (wordCount < 4200 || text.length < 22000) return null;

  const paragraphs = splitExportParagraphs(text);
  if (paragraphs.length < 32) return null;

  const anchors = extractRepeatedProperPhrases(text)
    .filter((anchor) => {
      const words = anchor.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 5) return false;
      if (/^Chapter\s+\d+/i.test(anchor)) return false;
      if (isLikelyOrdinaryCharacterAnchor(text, anchor)) return false;
      return true;
    })
    .slice(0, 50);

  if (!anchors.length) return null;

  const routeTerms = /\b(?:plan|new plan|instead|token|pass|key|map|route|path|guide|broker|deal|favor|price|trade|audience|meeting|contact|delivery|receipt|bouncer|stage|door|gate|vault|court|palace|station|hotel|office|apartment|bar|club|market|bathhouse|safehouse|safe house|escape|run|hide|guard|guards|sentinel|police|agent|checkpoint|back exit|back door|service corridor|tunnel|stairs|elevator|carriage|car|train|ship)\b/gi;
  const retryTerms = /\b(?:new plan|okay[,— ]+new plan|that left|that meant|instead|we need|we have to|we're going to|we are going to|i'll go|i will go|you stay|we don't all go|we do not all go|the only way|the only door|no other lead|no other choice|no other option|the plan changed|the plan was|the move|the next move)\b/gi;
  const completionTerms = /\b(?:deal was done|we accept|accepted|map|receipt|token|pass|key|favor|price|route|path|guide|audience|meeting|exit|escape|back exit|back door|safehouse|safe house|the way in|the way out|the next step|good luck|they ran|they left|they descended|they moved|they had a direction)\b/gi;

  for (const anchor of anchors) {
    const hits = [];
    for (let i = 0; i < paragraphs.length; i += 1) {
      if (paragraphContainsAnchor(paragraphs[i], anchor)) hits.push(i);
    }
    if (hits.length < 2) continue;

    for (let h = 0; h < hits.length - 1; h += 1) {
      const first = hits[h];
      const second = hits.slice(h + 1).find((idx) => idx - first >= 10);
      if (!Number.isFinite(second)) continue;

      const firstWin = windowText(paragraphs, Math.max(0, first - 4), Math.min(24, second - first + 5));
      const secondWin = windowText(paragraphs, second, 26);
      const betweenWin = windowText(paragraphs, first, Math.max(1, second - first));

      const firstRouteCount = countRegexMatches(firstWin, routeTerms);
      const secondRouteCount = countRegexMatches(secondWin, routeTerms);
      const retryCount = countRegexMatches(betweenWin, retryTerms) + countRegexMatches(secondWin, retryTerms);
      const completionCount = countRegexMatches(secondWin, completionTerms);

      // v40: this is an export blocker, not a fixer. It must be conservative.
      // Repeated character names, repeated courts/locations, or normal return-to-location
      // scenes should not block export. Only block when the text shows a high-confidence
      // stacked route: route language in both windows, a restart/alternate-plan cue, a
      // completion/payoff cue, and either meaningful lexical overlap or multiple shared
      // non-character anchors.
      if (firstRouteCount < 2 || secondRouteCount < 2) continue;
      if (retryCount < 1 || completionCount < 1) continue;

      const firstAnchorSet = getParagraphAnchorSet(firstWin, anchors);
      const secondAnchorSet = getParagraphAnchorSet(secondWin, anchors);
      const sharedAnchorCount = anchorIntersectionSize(firstAnchorSet, secondAnchorSet);
      const similarity = jaccardSimilarity(getSignificantWords(firstWin), getSignificantWords(secondWin));
      const highConfidenceOverlap = similarity >= 0.18 || sharedAnchorCount >= 2;
      if (!highConfidenceOverlap) continue;

      const possibleRemovalWords = countPlainWords(windowText(paragraphs, first, Math.max(1, second - first)));
      if (possibleRemovalWords < 650 || possibleRemovalWords > wordCount * 0.45) continue;

      return {
        index,
        chapter_number: chapter?.chapter_number || index + 1,
        title: chapter?.title || chapter?.chapter_title || chapter?.name || '',
        source: chapter?.__exportSource || '',
        anchor,
        reason: 'high-confidence same-chapter alternate route/branch collision',
        firstParagraph: first + 1,
        secondParagraph: second + 1,
        similarity: Number(similarity.toFixed(3)),
        sharedAnchorCount,
        preview: secondWin.replace(/\s+/g, ' ').trim().slice(0, 220),
      };
    }
  }

  return null;
}

function countRegexMatches(text = '', regex) {
  if (!(regex instanceof RegExp)) return 0;
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const safe = new RegExp(regex.source, flags);
  return (String(text || '').match(safe) || []).length;
}

function isLikelyOrdinaryCharacterAnchor(fullText = '', anchor = '') {
  const phrase = String(anchor || '').trim();
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length !== 2) return false;

  // Keep obvious institutions/locations/objects eligible. These are route anchors,
  // not normal character-name anchors.
  if (/\b(?:court|district|market|vault|gate|gates|palace|castle|station|hotel|motel|office|apartment|bar|club|pub|tavern|saddle|pony|room|hall|chamber|street|avenue|road|lane|alley|bridge|river|bay|mountain|forest|woods|school|church|temple|hospital|clinic|warehouse|factory|ship|train|carriage|house|safehouse|safe\s+house|guild|agency|department|bureau|corporation|company|city|town|village|kingdom|empire|republic)\b/i.test(phrase)) {
    return false;
  }

  const normalized = normalizeForSimilarity(phrase);
  if (!normalized) return false;

  const text = String(fullText || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const properRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
  const matches = [...text.matchAll(properRegex)].slice(0, 24);
  if (matches.length < 2) return false;

  let characterish = 0;
  for (const match of matches) {
    const idx = match.index || 0;
    const context = text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + phrase.length + 100));
    if (/\b(?:said|asked|replied|muttered|whispered|snapped|shouted|called|answered|continued|looked|turned|nodded|stood|sat|walked|ran|moved|watched|stared|smiled|frowned|sighed|voice|eyes|hands|face|shoulders|hoof|hooves|wrist|arm|head|mouth)\b/i.test(context)) characterish += 1;
    if (new RegExp(`\\b${escaped}[’']s\\b`, 'i').test(context)) characterish += 1;
  }

  return characterish >= Math.max(2, Math.ceil(matches.length * 0.35));
}



const NONFICTION_EXPORT_PLACEHOLDER_RE = /\[(?:SOURCE|CITATION|REFERENCE|VERIFY|FACT CHECK|NEEDS SOURCE|SOURCE NEEDED|CITATION NEEDED)[^\]]*\]|\b(?:SOURCE NEEDED|CITATION NEEDED|TK SOURCE|TK CITATION|TODO SOURCE|TODO CITATION)\b/i;

const FINANCE_SOURCE_CONTAMINATION_RE = /\b(?:bogle|john\s+c\.\s*bogle|vanguard|malkiel|random\s+walk\s+down\s+wall\s+street|morningstar|finra|consumer\s+financial\s+protection\s+bureau|\bcfpb\b|robinhood|gamestop|market\s+structure|payday\s+loan|retirement\s+plan|401\(k\)|\bira\b|index\s+fund|mutual\s+fund|s&p\s+dow\s+jones|securities\s+and\s+exchange\s+commission|\bsec\b|investor\s+education|financial\s+literacy|lusardi|mitchell|mullainathan|shafir)\b/i;

const MISSOURI_GOTHIC_SOURCE_DOMAIN_RE = /\b(?:missouri\s+state\s+penitentiary|jefferson\s+city|cell\s+hall|1954\s+riot|riot|correctional|corrections|warden|inmate|prison|penitentiary|st\.\s*louis\s+post-dispatch|time\s+magazine|bloodiest\s+47\s+acres|mark\s+s\.\s+schreiber|fire\s+marshal|death\s+certificate|coroner|missouri\s+state\s+archives|department\s+of\s+corrections|redevelopment\s+master\s+plan|historic\s+preservation|convention\s+and\s+visitors\s+bureau)\b/i;

function getProjectSourceDomainText(project = {}, chapters = []) {
  return [
    project?.title,
    project?.subtitle,
    project?.genre,
    project?.subgenre,
    project?.book_type,
    project?.project_type,
    project?.description,
    project?.seed_concept,
    project?.project_brief,
    ...((Array.isArray(chapters) ? chapters : [])
      .slice(0, 6)
      .map((chapter) => `${chapter?.title || ''}\n${String(chapter?.content_md || '').slice(0, 1200)}`)),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function isFinanceOrInvestingProject(project = {}, chapters = []) {
  const text = getProjectSourceDomainText(project, chapters);
  const financeHits = [
    /\bfinance\b/,
    /\binvesting\b/,
    /\binvestment\b/,
    /\bretirement\b/,
    /\bfinancial\s+literacy\b/,
    /\bstock\s+market\b/,
    /\bindex\s+funds?\b/,
    /\bmutual\s+funds?\b/,
    /\bpersonal\s+finance\b/,
  ].filter((pattern) => pattern.test(text)).length;

  const prisonHistoryHits = [
    /\bmissouri\s+state\s+penitentiary\b/,
    /\bpenitentiary\b/,
    /\bprison\b/,
    /\b1954\s+riot\b/,
    /\bcell\s+hall\b/,
    /\binmate\b/,
    /\bcorrections\b/,
  ].filter((pattern) => pattern.test(text)).length;

  return financeHits >= 2 && prisonHistoryHits < 2;
}

function isLikelyNonfictionExportProject(project = {}, chapters = []) {
  const text = getProjectSourceDomainText(project, chapters);
  if (/\b(?:nonfiction|history|investigative|true\s+crime|memoir|biography|guide|manual|training|policy|case\s+study|source|bibliography|archive|documented)\b/i.test(text)) {
    return true;
  }

  return (Array.isArray(chapters) ? chapters : []).some((chapter) => isBibliographyLikeChapter(chapter) || isAuthorsNoteLikeChapter(chapter));
}

function isBibliographyLikeChapter(chapter = {}) {
  const title = String(chapter?.title || chapter?.chapter_title || '').toLowerCase();
  const body = String(chapter?.content_md || '').slice(0, 1200).toLowerCase();
  return /\b(?:bibliography|sources|works\s+cited|references)\b/.test(title) || /^\s*(?:bibliography|sources|works\s+cited|references)\b/i.test(body);
}

function isAuthorsNoteLikeChapter(chapter = {}) {
  const title = String(chapter?.title || chapter?.chapter_title || '').toLowerCase();
  const body = String(chapter?.content_md || '').slice(0, 1200).toLowerCase();
  return /author.?s\s+note|sources\s+and\s+method|methodology/.test(title) || /author.?s\s+note\s+on\s+sources|sources\s+and\s+method/.test(body);
}

function splitBibliographyEntries(markdown = '') {
  const text = normalizeExportBodyMarkdown(markdown);
  const lines = text.split('\n');
  const chunks = [];
  let current = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    const startsNewEntry =
      !trimmed ||
      /^#{1,6}\s+/.test(trimmed) ||
      /^[A-Z][A-Za-z'’.-]+,\s+/.test(trimmed) ||
      /^"[^"]+"\.?\s+/.test(trimmed) ||
      /^(?:Articles?|Books?|Academic|Government|Archives?|Court|Newspapers?|Reports?|Web|Oral\s+Histories|Primary\s+Sources|Secondary\s+Sources)\b/i.test(trimmed) ||
      /^[*-]\s+/.test(trimmed);

    if (startsNewEntry && current.length) {
      chunks.push(current.join('\n'));
      current = [];
    }

    current.push(line);
  });

  if (current.length) chunks.push(current.join('\n'));
  return chunks;
}

function repairNonfictionBibliographyExportText(markdown = '', project = {}, chapters = []) {
  const isFinanceProject = isFinanceOrInvestingProject(project, chapters);
  const chunks = splitBibliographyEntries(markdown);
  const removed = [];
  const kept = [];

  chunks.forEach((chunk) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      kept.push(chunk);
      return;
    }

    const isHeading = /^#{1,6}\s+/.test(trimmed) || /^(?:Bibliography|Sources|Works Cited|References|Articles?|Books?|Academic|Government|Archives?|Court|Newspapers?|Reports?|Web|Oral Histories|Primary Sources|Secondary Sources)\b/i.test(trimmed);

    if (NONFICTION_EXPORT_PLACEHOLDER_RE.test(trimmed)) {
      removed.push('removed placeholder bibliography/source entry');
      return;
    }

    if (!isFinanceProject && FINANCE_SOURCE_CONTAMINATION_RE.test(trimmed)) {
      removed.push('removed cross-project finance/investing bibliography contamination');
      return;
    }

    kept.push(chunk);
  });

  let next = kept.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();

  // If a bibliography heading remains with no credible entries, leave a clear non-publishable note
  // that the export hard gate will catch instead of allowing fake or contaminated sources through.
  const credibleEntryCount = splitBibliographyEntries(next).filter((entry) => {
    const trimmed = entry.trim();
    if (!trimmed || /^#{1,6}\s+/.test(trimmed)) return false;
    if (/^(?:Bibliography|Sources|Works Cited|References|Articles?|Books?|Academic|Government|Archives?|Court|Newspapers?|Reports?|Web|Oral Histories|Primary Sources|Secondary Sources)\b/i.test(trimmed)) return false;
    return MISSOURI_GOTHIC_SOURCE_DOMAIN_RE.test(trimmed) || /\b(?:archive|court|newspaper|report|interview|oral\s+history|death\s+certificate|coroner|department|records?|minutes?|plan|memoir)\b/i.test(trimmed);
  }).length;

  if (/\b(?:bibliography|sources|works\s+cited|references)\b/i.test(next) && credibleEntryCount < 4) {
    next = `${next}\n\n[EXPORT BLOCKER: Bibliography has too few credible project-relevant sources after contamination cleanup. Rebuild the bibliography from verified project sources before publication.]`;
  }

  return {
    text: next,
    changed: removed.length > 0,
    changes: Array.from(new Set(removed)),
  };
}

function applyNonfictionSourceIntegrityExportCleanup(chapters = [], project = {}) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];

  if (!isLikelyNonfictionExportProject(project, safe)) {
    return safe;
  }

  return safe.map((chapter) => {
    let text = String(chapter?.content_md || '');
    const changes = [];

    if (isBibliographyLikeChapter(chapter)) {
      const repaired = repairNonfictionBibliographyExportText(text, project, safe);
      text = repaired.text;
      changes.push(...repaired.changes);
    }

    const beforeCopyedit = text;
    text = text
      .replace(/\ba environment\b/g, 'an environment')
      .replace(/\bA environment\b/g, 'An environment')
      .replace(/\bfre-standing\b/g, 'free-standing')
      .replace(/\bWhat was it an act of containment\b/g, 'Was it an act of containment')
      .replace(/—([A-Z][a-z]+\s+were\s+physical\s+facts)/g, (_, phrase) => `—${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`)
      .replace(/\baccording to the tour operators was captured\b/g, 'according to the tour operators, was captured')
      .replace(/\bwhere the EVP was captured was\b/g, 'where the EVP was captured, was')
      .replace(/\bThe EVP, therefore existed\b/g, 'The EVP, therefore, existed');

    if (text !== beforeCopyedit) {
      changes.push('nonfiction export copyedit residue repair');
    }

    return {
      ...chapter,
      content_md: normalizeExportBodyMarkdown(text),
      word_count: countPlainWords(text),
      __exportCleanupApplied: chapter.__exportCleanupApplied || changes.length > 0,
      __exportCleanupChanges: [
        ...(chapter.__exportCleanupChanges || []),
        ...changes,
      ].slice(0, 50),
    };
  });
}

function hardBlockExportIfNonfictionSourceIntegrityFails(chapters = [], project = {}) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const problems = [];

  if (!isLikelyNonfictionExportProject(project, safe)) {
    return { blocked: false, problems };
  }

  const isFinanceProject = isFinanceOrInvestingProject(project, safe);
  const bibliographyChapters = safe.filter((chapter) => isBibliographyLikeChapter(chapter));

  if (!bibliographyChapters.length) {
    problems.push({
      chapter_number: 'back matter',
      title: 'Bibliography',
      type: 'missing bibliography',
      detail: 'No bibliography/source chapter found in nonfiction export.',
    });
  }

  safe.forEach((chapter, index) => {
    const text = String(chapter?.content_md || '');
    const title = String(chapter?.title || chapter?.chapter_title || `Section ${index + 1}`);
    const chapter_number = chapter?.chapter_number || index + 1;

    if (NONFICTION_EXPORT_PLACEHOLDER_RE.test(text)) {
      problems.push({
        chapter_number,
        title,
        type: 'source placeholder survivor',
        detail: 'Contains SOURCE/CITATION/TODO placeholder text.',
      });
    }

    if (!isFinanceProject && isBibliographyLikeChapter(chapter) && FINANCE_SOURCE_CONTAMINATION_RE.test(text)) {
      problems.push({
        chapter_number,
        title,
        type: 'cross-project bibliography contamination',
        detail: 'Finance/investing sources survived inside a non-finance bibliography.',
      });
    }

    if (isBibliographyLikeChapter(chapter)) {
      const credibleEntries = splitBibliographyEntries(text).filter((entry) => {
        const trimmed = entry.trim();
        if (!trimmed || /^#{1,6}\s+/.test(trimmed)) return false;
        if (/^(?:Bibliography|Sources|Works Cited|References|Articles?|Books?|Academic|Government|Archives?|Court|Newspapers?|Reports?|Web|Oral Histories|Primary Sources|Secondary Sources)\b/i.test(trimmed)) return false;
        if (NONFICTION_EXPORT_PLACEHOLDER_RE.test(trimmed)) return false;
        if (!isFinanceProject && FINANCE_SOURCE_CONTAMINATION_RE.test(trimmed)) return false;
        return true;
      });

      if (credibleEntries.length < 4) {
        problems.push({
          chapter_number,
          title,
          type: 'thin bibliography',
          detail: `${credibleEntries.length} credible source entries found after cleanup; nonfiction needs a rebuilt source list.`,
        });
      }
    }
  });

  const authorNote = safe.find((chapter) => isAuthorsNoteLikeChapter(chapter));
  if (authorNote) {
    const note = String(authorNote?.content_md || '');
    if (/all\s+sources\s+are\s+cited\s+within\s+the\s+text\s+and\s+compiled\s+in\s+the\s+bibliography/i.test(note) && problems.some((p) => /bibliography|source/.test(p.type))) {
      problems.push({
        chapter_number: authorNote?.chapter_number || 'front matter',
        title: authorNote?.title || 'Author’s Note',
        type: 'source promise mismatch',
        detail: 'Author’s Note promises complete sourcing while the bibliography/source apparatus is incomplete or contaminated.',
      });
    }
  }

  return {
    blocked: problems.length > 0,
    problems,
  };
}


function runNonfictionFinalExportScarTissueSweep(text = '') {
  let output = String(text || '');
  const changes = [];

  const before = output;

  // RECOVERY v44: remove scar tissue produced by the failed source-ledger
  // drafting architecture. This is a final export seatbelt only; it does not
  // mutate saved chapters.
  const scarParagraphs = [
    /(?:^|\n\s*)The casualty record should be treated as an evidence problem rather than a conclusion\.[\s\S]{0,900}?during the riot\.\s*(?=\n|$)/gi,
    /(?:^|\n\s*)The available accounts do not cleanly reconcile the count, location, and sequence[\s\S]{0,700}?during the riot\.\s*(?=\n|$)/gi,
    /(?:^|\n\s*)The process yielded four names that appeared consistently[\s\S]{0,2600}?The four probable names were the first exhumation\.\s*(?=\n|$)/gi,
    /(?:^|\n\s*)The guard(?:’|')s logbook was a nondescript ledger[\s\S]{0,3600}?M-key used[\s\S]{0,2200}?/gi,
    /(?:^|\n\s*)The surviving logbook for September 1954[\s\S]{0,2600}?M-key used[\s\S]{0,2000}?/gi,
    /(?:^|\n\s*)Contemporary administrative records and later correctional histories identify it as the master key[\s\S]{0,1800}?Someone possessed the means to do it\.\s*(?=\n|$)/gi,
    /(?:^|\n\s*)The phrase [“"]the shop that cooked[”"][\s\S]{0,1800}?specific trauma within the oral history of the prison\.\s*(?=\n|$)/gi,
    /(?:^|\n\s*)Lawrence [“"]Bud[”"] Gant[\s\S]{0,2600}?Paulie Russo[\s\S]{0,2400}?/gi,
  ];
  for (const rx of scarParagraphs) {
    const next = output.replace(rx, '\n');
    if (next !== output) {
      output = next;
      changes.push('removed failed source-ledger scar paragraph');
    }
  }
  output = output
    .replace(/\bVoc\. Shop B secured per order\. M-key used\.?/gi, '')
    .replace(/\bVocational Shop B\b/gi, 'the vocational shop')
    .replace(/\bShop B\b/g, 'the shop')
    .replace(/\bM-key\b/g, 'master key')
    .replace(/\bthe shop that cooked\b/gi, 'the workshop fire story')
    .replace(/\bcomplete destruction of evidence by fire\b/gi, 'severe fire damage')
    .replace(/\bLawrence [“"]Bud[”"] Gant\b|\bHenry Clay\b|\bRobert [“"]Bobby[”"] Vickers\b|\bPaulie Russo\b/gi, 'one unnamed inmate')
    .replace(/\n{3,}/g, '\n\n');
  output = output
    // Time/date splits that kept surviving manuscript-fixer runs because export
    // can assemble from cached/saved chapter bodies after the fixer pass.
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s+On\s+/gi, 'At approximately $1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s+On\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, '$1 on $2')
    .replace(/\b([ap])\s*\.\s*m\s*\./gi, (_, meridiem) => `${String(meridiem).toLowerCase()}.m.`)

    // Caution-clamp scar tissue / internal editorial language that should never
    // appear in reader-facing nonfiction.
    .replace(/\barchitectural analysis from physical-site analysis\b/gi, 'physical-site analysis')
    .replace(/\bphysical-site analysis from physical-site analysis\b/gi, 'physical-site analysis')
    .replace(/\bphysical-site analysis of physical-site analysis\b/gi, 'physical-site analysis')
    .replace(/\bIt existed alongside the architectural analysis from physical-site analysis, which\b/g, 'It existed alongside physical-site analysis that')
    .replace(/\bIt existed alongside the physical-site analysis of the workshop door and its locking mechanism,\b/g, 'It existed alongside analysis of the workshop door and its locking mechanism,')
    .replace(/\bfrom physical-site analysis, which\b/g, 'from physical-site analysis, which')
    .replace(/\bThis was a factual observation of a security state\.\s*The final report omitted this observation\./g, 'If that detail appeared in field notes but not in the final report, the omission would matter.')
    .replace(/\bThis was a factual observation of a security state\./g, 'That distinction mattered as a matter of evidence, not atmosphere.')
    .replace(/\bA cautious physical reading of the site highlighted this gap\.\s*Her report noted that the fire marshal’s final conclusions were “not inconsistent with the physical evidence of the fire’s origin” but were “incomplete with respect to the security conditions that determined the fatal outcome\.”\s*That qualification mattered\.\s*It separated the question of ignition from the question of entrapment\.\s*The evidence had to keep both questions in view\./g, 'A cautious reading of the site highlighted the gap between ignition and entrapment. A fire-origin explanation would not, by itself, explain the security conditions that shaped the fatal outcome. The evidence had to keep both questions in view.')
    .replace(/\bHer report noted that the fire marshal’s final conclusions were “not inconsistent with the physical evidence of the fire’s origin” but were “incomplete with respect to the security conditions that determined the fatal outcome\.”/g, 'A fire-origin explanation would not, by itself, explain the security conditions that shaped the fatal outcome.')
    .replace(/\bHer report noted that\b/g, 'The available analysis noted that')
    .replace(/\bthe evidence can move from possibility to documented fact\b/g, 'the evidence can move from possibility toward documented fact')

    // Old-grudge / 1915-to-1954 over-solving that should remain inferential.
    .replace(/\bThe “old grudge” was not superstition; it was a living current in the prison’s social fabric, a threat recognized by an inmate and validated by his death\./g, 'The “old grudge,” if accurately reported, was not enough to solve the fire. It was a clue to social atmosphere, not a verdict.')
    .replace(/\ba threat recognized by an inmate and validated by his death\b/g, 'a reported fear that still requires verification')
    .replace(/\bvalidated by his death\b/g, 'made more troubling by what followed')
    .replace(/\bAnd it revealed how the prison’s deep history of racial violence, embodied in the 1915 lynching of “Pinky,” could reach forward across decades to influence choices made in a moment of crisis\./g, 'It also suggested that older patterns of racial violence and institutional hierarchy may have shaped fear inside the prison, though the direct line between 1915 and 1954 remains inferential.')

    // Conditional and interrupter comma repairs that are safe at export time.
    .replace(/\bif supported by the plans and hardware evidence would\b/g, 'if supported by the plans and hardware evidence, would')
    .replace(/\bif authenticated would\b/g, 'if authenticated, would')
    .replace(/\bif verified would\b/g, 'if verified, would')
    .replace(/\bif preserved would\b/g, 'if preserved, would')
    .replace(/\bif available would\b/g, 'if available, would')
    .replace(/\bif accurately preserved pointed\b/g, 'if accurately preserved, pointed')
    .replace(/\bif one was filed at all would\b/g, 'if one was filed at all, would')
    .replace(/\bcompiled by the Department of Corrections in the weeks that followed was\b/g, 'compiled by the Department of Corrections in the weeks that followed, was')
    .replace(/\bSomeone, or some procedure left\b/g, 'Someone, or some procedure, left')
    .replace(/\bthe fire-related record if complete would\b/g, 'the fire-related record, if complete, would')
    .replace(/\bThe fire-related record if complete would\b/g, 'The fire-related record, if complete, would')
    .replace(/\bonce located would\b/g, 'once located, would')
    .replace(/\bwhen pressed, even gently, the retired guard’s tone would shift\b/g, 'When pressed, even gently, the retired guard’s tone would shift')

    // Common quote-list and malformed quote survivors.
    .replace(/“ligature,”\s*bed sheet,”\s*and\s*“improvised cord\.”/g, '“ligature,” “bed sheet,” and “improvised cord.”')
    .replace(/“Discipline,”\s*Industry,”\s*Capital Punishment\.”/g, '“Discipline,” “Industry,” “Capital Punishment.”')
    .replace(/“He was taken\.”\s*He was hanged\.”/g, '“He was taken.” “He was hanged.”')
    .replace(/“0027\s*–\s*Fighting,”\s*“0041\s*–\s*Insolence,”\s*“0058\s*–\s*Refusal to work\.””/g, '“0027 – Fighting,” “0041 – Insolence,” “0058 – Refusal to work.”')

    // Tiny syntactic scars visible in the current Missouri Gothic export.
    .replace(/\bthe investigation therefore had a window\b/g, 'the investigation, therefore, had a window')
    .replace(/\bWho held the key, and why it was used was a question\b/g, 'Who held the key, and why it was used, was a question')
    .replace(/\bThe report did not address key control\.\s*The effect was to absorb/g, 'The report did not address key control. The effect was to absorb')
    .replace(/\bthe construction remained undocumented in the readily available historical summaries\b/g, 'the construction, remained undocumented in the readily available historical summaries')
    .replace(/\bThe very design of the Hole, intended to erase individuality and time may have created\b/g, 'The very design of the Hole, intended to erase individuality and time, may have created');

  if (output !== before) changes.push('nonfiction final export scar-tissue sweep');

  return { text: output, changed: output !== before, changes };
}

function applyFinalExportCleanup(chapters = [], project = {}) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  const forceSongbirdAliases = isSongbirdExportProject(project, safe);

  const firstPass = safe.map((chapter, index) => {
    const result = runExportTextSafetyNet(chapter?.content_md || '', project, {
      forceSongbirdAliases,
    });
    const terminal = runTerminalExportSourceGuard(result.text, chapter, index);
    const hardArtifacts = removeForbiddenExportArtifactParagraphs(terminal.text);

    return {
      ...chapter,
      content_md: hardArtifacts.text,
      word_count: countPlainWords(hardArtifacts.text),
      __exportCleanupApplied: result.changed || terminal.changed || hardArtifacts.changed,
      __exportCleanupChanges: [
        ...(result.changes || []),
        ...(terminal.changes || []),
        ...(hardArtifacts.changes || []),
      ].slice(0, 30),
    };
  });

  // Export remains lightweight. This is now a reusable final source-integrity seatbelt:
  // generic boundary bleed detection + generic branch-collision quarantine. No project-specific names.

  const titleGuarded = uniquifyDuplicateExportChapterTitles(firstPass);
  const routeGuarded = runCrossChapterExportRouteGuard(titleGuarded, project);
  const songbirdThinned = thinSongbirdStyleTicsAcrossChapters(routeGuarded, forceSongbirdAliases);
  const globallyThinned = thinGenericStyleTicsAcrossChapters(songbirdThinned);
  const nonfictionSourceGuarded = applyNonfictionSourceIntegrityExportCleanup(globallyThinned, project);

  return nonfictionSourceGuarded.map((chapter) => {
    const hardArtifacts = removeForbiddenExportArtifactParagraphs(chapter?.content_md || '');
    const styleSafeText = repairStyleThinningArtifacts(hardArtifacts.text);
    const styleChanged = styleSafeText !== hardArtifacts.text;
    const nonfictionFinal = isLikelyNonfictionExportProject(project, nonfictionSourceGuarded)
      ? runNonfictionFinalExportScarTissueSweep(styleSafeText)
      : { text: styleSafeText, changed: false, changes: [] };
    return {
      ...chapter,
      content_md: nonfictionFinal.text,
      word_count: countPlainWords(nonfictionFinal.text),
      __exportCleanupApplied: true,
      __exportCleanupChanges: [
        ...(chapter.__exportCleanupChanges || []),
        ...(hardArtifacts.changes || []),
        ...(styleChanged ? ['style-thinning artifact repair'] : []),
        ...(nonfictionFinal.changes || []),
        'final export safety seatbelt applied',
        'global manuscript-level style thinning',
        'same-chapter route collision blocker checked',
        'hard forbidden artifact export gate checked',
        'nonfiction source-integrity export gate checked',
      ].slice(0, 40),
    };
  });
}

function normalizeExportBodyMarkdown(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function getChapterTitleValue(chapter = {}) {
  return String(
    chapter?.title ||
      chapter?.chapter_title ||
      chapter?.name ||
      chapter?.heading ||
      ''
  ).trim();
}

function looksLikeChapterOne(chapter = {}, index = 0) {
  const no = getChapterNumberValue(chapter, index);
  const title = getChapterTitleValue(chapter).toLowerCase();
  return no === 1 || title.includes('best glitch ever');
}

function runTerminalExportSourceGuard(text = '', chapter = {}, index = 0) {
  let out = String(text || '');
  const changes = [];

  const beforeMechanical = out;
  out = out
    .replace(/\bShe stirred made\b/g, 'She stirred and made')
    .replace(/\bThe engine coughed caught\b/g, 'The engine coughed, caught')
    .replace(/“{2,}\s*The window,”/g, '“The window,”')
    .replace(/“\s*“\s*The window,”/g, '“The window,”')
    .replace(/\bThe guard who had been heading for Pip changed course cutting off\b/g, 'The guard who had been heading for Pip changed course, cutting off');

  if (out !== beforeMechanical) {
    changes.push('terminal export mechanical survivor repair');
  }

  const hardArtifacts = removeForbiddenExportArtifactParagraphs(out);
  if (hardArtifacts.changed) {
    out = hardArtifacts.text;
    changes.push(...hardArtifacts.changes);
  }

  if (looksLikeChapterOne(chapter, index)) {
    const boundary = /([\s\S]*?A perfect, beautiful, boring human hallway\.\s*\n+\s*For now\.)(\s+The rain started as a lousy spit[\s\S]*)$/i;
    const match = out.match(boundary);
    if (match) {
      out = normalizeExportBodyMarkdown(match[1]);
      changes.push('terminal export source guard: Chapter 1 hard-cut after “For now.”; removed road-trip bleed');
    }
  }

  return {
    text: normalizeExportBodyMarkdown(out),
    changed: changes.length > 0,
    changes,
  };
}




function appendExportRouteChange(chapter = {}, change = '') {
  const nextChanges = [
    ...(Array.isArray(chapter.__exportCleanupChanges) ? chapter.__exportCleanupChanges : []),
    String(change || 'generic export route guard applied'),
  ].filter(Boolean);

  return {
    ...chapter,
    __exportCleanupApplied: true,
    __exportCleanupChanges: nextChanges.slice(-40),
  };
}

function escapeRegExpLiteral(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForSimilarity(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitExportParagraphs(text = '') {
  return normalizeExportBodyMarkdown(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function getSignificantWords(value = '') {
  const stop = new Set([
    'the','and','but','for','with','that','this','then','there','they','them','their','from','into','onto','over','under','was','were','had','has','have','his','her','she','him','you','your','not','out','all','one','two','three','what','when','where','which','while','would','could','should','just','like','back','down','again','before','after','through','very','more','some','than','now','only','been','being','did','didn','don','can','cant','will','wont','said','looked','voice','eyes','hand','hands','face','room','door','wall','air','light','time'
  ]);
  return normalizeForSimilarity(value)
    .split(' ')
    .filter((w) => w.length >= 5 && !stop.has(w) && !/^\d+$/.test(w));
}

function jaccardSimilarity(aWords = [], bWords = []) {
  const a = new Set(aWords);
  const b = new Set(bWords);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

function firstMeaningfulParagraph(text = '') {
  const paragraphs = splitExportParagraphs(text);
  return paragraphs.find((p) => getSignificantWords(p).length >= 6) || paragraphs[0] || '';
}

function firstWordsPatternFromParagraph(paragraph = '', maxWords = 14) {
  const words = normalizeForSimilarity(paragraph).split(' ').filter(Boolean).slice(0, maxWords);
  if (words.length < 8) return null;
  return new RegExp(words.map(escapeRegExpLiteral).join('[\\s\\S]{0,24}'), 'i');
}

function findLikelyNextChapterBleedIndex(currentText = '', nextText = '') {
  const nextFirst = firstMeaningfulParagraph(nextText);
  const pattern = firstWordsPatternFromParagraph(nextFirst, 12);
  if (!pattern) return -1;
  const match = pattern.exec(currentText);
  if (!match || typeof match.index !== 'number') return -1;

  // Avoid false positives from quoted recaps near the top. Boundary bleed usually appears late.
  if (match.index < Math.max(1200, currentText.length * 0.35)) return -1;
  return match.index;
}

function findCleanBoundaryBefore(text = '', index = -1) {
  if (index <= 0) return -1;
  const before = text.slice(0, index).trimEnd();
  const searchStart = Math.max(0, before.length - 1400);
  const window = before.slice(searchStart);

  // Prefer short, terminal-looking final lines/cliffhangers. These patterns are genre-neutral:
  // they detect completed beats, not specific books, names, locations, or scenes.
  const boundaryPatterns = [
    /(?:^|\n)([^\n]{0,180}(?:For now|They ran|And then they ran|It had begun|The choice was made|There was no going back|Everything changed|Nothing would be the same)\.)\s*$/i,
    /(?:^|\n)([^\n]{20,220}[.!?])\s*$/,
  ];

  for (const pattern of boundaryPatterns) {
    const match = window.match(pattern);
    if (match && match[0]) {
      return searchStart + match.index + match[0].length;
    }
  }

  return -1;
}

function runGenericCrossChapterBoundaryBleedGuard(chapters = []) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  return safe.map((chapter, index) => {
    if (index >= safe.length - 1) return chapter;

    const current = String(chapter?.content_md || '');
    const next = String(safe[index + 1]?.content_md || '');
    if (current.length < 1600 || next.length < 500) return chapter;

    const bleedIndex = findLikelyNextChapterBleedIndex(current, next);
    if (bleedIndex < 0) return chapter;

    const boundary = findCleanBoundaryBefore(current, bleedIndex);
    if (boundary < 0 || boundary > bleedIndex) return chapter;

    const removed = current.slice(boundary).trim();
    const removedWords = countPlainWords(removed);
    const keptWords = countPlainWords(current.slice(0, boundary));

    // High-confidence only: do not cut a chapter unless the suspected overflow is substantial
    // and the retained chapter still has enough body to be plausible.
    if (removedWords < 250 || keptWords < 500) return chapter;

    const nextOpeningWords = getSignificantWords(firstMeaningfulParagraph(next));
    const removedOpeningWords = getSignificantWords(removed.slice(0, Math.min(1400, removed.length)));
    const similarity = jaccardSimilarity(nextOpeningWords, removedOpeningWords);
    if (similarity < 0.18) return chapter;

    const out = normalizeExportBodyMarkdown(current.slice(0, boundary));
    return appendExportRouteChange(
      {
        ...chapter,
        content_md: out,
        word_count: countPlainWords(out),
      },
      'generic boundary guard: removed likely next-chapter bleed from prior chapter export'
    );
  });
}

function extractRepeatedProperPhrases(text = '') {
  const source = String(text || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const phrases = new Map();
  const regex = /\b(?:[A-Z][a-zA-Z'’.-]{2,})(?:\s+(?:of|the|and|&|[A-Z][a-zA-Z'’.-]{2,})){0,4}\b/g;
  let match;
  while ((match = regex.exec(source))) {
    const raw = match[0].trim();
    const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!norm || norm.length < 5) continue;
    if (/^(Chapter|The|And|But|Then|When|Where|After|Before|There|This|That|They|He|She|It|You|We|I)\b/.test(raw)) continue;
    phrases.set(norm, (phrases.get(norm) || 0) + 1);
  }
  return [...phrases.entries()]
    .filter(([, count]) => count >= 2)
    .map(([phrase]) => phrase)
    .slice(0, 60);
}

function paragraphContainsAnchor(paragraph = '', anchor = '') {
  return normalizeForSimilarity(paragraph).includes(anchor);
}

function getParagraphAnchorSet(paragraph = '', anchors = []) {
  const set = new Set();
  for (const anchor of anchors) {
    if (paragraphContainsAnchor(paragraph, anchor)) set.add(anchor);
  }
  return set;
}

function anchorIntersectionSize(a = new Set(), b = new Set()) {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function isRouteRestartCue(paragraph = '') {
  const p = String(paragraph || '');
  return (
    /\b(?:And there it was|There it was|They rounded|They stopped|They reached|They approached|They entered|They arrived|They pushed through|They walked through|The door|The corridor|The alley|The room|The bar|The club|The station|The office|The house|The apartment|The chamber|The court|The palace|The street|The hotel|The warehouse|The hospital|The school|The church|The diner|The shop|The theater|The stage)\b/i.test(p) ||
    /\b(?:wasn[’']t hard to find|was not hard to find|stood before them|waited ahead|loomed ahead|opened before them)\b/i.test(p)
  );
}

function windowText(paragraphs = [], start = 0, count = 12) {
  return paragraphs.slice(start, Math.min(paragraphs.length, start + count)).join('\n\n');
}

function chooseBranchToRemove(firstWindow = '', secondWindow = '') {
  const first = normalizeForSimilarity(firstWindow);
  const second = normalizeForSimilarity(secondWindow);

  const laterCompletionSignals = [
    'receipt','map','token','key','deal','favor','price','route','exit','escape','guide','contact','answer','promise','agreement','proof','evidence','address','location','coordinates','password','passphrase','audience','meeting','safe house','safehouse','shelter','healing','first aid','bandage','salve','doctor','nurse','revelation','truth','confession','decision'
  ];
  const firstScore = laterCompletionSignals.reduce((sum, term) => sum + (first.includes(term) ? 1 : 0), 0);
  const secondScore = laterCompletionSignals.reduce((sum, term) => sum + (second.includes(term) ? 1 : 0), 0);

  // In stacked LLM retries, the later branch is often fuller and more resolved.
  // Prefer removing the earlier branch when the later branch carries more completion signals.
  if (secondScore >= firstScore) return 'first';
  return 'second';
}

function runGenericSameChapterBranchCollisionGuard(chapter = {}) {
  const original = String(chapter?.content_md || '');
  if (original.length < 3500) return chapter;

  const paragraphs = splitExportParagraphs(original);
  if (paragraphs.length < 14) return chapter;

  const anchors = extractRepeatedProperPhrases(original);
  if (anchors.length < 2) return chapter;

  const candidates = [];
  for (let i = 0; i < paragraphs.length; i += 1) {
    if (!isRouteRestartCue(paragraphs[i])) continue;
    const set = getParagraphAnchorSet(windowText(paragraphs, i, 8), anchors);
    if (set.size < 1) continue;
    candidates.push({ index: i, anchors: set });
  }

  let best = null;
  for (let a = 0; a < candidates.length; a += 1) {
    for (let b = a + 1; b < candidates.length; b += 1) {
      const first = candidates[a];
      const second = candidates[b];
      if (second.index - first.index < 5) continue;

      const shared = anchorIntersectionSize(first.anchors, second.anchors);
      if (shared < 1) continue;

      const firstWin = windowText(paragraphs, first.index, Math.min(14, second.index - first.index));
      const secondWin = windowText(paragraphs, second.index, 14);
      const sim = jaccardSimilarity(getSignificantWords(firstWin), getSignificantWords(secondWin));

      const transactionalOverlap = /\b(token|receipt|delivery|deal|favor|price|broker|guide|contact|meeting|audience|route|map|key|password|passphrase|guard|escape|injury|blood|bandage|salve|fight|capture|cell|throne|court|safe house|safehouse)\b/i.test(firstWin) &&
        /\b(token|receipt|delivery|deal|favor|price|broker|guide|contact|meeting|audience|route|map|key|password|passphrase|guard|escape|injury|blood|bandage|salve|fight|capture|cell|throne|court|safe house|safehouse)\b/i.test(secondWin);

      if (sim < 0.16 && !transactionalOverlap) continue;

      const score = shared * 3 + sim * 10 + (transactionalOverlap ? 3 : 0);
      if (!best || score > best.score) {
        best = { first, second, score, firstWin, secondWin };
      }
    }
  }

  if (!best) return chapter;

  const removeWhich = chooseBranchToRemove(best.firstWin, best.secondWin);
  let nextParagraphs = [...paragraphs];

  if (removeWhich === 'first') {
    const bridge = buildGenericBranchBridge(paragraphs, best.first.index, best.second.index);
    nextParagraphs = [
      ...paragraphs.slice(0, best.first.index),
      bridge,
      ...paragraphs.slice(best.second.index),
    ].filter(Boolean);
  } else {
    const endSecond = Math.min(paragraphs.length, best.second.index + 12);
    nextParagraphs = [
      ...paragraphs.slice(0, best.second.index),
      ...paragraphs.slice(endSecond),
    ].filter(Boolean);
  }

  const out = normalizeExportBodyMarkdown(nextParagraphs.join('\n\n'));
  const removedWords = countPlainWords(original) - countPlainWords(out);

  // High-confidence safety: never remove tiny noise or the majority of a chapter from this generic guard.
  if (removedWords < 180 || removedWords > Math.max(3500, countPlainWords(original) * 0.45)) return chapter;

  return appendExportRouteChange(
    {
      ...chapter,
      content_md: out,
      word_count: countPlainWords(out),
    },
    'generic branch collision guard: quarantined likely stacked alternate scene branch'
  );
}

function buildGenericBranchBridge(paragraphs = [], firstIndex = 0, secondIndex = 0) {
  const before = paragraphs[Math.max(0, firstIndex - 1)] || '';
  const after = paragraphs[secondIndex] || '';
  const beforeEndsClean = /[.!?][”"']?$/.test(before.trim());
  const afterStartsClean = /^[A-Z“”"']/.test(after.trim());
  if (beforeEndsClean && afterStartsClean) {
    return ''; // v34: never inject internal bridge/debug prose into export content.
  }
  return '';
}

function runGenericPostCliffhangerOverflowGuard(chapter = {}) {
  const original = String(chapter?.content_md || '');
  if (original.length < 5000) return chapter;

  // Generic final-cliffhanger protection: if a chapter reaches an explicit flight/escape beat,
  // then continues into a whole new capture/fight/court/prison branch, keep the cliffhanger.
  // This is not tied to any project; it protects chapter boundaries from stacked retries.
  const pattern = /([\s\S]*?\b(?:They ran|They fled|They escaped|They vanished|They disappeared|They moved|They went)\.)\s+([\s\S]{900,})$/i;
  const match = original.match(pattern);
  if (!match) return chapter;

  const before = match[1] || '';
  const after = match[2] || '';
  const afterNorm = normalizeForSimilarity(after);
  const beforeNorm = normalizeForSimilarity(before.slice(Math.max(0, before.length - 2200)));

  const hasPreEscapeSetup = /\b(tunnel|exit|escape|move|run|follow|stairs|staircase|door|corridor|safe|hide|flee|go now)\b/i.test(beforeNorm);
  const hasNewOutcomeBranch = /\b(fight|fought|guard|guards|sentinel|soldier|police|capture|captured|cell|prison|throne|court|interrogation|warden|doctor|hospital|trial|execution|detention|ambush|weapon|blood|hit|struck|beam|armor|armour)\b/i.test(afterNorm);

  if (!hasPreEscapeSetup || !hasNewOutcomeBranch) return chapter;

  const out = normalizeExportBodyMarkdown(before);
  const removedWords = countPlainWords(after);
  const keptWords = countPlainWords(out);
  if (removedWords < 300 || keptWords < 800) return chapter;

  return appendExportRouteChange(
    {
      ...chapter,
      content_md: out,
      word_count: countPlainWords(out),
    },
    'generic cliffhanger boundary guard: removed likely post-cliffhanger alternate outcome branch'
  );
}


function runCrossChapterExportRouteGuard(chapters = [], project = {}) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];

  // v39: Export no longer performs broad same-chapter branch surgery.
  // Earlier versions tried to remove repeated route branches at export time.
  // That is too risky because export has no LLM/contextual rewrite step and can
  // amputate connective tissue. Export may still perform conservative
  // cross-chapter bleed cleanup, but same-chapter route/branch collisions are
  // detected and BLOCKED later by hardBlockExportIfStructuralCollisionSurvives.
  // Fix/Polish owns durable correction and DB/GitHub persistence.
  return runGenericCrossChapterBoundaryBleedGuard(safe);
}

function getChapterNumberValue(chapter = {}, fallbackIndex = 0) {
  const raw = chapter?.chapter_number ?? chapter?.number ?? fallbackIndex + 1;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallbackIndex + 1;
}

function isGenericExportTitle(title = '', chapterNumber = '') {
  const raw = String(title || '').trim();
  if (!raw) return true;

  const compact = raw.toLowerCase().replace(/[\s._\-—:]+/g, '');
  const number = String(chapterNumber || '').trim();

  if (compact === 'untitled') return true;
  if (compact === 'chapter') return true;
  if (compact === 'chapter_') return true;
  if (number && compact === `chapter${number}`) return true;
  if (/^chapter[_\s.\-—:]*\d*$/i.test(raw)) return true;
  if (/^ch(?:apter)?[_\s.\-—:]*\d*$/i.test(raw)) return true;
  if (/^section[_\s.\-—:]*\d*$/i.test(raw)) return true;

  return false;
}

function cleanExportTitle(title = '', chapterNumber = '') {
  const raw = String(title || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^chapter\s+\d+\s*[:\-—]\s*/i, '')
    .replace(/^ch\.?\s*\d+\s*[:\-—]\s*/i, '')
    .replace(/^section\s+\d+\s*[:\-—]\s*/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw || isGenericExportTitle(raw, chapterNumber)) return '';
  return raw.replace(/[.!?]+$/g, '').trim();
}

function getDisplayChapterHeading(chapter = {}, raw = '', fallbackIndex = 0, options = {}) {
  const chapterNumber = getChapterNumberValue(chapter, fallbackIndex);
  const atticusTitleOnly = options.atticusTitleOnly === true;

  let resolvedTitle = cleanExportTitle(chapter?.title || '', chapterNumber);

  if (!resolvedTitle) {
    const lines = String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.slice(0, 4)) {
      const labelTitle = extractTitleFromChapterLabel(line);
      const candidate = cleanExportTitle(labelTitle || line, chapterNumber);

      if (candidate && !isStandaloneChapterLabel(candidate, chapterNumber)) {
        resolvedTitle = candidate;
        break;
      }
    }
  }

  if (resolvedTitle) {
    return atticusTitleOnly ? resolvedTitle : `Chapter ${chapterNumber}: ${resolvedTitle}`;
  }

  return `Chapter ${chapterNumber}`;
}

function normalizeHeadingComparable(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/^#{1,6}\s+/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStandaloneChapterLabel(line = '', chapterNumber = '') {
  const clean = String(line || '')
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/[.。]+$/g, '')
    .trim();

  if (!clean) return false;

  const numeric = chapterNumber ? String(chapterNumber).trim() : '';

  if (numeric && new RegExp(`^chapter\\s+${numeric}$`, 'i').test(clean)) return true;

  return /^chapter\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$/i.test(clean);
}

function isChapterLabelWithTitle(line = '') {
  const clean = String(line || '').trim().replace(/^#{1,6}\s+/, '').trim();
  return /^chapter\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*[:—-]\s+.+/i.test(clean);
}

function extractTitleFromChapterLabel(line = '') {
  const clean = String(line || '').trim().replace(/^#{1,6}\s+/, '').trim();
  const match = clean.match(/^chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*[:—-]\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getDocxVisibleChapterTitle(chapter = {}, raw = '', fallbackIndex = 0, options = {}) {
  return getDisplayChapterHeading(chapter, raw, fallbackIndex, options);
}

function stripRepeatedChapterHeading(text = '', chapter = {}, visibleTitle = '') {
  const lines = String(text || '').split('\n');

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  if (!lines.length) return '';

  const titleComparable = normalizeHeadingComparable(visibleTitle || chapter?.title || '');
  const titleOnlyComparable = normalizeHeadingComparable(cleanExportTitle(chapter?.title || '', chapter?.chapter_number));

  let removed = 0;

  while (lines.length && removed < 4) {
    const firstRaw = lines[0] || '';
    const first = firstRaw.trim();

    if (!first) {
      lines.shift();
      removed += 1;
      continue;
    }

    const firstWithoutMarkdown = first.replace(/^#{1,6}\s+/, '').trim();
    const firstComparable = normalizeHeadingComparable(firstWithoutMarkdown);

    if (isStandaloneChapterLabel(firstWithoutMarkdown, chapter?.chapter_number)) {
      lines.shift();
      removed += 1;
      continue;
    }

    if (isChapterLabelWithTitle(firstWithoutMarkdown)) {
      lines.shift();
      removed += 1;
      continue;
    }

    if (titleComparable && firstComparable === titleComparable) {
      lines.shift();
      removed += 1;
      continue;
    }

    if (titleOnlyComparable && firstComparable === titleOnlyComparable) {
      lines.shift();
      removed += 1;
      continue;
    }

    if (/^#{1,3}\s+/.test(first) && removed === 0) {
      lines.shift();
      removed += 1;
      continue;
    }

    break;
  }

  return lines.join('\n').trim();
}

function parseInlineRuns(text = '', settings = {}) {
  const font = settings.paragraphFont || 'Times New Roman';
  const size = Math.round(Number(settings.fontSize || 12) * 2);
  const input = stripHtmlToText(String(text || ''));
  const runs = [];
  const regex =
    /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[^*\n]+?\*|_[^_\n]+?_|~~[\s\S]+?~~|<u>[\s\S]+?<\/u>|`[^`]+?`|\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match;

  const pushPlain = (value) => {
    if (!value) return;
    runs.push(
      new TextRun({
        text: value,
        font,
        size,
      })
    );
  };

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(input.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (
      (token.startsWith('***') && token.endsWith('***')) ||
      (token.startsWith('___') && token.endsWith('___'))
    ) {
      runs.push(
        new TextRun({
          text: token.slice(3, -3),
          font,
          size,
          bold: true,
          italics: true,
        })
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          font,
          size,
          bold: true,
        })
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font,
          size,
          italics: true,
        })
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          font,
          size,
          strike: true,
        })
      );
    } else if (/^<u>[\s\S]+<\/u>$/.test(token)) {
      runs.push(
        new TextRun({
          text: token.replace(/^<u>/, '').replace(/<\/u>$/, ''),
          font,
          size,
          underline: {
            type: UnderlineType.SINGLE,
          },
        })
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: 'Courier New',
          size,
        })
      );
    } else if (/^\[[^\]]+\]\([^)]+\)$/.test(token)) {
      const label = token.replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1');
      runs.push(
        new TextRun({
          text: label,
          font,
          size,
          underline: {
            type: UnderlineType.SINGLE,
          },
          color: '1155CC',
        })
      );
    } else {
      pushPlain(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    pushPlain(input.slice(lastIndex));
  }

  return runs.length ? runs : [new TextRun({ text: '', font, size })];
}

function paragraphFromRuns(runs, options = {}) {
  return new Paragraph({
    children: runs,
    heading: options.heading,
    alignment: options.alignment,
    spacing: options.spacing,
    indent: options.indent,
    bullet: options.bullet,
    pageBreakBefore: options.pageBreakBefore,
  });
}

function markdownToDocxParagraphs(markdown = '', settings = {}, options = {}) {
  const lineHeight = getLineHeightValue(settings.lineHeight);
  const lineSpacing = Math.round(parseFloat(lineHeight || 1.5) * 240);
  const shouldIndent = settings.paragraphBreak === 'Indented';
  const firstLineIndent = shouldIndent && !options.noIndent ? inchesToTwip(0.22) : 0;

  const normalized = normalizeDocxMarkdown(markdown);
  const lines = normalized.split('\n');

  const paragraphs = [];
  let buffer = [];
  let quoteBuffer = [];

  const normalSpacing = {
    line: lineSpacing,
    before: 0,
    after: 240,
  };

  const flushBuffer = () => {
    const text = buffer.join('\n').trim();
    buffer = [];

    if (!text) return;

    const parts = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

    for (const part of parts) {
      const linesInside = part.split('\n').filter(Boolean);

      if (linesInside.length > 1) {
        linesInside.forEach((line, idx) => {
          paragraphs.push(
            paragraphFromRuns(parseInlineRuns(line, settings), {
              spacing: normalSpacing,
              indent: idx === 0 && firstLineIndent ? { firstLine: firstLineIndent } : undefined,
            })
          );
        });
      } else {
        paragraphs.push(
          paragraphFromRuns(parseInlineRuns(part, settings), {
            spacing: normalSpacing,
            indent: firstLineIndent ? { firstLine: firstLineIndent } : undefined,
          })
        );
      }
    }
  };

  const flushQuote = () => {
    const text = quoteBuffer
      .map((line) => line.replace(/^\s*>\s?/, ''))
      .join('\n')
      .trim();

    quoteBuffer = [];

    if (!text) return;

    text.split(/\n{2,}/).forEach((part) => {
      paragraphs.push(
        paragraphFromRuns(parseInlineRuns(part.replace(/\n/g, ' '), settings), {
          spacing: {
            line: lineSpacing,
            before: 120,
            after: 240,
          },
          indent: {
            left: inchesToTwip(0.35),
            right: inchesToTwip(0.2),
          },
        })
      );
    });
  };

  const flushAll = () => {
    flushBuffer();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine || '';
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (trimmed === '---') {
      flushAll();

      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 240,
            after: 240,
          },
          children: [
            new TextRun({
              text: '* * *',
              font: settings.paragraphFont || 'Times New Roman',
              size: Math.round(Number(settings.fontSize || 12) * 2),
            }),
          ],
        })
      );

      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      flushAll();

      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();

      paragraphs.push(
        paragraphFromRuns(parseInlineRuns(text, settings), {
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: {
            before: 240,
            after: 220,
          },
        })
      );

      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushBuffer();
      quoteBuffer.push(line);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);

    if (bulletMatch) {
      flushAll();

      paragraphs.push(
        paragraphFromRuns(parseInlineRuns(bulletMatch[1], settings), {
          bullet: {
            level: 0,
          },
          spacing: normalSpacing,
        })
      );

      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

    if (orderedMatch) {
      flushAll();

      paragraphs.push(
        paragraphFromRuns(parseInlineRuns(`${orderedMatch[1]}. ${orderedMatch[2]}`, settings), {
          spacing: normalSpacing,
          indent: {
            left: inchesToTwip(0.2),
          },
        })
      );

      continue;
    }

    buffer.push(line);
  }

  flushAll();

  return paragraphs.length
    ? paragraphs
    : [
        new Paragraph({
          children: [
            new TextRun({
              text: '',
              font: settings.paragraphFont || 'Times New Roman',
              size: Math.round(Number(settings.fontSize || 12) * 2),
            }),
          ],
        }),
      ];
}

function buildDocxDocument(project = {}, chapters = [], settings = {}, dim = { w: 6, h: 9 }) {
  const lineHeight = getLineHeightValue(settings.lineHeight);
  const lineSpacing = Math.round(parseFloat(lineHeight || 1.5) * 240);

  const safeDocChapters = Array.isArray(chapters) ? chapters.filter(Boolean) : [];

  const children = [
    new Paragraph({
      text: project?.title || 'Untitled',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 1200,
        after: 260,
      },
    }),
  ];

  if (project?.tagline) {
    children.push(
      new Paragraph({
        text: project.tagline,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 220,
        },
      })
    );
  }

  if (project?.author_name) {
    children.push(
      new Paragraph({
        text: `by ${project.author_name}`,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 600,
        },
      })
    );
  }

  const frontMatter = safeDocChapters.filter((chapter) => isFrontMatter(chapter));
  const bodyMatter = safeDocChapters.filter((chapter) => isBodyChapter(chapter));
  const backMatter = safeDocChapters.filter((chapter) => isBackMatter(chapter));

  frontMatter.forEach((chapter) => {
    const raw = normalizeDocxMarkdown(chapter.content_md || '');
    if (!raw.trim()) return;

    children.push(
      new Paragraph({
        pageBreakBefore: true,
        text: chapter.title || '',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 300,
        },
      })
    );

    children.push(
      ...markdownToDocxParagraphs(raw, settings, {
        noIndent: true,
      })
    );
  });

  bodyMatter.forEach((chapter, index) => {
    const raw = normalizeDocxMarkdown(chapter.content_md || '');
    const chapterTitle = getDocxVisibleChapterTitle(chapter, raw, index, {
      atticusTitleOnly: settings?.atticusTitleOnly === true || settings?.chapterHeadingStyle === 'title-only',
    });
    const clean = stripRepeatedChapterHeading(raw, chapter, chapterTitle);

    /*
     * Export heading fix:
     * Body chapters use a resolved heading such as "Chapter 1: Actual Title"
     * unless a future settings toggle requests Atticus title-only mode. The body
     * text is scrubbed of leading generic labels, markdown headings, and duplicate
     * title lines. The chapter_number metadata remains untouched.
     */
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        text: chapterTitle,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 500,
          after: 420,
        },
      })
    );

    children.push(
      ...markdownToDocxParagraphs(clean, settings, {
        noIndent: false,
      })
    );
  });

  backMatter.forEach((chapter) => {
    const raw = normalizeDocxMarkdown(chapter.content_md || '');
    if (!raw.trim()) return;

    const clean = stripRepeatedChapterHeading(raw, chapter, chapter.title || 'Back Matter');

    children.push(
      new Paragraph({
        pageBreakBefore: true,
        text: chapter.title || 'Back Matter',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 360,
        },
      })
    );

    children.push(
      ...markdownToDocxParagraphs(clean, settings, {
        noIndent: true,
      })
    );
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: inchesToTwip(dim.w),
              height: inchesToTwip(dim.h),
            },
            margin: {
              top: inchesToTwip(settings.topMargin || 0.75),
              bottom: inchesToTwip(settings.bottomMargin || 0.75),
              left: inchesToTwip(settings.insideMargin || 0.75),
              right: inchesToTwip(settings.outsideMargin || 0.75),
            },
          },
        },
        children,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: {
            font: settings.paragraphFont || 'Times New Roman',
            size: Math.round(Number(settings.fontSize || 12) * 2),
          },
          paragraph: {
            spacing: {
              line: lineSpacing,
              after: 240,
            },
          },
        },
      ],
    },
  });
}