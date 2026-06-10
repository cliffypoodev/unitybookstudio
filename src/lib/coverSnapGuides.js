/**
 * Cover Snap Guides
 *
 * When the user drags an object, snap its position to meaningful references:
 *   - Canvas horizontal center
 *   - Canvas vertical center
 *   - Canvas edges (left/top/right/bottom)
 *   - Other objects' edges and centers (Canva-style)
 *
 * When snapping occurs, a visual guide line renders briefly on the canvas
 * to show the user which axis snapped. Guides clear when the object is
 * released (object:modified).
 *
 * IMPLEMENTATION NOTES
 *   - Uses Fabric's `object:moving` event to intercept coordinates
 *     mid-drag. This fires on every mouse-move while dragging.
 *   - Snap threshold is 8px — tight enough to not steal ownership from
 *     the user's drag, loose enough to feel helpful.
 *   - Guide rendering uses Fabric's `after:render` hook to draw lines
 *     on the upper canvas context without polluting the object tree.
 *     This avoids the guides being serialized into history/save.
 *   - We store guide coordinates in a closure variable and refresh them
 *     on every object:moving event.
 */

const SNAP_THRESHOLD = 8; // pixels, in canvas (un-zoomed) coordinates

export function createSnapGuides(canvas, options = {}) {
  const canvasW = options.canvasW || canvas.width;
  const canvasH = options.canvasH || canvas.height;

  // Current active guide lines — each entry is {x, y, x2, y2, color}
  let activeGuides = [];

  /**
   * Check if two values are within SNAP_THRESHOLD, accounting for the
   * current zoom level (snap at 8 screen px, not 8 canvas px at 2x zoom).
   */
  function near(a, b) {
    const zoom = canvas.getZoom() || 1;
    return Math.abs(a - b) < (SNAP_THRESHOLD / zoom);
  }

  /**
   * Handler for object:moving. Inspects the dragging object's bounds,
   * compares to canvas reference lines + other objects, snaps if close.
   *
   * Fabric's `object:moving` fires with e.target pointing at the object
   * currently being dragged. We mutate its left/top in place when we snap.
   */
  function handleMoving(e) {
    const obj = e.target;
    if (!obj) return;
    activeGuides = [];

    // Bounds of the moving object, in canvas coordinates
    const b = obj.getBoundingRect();
    const objCenterX = b.left + b.width / 2;
    const objCenterY = b.top + b.height / 2;
    const objLeft = b.left;
    const objRight = b.left + b.width;
    const objTop = b.top;
    const objBottom = b.top + b.height;

    // References: canvas center + edges
    const canvasCX = canvasW / 2;
    const canvasCY = canvasH / 2;

    // --- Horizontal snaps (x axis) ---
    let snapDeltaX = null;
    if (near(objCenterX, canvasCX)) {
      snapDeltaX = canvasCX - objCenterX;
      activeGuides.push({ x1: canvasCX, y1: 0, x2: canvasCX, y2: canvasH, color: 'rgba(255,0,180,0.9)' });
    } else if (near(objLeft, 0)) {
      snapDeltaX = -objLeft;
      activeGuides.push({ x1: 0, y1: 0, x2: 0, y2: canvasH, color: 'rgba(255,0,180,0.9)' });
    } else if (near(objRight, canvasW)) {
      snapDeltaX = canvasW - objRight;
      activeGuides.push({ x1: canvasW, y1: 0, x2: canvasW, y2: canvasH, color: 'rgba(255,0,180,0.9)' });
    }

    // --- Vertical snaps (y axis) ---
    let snapDeltaY = null;
    if (near(objCenterY, canvasCY)) {
      snapDeltaY = canvasCY - objCenterY;
      activeGuides.push({ x1: 0, y1: canvasCY, x2: canvasW, y2: canvasCY, color: 'rgba(255,0,180,0.9)' });
    } else if (near(objTop, 0)) {
      snapDeltaY = -objTop;
      activeGuides.push({ x1: 0, y1: 0, x2: canvasW, y2: 0, color: 'rgba(255,0,180,0.9)' });
    } else if (near(objBottom, canvasH)) {
      snapDeltaY = canvasH - objBottom;
      activeGuides.push({ x1: 0, y1: canvasH, x2: canvasW, y2: canvasH, color: 'rgba(255,0,180,0.9)' });
    }

    // --- Snap to other objects' edges/centers (Canva-style) ---
    // Walk all objects except the one being moved + locked backgrounds
    if (snapDeltaX === null || snapDeltaY === null) {
      const others = canvas.getObjects().filter(o => o !== obj && o.selectable !== false && o.evented !== false);
      for (const other of others) {
        const ob = other.getBoundingRect();
        const otherCX = ob.left + ob.width / 2;
        const otherCY = ob.top + ob.height / 2;

        // X alignment candidates: center-center, left-left, right-right
        if (snapDeltaX === null) {
          if (near(objCenterX, otherCX)) {
            snapDeltaX = otherCX - objCenterX;
            activeGuides.push({ x1: otherCX, y1: Math.min(objTop, ob.top), x2: otherCX, y2: Math.max(objBottom, ob.top + ob.height), color: 'rgba(60,220,255,0.85)' });
          } else if (near(objLeft, ob.left)) {
            snapDeltaX = ob.left - objLeft;
            activeGuides.push({ x1: ob.left, y1: Math.min(objTop, ob.top), x2: ob.left, y2: Math.max(objBottom, ob.top + ob.height), color: 'rgba(60,220,255,0.85)' });
          } else if (near(objRight, ob.left + ob.width)) {
            snapDeltaX = (ob.left + ob.width) - objRight;
            const x = ob.left + ob.width;
            activeGuides.push({ x1: x, y1: Math.min(objTop, ob.top), x2: x, y2: Math.max(objBottom, ob.top + ob.height), color: 'rgba(60,220,255,0.85)' });
          }
        }
        // Y alignment candidates: center-center, top-top, bottom-bottom
        if (snapDeltaY === null) {
          if (near(objCenterY, otherCY)) {
            snapDeltaY = otherCY - objCenterY;
            activeGuides.push({ x1: Math.min(objLeft, ob.left), y1: otherCY, x2: Math.max(objRight, ob.left + ob.width), y2: otherCY, color: 'rgba(60,220,255,0.85)' });
          } else if (near(objTop, ob.top)) {
            snapDeltaY = ob.top - objTop;
            activeGuides.push({ x1: Math.min(objLeft, ob.left), y1: ob.top, x2: Math.max(objRight, ob.left + ob.width), y2: ob.top, color: 'rgba(60,220,255,0.85)' });
          } else if (near(objBottom, ob.top + ob.height)) {
            snapDeltaY = (ob.top + ob.height) - objBottom;
            const y = ob.top + ob.height;
            activeGuides.push({ x1: Math.min(objLeft, ob.left), y1: y, x2: Math.max(objRight, ob.left + ob.width), y2: y, color: 'rgba(60,220,255,0.85)' });
          }
        }
      }
    }

    // Apply snap deltas
    if (snapDeltaX !== null) obj.left += snapDeltaX;
    if (snapDeltaY !== null) obj.top += snapDeltaY;
    if (snapDeltaX !== null || snapDeltaY !== null) {
      obj.setCoords();
    }
  }

  /**
   * Draw the active guide lines on the upper canvas context. Called after
   * every render by Fabric's `after:render` hook.
   */
  function drawGuides() {
    const ctx = canvas.getTopContext?.() || canvas.contextTop;
    if (!ctx || activeGuides.length === 0) return;
    const zoom = canvas.getZoom() || 1;
    ctx.save();
    // We're drawing in canvas coordinates, but the top context is in screen
    // coordinates — apply the zoom manually.
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.lineWidth = 1 / zoom; // stay 1px on screen regardless of zoom
    for (const g of activeGuides) {
      ctx.strokeStyle = g.color;
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function clearGuides() {
    activeGuides = [];
    canvas.clearContext?.(canvas.contextTop);
    canvas.requestRenderAll?.();
  }

  function attach() {
    if (!canvas) return;
    canvas.on('object:moving', handleMoving);
    canvas.on('after:render', drawGuides);
    canvas.on('object:modified', clearGuides);
    canvas.on('mouse:up', clearGuides);
  }

  function detach() {
    if (!canvas) return;
    canvas.off('object:moving', handleMoving);
    canvas.off('after:render', drawGuides);
    canvas.off('object:modified', clearGuides);
    canvas.off('mouse:up', clearGuides);
  }

  return { attach, detach };
}