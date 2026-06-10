import React from 'react';
import { useNotebookTheme } from '@/components/notebook/ThemeProvider';

const PAGE_LABELS = {
  home:       ['Today', 'Up next'],
  setup:      ['Basics', 'Narrative'],
  foundation: ['Content', 'Details'],
  outline:    ['Chapters', 'Scenes'],
  review:     ['Polish', 'Analysis'],
  tools:      ['Tools', 'Details'],
  export:     null,
  cover:      null,
  preview:    null,
};

export default function MobilePageToggle({ activePage, onToggle, sectionId }) {
  const { theme: T } = useNotebookTheme();
  const labels = PAGE_LABELS[sectionId];
  if (!labels) return null;

  const ink = T.page.ink;
  const bg = T.page.bg;
  const innerBg = T.page.innerBg;
  const muted = `color-mix(in srgb, ${ink} 55%, transparent)`;
  const rule = `color-mix(in srgb, ${ink} 18%, transparent)`;

  return (
    <div style={{
      display: 'flex', padding: '6px 16px', gap: 4,
      borderBottom: `1px solid ${rule}`,
      background: innerBg, flexShrink: 0,
    }}>
      {[
        { id: 'left', label: labels[0] },
        { id: 'right', label: labels[1] },
      ].map(pane => (
        <button key={pane.id} onClick={() => onToggle(pane.id)} style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          background: activePage === pane.id ? bg : 'transparent',
          border: activePage === pane.id ? `1px solid ${rule}` : '1px solid transparent',
          boxShadow: activePage === pane.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
          fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: activePage === pane.id ? 600 : 400,
          color: activePage === pane.id ? ink : muted,
          cursor: 'pointer', transition: 'all 150ms',
        }}>{pane.label}</button>
      ))}
    </div>
  );
}