// =============================================================
// ExportFormatBar.jsx — Stable Single-Row Formatting Bar FIXED
//
// Fixes:
// - Format dropdown is clickable/responsive.
// - Dropdown is not trapped by overflow-hidden.
// - Font size select no longer has double-arrow distortion.
// - No horizontal scrollbar.
// - No helper/status row.
// - Clean single-row toolbar.
// - Advanced controls live in Format dropdown.
// =============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
} from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const STYLE_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Heading 1', value: '1' },
  { label: 'Heading 2', value: '2' },
  { label: 'Heading 3', value: '3' },
  { label: 'Quote', value: 'blockquote' },
  { label: 'Code', value: 'code-block' },
];

const SIZE_OPTIONS = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
];

const COLOR_SWATCHES = [
  { label: 'Black', value: '#111111' },
  { label: 'Gray', value: '#555555' },
  { label: 'Brown', value: '#4B2E24' },
  { label: 'Red', value: '#B42318' },
  { label: 'Blue', value: '#1D4ED8' },
  { label: 'Green', value: '#047857' },
];

const HIGHLIGHT_SWATCHES = [
  { label: 'None', value: false },
  { label: 'Cream', value: '#FFF3BF' },
  { label: 'Blue', value: '#DBEAFE' },
  { label: 'Green', value: '#D1FAE5' },
  { label: 'Rose', value: '#FFE4E6' },
  { label: 'Gray', value: '#E5E7EB' },
];

function getEditor(quillRef) {
  try {
    return quillRef?.current?.getEditor?.() || null;
  } catch {
    return null;
  }
}

function focusEditor(quillRef) {
  const editor = getEditor(quillRef);
  if (!editor) return null;

  try {
    editor.focus();
  } catch {
    // no-op
  }

  return editor;
}

function applyFormat(quillRef, key, value) {
  const editor = focusEditor(quillRef);
  if (!editor) return;

  try {
    editor.format(key, value);
  } catch (err) {
    console.warn(`[EXPORT FORMAT] Failed to apply format "${key}"`, err);
  }
}

function applyLineFormat(quillRef, key, value) {
  const editor = focusEditor(quillRef);
  if (!editor) return;

  try {
    const range = editor.getSelection(true);
    if (!range) return;

    editor.formatLine(range.index, Math.max(range.length, 1), key, value);
  } catch (err) {
    console.warn(`[EXPORT FORMAT] Failed to apply line format "${key}"`, err);
  }
}

function runHistory(quillRef, direction) {
  const editor = focusEditor(quillRef);
  if (!editor) return;

  try {
    if (direction === 'undo') {
      editor.history?.undo?.();
    } else {
      editor.history?.redo?.();
    }
  } catch (err) {
    console.warn(`[EXPORT FORMAT] Failed history command "${direction}"`, err);
  }
}

function insertDivider(quillRef) {
  const editor = focusEditor(quillRef);
  if (!editor) return;

  try {
    const range = editor.getSelection(true) || { index: editor.getLength(), length: 0 };
    editor.insertText(range.index, '\n* * *\n', 'user');
    editor.setSelection(range.index + 7, 0);
  } catch (err) {
    console.warn('[EXPORT FORMAT] Failed to insert divider', err);
  }
}

function clearFormatting(quillRef) {
  const editor = focusEditor(quillRef);
  if (!editor) return;

  try {
    const range = editor.getSelection(true);
    if (!range) return;

    if (range.length > 0) {
      editor.removeFormat(range.index, range.length, 'user');
      return;
    }

    const [line, offset] = editor.getLine(range.index);
    if (!line) {
      editor.removeFormat(range.index, 1, 'user');
      return;
    }

    const lineStart = range.index - offset;
    const lineLength = line.length();
    editor.removeFormat(lineStart, lineLength, 'user');
  } catch (err) {
    console.warn('[EXPORT FORMAT] Failed to clear formatting', err);
  }
}

function toggleFormat(quillRef, formatKey, currentFormats) {
  const current = Boolean(currentFormats?.[formatKey]);
  applyFormat(quillRef, formatKey, !current);
}

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
  className = '',
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-45',
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarSelect({ label, value, options, onChange, className = '' }) {
  return (
    <label
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-xl border border-border/60 bg-background/75 px-2 text-xs font-bold text-foreground transition hover:bg-muted',
        className
      )}
      title={label}
    >
      <span className="sr-only">{label}</span>

      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-full cursor-pointer bg-transparent pr-1 text-xs font-bold outline-none"
      >
        {options.map((option) => (
          <option key={`${option.label}-${option.value}`} value={option.value || ''}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolbarGroup({ children, className = '' }) {
  return (
    <div
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-0.5 rounded-2xl border border-border/50 bg-card/60 px-1',
        className
      )}
    >
      {children}
    </div>
  );
}

function MenuSection({ label, children }) {
  return (
    <div className="py-1.5">
      <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, detail, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{label}</span>
        {detail ? (
          <span className="block truncate text-[10px] text-muted-foreground">{detail}</span>
        ) : null}
      </span>
    </button>
  );
}

function ColorSwatchMenu({ label, swatches, onPick }) {
  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>

      <div className="grid grid-cols-6 gap-1.5">
        {swatches.map((swatch) => (
          <button
            key={`${label}-${swatch.label}-${swatch.value}`}
            type="button"
            title={swatch.label}
            onClick={() => onPick(swatch.value)}
            className="h-7 rounded-lg border border-border/70 bg-background shadow-sm transition hover:scale-105"
          >
            {swatch.value ? (
              <span
                className="block h-full w-full rounded-lg"
                style={{ backgroundColor: swatch.value }}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-lg text-[10px] font-black text-muted-foreground">
                —
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ExportFormatBar({ quillRef }) {
  const [formats, setFormats] = useState({});
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  const currentStyle = useMemo(() => {
    if (formats?.blockquote) return 'blockquote';
    if (formats?.['code-block']) return 'code-block';
    if (formats?.header) return String(formats.header);
    return 'normal';
  }, [formats]);

  const currentSize = formats?.size || '14px';

  useEffect(() => {
    const editor = getEditor(quillRef);
    if (!editor) return undefined;

    const updateFormats = () => {
      try {
        const range = editor.getSelection();
        const activeFormats = range ? editor.getFormat(range) : editor.getFormat();
        setFormats(activeFormats || {});
      } catch {
        setFormats({});
      }
    };

    updateFormats();

    editor.on('selection-change', updateFormats);
    editor.on('text-change', updateFormats);

    return () => {
      editor.off('selection-change', updateFormats);
      editor.off('text-change', updateFormats);
    };
  }, [quillRef]);

  useEffect(() => {
    if (!moreOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [moreOpen]);

  const handleStyleChange = (value) => {
    if (value === 'normal') {
      applyLineFormat(quillRef, 'header', false);
      applyLineFormat(quillRef, 'blockquote', false);
      applyLineFormat(quillRef, 'code-block', false);
      return;
    }

    if (value === 'blockquote') {
      applyLineFormat(quillRef, 'header', false);
      applyLineFormat(quillRef, 'code-block', false);
      applyLineFormat(quillRef, 'blockquote', true);
      return;
    }

    if (value === 'code-block') {
      applyLineFormat(quillRef, 'header', false);
      applyLineFormat(quillRef, 'blockquote', false);
      applyLineFormat(quillRef, 'code-block', true);
      return;
    }

    applyLineFormat(quillRef, 'blockquote', false);
    applyLineFormat(quillRef, 'code-block', false);
    applyLineFormat(quillRef, 'header', Number(value));
  };

  const handleSizeChange = (value) => {
    applyFormat(quillRef, 'size', value || false);
  };

  const closeAndRun = (fn) => {
    setMoreOpen(false);
    if (typeof fn === 'function') fn();
  };

  return (
    <div className="relative z-30 shrink-0 overflow-visible border-b border-border/50 bg-background/90">
      <div className="flex h-[44px] min-w-0 items-center gap-1.5 overflow-visible px-2">
        <ToolbarGroup className="hidden sm:inline-flex">
          <ToolbarButton icon={Undo2} label="Undo" onClick={() => runHistory(quillRef, 'undo')} />
          <ToolbarButton icon={Redo2} label="Redo" onClick={() => runHistory(quillRef, 'redo')} />
        </ToolbarGroup>

        <ToolbarGroup className="min-w-0">
          <ToolbarSelect
            label="Text style"
            value={currentStyle}
            options={STYLE_OPTIONS}
            onChange={handleStyleChange}
            className="w-[105px] sm:w-[120px]"
          />

          <ToolbarSelect
            label="Font size"
            value={currentSize}
            options={SIZE_OPTIONS}
            onChange={handleSizeChange}
            className="hidden w-[58px] sm:inline-flex"
          />
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            icon={Bold}
            label="Bold"
            active={Boolean(formats.bold)}
            onClick={() => toggleFormat(quillRef, 'bold', formats)}
          />
          <ToolbarButton
            icon={Italic}
            label="Italic"
            active={Boolean(formats.italic)}
            onClick={() => toggleFormat(quillRef, 'italic', formats)}
          />
          <ToolbarButton
            icon={Underline}
            label="Underline"
            active={Boolean(formats.underline)}
            onClick={() => toggleFormat(quillRef, 'underline', formats)}
          />
          <ToolbarButton
            icon={Strikethrough}
            label="Strikethrough"
            active={Boolean(formats.strike)}
            onClick={() => toggleFormat(quillRef, 'strike', formats)}
            className="hidden md:inline-flex"
          />
        </ToolbarGroup>

        <ToolbarGroup className="hidden lg:inline-flex">
          <ToolbarButton
            icon={AlignLeft}
            label="Align left"
            active={!formats.align || formats.align === 'left'}
            onClick={() => applyLineFormat(quillRef, 'align', false)}
          />
          <ToolbarButton
            icon={AlignCenter}
            label="Align center"
            active={formats.align === 'center'}
            onClick={() => applyLineFormat(quillRef, 'align', 'center')}
          />
          <ToolbarButton
            icon={AlignRight}
            label="Align right"
            active={formats.align === 'right'}
            onClick={() => applyLineFormat(quillRef, 'align', 'right')}
          />
          <ToolbarButton
            icon={AlignJustify}
            label="Justify"
            active={formats.align === 'justify'}
            onClick={() => applyLineFormat(quillRef, 'align', 'justify')}
          />
        </ToolbarGroup>

        <div className="relative z-50 ml-auto shrink-0 overflow-visible" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-2xl border border-border/60 bg-card/70 px-3 text-xs font-black text-foreground transition hover:bg-muted',
              moreOpen && 'bg-muted'
            )}
            title="Format tools"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>Format</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {moreOpen && (
            <div className="absolute right-0 top-11 z-[999] max-h-[72vh] w-80 overflow-y-auto rounded-2xl border border-border bg-background p-2 shadow-2xl">
              <MenuSection label="Text">
                <MenuButton
                  icon={Bold}
                  label="Bold"
                  active={Boolean(formats.bold)}
                  onClick={() => closeAndRun(() => toggleFormat(quillRef, 'bold', formats))}
                />
                <MenuButton
                  icon={Italic}
                  label="Italic"
                  active={Boolean(formats.italic)}
                  onClick={() => closeAndRun(() => toggleFormat(quillRef, 'italic', formats))}
                />
                <MenuButton
                  icon={Underline}
                  label="Underline"
                  active={Boolean(formats.underline)}
                  onClick={() => closeAndRun(() => toggleFormat(quillRef, 'underline', formats))}
                />
                <MenuButton
                  icon={Strikethrough}
                  label="Strikethrough"
                  active={Boolean(formats.strike)}
                  onClick={() => closeAndRun(() => toggleFormat(quillRef, 'strike', formats))}
                />
                <MenuButton
                  icon={Subscript}
                  label="Subscript"
                  active={formats.script === 'sub'}
                  onClick={() =>
                    closeAndRun(() =>
                      applyFormat(quillRef, 'script', formats.script === 'sub' ? false : 'sub')
                    )
                  }
                />
                <MenuButton
                  icon={Superscript}
                  label="Superscript"
                  active={formats.script === 'super'}
                  onClick={() =>
                    closeAndRun(() =>
                      applyFormat(quillRef, 'script', formats.script === 'super' ? false : 'super')
                    )
                  }
                />
              </MenuSection>

              <ColorSwatchMenu
                label="Text Color"
                swatches={COLOR_SWATCHES}
                onPick={(value) => closeAndRun(() => applyFormat(quillRef, 'color', value))}
              />

              <ColorSwatchMenu
                label="Highlight"
                swatches={HIGHLIGHT_SWATCHES}
                onPick={(value) => closeAndRun(() => applyFormat(quillRef, 'background', value))}
              />

              <MenuSection label="Paragraph">
                <MenuButton
                  icon={AlignLeft}
                  label="Align Left"
                  active={!formats.align || formats.align === 'left'}
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'align', false))}
                />
                <MenuButton
                  icon={AlignCenter}
                  label="Align Center"
                  active={formats.align === 'center'}
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'align', 'center'))}
                />
                <MenuButton
                  icon={AlignRight}
                  label="Align Right"
                  active={formats.align === 'right'}
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'align', 'right'))}
                />
                <MenuButton
                  icon={AlignJustify}
                  label="Justify"
                  active={formats.align === 'justify'}
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'align', 'justify'))}
                />
                <MenuButton
                  icon={Quote}
                  label="Block Quote"
                  active={Boolean(formats.blockquote)}
                  onClick={() =>
                    closeAndRun(() =>
                      applyLineFormat(quillRef, 'blockquote', !formats.blockquote)
                    )
                  }
                />
                <MenuButton
                  icon={Code}
                  label="Code Block"
                  active={Boolean(formats['code-block'])}
                  onClick={() =>
                    closeAndRun(() =>
                      applyLineFormat(quillRef, 'code-block', !formats['code-block'])
                    )
                  }
                />
              </MenuSection>

              <MenuSection label="Lists & Indent">
                <MenuButton
                  icon={List}
                  label="Bullet List"
                  active={formats.list === 'bullet'}
                  onClick={() =>
                    closeAndRun(() =>
                      applyLineFormat(
                        quillRef,
                        'list',
                        formats.list === 'bullet' ? false : 'bullet'
                      )
                    )
                  }
                />
                <MenuButton
                  icon={ListOrdered}
                  label="Numbered List"
                  active={formats.list === 'ordered'}
                  onClick={() =>
                    closeAndRun(() =>
                      applyLineFormat(
                        quillRef,
                        'list',
                        formats.list === 'ordered' ? false : 'ordered'
                      )
                    )
                  }
                />
                <MenuButton
                  icon={IndentDecrease}
                  label="Decrease Indent"
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'indent', '-1'))}
                />
                <MenuButton
                  icon={IndentIncrease}
                  label="Increase Indent"
                  onClick={() => closeAndRun(() => applyLineFormat(quillRef, 'indent', '+1'))}
                />
              </MenuSection>

              <MenuSection label="Insert / Cleanup">
                <MenuButton
                  icon={Minus}
                  label="Scene Divider"
                  detail="Insert centered manuscript scene break"
                  onClick={() => closeAndRun(() => insertDivider(quillRef))}
                />
                <MenuButton
                  icon={Pilcrow}
                  label="Normal Paragraph"
                  detail="Clear heading, quote, and code block styling"
                  onClick={() =>
                    closeAndRun(() => {
                      applyLineFormat(quillRef, 'header', false);
                      applyLineFormat(quillRef, 'blockquote', false);
                      applyLineFormat(quillRef, 'code-block', false);
                    })
                  }
                />
                <MenuButton
                  icon={Palette}
                  label="Default Text Color"
                  detail="Reset selected text color"
                  onClick={() => closeAndRun(() => applyFormat(quillRef, 'color', false))}
                />
                <MenuButton
                  icon={Highlighter}
                  label="Remove Highlight"
                  detail="Clear selected highlight/background"
                  onClick={() => closeAndRun(() => applyFormat(quillRef, 'background', false))}
                />
                <MenuButton
                  icon={Eraser}
                  label="Clear Selection Formatting"
                  detail="Remove inline and paragraph formatting"
                  onClick={() => closeAndRun(() => clearFormatting(quillRef))}
                />
                <MenuButton
                  icon={RemoveFormatting}
                  label="Clear All Formatting"
                  detail="Remove selected formatting"
                  onClick={() => closeAndRun(() => clearFormatting(quillRef))}
                />
              </MenuSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}