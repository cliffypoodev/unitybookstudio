import React, { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { prepareResearchContent } from '@/lib/researchStorage';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import mammoth from 'mammoth';

function parseResponse(raw) {
  let text = typeof raw === 'string' ? raw : (raw?.text || raw?.content || raw?.data || String(raw || ''));
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(text);
}

// ── Chunked manuscript extraction ──

async function extractBibleChunked(words, setProgress, rewriteType) {
  const totalWords = words.length;
  const CHUNK_SIZE = 8000;
  const OVERLAP = 500;
  const chunks = [];

  for (let i = 0; i < totalWords; i += CHUNK_SIZE - OVERLAP) {
    chunks.push({
      index: chunks.length + 1,
      text: words.slice(i, i + CHUNK_SIZE).join(' '),
    });
  }

  setProgress('Scanning manuscript: ' + chunks.length + ' sections to analyze…');

  // Pass 1: Extract from each chunk in parallel batches of 4
  const BATCH_SIZE = 4;
  const chunkExtractions = [];

  for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
    const batch = chunks.slice(b, b + BATCH_SIZE);
    const batchNum = Math.floor(b / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
    setProgress('Scanning: Batch ' + batchNum + ' of ' + totalBatches + '…');

    const batchResults = await Promise.all(batch.map(chunk => {
      const extractPrompt = `Read this section of a manuscript and extract every story element you find. This is section ${chunk.index} of ${chunks.length}.

TEXT:
${chunk.text}

Respond ONLY in JSON. No markdown, no backticks.

{
  "characters": [
    {
      "name": "Full name as it appears",
      "aliases": ["nicknames or shortened names used"],
      "role": "protagonist/antagonist/supporting/minor",
      "description": "Physical and personality details mentioned",
      "relationships": "Connections to other characters mentioned"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "description": "Physical details mentioned",
      "significance": "Why this location matters to the plot"
    }
  ],
  "plot_events": [
    "Brief description of each significant event in this section, in order"
  ],
  "world_details": [
    "Any rules, systems, technologies, cultural details, historical context, or world-building elements"
  ],
  "voice_observations": {
    "pov": "first/third-close/third-omniscient/second/mixed",
    "tense": "past/present/mixed",
    "tone": "Brief tone description",
    "notable_style": "Any distinctive prose patterns, sentence rhythms, or stylistic choices"
  },
  "themes": ["Thematic elements present in this section"],
  "conflicts": ["Active conflicts or tensions in this section"]
}

Extract ONLY what is explicitly present in the text. Do not infer or invent.`;

      return invokeLLMWithRetry({
        prompt: extractPrompt,
        model: pickModel('foundation', { project_type: rewriteType }),
        temperature: 0,
      }).then(r => {
        try { return parseResponse(r); }
        catch { console.warn('[REWRITE] Parse failed for chunk ' + chunk.index); return null; }
      }).catch(e => {
        console.warn('[REWRITE] Extraction failed for chunk ' + chunk.index + ':', e.message);
        return null;
      });
    }));

    for (const r of batchResults) { if (r) chunkExtractions.push(r); }
  }

  if (chunkExtractions.length === 0) {
    throw new Error('No data could be extracted from the manuscript.');
  }

  // Pass 2: Merge and deduplicate
  setProgress('Synthesizing story bible from ' + chunkExtractions.length + ' sections…');

  const allCharacters = [];
  const allLocations = [];
  const allEvents = [];
  const allWorldDetails = [];
  const allThemes = [];
  const allConflicts = [];
  const voiceObs = [];

  for (const ext of chunkExtractions) {
    if (ext.characters) allCharacters.push(...ext.characters);
    if (ext.locations) allLocations.push(...ext.locations);
    if (ext.plot_events) allEvents.push(...ext.plot_events);
    if (ext.world_details) allWorldDetails.push(...ext.world_details);
    if (ext.themes) allThemes.push(...ext.themes);
    if (ext.conflicts) allConflicts.push(...ext.conflicts);
    if (ext.voice_observations) voiceObs.push(ext.voice_observations);
  }

  // Deduplicate characters by name
  const uniqueChars = {};
  for (const c of allCharacters) {
    const key = (c.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!uniqueChars[key]) {
      uniqueChars[key] = { ...c };
    } else {
      const existing = uniqueChars[key];
      if (c.description && !(existing.description || '').includes(c.description)) {
        existing.description = (existing.description || '') + ' ' + c.description;
      }
      if (c.relationships && !(existing.relationships || '').includes(c.relationships)) {
        existing.relationships = (existing.relationships || '') + '; ' + c.relationships;
      }
      if (c.role === 'protagonist' || c.role === 'antagonist') existing.role = c.role;
    }
  }

  // Deduplicate locations by name
  const uniqueLocs = {};
  for (const l of allLocations) {
    const key = (l.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!uniqueLocs[key]) {
      uniqueLocs[key] = { ...l };
    } else {
      if (l.description) uniqueLocs[key].description = (uniqueLocs[key].description || '') + ' ' + l.description;
    }
  }

  const uniqueThemes = [...new Set(allThemes.map(t => (t || '').toLowerCase().trim()).filter(Boolean))];
  const uniqueWorld = [...new Set(allWorldDetails.map(w => (w || '').toLowerCase().trim()).filter(Boolean))];

  // Majority POV and tense
  const povCounts = {};
  const tenseCounts = {};
  for (const v of voiceObs) {
    if (v.pov) povCounts[v.pov] = (povCounts[v.pov] || 0) + 1;
    if (v.tense) tenseCounts[v.tense] = (tenseCounts[v.tense] || 0) + 1;
  }
  const majorityPov = Object.entries(povCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'third-close';
  const majorityTense = Object.entries(tenseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'past';

  const synthesisPrompt = `You are building a complete story bible from extracted manuscript data. Synthesize these raw extractions into a polished, organized story bible.

EXTRACTED CHARACTERS (${Object.keys(uniqueChars).length} unique):
${JSON.stringify(Object.values(uniqueChars), null, 1).substring(0, 8000)}

EXTRACTED LOCATIONS (${Object.keys(uniqueLocs).length} unique):
${JSON.stringify(Object.values(uniqueLocs), null, 1).substring(0, 3000)}

PLOT EVENTS (${allEvents.length} events, in order):
${allEvents.slice(0, 60).map((e, i) => (i + 1) + '. ' + e).join('\n').substring(0, 5000)}

WORLD DETAILS:
${uniqueWorld.slice(0, 30).join('\n').substring(0, 3000)}

THEMES: ${uniqueThemes.join(', ')}

CONFLICTS: ${[...new Set(allConflicts)].join('; ').substring(0, 2000)}

VOICE: POV=${majorityPov}, Tense=${majorityTense}
Voice notes: ${voiceObs.slice(0, 3).map(v => v.notable_style || v.tone || '').filter(Boolean).join('; ')}

Generate a complete story bible. Respond ONLY in JSON:

{
  "world_md": "Markdown world-building document: setting, rules, key locations, time period, atmosphere. 500-1000 words.",
  "characters_md": "Markdown character profiles: for each major character include name, role, age/description, wound, want, relationships, arc. 800-1500 words.",
  "outline_md": "Markdown chapter outline: organize the plot events into a chapter-by-chapter outline with titles and beat summaries.",
  "canon_md": "Markdown canon rules: established facts, timeline, rules that cannot be broken. 300-500 words.",
  "voice_md": "Markdown voice guide: POV, tense, tone, sentence rhythm, what to do and avoid. 300-500 words.",
  "mystery_md": "Markdown mystery/secrets: any hidden information, reveals, or unresolved questions. 200-400 words.",
  "genre": "Best genre classification",
  "pov": "${majorityPov}",
  "tense": "${majorityTense}"
}`;

  const synthesisResult = await invokeLLMWithRetry({
    prompt: synthesisPrompt,
    model: pickModel('foundation', { project_type: rewriteType }),
    fallback_model: pickFallbackModel('foundation'),
    temperature: 0,
  });

  return parseResponse(synthesisResult);
}

export default function RewriteFromManuscript({ onCreated, onCancel }) {
  const [rewriteType, setRewriteType] = useState('fiction');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      setProgress('Reading manuscript…');
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        const ab = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: ab });
        text = result.value;
      }

      if (!text || text.length < 1000) {
        alert('Could not read manuscript or file is too short.');
        setProgress(null);
        return;
      }

      const wordCount = text.split(/\s+/).length;
      setProgress(`Analyzing manuscript (${Math.round(wordCount / 1000)}K words)…`);

      // Step 1: Extract structure
      setProgress('Extracting title, premise, and structure…');
      const structPrompt = `Analyze this manuscript and extract the following. Return ONLY valid JSON.\n\nMANUSCRIPT (first 30000 chars):\n${text.substring(0, 30000)}\n\n${text.length > 30000 ? '[MANUSCRIPT CONTINUES — infer from structure]\n' : ''}Extract:\n{"title":"string","premise":"2-3 sentence premise","genre":"specific genre","pov":"first person / third-close / etc","tense":"past or present","protagonist_name":"string","protagonist_pronouns":"she/her or he/him or they/them","num_chapters":"number","estimated_words":${wordCount},"tone":"brief style description","chapter_titles":["array"]}`;

      let structure;
      try {
        const sr = await invokeLLMWithRetry({ prompt: structPrompt, model: 'gemini_3_flash' });
        structure = parseResponse(sr);
      } catch {
        structure = {
          title: file.name.replace(/\.(docx|txt)$/i, '').replace(/[-_]/g, ' '),
          premise: '', genre: rewriteType === 'nonfiction' ? 'Nonfiction' : 'Fiction',
          pov: 'Third Person Limited', tense: 'Past',
          protagonist_name: '', protagonist_pronouns: 'she/her',
          num_chapters: 20, chapter_titles: [],
        };
      }

      // Step 2: Extract story bible via chunked approach
      setProgress('Extracting characters, world, and plot…');
      const words = text.split(/\s+/);
      const bible = await extractBibleChunked(words, setProgress, rewriteType);

      // Step 4: Create project
      setProgress('Creating project…');

      const str = (v) => typeof v === 'string' ? v : JSON.stringify(v || '');

      const mapPov = (pov) => {
        if (!pov) return 'third-close';
        const lower = pov.toLowerCase();
        if (lower.includes('first')) return 'first';
        if (lower.includes('omni')) return 'third-omni';
        if (lower.includes('multi')) return 'third-multi';
        if (lower.includes('second')) return 'second';
        return 'third-close';
      };

      const mapTense = (t) => {
        if (!t) return 'past';
        return t.toLowerCase().includes('present') ? 'present' : 'past';
      };

      const chapterCount = parseInt(structure.num_chapters, 10) || 20;

      // Handle research_md via upload pattern if present
      let researchFields = {};
      if (bible.research_md) {
        researchFields = await prepareResearchContent(str(bible.research_md));
      }

      const projectData = {
        title: structure.title || 'Untitled Rewrite',
        tagline: 'Rewritten from uploaded manuscript',
        seed_concept: structure.premise || 'Rewrite of uploaded manuscript',
        author_name: '',
        book_type: rewriteType === 'nonfiction' ? 'nonfiction' : 'fiction',
        project_type: rewriteType,
        genre: bible.genre || structure.genre || '',
        pov_mode: mapPov(bible.pov || structure.pov),
        tense: mapTense(bible.tense || structure.tense),
        protagonist_pronouns: structure.protagonist_pronouns || 'she/her',
        beat_style: 'Tension-Driven',
        scene_beat_style: 'Tension-Driven',
        spice_level: rewriteType === 'erotica' ? 3 : 0,
        violence_level: 0,
        language_intensity: rewriteType === 'erotica' ? 2 : 0,
        erotica_register: rewriteType === 'erotica' ? 1 : 0,
        chapter_target: chapterCount,
        chapter_length_preset: 'standard',
        chapter_length_target: 3500,
        target_chapter_words: 3500,
        total_word_target: chapterCount * 3500,
        phase: 'foundation',
        status: 'ready',
        characters_md: str(bible.characters_md),
        world_md: str(bible.world_md),
        outline_md: str(bible.outline_md),
        canon_md: str(bible.canon_md),
        voice_md: str(bible.voice_md),
        mystery_md: str(bible.mystery_md),
        ...researchFields,
      };

      const newProject = await base44.entities.NovelProject.create(projectData);

      // Step 5: Create chapters
      setProgress('Creating chapter outline…');
      const titles = structure.chapter_titles || [];
      const chapterRecords = [];
      for (let i = 1; i <= chapterCount; i++) {
        chapterRecords.push({ project_id: newProject.id, chapter_number: i, title: titles[i - 1] || 'Chapter ' + i, status: 'planned' });
      }
      await base44.entities.Chapter.bulkCreate(chapterRecords);

      setProgress(null);
      onCreated(newProject);
    } catch (err) {
      console.error('[REWRITE] Failed:', err);
      alert('Rewrite analysis failed: ' + (err.message || 'Unknown error'));
      setProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">🔄 Rewrite from Manuscript</span>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
      </div>

      {/* Project type */}
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Project Type</label>
      <div className="flex gap-2 mb-3">
        {['fiction', 'nonfiction', 'erotica'].map(t => (
          <button key={t} onClick={() => setRewriteType(t)}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${rewriteType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* File upload */}
      {!file ? (
        <div
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && (f.name.endsWith('.docx') || f.name.endsWith('.txt'))) setFile(f); else alert('Please upload a .docx or .txt file'); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border-2 border-dashed border-border/80 bg-card/50 p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
        >
          <p className="text-sm text-muted-foreground">📄 Drop your manuscript here or click to browse</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">.docx or .txt</p>
          <input ref={fileRef} type="file" accept=".docx,.txt" className="hidden" onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/50 px-3 py-2 mb-2">
          <span className="text-sm text-green-700 dark:text-green-400">📄 {file.name}</span>
          <button onClick={() => setFile(null)} className="text-destructive text-xs hover:underline">Remove</button>
        </div>
      )}

      {/* Analyze button */}
      {file && !progress && (
        <button onClick={handleAnalyze} className="mt-3 w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
          🔄 Analyze &amp; Create Rewrite Project
        </button>
      )}

      {/* Progress */}
      {progress && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{progress}</span>
        </div>
      )}
    </div>
  );
}