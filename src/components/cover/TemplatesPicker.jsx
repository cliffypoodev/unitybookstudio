import React from 'react';
import { TEMPLATES } from '@/lib/coverTemplates';

/**
 * Templates Picker
 *
 * WAVE4-COVERWIRING: this file used to contain a copy of PublisherLogoUpload
 * (a paste-over that killed the templates feature and crashed on upload
 * because FabricEditor passes no `project` prop here). The logo uploader now
 * lives in PublisherLogoUpload.jsx where it belongs, and this is the real
 * picker again: it lists the layout templates from src/lib/coverTemplates.js
 * and calls onApply(templateId), which FabricEditor turns into canvas objects
 * via buildTemplateObjects.
 */
export default function TemplatesPicker({ onApply }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium">Layout Templates</label>
      <div className="space-y-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply?.(t.id)}
            className="w-full rounded-lg border border-border/60 bg-background/60 p-2 text-left transition hover:border-primary/60 hover:bg-accent/30"
            title={t.description}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{t.emoji}</span>
              <span className="text-[11px] font-medium">{t.label}</span>
            </div>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground italic">
        Applying a template replaces the editable text layers (artwork is kept).
      </p>
    </div>
  );
}
