import React, { useState } from 'react';
import { Loader2, FileText, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';

const QUERY_ITEMS = [
  { id: 'query_letter', label: 'Query Letter', desc: '300-word hook letter for literary agents' },
  { id: 'synopsis', label: 'Synopsis', desc: '1-3 page full plot synopsis including ending' },
  { id: 'blurb', label: 'Back Cover Blurb', desc: '150-200 word marketing copy' },
  { id: 'author_bio', label: 'Author Bio', desc: '100-word professional bio' },
  { id: 'comp_titles', label: 'Comp Titles', desc: '5 comparable titles with reasoning' },
  { id: 'kdp_metadata', label: 'KDP Categories & Keywords', desc: '7 keywords + 3 BISAC categories' },
  { id: 'series_bible', label: 'Series Bible', desc: 'Overview document for future volumes' },
];

function buildContext(project, chapters) {
  const parts = [];
  parts.push(`Title: ${project.title || 'Untitled'}`);
  parts.push(`Genre: ${project.genre || 'Fiction'}`);
  if (project.subgenre) parts.push(`Subgenre: ${project.subgenre}`);
  if (project.target_audience) parts.push(`Target Audience: ${project.target_audience}`);
  if (project.author_name) parts.push(`Author: ${project.author_name}`);
  if (project.tagline) parts.push(`Tagline: ${project.tagline}`);
  if (project.seed_concept) parts.push(`Premise: ${project.seed_concept}`);
  if (project.outline_md) parts.push(`Outline:\n${project.outline_md.substring(0, 3000)}`);
  if (project.characters_md) parts.push(`Characters:\n${project.characters_md.substring(0, 2000)}`);
  const wordCount = chapters.filter(c => chapterHasContent(c) && isBodyChapter(c)).reduce((s, c) => s + (c.word_count || 0), 0);
  parts.push(`Word Count: ~${wordCount.toLocaleString()}`);
  return parts.join('\n');
}

export default function QuerySubPage({ project, chapters }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const context = project ? buildContext(project, chapters || []) : '';

  const generate = async (id) => {
    if (!project) return;
    setLoading((p) => ({ ...p, [id]: true }));
    const prompts = {
      query_letter: `You are a literary agent's ideal query letter writer. Write a 300-word query letter for this book following standard industry format: 1) Hook (1-2 sentences), 2) Story synopsis (150 words), 3) Author bio (50 words), 4) Comp titles and market positioning. Be professional, compelling, and specific.\n\n${context}`,
      synopsis: `Write a 1-3 page synopsis for this book that reveals the COMPLETE plot including the ending. This is for submission to literary agents — it must show the full arc, major turning points, climax, and resolution. Write in present tense, third person. Be specific about character motivations.\n\n${context}`,
      blurb: `Write a 150-200 word back cover blurb / Amazon description for this book. Open with a hook, introduce the protagonist's conflict, raise the stakes, and end with a cliffhanger question. Do NOT reveal the ending. Write punchy, marketing-ready copy.\n\n${context}`,
      author_bio: `Write a professional 100-word author bio in third person suitable for the back of a book or Amazon author page. The author's name is "${project.author_name || '[Author Name]'}". Genre: ${project.genre || 'Fiction'}. Make it warm but professional. Include placeholder brackets for credentials the author should fill in.\n\n${context}`,
      comp_titles: `List exactly 5 comparable titles ("comp titles") for this book. For each, provide: 1) Title and Author, 2) Publication year, 3) Why it's a comp (2-3 sentences explaining shared audience, themes, tone, or market positioning). Choose comps published in the last 5 years when possible. Mix well-known and mid-list titles.\n\n${context}`,
      kdp_metadata: `Generate Amazon KDP metadata for this book:\n\n1) 7 search keywords (each can be up to 50 characters, use keyword phrases readers actually search for)\n2) 3 BISAC category codes with full paths (e.g., FICTION / Thrillers / Suspense)\n\nOptimize for discoverability. Think about what readers searching for similar books would type.\n\n${context}`,
      series_bible: `Create a series bible document for this book as Book 1 of a potential series. Include:\n1) Series concept and arc\n2) Recurring characters and their trajectories\n3) Unresolved threads for future volumes\n4) World-building elements to maintain\n5) Tone and voice consistency notes\n6) Potential Book 2-3 premises\n\n${context}`,
    };
    try {
      const result = await invokeLLMWithRetry({ prompt: prompts[id], model: pickModel('publishing'), fallback_model: pickFallbackModel('publishing'), task_type: 'publishing' });
      const text = typeof result === 'string' ? result : result?.text || result?.data || '';
      setResults((p) => ({ ...p, [id]: text }));
    } finally {
      setLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleEdit = (id, value) => setResults((p) => ({ ...p, [id]: value }));

  const exportAll = () => {
    const sections = QUERY_ITEMS.filter((item) => results[item.id]).map((item) => `# ${item.label}\n\n${results[item.id]}`);
    if (!sections.length) return;
    const content = `# Publishing Package — ${project?.title || 'Untitled'}\n\nGenerated ${new Date().toLocaleDateString()}\n\n---\n\n${sections.join('\n\n---\n\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (project?.title || 'publishing-package').replace(/[^a-zA-Z0-9]/g, '-') + '.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8 mb-3 text-muted-foreground/40" />
        <p>Open a project first to generate publishing materials.</p>
      </div>
    );
  }

  const generatedCount = Object.keys(results).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="notebook-kicker">Publishing Prep</p>
        <h2 className="font-display text-2xl text-foreground">Publishing Package</h2>
        <p className="text-xs text-muted-foreground mt-1">Generate everything needed to submit to agents or publish on KDP.</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">{project.title || 'Untitled'} · {project.genre || 'Fiction'}</p>
          {generatedCount > 0 && (
            <Button variant="outline" size="sm" onClick={exportAll} className="rounded-full gap-1.5 text-[10px] h-7">
              <Download className="h-3 w-3" /> Export All (.md)
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {QUERY_ITEMS.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/50 bg-background/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">{item.desc}</span>
                </div>
                <Button
                  size="sm"
                  variant={results[item.id] ? 'ghost' : 'secondary'}
                  onClick={() => generate(item.id)}
                  disabled={loading[item.id]}
                  className="rounded-full gap-1 text-[10px] h-7 px-3"
                >
                  {loading[item.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {results[item.id] ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
              {results[item.id] && (
                <textarea
                  value={results[item.id]}
                  onChange={(e) => handleEdit(item.id, e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-lg border border-border/40 bg-white/50 dark:bg-muted/30 p-3 text-sm leading-7 text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}