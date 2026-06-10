import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Pencil, AlertTriangle } from 'lucide-react';
import {
  GENRE_DEFAULTS,
  FICTION_GENRES,
  NONFICTION_GENRES,
  VIOLENCE_LEVELS,
  SPICE_LEVELS,
  LANGUAGE_INTENSITY,
  TENSE_OPTIONS,
  getPovOptions,
} from '@/lib/autonovel';

/**
 * Confirmation dialog for creating a project from an Ideas Architect blueprint.
 * Shows all proposed settings in an editable form, maps blueprint → project settings.
 * User confirms or edits before creating.
 */
export default function CreateProjectFromIdeaDialog({ open, onOpenChange, blueprint, onConfirmCreate }) {
  const [editing, setEditing] = useState(false);

  // Map blueprint fields to project settings with safe defaults
  const initialFields = useMemo(() => {
    if (!blueprint) return {};
    const genreDefaults = GENRE_DEFAULTS[blueprint.genre] || {};
    return {
      title: blueprint.premise ? blueprint.premise.substring(0, 80) + '…' : 'Untitled',
      seed_concept: blueprint.premise || '',
      story_engine: blueprint.story_engine || '',
      book_type: blueprint.book_type || 'fiction',
      genre: blueprint.genre || 'Thriller',
      subgenre: blueprint.subgenre || '',
      target_audience: blueprint.targetAudience || '',
      chapter_target: blueprint.chapterCount || genreDefaults.chapters || 20,
      chapter_length_preset: blueprint.chapterLength || 'standard',
      author_voice: blueprint.authorVoice || 'Custom / None',
      tense: blueprint.tense || genreDefaults.tense || 'past',
      pov_mode: blueprint.pov || genreDefaults.pov || 'third-close',
      beat_style: blueprint.beatStyle || genreDefaults.beat || 'Tension-Driven',
      story_arc: blueprint.storyArcPacing || 'three_act',
      spice_level: blueprint.spiceLevel ?? 0,
      language_intensity: blueprint.languageLevel ?? 2,
      violence_level: blueprint.violenceLevel ?? (genreDefaults.violence ?? 0),
    };
  }, [blueprint]);

  const [fields, setFields] = useState(initialFields);

  // Reset fields when blueprint changes
  React.useEffect(() => {
    setFields(initialFields);
    setEditing(false);
  }, [initialFields]);

  const updateField = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const allGenres = [...FICTION_GENRES, ...NONFICTION_GENRES];
  const povOptions = getPovOptions(fields.book_type);

  const handleConfirm = () => {
    if (onConfirmCreate) {
      onConfirmCreate(fields);
    }
    onOpenChange(false);
  };

  if (!blueprint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-chart-1" />
            Create Project from Idea
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review the proposed project settings below. Edit anything before creating.
          </DialogDescription>
        </DialogHeader>

        {/* Story Engine */}
        {fields.story_engine && (
          <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-3 mb-2">
            <div className="text-xs font-semibold text-chart-1 mb-1">Story Engine</div>
            <div className="text-sm text-foreground">{fields.story_engine}</div>
          </div>
        )}

        {/* Premise / Seed Concept */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Premise / Seed Concept</label>
            {editing ? (
              <Textarea
                value={fields.seed_concept}
                onChange={(e) => updateField('seed_concept', e.target.value)}
                className="min-h-[80px] text-sm"
              />
            ) : (
              <div className="text-sm text-foreground bg-muted/30 rounded-lg p-2.5 border border-border/50">
                {fields.seed_concept || 'No premise specified.'}
              </div>
            )}
          </div>

          {/* Two-column grid for settings */}
          <div className="grid grid-cols-2 gap-3">
            {/* Genre */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Genre</label>
              {editing ? (
                <Select value={fields.genre} onValueChange={(v) => updateField('genre', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allGenres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium">{fields.genre}</div>
              )}
            </div>

            {/* Book Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Book Type</label>
              {editing ? (
                <Select value={fields.book_type} onValueChange={(v) => updateField('book_type', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiction">Fiction</SelectItem>
                    <SelectItem value="nonfiction">Nonfiction</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium capitalize">{fields.book_type}</div>
              )}
            </div>

            {/* POV */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">POV</label>
              {editing ? (
                <Select value={fields.pov_mode} onValueChange={(v) => updateField('pov_mode', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(povOptions).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium">{fields.pov_mode}</div>
              )}
            </div>

            {/* Tense */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tense</label>
              {editing ? (
                <Select value={fields.tense} onValueChange={(v) => updateField('tense', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TENSE_OPTIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium capitalize">{fields.tense}</div>
              )}
            </div>

            {/* Chapters */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Chapters</label>
              {editing ? (
                <Input
                  type="number"
                  value={fields.chapter_target}
                  onChange={(e) => updateField('chapter_target', Number(e.target.value))}
                  className="h-8 text-xs"
                  min={1}
                  max={100}
                />
              ) : (
                <div className="text-sm font-medium">{fields.chapter_target}</div>
              )}
            </div>

            {/* Voice */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Author Voice</label>
              {editing ? (
                <Input
                  value={fields.author_voice}
                  onChange={(e) => updateField('author_voice', e.target.value)}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="text-sm font-medium">{fields.author_voice || 'Custom / None'}</div>
              )}
            </div>
          </div>

          {/* Content Levels */}
          <div className="border-t border-border/50 pt-3 mt-1">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Content Levels</div>
            <div className="grid grid-cols-3 gap-3">
              {/* Spice */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Spice</label>
                {editing ? (
                  <Select value={String(fields.spice_level)} onValueChange={(v) => updateField('spice_level', Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SPICE_LEVELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm font-medium">{SPICE_LEVELS[fields.spice_level]?.label || fields.spice_level}/4</div>
                )}
              </div>

              {/* Language */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Language</label>
                {editing ? (
                  <Select value={String(fields.language_intensity)} onValueChange={(v) => updateField('language_intensity', Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGE_INTENSITY).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm font-medium">{LANGUAGE_INTENSITY[fields.language_intensity]?.label || fields.language_intensity}/4</div>
                )}
              </div>

              {/* Violence */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Violence</label>
                {editing ? (
                  <Select value={String(fields.violence_level)} onValueChange={(v) => updateField('violence_level', Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(VIOLENCE_LEVELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm font-medium">{VIOLENCE_LEVELS[fields.violence_level]?.label || fields.violence_level}/5</div>
                )}
              </div>
            </div>
          </div>

          {/* Safety note */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Content levels are initial settings — you can always adjust them in the Setup tab after the project is created.</span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? 'Done Editing' : 'Edit Fields'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Create Project
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
