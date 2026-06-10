import React, { useState, useCallback, useRef } from 'react';
import { Download, Save, Loader2, Paintbrush, Image, BookOpen, Smartphone } from 'lucide-react';
import DPIExportButtons from '@/components/cover/DPIExportButtons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { bypassUploadFile } from '@/lib/coreBypasses';
import { jsPDF } from 'jspdf';
import CoverArtGenerator from '@/components/cover/CoverArtGenerator';
import FabricEditor from '@/components/cover/FabricEditor';
import FullWrapComposite from '@/components/cover/FullWrapComposite';

/**
 * CoverCreator.jsx
 *
 * IMPORTANT FIX:
 * - Full Wrap now receives the selected finished cover URL directly.
 * - It no longer depends on a fragile FabricEditor snapshot.
 *
 * Why:
 * Native covers already have title/author/subtitle burned in.
 * Snapshotting the front-cover editor was causing the wrap page to receive
 * a malformed data URL where the cover appeared tiny in the upper-left.
 */
export default function CoverCreator({ project, busyLabel }) {
  const initialCoverUrl =
    project?.cover_art_url ||
    project?.cover_image_url ||
    project?.cover_url ||
    null;

  const [selectedArtUrl, setSelectedArtUrl] = useState(initialCoverUrl);
  const [view, setView] = useState(initialCoverUrl ? 'editor' : 'art');
  const [saving, setSaving] = useState(false);

  const fabricCanvasRef = useRef(null);
  const wrapCanvasRef = useRef(null);
  const wrapDimsRef = useRef(null);

  const handleSelectArt = useCallback(
    async (url) => {
      if (!url) return;

      setSelectedArtUrl(url);
      setView('editor');

      if (project?.id) {
        try {
          await base44.entities.NovelProject.update(project.id, {
            cover_art_url: url,
          });
        } catch (err) {
          console.warn('[COVER] Failed to persist selected art URL:', err?.message);
        }
      }
    },
    [project?.id]
  );

  const handleCanvasReady = useCallback((fc) => {
    fabricCanvasRef.current = fc;
  }, []);

  const handleWrapCanvas = useCallback((canvas, dims) => {
    wrapCanvasRef.current = canvas;
    wrapDimsRef.current = dims;
  }, []);

  /**
   * Front-cover export for ebook/front-cover-only downloads.
   * This intentionally does not drive Full Wrap anymore.
   */
  const getFrontDataUrl = useCallback(() => {
    const fc = fabricCanvasRef.current;

    if (!fc) {
      return selectedArtUrl || null;
    }

    try {
      fc.discardActiveObject();
      fc.renderAll();

      return fc.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });
    } catch (err) {
      console.warn('[COVER] Front canvas export failed:', err?.message);
      return selectedArtUrl || null;
    }
  }, [selectedArtUrl]);

  const exportCanvas = useCallback(
    (multiplier = 1) => {
      const fc = fabricCanvasRef.current;

      if (!fc) {
        return selectedArtUrl || null;
      }

      try {
        fc.discardActiveObject();
        fc.renderAll();

        return fc.toDataURL({
          format: 'png',
          quality: 1,
          multiplier,
        });
      } catch (err) {
        console.warn('[COVER] Canvas export failed:', err?.message);
        return selectedArtUrl || null;
      }
    },
    [selectedArtUrl]
  );

  const handleDPIExport = useCallback(
    (targetDPI, label) => {
      if (view === 'wrap') {
        const canvas = wrapCanvasRef.current;

        if (!canvas) {
          toast.error('Wrap canvas not ready');
          return;
        }

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${slug(project?.title)}-fullwrap-${label}-${targetDPI}dpi.png`;
        a.click();
        return;
      }

      const multiplier = targetDPI / 72;
      const dataUrl = exportCanvas(multiplier);

      if (!dataUrl) {
        toast.error('Front cover canvas not ready');
        return;
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${slug(project?.title)}-front-cover-${label}-${targetDPI}dpi.png`;
      a.click();
    },
    [exportCanvas, project?.title, view]
  );

  const handleExportEbook = useCallback(() => {
    const dataUrl = exportCanvas(1);

    if (!dataUrl) {
      toast.error('No front cover image available');
      return;
    }

    const img = new window.Image();

    img.onload = () => {
      try {
        const targetW = 1600;
        const targetH = 2560;
        const tempCanvas = document.createElement('canvas');

        tempCanvas.width = targetW;
        tempCanvas.height = targetH;

        const ctx = tempCanvas.getContext('2d');

        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, targetW, targetH);

        const scale = Math.max(targetW / img.width, targetH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        const a = document.createElement('a');
        a.href = tempCanvas.toDataURL('image/png', 1.0);
        a.download = `${slug(project?.title)}-ebook-cover-1600x2560.png`;
        a.click();
      } catch (err) {
        toast.error('Ebook export failed: ' + (err?.message || 'unknown error'));
      }
    };

    img.onerror = () => {
      toast.error('Could not load the cover image for ebook export.');
    };

    img.src = dataUrl;
  }, [exportCanvas, project?.title]);

  const handleDownloadPDF = useCallback(() => {
    if (view === 'wrap') {
      const canvas = wrapCanvasRef.current;
      const dims = wrapDimsRef.current;

      if (!canvas || !dims) {
        toast.error('Wrap canvas not ready');
        return;
      }

      try {
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'in',
          format: [dims.totalWidth, dims.totalHeight],
        });

        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          dims.totalWidth,
          dims.totalHeight
        );

        pdf.save(`${slug(project?.title)}-fullwrap.pdf`);
      } catch (err) {
        toast.error('PDF export failed: ' + (err?.message || 'unknown error'));
      }

      return;
    }

    const dataUrl = exportCanvas(1);

    if (!dataUrl) {
      toast.error('Front cover canvas not ready');
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [6, 9],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 6, 9);
      pdf.save(`${slug(project?.title)}-front-cover.pdf`);
    } catch (err) {
      toast.error('PDF export failed: ' + (err?.message || 'unknown error'));
    }
  }, [exportCanvas, project?.title, view]);

  const handleSaveToProject = useCallback(async () => {
    if (!project?.id) {
      toast.error('Project not loaded');
      return;
    }

    setSaving(true);

    try {
      let dataUrl = null;
      let fileName = '';

      if (view === 'wrap') {
        const canvas = wrapCanvasRef.current;

        if (!canvas) {
          throw new Error('Wrap canvas not ready');
        }

        dataUrl = canvas.toDataURL('image/png');
        fileName = `${slug(project?.title)}-fullwrap.png`;
      } else {
        dataUrl = exportCanvas(1);
        fileName = `${slug(project?.title)}-front-cover.png`;
      }

      if (!dataUrl) {
        throw new Error('No cover image available to save');
      }

      const blob = await fetch(dataUrl).then((res) => res.blob());
      const file = new File([blob], fileName, { type: 'image/png' });

      const uploaded = await bypassUploadFile({ file });
      const fileUrl =
        uploaded?.file_url ||
        uploaded?.data?.file_url ||
        uploaded?.url ||
        uploaded;

      if (!fileUrl || typeof fileUrl !== 'string') {
        throw new Error('Upload returned no usable file URL');
      }

      const updatePayload =
        view === 'wrap'
          ? {
              full_wrap_cover_url: fileUrl,
              cover_fullwrap_url: fileUrl,
            }
          : {
              cover_image_url: fileUrl,
              cover_art_url: selectedArtUrl || fileUrl,
            };

      await base44.entities.NovelProject.update(project.id, updatePayload);

      toast.success(view === 'wrap' ? 'Full wrap saved to project' : 'Front cover saved to project');
    } catch (err) {
      console.warn('[COVER] Save failed:', err?.message);
      toast.error('Save failed: ' + (err?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }, [exportCanvas, project?.id, project?.title, selectedArtUrl, view]);

  const showExportButtons = !!selectedArtUrl || view === 'wrap';

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/70 bg-card/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={view === 'art' ? 'default' : 'ghost'}
            onClick={() => setView('art')}
            className="h-7 gap-1.5 rounded-lg px-3 text-xs"
          >
            <Image className="h-3.5 w-3.5" />
            Generate Art
          </Button>

          <Button
            size="sm"
            variant={view === 'editor' ? 'default' : 'ghost'}
            onClick={() => setView('editor')}
            disabled={!selectedArtUrl}
            className="h-7 gap-1.5 rounded-lg px-3 text-xs"
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Front Cover
          </Button>

          <Button
            size="sm"
            variant={view === 'wrap' ? 'default' : 'ghost'}
            onClick={() => setView('wrap')}
            disabled={!selectedArtUrl}
            className="h-7 gap-1.5 rounded-lg px-3 text-xs"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Full Wrap
          </Button>
        </div>

        {showExportButtons && (
          <div className="flex flex-wrap items-center gap-1.5">
            <DPIExportButtons onExport={handleDPIExport} />

            {view === 'editor' && (
              <Button
                onClick={handleExportEbook}
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-lg text-[10px]"
              >
                <Smartphone className="h-3 w-3" />
                Ebook (1600×2560)
              </Button>
            )}

            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg text-[10px]"
            >
              <Download className="h-3 w-3" />
              PDF
            </Button>

            <Button
              onClick={handleSaveToProject}
              disabled={saving}
              size="sm"
              className="h-7 gap-1 rounded-lg text-[10px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {view === 'art' && (
          <div className="h-full overflow-y-auto p-5">
            <div className="mx-auto max-w-2xl">
              <CoverArtGenerator
                project={project}
                onSelectArt={handleSelectArt}
                selectedArtUrl={selectedArtUrl}
              />
            </div>
          </div>
        )}

        {view === 'editor' && (
          <FabricEditor
            artUrl={selectedArtUrl}
            project={project}
            onCanvasReady={handleCanvasReady}
          />
        )}

        {view === 'wrap' && (
          <div className="h-full p-3">
            <FullWrapComposite
              frontCanvas={selectedArtUrl}
              project={project}
              onWrapCanvas={handleWrapCanvas}
            />
          </div>
        )}
      </div>

      {busyLabel && (
        <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          {busyLabel}
        </div>
      )}
    </div>
  );
}

function slug(title) {
  return String(title || 'autonovel')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}