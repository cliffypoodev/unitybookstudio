import React, { useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

/**
 * Zoom Control
 *
 * Renders a zoom slider + zoom in/out buttons + fit-to-screen button.
 * Binds a mouse-wheel handler to the canvas container for Ctrl/Cmd+scroll zoom.
 *
 * `fitZoom` is the "fit to container" baseline — the editor computes this
 * when the container resizes. The slider ranges from 25% to 400% of fitZoom
 * so 100% always means "fits the container exactly."
 */
export default function ZoomControl({ canvasContainerRef, fitZoom = 1, userZoom, setUserZoom, onFit }) {
  const MIN_MULT = 0.25;
  const MAX_MULT = 4.0;
  const currentMult = fitZoom > 0 ? userZoom / fitZoom : 1;
  const percentage = Math.round(currentMult * 100);

  const setMult = useCallback((m) => {
    const clamped = Math.max(MIN_MULT, Math.min(MAX_MULT, m));
    setUserZoom(fitZoom * clamped);
  }, [fitZoom, setUserZoom]);

  // Bind wheel handler for Ctrl/Cmd+scroll zoom
  useEffect(() => {
    const el = canvasContainerRef?.current;
    if (!el) return;
    const onWheel = (e) => {
      // Only zoom when user holds Ctrl (Windows) or Cmd (Mac). Otherwise
      // normal scroll behaviour. This is the Canva/Figma convention.
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setMult(currentMult * factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [canvasContainerRef, currentMult, setMult]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setMult(currentMult * 0.85)}
        className="flex h-6 w-6 items-center justify-center rounded bg-background border border-border hover:bg-muted"
        title="Zoom out (Ctrl+scroll)"
      >
        <ZoomOut className="h-3 w-3" />
      </button>
      <Slider
        value={[percentage]}
        onValueChange={([v]) => setMult(v / 100)}
        min={25}
        max={400}
        step={5}
        className="w-20"
      />
      <button
        type="button"
        onClick={() => setMult(currentMult * 1.15)}
        className="flex h-6 w-6 items-center justify-center rounded bg-background border border-border hover:bg-muted"
        title="Zoom in (Ctrl+scroll)"
      >
        <ZoomIn className="h-3 w-3" />
      </button>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-center tabular-nums">{percentage}%</span>
      <button
        type="button"
        onClick={onFit}
        className="flex h-6 w-6 items-center justify-center rounded bg-background border border-border hover:bg-muted"
        title="Fit to screen"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
  );
}