/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live dialog is dashboard/NewProjectModal.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import ProjectSettingsFields from '@/components/novel/ProjectSettingsFields';
import { Textarea } from '@/components/ui/textarea';
import { CHAPTER_LENGTH_PRESETS, applyGenreDefaults, computeTotalWordTarget, createInitialProjectSettings } from '@/lib/autonovel';
import { suggestPovTense } from '@/lib/povTense';

export default function CreateProjectDialog({ open, onOpenChange, onCreate, isLoading }) {
  const isMobile = useIsMobile();
  const [title, setTitle] = React.useState('');
  const [seedConcept, setSeedConcept] = React.useState('');
  const [settings, setSettings] = React.useState(createInitialProjectSettings());

  const updateSettings = (updater) => {
    setSettings((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return {
        ...next,
        chapter_target: Math.max(1, Number(next.chapter_target || 1)),
        chapter_length_target: Math.max(500, Number(next.chapter_length_target || 3500)),
        total_word_target: computeTotalWordTarget(next.chapter_target, next.chapter_length_target),
        target_chapter_words: Math.max(500, Number(next.chapter_length_target || 3500)),
        scene_beat_style: next.beat_style || '',
      };
    });
  };

  const handleFieldChange = (field, value) => {
    updateSettings({ [field]: value });
  };

  const handleBookTypeChange = (bookType) => {
    setSettings(createInitialProjectSettings(bookType));
  };

  const handleGenreChange = (genre) => {
    updateSettings((current) => {
      const suggestion = suggestPovTense(current.book_type, genre);
      const next = applyGenreDefaults({
        ...current,
        genre,
        subgenre: '',
      }, genre);

      return {
        ...next,
        pov_mode: suggestion.pov,
        tense: suggestion.tense,
      };
    });
  };

  const handleLengthPresetChange = (preset) => {
    updateSettings({
      chapter_length_preset: preset,
      chapter_length_target: CHAPTER_LENGTH_PRESETS[preset]?.words || 3500,
    });
  };

  const handleApplyPovPreset = (preset) => {
    updateSettings({ pov_mode: preset.pov, tense: preset.tense });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onCreate({ title, seed_concept: seedConcept, ...settings });
    setTitle('');
    setSeedConcept('');
    setSettings(createInitialProjectSettings(settings.book_type));
  };

  const formContent = (
    <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="project-title">Working Title</Label>
        <Input id="project-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="The House at the Salt Road" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="seed-concept">Premise or Seed Concept</Label>
        <Textarea
          id="seed-concept"
          value={seedConcept}
          onChange={(event) => setSeedConcept(event.target.value)}
          placeholder="A city where legal contracts are sung, and a boy discovers he can hear hidden clauses no one else can."
          className="min-h-24 sm:min-h-40"
          required
        />
      </div>
      <ProjectSettingsFields
        values={settings}
        onFieldChange={handleFieldChange}
        onBookTypeChange={handleBookTypeChange}
        onGenreChange={handleGenreChange}
        onLengthPresetChange={handleLengthPresetChange}
        onApplyPovPreset={handleApplyPovPreset}
      />
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isLoading || !seedConcept.trim()} className="min-h-11 w-full sm:w-auto rounded-full px-6">
          {isLoading ? 'Creating…' : 'Create Project'}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] overflow-x-hidden">
          <DrawerHeader className="text-left">
            <DrawerTitle>New Book Project</DrawerTitle>
            <DrawerDescription>
              Set your premise, then review writing settings.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto overflow-x-hidden px-4 pb-4">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create a New Book Project</DialogTitle>
          <DialogDescription>
            Set the core premise first, then review the auto-suggested writing settings before you launch the AutoNovel workflow.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}