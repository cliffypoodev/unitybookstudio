import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Layers,
  Loader2,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Type,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { base44 } from '@/api/base44Client';
import { bypassGenerateImage, bypassUploadFile } from '@/lib/coreBypasses';
import {
  KDP_SPECS,
  calculateCoverDimensions,
  estimatePageCount,
  suggestTrimSize,
} from '@/lib/kdpCover';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import SpineCalculator from '@/components/cover/SpineCalculator';
import ISBNBarcode from '@/components/cover/ISBNBarcode';
import PublisherPresets, { PUBLISHER_PRESETS } from '@/components/cover/PublisherPresets';

const SAVE_VERSION = 14;

const TEXT_FONTS = [
  'Georgia',
  'Cormorant Garamond',
  'Playfair Display',
  'Libre Baskerville',
  'Merriweather',
  'Cinzel',
  'Oswald',
  'Montserrat',
  'Inter',
  'Arial',
  'Helvetica',
];

function safeParse(value) {
  if (!value) return null;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function slug(title) {
  return String(title || 'book-cover')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function uid(prefix = 'layer') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function clampNumber(value, min, max, fallback = min) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, n));
}

function getFrontImageUrl(frontCanvas, project) {
  return (
    frontCanvas ||
    project?.cover_art_url ||
    project?.cover_image_url ||
    '' // WAVE3-WRAPFIELD: cover_url never existed on the entity
  );
}

function pctToPx(pct, total) {
  return (Number(pct || 0) / 100) * total;
}

function drawImageStretch(ctx, url, x, y, w, h) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };

    img.onerror = () => resolve();
    img.src = url;
  });
}

function drawImageCover(ctx, url, x, y, w, h) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const scale = Math.max(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      resolve();
    };

    img.onerror = () => resolve();
    img.src = url;
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxHeight) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n += 1) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && n > 0) {
      if (currentY + lineHeight > y + maxHeight) return;

      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (currentY + lineHeight <= y + maxHeight) {
    ctx.fillText(line, x, currentY);
  }
}

function getDefaultPositions(dims) {
  return {
    backLeft: (dims.zones.backLeft / dims.pxW) * 100,
    spineLeft: (dims.zones.spineLeft / dims.pxW) * 100,
    frontLeft: (dims.zones.frontLeft / dims.pxW) * 100,
    backW: (dims.pxTrimW / dims.pxW) * 100,
    spineW: (dims.pxSpine / dims.pxW) * 100,
    frontW: (dims.pxTrimW / dims.pxW) * 100,
    top: (dims.pxBleed / dims.pxH) * 100,
    panelH: (dims.pxTrimH / dims.pxH) * 100,
  };
}

function sanitizeLayer(layer, dims) {
  const pos = getDefaultPositions(dims);

  const type = layer?.type === 'image' ? 'image' : 'text';
  const isSpine = layer?.vertical || layer?.zone === 'spine';

  return {
    id: layer?.id || uid(type),
    name: layer?.name || (type === 'image' ? 'Image Layer' : 'Text Layer'),
    type,
    text: layer?.text || '',
    url: layer?.url || '',
    x: clampNumber(layer?.x, 0, 100, isSpine ? pos.spineLeft : pos.backLeft + 4),
    y: clampNumber(layer?.y, 0, 100, pos.top + 6),
    w: clampNumber(layer?.w, 1, 100, isSpine ? pos.spineW : pos.backW - 8),
    h: clampNumber(layer?.h, 1, 100, isSpine ? pos.panelH - 16 : 40),
    fontFamily: layer?.fontFamily || 'Georgia',
    fontSize: clampNumber(layer?.fontSize, 8, 72, isSpine ? 13 : 15),
    fontWeight: layer?.fontWeight || '400',
    color: layer?.color || '#f5efe3',
    align: layer?.align || (isSpine ? 'center' : 'left'),
    opacity: clampNumber(layer?.opacity, 0, 1, 1),
    vertical: !!layer?.vertical,
    visible: layer?.visible !== false,
  };
}

function buildInitialLayers(project, savedLayers, dims) {
  if (Array.isArray(savedLayers) && savedLayers.length > 0) {
    return savedLayers.map((layer) => sanitizeLayer(layer, dims));
  }

  const pos = getDefaultPositions(dims);

  return [
    {
      id: 'default-back-blurb',
      name: 'Back Cover Blurb',
      type: 'text',
      text:
        project?.description ||
        project?.tagline ||
        project?.seed_concept ||
        'Back cover blurb goes here. Add your book description, sales copy, praise quote, or author note.',
      x: pos.backLeft + 4,
      y: pos.top + 6,
      w: pos.backW - 8,
      h: 44,
      fontFamily: 'Georgia',
      fontSize: 15,
      fontWeight: '400',
      color: '#f5efe3',
      align: 'left',
      opacity: 1,
      vertical: false,
      visible: true,
    },
    {
      id: 'default-spine-title',
      name: 'Spine Title',
      type: 'text',
      text: project?.title || project?.title_working || 'Untitled',
      x: pos.spineLeft,
      y: pos.top + 8,
      w: pos.spineW,
      h: pos.panelH - 16,
      fontFamily: 'Georgia',
      fontSize: 13,
      fontWeight: '700',
      color: '#f6efe3',
      align: 'center',
      opacity: 1,
      vertical: true,
      visible: true,
    },
    {
      id: 'default-spine-author',
      name: 'Spine Author',
      type: 'text',
      text: project?.author_name || project?.author || 'Author',
      x: pos.spineLeft,
      y: pos.top + pos.panelH - 19,
      w: pos.spineW,
      h: 16,
      fontFamily: 'Arial',
      fontSize: 9,
      fontWeight: '700',
      color: '#f6efe3',
      align: 'center',
      opacity: 1,
      vertical: true,
      visible: true,
    },
  ];
}

export default function FullWrapComposite({ frontCanvas, project, onWrapCanvas }) {
  const backArtInputRef = useRef(null);
  const imageLayerInputRef = useRef(null);

  const defaultTrim = suggestTrimSize(project?.book_type);
  const saved = safeParse(project?.wrap_canvas_json);
  const savedSettings = saved?.settings || {};

  const savedLayers =
    saved?.version === SAVE_VERSION && Array.isArray(saved?.layers)
      ? saved.layers
      : [];

  const [trimLabel, setTrimLabel] = useState(savedSettings.trimLabel || defaultTrim.label);
  const [pageCount, setPageCount] = useState(
    savedSettings.pageCount || estimatePageCount(project?.total_word_target || 70000)
  );
  const [paperType, setPaperType] = useState(savedSettings.paperType || 'cream');
  const [selectedPreset, setSelectedPreset] = useState(savedSettings.selectedPreset || '');

  const [showGuides, setShowGuides] = useState(savedSettings.showGuides ?? true);
  const [showBarcode, setShowBarcode] = useState(savedSettings.showBarcode ?? true);
  // WAVE4-BARCODE: the real EAN-13 the ISBNBarcode component generates.
  // Previously discarded — exports shipped a gray "BARCODE / ISBN" box that
  // KDP/IngramSpark would reject.
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  const [backArtUrl, setBackArtUrl] = useState(savedSettings.backArtUrl || '');
  const [backArtPrompt, setBackArtPrompt] = useState(savedSettings.backArtPrompt || '');
  const [backOverlay, setBackOverlay] = useState(
    clampNumber(savedSettings.backOverlay, 0, 0.9, 0.45)
  );
  const [backBgColor, setBackBgColor] = useState(savedSettings.backBgColor || '#101010');
  const [spineBgColor, setSpineBgColor] = useState(savedSettings.spineBgColor || '#0b0b0b');
  const [publisherLogoUrl, setPublisherLogoUrl] = useState(
    savedSettings.publisherLogoUrl || project?.publisher_logo_url || ''
  );

  const [generatingBackArt, setGeneratingBackArt] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [savingState, setSavingState] = useState(false);

  const trim = KDP_SPECS.trimSizes.find((item) => item.label === trimLabel) || defaultTrim;

  const dims = useMemo(() => {
    return calculateCoverDimensions(trim.w, trim.h, pageCount, paperType);
  }, [trim.w, trim.h, pageCount, paperType]);

  const initialLayers = useMemo(() => {
    return buildInitialLayers(project, savedLayers, dims);
  }, [project, savedLayers, dims]);

  const [layers, setLayers] = useState(initialLayers);
  const [selectedLayerId, setSelectedLayerId] = useState(initialLayers[0]?.id || '');

  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) || null;
  const frontImageUrl = getFrontImageUrl(frontCanvas, project);

  const bleedPctX = (dims.pxBleed / dims.pxW) * 100;
  const bleedPctY = (dims.pxBleed / dims.pxH) * 100;

  const backW = (dims.pxTrimW / dims.pxW) * 100;
  const spineW = (dims.pxSpine / dims.pxW) * 100;
  const frontW = (dims.pxTrimW / dims.pxW) * 100;

  const backLeft = (dims.zones.backLeft / dims.pxW) * 100;
  const spineLeft = (dims.zones.spineLeft / dims.pxW) * 100;
  const frontLeft = (dims.zones.frontLeft / dims.pxW) * 100;

  const panelTop = bleedPctY;
  const panelH = (dims.pxTrimH / dims.pxH) * 100;

  const updateLayer = useCallback(
    (id, updates) => {
      setLayers((current) =>
        current.map((layer) =>
          layer.id === id
            ? sanitizeLayer(
                {
                  ...layer,
                  ...updates,
                },
                dims
              )
            : layer
        )
      );
    },
    [dims]
  );

  const addLayer = useCallback(
    (layer) => {
      const cleanLayer = sanitizeLayer(layer, dims);
      setLayers((current) => [...current, cleanLayer]);
      setSelectedLayerId(cleanLayer.id);
    },
    [dims]
  );

  const handleAddBackText = useCallback(() => {
    addLayer({
      id: uid('text'),
      name: 'Back Text',
      type: 'text',
      text: 'New back-cover text',
      x: backLeft + 5,
      y: panelTop + 12,
      w: backW - 10,
      h: 16,
      fontFamily: 'Georgia',
      fontSize: 15,
      fontWeight: '400',
      color: '#f5efe3',
      align: 'left',
      opacity: 1,
      vertical: false,
      visible: true,
    });
  }, [addLayer, backLeft, backW, panelTop]);

  const handleAddSpineText = useCallback(() => {
    addLayer({
      id: uid('spine-text'),
      name: 'Spine Text',
      type: 'text',
      text: 'SPINE TEXT',
      x: spineLeft,
      y: panelTop + 10,
      w: spineW,
      h: panelH - 20,
      fontFamily: 'Georgia',
      fontSize: 12,
      fontWeight: '700',
      color: '#f6efe3',
      align: 'center',
      opacity: 1,
      vertical: true,
      visible: true,
    });
  }, [addLayer, panelH, panelTop, spineLeft, spineW]);

  const handleAddPublisherLogo = useCallback(() => {
    if (!publisherLogoUrl?.trim()) {
      toast.error('Paste a publisher logo URL first.');
      return;
    }

    addLayer({
      id: uid('logo'),
      name: 'Publisher Logo',
      type: 'image',
      url: publisherLogoUrl.trim(),
      x: spineLeft + spineW * 0.15,
      y: panelTop + panelH - 14,
      w: Math.max(spineW * 0.7, 1.5),
      h: 7,
      opacity: 1,
      visible: true,
    });
  }, [addLayer, panelH, panelTop, publisherLogoUrl, spineLeft, spineW]);

  const handleAddImageLayerFromUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      setUploadingAsset(true);

      try {
        const uploaded = await bypassUploadFile({ file });
        const url = uploaded?.file_url || uploaded?.data?.file_url || uploaded?.url || uploaded;

        if (!url || typeof url !== 'string') {
          throw new Error('Upload returned no usable URL.');
        }

        addLayer({
          id: uid('image'),
          name: file.name || 'Image Layer',
          type: 'image',
          url,
          x: backLeft + 20,
          y: panelTop + 35,
          w: 18,
          h: 18,
          opacity: 1,
          visible: true,
        });

        toast.success('Image layer added');
      } catch (err) {
        toast.error('Image layer upload failed: ' + (err?.message || 'unknown error'));
      } finally {
        setUploadingAsset(false);
      }
    },
    [addLayer, backLeft, panelTop]
  );

  const handleDeleteLayer = useCallback(() => {
    if (!selectedLayer) return;

    setLayers((current) => current.filter((layer) => layer.id !== selectedLayer.id));
    setSelectedLayerId('');
  }, [selectedLayer]);

  const handleToggleLayer = useCallback((id) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === id
          ? {
              ...layer,
              visible: layer.visible === false,
            }
          : layer
      )
    );
  }, []);

  const moveSelectedLayer = useCallback(
    (direction) => {
      if (!selectedLayer) return;

      setLayers((current) => {
        const index = current.findIndex((layer) => layer.id === selectedLayer.id);
        if (index < 0) return current;

        const targetIndex = direction === 'up' ? index + 1 : index - 1;
        if (targetIndex < 0 || targetIndex >= current.length) return current;

        const next = [...current];
        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;

        return next;
      });
    },
    [selectedLayer]
  );

  const exportAsCanvas = useCallback(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = dims.pxW;
    canvas.height = dims.pxH;

    const ctx = canvas.getContext('2d');

    const spineX = dims.zones.spineLeft;
    const frontX = dims.zones.frontLeft;

    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = backBgColor;
    ctx.fillRect(0, 0, dims.zones.backRight, dims.pxH);

    if (backArtUrl) {
      await drawImageCover(ctx, backArtUrl, 0, 0, dims.zones.backRight, dims.pxH);
      ctx.fillStyle = `rgba(0,0,0,${backOverlay})`;
      ctx.fillRect(0, 0, dims.zones.backRight, dims.pxH);
    }

    ctx.fillStyle = spineBgColor;
    ctx.fillRect(spineX, 0, dims.pxSpine, dims.pxH);

    if (frontImageUrl) {
      await drawImageStretch(ctx, frontImageUrl, frontX, 0, dims.pxTrimW + dims.pxBleed, dims.pxH);
    } else {
      ctx.fillStyle = '#181818';
      ctx.fillRect(frontX, 0, dims.pxTrimW + dims.pxBleed, dims.pxH);
    }

    if (showBarcode) {
      const backX = dims.zones.backLeft;
      const backY = dims.pxBleed;
      const barcodeW = Math.min(Math.round(dims.pxTrimW * 0.32), 620);
      const barcodeH = Math.round(barcodeW * 0.62);
      const margin = Math.round(dims.pxTrimW * 0.075);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        backX + dims.pxTrimW - barcodeW - margin,
        backY + dims.pxTrimH - barcodeH - margin,
        barcodeW,
        barcodeH
      );

      if (barcodeDataUrl) {
        // WAVE4-BARCODE: draw the real EAN-13 inside the white quiet zone.
        const pad = Math.round(barcodeW * 0.05);
        await drawImageStretch(
          ctx,
          barcodeDataUrl,
          backX + dims.pxTrimW - barcodeW - margin + pad,
          backY + dims.pxTrimH - barcodeH - margin + pad,
          barcodeW - pad * 2,
          barcodeH - pad * 2
        );
      } else {
        ctx.strokeStyle = '#d8d8d8';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          backX + dims.pxTrimW - barcodeW - margin,
          backY + dims.pxTrimH - barcodeH - margin,
          barcodeW,
          barcodeH
        );

        ctx.fillStyle = '#999999';
        ctx.font = `${Math.max(18, barcodeW * 0.055)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          'BARCODE / ISBN',
          backX + dims.pxTrimW - barcodeW / 2 - margin,
          backY + dims.pxTrimH - barcodeH / 2 - margin
        );
        ctx.textAlign = 'left';
      }
    }

    for (const rawLayer of layers) {
      const layer = sanitizeLayer(rawLayer, dims);
      if (layer.visible === false) continue;

      const x = pctToPx(layer.x, dims.pxW);
      const y = pctToPx(layer.y, dims.pxH);
      const w = pctToPx(layer.w, dims.pxW);
      const h = pctToPx(layer.h, dims.pxH);

      ctx.save();
      ctx.globalAlpha = Number(layer.opacity ?? 1);

      if (layer.type === 'image' && layer.url) {
        await drawImageStretch(ctx, layer.url, x, y, w, h);
      }

      if (layer.type === 'text') {
        const fontSize = clampNumber(layer.fontSize, 8, 72, 15);
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.font = `${layer.fontWeight || '400'} ${Math.max(
          12,
          fontSize * 2.25
        )}px ${layer.fontFamily || 'Georgia'}`;
        ctx.textAlign = layer.align || 'left';
        ctx.textBaseline = 'top';

        if (layer.vertical) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.fillText(String(layer.text || '').toUpperCase(), 0, -fontSize);
        } else {
          drawWrappedText(
            ctx,
            layer.text || '',
            x,
            y,
            w,
            Math.max(22, fontSize * 2.55),
            h
          );
        }
      }

      ctx.restore();
    }

    return canvas;
  }, [
    backArtUrl,
    backBgColor,
    backOverlay,
    barcodeDataUrl,
    dims,
    frontImageUrl,
    layers,
    showBarcode,
    spineBgColor,
  ]);

  useEffect(() => {
    let cancelled = false;

    const emit = async () => {
      const canvas = await exportAsCanvas();

      if (!cancelled && canvas && onWrapCanvas) {
        onWrapCanvas(canvas, dims);
      }
    };

    emit();

    return () => {
      cancelled = true;
    };
  }, [exportAsCanvas, onWrapCanvas, dims]);

  const handlePresetChange = useCallback((key) => {
    setSelectedPreset(key);

    if (!key || key === 'custom') return;

    const preset = PUBLISHER_PRESETS[key];
    if (!preset || preset.unit !== 'inches') return;

    const matchedTrim = KDP_SPECS.trimSizes.find((size) => {
      return size.w === preset.trimWidth && size.h === preset.trimHeight;
    });

    if (matchedTrim) setTrimLabel(matchedTrim.label);

    if (preset.spineFormula === 'white' || preset.spineFormula === 'ingram_white') {
      setPaperType('white');
    }

    if (preset.spineFormula === 'cream' || preset.spineFormula === 'ingram_cream') {
      setPaperType('cream');
    }
  }, []);

  const handleGenerateBackArtPrompt = useCallback(() => {
    const prompt = [
      `A professional back cover background for a ${project?.genre || 'fiction'} book titled "${
        project?.title || project?.title_working || 'Untitled'
      }".`,
      'It should visually match the front cover but be calmer, darker, and less busy.',
      'Leave generous negative space for a back-cover blurb.',
      'No words, no typography, no logo, no barcode.',
      'Cinematic professional publishing-quality background.',
    ].join(' ');

    setBackArtPrompt(prompt);
  }, [project?.genre, project?.title, project?.title_working]);

  const handleGenerateBackArt = useCallback(async () => {
    setGeneratingBackArt(true);

    try {
      const result = await bypassGenerateImage({
        prompt:
          backArtPrompt ||
          `Dark professional back cover background for ${
            project?.title || project?.title_working || 'Untitled'
          }. No text, no typography, no logo, no barcode.`,
        size: '1024x1792',
        quality: 'hd',
        style: 'vivid',
      });

      const url = result?.url || result?.image_url || result?.data?.url;

      if (!url) throw new Error('Back art generation returned no image URL.');

      setBackArtUrl(url);
      toast.success('Back art generated');
    } catch (err) {
      toast.error('Back art failed: ' + (err?.message || 'unknown error'));
    } finally {
      setGeneratingBackArt(false);
    }
  }, [backArtPrompt, project?.title, project?.title_working]);

  const handleUploadBackArt = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setUploadingAsset(true);

    try {
      const uploaded = await bypassUploadFile({ file });
      const url = uploaded?.file_url || uploaded?.data?.file_url || uploaded?.url || uploaded;

      if (!url || typeof url !== 'string') {
        throw new Error('Upload returned no usable URL.');
      }

      setBackArtUrl(url);
      toast.success('Back art uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setUploadingAsset(false);
    }
  }, []);

  const handleGeneratedBarcode = useCallback((dataUrl) => {
    // WAVE4-BARCODE: keep the generated EAN-13 and use it on the wrap + export.
    if (dataUrl && typeof dataUrl === 'string') {
      setBarcodeDataUrl(dataUrl);
      setShowBarcode(true);
      toast.success('Barcode generated — it will print on the wrap and in the export.');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!project?.id) {
      toast.error('Project not loaded');
      return;
    }

    setSavingState(true);

    try {
      const cleanLayers = layers.map((layer) => sanitizeLayer(layer, dims));

      const payload = {
        version: SAVE_VERSION,
        mode: 'stable-dom-compositor-with-clickable-layers-clean-v14',
        settings: {
          trimLabel,
          pageCount,
          paperType,
          selectedPreset,
          showGuides,
          showBarcode,
          backArtUrl,
          backArtPrompt,
          backOverlay,
          backBgColor,
          spineBgColor,
          publisherLogoUrl,
        },
        layers: cleanLayers,
      };

      const canvas = await exportAsCanvas();

      let fileUrl = '';
      if (canvas) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
        const file = new File([blob], `${slug(project?.title || project?.title_working)}-full-wrap.png`, {
          type: 'image/png',
        });

        const uploaded = await bypassUploadFile({ file });
        fileUrl = uploaded?.file_url || uploaded?.data?.file_url || uploaded?.url || uploaded;
      }

      await base44.entities.NovelProject.update(project.id, {
        wrap_canvas_json: JSON.stringify(payload),
        // WAVE3-WRAPFIELD: single canonical field, now declared in the schema.
        full_wrap_cover_url: fileUrl || project?.full_wrap_cover_url || '',
      });

      setLayers(cleanLayers);
      toast.success('Full wrap saved');
    } catch (err) {
      toast.error('Save failed: ' + (err?.message || 'unknown error'));
    } finally {
      setSavingState(false);
    }
  }, [
    backArtPrompt,
    backArtUrl,
    backBgColor,
    backOverlay,
    dims,
    exportAsCanvas,
    layers,
    pageCount,
    paperType,
    project,
    publisherLogoUrl,
    selectedPreset,
    showBarcode,
    showGuides,
    spineBgColor,
    trimLabel,
  ]);

  const handleDownloadPNG = useCallback(async () => {
    const canvas = await exportAsCanvas();

    if (!canvas) {
      toast.error('Wrap not ready');
      return;
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${slug(project?.title || project?.title_working)}-full-wrap.png`;
    a.click();
  }, [exportAsCanvas, project?.title, project?.title_working]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[245px_minmax(0,1fr)_330px] overflow-hidden rounded-2xl border border-border/60 bg-card/60">
      <aside className="min-h-0 overflow-y-auto border-r border-border/60 bg-background/65 p-3">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Wrap Tools
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddBackText}
                className="h-8 justify-start gap-1.5 text-[10px]"
              >
                <Type className="h-3.5 w-3.5" />
                Back Text
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddSpineText}
                className="h-8 justify-start gap-1.5 text-[10px]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Spine Text
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => imageLayerInputRef.current?.click()}
                className="h-8 justify-start gap-1.5 text-[10px]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Image
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddPublisherLogo}
                className="h-8 justify-start gap-1.5 text-[10px]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Logo
              </Button>
            </div>

            <input
              ref={imageLayerInputRef}
              type="file"
              accept="image/*"
              onChange={handleAddImageLayerFromUpload}
              className="hidden"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Layers
              </p>
            </div>

            <div className="space-y-1">
              {[...layers].reverse().map((layer) => {
                const active = selectedLayerId === layer.id;

                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      active
                        ? 'bg-primary/15 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {layer.type === 'text' ? (
                      <Type className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5 shrink-0" />
                    )}

                    <span className="min-w-0 flex-1 truncate">{layer.name}</span>

                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleToggleLayer(layer.id);
                      }}
                      className="rounded p-0.5 hover:bg-muted"
                    >
                      {layer.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Full Wrap Builder
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {dims.totalWidth.toFixed(3)}" × {dims.totalHeight.toFixed(3)}"
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Spine {dims.spineWidth.toFixed(3)}"
            </Badge>
            <Button size="sm" variant="outline" onClick={handleDownloadPNG} className="h-8 gap-1 text-xs">
              <Download className="h-3.5 w-3.5" />
              PNG
            </Button>
            <Button size="sm" onClick={handleSave} disabled={savingState} className="h-8 gap-1 text-xs">
              {savingState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),rgba(0,0,0,0.26))] p-4">
          <div
            className="relative mx-auto overflow-hidden rounded-lg shadow-2xl"
            style={{
              width: '100%',
              maxWidth: '1180px',
              aspectRatio: `${dims.totalWidth} / ${dims.totalHeight}`,
              background: '#080808',
            }}
          >
            <div
              className="absolute z-0"
              style={{
                left: 0,
                top: 0,
                width: `${(dims.zones.backRight / dims.pxW) * 100}%`,
                height: '100%',
                background: backArtUrl
                  ? `linear-gradient(rgba(0,0,0,${backOverlay}), rgba(0,0,0,${backOverlay})), url("${backArtUrl}") center/cover no-repeat`
                  : backBgColor,
              }}
            />

            <div
              className="absolute z-0"
              style={{
                left: `${spineLeft}%`,
                top: 0,
                width: `${spineW}%`,
                height: '100%',
                background: spineBgColor,
              }}
            />

            <div
              className="absolute z-0"
              style={{
                left: `${frontLeft}%`,
                top: 0,
                width: `${frontW + bleedPctX}%`,
                height: '100%',
                background: frontImageUrl
                  ? `url("${frontImageUrl}") center/100% 100% no-repeat`
                  : '#181818',
              }}
            />

            {showBarcode && (
              <div
                className="absolute z-10 flex items-center justify-center rounded-sm border border-neutral-300 bg-white text-[9px] font-bold text-neutral-400"
                style={{
                  left: `${backLeft + backW - 18}%`,
                  top: `${panelTop + panelH - 17}%`,
                  width: '14%',
                  height: '9.5%',
                }}
              >
                {barcodeDataUrl ? (
                  <img src={barcodeDataUrl} alt="ISBN barcode" className="h-full w-full object-contain" />
                ) : (
                  'BARCODE / ISBN'
                )}
              </div>
            )}

            {layers.map((rawLayer) => {
              const layer = sanitizeLayer(rawLayer, dims);

              if (layer.visible === false) return null;

              const selected = selectedLayerId === layer.id;
              const fontSize = clampNumber(layer.fontSize, 8, 72, 15);

              if (layer.type === 'image') {
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`absolute z-30 block cursor-pointer overflow-hidden border bg-transparent ${
                      selected
                        ? 'border-primary ring-2 ring-primary/50'
                        : 'border-transparent hover:border-primary/60'
                    }`}
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.w}%`,
                      height: `${layer.h}%`,
                      opacity: layer.opacity ?? 1,
                      backgroundImage: layer.url ? `url("${layer.url}")` : undefined,
                      backgroundPosition: 'center',
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                    }}
                    title={layer.name}
                  />
                );
              }

              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`absolute z-30 block cursor-pointer whitespace-pre-wrap border bg-transparent p-0 text-left ${
                    selected
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-transparent hover:border-primary/60'
                  }`}
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: `${layer.w}%`,
                    height: `${layer.h}%`,
                    opacity: layer.opacity ?? 1,
                    color: layer.color || '#ffffff',
                    fontFamily: layer.fontFamily || 'Georgia',
                    fontSize: `${fontSize}px`,
                    fontWeight: layer.fontWeight || 400,
                    textAlign: layer.align || 'left',
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    writingMode: layer.vertical ? 'vertical-rl' : 'horizontal-tb',
                    transform: layer.vertical ? 'rotate(180deg)' : 'none',
                  }}
                  title={layer.name}
                >
                  {layer.text}
                </button>
              );
            })}

            {showGuides && (
              <div className="pointer-events-none absolute inset-0 z-40">
                <div className="absolute border border-blue-400/70" style={{ inset: 0 }} />
                <div
                  className="absolute border border-red-400/80"
                  style={{
                    left: `${bleedPctX}%`,
                    top: `${bleedPctY}%`,
                    right: `${bleedPctX}%`,
                    bottom: `${bleedPctY}%`,
                  }}
                />
                <div
                  className="absolute border-l border-r border-green-400/80"
                  style={{
                    left: `${spineLeft}%`,
                    top: 0,
                    width: `${spineW}%`,
                    height: '100%',
                  }}
                />
                <div
                  className="absolute border border-yellow-300/70"
                  style={{
                    left: `${backLeft + 4}%`,
                    top: `${panelTop + 4}%`,
                    width: `${backW - 8}%`,
                    height: `${panelH - 8}%`,
                  }}
                />
                <div
                  className="absolute border border-yellow-300/70"
                  style={{
                    left: `${frontLeft + 4}%`,
                    top: `${panelTop + 4}%`,
                    width: `${frontW - 8}%`,
                    height: `${panelH - 8}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto border-l border-border/60 bg-background/65 p-4">
        <div className="space-y-4">
          {selectedLayer ? (
            <LayerProperties
              layer={selectedLayer}
              updateLayer={updateLayer}
              deleteLayer={handleDeleteLayer}
              moveLayer={moveSelectedLayer}
            />
          ) : (
            <div className="rounded-xl border border-border/60 bg-card/50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  No Layer Selected
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Click a layer on the left or click text/image on the wrap preview.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Wrap Settings
            </p>

            <PublisherPresets selectedPreset={selectedPreset} onSelectPreset={handlePresetChange} />

            <SpineCalculator
              pageCount={pageCount}
              paperType={paperType}
              onApply={(pages, paper) => {
                setPageCount(Math.max(24, Number(pages) || 24));

                const paperMap = {
                  white: 'white',
                  cream: 'cream',
                  color: 'color',
                  ingram_white: 'white',
                  ingram_cream: 'cream',
                };

                setPaperType(paperMap[paper] || 'cream');
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                  Trim Size
                </label>
                <Select value={trimLabel} onValueChange={setTrimLabel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KDP_SPECS.trimSizes.map((size) => (
                      <SelectItem key={size.label} value={size.label}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                  Paper
                </label>
                <Select value={paperType} onValueChange={setPaperType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="cream">Cream</SelectItem>
                    <SelectItem value="color">Color</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                  Page Count
                </label>
                <Input
                  type="number"
                  value={pageCount}
                  onChange={(event) => setPageCount(Math.max(24, Number(event.target.value) || 24))}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                  Spine Width
                </label>
                <div className="flex h-8 items-center rounded-md border border-border bg-background px-2 text-xs font-semibold">
                  {dims.spineWidth.toFixed(3)}"
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Back Art
            </p>

            <Textarea
              value={backArtPrompt}
              onChange={(event) => setBackArtPrompt(event.target.value)}
              className="min-h-[90px] text-xs"
              placeholder="Describe the back-cover background..."
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateBackArtPrompt}
                className="h-8 flex-1 gap-1 text-[10px]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto Prompt
              </Button>

              <Button
                size="sm"
                onClick={handleGenerateBackArt}
                disabled={generatingBackArt}
                className="h-8 flex-1 gap-1 text-[10px]"
              >
                {generatingBackArt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Gen Back Art
              </Button>
            </div>

            <input
              ref={backArtInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadBackArt}
              className="hidden"
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => backArtInputRef.current?.click()}
              disabled={uploadingAsset}
              className="h-8 w-full gap-1 text-[10px]"
            >
              {uploadingAsset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Upload Back Art
            </Button>

            {backArtUrl && (
              <div className="overflow-hidden rounded-lg border border-border">
                <img src={backArtUrl} alt="Back art" className="aspect-[2/3] w-full object-cover" />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                Back Art Darkness: {Math.round(backOverlay * 100)}%
              </label>
              <Slider
                value={[Math.round(backOverlay * 100)]}
                onValueChange={([value]) => setBackOverlay(value / 100)}
                min={0}
                max={90}
                step={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Back Base" value={backBgColor} onChange={setBackBgColor} />
              <ColorInput label="Spine Base" value={spineBgColor} onChange={setSpineBgColor} />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Publisher Logo URL
            </p>
            <Input
              value={publisherLogoUrl}
              onChange={(event) => setPublisherLogoUrl(event.target.value)}
              className="h-8 text-xs"
              placeholder="Paste logo image URL..."
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Barcode
            </p>

            <ISBNBarcode project={project} onBarcodeGenerated={handleGeneratedBarcode} />
            <ToggleRow label="Show barcode" checked={showBarcode} onChange={setShowBarcode} />
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Guides
            </p>
            <ToggleRow label="Show visual guides" checked={showGuides} onChange={setShowGuides} />
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={savingState}
            className="h-9 w-full gap-1 text-xs"
          >
            {savingState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Full Wrap
          </Button>
        </div>
      </aside>
    </div>
  );
}

function LayerProperties({ layer, updateLayer, deleteLayer, moveLayer }) {
  const cleanFontSize = clampNumber(layer.fontSize, 8, 72, 15);

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Selected Layer
      </p>

      <Input
        value={layer.name || ''}
        onChange={(event) => updateLayer(layer.id, { name: event.target.value })}
        className="h-8 text-xs"
        placeholder="Layer name"
      />

      {layer.type === 'text' && (
        <>
          <Textarea
            value={layer.text || ''}
            onChange={(event) => updateLayer(layer.id, { text: event.target.value })}
            className="min-h-[90px] text-xs"
            placeholder="Text..."
          />

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
              Font
            </label>
            <Select
              value={layer.fontFamily || 'Georgia'}
              onValueChange={(value) => updateLayer(layer.id, { fontFamily: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumberInput
            label="Font Size"
            value={cleanFontSize}
            onChange={(value) =>
              updateLayer(layer.id, {
                fontSize: clampNumber(value, 8, 72, 15),
              })
            }
          />

          <ColorInput
            label="Text Color"
            value={layer.color || '#ffffff'}
            onChange={(value) => updateLayer(layer.id, { color: value })}
          />

          <ToggleRow
            label="Vertical spine text"
            checked={!!layer.vertical}
            onChange={(checked) => updateLayer(layer.id, { vertical: checked })}
          />
        </>
      )}

      {layer.type === 'image' && (
        <Input
          value={layer.url || ''}
          onChange={(event) => updateLayer(layer.id, { url: event.target.value })}
          className="h-8 text-xs"
          placeholder="Image URL"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="X %"
          value={clampNumber(layer.x, 0, 100, 0)}
          onChange={(value) => updateLayer(layer.id, { x: clampNumber(value, 0, 100, 0) })}
        />
        <NumberInput
          label="Y %"
          value={clampNumber(layer.y, 0, 100, 0)}
          onChange={(value) => updateLayer(layer.id, { y: clampNumber(value, 0, 100, 0) })}
        />
        <NumberInput
          label="W %"
          value={clampNumber(layer.w, 1, 100, 10)}
          onChange={(value) => updateLayer(layer.id, { w: clampNumber(value, 1, 100, 10) })}
        />
        <NumberInput
          label="H %"
          value={clampNumber(layer.h, 1, 100, 10)}
          onChange={(value) => updateLayer(layer.id, { h: clampNumber(value, 1, 100, 10) })}
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
          Opacity: {Math.round(clampNumber(layer.opacity, 0, 1, 1) * 100)}%
        </label>
        <Slider
          value={[Math.round(clampNumber(layer.opacity, 0, 1, 1) * 100)]}
          onValueChange={([value]) => updateLayer(layer.id, { opacity: value / 100 })}
          min={0}
          max={100}
          step={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => moveLayer('up')} className="h-8 text-[10px]">
          Bring Forward
        </Button>
        <Button size="sm" variant="outline" onClick={() => moveLayer('down')} className="h-8 text-[10px]">
          Send Back
        </Button>
      </div>

      <Button
        size="sm"
        variant="destructive"
        onClick={deleteLayer}
        className="h-8 w-full gap-1 text-[10px]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Layer
      </Button>
    </div>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
        {label}
      </label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
        {label}
      </label>
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full cursor-pointer rounded-md border border-border bg-background"
      />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded"
      />
    </label>
  );
}