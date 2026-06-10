import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle, AlertCircle } from 'lucide-react';

function parseIdeasFromText(text) {
  const lines = text.split('\n');
  const records = [];
  let bookType = 'nonfiction';
  let category = '';
  let genre = '';
  let series = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header junk
    if (/^(MASTER BOOK ENGINE|STORY IDEAS CATALOG|Stripped Edition|1723 Story|AutoNovel|March 2026|TABLE OF CONTENTS)/i.test(line)) continue;
    if (/^\d+\.\s+(POLITICAL|SOCIAL|BIOGRAPHY|SCIENCE|CRIME|ART|ARCHAEOLOGY|REFERENCE|ACADEMIC|MARITIME|RURAL|ESTATE|INVESTIGATION|SUPERNATURAL)/i.test(line)) continue;

    // Section headers like "NONFICTION — HISTORY --- POLITICAL & MILITARY"
    const sectionMatch = line.match(/^(NONFICTION|FICTION)\s*[—–\-]+\s*(.*?)(?:\s*[—–\-]+\s*(.*))?$/i);
    if (sectionMatch) {
      bookType = sectionMatch[1].toLowerCase();
      const p2 = (sectionMatch[2] || '').replace(/[—–\-]+/g, '').trim();
      const p3 = (sectionMatch[3] || '').trim();
      if (p3) { category = p2; genre = p3; }
      else if (p2) { category = p2; }
      continue;
    }

    if (/^FICTION$/i.test(line)) { bookType = 'fiction'; continue; }
    if (/^NONFICTION$/i.test(line)) { bookType = 'nonfiction'; continue; }
    if (/^\d+\s+ideas?\s+across\s+\d+\s+series/i.test(line)) continue;

    // Series title like "Assassination Attempts You've Never Heard Of  (13)"
    const seriesMatch = line.match(/^([A-Z][\w\s''',&.:!?\-—–()]+?)\s+\((\d+)\)\s*$/);
    if (seriesMatch) {
      series = seriesMatch[1].trim();
      continue;
    }

    // Idea line — #NUMBER format
    const ideaMatch = line.match(/^#(\d+)\s+(.+)$/);
    if (ideaMatch) {
      pushIdea(records, ideaMatch[2].trim(), bookType, genre, category, series);
      continue;
    }

    // Numbered list: "1. idea" or "1) idea" or "1 - idea"
    const numberedMatch = line.match(/^\d+[.)\-]\s+(.+)$/);
    if (numberedMatch) {
      pushIdea(records, numberedMatch[1].trim(), bookType, genre, category, series);
      continue;
    }

    // Bullet points: "- idea" or "• idea" or "* idea"
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      pushIdea(records, bulletMatch[1].trim(), bookType, genre, category, series);
      continue;
    }

    // Plain text line — treat as an idea if it's long enough to be a premise (>30 chars)
    if (line.length >= 30) {
      pushIdea(records, line, bookType, genre, category, series);
    }
  }
  return records;
}

function pushIdea(records, content, bookType, genre, category, series) {
  let title = content;
  const se = content.search(/[.!?]\s/);
  if (se > 10 && se < 140) title = content.substring(0, se + 1);
  else if (content.length > 120) title = content.substring(0, 120) + '…';

  records.push({
    title,
    description: content.length > 250 ? content.substring(0, 250) + '…' : content,
    content,
    book_type: bookType,
    genre: genre || category || '',
    category: category || '',
    subcategory: series || '',
    tags: series ? [series] : [],
    word_count: 0
  });
}

export default function ImportCatalog() {
  const [status, setStatus] = useState('idle'); // idle, uploading, parsing, importing, done, error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    setError(null);

    // Read file as text client-side
    let text = '';
    try {
      text = await file.text();
    } catch {
      setError('Could not read file. Please save as .txt first.');
      setStatus('error');
      return;
    }

    if (!text.trim()) {
      setError('File appears empty. Please save as .txt and try again.');
      setStatus('error');
      return;
    }

    const records = parseIdeasFromText(text);
    if (records.length === 0) {
      setError('No ideas found in the file');
      setStatus('error');
      return;
    }

    setStatus('importing');
    setProgress({ current: 0, total: records.length });

    let created = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        const res = await base44.functions.invoke('importCatalog', { batch, totalBatches: Math.ceil(records.length / batchSize) });
        created += res.data?.created || 0;
        errors += res.data?.errors || 0;
      } catch (err) {
        // Fallback: try one by one
        for (const rec of batch) {
          try {
            await base44.entities.PromptCatalog.create(rec);
            created++;
          } catch { errors++; }
        }
      }
      setProgress({ current: Math.min(i + batchSize, records.length), total: records.length });
    }

    setResults({ created, errors, total: records.length });
    setStatus('done');
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl text-foreground">Import Story Catalog</h1>
          <p className="mt-2 text-sm text-muted-foreground">Save the catalog as .txt first, then upload here</p>
        </div>

        {status === 'idle' && (
          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-card/50 p-12 cursor-pointer hover:bg-card/80 transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <span className="text-sm font-medium text-foreground">Click to upload TXT file</span>
            <span className="text-xs text-muted-foreground mt-1">Save the catalog as .txt first, then upload</span>
            <input type="file" accept=".txt,.text" className="hidden" onChange={handleFile} />
          </label>
        )}

        {(status === 'uploading' || status === 'parsing') && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {status === 'uploading' ? 'Uploading file…' : 'Extracting & parsing ideas…'}
            </p>
          </div>
        )}

        {status === 'importing' && (
          <div className="space-y-4 py-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-foreground">Importing ideas…</p>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">{progress.current} / {progress.total}</p>
          </div>
        )}

        {status === 'done' && results && (
          <div className="rounded-2xl border border-border/70 bg-card/50 p-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="font-display text-xl">Import Complete</h2>
            <p className="text-sm text-muted-foreground">
              {results.created} ideas imported • {results.errors} errors • {results.total} total parsed
            </p>
            <Button onClick={() => { setStatus('idle'); setResults(null); }} variant="outline" className="rounded-full mt-4">
              Import Another
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => { setStatus('idle'); setError(null); }} variant="outline" className="rounded-full mt-4">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}