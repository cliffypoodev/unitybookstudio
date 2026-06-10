/**
 * Cover History — undo/redo for Fabric.js canvases.
 *
 * Uses a simple JSON snapshot queue rather than Fabric's built-in object-level
 * history, because:
 *   - Fabric's history doesn't cleanly handle object deletion
 *   - JSON snapshots round-trip cleanly through loadFromJSON
 *   - Debouncing lets us avoid capturing every pixel of a drag
 *
 * USAGE
 *   const history = createHistory(fabricCanvas, {
 *     jsonProps: ['_fabricEditorId', '_fabricEditorName', 'styles', ...],
 *   });
 *
 *   history.attach();   // subscribe to canvas events
 *   history.undo();     // roll back to previous state
 *   history.redo();     // replay forward
 *   history.canUndo(); // boolean
 *   history.canRedo(); // boolean
 *   history.detach();  // cleanup on unmount
 *
 * GOTCHAS
 *   - Don't call snapshot() while loadFromJSON is in progress. The internal
 *     flag `_restoring` guards against this.
 *   - When the user begins editing text (text:editing:entered), we freeze
 *     snapshots until they exit. Otherwise every keystroke creates a
 *     history entry.
 *   - Snapshots are capped at 50 entries per direction — any older state
 *     is silently discarded. 50 is enough for any realistic design session.
 */

const MAX_HISTORY = 50;
const SNAPSHOT_DEBOUNCE_MS = 400;

export function createHistory(canvas, options = {}) {
  const jsonProps = options.jsonProps || [];
  const undoStack = [];
  const redoStack = [];

  // Flag set during undo/redo apply so we don't re-snapshot our own changes.
  let _restoring = false;
  // Flag set while user is editing text inside a textbox.
  let _textEditing = false;

  let snapshotTimer = null;

  function takeSnapshot() {
    if (!canvas || _restoring) return null;
    try {
      return JSON.stringify(canvas.toJSON(jsonProps));
    } catch (err) {
      console.warn('[HISTORY] Snapshot failed:', err?.message);
      return null;
    }
  }

  function push(snap) {
    if (!snap) return;
    // Avoid consecutive duplicates
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // Any new action invalidates redo stack
    redoStack.length = 0;
  }

  // Called on events — debounced so a drag (many object:moving calls) becomes one entry
  function scheduleSnapshot() {
    if (_restoring || _textEditing) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      const snap = takeSnapshot();
      push(snap);
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  // Apply a snapshot string back to the canvas
  async function apply(snap) {
    if (!snap || !canvas) return;
    _restoring = true;
    try {
      await new Promise((resolve) => {
        canvas.loadFromJSON(snap, () => {
          canvas.renderAll();
          resolve();
        });
      });
    } catch (err) {
      console.error('[HISTORY] Apply failed:', err?.message);
    } finally {
      // Defer the flag flip so the subsequent render pass doesn't re-capture
      setTimeout(() => { _restoring = false; }, 50);
    }
  }

  function undo() {
    if (undoStack.length < 2) return false;
    const current = undoStack.pop();
    redoStack.push(current);
    const previous = undoStack[undoStack.length - 1];
    apply(previous);
    return true;
  }

  function redo() {
    if (redoStack.length === 0) return false;
    const next = redoStack.pop();
    undoStack.push(next);
    apply(next);
    return true;
  }

  function canUndo() { return undoStack.length > 1; }
  function canRedo() { return redoStack.length > 0; }

  /**
   * Force-capture an initial snapshot. Call this after the canvas is fully
   * populated (background + text objects). This becomes the "zero state" —
   * first undo returns here.
   */
  function captureInitial() {
    const snap = takeSnapshot();
    if (snap) push(snap);
  }

  const handlers = {
    'object:added': scheduleSnapshot,
    'object:removed': scheduleSnapshot,
    'object:modified': scheduleSnapshot,
    'text:changed': scheduleSnapshot,
    'text:editing:entered': () => { _textEditing = true; },
    'text:editing:exited': () => {
      _textEditing = false;
      // Capture the final text once the user exits edit mode
      scheduleSnapshot();
    },
  };

  function attach() {
    if (!canvas) return;
    for (const [evt, fn] of Object.entries(handlers)) {
      canvas.on(evt, fn);
    }
  }

  function detach() {
    if (!canvas) return;
    for (const [evt, fn] of Object.entries(handlers)) {
      canvas.off(evt, fn);
    }
    if (snapshotTimer) clearTimeout(snapshotTimer);
  }

  /**
   * Observable state for UI — returns the current sizes so callers can show
   * Undo/Redo button enabled/disabled states. Call this in a render effect
   * synced to whatever triggers re-renders.
   */
  function state() {
    return {
      undoSize: undoStack.length,
      redoSize: redoStack.length,
      canUndo: canUndo(),
      canRedo: canRedo(),
    };
  }

  return { attach, detach, undo, redo, canUndo, canRedo, captureInitial, state };
}