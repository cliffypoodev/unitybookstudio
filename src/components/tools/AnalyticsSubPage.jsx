import React, { useState } from 'react';
import { Loader2, BarChart3, Microscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell, CartesianGrid } from 'recharts';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';
import { calculateManuscriptStats } from '@/lib/manuscriptStats';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { parseDocxFile } from '@/lib/docxParser';
import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';
import { runForensicAnalysis, MARKER_LABELS } from '@/lib/forensicAnalytics';
import { buildManuscriptEvidenceReport } from '@/lib/manuscriptEvidence';
import { downloadMarkdown, reportFilename, buildAnalyticsMarkdown } from '@/lib/reportExport'; // WAVE7-REPORTEXPORT

function fleschKincaid(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, w) => sum + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length), 0);
  if (!sentences.length || !words.length) return 0;
  return Math.max(0, Math.round((0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59) * 10) / 10);
}

/**
 * Dialogue ratio — the percentage of words in the text that appear INSIDE
 * quote marks (i.e. actual spoken dialogue, not dialogue tags or action beats).
 *
 * Handles straight double quotes, curly/smart double quotes (U+201C / U+201D),
 * and single-quote dialogue (some publishers/UK style) marked by U+2018 / U+2019.
 * Unpaired quotes are tolerated — the function pairs opening marks with the
 * next closing mark of any compatible flavor, then falls back to line-end to
 * avoid runaway matches.
 */
function dialogueRatio(text) {
  if (!text) return 0;
  const totalWords = (text.match(/\b[\w']+\b/g) || []).length;
  if (totalWords === 0) return 0;

  // Normalize all double-quote variants to a single marker, same for singles.
  // This lets us use one regex instead of trying to match six different pairs.
  const normalized = text
    .replace(/[\u201C\u201D]/g, '"')         // curly double -> straight double
    .replace(/[\u2018\u2019]/g, "\u2019");   // curly single -> right-single (apostrophe)
  // Note: we don't use single quotes for dialogue detection because they
  // overlap with apostrophes ("don't", "she's"). Only double-quote pairs count.

  // Match content between double-quote pairs, non-greedy, allowing newlines
  // inside a quoted span (some manuscripts split long dialogue across lines).
  const DIALOGUE_RX = /"([^"]{1,2000})"/g;

  let dialogueWords = 0;
  let m;
  while ((m = DIALOGUE_RX.exec(normalized)) !== null) {
    const inner = m[1] || '';
    dialogueWords += (inner.match(/\b[\w']+\b/g) || []).length;
  }

  return Math.round((dialogueWords / totalWords) * 100);
}

function vocabDiversity(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 2);
  if (!words.length) return 0;
  return Math.round((new Set(words).size / words.length) * 1000) / 10;
}

function aiRiskScore(text) {
  const stats = calculateManuscriptStats(text);
  let risk = Math.min(30, stats.bannedWords * 3) + Math.min(20, stats.voiceWas * 2) + Math.min(15, stats.scaffolds * 10) + Math.min(15, Math.max(0, 100 - stats.cleanScore)) + Math.min(10, stats.repetitionTotal) + Math.min(10, (100 - vocabDiversity(text)) / 5);
  return Math.min(100, Math.round(risk));
}

function characterFrequency(text) {
  const nameRx = /\b([A-Z][a-z]{2,})\b/g;
  const counts = {};
  const skipWords = new Set(['The','This','That','These','Those','There','Their','They','Then','Than','What','When','Where','Which','While','With','From','Into','After','Before','About','Through','During','Between','Under','Around','Against','Along','Chapter','Scene','Part','Section','Book','Page','She','Her','His','Him','And','But','Not','Was','Were','Has','Had','Have','Been','Would','Could','Should','Will','Can','Did','Does','Just','Still','Even','Back','Down','Over','Like','Also','Very','Much','More','Most','Some','Only','Other','Each','Every','Both','Many','Such','Well','Here','Now','How','All','Any','New','Old','First','Last','Next','Good','Long','Great','Little','Right','Same','High','Small','Large','Few','Own']);
  let match;
  while ((match = nameRx.exec(text)) !== null) { if (!skipWords.has(match[1])) counts[match[1]] = (counts[match[1]] || 0) + 1; }
  return Object.entries(counts).filter(([, c]) => c >= 5).sort((a, b) => b[1] - a[1]).slice(0, 15);
}

function analyzeCharacterDepth(text, characterNames) {
  const results = {};
  for (const name of characterNames) {
    const nameRegex = new RegExp('\\b' + name + '\\b', 'gi');
    const mentions = (text.match(nameRegex) || []).length;
    let interiorityCount = 0;
    let dialogueCount = 0;
    let actionCount = 0;
    const lines = text.split('\n');
    for (const line of lines) {
      if (!nameRegex.test(line)) continue;
      nameRegex.lastIndex = 0;
      if (/\b(thought|wondered|remembered|realized|felt|knew|wished|feared|hoped|noticed|recognized|considered|suspected|believed|imagined|recalled|regretted|dreaded|sensed|understood)\b/i.test(line)) interiorityCount++;
      if (/["“”„]/.test(line)) dialogueCount++;
      if (/\b(walked|ran|grabbed|pushed|pulled|turned|reached|threw|caught|ducked|climbed|stepped|moved|stood|sat|leaned|crossed|slammed|opened|closed|touched|dropped|lifted|held|gripped|released|drew|slid|pressed|struck|blocked|dodged)\b/i.test(line)) actionCount++;
    }
    const total = interiorityCount + dialogueCount + actionCount;
    const interiorityRatio = total > 0 ? Math.round(interiorityCount / total * 100) : 0;
    const depthRatio = mentions > 0 ? interiorityCount / mentions : 0;
    results[name] = {
      mentions,
      interiority: interiorityCount,
      dialogue: dialogueCount,
      action: actionCount,
      interiorityRatio,
      depthRating: depthRatio > 0.15 ? 'Good' : depthRatio > 0.08 ? 'Fair' : 'Shallow',
    };
  }
  return results;
}

/**
 * Color for the critic status badge — matches Rotten Tomatoes convention.
 */
function criticStatusColor(status) {
  if (status === 'Certified Fresh') return { bg: '#d4edda', border: '#a5d6a7', text: '#1b5e20', emoji: '🍅' };
  if (status === 'Fresh') return { bg: '#fff8e1', border: '#ffe082', text: '#8a6d3b', emoji: '🍅' };
  return { bg: '#fce4ec', border: '#ef9a9a', text: '#8a2a2a', emoji: '🥬' };
}

/**
 * Tone color for a 0-100 score.
 */
function scoreColor(score) {
  if (score >= 85) return '#4CAF50';
  if (score >= 70) return '#DAA520';
  if (score >= 55) return '#E67E22';
  return '#c0392b';
}

/**
 * Tone color for the AI Index (0-1, inverted — higher is worse).
 */
function aiIndexColor(idx) {
  if (idx >= 0.85) return '#c0392b';
  if (idx >= 0.70) return '#E67E22';
  if (idx >= 0.50) return '#DAA520';
  return '#4CAF50';
}

/**
 * Compact book-level summary row rendered inside each chart card.
 *
 * Layout:
 *   LEFT:  the "primary" metric — a big number with a small label/unit
 *   RIGHT: up to three "extras" — smaller label/value pairs (totals, extremes, etc.)
 *
 * Goal: every chart card leads with a single easy-to-read book-level number
 * that anchors the chapter-level distribution shown below it.
 */
function SummaryRow({ primary, extras = [] }) {
  return (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      {/* Primary metric — the big number */}
      <div className="flex items-baseline gap-1.5 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{primary.label}</span>
        <span className="text-base font-bold" style={primary.color ? { color: primary.color } : undefined}>
          {primary.value}
        </span>
        {primary.unit && <span className="text-[10px] text-muted-foreground ml-0.5">{primary.unit}</span>}
      </div>

      {/* Extras — smaller, grouped */}
      {extras.length > 0 && (
        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[10px] text-muted-foreground">
          {extras.map((ex, i) => (
            <span key={i} className="whitespace-nowrap">
              <span className="uppercase tracking-wider">{ex.label}:</span>{' '}
              <span className="font-medium text-foreground">{ex.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsSubPage({ project, chapters }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emotionalArc, setEmotionalArc] = useState(null);
  const [emotionLoading, setEmotionLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);

  // NEW: forensic analysis state
  const [forensic, setForensic] = useState(null);
  const [forensicLoading, setForensicLoading] = useState(false);
  const [evidenceReport, setEvidenceReport] = useState(null);

  const handleFileSelect = async (file) => {
    if (!file) return;
    setUploading(true);
    try { setParsed(await parseDocxFile(file)); } catch (err) { toast.error('Parse failed: ' + err.message); } finally { setUploading(false); }
  };

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    setEmotionalArc(null);
    setForensic(null);
    let chapterData = [];
    let allTextParts = [];
    let chapterContents = []; // parallel array for forensic analysis

    if (source === 'project' && project && chapters?.length) {
      const body = chapters.filter(c => chapterHasContent(c) && isBodyChapter(c)).sort((a, b) => a.chapter_number - b.chapter_number);
      for (const ch of body) {
        const content = await resolveChapterContent(ch);
        if (!content) continue;
        allTextParts.push(content);
        chapterContents.push(content);
        chapterData.push({ num: ch.chapter_number, title: ch.title, wordCount: countWords(content), dialogueRatio: dialogueRatio(content), readability: fleschKincaid(content), vocabDiversity: vocabDiversity(content), aiRisk: aiRiskScore(content), content });
      }
    } else if (source === 'upload' && parsed?.chapters) {
      for (let i = 0; i < parsed.chapters.length; i++) {
        const ch = parsed.chapters[i];
        const content = ch.content || '';
        allTextParts.push(content);
        chapterContents.push(content);
        chapterData.push({ num: i + 1, title: ch.title || 'Chapter ' + (i + 1), wordCount: countWords(content), dialogueRatio: dialogueRatio(content), readability: fleschKincaid(content), vocabDiversity: vocabDiversity(content), aiRisk: aiRiskScore(content), content });
      }
    }

    if (!chapterData.length) { setLoading(false); return; }

    const allText = allTextParts.join('\n');

    // Character depth analysis
    const charNames = characterFrequency(allText).slice(0, 8).map(([name]) => name);
    const charDepth = analyzeCharacterDepth(allText, charNames);

    const allLengths = allText.split(/[.!?]+/).filter(s => s.trim().length > 3).map(s => s.trim().split(/\s+/).length);
    const buckets = [{ range: '1-5', count: 0 }, { range: '6-10', count: 0 }, { range: '11-15', count: 0 }, { range: '16-20', count: 0 }, { range: '21-30', count: 0 }, { range: '31+', count: 0 }];
    for (const len of allLengths) {
      if (len <= 5) buckets[0].count++; else if (len <= 10) buckets[1].count++; else if (len <= 15) buckets[2].count++; else if (len <= 20) buckets[3].count++; else if (len <= 30) buckets[4].count++; else buckets[5].count++;
    }

    // Book-level aggregates — computed once, displayed on each chart card as
    // the "single number" anchor for the chapter distribution below it.
    // Minimum / maximum highlight the chapter extremes (outliers, problem spots).
    const n = chapterData.length;
    const sum = (arr, key) => arr.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);
    const minMax = (arr, key) => {
      let min = Infinity, max = -Infinity, minCh = 0, maxCh = 0;
      for (const c of arr) {
        const v = Number(c[key]) || 0;
        if (v < min) { min = v; minCh = c.num; }
        if (v > max) { max = v; maxCh = c.num; }
      }
      return { min, max, minCh, maxCh };
    };
    const avgWordCount = Math.round(sum(chapterData, 'wordCount') / n);
    const avgDialogue = Math.round(sum(chapterData, 'dialogueRatio') / n);
    const avgReadability = Math.round((sum(chapterData, 'readability') / n) * 10) / 10;
    const avgVocab = Math.round((sum(chapterData, 'vocabDiversity') / n) * 10) / 10;
    const avgAiRisk = Math.round(sum(chapterData, 'aiRisk') / n);
    const totalWords = sum(chapterData, 'wordCount');

    // Sentence length aggregates from the full-text split
    const avgSentLen = allLengths.length
      ? Math.round((allLengths.reduce((a, b) => a + b, 0) / allLengths.length) * 10) / 10
      : 0;

    const aggregates = {
      totalWords,
      chapterCount: n,
      avgWordCount,
      wordCountRange: minMax(chapterData, 'wordCount'),
      avgDialogue,
      dialogueRange: minMax(chapterData, 'dialogueRatio'),
      avgReadability,
      readabilityRange: minMax(chapterData, 'readability'),
      avgVocab,
      vocabRange: minMax(chapterData, 'vocabDiversity'),
      avgAiRisk,
      aiRiskRange: minMax(chapterData, 'aiRisk'),
      avgSentLen,
      totalSentences: allLengths.length,
    };

    setReport({ chapterData, sentenceBuckets: buckets, globalCharacters: characterFrequency(allText), characterDepth: charDepth, allText, aggregates });
    // Build deterministic evidence report from the loaded chapters
    try {
      const loaded = chapterData.map((c, i) => ({
        chapter: { chapter_number: c.num, title: c.title },
        content: c.content,
      }));
      const evidence = buildManuscriptEvidenceReport(loaded, project);
      setEvidenceReport(evidence);
    } catch (err) {
      console.warn('[ANALYTICS] Evidence report failed:', err);
    }
    setLoading(false);
  };

  const runForensicReport = async () => {
    if (!report) return;
    setForensicLoading(true);
    try {
      const title = source === 'project' ? project?.title : (parsed?.title || 'Uploaded Manuscript');
      const genre = source === 'project' ? project?.genre : 'Fiction';
      const projectType = source === 'project' ? (project?.project_type || project?.book_type || 'fiction') : 'fiction';
      const stats = calculateManuscriptStats(report.allText);
      const result = await runForensicAnalysis({
        fullText: report.allText,
        chapterStats: report.chapterData,
        stats,
        title,
        genre,
        projectType,
      });
      console.warn('[FORENSIC] Complete:', {
        lit: result.litScore, audience: result.audienceScore, ai: result.aiIndex,
        status: result.criticStatus, mechanic: result.primary_mechanic,
      });
      setForensic(result);
      toast.success(`Forensic audit complete — ${result.criticStatus} (Lit ${result.litScore}% / AI ${result.aiIndex})`);
    } catch (err) {
      console.error('[FORENSIC] Failed:', err);
      toast.error('Forensic analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setForensicLoading(false);
    }
  };

  const generateEmotionalArc = async () => {
    if (!report) return;
    setEmotionLoading(true);
    try {
      const summaries = report.chapterData.map(c => `Ch.${c.num} "${c.title || ''}": ${c.wordCount} words, ${c.dialogueRatio}% dialogue`).join('\n');
      const title = source === 'project' ? project?.title : 'Uploaded Manuscript';
      const genre = source === 'project' ? project?.genre : 'Fiction';
      const result = await invokeLLMWithRetry({
        task_type: 'analytics',
        prompt: `Analyze emotional arc. For each chapter, sentiment score -5 to +5. Return JSON: {chapters: [{chapter, score, label}]}.\n\n${summaries}\n\nTitle: ${title}\nGenre: ${genre}`,
        response_json_schema: { type: 'object', properties: { chapters: { type: 'array', items: { type: 'object', properties: { chapter: { type: 'number' }, score: { type: 'number' }, label: { type: 'string' } } } } } },
        model: pickModel('analytics'),
        fallback_model: pickFallbackModel('analytics'),
      });
      setEmotionalArc(result?.chapters || []);
    } finally { setEmotionLoading(false); }
  };

  const ready = source === 'project' ? !!(project?.id && chapters?.length) : !!parsed;

  return (
    <div className="space-y-4">
      <div>
        <p className="notebook-kicker">Deep Analysis</p>
        <h2 className="font-display text-2xl text-foreground">Manuscript Analytics</h2>
        <p className="text-xs text-muted-foreground mt-1">Chapter-by-chapter metrics plus forensic audit-style book-level diagnostics.</p>
      </div>

      <SourceSelector source={source} setSource={(s) => { setSource(s); setReport(null); setEmotionalArc(null); setForensic(null); }} project={project} />

      {source === 'upload' && !parsed && <UploadZone onFileSelect={handleFileSelect} uploading={uploading} />}

      {source === 'upload' && parsed && (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/80 p-3">
          <span className="text-sm font-medium">{parsed.totalWords?.toLocaleString()} words · {parsed.chapterCount} chapters</span>
          <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setReport(null); setForensic(null); }} className="rounded-full text-xs">Change File</Button>
        </div>
      )}

      {ready && (
        <Button onClick={generateReport} disabled={loading} className="rounded-full gap-2 w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {loading ? 'Analyzing…' : 'Run Analytics'}
        </Button>
      )}

      {report && (
        <div className="space-y-4">

          {/* WAVE7-REPORTEXPORT: analytics had no export at all — no CSV, no PDF,
              no markdown. An editorial letter or beta-reader packet could not be
              produced from this page. */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadMarkdown(
                reportFilename(project, 'analytics'),
                buildAnalyticsMarkdown(
                  project,
                  report.aggregates,
                  (report.chapterData || []).map((c) => ({
                    chapterNumber: c.num, title: c.title, wordCount: c.wordCount,
                    dialogueRatio: c.dialogueRatio, readability: c.readability,
                    vocabDiversity: c.vocabDiversity, aiRisk: c.aiRisk,
                  })),
                  forensic,
                  evidenceReport,
                ),
              )}
              className="rounded-full text-xs"
            >
              Export analytics (.md)
            </Button>
          </div>

          {/* ───────── FORENSIC AUDIT SECTION (NEW) ───────── */}
          <div className="rounded-2xl border-2 border-primary/30 bg-card/90 p-5 backdrop-blur-sm shadow-sm">
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary/70 font-bold">Forensic Audit</p>
                <h3 className="font-display text-xl text-foreground">Book-Level Diagnostics</h3>
                <p className="text-[11px] text-muted-foreground mt-1">Audit-style forensic breakdown with composite scores and LLM findings.</p>
              </div>
              {!forensic && (
                <Button onClick={runForensicReport} disabled={forensicLoading} size="sm" className="rounded-full gap-2">
                  {forensicLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Microscope className="h-3.5 w-3.5" />}
                  {forensicLoading ? 'Running Forensic Audit…' : 'Run Forensic Audit'}
                </Button>
              )}
            </div>

            {forensic && (
              <>
                {/* THREE SCORE CARDS + CRITIC STATUS */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl border border-border/60 bg-card/70 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Lit Score</p>
                    <div className="text-4xl font-bold mt-1" style={{ color: scoreColor(forensic.litScore) }}>{forensic.litScore}%</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Literary craft</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/70 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Audience Score</p>
                    <div className="text-4xl font-bold mt-1" style={{ color: scoreColor(forensic.audienceScore) }}>{forensic.audienceScore}%</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Commercial appeal</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/70 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">AI Index</p>
                    <div className="text-4xl font-bold mt-1" style={{ color: aiIndexColor(forensic.aiIndex) }}>{forensic.aiIndex.toFixed(2)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">0 = human · 1 = AI</p>
                  </div>
                  {(() => {
                    const c = criticStatusColor(forensic.criticStatus);
                    return (
                      <div className="rounded-xl border-2 p-3 text-center flex flex-col justify-center" style={{ background: c.bg, borderColor: c.border }}>
                        <div className="text-2xl">{c.emoji}</div>
                        <div className="text-sm font-bold mt-1" style={{ color: c.text }}>{forensic.criticStatus}</div>
                      </div>
                    );
                  })()}
                </div>

                {/* LLM FINDINGS */}
                <div className="space-y-3 mb-4">
                  <div className="rounded-xl bg-secondary/30 border border-border/40 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Primary Mechanic</p>
                    <p className="text-lg font-display text-foreground mt-0.5">{forensic.primary_mechanic}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 border border-border/40 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Forensic Marker</p>
                    <p className="text-sm text-foreground mt-0.5 italic">{forensic.forensic_marker_description}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 border border-border/40 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Thematic Spine</p>
                    <p className="text-sm text-foreground mt-0.5 italic">{forensic.thematic_spine}</p>
                  </div>
                </div>

                {/* MECHANICAL METRICS TABLE */}
                <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Mechanical Signature</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Scaffold Density</p>
                      <p className="font-semibold">{forensic.mechanics.scaffoldDensity.density.toFixed(2)}/1k <span className="text-muted-foreground font-normal">({forensic.mechanics.scaffoldDensity.count})</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Burstiness</p>
                      <p className="font-semibold">{forensic.mechanics.burstiness.burstiness} <span className="text-muted-foreground font-normal">(target &gt; 8)</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Show : Tell</p>
                      <p className="font-semibold">{Math.round(forensic.mechanics.showTellRatio.ratio * 100)}% : {100 - Math.round(forensic.mechanics.showTellRatio.ratio * 100)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Hook Density</p>
                      <p className="font-semibold">{forensic.mechanics.hookDensity.hooks}/{forensic.mechanics.hookDensity.total} <span className="text-muted-foreground font-normal">chapters</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pacing Variance</p>
                      <p className="font-semibold">{forensic.mechanics.pacingVariance.coefficient} <span className="text-muted-foreground font-normal">(0.15-0.35 ideal)</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vocab Diversity</p>
                      <p className="font-semibold">{forensic.mechanics.avgVocabDiversity}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Readability</p>
                      <p className="font-semibold">FK {forensic.mechanics.avgReadability}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Dialogue</p>
                      <p className="font-semibold">{forensic.mechanics.avgDialogueRatio}%</p>
                    </div>
                  </div>

                  {/* Dominant forensic marker (if any) */}
                  {forensic.mechanics.forensicMarkers.dominant && forensic.mechanics.forensicMarkers.dominant !== 'none' && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground">Dominant Pattern Detected</p>
                      <p className="text-xs font-medium text-foreground mt-0.5">
                        {MARKER_LABELS[forensic.mechanics.forensicMarkers.dominant]}
                        <span className="text-muted-foreground font-normal"> — {forensic.mechanics.forensicMarkers.markers[forensic.mechanics.forensicMarkers.dominant]} instances</span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ───────── EXISTING CHARTS ───────── */}
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-lg">Pacing — Words per Chapter</h3>
              <SummaryRow
                primary={{ label: 'Avg', value: report.aggregates.avgWordCount.toLocaleString(), unit: 'words' }}
                extras={[
                  { label: 'Total', value: report.aggregates.totalWords.toLocaleString() + ' words' },
                  { label: 'Shortest', value: `Ch.${report.aggregates.wordCountRange.minCh} (${report.aggregates.wordCountRange.min.toLocaleString()})` },
                  { label: 'Longest', value: `Ch.${report.aggregates.wordCountRange.maxCh} (${report.aggregates.wordCountRange.max.toLocaleString()})` },
                ]}
              />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={report.chapterData.map(c => ({ name: `Ch.${c.num}`, words: c.wordCount }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Bar dataKey="words" fill="#8B6F47" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-lg">Dialogue vs Narration</h3>
              <SummaryRow
                primary={{ label: 'Avg', value: `${report.aggregates.avgDialogue}%`, unit: 'dialogue' }}
                extras={[
                  { label: 'Narration', value: `${100 - report.aggregates.avgDialogue}%` },
                  { label: 'Least dialogue', value: `Ch.${report.aggregates.dialogueRange.minCh} (${report.aggregates.dialogueRange.min}%)` },
                  { label: 'Most dialogue', value: `Ch.${report.aggregates.dialogueRange.maxCh} (${report.aggregates.dialogueRange.max}%)` },
                ]}
              />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={report.chapterData.map(c => ({ name: `Ch.${c.num}`, dialogue: c.dialogueRatio, narration: 100 - c.dialogueRatio }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Bar dataKey="dialogue" fill="#6B8F71" stackId="a" name="Dialogue %" /><Bar dataKey="narration" fill="#B8956A" stackId="a" name="Narration %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-lg">Readability & Vocabulary</h3>
              <SummaryRow
                primary={{ label: 'FK Grade', value: report.aggregates.avgReadability, unit: 'avg' }}
                extras={[
                  { label: 'Vocab diversity', value: `${report.aggregates.avgVocab}% avg` },
                  { label: 'Easiest', value: `Ch.${report.aggregates.readabilityRange.minCh} (FK ${report.aggregates.readabilityRange.min.toFixed(1)})` },
                  { label: 'Hardest', value: `Ch.${report.aggregates.readabilityRange.maxCh} (FK ${report.aggregates.readabilityRange.max.toFixed(1)})` },
                ]}
              />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={report.chapterData.map(c => ({ name: `Ch.${c.num}`, readability: c.readability, vocab: c.vocabDiversity }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Line type="monotone" dataKey="readability" stroke="#8B6F47" name="FK Grade" dot={{ r: 3 }} /><Line type="monotone" dataKey="vocab" stroke="#6B8F71" name="Vocab %" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-lg">AI Detection Risk per Chapter</h3>
              <SummaryRow
                primary={{
                  label: 'Avg risk',
                  value: `${report.aggregates.avgAiRisk}%`,
                  color: report.aggregates.avgAiRisk > 60 ? '#c0392b' : report.aggregates.avgAiRisk > 30 ? '#DAA520' : '#6B8F71',
                }}
                extras={[
                  { label: 'Lowest', value: `Ch.${report.aggregates.aiRiskRange.minCh} (${report.aggregates.aiRiskRange.min}%)` },
                  { label: 'Highest', value: `Ch.${report.aggregates.aiRiskRange.maxCh} (${report.aggregates.aiRiskRange.max}%)` },
                  { label: 'Chapters over 60%', value: `${report.chapterData.filter(c => c.aiRisk > 60).length}/${report.chapterData.length}` },
                ]}
              />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={report.chapterData.map(c => ({ name: `Ch.${c.num}`, risk: c.aiRisk }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[0, 100]} /><Tooltip />
                <Bar dataKey="risk" name="AI Risk %" radius={[4, 4, 0, 0]}>
                  {report.chapterData.map((c, i) => <Cell key={i} fill={c.aiRisk > 60 ? '#c0392b' : c.aiRisk > 30 ? '#DAA520' : '#6B8F71'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-lg">Sentence Length Distribution</h3>
              <SummaryRow
                primary={{ label: 'Avg', value: report.aggregates.avgSentLen, unit: 'words/sentence' }}
                extras={[
                  { label: 'Total sentences', value: report.aggregates.totalSentences.toLocaleString() },
                  { label: 'Dominant bucket', value: (() => {
                    const top = [...report.sentenceBuckets].sort((a, b) => b.count - a.count)[0];
                    return top ? `${top.range} words (${top.count})` : 'n/a';
                  })() },
                ]}
              />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={report.sentenceBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="range" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                <Bar dataKey="count" fill="#A67B5B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {evidenceReport && evidenceReport.manuscript.slopScoreCurve && (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-display text-lg">Slop Density Curve (Evidence Engine)</h3>
                <SummaryRow
                  primary={{
                    label: 'Avg Slop',
                    value: (evidenceReport.manuscript.slopScoreCurve.reduce((a, b) => a + b, 0) / evidenceReport.manuscript.slopScoreCurve.length).toFixed(2),
                    unit: 'per 1k words',
                    color: (evidenceReport.manuscript.slopScoreCurve.reduce((a, b) => a + b, 0) / evidenceReport.manuscript.slopScoreCurve.length) > 3 ? '#c0392b' : '#6B8F71',
                  }}
                  extras={[
                    { label: 'TTR', value: evidenceReport.manuscript.ttr },
                    { label: 'Chapters', value: evidenceReport.manuscript.chapterCount },
                  ]}
                />
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={evidenceReport.manuscript.slopScoreCurve.map((s, i) => ({ name: `Ch.${i + 1}`, slop: s }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="slop" stroke="#c0392b" strokeWidth={2} name="Slop/1k" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {evidenceReport && evidenceReport.manuscript.dialogueRatioCurve && (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-display text-lg">Dialogue Balance Curve (Evidence Engine)</h3>
                <SummaryRow
                  primary={{
                    label: 'Avg Dialogue',
                    value: `${(evidenceReport.manuscript.dialogueRatioCurve.reduce((a, b) => a + b, 0) / evidenceReport.manuscript.dialogueRatioCurve.length * 100).toFixed(1)}%`,
                  }}
                />
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={evidenceReport.manuscript.dialogueRatioCurve.map((d, i) => ({ name: `Ch.${i + 1}`, dialogue: Math.round(d * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="dialogue" name="Dialogue %" fill="#6B8F71" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <h3 className="font-display text-lg mb-3">Character Mentions</h3>
            <div className="space-y-1">
              {report.globalCharacters.map(([name, count]) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-24 truncate">{name}</span>
                  <div className="flex-1 h-4 rounded-full bg-secondary/50 overflow-hidden"><div className="h-full rounded-full bg-primary/60" style={{ width: `${(count / (report.globalCharacters[0]?.[1] || 1)) * 100}%` }} /></div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {report.characterDepth && Object.keys(report.characterDepth).length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
              <h3 className="font-display text-lg mb-3">Character Depth</h3>
              <p className="text-[10px] text-muted-foreground mb-3">Measures interiority (thoughts/feelings shown through action) vs. dialogue vs. physical action. Healthy: 30-40% interiority, 30-40% dialogue, 20-30% action. Low interiority (&lt;20%) = "plot puppet."</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Character</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Mentions</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Interior</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Dialogue</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Action</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Int. %</th>
                      <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.characterDepth).map(([name, d]) => (
                      <tr key={name} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 font-medium text-foreground">{name}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{d.mentions}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{d.interiority}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{d.dialogue}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{d.action}</td>
                        <td className="py-1.5 text-center font-medium" style={{ color: d.interiorityRatio >= 30 ? '#4CAF50' : d.interiorityRatio >= 20 ? '#DAA520' : '#c0392b' }}>{d.interiorityRatio}%</td>
                        <td className="py-1.5 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.depthRating === 'Good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            d.depthRating === 'Fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>{d.depthRating}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <h3 className="font-display text-lg mb-3">Emotional Arc</h3>
            {emotionalArc ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={emotionalArc.map(e => ({ name: `Ch.${e.chapter}`, score: e.score, label: e.label }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[-5, 5]} />
                  <Tooltip content={({ active, payload }) => active && payload?.[0] ? (<div className="rounded-lg bg-card border border-border p-2 text-xs shadow-lg"><p className="font-medium">{payload[0].payload.name}: {payload[0].value}</p><p className="text-muted-foreground">{payload[0].payload.label}</p></div>) : null} />
                  <Line type="monotone" dataKey="score" stroke="#8B6F47" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Button onClick={generateEmotionalArc} disabled={emotionLoading} variant="secondary" className="rounded-full gap-2">
                {emotionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />} Generate Emotional Arc (AI)
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}