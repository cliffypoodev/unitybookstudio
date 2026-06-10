// =============================================================
// PublishSettingsSheet.jsx — Organized Publishing Setup Panel
//
// Purpose:
// - Cleaner page setup / publishing settings drawer.
// - Groups settings into logical sections.
// - Adds publishing presets.
// - Preserves unknown settings by spreading the existing object.
// - Compatible with existing ExportTab usage:
//
// <PublishSettingsSheet
//   open={settingsOpen}
//   onOpenChange={setSettingsOpen}
//   publishSettings={publishSettings}
//   onSettingsChange={setPublishSettings}
// />
// =============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  LayoutTemplate,
  Maximize2,
  SlidersHorizontal,
  Type,
  X,
} from 'lucide-react';

import { DEFAULT_PUBLISH_SETTINGS } from '@/lib/publishConstants';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const TRIM_OPTIONS = [
  '5in x 8in',
  '5.06in x 7.81in',
  '5.25in x 8in',
  '5.5in x 8.5in',
  '6in x 9in',
  '7in x 10in',
  '8.5in x 11in',
];

const FONT_OPTIONS = [
  'Times New Roman',
  'Garamond',
  'Georgia',
  'Palatino',
  'Baskerville',
  'Caslon',
  'Cormorant Garamond',
  'Libre Baskerville',
  'Lora',
  'Merriweather',
  'Inter',
  'Arial',
];

const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 16, 18];

const LINE_HEIGHT_OPTIONS = [
  'Single',
  'Compact',
  'Comfortable',
  '1.5',
  'Double',
];

const PARAGRAPH_BREAK_OPTIONS = [
  'Indented',
  'Spaced',
];

const PRESETS = [
  {
    id: 'kdp-5x8',
    label: 'KDP Paperback 5×8',
    description: 'Compact paperback layout for novels and shorter nonfiction.',
    settings: {
      trimSize: '5in x 8in',
      paragraphFont: 'Garamond',
      fontSize: 11,
      lineHeight: 'Comfortable',
      paragraphBreak: 'Indented',
      insideMargin: 0.75,
      outsideMargin: 0.5,
      topMargin: 0.65,
      bottomMargin: 0.65,
    },
  },
  {
    id: 'kdp-6x9',
    label: 'KDP Paperback 6×9',
    description: 'Standard trade paperback layout for most nonfiction and novels.',
    settings: {
      trimSize: '6in x 9in',
      paragraphFont: 'Garamond',
      fontSize: 12,
      lineHeight: 'Comfortable',
      paragraphBreak: 'Indented',
      insideMargin: 0.75,
      outsideMargin: 0.55,
      topMargin: 0.7,
      bottomMargin: 0.7,
    },
  },
  {
    id: 'draft-review',
    label: 'Draft Review',
    description: 'Roomier layout for editing, proofing, and markup.',
    settings: {
      trimSize: '8.5in x 11in',
      paragraphFont: 'Georgia',
      fontSize: 12,
      lineHeight: '1.5',
      paragraphBreak: 'Spaced',
      insideMargin: 1,
      outsideMargin: 1,
      topMargin: 1,
      bottomMargin: 1,
    },
  },
  {
    id: 'large-print',
    label: 'Large Print',
    description: 'Larger, more readable print layout.',
    settings: {
      trimSize: '6in x 9in',
      paragraphFont: 'Georgia',
      fontSize: 16,
      lineHeight: '1.5',
      paragraphBreak: 'Spaced',
      insideMargin: 0.85,
      outsideMargin: 0.65,
      topMargin: 0.8,
      bottomMargin: 0.8,
    },
  },
];

function getBaseSettings(settings) {
  return {
    ...DEFAULT_PUBLISH_SETTINGS,
    ...(settings || {}),
  };
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-black text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldLabel({ label, help }) {
  return (
    <div className="mb-1.5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {help ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function SelectField({ label, help, value, options, onChange }) {
  return (
    <label className="block">
      <FieldLabel label={label} help={help} />

      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-2xl border border-border bg-card px-3 pr-9 text-sm font-bold text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        >
          {options.map((option) => (
            <option key={String(option)} value={option}>
              {option}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
}

function NumberField({
  label,
  help,
  value,
  min = 0,
  max = 3,
  step = 0.05,
  suffix = 'in',
  onChange,
}) {
  return (
    <label className="block">
      <FieldLabel label={label} help={help} />

      <div className="flex h-10 overflow-hidden rounded-2xl border border-border bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          onChange={(event) => onChange(normalizeNumber(event.target.value, value))}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-bold text-foreground outline-none"
        />

        <div className="flex items-center border-l border-border px-3 text-xs font-bold text-muted-foreground">
          {suffix}
        </div>
      </div>
    </label>
  );
}

function ToggleButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 flex-1 items-center justify-center rounded-2xl border px-3 text-xs font-black transition',
        active
          ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function PresetButton({ preset, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-3xl border p-3 text-left transition hover:bg-muted/60',
        active
          ? 'border-primary/40 bg-primary/10'
          : 'border-border/60 bg-card/70'
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-transparent'
          )}
        >
          <Check className="h-3 w-3" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">{preset.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
        </div>
      </div>
    </button>
  );
}

function SettingsPreviewCard({ settings }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FileText className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-black text-foreground">Current Setup</p>
          <p className="text-[11px] text-muted-foreground">Live export settings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-background/75 p-3">
          <p className="font-black text-foreground">{settings.trimSize || '—'}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Trim size</p>
        </div>

        <div className="rounded-2xl bg-background/75 p-3">
          <p className="font-black text-foreground">{settings.fontSize || 12} pt</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Font size</p>
        </div>

        <div className="col-span-2 rounded-2xl bg-background/75 p-3">
          <p className="truncate font-black text-foreground">
            {settings.paragraphFont || 'Times New Roman'}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">Body font</p>
        </div>

        <div className="rounded-2xl bg-background/75 p-3">
          <p className="font-black text-foreground">{settings.lineHeight || 'Single'}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Line spacing</p>
        </div>

        <div className="rounded-2xl bg-background/75 p-3">
          <p className="font-black text-foreground">{settings.paragraphBreak || 'Indented'}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Paragraphs</p>
        </div>
      </div>
    </div>
  );
}

export default function PublishSettingsSheet({
  open,
  onOpenChange,
  publishSettings,
  onSettingsChange,
}) {
  const [localSettings, setLocalSettings] = useState(() => getBaseSettings(publishSettings));

  useEffect(() => {
    if (open) {
      setLocalSettings(getBaseSettings(publishSettings));
    }
  }, [open, publishSettings]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onOpenChange]);

  const updateSetting = (key, value) => {
    setLocalSettings((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      onSettingsChange?.(next);
      return next;
    });
  };

  const applyPreset = (preset) => {
    setLocalSettings((current) => {
      const next = {
        ...current,
        ...preset.settings,
      };

      onSettingsChange?.(next);
      return next;
    });
  };

  const resetDefaults = () => {
    const next = getBaseSettings(DEFAULT_PUBLISH_SETTINGS);
    setLocalSettings(next);
    onSettingsChange?.(next);
  };

  const activePresetId = useMemo(() => {
    const match = PRESETS.find((preset) => {
      return Object.entries(preset.settings).every(([key, value]) => {
        return String(localSettings?.[key]) === String(value);
      });
    });

    return match?.id || null;
  }, [localSettings]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex justify-end bg-black/40 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange?.(false);
        }
      }}
    >
      <aside
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-border bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-border bg-card/80 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-foreground">Publishing Settings</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Control trim size, margins, body font, paragraph style, and export layout.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Close publishing settings"
              aria-label="Close publishing settings"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              <SectionCard
                icon={LayoutTemplate}
                title="Presets"
                description="Start with a practical layout, then fine-tune the details."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {PRESETS.map((preset) => (
                    <PresetButton
                      key={preset.id}
                      preset={preset}
                      active={activePresetId === preset.id}
                      onClick={() => applyPreset(preset)}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                icon={BookOpen}
                title="Book Size"
                description="Choose the print trim size used by the editor, preview, PDF, and DOCX export."
              >
                <SelectField
                  label="Trim Size"
                  help="6×9 is the safest general-purpose paperback size."
                  value={localSettings.trimSize}
                  options={TRIM_OPTIONS}
                  onChange={(value) => updateSetting('trimSize', value)}
                />
              </SectionCard>

              <SectionCard
                icon={Maximize2}
                title="Margins"
                description="Inside margin is the gutter side. Increase it for thicker books."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Inside Margin"
                    value={localSettings.insideMargin}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onChange={(value) => updateSetting('insideMargin', value)}
                  />

                  <NumberField
                    label="Outside Margin"
                    value={localSettings.outsideMargin}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onChange={(value) => updateSetting('outsideMargin', value)}
                  />

                  <NumberField
                    label="Top Margin"
                    value={localSettings.topMargin}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onChange={(value) => updateSetting('topMargin', value)}
                  />

                  <NumberField
                    label="Bottom Margin"
                    value={localSettings.bottomMargin}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onChange={(value) => updateSetting('bottomMargin', value)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={Type}
                title="Typography"
                description="Set the manuscript’s body font, size, line spacing, and paragraph style."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Body Font"
                    value={localSettings.paragraphFont}
                    options={FONT_OPTIONS}
                    onChange={(value) => updateSetting('paragraphFont', value)}
                  />

                  <SelectField
                    label="Font Size"
                    value={Number(localSettings.fontSize || 12)}
                    options={FONT_SIZE_OPTIONS}
                    onChange={(value) => updateSetting('fontSize', Number(value))}
                  />

                  <SelectField
                    label="Line Spacing"
                    value={localSettings.lineHeight}
                    options={LINE_HEIGHT_OPTIONS}
                    onChange={(value) => updateSetting('lineHeight', value)}
                  />

                  <div>
                    <FieldLabel
                      label="Paragraph Style"
                      help="Indented is more common for fiction. Spaced works well for drafts and some nonfiction."
                    />

                    <div className="flex gap-2">
                      {PARAGRAPH_BREAK_OPTIONS.map((option) => (
                        <ToggleButton
                          key={option}
                          active={localSettings.paragraphBreak === option}
                          onClick={() => updateSetting('paragraphBreak', option)}
                        >
                          {option}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-5">
              <SettingsPreviewCard settings={localSettings} />

              <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
                <p className="text-sm font-black text-foreground">Quick Notes</p>

                <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
                  <p>
                    For KDP paperbacks, 6×9 is usually the easiest all-purpose format.
                  </p>

                  <p>
                    For novels, a serif body font with indented paragraphs usually looks most professional.
                  </p>

                  <p>
                    For draft review, use larger margins and spaced paragraphs so editing is easier.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
                <p className="text-sm font-black text-foreground">Actions</p>

                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={resetDefaults}
                    className="h-10 w-full rounded-2xl border border-border bg-background text-sm font-black text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    Reset Defaults
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="h-10 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground transition hover:opacity-90"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </aside>
    </div>
  );
}