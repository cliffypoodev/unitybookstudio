// ===========================================================
// Fabric.js Front Cover Editor — native-cover safe rewrite
//
// Purpose:
//   - Load the selected cover image as a flattened finished cover/background.
//   - DO NOT auto-create Title / Subtitle / Author / Title Band / Author Band.
//   - Keep manual editing tools: Add Text, Shape, Delete, Undo/Redo, Zoom,
//     Layers, Templates, Rich Text, Alignment, and Properties.
//   - Protect the background image from selection/deletion.
//   - Clean up legacy auto-generated default layers if they exist in old saved
//     canvas JSON, while preserving layers the user manually creates now.
//
// This file intentionally removes the old buildDefaultObjects() behavior.
// Native generated covers already contain the title/author/subtitle.
// ===========================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

import EditorToolbar from '@/components/cover/EditorToolbar';
import LayerPanel from '@/components/cover/LayerPanel';
import PropertyPanel from '@/components/cover/PropertyPanel';
import RichTextToolbar from '@/components/cover/RichTextToolbar';
import AlignmentToolbar from '@/components/cover/AlignmentToolbar';
import ZoomControl from '@/components/cover/ZoomControl';
import TemplatesPicker from '@/components/cover/TemplatesPicker';
import PublisherLogoUpload from '@/components/cover/PublisherLogoUpload';

import { createHistory } from '@/lib/coverHistory';
import { createSnapGuides } from '@/lib/coverSnapGuides';
import { useCoverKeyboard } from '@/lib/coverKeyboard';
import {
  alignLeft,
  alignCenterH,
  alignRight,
  alignTop,
  alignCenterV,
  alignBottom,
  distributeH,
  distributeV,
  getSelectionCount,
} from '@/lib/coverAlignment';
import { buildTemplateObjects } from '@/lib/coverTemplates';

import { Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CANVAS_W = 1200;
const CANVAS_H = 1800;

const CANVAS_JSON_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'lineHeight',
  'charSpacing',
  'fill',
  'styles',
  'shadow',
  '_fabricEditorId',
  '_fabricEditorName',
  '_coverEditorSource',
  'selectable',
  'evented',
  'hasControls',
  'visible',
  'opacity',
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
];

const LEGACY_AUTO_DEFAULT_IDS = new Set([
  'title',
  'subtitle',
  'author',
  'title-band',
  'author-band',
]);

function safeParseCanvasJson(value) {
  if (!value) return null;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (err) {
    console.warn('[COVER] Failed to parse cover_canvas_json:', err?.message);
    return null;
  }
}

function isLegacyAutoDefaultLayer(objectJson) {
  const id = objectJson?._fabricEditorId;
  if (!LEGACY_AUTO_DEFAULT_IDS.has(id)) return false;

  // New objects created by applying a template inside this rewritten editor
  // are explicitly marked so they can survive save/load.
  if (objectJson?._coverEditorSource === 'manual-template') return false;
  if (objectJson?._coverEditorSource === 'manual-user') return false;

  return true;
}

function markManualTemplateObjects(objects) {
  objects.forEach((obj) => {
    obj._coverEditorSource = 'manual-template';
  });
  return objects;
}

function ensureObjectIdentity(obj, fallbackPrefix = 'object') {
  if (!obj._fabricEditorId) {
    obj._fabricEditorId = `${fallbackPrefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  if (!obj._fabricEditorName) {
    obj._fabricEditorName = obj.type || 'Object';
  }

  return obj;
}

function isBackgroundObject(obj) {
  return obj?._fabricEditorId === 'background';
}

export default function FabricEditor({ artUrl, project, onCanvasReady }) {
  // WAVE11-REFRESH: saving wrote to the entity but nothing invalidated the
  // cached project, and the query is configured refetchOnWindowFocus:false. So
  // the `project` prop stayed frozen at page-load value for the whole session,
  // and a remount hydrated from it — handing the writer back the canvas they
  // started with. Every save now marks the project stale.
  const queryClient = useQueryClient();
  const onSavedRef = useRef(() => {});

  const containerRef = useRef(null);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const historyRef = useRef(null);
  const snapRef = useRef(null);
  const onCanvasReadyRef = useRef(onCanvasReady);

  onCanvasReadyRef.current = onCanvasReady;

  const [canvasVersion, setCanvasVersion] = useState(0);
  const [activeObject, setActiveObject] = useState(null);
  const [objects, setObjects] = useState([]);
  const [selectionCount, setSelectionCount] = useState(0);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const [fitZoom, setFitZoom] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const isManualZoomRef = useRef(false);

  const autosaveTimerRef = useRef(null);
  const isHydratingRef = useRef(false);
  // WAVE11-FLUSH: is there an edit that has not reached the server yet?
  const pendingSaveRef = useRef(false);
  // Read inside the unmount cleanup, where the `project` closure may be stale.
  const projectIdRef = useRef(project?.id);
  // WAVE11-REHYDRATE: hydration must SEE the latest saved canvas but must not
  // RE-RUN when it changes, or every autosave would reload the canvas 3 seconds
  // after the writer touched it. Ref in, not dependency.
  const savedCanvasRef = useRef(project?.cover_canvas_json);

  const bumpVersion = useCallback(() => {
    setCanvasVersion((v) => v + 1);
  }, []);

  const syncObjects = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const layerObjects = fc.getObjects().map((o, i) => ({
      id: o._fabricEditorId || `obj-${i}`,
      type: o.type,
      name: o._fabricEditorName || o.type || 'Object',
      visible: o.visible !== false,
      locked: isBackgroundObject(o) || o.selectable === false,
    }));

    setObjects(layerObjects);
  }, []);

  const refreshHistoryState = useCallback(() => {
    if (!historyRef.current) return;

    const state = historyRef.current.state();
    setHistoryState({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    });
  }, []);

  useEffect(() => {
    onSavedRef.current = () => {
      if (projectIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['novel-project', projectIdRef.current] });
      }
    };
  }, [queryClient]);

  useEffect(() => { projectIdRef.current = project?.id; }, [project?.id]);
  useEffect(() => { savedCanvasRef.current = project?.cover_canvas_json; }, [project?.cover_canvas_json]);

  const saveCanvasNow = useCallback(async () => {
    const fc = fabricRef.current;
    if (!fc || !project?.id || isHydratingRef.current) return;

    try {
      // WAVE11-SERIALIZE: fabric v7's toJSON() takes NO arguments — it is
      // literally `toJSON() { return this.toObject(); }`. Passing a property
      // list to it silently did nothing, so every custom key was stripped on
      // save: `_fabricEditorId`, `_fabricEditorName`, `selectable`, and the
      // lock* flags.
      //
      // The consequence was not cosmetic. Hydration skips saved objects tagged
      // `_fabricEditorId === 'background'`; that tag was never in the JSON, so
      // the saved cover art was re-added ON TOP of the freshly-created
      // background every single load — unlocked and selectable, because those
      // flags were stripped too. Two images, then three. And the writer could
      // drag or delete their own cover art, or grab it by accident when
      // reaching for a text layer.
      //
      // toObject() honours the list. It is the method toJSON delegates to.
      const json = JSON.stringify(fc.toObject(CANVAS_JSON_PROPS));
      await base44.entities.NovelProject.update(project.id, {
        cover_canvas_json: json,
      });
      pendingSaveRef.current = false;
      onSavedRef.current?.();
    } catch (err) {
      console.warn('[COVER] Auto-save failed:', err?.message);
    }
  }, [project?.id]);

  const scheduleAutosave = useCallback(() => {
    if (isHydratingRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    pendingSaveRef.current = true;
    autosaveTimerRef.current = setTimeout(() => {
      saveCanvasNow();
    }, 3000);
  }, [saveCanvasNow]);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const fc = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = fc;

    const handleSelectionCreated = (event) => {
      const selected = event.selected?.[0] || null;
      setActiveObject(selected);
      setSelectionCount(getSelectionCount(fc));
      bumpVersion();
    };

    const handleSelectionUpdated = (event) => {
      const selected = event.selected?.[0] || null;
      setActiveObject(selected);
      setSelectionCount(getSelectionCount(fc));
      bumpVersion();
    };

    const handleSelectionCleared = () => {
      setActiveObject(null);
      setSelectionCount(0);
      bumpVersion();
    };

    const handleObjectChanged = () => {
      syncObjects();
      bumpVersion();
      refreshHistoryState();
      scheduleAutosave();
    };

    fc.on('selection:created', handleSelectionCreated);
    fc.on('selection:updated', handleSelectionUpdated);
    fc.on('selection:cleared', handleSelectionCleared);
    fc.on('object:added', handleObjectChanged);
    fc.on('object:removed', handleObjectChanged);
    fc.on('object:modified', handleObjectChanged);
    fc.on('text:changed', handleObjectChanged);

    const history = createHistory(fc, {
      jsonProps: CANVAS_JSON_PROPS,
    });
    history.attach();
    historyRef.current = history;

    const snap = createSnapGuides(fc, {
      canvasW: CANVAS_W,
      canvasH: CANVAS_H,
    });
    snap.attach();
    snapRef.current = snap;

    if (onCanvasReadyRef.current) {
      onCanvasReadyRef.current(fc);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      // WAVE11-FLUSH: the debounced save was CANCELLED here and never run.
      // CoverCreator unmounts this editor on any view switch, so clicking
      // "Full Wrap" within 3s of your last edit threw that edit away — and
      // because hydration re-read a project prop that is never refreshed after
      // a write, it threw away the whole session's work, not just 3 seconds of
      // it. The next edit then autosaved the reverted canvas over the good copy.
      //
      // Serialize synchronously while the canvas still exists; the network write
      // can finish after we are gone.
      if (pendingSaveRef.current && projectIdRef.current && !isHydratingRef.current) {
        try {
          const json = JSON.stringify(fc.toObject(CANVAS_JSON_PROPS));
          base44.entities.NovelProject.update(projectIdRef.current, { cover_canvas_json: json })
            .then(() => { onSavedRef.current?.(); })
            .catch((err) => console.warn('[COVER] Flush-on-unmount failed:', err?.message));
        } catch (err) {
          console.warn('[COVER] Flush-on-unmount could not serialize:', err?.message);
        }
      }
      pendingSaveRef.current = false;

      fc.off('selection:created', handleSelectionCreated);
      fc.off('selection:updated', handleSelectionUpdated);
      fc.off('selection:cleared', handleSelectionCleared);
      fc.off('object:added', handleObjectChanged);
      fc.off('object:removed', handleObjectChanged);
      fc.off('object:modified', handleObjectChanged);
      fc.off('text:changed', handleObjectChanged);

      history.detach();
      snap.detach();
      fc.dispose();

      fabricRef.current = null;
      historyRef.current = null;
      snapRef.current = null;
    };
  }, [
    bumpVersion,
    refreshHistoryState,
    scheduleAutosave,
    syncObjects,
  ]);

  useEffect(() => {
    const fitCanvas = () => {
      const container = containerRef.current;
      const fc = fabricRef.current;

      if (!container || !fc) return;

      const maxW = Math.max(container.clientWidth - 16, 1);
      const maxH = Math.max(container.clientHeight - 16, 1);
      const scale = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1);

      setFitZoom(scale);

      if (!isManualZoomRef.current) {
        setUserZoom(scale);
      }
    };

    fitCanvas();

    window.addEventListener('resize', fitCanvas);
    return () => window.removeEventListener('resize', fitCanvas);
  }, []);

  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    fc.setZoom(userZoom);
    fc.setDimensions({
      width: CANVAS_W * userZoom,
      height: CANVAS_H * userZoom,
    });
    fc.calcOffset();
    fc.renderAll();
  }, [userZoom]);

  const handleUserZoom = useCallback((zoomValue) => {
    isManualZoomRef.current = true;
    setUserZoom(zoomValue);
  }, []);

  const handleFit = useCallback(() => {
    isManualZoomRef.current = false;
    setUserZoom(fitZoom);
  }, [fitZoom]);

  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !artUrl) return;

    let cancelled = false;

    const hydrateCanvas = async () => {
      isHydratingRef.current = true;

      try {
        fc.discardActiveObject();

        const allObjects = [...fc.getObjects()];
        allObjects.forEach((obj) => fc.remove(obj));

        const img = await fabric.FabricImage.fromURL(artUrl, {
          crossOrigin: 'anonymous',
        });

        if (cancelled) return;

        const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: CANVAS_W / 2,
          top: CANVAS_H / 2,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          hasControls: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
        });

        img._fabricEditorId = 'background';
        img._fabricEditorName = 'Background Image';
        img._coverEditorSource = 'native-cover-background';

        fc.add(img);
        fc.sendObjectToBack(img);

        const saved = safeParseCanvasJson(savedCanvasRef.current);

        if (saved?.objects?.length) {
          const userObjects = saved.objects.filter((objectJson) => {
            if (!objectJson) return false;
            if (objectJson._fabricEditorId === 'background') return false;

            // This is the important cleanup:
            // old saved canvas states may contain the automatic title/author/band
            // layers created by the previous FabricEditor. Native covers should
            // not resurrect those.
            if (isLegacyAutoDefaultLayer(objectJson)) return false;

            return true;
          });

          if (userObjects.length > 0) {
            const instances = await fabric.util.enlivenObjects(userObjects);

            if (cancelled) return;

            instances.forEach((obj) => {
              ensureObjectIdentity(obj, 'restored');
              fc.add(obj);
            });
          }
        }

        fc.discardActiveObject();
        fc.renderAll();
        syncObjects();
        bumpVersion();

        historyRef.current?.captureInitial();
        refreshHistoryState();
      } catch (err) {
        console.warn('[COVER] Front cover hydration failed:', err?.message);

        fc.renderAll();
        syncObjects();
        bumpVersion();

        toast.error('Could not fully load the front cover editor.');
      } finally {
        isHydratingRef.current = false;
      }
    };

    hydrateCanvas();

    return () => {
      cancelled = true;
    };
  }, [
    artUrl,
    project?.id,
    syncObjects,
    bumpVersion,
    refreshHistoryState,
  ]);

  const handleAddText = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const txt = new fabric.Textbox('New Text', {
      left: CANVAS_W / 2,
      top: CANVAS_H / 2,
      originX: 'center',
      originY: 'center',
      width: 520,
      fontFamily: 'Cormorant Garamond',
      fontSize: 56,
      fontWeight: '600',
      fill: '#fffaf0',
      textAlign: 'center',
      lineHeight: 1.1,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.55)',
        blur: 6,
        offsetX: 2,
        offsetY: 2,
      }),
    });

    txt._fabricEditorId = `manual-text-${Date.now()}`;
    txt._fabricEditorName = 'Text';
    txt._coverEditorSource = 'manual-user';

    fc.add(txt);
    fc.setActiveObject(txt);
    fc.renderAll();

    syncObjects();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave, syncObjects]);

  const handleAddShape = useCallback((shape) => {
    const fc = fabricRef.current;
    if (!fc) return;

    let obj = null;

    if (shape === 'rect') {
      obj = new fabric.Rect({
        left: CANVAS_W / 2 - 125,
        top: CANVAS_H / 2 - 80,
        width: 250,
        height: 160,
        fill: 'rgba(0,0,0,0.42)',
        rx: 14,
        ry: 14,
      });
    }

    if (shape === 'circle') {
      obj = new fabric.Circle({
        left: CANVAS_W / 2 - 85,
        top: CANVAS_H / 2 - 85,
        radius: 85,
        fill: 'rgba(0,0,0,0.42)',
      });
    }

    if (shape === 'line') {
      obj = new fabric.Line(
        [CANVAS_W * 0.2, CANVAS_H / 2, CANVAS_W * 0.8, CANVAS_H / 2],
        {
          stroke: '#fffaf0',
          strokeWidth: 4,
        }
      );
    }

    if (!obj) return;

    obj._fabricEditorId = `manual-shape-${Date.now()}`;
    obj._fabricEditorName = shape.charAt(0).toUpperCase() + shape.slice(1);
    obj._coverEditorSource = 'manual-user';

    fc.add(obj);
    fc.setActiveObject(obj);
    fc.renderAll();

    syncObjects();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave, syncObjects]);

  const removeObjects = useCallback((targets) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const removable = targets.filter((obj) => obj && !isBackgroundObject(obj));

    if (removable.length === 0) return;

    removable.forEach((obj) => fc.remove(obj));

    fc.discardActiveObject();
    fc.renderAll();

    setActiveObject(null);
    setSelectionCount(0);
    syncObjects();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave, syncObjects]);

  const handleDelete = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const active = fc.getActiveObject();
    if (!active) return;

    if (active.type === 'activeSelection') {
      removeObjects(active.getObjects());
      return;
    }

    removeObjects([active]);
  }, [removeObjects]);

  const handleBulkDelete = useCallback((ids) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const idSet = new Set(ids);
    const toRemove = fc.getObjects().filter((obj) => {
      if (isBackgroundObject(obj)) return false;
      return idSet.has(obj._fabricEditorId);
    });

    removeObjects(toRemove);
  }, [removeObjects]);

  const handleLayerReorder = useCallback((fromIdxReversed, toIdxReversed) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const allObjects = fc.getObjects();
    const count = allObjects.length;

    const fromIdx = count - 1 - fromIdxReversed;
    const toIdx = count - 1 - toIdxReversed;

    const obj = allObjects[fromIdx];

    if (!obj || isBackgroundObject(obj)) return;

    if (toIdx <= 0) {
      // Index 0 is reserved for the locked cover background.
      return;
    }

    if (typeof fc.moveObjectTo === 'function') {
      fc.moveObjectTo(obj, toIdx);
    } else {
      fc.remove(obj);
      fc.insertAt(toIdx, obj);
    }

    const bg = fc.getObjects().find((candidate) => isBackgroundObject(candidate));
    if (bg) {
      fc.sendObjectToBack(bg);
    }

    fc.renderAll();
    syncObjects();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave, syncObjects]);

  const handleSelectLayer = useCallback((id) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const obj = fc.getObjects().find((candidate) => candidate._fabricEditorId === id);

    if (!obj || obj.selectable === false || isBackgroundObject(obj)) {
      fc.discardActiveObject();
      setActiveObject(null);
      setSelectionCount(0);
      fc.renderAll();
      return;
    }

    fc.setActiveObject(obj);
    fc.renderAll();

    setActiveObject(obj);
    setSelectionCount(getSelectionCount(fc));
    bumpVersion();
  }, [bumpVersion]);

  const handleToggleVisibility = useCallback((id) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const obj = fc.getObjects().find((candidate) => candidate._fabricEditorId === id);
    if (!obj) return;

    obj.visible = obj.visible === false;

    fc.renderAll();
    syncObjects();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave, syncObjects]);

  const handleUpdateProperty = useCallback((key, value) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const active = fc.getActiveObject();
    if (!active || isBackgroundObject(active)) return;

    if (key === 'shadow') {
      active.set('shadow', value ? new fabric.Shadow(value) : null);
    } else {
      active.set(key, value);
    }

    active.setCoords();
    fc.renderAll();

    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave]);

  // WAVE11-TOOLBARSAVE: RichTextToolbar mutates the object with obj.set(), which
  // fires no canvas event — so neither the autosave listener nor the history
  // listener ever saw it. Font, size, bold, italic, alignment, colour, line
  // height and letter spacing were all discarded on reload, unless the writer
  // happened to drag the object afterwards and trip object:modified by accident.
  const handleToolbarChanged = useCallback(() => {
    const fc = fabricRef.current;
    bumpVersion();
    if (fc) {
      const active = fc.getActiveObject();
      // Let history record it as a real edit, same as a drag or resize would.
      if (active) fc.fire('object:modified', { target: active });
    }
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave]);

  const handleAlign = useCallback((anchor) => {
    const fc = fabricRef.current;
    if (!fc) return;

    switch (anchor) {
      case 'left':
        alignLeft(fc);
        break;
      case 'centerH':
        alignCenterH(fc);
        break;
      case 'right':
        alignRight(fc);
        break;
      case 'top':
        alignTop(fc);
        break;
      case 'centerV':
        alignCenterV(fc);
        break;
      case 'bottom':
        alignBottom(fc);
        break;
      default:
        break;
    }

    fc.renderAll();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave]);

  const handleDistribute = useCallback((axis) => {
    const fc = fabricRef.current;
    if (!fc) return;

    if (axis === 'h') {
      distributeH(fc);
    } else {
      distributeV(fc);
    }

    fc.renderAll();
    bumpVersion();
    scheduleAutosave();
  }, [bumpVersion, scheduleAutosave]);

  const handleUndo = useCallback(() => {
    historyRef.current?.undo();

    setTimeout(() => {
      syncObjects();
      refreshHistoryState();
      bumpVersion();
      scheduleAutosave();
    }, 100);
  }, [bumpVersion, refreshHistoryState, scheduleAutosave, syncObjects]);

  const handleRedo = useCallback(() => {
    historyRef.current?.redo();

    setTimeout(() => {
      syncObjects();
      refreshHistoryState();
      bumpVersion();
      scheduleAutosave();
    }, 100);
  }, [bumpVersion, refreshHistoryState, scheduleAutosave, syncObjects]);

  const handleApplyTemplate = useCallback((templateId) => {
    const fc = fabricRef.current;
    if (!fc) return;

    const editableObjects = fc.getObjects().filter((obj) => !isBackgroundObject(obj));
    editableObjects.forEach((obj) => fc.remove(obj));

    const templateObjects = markManualTemplateObjects(buildTemplateObjects(templateId, project));
    templateObjects.forEach((obj) => {
      ensureObjectIdentity(obj, 'template');
      fc.add(obj);
    });

    const bg = fc.getObjects().find((obj) => isBackgroundObject(obj));
    if (bg) {
      fc.sendObjectToBack(bg);
    }

    fc.discardActiveObject();
    fc.renderAll();

    setActiveObject(null);
    setSelectionCount(0);
    syncObjects();
    bumpVersion();
    scheduleAutosave();

    toast.success('Applied template');
  }, [bumpVersion, project, scheduleAutosave, syncObjects]);

  useCoverKeyboard(fabricRef, {
    onDelete: handleDelete,
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      <div className="w-[220px] shrink-0 overflow-y-auto border-r border-border/50 bg-card/40 p-3 space-y-4">
        <LayerPanel
          objects={objects}
          activeId={activeObject?._fabricEditorId}
          onSelect={handleSelectLayer}
          onReorder={handleLayerReorder}
          onToggleVisibility={handleToggleVisibility}
          onBulkDelete={handleBulkDelete}
        />

        <TemplatesPicker onApply={handleApplyTemplate} />
        {/* WAVE4-COVERWIRING: the logo uploader finally gets the project prop
            it always needed — uploading no longer throws on project.id. */}
        <PublisherLogoUpload
                project={project}
                onLogoChange={() => {
                  // WAVE11-LOGO: nothing was listening, so the wrap view could not
                  // see a logo uploaded in this session either.
                  if (project?.id) {
                    queryClient.invalidateQueries({ queryKey: ['novel-project', project.id] });
                  }
                }}
              />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onDelete={handleDelete}
          hasSelection={!!activeObject && !isBackgroundObject(activeObject)}
        />

        <RichTextToolbar
          key={`rich-${canvasVersion}`}
          activeObject={activeObject && !isBackgroundObject(activeObject) ? activeObject : null}
          canvas={fabricRef.current}
          onUpdate={handleToolbarChanged}
        />

        <div className="flex items-center gap-2 border-b border-border/50 bg-card/60 px-3 py-1.5 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            disabled={!historyState.canUndo}
            onClick={handleUndo}
            className="h-7 w-7 p-0"
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={!historyState.canRedo}
            onClick={handleRedo}
            className="h-7 w-7 p-0"
            title="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          <AlignmentToolbar
            selectionCount={selectionCount}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
          />

          <div className="ml-auto">
            <ZoomControl
              canvasContainerRef={containerRef}
              fitZoom={fitZoom}
              userZoom={userZoom}
              setUserZoom={handleUserZoom}
              onFit={handleFit}
            />
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex flex-1 items-center justify-center overflow-auto bg-transparent"
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>

      <div className="w-[220px] shrink-0 overflow-y-auto border-l border-border/50 bg-card/40 p-3">
        <PropertyPanel
          key={`props-${canvasVersion}`}
          activeObject={activeObject && !isBackgroundObject(activeObject) ? activeObject : null}
          onUpdate={handleUpdateProperty}
        />
      </div>
    </div>
  );
}