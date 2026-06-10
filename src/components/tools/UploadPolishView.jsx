import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, FileText, Loader2, RefreshCw, Download, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { calculateManuscriptStats, calculateManuscriptStatsNonfiction, detectHighFreqPhrases } from '@/lib/manuscriptStats';
import { mechanicalScore } from '@/lib/mechanicalScore';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import ReactMarkdown from 'react-markdown';

function StatCard({ value, label }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-center">
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ComparisonRow({ metric, before, after }) {
  const diff = before - after;
  const improved = metric === 'Clean Score' ? after > before : after < before;
  const changeText = metric === 'Clean Score'
    ? (after > before ? '+' + (after - before) + ' ✅' : after < before ? (after - before) + '' : '—')
    : (diff > 0 ? '-' + diff + ' ✅' : diff < 0 ? '+' + Math.abs(diff) : '—');
  return (
    <tr>
      <td className="py-1.5 pr-3 text-sm text-muted-foreground">{metric}</td>
      <td className="py-1.5 px-3 text-sm text-center">{before}</td>
      <td className="py-1.5 px-3 text-sm text-center">{after}</td>
      <td className={`py-1.5 pl-3 text-sm text-center font-medium ${improved ? 'text-green-600' : 'text-muted-foreground'}`}>{changeText}</td>
    </tr>
  );
}

const BANNED_WORDS = ['shimmering','luminous','tapestry','intricate','meticulously','insatiable','palpable','unmistakable','undeniable','relentless','sprawling','labyrinthine','opulent','resplendent','ethereal','visceral','cacophony','crescendo','juxtaposition','myriad','plethora','testament','harbinger','paradigm','dichotomy','multifaceted','aforementioned','nonetheless','furthermore','henceforth','commence','utilize','endeavor','pertaining'];

const VOICE_PATTERNS = [
  { pattern: /\bHis voice was flat\b/g, replacements: ['He spoke flatly', 'The words came out flat', 'His tone was dead'] },
  { pattern: /\bHer voice was flat\b/g, replacements: ['She spoke flatly', 'The words came out flat', 'Her tone was dead'] },
  { pattern: /\bHis voice was low\b/g, replacements: ['He kept his voice down', 'He spoke quietly', 'His words were barely audible'] },
  { pattern: /\bHer voice was low\b/g, replacements: ['She kept her voice down', 'She spoke quietly', 'Her words were barely audible'] },
  { pattern: /\bHis voice was steady\b/g, replacements: ['He held his voice even', 'His tone did not waver', 'He spoke without inflection'] },
  { pattern: /\bHer voice was steady\b/g, replacements: ['She held her voice even', 'Her tone did not waver', 'She spoke without inflection'] },
  { pattern: /\bHis voice was quiet\b/g, replacements: ['He barely spoke above a whisper', 'His words were almost inaudible', 'He lowered his voice'] },
  { pattern: /\bHer voice was quiet\b/g, replacements: ['She barely spoke above a whisper', 'Her words were almost inaudible', 'She lowered her voice'] },
  { pattern: /\bHis voice was rough\b/g, replacements: ['His throat scraped around the words', 'He ground the words out', 'The words came out raw'] },
  { pattern: /\bHer voice was rough\b/g, replacements: ['Her throat scraped around the words', 'She ground the words out', 'The words came out raw'] },
  { pattern: /\bHis voice was tight\b/g, replacements: ['His jaw clenched around the words', 'He forced the words through his teeth', 'His throat tightened'] },
  { pattern: /\bHer voice was tight\b/g, replacements: ['Her jaw clenched around the words', 'She forced the words through her teeth', 'Her throat tightened'] },
  { pattern: /\bHis voice was cold\b/g, replacements: ['He spoke without warmth', 'Ice lined every word', 'His tone could have frozen glass'] },
  { pattern: /\bHer voice was cold\b/g, replacements: ['She spoke without warmth', 'Ice lined every word', 'Her tone could have frozen glass'] },
  { pattern: /\bHis voice was sharp\b/g, replacements: ['The words cut', 'He snapped', 'His tone bit'] },
  { pattern: /\bHer voice was sharp\b/g, replacements: ['The words cut', 'She snapped', 'Her tone bit'] },
  { pattern: /\bHis voice was calm\b/g, replacements: ['He sounded unbothered', 'His tone betrayed nothing', 'He spoke as if discussing the weather'] },
  { pattern: /\bHer voice was calm\b/g, replacements: ['She sounded unbothered', 'Her tone betrayed nothing', 'She spoke as if discussing the weather'] },
  { pattern: /\bHis voice was soft\b/g, replacements: ['He gentled his tone', 'The hard edge left his voice', 'He spoke gently'] },
  { pattern: /\bHer voice was soft\b/g, replacements: ['She gentled her tone', 'The hard edge left her voice', 'She spoke gently'] },
  { pattern: /\bHis voice was hoarse\b/g, replacements: ['The words scraped out of him', 'His voice had gone to gravel', 'He croaked'] },
  { pattern: /\bHer voice was hoarse\b/g, replacements: ['The words scraped out of her', 'Her voice had gone to gravel', 'She croaked'] },
];

const REP_TARGETS = [
  { pattern: /\bshuddered\b/gi, name: 'shuddered', perChapter: 0.3, replacements: ['trembled','flinched','stiffened','shook','went rigid'] },
  { pattern: /\bthe silence\b/gi, name: 'the silence', perChapter: 0.4, replacements: ['the quiet','the stillness','the hush','the dead air'] },
  { pattern: /\bwhispered\b/gi, name: 'whispered', perChapter: 0.5, replacements: ['murmured','breathed','said softly'] },
  { pattern: /\bexhaled\b/gi, name: 'exhaled', perChapter: 0.3, replacements: ['breathed out','let out a breath','released a breath'] },
  { pattern: /\bclenched\b/gi, name: 'clenched', perChapter: 0.5, replacements: ['tightened','curled','balled','gripped'] },
  { pattern: /\bsuddenly\b/gi, name: 'suddenly', perChapter: 0.3, replacements: [] },
  { pattern: /\bsomehow\b/gi, name: 'somehow', perChapter: 0.2, replacements: [] },
];

export default function UploadPolishView({ parsed, setParsed, busyLabel, setBusyLabel, onBack }) {
  const [genre, setGenre] = useState('fiction');
  const [stats, setStats] = useState(null);
  const [polishResults, setPolishResults] = useState(null);
  const [critique, setCritique] = useState(null);
  const [critiqueRating, setCritiqueRating] = useState(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);

  const isNF = genre === 'nonfiction';
  const chapters = parsed?.chapters || [];

  // Calculate stats whenever genre or parsed changes
  const calcStats = useCallback(() => {
    if (!parsed?.fullText) return;
    const text = parsed.fullText;
    const s = isNF ? calculateManuscriptStatsNonfiction(text) : calculateManuscriptStats(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    s.wordCount = wordCount;
    s.chapterCount = chapters.length;
    s.avgWordsPerChapter = chapters.length ? Math.round(wordCount / chapters.length) : wordCount;
    s.estimatedPages = Math.ceil(wordCount / 250);
    s.highFreqPhrases = detectHighFreqPhrases(text, Math.max(chapters.length, 1));
    setStats(s);
  }, [parsed, isNF, chapters.length]);

  useEffect(() => { calcStats(); }, [calcStats]);

  // Auto-detect genre
  useEffect(() => {
    if (!parsed?.fullText) return;
    const text = parsed.fullText;
    const hasDialogue = (text.match(/"/g) || []).length > 50;
    const hasFootnotes = text.toLowerCase().includes('ibid') || text.toLowerCase().includes('op. cit.');
    if (hasFootnotes || !hasDialogue) setGenre('nonfiction');
  }, [parsed?.fullText]);

  // Full polish pipeline (matches ProjectStudio handleManuscriptPolish)
  const handlePolish = useCallback(async () => {
    if (!chapters.length) return;
    setBusyLabel('Polish: Analyzing…');

    const loaded = chapters.map(ch => ({ chapter: ch, content: ch.content, original: ch.content }));
    const chapterCount = loaded.length;

    // BEFORE stats
    const beforeText = loaded.map(f => f.content).join('\n\n');
    const beforeStats = isNF ? calculateManuscriptStatsNonfiction(beforeText) : calculateManuscriptStats(beforeText);

    const changes = [];

    // Step 1: Remove banned words
    let bannedRemoved = 0;
    for (const word of BANNED_WORDS) {
      const rx = new RegExp('\\b' + word + '\\b', 'gi');
      for (const f of loaded) {
        const matches = f.content.match(rx);
        if (matches && matches.length > 0) {
          f.content = f.content.replace(rx, '');
          bannedRemoved += matches.length;
          changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': removed "' + word + '" x' + matches.length);
        }
      }
    }
    setBusyLabel(`Polish: Removed ${bannedRemoved} banned words. Cleaning…`);

    // Step 2: Clean orphaned punctuation
    let punctuationFixes = 0;
    for (const f of loaded) {
      const before = f.content;
      f.content = f.content.replace(/  +/g, ' ');
      f.content = f.content.replace(/\bwas\s+\./g, 'was clear.');
      f.content = f.content.replace(/\bwas\s+,/g, 'was evident,');
      f.content = f.content.replace(/\bwere\s+\./g, 'were apparent.');
      f.content = f.content.replace(/\bseemed\s+\./g, 'seemed obvious.');
      f.content = f.content.replace(/\bfelt\s+\./g, 'felt real.');
      f.content = f.content.replace(/\ban\s+\./g, 'a clear.');
      f.content = f.content.replace(/\bthe\s+the\b/gi, 'the');
      f.content = f.content.replace(/ \./g, '.').replace(/ ,/g, ',').replace(/\.\./g, '.').replace(/,,/g, ',');
      if (f.content !== before) punctuationFixes++;
    }
    if (punctuationFixes > 0) changes.push('Fixed orphaned punctuation in ' + punctuationFixes + ' chapters');

    // Step 3: Fix capitalization
    setBusyLabel('Polish: Fixing capitalization…');
    let capFixed = 0;
    for (const f of loaded) {
      const before = f.content;
      f.content = f.content.replace(/([.!?])\s+([a-z])/g, (match, punct, letter, offset) => {
        if (offset >= 2 && f.content[offset - 1] === '.' && f.content[offset - 2] === '.') return match;
        return punct + ' ' + letter.toUpperCase();
      });
      if (f.content !== before) {
        const fixed = (before.match(/[.!?]\s+[a-z]/g) || []).length - (f.content.match(/[.!?]\s+[a-z]/g) || []).length;
        if (fixed > 0) { capFixed += fixed; changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': fixed ' + fixed + ' cap errors'); }
      }
    }

    // Step 4: Fix voice patterns (fiction only)
    setBusyLabel('Polish: Fixing voice patterns…');
    let voiceFixed = 0;
    if (!isNF) {
      for (const vp of VOICE_PATTERNS) {
        let repIdx = 0;
        for (const f of loaded) {
          f.content = f.content.replace(vp.pattern, () => { voiceFixed++; return vp.replacements[repIdx++ % vp.replacements.length]; });
        }
      }
      // Generic fallback
      const genericVoice = /\b(His|Her) voice was ([a-z]+)/g;
      for (const f of loaded) {
        let count = 0;
        f.content = f.content.replace(genericVoice, (match, pronoun, adj) => {
          count++;
          if (count <= 2) return match;
          voiceFixed++;
          return pronoun === 'His' ? 'He spoke, his tone ' + adj : 'She spoke, her tone ' + adj;
        });
      }
      if (voiceFixed > 0) changes.push('Fixed ' + voiceFixed + 'x "his/her voice was" patterns');
    }

    // Step 5: Fix repetition
    setBusyLabel('Polish: Fixing repetition…');
    let repFixed = 0;
    const allTextJoined = loaded.map(f => f.content).join('\n\n');
    for (const t of REP_TARGETS) {
      const total = (allTextJoined.match(t.pattern) || []).length;
      const cap = Math.max(Math.round(chapterCount * t.perChapter), 6);
      if (total <= cap) continue;
      const excess = total - cap;
      let replaced = 0;
      const chCounts = loaded.map((f, idx) => ({ idx, count: (f.content.match(t.pattern) || []).length })).sort((a, b) => b.count - a.count);
      for (const cc of chCounts) {
        if (replaced >= excess) break;
        if (cc.count <= 1) continue;
        const f = loaded[cc.idx];
        let instIdx = 0, chReplaced = 0;
        const maxThis = Math.min(cc.count - 1, excess - replaced);
        let repIdx = 0;
        f.content = f.content.replace(t.pattern, (match) => {
          instIdx++;
          if (instIdx <= 1 || chReplaced >= maxThis) return match;
          chReplaced++; replaced++; repFixed++;
          if (t.replacements.length === 0) return '';
          const rep = t.replacements[repIdx++ % t.replacements.length];
          return match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
        });
        if (chReplaced > 0) {
          f.content = f.content.replace(/  +/g, ' ');
          changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': replaced ' + chReplaced + 'x "' + t.name + '"');
        }
      }
    }

    // AFTER stats
    const afterText = loaded.map(f => f.content).join('\n\n');
    const afterStats = isNF ? calculateManuscriptStatsNonfiction(afterText) : calculateManuscriptStats(afterText);

    // Update chapters in memory
    const updatedChapters = loaded.map(f => ({ ...f.chapter, content: f.content }));
    setParsed(prev => ({
      ...prev,
      chapters: updatedChapters,
      fullText: afterText,
    }));

    setPolishResults({
      before: beforeStats,
      after: afterStats,
      changes,
      timestamp: new Date().toISOString(),
      bannedRemoved, capFixed, voiceFixed, repFixed, punctuationFixes,
    });

    toast.success(`Polish complete! ${bannedRemoved} banned, ${capFixed} caps, ${voiceFixed} voice, ${repFixed} reps fixed.`);
    setBusyLabel('');
  }, [chapters, isNF, setBusyLabel, setParsed]);

  // Critique
  const handleCritique = useCallback(async () => {
    if (!chapters.length || chapters.length < 1) return;
    setCritiqueLoading(true);
    setBusyLabel('Critique: Sampling chapters…');

    const first = chapters[0]?.content || '';
    const mid = chapters[Math.floor(chapters.length / 2)]?.content || '';
    const last = chapters[chapters.length - 1]?.content || '';
    const sample = [
      'CHAPTER 1 (Opening):\n' + first.substring(0, 2000),
      '\n\nCHAPTER ' + (Math.floor(chapters.length / 2) + 1) + ' (Midpoint):\n' + mid.substring(0, 2000),
      '\n\nCHAPTER ' + chapters.length + ' (Ending):\n' + last.substring(0, 2000),
    ].join('\n');

    const prompt = `You are a senior book editor at the New York Times Book Review. Write a pre-publication editorial assessment.

MANUSCRIPT INFO:
- Word Count: ~${(stats?.wordCount || 0).toLocaleString()}
- Chapters: ${chapters.length}

${sample}

Write a 400-500 word editorial assessment covering:
1. PROSE QUALITY: Voice, sentence construction, readability.
2. MARKETABILITY: What shelf? Target reader? Comparable titles?
3. STRENGTHS: What works? What keeps pages turning?
4. WEAKNESSES: What would you flag in an editorial letter?
5. VERDICT: One-sentence recommendation — acquire, pass, or revise-and-resubmit.

Be direct, knowledgeable, commercially aware.

After your written assessment, on the very last line, provide a star rating in this exact format:
RATING: [number]/5

The rating must be in half-star increments (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5).`;

    try {
      setBusyLabel('Critique: Generating editorial assessment… (15–30s)');
      const response = await invokeLLMWithRetry({ prompt, model: 'gemini_3_flash', fallback_model: 'deepseek/deepseek-v3.2-20251201' });
      let critiqueText = typeof response === 'string' ? response : (response?.text || response?.content || String(response || ''));
      let starRating = null;
      const ratingMatch = critiqueText.match(/RATING:\s*([\d.]+)\s*\/\s*5/i);
      if (ratingMatch) {
        starRating = parseFloat(ratingMatch[1]);
        starRating = Math.round(Math.min(5, Math.max(0, starRating)) * 2) / 2;
        critiqueText = critiqueText.replace(/RATING:\s*[\d.]+\s*\/\s*5/i, '').trim();
      }
      setCritique(critiqueText);
      setCritiqueRating(starRating);
    } catch (err) {
      toast.error('Critique failed: ' + err.message);
    }
    setBusyLabel('');
    setCritiqueLoading(false);
  }, [chapters, stats, setBusyLabel]);

  // Export polished copy
  const handleExportPolished = useCallback(() => {
    if (!parsed?.fullText) return;
    const blob = new Blob([parsed.fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polished-manuscript.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [parsed]);

  // Export quality report PDF
  const handleExportReport = useCallback(() => {
    if (!stats) return;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cs = stats.cleanScore || 0;
    const esc = (t) => (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page{margin:1in;size:letter}body{font-family:Georgia,serif;color:#333;line-height:1.6}
      .rh{text-align:center;border-bottom:2px solid #8B4513;padding-bottom:20px;margin-bottom:30px}
      .rt{font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#8B4513}
      .bt{font-size:28px;font-weight:bold;margin:10px 0;color:#1a1a1a}
      h2{font-size:18px;color:#8B4513;border-bottom:1px solid #ddd;padding-bottom:5px;margin-top:30px}
      .sg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:15px 0}
      .sb{text-align:center;padding:12px 8px;background:#f9f6f1;border:1px solid #e0d5c5;border-radius:6px}
      .sv{font-size:24px;font-weight:bold;color:#1a1a1a}.sl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-top:4px}
      .sd{text-align:center;margin:20px 0;padding:20px;background:#f9f6f1;border:2px solid #e0d5c5;border-radius:10px}
      .sn{font-size:48px;font-weight:bold}.sf{color:#4CAF50}.sm{color:#DAA520}.sr{color:#c0392b}
      .sll{font-size:14px;font-weight:600;margin-top:5px}
      .ct{width:100%;border-collapse:collapse;margin:15px 0}
      .ct th{background:#8B4513;color:#fff;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px}
      .ct td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}.ct tr:nth-child(even){background:#faf8f5}
      .imp{color:#4CAF50;font-weight:600}
      .fl{font-size:13px;padding-left:20px}.fl li{margin-bottom:4px}
      .cl{font-size:12px;color:#555;padding-left:20px}.cl li{margin-bottom:3px}
      .crt{font-size:14px;line-height:1.8;text-align:justify;margin:15px 0;padding:15px;background:#faf8f5;border-left:3px solid #8B4513}
      .stars{text-align:center;font-size:28px;letter-spacing:4px;margin:10px 0}
      .stf{color:#DAA520}.ste{color:#ccc}
      .ft{margin-top:40px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center}
    </style></head><body>`;

    html += `<div class="rh"><div class="rt">Manuscript Quality Report</div><div class="bt">Uploaded Manuscript</div><div style="font-size:12px;color:#888">${today}</div></div>`;
    html += `<h2>Overview</h2><div class="sg">
      <div class="sb"><div class="sv">${(stats.wordCount||0).toLocaleString()}</div><div class="sl">Words</div></div>
      <div class="sb"><div class="sv">${stats.chapterCount||0}</div><div class="sl">Chapters</div></div>
      <div class="sb"><div class="sv">${(stats.avgWordsPerChapter||0).toLocaleString()}</div><div class="sl">Avg/Ch</div></div>
      <div class="sb"><div class="sv">${stats.estimatedPages||0}</div><div class="sl">Est. Pages</div></div>
    </div>`;
    html += `<h2>Publication Readiness</h2><div class="sd">
      <div class="sn ${cs>=85?'sf':cs>=70?'sm':'sr'}">${cs}%</div>
      <div class="sll">${cs>=90?'Certified Fresh':cs>=85?'Fresh':cs>=70?'Mixed':'Rotten'}</div>
    </div>`;
    html += `<div class="sg">
      <div class="sb"><div class="sv">${stats.bannedWords||0}</div><div class="sl">Banned</div></div>
      <div class="sb"><div class="sv">${stats.voiceWas||0}</div><div class="sl">Voice</div></div>
      <div class="sb"><div class="sv">${stats.capErrors||0}</div><div class="sl">Caps</div></div>
      <div class="sb"><div class="sv">${stats.scaffolds||0}</div><div class="sl">Scaffolds</div></div>
    </div>`;

    if (stats.highFreqPhrases?.length > 0) {
      html += `<h2>High-Frequency Phrases</h2><ul class="fl">${stats.highFreqPhrases.map(([p,c])=>`<li>"${esc(p)}" — ${c}×</li>`).join('')}</ul>`;
    }
    if (polishResults) {
      const b = polishResults.before, a = polishResults.after;
      const row = (m,bv,av,inv) => { const d=inv?av-bv:bv-av; return `<tr><td>${m}</td><td>${inv?bv+'%':bv}</td><td>${inv?av+'%':av}</td><td class="${d>0?'imp':''}">${d>0?(inv?'+':'-')+d+' ✓':'—'}</td></tr>`; };
      html += `<h2>Polish Before &amp; After</h2><table class="ct"><thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>`;
      html += row('Banned Words',b.bannedWords,a.bannedWords,false);
      html += row('Voice Patterns',b.voiceWas,a.voiceWas,false);
      html += row('Repetition',b.repetitionTotal,a.repetitionTotal,false);
      html += row('Cap Errors',b.capErrors,a.capErrors,false);
      html += row('Clean Score',b.cleanScore,a.cleanScore,true);
      html += `</tbody></table>`;
      if (polishResults.changes?.length > 0) {
        html += `<h2>Changes</h2><ul class="cl">${polishResults.changes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`;
      }
    }
    if (critique) {
      html += `<h2>Editorial Assessment</h2>`;
      if (critiqueRating !== null) {
        let s = ''; for (let i=1;i<=5;i++) s += critiqueRating>=i-0.5?'<span class="stf">★</span>':'<span class="ste">★</span>';
        html += `<div class="stars">${s}</div><div style="text-align:center;font-size:16px;font-weight:600;color:#555">${critiqueRating}/5</div>`;
      }
      html += `<div class="crt">${critique.split('\n').filter(p=>p.trim()).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;
    }
    html += `<div class="ft">Generated by Unity Book Studio • ${today}</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    if (pw) { pw.onload = () => { pw.print(); setTimeout(() => URL.revokeObjectURL(url), 60000); }; }
    else {
      const a = document.createElement('a'); a.href = url; a.download = 'manuscript-quality-report.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }, [stats, polishResults, critique, critiqueRating]);

  const cleanScore = stats?.cleanScore || 0;
  const rtLabel = cleanScore >= 90 ? 'Certified Fresh' : cleanScore >= 85 ? 'Fresh' : cleanScore >= 70 ? 'Mixed' : 'Rotten';
  const rtIcon = cleanScore >= 85 ? '🍅' : cleanScore >= 70 ? '🟡' : '🤢';
  const rtExplanation = cleanScore >= 90 ? 'Publication-ready. Ship it.'
    : cleanScore >= 85 ? 'Near publication-ready. Minor polish may help.'
    : cleanScore >= 70 ? 'Needs a polish pass. Click Polish Manuscript.'
    : 'Significant cleanup needed. Run Polish Manuscript.';
  const isBusy = !!busyLabel;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Polish & Fix</h3>
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full text-xs">← Back</Button>
      </div>

      {/* Fiction / Nonfiction toggle */}
      <div className="flex items-center gap-0">
        <div className="flex rounded-full border border-border/70 bg-white/50 dark:bg-muted/50 p-0.5 w-fit">
          {['fiction', 'nonfiction'].map((t) => (
            <button key={t} type="button" onClick={() => setGenre(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${genre === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >{t}</button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground ml-3">
          {isNF ? '📚 Nonfiction rules applied' : '📖 Fiction rules applied'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm text-center">
        <Button onClick={handlePolish} disabled={isBusy} size="lg" className="rounded-full px-8 py-3 text-base gap-2">
          {isBusy && busyLabel.includes('Polish') ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace(/Polish:\s*/, '')}</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {polishResults ? '✨ Run Polish Again' : '✨ Polish Manuscript'}</>
          )}
        </Button>
        {polishResults && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <Button onClick={calcStats} disabled={isBusy} variant="outline" className="rounded-full gap-2 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Stats
            </Button>
            <Button onClick={() => { setPolishResults(null); setCritique(null); setCritiqueRating(null); onBack(); }} disabled={isBusy} variant="outline" className="rounded-full gap-2 text-xs text-destructive border-destructive/50 hover:bg-destructive/10">
              ✕ Start Over
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground max-w-md mx-auto">
          Removes banned AI words, fixes repetition patterns, voice attributions, and capitalization across all chapters.
        </p>
      </div>

      {/* Manuscript Overview */}
      {stats && (
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <h2 className="font-display text-xl text-foreground mb-4">Manuscript Overview</h2>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatCard value={stats.wordCount?.toLocaleString() || '—'} label="Words" />
            <StatCard value={stats.chapterCount || '—'} label="Chapters" />
            <StatCard value={stats.avgWordsPerChapter?.toLocaleString() || '—'} label="Avg / Ch" />
            <StatCard value={stats.estimatedPages || '—'} label="Est. Pages" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <StatCard value={stats.cleanScore} label="Clean Score" />
            <StatCard value={stats.bannedWords} label="Banned Words" />
            <StatCard value={stats.voiceWas} label="Voice Patterns" />
            <StatCard value={stats.capErrors} label="Cap Errors" />
            <StatCard value={stats.scaffolds} label="Scaffolds" />
          </div>
        </div>
      )}

      {/* Publication Readiness */}
      {stats && (
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm text-center">
          <h2 className="font-display text-xl text-foreground mb-4">Publication Readiness</h2>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{rtIcon}</span>
            <span className="text-4xl font-bold text-foreground">{cleanScore}%</span>
            <Badge variant={cleanScore >= 85 ? 'default' : cleanScore >= 70 ? 'secondary' : 'destructive'} className="mt-1">
              {rtLabel}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{rtExplanation}</p>
        </div>
      )}

      {/* High-Frequency Phrases */}
      {stats?.highFreqPhrases?.length > 0 && (
        <div className="rounded-xl border border-yellow-300/40 bg-yellow-50/50 dark:bg-yellow-950/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 mb-2">⚠️ High-Frequency Phrases</p>
          <div className="space-y-1">
            {stats.highFreqPhrases.map(([phrase, count], i) => (
              <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300">"{phrase}" — {count} times</p>
            ))}
          </div>
        </div>
      )}

      {/* Before & After Comparison */}
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <h2 className="font-display text-xl text-foreground mb-4">Polish Results</h2>
        {!polishResults ? (
          <p className="text-sm text-muted-foreground">Run "Polish Manuscript" to see before/after comparison.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Metric</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Before</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">After</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow metric="Banned Words" before={polishResults.before.bannedWords} after={polishResults.after.bannedWords} />
                  <ComparisonRow metric="Voice Patterns" before={polishResults.before.voiceWas} after={polishResults.after.voiceWas} />
                  <ComparisonRow metric="Repetition" before={polishResults.before.repetitionTotal} after={polishResults.after.repetitionTotal} />
                  <ComparisonRow metric="Cap Errors" before={polishResults.before.capErrors} after={polishResults.after.capErrors} />
                  <ComparisonRow metric="Scaffolds" before={polishResults.before.scaffolds} after={polishResults.after.scaffolds} />
                  <ComparisonRow metric="Clean Score" before={polishResults.before.cleanScore} after={polishResults.after.cleanScore} />
                </tbody>
              </table>
            </div>
            {polishResults.changes?.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  View all changes ({polishResults.changes.length})
                </summary>
                <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs text-muted-foreground">
                  {polishResults.changes.map((change, i) => (
                    <li key={i} className="leading-5">{change}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Polished at {new Date(polishResults.timestamp).toLocaleString()}
            </p>
          </>
        )}
      </div>

      {/* Editorial Assessment */}
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <h2 className="font-display text-xl text-foreground mb-3">Editorial Assessment</h2>
        {!critique ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Get an AI-generated editorial critique — marketability, audience reception, prose quality, and commercial potential.
            </p>
            <Button onClick={handleCritique} disabled={isBusy || critiqueLoading || chapters.length < 1} className="rounded-full gap-2">
              {critiqueLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><FileText className="h-3.5 w-3.5" /> 📝 Generate Editorial Critique</>
              )}
            </Button>
          </>
        ) : (
          <>
            {critiqueRating !== null && (
              <div className="text-center my-4">
                <div className="text-[32px] tracking-wider leading-none">
                  {[1, 2, 3, 4, 5].map((star) => {
                    if (critiqueRating >= star) return <span key={star} style={{ color: '#DAA520' }}>★</span>;
                    else if (critiqueRating >= star - 0.5) return (
                      <span key={star} style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ color: '#ccc' }}>★</span>
                        <span style={{ position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden', color: '#DAA520' }}>★</span>
                      </span>
                    );
                    return <span key={star} style={{ color: '#ccc' }}>★</span>;
                  })}
                </div>
                <div className="text-lg font-semibold mt-1 text-muted-foreground">{critiqueRating} / 5</div>
              </div>
            )}
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none font-serif leading-7">
              <ReactMarkdown>{critique}</ReactMarkdown>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setCritique(null); setCritiqueRating(null); }} className="mt-4 rounded-full text-xs">
              Regenerate
            </Button>
          </>
        )}
      </div>

      {/* Export Buttons */}
      {stats && (
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm flex flex-wrap justify-center gap-3">
          <Button onClick={handleExportReport} disabled={isBusy} variant="outline" className="rounded-full gap-2">
            <Download className="h-4 w-4" /> 📄 Export Quality Report (PDF)
          </Button>
          <Button onClick={handleExportPolished} disabled={isBusy} variant="outline" className="rounded-full gap-2">
            <FileText className="h-4 w-4" /> 📄 Export Polished Copy
          </Button>
        </div>
      )}
    </div>
  );
}