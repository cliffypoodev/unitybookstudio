/**
 * Cover Keyboard Shortcuts
 *
 * A single React hook that wires the full keyboard shortcut set onto any
 * Fabric.js canvas. Call it from inside a component with the canvas ref
 * and the action bundle, and it handles everything — install, cleanup,
 * and safe-input detection.
 *
 * SHORTCUTS
 *   Delete / Backspace  — remove selected object(s)
 *   Escape              — deselect
 *   Cmd/Ctrl + D        — duplicate
 *   Cmd/Ctrl + C        — copy
 *   Cmd/Ctrl + V        — paste
 *   Cmd/Ctrl + Z        — undo
 *   Cmd/Ctrl + Shift+Z  — redo (also Cmd/Ctrl + Y)
 *   Cmd/Ctrl + ]        — bring forward
 *   Cmd/Ctrl + [        — send backward
 *   Cmd/Ctrl + Shift+]  — bring to front
 *   Cmd/Ctrl + Shift+[  — send to back
 *   Arrow keys          — nudge 1px (Shift = 10px)
 *
 * SAFETY
 *   - Skips when user is typing in <input> / <textarea> / contentEditable
 *   - Skips when Fabric's text editing mode is active (user typing in a Textbox)
 *   - preventDefault on handled keys so browser shortcuts don't fire
 */

import { useEffect, useRef } from 'react';

export function useCoverKeyboard(canvasRef, actions = {}) {
  // Clipboard — a Fabric object stored out-of-band for copy/paste
  const clipboardRef = useRef(null);

  useEffect(() => {
    const onKeyDown = async (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Skip if user is typing in a form control
      const el = document.activeElement;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;

      // Skip if Fabric's inline text editing is active
      if (canvas.getActiveObject()?.isEditing) return;

      const cmd = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const active = canvas.getActiveObject();

      // --- Delete / Backspace ---
      if ((e.key === 'Delete' || e.key === 'Backspace') && active) {
        // Guard: don't delete an object flagged as a background
        if (active._fabricEditorId === 'background') return;
        e.preventDefault();
        if (actions.onDelete) actions.onDelete();
        else {
          canvas.remove(active);
          canvas.discardActiveObject();
          canvas.renderAll();
        }
        return;
      }

      // --- Escape = deselect ---
      if (e.key === 'Escape') {
        canvas.discardActiveObject();
        canvas.renderAll();
        return;
      }

      // --- Cmd+Z / Cmd+Y — undo/redo ---
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (shift) actions.onRedo?.();
        else actions.onUndo?.();
        return;
      }
      if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        actions.onRedo?.();
        return;
      }

      // --- Cmd+D — duplicate ---
      if (cmd && e.key.toLowerCase() === 'd' && active) {
        e.preventDefault();
        const cloned = await active.clone();
        cloned.set({
          left: (active.left || 0) + 20,
          top: (active.top || 0) + 20,
        });
        // Preserve custom id markers — generate a fresh id
        if (active._fabricEditorId) cloned._fabricEditorId = `${active._fabricEditorId}-copy-${Date.now()}`;
        if (active._fabricEditorName) cloned._fabricEditorName = `${active._fabricEditorName} copy`;
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
        return;
      }

      // --- Cmd+C — copy ---
      if (cmd && e.key.toLowerCase() === 'c' && active) {
        e.preventDefault();
        clipboardRef.current = await active.clone();
        return;
      }

      // --- Cmd+V — paste ---
      if (cmd && e.key.toLowerCase() === 'v') {
        const clip = clipboardRef.current;
        if (!clip) return;
        e.preventDefault();
        const cloned = await clip.clone();
        cloned.set({
          left: (clip.left || 0) + 30,
          top: (clip.top || 0) + 30,
        });
        if (clip._fabricEditorId) cloned._fabricEditorId = `${clip._fabricEditorId}-paste-${Date.now()}`;
        if (clip._fabricEditorName) cloned._fabricEditorName = `${clip._fabricEditorName} paste`;
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
        // Update clipboard position so subsequent pastes cascade
        clipboardRef.current = cloned;
        return;
      }

      // --- Cmd+] / Cmd+[ — layer order ---
      if (cmd && e.key === ']' && active) {
        e.preventDefault();
        if (shift) canvas.bringObjectToFront?.(active);
        else canvas.bringObjectForward?.(active);
        canvas.renderAll();
        return;
      }
      if (cmd && e.key === '[' && active) {
        e.preventDefault();
        if (shift) canvas.sendObjectToBack?.(active);
        else canvas.sendObjectBackwards?.(active);
        // sendObjectBackwards can accidentally put things behind locked
        // backgrounds — find the background and keep it at index 0
        const bg = canvas.getObjects().find((o) => o._fabricEditorId === 'background');
        if (bg && canvas.getObjects().indexOf(bg) !== 0) {
          canvas.sendObjectToBack(bg);
        }
        canvas.renderAll();
        return;
      }

      // --- Arrow keys — nudge ---
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && active) {
        e.preventDefault();
        const step = shift ? 10 : 1;
        if (e.key === 'ArrowUp')    active.set('top', (active.top || 0) - step);
        if (e.key === 'ArrowDown')  active.set('top', (active.top || 0) + step);
        if (e.key === 'ArrowLeft')  active.set('left', (active.left || 0) - step);
        if (e.key === 'ArrowRight') active.set('left', (active.left || 0) + step);
        active.setCoords();
        canvas.fire('object:modified', { target: active });
        canvas.renderAll();
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canvasRef, actions]);
}