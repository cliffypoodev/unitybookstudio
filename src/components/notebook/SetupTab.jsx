import React from 'react';
import {
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Eye,
  GitBranch,
  PenLine,
  Ruler,
  SlidersHorizontal,
  Cpu,
} from 'lucide-react';
import SaveIndicator from '@/components/notebook/SaveIndicator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AUTHOR_VOICES_BY_GENRE,
  BEAT_STYLES,
  CHAPTER_LENGTH_PRESETS,
  EROTICA_REGISTERS,
  LANGUAGE_INTENSITY,
  NF_STRUCTURE_MODES,
  SPICE_LEVELS,
  TENSE_OPTIONS,
  VIOLENCE_LEVELS,
  getPovOptions,
  getPovPresets,
  isEroticaGenre,
  shouldShowEroticaRegister,
} from '@/lib/autonovel';
import {
  CONTENT_LANES,
  RIGHTS_MODES,
  CANON_MODES,
  getBookTypeForLane,
  getContentLane,
  getDefaultRightsModeForLane,
  getGenreFamilyOptionsForLane,
  getGenreFamilyForGenre,
  getGenreOptionsForFamily,
  getGenreFamilyDescription,
  getGenreDescription,
  getSubgenreDescription,
  getProjectFormatsForLane,
  getProjectTypeForFormat,
  getSubgenreOptionsForSelection,
  isEroticaLane,
  isFanfictionLane,
} from '@/lib/genreTaxonomy';
import { STORY_ARC_OPTIONS, getArcDescription } from '@/lib/pacingModulation';
import {
  TWIST_COUNT_OPTIONS,
  TWIST_INTENSITY_OPTIONS,
  getTwistCountDescription,
  getTwistIntensityDescription,
} from '@/lib/plotTwists';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AuthorStyleManager from '@/components/notebook/AuthorStyleManager';
import SeriesSection from '@/components/notebook/SeriesSection';
import { SCENE_EXECUTION_FEATURE_INFO } from '@/lib/generationContext'; // WAVE6-DEADGATE
import {
  getAnthologyThemeTypes,
  ANTHOLOGY_STORY_LENGTHS,
  ANTHOLOGY_VARIETY_OPTIONS,
  isNonfictionGenre,
} from '@/lib/anthologyEngine';
import { FICTION_PROSE_MODELS, DEFAULT_FICTION_PROSE_MODEL, normalizeModelId } from '@/lib/modelRouting';

function Field({ label, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}


function OptionDescription({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{children}</p>;
}

function SelectOptionText({ label, description }) {
  return (
    <div className="flex flex-col py-0.5 text-left">
      <span className="text-sm leading-5">{label}</span>
      {description ? (
        <span className="max-w-[24rem] whitespace-normal text-[10px] leading-4 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </div>
  );
}

function LaneButton({ lane, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-[1.15rem] border px-3 py-3 text-left transition-all ' +
        (active
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm'
          : 'border-border/60 bg-background/50 hover:border-primary/40 hover:bg-accent/20')
      }
    >
      <div className={'text-sm font-semibold ' + (active ? 'text-primary' : 'text-foreground')}>
        {lane.label}
      </div>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{lane.description}</p>
    </button>
  );
}

function FanfictionWarning() {
  return (
    <div className="rounded-[1.15rem] border border-amber-500/40 bg-amber-50/50 px-4 py-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Fan fiction mode is for noncommercial transformative work unless you own the rights, have permission,
          or the source material is public domain. Publishing tools should treat this project differently from original IP.
        </p>
      </div>
    </div>
  );
}

/**
 * WAVE6-DEADGATE: per-project scene-execution gate toggles.
 * Writes project.scene_execution_flags, which resolveSceneExecutionFlags() reads.
 * Everything defaults to OFF; the acceptance gate is marked as the one to try.
 */
function SceneExecutionGates({ values, onFieldChange }) {
  const flags = (values && typeof values.scene_execution_flags === 'object' && values.scene_execution_flags) || {};
  const enabledCount = SCENE_EXECUTION_FEATURE_INFO.filter((f) => flags[f.key] === true).length;
  const toggle = (key, on) => onFieldChange('scene_execution_flags', { ...flags, [key]: on });

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Scene execution gates</Label>
        <span className="text-[10px] text-muted-foreground">
          {enabledCount ? `${enabledCount} of ${SCENE_EXECUTION_FEATURE_INFO.length} on` : 'all off (default)'}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Extra per-scene validation during drafting. These ship disabled because they have
        not been proven on a full book — switching them on mid-manuscript can change or
        reject scenes. Start with the acceptance gate on a test project.
      </p>
      <div className="mt-2 space-y-1.5">
        {SCENE_EXECUTION_FEATURE_INFO.map((f) => (
          <label key={f.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-accent/30">
            <input
              type="checkbox"
              checked={flags[f.key] === true}
              onChange={(e) => toggle(f.key, e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium">
                {f.label}
                {f.recommended && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">start here</span>}
              </span>
              <span className="block text-[10px] leading-snug text-muted-foreground">{f.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SetupControlCard({ title, summary, icon: Icon, children }) {
  return (
    <Collapsible className="rounded-[1.35rem] border border-border/70 bg-white/45 shadow-sm">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background/45">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">{summary}</div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-4 border-t border-border/50 px-4 py-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getSafeLabel(value, fallback = 'Unset') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export default function SetupTab({
  side,
  values,
  onFieldChange,
  onBookTypeChange,
  onGenreChange,
  onLengthPresetChange,
  onApplyPovPreset,
  onSave,
  isSaving,
  busyLabel,
  lastSaved,
  project,
  onRefresh,
}) {
  const contentLane = getContentLane(values);
  const bookTypeForPipeline = values.book_type || getBookTypeForLane(contentLane);
  const projectFormat = values.project_format || (values.project_type === 'anthology' ? 'anthology' : 'novel');

  const genreFamilyOptions = getGenreFamilyOptionsForLane(contentLane);
  const rawGenreFamily = values.genre_group || getGenreFamilyForGenre(contentLane, values.genre) || genreFamilyOptions[0]?.value || '';
  const activeGenreFamily = genreFamilyOptions.some((family) => family.value === rawGenreFamily)
    ? rawGenreFamily
    : getGenreFamilyForGenre(contentLane, values.genre) || genreFamilyOptions[0]?.value || '';
  const genreOptions = getGenreOptionsForFamily(contentLane, activeGenreFamily);
  const subgenreOptions = getSubgenreOptionsForSelection(contentLane, values.genre, activeGenreFamily);
  const povOptions = getPovOptions(bookTypeForPipeline);
  const povPresets = getPovPresets(bookTypeForPipeline);
  const totalWords = Number(values.chapter_target || 0) * Number(values.chapter_length_target || 0);

  const fanfictionMode = isFanfictionLane(contentLane);
  const eroticaMode = isEroticaLane(contentLane) || isEroticaGenre(values.genre);
  const nonfictionMode = bookTypeForPipeline === 'nonfiction';

  const selectedPovPreset = povPresets.find((p) => p.pov === values.pov_mode && p.tense === values.tense);

  const narrationSummary = `${selectedPovPreset?.label || getSafeLabel(values.pov_mode, 'POV unset')} · ${getSafeLabel(
    values.tense,
    'tense unset'
  )} · ${getSafeLabel(values.protagonist_pronouns, 'pronouns unset')}`;

  const structureSummary =
    bookTypeForPipeline === 'fiction'
      ? `${getSafeLabel(values.beat_style, 'Beat style unset')} · ${getSafeLabel(values.story_arc || 'three_act')} · ${Number(
          values.num_twists ?? 3
        )} twists`
      : `${getSafeLabel(values.nf_structure_mode, 'Structure unset')} · ${getSafeLabel(values.story_arc || 'three_act')}`;

  const voiceSummary = `${getSafeLabel(values.author_voice, 'Voice unset')} · ${getSafeLabel(values.author_name, 'Author unset')}`;

  const lengthSummary = `${Number(values.chapter_target || 0)} chapters · ${Number(
    values.chapter_length_target || 0
  ).toLocaleString()} words/chapter · ~${totalWords.toLocaleString()} total`;

  const contentSummary =
    bookTypeForPipeline === 'fiction'
      ? `${getSafeLabel(values.reading_level || 'adult')} · Lang ${values.language_intensity ?? 2} · Spice ${values.spice_level ?? 0} · Violence ${values.violence_level ?? 0}`
      : `Lang ${values.language_intensity ?? 2} · Violence ${values.violence_level ?? 0} · ${getSafeLabel(values.target_audience, 'audience unset')}`;

  const modelSummary =
    bookTypeForPipeline === 'fiction'
      ? `${getSafeLabel(normalizeModelId(values.default_prose_model) || DEFAULT_FICTION_PROSE_MODEL)} · Series controls`
      : 'Series controls';

  const handleLaneChange = (lane) => {
    const nextBookType = getBookTypeForLane(lane);
    const nextRightsMode = getDefaultRightsModeForLane(lane);
    const availableFormats = getProjectFormatsForLane(lane).map((item) => item.value);
    const currentFormat = values.project_format || (values.project_type === 'anthology' ? 'anthology' : 'novel');
    const nextFormat = availableFormats.includes(currentFormat)
      ? currentFormat
      : lane === 'nonfiction'
        ? 'standalone_book'
        : 'novel';
    const nextProjectType = getProjectTypeForFormat(nextBookType, nextFormat);

    // Do not reset the entire Setup draft when switching between fiction-family lanes
    // like Fiction -> Fan Fiction -> Adult/Erotic Fanfic. Fan fiction is still
    // book_type='fiction', so calling onBookTypeChange('fiction') here can wipe
    // the very lane/rights fields we are trying to save.
    if ((values.book_type || '') !== nextBookType) {
      onBookTypeChange(nextBookType);
    }
    onFieldChange('content_lane', lane);
    onFieldChange('book_type', nextBookType);
    onFieldChange('project_format', nextFormat);
    onFieldChange('project_type', nextProjectType);
    onFieldChange('rights_mode', nextRightsMode);
    onFieldChange('commercial_use_allowed', nextRightsMode === 'fanfiction_noncommercial' ? false : true);

    if (lane === 'fiction') {
      onFieldChange('genre_group', 'Commercial Fiction');
      onFieldChange('genre', 'Thriller');
      onFieldChange('subgenre', 'Suspense');
    }

    if (lane === 'erotica') {
      onFieldChange('genre_group', 'Erotica / Erotic Romance');
      onFieldChange('genre', 'Erotica');
      onFieldChange('subgenre', 'Contemporary Erotica');
      onFieldChange('spice_level', Math.max(Number(values.spice_level || 0), 2));
      onFieldChange('reading_level', 'adult');
    }

    if (lane === 'fanfiction') {
      onFieldChange('genre_group', 'Fanfic Mode');
      onFieldChange('genre', 'Canon Divergent');
      onFieldChange('subgenre', 'What-If');
      onFieldChange('canon_mode', values.canon_mode || 'canon_divergent');
      onFieldChange('reading_level', 'adult');
    }

    if (lane === 'nonfiction') {
      onFieldChange('genre_group', 'Investigative / Argument');
      onFieldChange('genre', 'Investigative');
      onFieldChange('subgenre', 'Institutional Abuse');
      onFieldChange('nf_structure_mode', values.nf_structure_mode || 'investigative');
    }
  };

  const handleFormatChange = (format) => {
    const nextProjectType = getProjectTypeForFormat(bookTypeForPipeline, format);
    onFieldChange('project_format', format);
    onFieldChange('project_type', nextProjectType);
  };

  const handleRightsModeChange = (mode) => {
    onFieldChange('rights_mode', mode);
    onFieldChange('commercial_use_allowed', mode === 'fanfiction_noncommercial' ? false : true);

    if (mode === 'fanfiction_noncommercial') {
      onFieldChange('content_lane', 'fanfiction');
      onFieldChange('book_type', 'fiction');
      onFieldChange('commercial_use_allowed', false);
    }
  };

  const applyEroticaDefaultsIfNeeded = (genre, family = activeGenreFamily) => {
    const eroticGenreSelected = isEroticaGenre(genre) || /adult|erotic|explicit|smut|lemon|omegaverse|kink|bdsm|poly|reverse harem/i.test(
      `${genre || ''} ${family || ''}`
    );

    if (contentLane === 'erotica') {
      onFieldChange('spice_level', Math.max(Number(values.spice_level || 0), 2));
      onFieldChange('reading_level', 'adult');
      onFieldChange('erotica_register', Math.max(Number(values.erotica_register ?? 0), 1));
    }

    if (contentLane === 'fanfiction' && eroticGenreSelected) {
      // Fanfic + adult/erotic genre must remain FANFICTION, not get inferred back
      // to the plain Erotica lane or plain Fiction during autosave/build refresh.
      onFieldChange('content_lane', 'fanfiction');
      onFieldChange('rights_mode', values.rights_mode || 'fanfiction_noncommercial');
      onFieldChange('commercial_use_allowed', values.rights_mode === 'licensed_authorized' ? true : false);
      onFieldChange('book_type', 'fiction');
      onFieldChange('reading_level', 'adult');
      onFieldChange('spice_level', Math.max(Number(values.spice_level || 0), 3));
      onFieldChange('language_intensity', Math.max(Number(values.language_intensity ?? 2), 2));
      onFieldChange('erotica_register', Math.max(Number(values.erotica_register ?? 0), 1));
    }
  };

  const handleGenreFamilySelect = (family) => {
    const nextGenres = getGenreOptionsForFamily(contentLane, family);
    const nextGenre = nextGenres.includes(values.genre) ? values.genre : nextGenres[0] || '';
    const nextSubgenres = getSubgenreOptionsForSelection(contentLane, nextGenre, family);

    onFieldChange('genre_group', family);
    if (nextGenre && nextGenre !== values.genre) {
      onGenreChange(nextGenre);
    }
    onFieldChange('subgenre', nextSubgenres.includes(values.subgenre) ? values.subgenre : '');
    applyEroticaDefaultsIfNeeded(nextGenre, family);
  };

  const handleGenreSelect = (genre) => {
    const resolvedFamily = getGenreFamilyForGenre(contentLane, genre) || activeGenreFamily;
    const nextSubgenres = getSubgenreOptionsForSelection(contentLane, genre, resolvedFamily);

    onFieldChange('genre_group', resolvedFamily);
    onGenreChange(genre);
    onFieldChange('subgenre', nextSubgenres.includes(values.subgenre) ? values.subgenre : '');
    applyEroticaDefaultsIfNeeded(genre, resolvedFamily);
  };

  if (side === 'left') {
    return (
      <div className="space-y-6">
        <div>
          <p className="notebook-kicker">Tab 2</p>
          <h2 className="font-display text-4xl text-[var(--notebook-ink)]">Setup</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--notebook-muted)]">
            Build the project spec from the top down: lane, format, rights mode, genre, then subgenre. The app still saves normal genre fields for the existing writing pipeline.
          </p>
        </div>

        <div className="space-y-5 rounded-[1.75rem] border border-border/70 bg-white/45 p-5">
          <div className="space-y-2">
            <Label>Content lane</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTENT_LANES.map((lane) => (
                <LaneButton
                  key={lane.value}
                  lane={lane}
                  active={contentLane === lane.value}
                  onClick={() => handleLaneChange(lane.value)}
                />
              ))}
            </div>
          </div>

          {fanfictionMode && <FanfictionWarning />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project format">
              <Select value={projectFormat || undefined} onValueChange={handleFormatChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a format" />
                </SelectTrigger>
                <SelectContent>
                  {getProjectFormatsForLane(contentLane).map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Rights mode">
              <Select value={values.rights_mode || getDefaultRightsModeForLane(contentLane)} onValueChange={handleRightsModeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose rights mode" />
                </SelectTrigger>
                <SelectContent>
                  {RIGHTS_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] leading-4 text-muted-foreground">
                {
                  RIGHTS_MODES.find(
                    (m) => m.value === (values.rights_mode || getDefaultRightsModeForLane(contentLane))
                  )?.description
                }
              </p>
            </Field>
          </div>

          <Field label="Working title">
            <Input
              value={values.title || ''}
              onChange={(e) => onFieldChange('title', e.target.value)}
              placeholder="Untitled Project"
            />
          </Field>

          <Field label="Subtitle / tagline">
            <Input
              value={values.tagline || ''}
              onChange={(e) => onFieldChange('tagline', e.target.value)}
              placeholder="Optional subtitle"
            />
          </Field>

          <Field label="Premise / seed concept">
            <textarea
              value={values.seed_concept || ''}
              onChange={(e) => onFieldChange('seed_concept', e.target.value)}
              className="min-h-36 w-full rounded-[1.25rem] border border-input bg-background/80 px-4 py-3 text-sm outline-none"
              placeholder="What is this book about?"
            />
          </Field>

          {fanfictionMode && (
            <div className="space-y-4 rounded-[1.25rem] border border-violet-300/50 bg-violet-50/30 p-4 dark:bg-violet-950/10">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300">
                Fan Fiction / Shared Universe Settings
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fandom / source property">
                  <Input
                    value={values.fandom_name || ''}
                    onChange={(e) => onFieldChange('fandom_name', e.target.value)}
                    placeholder="e.g., Star Trek, Star Wars, Marvel, Harry Potter"
                  />
                </Field>

                <Field label="Source universe / era">
                  <Input
                    value={values.source_universe || ''}
                    onChange={(e) => onFieldChange('source_universe', e.target.value)}
                    placeholder="e.g., TNG era, Clone Wars era, post-finale AU"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Canon mode">
                  <Select value={values.canon_mode || 'canon_divergent'} onValueChange={(v) => onFieldChange('canon_mode', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CANON_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Posting target">
                  <Select
                    value={values.fanfic_posting_target || 'private'}
                    onValueChange={(v) => onFieldChange('fanfic_posting_target', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private / Personal</SelectItem>
                      <SelectItem value="ao3">AO3</SelectItem>
                      <SelectItem value="wattpad">Wattpad</SelectItem>
                      <SelectItem value="fanfiction_net">FanFiction.net</SelectItem>
                      <SelectItem value="other">Other Fan Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Canon characters / relationships / ships">
                <Input
                  value={values.canon_characters || ''}
                  onChange={(e) => onFieldChange('canon_characters', e.target.value)}
                  placeholder="Optional: names, ships, ensemble, canon characters, OCs"
                />
              </Field>

              <Field label="Spoiler / canon boundary">
                <Input
                  value={values.canon_boundary || ''}
                  onChange={(e) => onFieldChange('canon_boundary', e.target.value)}
                  placeholder="Optional: only through season 3, ignores sequel trilogy, post-book 5, etc."
                />
              </Field>
            </div>
          )}

          <div className="space-y-4 rounded-[1.25rem] border border-border/70 bg-background/45 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Genre Builder
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Choose a broad family first, then narrow it into the exact genre and subgenre. The saved pipeline fields still remain genre + subgenre, so drafting, erotica, fanfic, anthology, and model routing stay wired.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Field label={fanfictionMode ? 'Fanfic category' : contentLane === 'nonfiction' ? 'Nonfiction family' : 'Genre family'}>
                <Select value={activeGenreFamily || undefined} onValueChange={handleGenreFamilySelect}>
                  <SelectTrigger className="min-w-0">
                    <span className="block truncate">
                      {genreFamilyOptions.find((family) => family.value === activeGenreFamily)?.label || 'Choose family'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(92vw,34rem)]">
                    {genreFamilyOptions.map((family) => (
                      <SelectItem key={family.value} value={family.value} textValue={family.label}>
                        <SelectOptionText
                          label={family.label}
                          description={getGenreFamilyDescription(family.value)}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <OptionDescription>{getGenreFamilyDescription(activeGenreFamily)}</OptionDescription>
              </Field>

              <Field label={fanfictionMode ? 'Mode / source / genre' : contentLane === 'nonfiction' ? 'Category' : 'Primary genre'}>
                <Select value={values.genre || undefined} onValueChange={handleGenreSelect}>
                  <SelectTrigger className="min-w-0">
                    <span className="block truncate">{values.genre || 'Choose genre'}</span>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(92vw,34rem)]">
                    {genreOptions.map((genre) => (
                      <SelectItem key={genre} value={genre} textValue={genre}>
                        <SelectOptionText
                          label={genre}
                          description={getGenreDescription(genre)}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <OptionDescription>{getGenreDescription(values.genre)}</OptionDescription>
              </Field>

              <Field label={fanfictionMode ? 'Trope / sub-mode' : contentLane === 'nonfiction' ? 'Angle / format' : 'Subgenre / lane'}>
                {subgenreOptions.length > 0 ? (
                  <Select
                    value={values.subgenre || '_none'}
                    onValueChange={(v) => onFieldChange('subgenre', v === '_none' ? '' : v)}
                  >
                    <SelectTrigger className="min-w-0">
                      <span className="block truncate">{values.subgenre || 'Optional detail'}</span>
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(92vw,34rem)]">
                      <SelectItem value="_none" textValue="None">— None —</SelectItem>
                      {subgenreOptions.map((subgenre) => (
                        <SelectItem key={subgenre} value={subgenre} textValue={subgenre}>
                          <SelectOptionText
                            label={subgenre}
                            description={getSubgenreDescription(subgenre)}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={values.subgenre || ''}
                    onChange={(e) => onFieldChange('subgenre', e.target.value)}
                    placeholder="Optional detail"
                  />
                )}
                <OptionDescription>{values.subgenre ? getSubgenreDescription(values.subgenre) : 'Optional: adds a more specific angle without changing the main pipeline genre.'}</OptionDescription>
              </Field>
            </div>

            {values.genre ? (
              <div className="rounded-[1rem] border border-dashed border-border/70 bg-white/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                Active routing: <span className="font-semibold text-foreground">{activeGenreFamily}</span>
                {' → '}
                <span className="font-semibold text-foreground">{values.genre}</span>
                {values.subgenre ? (
                  <>
                    {' → '}
                    <span className="font-semibold text-foreground">{values.subgenre}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <Field label="Target audience">
            <Input
              value={values.target_audience || ''}
              onChange={(e) => onFieldChange('target_audience', e.target.value)}
              placeholder="Who is this book for?"
            />
          </Field>

          {values.project_type === 'anthology' && (
            <div className="space-y-4 rounded-[1.25rem] border border-amber-300/50 bg-amber-50/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                Anthology Settings
              </p>

              <Field label="Collection theme">
                <Input
                  value={values.anthology_theme || ''}
                  onChange={(e) => onFieldChange('anthology_theme', e.target.value)}
                  placeholder={
                    nonfictionMode
                      ? 'e.g., Essays about hostile architecture in American cities'
                      : fanfictionMode
                        ? 'e.g., Missing episodes across the fleet'
                        : 'e.g., Stories of people who vanished without a trace'
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The unifying thread across all pieces. Can be a topic, mood, question, setting, trope, or constraint.
                </p>
              </Field>

              <Field label="Theme type">
                <Select
                  value={values.anthology_theme_type || 'topic'}
                  onValueChange={(v) => onFieldChange('anthology_theme_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAnthologyThemeTypes(values.genre).map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={isNonfictionGenre(values.genre) || nonfictionMode ? 'Chapter / essay length' : 'Story length'}>
                <Select
                  value={values.anthology_story_length || 'short'}
                  onValueChange={(v) => onFieldChange('anthology_story_length', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANTHOLOGY_STORY_LENGTHS).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {isNonfictionGenre(values.genre) || nonfictionMode ? info.nfLabel || info.label : info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Variety">
                <Select
                  value={values.anthology_variety || 'high'}
                  onValueChange={(v) => onFieldChange('anthology_variety', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANTHOLOGY_VARIETY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <p>
                This setup still feeds the old pipeline fields — book type, project type, genre, and subgenre —
                while adding richer lane and rights data for fan fiction, nonfiction formats, erotica, and anthologies.
              </p>
            </div>
          </div>

          <SaveIndicator
            onSave={onSave}
            isSaving={isSaving}
            lastSaved={lastSaved}
            label="Save Setup"
            className="w-full [&_button]:w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="notebook-kicker">Suggested controls</p>
        <h3 className="font-display text-3xl text-[var(--notebook-ink)]">Voice, structure & targets</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--notebook-muted)]">
          Scan the summaries, then open only the sections you need. All underlying settings still feed the drafting pipeline.
        </p>
      </div>

      <div className="space-y-3">
        <SetupControlCard
          title="Narration & POV"
          summary={narrationSummary}
          icon={Eye}
        >
          <Field label="Narration preset">
            <Select
              value={selectedPovPreset?.id || undefined}
              onValueChange={(id) => {
                const preset = povPresets.find((item) => item.id === id);
                if (preset) onApplyPovPreset(preset);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a POV preset" />
              </SelectTrigger>
              <SelectContent>
                {povPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <span className="font-medium">{preset.label}</span>
                    <span className="ml-2 text-muted-foreground">— {preset.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Viewpoint">
              <Select
                value={values.pov_mode || undefined}
                onValueChange={(v) => {
                  onFieldChange('pov_mode', v);
                  if (v && v.includes('she')) onFieldChange('protagonist_pronouns', 'she/her');
                  else if (v && v.includes('he') && !v.includes('the')) onFieldChange('protagonist_pronouns', 'he/him');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose POV" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(povOptions).map(([key, desc]) => (
                    <SelectItem key={key} value={key}>
                      {desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Pronouns">
              <Select
                value={values.protagonist_pronouns || undefined}
                onValueChange={(v) => onFieldChange('protagonist_pronouns', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose pronouns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="she/her">she/her</SelectItem>
                  <SelectItem value="he/him">he/him</SelectItem>
                  <SelectItem value="they/them">they/them</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Tense">
            <Select value={values.tense || undefined} onValueChange={(v) => onFieldChange('tense', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tense" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TENSE_OPTIONS)
                  .filter(([key]) => (bookTypeForPipeline === 'fiction' ? key !== 'mixed' : true))
                  .map(([key, desc]) => (
                    <SelectItem key={key} value={key}>
                      {desc}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </SetupControlCard>

        <SetupControlCard
          title="Structure & Pacing"
          summary={structureSummary}
          icon={GitBranch}
        >
          {bookTypeForPipeline === 'fiction' ? (
            <Field label="Beat style">
              <Select value={values.beat_style || undefined} onValueChange={(v) => onFieldChange('beat_style', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose beat style" />
                </SelectTrigger>
                <SelectContent>
                  {BEAT_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.name}>
                      <span className="font-medium">{style.name}</span>
                      <span className="ml-2 text-muted-foreground">— {style.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Structure mode">
              <Select
                value={values.nf_structure_mode || undefined}
                onValueChange={(v) => onFieldChange('nf_structure_mode', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose structure" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NF_STRUCTURE_MODES).map(([key, mode]) => (
                    <SelectItem key={key} value={key}>
                      <span className="font-medium">
                        {mode.icon} {mode.label}
                      </span>
                      <span className="ml-2 text-muted-foreground">— {mode.pattern}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Arc">
            <Select value={values.story_arc || 'three_act'} onValueChange={(v) => onFieldChange('story_arc', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose story arc" />
              </SelectTrigger>
              <SelectContent>
                {STORY_ARC_OPTIONS.map((arc) => (
                  <SelectItem key={arc.value} value={arc.value}>
                    {arc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-5 text-muted-foreground mt-1">
              {getArcDescription(values.story_arc || 'three_act')}
            </p>
          </Field>

          {bookTypeForPipeline === 'fiction' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plot twists">
                <Select
                  value={String(values.num_twists ?? 3)}
                  onValueChange={(v) => onFieldChange('num_twists', Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose twist count" />
                  </SelectTrigger>
                  <SelectContent>
                    {TWIST_COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                  {getTwistCountDescription(values.num_twists ?? 3)}
                </p>
              </Field>

              {(values.num_twists ?? 3) > 0 && (
                <Field label="Twist intensity">
                  <Select
                    value={values.twist_intensity || 'moderate'}
                    onValueChange={(v) => onFieldChange('twist_intensity', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      {TWIST_INTENSITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                    {getTwistIntensityDescription(values.twist_intensity || 'moderate')}
                  </p>
                </Field>
              )}
            </div>
          )}
        </SetupControlCard>

        <SetupControlCard
          title="Author Voice"
          summary={voiceSummary}
          icon={PenLine}
        >
          <Field label="Author voice">
            <Select value={values.author_voice || undefined} onValueChange={(v) => onFieldChange('author_voice', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose author voice" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUTHOR_VOICES_BY_GENRE).map(([category, voices]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </SelectLabel>
                    {voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.name}>
                        <span className="font-medium">{voice.name}</span>
                        <span className="ml-2 text-muted-foreground">— {voice.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {values.author_voice === 'Custom / None' && (
            <Field label="Custom voice notes">
              <Input
                value={values.author_voice_notes || ''}
                onChange={(e) => onFieldChange('author_voice_notes', e.target.value)}
                placeholder="Describe your desired voice style"
              />
            </Field>
          )}

          <Field label="Author name">
            <Input
              value={values.author_name || ''}
              onChange={(e) => onFieldChange('author_name', e.target.value)}
              placeholder="Enter pen name"
            />
          </Field>

          <AuthorStyleManager
            authorStyleId={values.author_style_id || ''}
            onStyleChange={(id) => onFieldChange('author_style_id', id)}
          />
        </SetupControlCard>

        <SetupControlCard
          title="Length Targets"
          summary={lengthSummary}
          icon={Ruler}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chapter count">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.chapter_target ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  onFieldChange('chapter_target', value === '' ? '' : Number(value));
                }}
                onBlur={(e) => {
                  if (!e.target.value) onFieldChange('chapter_target', 1);
                }}
              />
            </Field>

            <Field label="Length preset">
              <Select value={values.chapter_length_preset || undefined} onValueChange={onLengthPresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose length" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHAPTER_LENGTH_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label} — {preset.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Words per chapter">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.chapter_length_target ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  onFieldChange('chapter_length_target', value === '' ? '' : Number(value));
                }}
                onBlur={(e) => {
                  if (!e.target.value) onFieldChange('chapter_length_target', 3500);
                }}
              />
            </Field>

            <div className="flex items-end">
              <div className="w-full rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-2.5 text-sm text-foreground">
                ~{totalWords.toLocaleString()} words total
              </div>
            </div>
          </div>
        </SetupControlCard>

        <SetupControlCard
          title="Audience & Content Controls"
          summary={contentSummary}
          icon={SlidersHorizontal}
        >
          {bookTypeForPipeline === 'fiction' && (
            <div className="space-y-3">
              <Label className="text-xs">Reading Level</Label>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                {[
                  { id: 'early_reader', emoji: '🐣', label: 'Early Reader', desc: 'Ages 5–8' },
                  { id: 'middle_grade', emoji: '🎒', label: 'Middle Grade', desc: 'Ages 8–12' },
                  { id: 'young_adult', emoji: '🔥', label: 'Young Adult', desc: 'Ages 13–17' },
                  { id: 'new_adult', emoji: '🌙', label: 'New Adult', desc: 'Ages 18–25' },
                  { id: 'adult', emoji: '📖', label: 'Adult', desc: 'General' },
                  { id: 'academic', emoji: '🎓', label: 'Academic', desc: 'Literary' },
                ].map((readingLevel) => {
                  const selected = (values.reading_level || 'adult') === readingLevel.id;

                  return (
                    <button
                      key={readingLevel.id}
                      type="button"
                      onClick={() => onFieldChange('reading_level', readingLevel.id)}
                      className={
                        'rounded-xl border px-3 py-2.5 text-left transition-all ' +
                        (selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/60 bg-background/50 hover:border-primary/40 hover:bg-accent/20')
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{readingLevel.emoji}</span>
                        <div>
                          <div className={'text-xs font-semibold ' + (selected ? 'text-primary' : 'text-foreground')}>
                            {readingLevel.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{readingLevel.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {['early_reader', 'middle_grade', 'young_adult'].includes(values.reading_level) &&
                (Number(values.language_intensity ?? 2) > (values.reading_level === 'young_adult' ? 2 : 0) ||
                  Number(values.spice_level ?? 0) > (values.reading_level === 'young_adult' ? 1 : 0) ||
                  Number(values.violence_level ?? 0) > (values.reading_level === 'young_adult' ? 2 : 1)) && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                    ⚠️ Language Intensity, Spice Level, and Violence Level will be automatically capped during generation to match the selected reading level.
                  </div>
                )}
            </div>
          )}

          {bookTypeForPipeline === 'fiction' && isFanfictionLane(values) && (
            <p className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
              Fan fiction still follows the project’s reading level and content settings. Adult / erotic fanfic uses the same erotica controls below and must stay restricted to adult characters.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {bookTypeForPipeline === 'fiction' && (
              <Field label="Spice level">
                <Select
                  value={String(values.spice_level ?? 0)}
                  onValueChange={(v) => onFieldChange('spice_level', Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPICE_LEVELS).map(([key, opt]) => (
                      <SelectItem key={key} value={key}>
                        {opt.label} — {opt.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Language intensity">
              <Select
                value={String(values.language_intensity ?? 2)}
                onValueChange={(v) => onFieldChange('language_intensity', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_INTENSITY).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>
                      {opt.label} — {opt.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Violence level">
            <Select
              value={String(values.violence_level ?? 0)}
              onValueChange={(v) => onFieldChange('violence_level', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIOLENCE_LEVELS).map(([key, opt]) => (
                  <SelectItem key={key} value={key}>
                    {opt.label} — {opt.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {bookTypeForPipeline === 'fiction' && shouldShowEroticaRegister(values) && (
            <Field label="Erotica prose register">
              <Select
                value={String(values.erotica_register ?? 0)}
                onValueChange={(v) => onFieldChange('erotica_register', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EROTICA_REGISTERS).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>
                      {opt.name} — {opt.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </SetupControlCard>

        <SetupControlCard
          title="Model & Series"
          summary={modelSummary}
          icon={Cpu}
        >
          {bookTypeForPipeline === 'fiction' && (
            <Field label="Writing model">
              <Select
                value={normalizeModelId(values.default_prose_model) || DEFAULT_FICTION_PROSE_MODEL}
                onValueChange={(v) => onFieldChange('default_prose_model', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FICTION_PROSE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="font-medium">{model.label}</span>
                      <span className="ml-2 text-muted-foreground">— {model.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Used for Draft All and any chapter without a per-chapter override.
              </p>
            </Field>
          )}

          {/* WAVE6-DEADGATE: the scene-execution validators log "set
              scene_execution_flags on the project record" on every draft, but
              until now there was no way to do that from the app. Off by
              default and clearly labelled — enabling unproven validators
              mid-book is a real hazard, so this is a deliberate opt-in. */}
          <SceneExecutionGates values={values} onFieldChange={onFieldChange} />

          <SeriesSection
            values={values}
            onFieldChange={onFieldChange}
            project={project}
            busyLabel={busyLabel}
            onRefresh={onRefresh}
          />
        </SetupControlCard>

        <SaveIndicator
          onSave={onSave}
          isSaving={isSaving}
          lastSaved={lastSaved}
          label="Save Settings"
          className="w-full [&_button]:w-full"
        />
      </div>
    </div>
  );
}