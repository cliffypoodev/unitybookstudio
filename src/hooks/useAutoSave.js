import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Debounced auto-save hook.
 * Calls `onSave` after `delay` ms of inactivity whenever `value` changes.
 * Returns { lastSaved } timestamp for UI feedback.
 */
export default function useAutoSave(value, onSave, { delay = 60000, enabled = true } = {}) {
  const [lastSaved, setLastSaved] = useState(null);
  const initialRef = useRef(true);
  const timeoutRef = useRef(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    // Skip the first render (initial load)
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    if (!enabled) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      // WAVE1-AUTOSAVECATCH: a failed autosave used to escape as an unhandled
      // rejection — the "last saved" stamp just quietly went stale while the
      // user kept typing into a document that was NOT being saved.
      try {
        await onSaveRef.current();
        setLastSaved(Date.now());
      } catch (err) {
        console.error('[AUTOSAVE] Save failed:', err);
        toast.error('Autosave failed — your latest changes are NOT saved yet (' + (err?.message || 'unknown error') + ')');
      }
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay, enabled]);

  return { lastSaved };
}