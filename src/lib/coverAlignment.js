/**
 * Cover Alignment — align and distribute selected objects.
 *
 * Supports:
 *   - Single selection: align to canvas
 *   - Multi-selection (ActiveSelection): align to each other's outer bounds
 *   - Distribute H / V (requires 3+ objects)
 *
 * All operations mutate object positions in place and call canvas.renderAll().
 */

/**
 * Get the currently selected objects. Returns an array:
 *   - empty if nothing selected
 *   - single-item if one object selected
 *   - multi-item if an ActiveSelection is selected (multi-drag box)
 */
function getSelected(canvas) {
  const active = canvas.getActiveObject();
  if (!active) return [];
  // Fabric ActiveSelection: multi-selected objects
  if (active.type === 'activeselection') {
    return active._objects || [];
  }
  return [active];
}

/**
 * Get the bounding box of an object in canvas coordinates. Handles
 * objects inside ActiveSelection (their left/top are relative to the
 * selection origin, so we compute absolute).
 */
function absBounds(obj, canvas) {
  // getBoundingRect(true, true) returns bounds in canvas (absolute) coordinates
  return obj.getBoundingRect(true, true);
}

/**
 * Align one or more objects to the canvas (single selection mode).
 */
function alignToCanvas(canvas, axis, anchor) {
  const selected = getSelected(canvas);
  if (selected.length !== 1) return;
  const obj = selected[0];
  const b = absBounds(obj, canvas);

  if (axis === 'h') {
    // horizontal alignment: move X
    let newLeft;
    if (anchor === 'left')        newLeft = obj.left - b.left;
    else if (anchor === 'center') newLeft = obj.left + (canvas.width / 2 - (b.left + b.width / 2));
    else if (anchor === 'right')  newLeft = obj.left + (canvas.width - (b.left + b.width));
    if (newLeft != null) {
      obj.set('left', newLeft);
      obj.setCoords();
    }
  } else {
    // vertical alignment: move Y
    let newTop;
    if (anchor === 'top')          newTop = obj.top - b.top;
    else if (anchor === 'middle')  newTop = obj.top + (canvas.height / 2 - (b.top + b.height / 2));
    else if (anchor === 'bottom')  newTop = obj.top + (canvas.height - (b.top + b.height));
    if (newTop != null) {
      obj.set('top', newTop);
      obj.setCoords();
    }
  }

  canvas.fire('object:modified', { target: obj });
  canvas.renderAll();
}

/**
 * Align multiple objects relative to each other — compute the outer bounding
 * box of the group, then move each object's left/top accordingly.
 *
 * For ActiveSelection, Fabric keeps children in local coords relative to the
 * selection's origin. We must work in ABSOLUTE coords and then let Fabric's
 * group machinery handle the math.
 */
function alignMulti(canvas, axis, anchor) {
  const selected = getSelected(canvas);
  if (selected.length < 2) return;

  // Compute outer bounds across all selected objects
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const objBounds = selected.map(obj => {
    const b = absBounds(obj, canvas);
    minX = Math.min(minX, b.left);
    maxX = Math.max(maxX, b.left + b.width);
    minY = Math.min(minY, b.top);
    maxY = Math.max(maxY, b.top + b.height);
    return { obj, b };
  });

  for (const { obj, b } of objBounds) {
    if (axis === 'h') {
      let target;
      if (anchor === 'left')        target = minX;
      else if (anchor === 'center') target = (minX + maxX) / 2 - b.width / 2;
      else if (anchor === 'right')  target = maxX - b.width;
      if (target != null) {
        obj.set('left', obj.left + (target - b.left));
      }
    } else {
      let target;
      if (anchor === 'top')         target = minY;
      else if (anchor === 'middle') target = (minY + maxY) / 2 - b.height / 2;
      else if (anchor === 'bottom') target = maxY - b.height;
      if (target != null) {
        obj.set('top', obj.top + (target - b.top));
      }
    }
    obj.setCoords();
  }

  // If this was an active selection, the group's internal positions changed.
  // Force a refresh.
  const active = canvas.getActiveObject();
  if (active?.type === 'activeselection') {
    active.setCoords();
  }
  canvas.fire('object:modified', { target: active });
  canvas.renderAll();
}

export function alignLeft(canvas)   { getSelected(canvas).length > 1 ? alignMulti(canvas, 'h', 'left') : alignToCanvas(canvas, 'h', 'left'); }
export function alignCenterH(canvas){ getSelected(canvas).length > 1 ? alignMulti(canvas, 'h', 'center') : alignToCanvas(canvas, 'h', 'center'); }
export function alignRight(canvas)  { getSelected(canvas).length > 1 ? alignMulti(canvas, 'h', 'right') : alignToCanvas(canvas, 'h', 'right'); }
export function alignTop(canvas)    { getSelected(canvas).length > 1 ? alignMulti(canvas, 'v', 'top') : alignToCanvas(canvas, 'v', 'top'); }
export function alignCenterV(canvas){ getSelected(canvas).length > 1 ? alignMulti(canvas, 'v', 'middle') : alignToCanvas(canvas, 'v', 'middle'); }
export function alignBottom(canvas) { getSelected(canvas).length > 1 ? alignMulti(canvas, 'v', 'bottom') : alignToCanvas(canvas, 'v', 'bottom'); }

/**
 * Distribute 3+ objects evenly along an axis. Objects are sorted by their
 * current position on the axis; gaps between them are equalized.
 */
export function distributeH(canvas) {
  const selected = getSelected(canvas);
  if (selected.length < 3) return;
  const items = selected.map(obj => ({ obj, b: absBounds(obj, canvas) }));
  items.sort((a, b) => a.b.left - b.b.left);
  const first = items[0];
  const last = items[items.length - 1];
  const totalSpan = (last.b.left + last.b.width) - first.b.left;
  const widthsSum = items.reduce((s, it) => s + it.b.width, 0);
  const gap = (totalSpan - widthsSum) / (items.length - 1);
  let cursor = first.b.left + first.b.width + gap;
  for (let i = 1; i < items.length - 1; i++) {
    const it = items[i];
    const delta = cursor - it.b.left;
    it.obj.set('left', it.obj.left + delta);
    it.obj.setCoords();
    cursor += it.b.width + gap;
  }
  canvas.fire('object:modified', { target: canvas.getActiveObject() });
  canvas.renderAll();
}

export function distributeV(canvas) {
  const selected = getSelected(canvas);
  if (selected.length < 3) return;
  const items = selected.map(obj => ({ obj, b: absBounds(obj, canvas) }));
  items.sort((a, b) => a.b.top - b.b.top);
  const first = items[0];
  const last = items[items.length - 1];
  const totalSpan = (last.b.top + last.b.height) - first.b.top;
  const heightsSum = items.reduce((s, it) => s + it.b.height, 0);
  const gap = (totalSpan - heightsSum) / (items.length - 1);
  let cursor = first.b.top + first.b.height + gap;
  for (let i = 1; i < items.length - 1; i++) {
    const it = items[i];
    const delta = cursor - it.b.top;
    it.obj.set('top', it.obj.top + delta);
    it.obj.setCoords();
    cursor += it.b.height + gap;
  }
  canvas.fire('object:modified', { target: canvas.getActiveObject() });
  canvas.renderAll();
}

/**
 * How many objects are selected — used to enable/disable alignment buttons
 * in the UI.
 */
export function getSelectionCount(canvas) {
  return getSelected(canvas).length;
}