import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { resolveAllFoundationFields } from '@/lib/foundationStorage';
import { resolveSeedConcept } from '@/lib/seedConceptStorage';

function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function StoryBibleReport({ project, chapters, disabled }) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!project) return;
    setBusy(true);

    const title = project.title || 'Untitled';
    const author = project.author_name || 'Unknown';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const s = {
      title: project.title || '—',
      tagline: project.tagline || '—',
      author: project.author_name || '—',
      genre: project.genre || '—',
      projectType: project.project_type || project.book_type || '—',
      pov: project.pov_mode || '—',
      tense: project.tense || '—',
      chapters: project.chapter_target || '—',
      chapterWords: project.chapter_length_target || project.target_chapter_words || '—',
      totalWords: project.total_word_target || '—',
      pronouns: project.protagonist_pronouns || '—',
      beatStyle: project.beat_style || '—',
      authorVoice: project.author_voice || '—',
      authorStyleId: project.author_style_id || 'None',
      spice: project.spice_level ?? '—',
      violence: project.violence_level ?? '—',
      language: project.language_intensity ?? '—',
      erotica: project.erotica_register ?? '—',
      series: project.series_name || '—',
      seriesNum: project.series_number || '—',
      premise: project.seed_concept || '—',
    };

    // WAVE4-OFFLOADREAD: foundation docs over 9KB live at *_url with the inline
    // field blanked — reading the raw fields printed "❌ NOT GENERATED" for
    // fully-built story bibles. Resolve through the offload layer.
    let resolvedBible = {};
    try { resolvedBible = await resolveAllFoundationFields(project); } catch { resolvedBible = {}; }
    try { s.premise = (await resolveSeedConcept(project)) || s.premise; } catch { /* keep inline */ }

    const bible = {
      world: resolvedBible.world_md || project.world_md || 'Not generated',
      characters: resolvedBible.characters_md || project.characters_md || 'Not generated',
      outline: resolvedBible.outline_md || project.outline_md || 'Not generated',
      canon: resolvedBible.canon_md || project.canon_md || 'Not generated',
      voice: resolvedBible.voice_md || project.voice_md || 'Not generated',
      mystery: resolvedBible.mystery_md || project.mystery_md || 'Not generated',
      research: project.research_data || '',
    };

    // Chapter list
    const body = (chapters || [])
      .filter(ch => isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    const chapterList = body.map(ch => {
      const num = ch.chapter_number || '?';
      const t = ch.title || 'Untitled';
      const st = ch.status || 'unknown';
      const has = (ch.content_md && ch.content_md.length > 100) || !!ch.content_md_url;
      const beat = ch.beat_summary || '';
      return `Ch. ${num}: ${t} [${st}${has ? ', has content' : ''}]${beat ? '\n     Beat: ' + beat.substring(0, 200) : ''}`;
    }).join('\n') || 'No chapters found';

    // Author style
    let styleDetails = '';
    if (s.authorStyleId && s.authorStyleId !== 'None' && !s.authorStyleId.startsWith('__')) {
      try {
        const styles = await base44.entities.AuthorStyle.filter({ id: s.authorStyleId });
        const style = styles[0];
        if (style) {
          const fields = [
            style.tone && 'Tone: ' + style.tone,
            style.sentence_rhythm && 'Rhythm: ' + style.sentence_rhythm,
            style.vocabulary_level && 'Vocabulary: ' + style.vocabulary_level,
            style.paragraph_style && 'Paragraphs: ' + style.paragraph_style,
            style.dialogue_style && 'Dialogue: ' + style.dialogue_style,
            style.dialogue_tags && 'Tags: ' + style.dialogue_tags,
            style.description_approach && 'Description: ' + style.description_approach,
            style.sensory_focus && 'Sensory: ' + style.sensory_focus,
            style.metaphor_style && 'Metaphors: ' + style.metaphor_style,
            style.emotional_handling && 'Emotion: ' + style.emotional_handling,
            style.internal_monologue && 'Internal Monologue: ' + style.internal_monologue,
            style.humor_style && 'Humor: ' + style.humor_style,
            style.pacing_preference && 'Pacing: ' + style.pacing_preference,
            style.chapter_endings && 'Endings: ' + style.chapter_endings,
            style.always_do && 'Always Do: ' + style.always_do,
            style.never_do && 'Never Do: ' + style.never_do,
            style.sample_paragraph && 'Voice Sample:\n' + style.sample_paragraph,
          ].filter(Boolean).join('\n');
          styleDetails = 'Custom Style: ' + style.name + '\n' + fields;
        }
      } catch { styleDetails = 'Could not load author style'; }
    }

    const ok = (v, label) => v && v !== '—' && v !== 'Not generated'
      ? `<span class="ok">✅ ${esc(label || v)}</span>`
      : `<span class="warn">❌ NOT SET</span>`;

    const okLen = (v) => v && v !== 'Not generated'
      ? `<span class="ok">✅ ${v.length.toLocaleString()} chars</span>`
      : `<span class="warn">❌ NOT GENERATED</span>`;

    const row = (label, val) => `<span class="label">${label}:</span><span class="value${val === '—' ? ' missing' : ''}">${esc(String(val))}</span>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{margin:0.75in;size:letter}
body{font-family:'Courier New',monospace;font-size:11px;color:#333;line-height:1.5}
.header{text-align:center;border-bottom:2px solid #8B4513;padding-bottom:16px;margin-bottom:20px}
.header h1{font-size:16px;color:#8B4513;margin:0 0 4px;text-transform:uppercase;letter-spacing:3px}
.header h2{font-size:20px;margin:0 0 4px;color:#1a1a1a;font-family:Georgia,serif}
.header p{font-size:10px;color:#888;margin:2px 0}
h3{font-size:13px;color:#8B4513;border-bottom:1px solid #ddd;padding-bottom:3px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:1px}
.grid{display:grid;grid-template-columns:160px 1fr;gap:2px 12px;margin-bottom:8px}
.label{font-weight:bold;color:#555}.value{color:#111}.value.missing{color:#c0392b;font-style:italic}
.section{margin-bottom:16px;padding:10px 12px;background:#faf8f5;border:1px solid #eee;border-radius:4px;white-space:pre-wrap;font-size:10.5px;line-height:1.6}
.section-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}
.warn{color:#c0392b;font-weight:bold}.ok{color:#4CAF50}
</style></head><body>
<div class="header">
<h1>Story Bible Report</h1>
<h2>${esc(title)}</h2>
<p>by ${esc(author)} · ${today}</p>
<p>All project settings and story bible data for pipeline verification.</p>
</div>

<h3>Setup Configuration</h3>
<div class="grid">
${row('Title', s.title)}
${row('Tagline', s.tagline)}
${row('Author', s.author)}
${row('Genre', s.genre)}
${row('Project Type', s.projectType)}
${row('POV', s.pov)}
${row('Tense', s.tense)}
${row('Chapters', s.chapters)}
${row('Words / Chapter', s.chapterWords)}
${row('Total Target', s.totalWords)}
${row('Pronouns', s.pronouns)}
${row('Beat Style', s.beatStyle)}
${row('Author Voice', s.authorVoice)}
${row('Author Style', s.authorStyleId)}
${row('Spice Level', s.spice)}
${row('Violence Level', s.violence)}
${row('Language Intensity', s.language)}
${row('Erotica Register', s.erotica)}
${row('Series', s.series + ' #' + s.seriesNum)}
</div>

<h3>Premise / Seed Concept</h3>
<div class="section">${esc(s.premise)}</div>

${styleDetails ? `<h3>Author Style Profile</h3><div class="section">${esc(styleDetails)}</div>` : ''}

<h3>World Building</h3>
<div class="section-label">world_md (${bible.world.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.world)}</div>

<h3>Characters</h3>
<div class="section-label">characters_md (${bible.characters.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.characters)}</div>

<h3>Canon</h3>
<div class="section-label">canon_md (${bible.canon.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.canon)}</div>

<h3>Voice Guide</h3>
<div class="section-label">voice_md (${bible.voice.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.voice)}</div>

<h3>Mystery / Plot Threads</h3>
<div class="section-label">mystery_md (${bible.mystery.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.mystery)}</div>

${bible.research ? `<h3>Research Data (Nonfiction)</h3>
<div class="section-label">research_data (${bible.research.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.research.substring(0, 3000))}${bible.research.length > 3000 ? '\n\n[... truncated at 3000 chars ...]' : ''}</div>` : ''}

<h3>Chapter Outline</h3>
<div class="section-label">outline_md (${bible.outline.length.toLocaleString()} chars)</div>
<div class="section">${esc(bible.outline)}</div>

<h3>Chapter Records (${body.length} chapters)</h3>
<div class="section" style="font-size:10px">${esc(chapterList)}</div>

<h3>Verification Checklist</h3>
<div class="grid">
<span class="label">Genre:</span>${ok(s.genre, s.genre)}
<span class="label">POV:</span>${ok(s.pov, s.pov)}
<span class="label">Tense:</span>${ok(s.tense, s.tense)}
<span class="label">Chapters:</span>${ok(s.chapters, s.chapters)}
<span class="label">Pronouns:</span>${ok(s.pronouns, s.pronouns)}
<span class="label">World:</span>${okLen(bible.world)}
<span class="label">Characters:</span>${okLen(bible.characters)}
<span class="label">Outline:</span>${okLen(bible.outline)}
<span class="label">Canon:</span>${okLen(bible.canon)}
<span class="label">Voice:</span>${okLen(bible.voice)}
</div>

<div class="footer">Story Bible Report · Unity Book Studio · ${today}</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => { printWindow.print(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = (title.replace(/[^a-zA-Z0-9]/g, '-') || 'project') + '-story-bible-report.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setBusy(false);
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || busy}
      variant="outline"
      className="rounded-full gap-2"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {busy ? 'Generating…' : 'Story Bible Report'}
    </Button>
  );
}