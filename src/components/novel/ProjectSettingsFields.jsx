import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AUTHOR_VOICES_BY_GENRE,
  BEAT_STYLES,
  BOOK_TYPES,
  CHAPTER_LENGTH_PRESETS,
  EROTICA_REGISTERS,
  FICTION_POV_MODES,
  LANGUAGE_INTENSITY,
  NF_STRUCTURE_MODES,
  NONFICTION_POV_MODES,
  SPICE_LEVELS,
  VIOLENCE_LEVELS,
  TENSE_OPTIONS,
  getGenreOptions,
  getPovPresets,
  shouldShowEroticaSettings,
} from '@/lib/autonovel';

export default function ProjectSettingsFields({
  values,
  onFieldChange,
  onBookTypeChange,
  onGenreChange,
  onLengthPresetChange,
  onApplyPovPreset,
}) {
  const genreOptions = getGenreOptions(values.book_type);
  const povOptions = values.book_type === 'nonfiction' ? NONFICTION_POV_MODES : FICTION_POV_MODES;
  const povPresets = getPovPresets(values.book_type);
  const showEroticaSettings = shouldShowEroticaSettings(values);
  const totalWords = Number(values.chapter_target || 0) * Number(values.chapter_length_target || 0);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
      <section className="rounded-xl sm:rounded-[1.5rem] border border-border/70 bg-background/50 p-3 sm:p-5 overflow-hidden">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Step 1</p>
        <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl text-foreground">Core setup</h3>
        <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Book Type</Label>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {BOOK_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={values.book_type === type ? 'default' : 'outline'}
                  onClick={() => onBookTypeChange(type)}
                  className="rounded-full px-5 capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={values.genre || undefined} onValueChange={onGenreChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a genre" />
              </SelectTrigger>
              <SelectContent>
                {genreOptions.map((genre) => (
                  <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subgenre">Subgenre</Label>
            <Input id="subgenre" value={values.subgenre || ''} onChange={(event) => onFieldChange('subgenre', event.target.value)} placeholder="Optional subgenre" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="target-audience">Target Audience</Label>
            <Input id="target-audience" value={values.target_audience || ''} onChange={(event) => onFieldChange('target_audience', event.target.value)} placeholder="Adult crossover, YA fantasy readers, startup founders, caregivers..." />
          </div>
        </div>
      </section>

      <section className="rounded-xl sm:rounded-[1.5rem] border border-border/70 bg-background/50 p-3 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Step 2</p>
            <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl text-foreground">Review AI suggestions</h3>
          </div>
          {values.genre ? <p className="text-xs text-muted-foreground">Auto-filled from genre defaults</p> : null}
        </div>

        <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>POV preset</Label>
            <Select
              value={povPresets.find((p) => p.pov === values.pov_mode && p.tense === values.tense)?.id || undefined}
              onValueChange={(id) => { const p = povPresets.find((x) => x.id === id); if (p) onApplyPovPreset(p); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a POV preset" />
              </SelectTrigger>
              <SelectContent>
                {povPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label} — {preset.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>POV mode</Label>
            <Select value={values.pov_mode || undefined} onValueChange={(value) => onFieldChange('pov_mode', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose POV" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(povOptions).map(([key, description]) => (
                  <SelectItem key={key} value={key}>{description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tense</Label>
            <Select value={values.tense || undefined} onValueChange={(value) => onFieldChange('tense', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tense" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TENSE_OPTIONS)
                  .filter(([key]) => values.book_type === 'fiction' ? key !== 'mixed' : true)
                  .map(([key, description]) => (
                    <SelectItem key={key} value={key}>{description}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {values.book_type === 'fiction' ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Beat style</Label>
              <Select value={values.beat_style || undefined} onValueChange={(value) => onFieldChange('beat_style', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose beat style" />
                </SelectTrigger>
                <SelectContent>
                  {BEAT_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.name}>
                      {style.name} — {style.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <Label>Nonfiction structure mode</Label>
              <Select value={values.nf_structure_mode || undefined} onValueChange={(value) => onFieldChange('nf_structure_mode', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose structure" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NF_STRUCTURE_MODES).map(([key, mode]) => (
                    <SelectItem key={key} value={key}>
                      {mode.icon} {mode.label} — {mode.pattern}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl sm:rounded-[1.5rem] border border-border/70 bg-background/50 p-3 sm:p-5 overflow-hidden">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Step 3</p>
        <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl text-foreground">Advanced overrides</h3>

        <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="author-name">Author Name</Label>
            <Input id="author-name" value={values.author_name} onChange={(event) => onFieldChange('author_name', event.target.value)} placeholder="Enter pen name" />
          </div>

          <div className="space-y-2">
            <Label>Author voice</Label>
            <Select value={values.author_voice || undefined} onValueChange={(value) => onFieldChange('author_voice', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose author voice" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUTHOR_VOICES_BY_GENRE).map(([category, voices]) => (
                  <React.Fragment key={category}>
                    <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{category}</div>
                    {voices.map((v) => (
                      <SelectItem key={v.id} value={v.name}>{v.name} — {v.desc}</SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {values.author_voice === 'Custom / None' ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="author-voice-notes">Custom voice notes</Label>
              <Input id="author-voice-notes" value={values.author_voice_notes || ''} onChange={(event) => onFieldChange('author_voice_notes', event.target.value)} placeholder="Optional custom voice guidance" />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Language intensity</Label>
            <Select value={String(values.language_intensity || 2)} onValueChange={(value) => onFieldChange('language_intensity', Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose language intensity" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_INTENSITY).map(([key, option]) => (
                  <SelectItem key={key} value={key}>{option.label} — {option.desc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Violence level</Label>
            <Select value={String(values.violence_level || 0)} onValueChange={(value) => onFieldChange('violence_level', Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose violence level" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIOLENCE_LEVELS).map(([key, option]) => (
                  <SelectItem key={key} value={key}>{option.label} — {option.desc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-target">Chapter count</Label>
            <Input id="chapter-target" type="number" min="1" value={values.chapter_target} onChange={(event) => onFieldChange('chapter_target', Number(event.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Chapter length preset</Label>
            <Select value={values.chapter_length_preset || undefined} onValueChange={onLengthPresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose chapter length" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHAPTER_LENGTH_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-length-target">Chapter length target</Label>
            <Input id="chapter-length-target" type="number" min="500" step="100" value={values.chapter_length_target} onChange={(event) => onFieldChange('chapter_length_target', Number(event.target.value))} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Total word target</Label>
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
              {values.chapter_target} chapters × {Number(values.chapter_length_target || 0).toLocaleString()} words = ~{totalWords.toLocaleString()} words
            </div>
          </div>

          {showEroticaSettings ? (
            <>
              <div className="space-y-2">
                <Label>Spice level</Label>
                <Select value={String(values.spice_level || 0)} onValueChange={(value) => onFieldChange('spice_level', Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose spice level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPICE_LEVELS).map(([key, option]) => (
                      <SelectItem key={key} value={key}>{option.label} — {option.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Erotica register</Label>
                <Select value={String(values.erotica_register || 0)} onValueChange={(value) => onFieldChange('erotica_register', Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose erotica register" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EROTICA_REGISTERS).map(([key, option]) => (
                      <SelectItem key={key} value={key}>{option.name} — {option.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}