/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: nothing renders this placeholder.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';

export default function NotebookPlaceholder({ title, description }) {
  return (
    <div className="notebook-placeholder">
      <p className="notebook-kicker">Coming next</p>
      <h3 className="notebook-placeholder-title">{title}</h3>
      <p className="notebook-placeholder-copy">{description}</p>
    </div>
  );
}