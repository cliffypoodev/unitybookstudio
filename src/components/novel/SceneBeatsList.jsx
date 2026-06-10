import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Zap, ChevronRight, BookOpen, AlertTriangle } from 'lucide-react';

// ── Fiction Beat Row ────────────────────────────────────────

function TensionDots({ level }) {
  const safeLevel = typeof level === 'number' ? level : 0;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`h-1 w-1 rounded-full ${i < safeLevel ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );
}

function FictionBeatRow({ beat }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-background/80 transition-colors"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="shrink-0 font-medium text-muted-foreground w-4 text-center">{beat.scene_number}</span>
        <span className="truncate text-foreground">{beat.scene_goal}</span>
        <span className="ml-auto shrink-0"><TensionDots level={beat.tension_level} /></span>
      </button>
      {open && (
        <div className="pb-2 pl-9 pr-3 text-[11px] leading-5 text-muted-foreground space-y-1">
          {(beat.pov_character || beat.setting) && (
            <div className="flex flex-wrap gap-x-3">
              {beat.pov_character && <span>POV: <span className="text-foreground">{beat.pov_character}</span></span>}
              {beat.setting && <span>Setting: <span className="text-foreground">{beat.setting}</span></span>}
            </div>
          )}
          {beat.conflict && <p><span className="font-medium text-foreground">Conflict:</span> {beat.conflict}</p>}
          {beat.emotional_arc && <p><span className="font-medium text-foreground">Arc:</span> {beat.emotional_arc}</p>}
          {beat.exit_hook && <p className="italic">→ {beat.exit_hook}</p>}
        </div>
      )}
    </div>
  );
}

// ── Nonfiction Section Row ──────────────────────────────────

const TEMPO_COLORS = { fast: 'bg-destructive/15 text-destructive', medium: 'bg-accent text-accent-foreground', slow: 'bg-secondary text-secondary-foreground' };

function NonfictionSectionRow({ section }) {
  const [open, setOpen] = useState(false);
  const warnings = section.fabrication_warnings || [];

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-background/80 transition-colors"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="shrink-0 font-medium text-muted-foreground w-4 text-center">{section.section_number}</span>
        <span className="truncate text-foreground font-medium">{section.title}</span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[8px] px-1 py-0">{section.mode}</Badge>
          <Badge className={`text-[8px] px-1 py-0 ${TEMPO_COLORS[section.tempo] || ''}`}>{section.tempo}</Badge>
          {section.word_target > 0 && <span className="text-[9px] text-muted-foreground">{section.word_target}w</span>}
        </div>
      </button>
      {open && (
        <div className="pb-2 pl-9 pr-3 text-[11px] leading-5 text-muted-foreground space-y-1.5">
          {section.purpose && <p><span className="font-medium text-foreground">Purpose:</span> {section.purpose}</p>}
          {section.content_direction && <p><span className="font-medium text-foreground">Direction:</span> {section.content_direction}</p>}
          {section.key_claim && <p><span className="font-medium text-foreground">Key claim:</span> {section.key_claim}</p>}
          {section.evidence_needed && <p><span className="font-medium text-foreground">Evidence:</span> {section.evidence_needed}</p>}
          <div className="flex flex-wrap gap-x-3">
            {section.opens_with && <span>Opens: <span className="text-foreground">{section.opens_with}</span></span>}
            {section.closes_with && <span>Closes: <span className="text-foreground">{section.closes_with}</span></span>}
          </div>
          {warnings.length > 0 && (
            <div className="mt-1 flex items-start gap-1 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <div>{warnings.join('; ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Argument Progression ────────────────────────────────────

function ArgumentProgression({ data }) {
  if (!data) return null;
  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-background/40 p-3 space-y-1">
      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Argument Flow</span>
      </div>
      <div className="text-[11px] leading-5 text-muted-foreground space-y-1">
        {data.prior_chapter_endpoint && <p><span className="font-medium text-foreground">Prior endpoint:</span> {data.prior_chapter_endpoint}</p>}
        {data.this_chapter_advances && <p><span className="font-medium text-foreground">This chapter advances:</span> {data.this_chapter_advances}</p>}
        {data.new_ground && <p><span className="font-medium text-foreground">New ground:</span> {data.new_ground}</p>}
        {data.handoff && <p><span className="font-medium text-foreground">Handoff →</span> {data.handoff}</p>}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function SceneBeatsList({ beatsJson }) {
  const parsed = React.useMemo(() => {
    if (!beatsJson) return null;
    try { return JSON.parse(beatsJson); } catch { return null; }
  }, [beatsJson]);

  if (!parsed) return null;

  // Detect nonfiction format: object with "sections" array
  const isNonfiction = parsed && !Array.isArray(parsed) && Array.isArray(parsed.sections);
  const fictionBeats = Array.isArray(parsed) ? parsed : [];

  if (isNonfiction) {
    const sections = parsed.sections || [];
    const totalWords = sections.reduce((sum, s) => sum + (s.word_target || 0), 0);
    if (!sections.length) return null;

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Section Beats</span>
          <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">{sections.length} sections · ~{totalWords.toLocaleString()}w</Badge>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 divide-y-0">
          {sections.map((section) => (
            <NonfictionSectionRow key={section.section_number} section={section} />
          ))}
        </div>
        <ArgumentProgression data={parsed.argument_progression} />
      </div>
    );
  }

  // Fiction beats (array)
  if (!fictionBeats.length) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scene Beats</span>
        <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">{fictionBeats.length} scenes</Badge>
      </div>
      <div className="rounded-lg border border-border/50 bg-background/40 divide-y-0">
        {fictionBeats.map((beat) => (
          <FictionBeatRow key={beat.scene_number} beat={beat} />
        ))}
      </div>
    </div>
  );
}