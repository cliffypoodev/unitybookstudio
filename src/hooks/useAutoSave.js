import { useEffect, useRef, useState, useCallback } from 'react';

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
      await onSaveRef.current();
      setLastSaved(Date.now());
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay, enabled]);

  return { lastSaved };
}