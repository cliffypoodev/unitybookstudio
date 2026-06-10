// =============================================================
// PublishSettingsSheet.jsx — Phase 2H Page Setup Upgrade
//
// Purpose:
// - Give Export tab a stronger standalone publishing setup panel.
// - Keep the same props/API already used by ExportTab:
//   open, onOpenChange, publishSettings, onSettingsChange
// - No database changes.
// - No save pipeline changes.
// =============================================================

import React, { useMemo } from 'react';
import {
  BookOpen,
  FileText,
  Layout,
  RotateCcw,
  Ruler,
  Settings,
  Type,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_PUBLISH_SETTINGS, parseTrimSize } from '@/lib/publishConstants';

const TRIM_SIZES = [
  { value: '5x8', label: '5 × 8 in', desc: 'Compact fiction paperback' },
  { value: '5.25x8', label: '5.25 × 8 in', desc: 'Slim trade paperback' },
  { value: '5.5x8.5', label: '5.5 × 8.5 in', desc: 'Common fiction trim' },
  { value: '6x9', label: '6 × 9 in', desc: 'Standard trade paperback' },
  { value: '7x10', label: '7 × 10 in', desc: 'Training / workbook friendly' },
  { value: '8x10', label: '8 × 10 in', desc: 'Large format' },
  { value: '8.5x11', label: '8.5 × 11 in', desc: 'Letter / manual format' },
];

const FONT_OPTIONS = [
  'Cormorant Garamond',
  'Georgia',
  'Merriweather',
  'Libre Baskerville',
  'Lora',
  'Playfair Display',
  'Times New Roman',
  'Arial',
  'Inter',
];

const FONT_SIZE_OPTIONS = ['10', '11', '12', '13', '14', '15', '16'];

const LINE_HEIGHT_OPTIONS = [
  { value: '1.15', label: 'Tight — 1.15' },
  { value: '1.3', label: 'Compact — 1.3' },
  { value: '1.5', label: 'Standard — 1.5' },
  { value: '1.7', label: 'Comfort — 1.7' },
  { value: '2', label: 'Double — 2.0' },
];

const PARAGRAPH_BREAK_OPTIONS = [
  { value: 'Indented', label: 'Indented paragraphs' },
  { value: 'Space Between', label: 'Space between paragraphs' },
];

const RUNNING_HEADER_OPTIONS = [
  { value: 'None', label: 'None' },
  { value: 'Book Title', label: 'Book Title' },
  { value: 'Author Name', label: 'Author Name' },
  { value: 'Chapter Title', label: 'Chapter Title' },
  { value: 'Chapter Number', label: 'Chapter Number' },
];

function normalizeSettings(settings) {
  return {
    ...DEFAULT_PUBLISH_SETTINGS,
    ...(settings || {}),
  };
}

function SettingSection({ title, icon: Icon, children, description }) {
  return (
    <section className="rounded-2xl border border-border/65 bg-background/55 p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/85">{label}</Label>
      {children}
      {hint && <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 5, step = '0.01' }) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === '' ? '' : Number(raw));
      }}
      className="h-9 rounded-xl"
    />
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-full border border-border/60 bg-card/65 px-3 py-1.5 text-[10px] text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span> {label}
    </div>
  );
}

function getRecommendedMargins(trimSize) {
  const dim = parseTrimSize(trimSize || '6x9');
  const width = Number(dim?.w || 6);

  if (width <= 5.25) {
    return {
      topMargin: 0.7,
      bottomMargin: 0.7,
      insideMargin: 0.78,
      outsideMargin: 0.55,
    };
  }

  if (width <= 6) {
    return {
      topMargin: 0.75,
      bottomMargin: 0.75,
      insideMargin: 0.8,
      outsideMargin: 0.6,
    };
  }

  return {
    topMargin: 0.8,
    bottomMargin: 0.8,
    insideMargin: 0.85,
    outsideMargin: 0.65,
  };
}

export default function PublishSettingsSheet({
  open,
  onOpenChange,
  publishSettings,
  onSettingsChange,
}) {
  const settings = useMemo(() => normalizeSettings(publishSettings), [publishSettings]);

  const trimInfo = useMemo(() => {
    try {
      return parseTrimSize(settings.trimSize || '6x9');
    } catch {
      return { w: 6, h: 9 };
    }
  }, [settings.trimSize]);

  const selectedTrim = TRIM_SIZES.find((item) => item.value === settings.trimSize);

  const updateSetting = (field, value) => {
    onSettingsChange?.({
      ...settings,
      [field]: value,
    });
  };

  const updateSettings = (patch) => {
    onSettingsChange?.({
      ...settings,
      ...patch,
    });
  };

  const resetToDefaults = () => {
    onSettingsChange?.({
      ...DEFAULT_PUBLISH_SETTINGS,
    });
  };

  const applyRecommendedMargins = () => {
    updateSettings(getRecommendedMargins(settings.trimSize || '6x9'));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[520px]">
        <SheetHeader className="shrink-0 border-b border-border/60 bg-background/90 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <SheetTitle className="text-lg">Page Setup</SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-5">
                Configure trim size, typography, margins, paragraph style, and running headers for preview, PDF, and DOCX exports.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4">
          <div className="mb-4 rounded-2xl border border-border/65 bg-background/75 p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold text-foreground">Current Setup</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill label="trim" value={selectedTrim?.label || settings.trimSize || '6 × 9 in'} />
              <SummaryPill label="font" value={settings.paragraphFont || 'Default'} />
              <SummaryPill label="type" value={`${settings.fontSize || 12}pt`} />
              <SummaryPill label="line" value={settings.lineHeight || '1.5'} />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              Page size resolves to approximately {trimInfo?.w || 6} × {trimInfo?.h || 9} inches. These settings feed preview, print/PDF, and DOCX export.
            </p>
          </div>

          <div className="space-y-4">
            <SettingSection
              title="Trim Size"
              icon={Ruler}
              description="Choose the final book size. 6 × 9 is the safest general-purpose paperback size."
            >
              <Field label="Book trim">
                <Select
                  value={settings.trimSize || '6x9'}
                  onValueChange={(value) => updateSetting('trimSize', value)}
                >
                  <SelectTrigger className="h-9 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIM_SIZES.map((trim) => (
                      <SelectItem key={trim.value} value={trim.value}>
                        {trim.label} — {trim.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-xl border border-border/55 bg-card/55 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                For KDP-style print workflows, keep the interior trim here consistent with your cover wrap trim size.
              </div>
            </SettingSection>

            <SettingSection
              title="Typography"
              icon={Type}
              description="Control the manuscript body font used in preview, PDF, and DOCX."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Paragraph font">
                  <Select
                    value={settings.paragraphFont || 'Cormorant Garamond'}
                    onValueChange={(value) => updateSetting('paragraphFont', value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Font size">
                  <Select
                    value={String(settings.fontSize || 12)}
                    onValueChange={(value) => updateSetting('fontSize', Number(value))}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} pt
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Line height">
                  <Select
                    value={String(settings.lineHeight || '1.5')}
                    onValueChange={(value) => updateSetting('lineHeight', value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LINE_HEIGHT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Paragraph style">
                  <Select
                    value={settings.paragraphBreak || 'Indented'}
                    onValueChange={(value) => updateSetting('paragraphBreak', value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARAGRAPH_BREAK_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </SettingSection>

            <SettingSection
              title="Margins"
              icon={Layout}
              description="Interior margins need room for the book gutter. The inside margin should usually be wider than the outside margin."
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Top">
                  <NumberInput
                    value={settings.topMargin ?? 0.75}
                    onChange={(value) => updateSetting('topMargin', value)}
                  />
                </Field>

                <Field label="Bottom">
                  <NumberInput
                    value={settings.bottomMargin ?? 0.75}
                    onChange={(value) => updateSetting('bottomMargin', value)}
                  />
                </Field>

                <Field label="Inside / gutter">
                  <NumberInput
                    value={settings.insideMargin ?? 0.8}
                    onChange={(value) => updateSetting('insideMargin', value)}
                  />
                </Field>

                <Field label="Outside">
                  <NumberInput
                    value={settings.outsideMargin ?? 0.6}
                    onChange={(value) => updateSetting('outsideMargin', value)}
                  />
                </Field>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyRecommendedMargins}
                className="h-8 rounded-full text-xs"
              >
                <Ruler className="mr-1.5 h-3.5 w-3.5" />
                Apply Recommended Margins
              </Button>
            </SettingSection>

            <SettingSection
              title="Running Headers"
              icon={FileText}
              description="Choose what appears on left/right page headers in preview and print output."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Verso / left pages">
                  <Select
                    value={settings.versoPageHeaders || 'Book Title'}
                    onValueChange={(value) => updateSetting('versoPageHeaders', value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RUNNING_HEADER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Recto / right pages">
                  <Select
                    value={settings.rectoPageHeaders || 'Chapter Title'}
                    onValueChange={(value) => updateSetting('rectoPageHeaders', value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RUNNING_HEADER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <p className="rounded-xl border border-border/55 bg-card/55 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                Headers are hidden in the Export editor itself, but they are used in preview/PDF style generation where supported.
              </p>
            </SettingSection>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              className="h-9 rounded-full text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Defaults
            </Button>

            <Button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="ml-auto h-9 rounded-full text-xs"
            >
              Done
            </Button>
          </div>

          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            Changes apply immediately to the Export tab and are autosaved by the existing project save flow.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}