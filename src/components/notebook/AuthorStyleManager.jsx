import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { AUTHOR_VOICES_BY_GENRE } from '@/lib/autonovel';

const EMPTY_FORM = {
  name: '', pen_name: '', genre_affinity: '',
  tone: '', sentence_rhythm: '', vocabulary_level: '', paragraph_style: '',
  dialogue_style: '', dialogue_tags: '',
  description_approach: '', sensory_focus: '', metaphor_style: '',
  emotional_handling: '', internal_monologue: '', humor_style: '',
  pacing_preference: '', chapter_endings: '',
  always_do: '', never_do: '', sample_paragraph: '',
};

// Flatten built-in voices for the dropdown
const BUILTIN_VOICES = Object.values(AUTHOR_VOICES_BY_GENRE).flat().filter(v => v.id !== 'custom');

function FormField({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FormTextarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm outline-none resize-y min-h-[52px]"
    />
  );
}

export default function AuthorStyleManager({ authorStyleId, onStyleChange, projectId }) {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingStyle, setEditingStyle] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const loadStyles = async () => {
    try {
      const all = await base44.entities.AuthorStyle.list('-created_date', 100);
      setStyles(all);
    } catch (err) {
      console.error('[STYLES] Load failed:', err.message);
      setStyles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStyles(); }, []);

  const handleSelect = async (value) => {
    onStyleChange(value === '_none' ? '' : value);
  };

  const handleNewStyle = () => {
    setForm({ ...EMPTY_FORM });
    setEditingStyle(null);
    setShowEditor(true);
  };

  const handleEditStyle = () => {
    const style = styles.find(s => s.id === authorStyleId);
    if (!style) return;
    const filled = { ...EMPTY_FORM };
    Object.keys(EMPTY_FORM).forEach(k => { if (style[k]) filled[k] = style[k]; });
    setForm(filled);
    setEditingStyle(style);
    setShowEditor(true);
  };

  const handleDeleteStyle = async () => {
    if (!authorStyleId || !window.confirm('Delete this author style? This cannot be undone.')) return;
    await base44.entities.AuthorStyle.delete(authorStyleId);
    onStyleChange('');
    await loadStyles();
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (editingStyle) {
        await base44.entities.AuthorStyle.update(editingStyle.id, form);
      } else {
        const created = await base44.entities.AuthorStyle.create(form);
        // Auto-select the new style
        onStyleChange(created.id);
      }
      await loadStyles();
      setShowEditor(false);
      setEditingStyle(null);
    } catch (err) {
      console.error('[STYLES] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isCustomSelected = authorStyleId && !authorStyleId.startsWith('__') && styles.some(s => s.id === authorStyleId);
  const selectedStyle = isCustomSelected ? styles.find(s => s.id === authorStyleId) : null;

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Custom Author Style</p>
        <Button type="button" size="sm" variant="outline" onClick={handleNewStyle} className="h-7 rounded-full text-[11px] px-3">
          <Plus className="mr-1 h-3 w-3" /> New Style
        </Button>
      </div>

      <Select value={authorStyleId || '_none'} onValueChange={handleSelect}>
        <SelectTrigger><SelectValue placeholder="No custom style" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">— No custom style (use built-in voice) —</SelectItem>
          {styles.map(s => (
            <SelectItem key={s.id} value={s.id}>
              ✏️ {s.name}{s.genre_affinity ? ` (${s.genre_affinity})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustomSelected && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleEditStyle} className="h-7 rounded-full text-[11px] px-3">
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleDeleteStyle} className="h-7 rounded-full text-[11px] px-3 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {selectedStyle && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {selectedStyle.tone ? `Tone: ${selectedStyle.tone}` : 'No tone set.'}
        </p>
      )}

      {/* Editor Modal */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingStyle ? 'Edit Author Style' : 'Create Author Style'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Identity */}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Profile Name *">
                <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g., My Thriller Voice" />
              </FormField>
              <FormField label="Pen Name (optional)">
                <Input value={form.pen_name} onChange={e => updateField('pen_name', e.target.value)} placeholder="e.g., Carrie L. DuBois" />
              </FormField>
            </div>
            <FormField label="Genre Affinity">
              <Input value={form.genre_affinity} onChange={e => updateField('genre_affinity', e.target.value)} placeholder="e.g., Dark fantasy, noir, thriller" />
            </FormField>

            {/* Voice & Tone */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Voice & Tone</p>
              <div className="space-y-3">
                <FormField label="Overall Tone">
                  <FormTextarea value={form.tone} onChange={e => updateField('tone', e.target.value)} placeholder="e.g., Sardonic, precise, emotionally restrained" />
                </FormField>
                <FormField label="Sentence Rhythm">
                  <FormTextarea value={form.sentence_rhythm} onChange={e => updateField('sentence_rhythm', e.target.value)} placeholder="e.g., Short declarative sentences alternating with long sensory constructions" />
                </FormField>
                <FormField label="Vocabulary Level">
                  <FormTextarea value={form.vocabulary_level} onChange={e => updateField('vocabulary_level', e.target.value)} placeholder="e.g., Educated but not academic" />
                </FormField>
                <FormField label="Paragraph Style">
                  <FormTextarea value={form.paragraph_style} onChange={e => updateField('paragraph_style', e.target.value)} placeholder="e.g., Short, 2-4 sentences. One-sentence paragraphs for impact." />
                </FormField>
              </div>
            </div>

            {/* Dialogue */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Dialogue</p>
              <div className="space-y-3">
                <FormField label="Dialogue Style">
                  <FormTextarea value={form.dialogue_style} onChange={e => updateField('dialogue_style', e.target.value)} placeholder="e.g., Terse, subtext-heavy. Characters say less than they mean." />
                </FormField>
                <FormField label="Dialogue Tags">
                  <FormTextarea value={form.dialogue_tags} onChange={e => updateField('dialogue_tags', e.target.value)} placeholder="e.g., Minimal — action beats over said/asked" />
                </FormField>
              </div>
            </div>

            {/* Description & Sensory */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Description & Sensory</p>
              <div className="space-y-3">
                <FormField label="Description Approach">
                  <FormTextarea value={form.description_approach} onChange={e => updateField('description_approach', e.target.value)} placeholder="e.g., Grounded in physical sensation. No purple prose." />
                </FormField>
                <FormField label="Sensory Focus">
                  <FormTextarea value={form.sensory_focus} onChange={e => updateField('sensory_focus', e.target.value)} placeholder="e.g., Sound and smell over visual" />
                </FormField>
                <FormField label="Metaphor Style">
                  <FormTextarea value={form.metaphor_style} onChange={e => updateField('metaphor_style', e.target.value)} placeholder="e.g., Sparse, mechanical. Engineering metaphors." />
                </FormField>
              </div>
            </div>

            {/* Emotional Register */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Emotional Register</p>
              <div className="space-y-3">
                <FormField label="Emotional Handling">
                  <FormTextarea value={form.emotional_handling} onChange={e => updateField('emotional_handling', e.target.value)} placeholder="e.g., Show through body language, never name the emotion" />
                </FormField>
                <FormField label="Internal Monologue">
                  <FormTextarea value={form.internal_monologue} onChange={e => updateField('internal_monologue', e.target.value)} placeholder="e.g., Brief, sharp, self-critical fragments" />
                </FormField>
                <FormField label="Humor Style">
                  <FormTextarea value={form.humor_style} onChange={e => updateField('humor_style', e.target.value)} placeholder="e.g., Dry gallows humor. Jokes when scared." />
                </FormField>
              </div>
            </div>

            {/* Pacing */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Pacing & Structure</p>
              <div className="space-y-3">
                <FormField label="Pacing Preference">
                  <FormTextarea value={form.pacing_preference} onChange={e => updateField('pacing_preference', e.target.value)} placeholder="e.g., Fast. Relentless. No reflection scenes longer than one paragraph." />
                </FormField>
                <FormField label="Chapter Endings">
                  <FormTextarea value={form.chapter_endings} onChange={e => updateField('chapter_endings', e.target.value)} placeholder="e.g., Always end on propulsion — a question, a revelation, or a door opening." />
                </FormField>
              </div>
            </div>

            {/* Rules */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Rules</p>
              <div className="space-y-3">
                <FormField label="Always Do">
                  <FormTextarea value={form.always_do} onChange={e => updateField('always_do', e.target.value)} placeholder="e.g., Use concrete nouns. Ground every scene in a physical space." rows={3} />
                </FormField>
                <FormField label="Never Do">
                  <FormTextarea value={form.never_do} onChange={e => updateField('never_do', e.target.value)} placeholder="e.g., Never use 'suddenly.' Never open with weather." rows={3} />
                </FormField>
              </div>
            </div>

            {/* Sample */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Reference Sample (Optional)</p>
              <FormField label="Sample Paragraph">
                <FormTextarea value={form.sample_paragraph} onChange={e => updateField('sample_paragraph', e.target.value)} placeholder="Paste a 100-200 word paragraph that exemplifies this voice. The AI will use it as a tone reference." rows={4} />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditor(false); setEditingStyle(null); }} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name?.trim()} className="rounded-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : editingStyle ? 'Save Changes' : 'Create Style'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}