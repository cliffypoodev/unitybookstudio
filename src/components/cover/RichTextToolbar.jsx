import React, { useState, useEffect } from 'react';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const COVER_FONTS = [
  'Cormorant Garamond', 'Playfair Display', 'Lora', 'Merriweather',
  'Libre Baskerville', 'Cinzel', 'Oswald', 'Montserrat', 'Raleway',
  'Bebas Neue', 'Georgia', 'Times New Roman', 'Garamond', 'Palatino',
  'Helvetica', 'Arial', 'Futura', 'Gill Sans', 'Courier New',
];

function applyStyleToSelection(activeObject, canvas, prop, value) {
  if (!activeObject || (activeObject.type !== 'textbox' && activeObject.type !== 'i-text')) return;
  const selStart = activeObject.selectionStart;
  const selEnd = activeObject.selectionEnd;

  if (selStart === selEnd) {
    activeObject.set(prop, value);
  } else {
    for (let i = selStart; i < selEnd; i++) {
      const lineIndex = activeObject._getLineIndexOfChar(i);
      const charIndex = activeObject._getLocalCharIndex(i);
      if (!activeObject.styles[lineIndex]) activeObject.styles[lineIndex] = {};
      if (!activeObject.styles[lineIndex][charIndex]) activeObject.styles[lineIndex][charIndex] = {};
      activeObject.styles[lineIndex][charIndex][prop] = value;
    }
  }
  canvas.renderAll();
}

export default function RichTextToolbar({ activeObject, canvas, onUpdate }) {
  const [fontFamily, setFontFamily] = useState('Georgia');
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [textAlign, setTextAlign] = useState('center');
  const [lineHeight, setLineHeight] = useState(1.4);
  const [charSpacing, setCharSpacing] = useState(0);
  const [fill, setFill] = useState('#fffaf0');

  // Sync state when active object changes
  useEffect(() => {
    if (!activeObject) return;
    setFontFamily(activeObject.fontFamily || 'Georgia');
    setFontSize(activeObject.fontSize || 48);
    setFontWeight(activeObject.fontWeight || 'normal');
    setFontStyle(activeObject.fontStyle || 'normal');
    setTextAlign(activeObject.textAlign || 'center');
    setLineHeight(activeObject.lineHeight || 1.4);
    setCharSpacing(activeObject.charSpacing || 0);
    const c = activeObject.fill || '#fffaf0';
    setFill(rgbaToHex(c));
  }, [activeObject]);

  if (!activeObject || (activeObject.type !== 'textbox' && activeObject.type !== 'i-text' && activeObject.type !== 'text')) {
    return null;
  }

  const applyChange = (prop, value) => {
    if (!activeObject || !canvas) return;
    activeObject.set(prop, value);
    canvas.renderAll();
    if (onUpdate) onUpdate();
  };

  const handleBold = () => {
    if (!canvas) return;
    const hasSelection = activeObject.selectionStart !== activeObject.selectionEnd;
    if (hasSelection) {
      const styles = activeObject.getSelectionStyles(activeObject.selectionStart, activeObject.selectionEnd);
      const isBold = styles.some(s => s.fontWeight === 'bold' || s.fontWeight === '700');
      applyStyleToSelection(activeObject, canvas, 'fontWeight', isBold ? 'normal' : 'bold');
    } else {
      const v = fontWeight === 'bold' || fontWeight === '700' ? 'normal' : 'bold';
      setFontWeight(v);
      applyChange('fontWeight', v);
    }
    if (onUpdate) onUpdate();
  };

  const handleItalic = () => {
    if (!canvas) return;
    const hasSelection = activeObject.selectionStart !== activeObject.selectionEnd;
    if (hasSelection) {
      const styles = activeObject.getSelectionStyles(activeObject.selectionStart, activeObject.selectionEnd);
      const isItalic = styles.some(s => s.fontStyle === 'italic');
      applyStyleToSelection(activeObject, canvas, 'fontStyle', isItalic ? 'normal' : 'italic');
    } else {
      const v = fontStyle === 'italic' ? 'normal' : 'italic';
      setFontStyle(v);
      applyChange('fontStyle', v);
    }
    if (onUpdate) onUpdate();
  };

  const isBoldActive = fontWeight === 'bold' || fontWeight === '700';
  const isItalicActive = fontStyle === 'italic';

  return (
    <div className="flex items-center gap-1.5 border-b border-border/50 bg-card/80 px-3 py-1.5 flex-wrap">
      {/* Font Family */}
      <select
        value={fontFamily}
        onChange={(e) => { setFontFamily(e.target.value); applyChange('fontFamily', e.target.value); }}
        className="h-7 max-w-[130px] rounded border border-border bg-background px-1.5 text-[11px] outline-none"
      >
        {COVER_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {/* Font Size */}
      <input
        type="number"
        value={fontSize}
        onChange={(e) => { const v = parseInt(e.target.value) || 12; setFontSize(v); applyChange('fontSize', v); }}
        className="h-7 w-[46px] rounded border border-border bg-background px-1.5 text-center text-[11px] outline-none"
        min={8} max={300}
      />

      <div className="mx-0.5 h-4 w-px bg-border/60" />

      {/* Bold */}
      <button
        onClick={handleBold}
        className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold transition-colors ${
          isBoldActive ? 'bg-primary text-primary-foreground' : 'bg-background border border-border hover:bg-muted'
        }`}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>

      {/* Italic */}
      <button
        onClick={handleItalic}
        className={`flex h-7 w-7 items-center justify-center rounded text-xs transition-colors ${
          isItalicActive ? 'bg-primary text-primary-foreground' : 'bg-background border border-border hover:bg-muted'
        }`}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-4 w-px bg-border/60" />

      {/* Alignment */}
      {['left', 'center', 'right'].map((align) => {
        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
        return (
          <button
            key={align}
            onClick={() => { setTextAlign(align); applyChange('textAlign', align); }}
            className={`flex h-7 w-7 items-center justify-center rounded text-xs transition-colors ${
              textAlign === align ? 'bg-primary text-primary-foreground' : 'bg-background border border-border hover:bg-muted'
            }`}
            title={align.charAt(0).toUpperCase() + align.slice(1)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}

      <div className="mx-0.5 h-4 w-px bg-border/60" />

      {/* Text Color */}
      <div className="relative">
        <input
          type="color"
          value={fill}
          onChange={(e) => { setFill(e.target.value); applyChange('fill', e.target.value); }}
          className="h-7 w-7 cursor-pointer rounded border border-border p-0.5"
          title="Text Color"
        />
      </div>

      {/* Line Height */}
      <div className="flex items-center gap-0.5" title="Line Height">
        <span className="text-[9px] text-muted-foreground">↕</span>
        <input
          type="number"
          value={lineHeight}
          onChange={(e) => { const v = parseFloat(e.target.value) || 1.0; setLineHeight(v); applyChange('lineHeight', v); }}
          className="h-7 w-[42px] rounded border border-border bg-background px-1 text-center text-[11px] outline-none"
          min={0.8} max={3.0} step={0.1}
        />
      </div>

      {/* Letter Spacing */}
      <div className="flex items-center gap-0.5" title="Letter Spacing">
        <span className="text-[9px] text-muted-foreground">↔</span>
        <input
          type="number"
          value={charSpacing}
          onChange={(e) => { const v = parseInt(e.target.value) || 0; setCharSpacing(v); applyChange('charSpacing', v); }}
          className="h-7 w-[48px] rounded border border-border bg-background px-1 text-center text-[11px] outline-none"
          min={-200} max={1000} step={10}
        />
      </div>
    </div>
  );
}

function rgbaToHex(color) {
  if (!color) return '#ffffff';
  if (color.startsWith('#')) return color.length > 7 ? color.slice(0, 7) : color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return '#' + [match[1], match[2], match[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
  }
  return '#ffffff';
}