import React from 'react';
import { X } from 'lucide-react';
import { THEMES, THEME_IDS } from '@/components/notebook/themes';
import { useNotebookTheme } from '@/components/notebook/ThemeProvider';

/* ─── Miniature notebook preview ─── */
function ThemePreview({ theme }) {
  return (
    <div style={{
      position: 'relative', aspectRatio: '16/10',
      borderRadius: 8, overflow: 'hidden',
      background: theme.cover.gradient,
      boxShadow: '0 2px 6px rgba(0,0,0,.15)',
      padding: 10, display: 'flex',
    }}>
      {theme.cover.pattern && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: theme.cover.pattern, pointerEvents: 'none' }} />
      )}
      <div style={{
        position: 'absolute', inset: 5, borderRadius: 5,
        border: `1px dashed ${theme.cover.stitching}`,
        pointerEvents: 'none',
      }} />
      <div style={{
        flex: 1, margin: 6, borderRadius: 2,
        background: theme.pageStack.background,
        boxShadow: theme.pageStack.ringShadow,
        padding: 3, display: 'flex', position: 'relative', zIndex: 1,
      }}>
        <div style={{
          flex: 1, borderRadius: 1, overflow: 'hidden',
          background: theme.page.bg, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 3, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 28, width: 1,
            background: theme.page.margin,
          }} />
          <div style={{
            fontFamily: theme.type.heading,
            fontSize: 11, fontWeight: 500, color: theme.page.ink, paddingLeft: 24,
            lineHeight: 1.1,
          }}>
            Chapter 13
          </div>
          <div style={{
            position: 'absolute', left: 32, right: 12, top: 28, bottom: 8,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 7px, ${theme.page.ruling} 7px, ${theme.page.ruling} 8px)`,
          }} />
        </div>
      </div>
      <div style={{
        position: 'absolute', right: '18%', bottom: -5, width: 5, height: 20,
        background: theme.cover.ribbon,
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
        zIndex: 0,
      }} />
    </div>
  );
}

/* ─── Theme card ─── */
function ThemeCard({ id, theme, current, onPick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onPick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: 14, borderRadius: 14,
        background: current ? 'rgba(180,138,87,.2)' : 'rgba(255,253,247,.5)',
        border: current ? '2px solid #2a2218' : '1px solid rgba(80,60,40,.18)',
        cursor: 'pointer', textAlign: 'left',
        transform: hover && !current ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 180ms',
        boxShadow: hover || current ? '0 10px 24px rgba(35,24,12,.15)' : '0 1px 2px rgba(35,24,12,.05)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
      <ThemePreview theme={theme} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: theme.type.heading, fontSize: 17, fontWeight: 500, color: '#2a2218', lineHeight: 1.15, flex: 1 }}>
          {theme.label}
        </div>
        {current && (
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: '#fdfbf4', background: '#2a2218',
            padding: '3px 8px', borderRadius: 999, flexShrink: 0, marginTop: 3,
          }}>
            Current
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#756a59', marginTop: -8 }}>
        {theme.description}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: -4 }}>
        {(theme.swatch || []).map(c => (
          <div key={c} style={{
            width: 16, height: 16, borderRadius: '50%', background: c,
            border: '1px solid rgba(0,0,0,.12)',
          }} />
        ))}
      </div>
    </button>
  );
}

/* ─── Theme Picker Modal ─── */
export default function ThemePicker({ open, onClose }) {
  const { settings, updateSettings } = useNotebookTheme();
  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 6, 2, .7)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      zIndex: 150,
      overflowY: 'auto',
      padding: '40px 24px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 1240,
        background: '#efe3cf',
        borderRadius: 16,
        padding: '30px 34px 36px',
        boxShadow: '0 40px 100px rgba(0,0,0,.5)',
        position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(42,34,24,.1)', border: 'none', borderRadius: 999,
          width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#2a2218',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={18} />
        </button>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#8a7d69', textTransform: 'uppercase', letterSpacing: '.2em' }}>
          Notebook appearance
        </div>
        <h2 style={{
          margin: '4px 0 6px', fontFamily: 'Cormorant Garamond, serif',
          fontSize: 32, fontWeight: 500, color: '#2a2218',
        }}>
          Choose a notebook theme
        </h2>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#756a59', maxWidth: 640 }}>
          Every writer's notebook looks a little different. Pick the cover, paper and type that match the world you're writing.
        </div>

        <div style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 18,
        }}>
          {THEME_IDS.map(id => (
            <ThemeCard key={id} id={id} theme={THEMES[id]}
              current={id === settings.theme}
              onPick={() => { updateSettings({ theme: id }); onClose(); }} />
          ))}
        </div>
      </div>
    </div>
  );
}