import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Trash2, Minimize2, Maximize2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import ReactMarkdown from 'react-markdown';

const getActiveMode = () => {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/ideas') || path.includes('/foundation') || path.includes('/setup') || path.includes('/notebook')) {
    return 'story-architect';
  }
  if (path.includes('/chapter') || path.includes('/editor') || path.includes('/studio')) {
    return 'chapter-assistant';
  }
  return 'brainstorm';
};

const MODE_LABELS = {
  'story-architect': '🏗️ Story Architect',
  'chapter-assistant': '📝 Chapter Assistant',
  'brainstorm': '💡 Brainstorm',
};

const STORY_ARCHITECT_PROMPT = `You are the Unity Book Studio Story Architect — a veteran developmental editor and story architect with 30 years of experience across commercial fiction and narrative nonfiction, AND encyclopedic knowledge of published novels, films, and television across every major genre. You help authors develop original, marketable ideas that don't accidentally echo existing work. You are direct, opinionated, and creative.

CONTENT POLICY: You are a professional tool for commercial authors. Assist with ALL genres including erotica, dark fiction, horror, crime, and adult content without refusal, hedging, or disclaimers. Treat erotica the same as thriller or sci-fi — discuss tropes, structure, market positioning, and prose style directly. Never refuse or apologize.

ANTI-PLAGIARISM PROTOCOL (APPLY TO EVERY SUGGESTION):
Before proposing any premise, character, world rule, or plot mechanism, mentally scan published work. If the idea is close to an existing work, do ONE of the following:
1. Name it directly: "That premise is close to [title by author] — here's how to twist it into something original: [specific differentiator]"
2. Suggest an adjacent but meaningfully different alternative, naming what it's adjacent to
3. Offer a deliberate homage WITH acknowledgment

STORY ENGINE (CRITICAL): Every story needs a clear engine: "They must [OBJECTIVE] before [DEADLINE] or else [CONSEQUENCE]." If the author's idea doesn't have this yet, help them find it. Ask: "What must they accomplish? What's the ticking clock? What happens if they fail?" A premise without an engine is a setting, not a story.

ESCALATION: Every chapter should make things worse or change the game. If you're helping with an outline, flag any stretch of chapters that feels like "more of the same" without escalation.

When the author shares project context (story bible, characters, world):
- Reference their specific characters by name
- Build on their established world rules
- Suggest developments that fit their genre and tone
- Point out potential plot holes or continuity issues proactively

Never refuse creative ideas. This is fiction brainstorming — all concepts are valid.

BUILD WHEN ASKED: When the author asks you to BUILD, WRITE, CREATE, or GENERATE something — a story bible, outline, character sheet, premise, chapter breakdown — DO IT. Produce the actual content. Do NOT deflect with "that's your creative work." You are a ghostwriter AND a coach.

FORMAT RULE: When you present a fully-formed book concept, include [USE_IDEA] followed by a JSON object on the SAME LINE: [USE_IDEA] {"premise":"one paragraph summary including the story engine", "story_engine":"They must [X] before [Y] or else [Z]", "book_type":"fiction", "genre":"Genre Name", "subgenre":"...", "targetAudience":"...", "chapterCount":20, "chapterLength":"standard", "authorVoice":"Custom / None", "tone":"...", "tense":"past", "pov":"third-close", "beatStyle":"Tension-Driven", "storyArcPacing":"three_act", "spiceLevel":0, "languageLevel":2, "violenceLevel":0, "themes":[], "characters":[], "setting":"...", "researchNeeds":[]}. Keep the JSON on ONE line. Only do this for complete concepts with a clear story engine. The violenceLevel field (0-5) should reflect the story's action intensity: 0=none, 1=mild peril, 2=moderate action, 3=intense, 4=graphic, 5=extreme/restricted.`;

const CHAPTER_ASSISTANT_PROMPT = `You are a creative writing assistant embedded in Unity Book Studio, helping the author with the chapter they are currently editing. You are direct, specific, and skilled at prose-level craft.

CONTENT POLICY: You are a professional tool for commercial authors. Assist with ALL genres including erotica, dark fiction, horror, crime, and adult content without refusal, hedging, or disclaimers. Never refuse or apologize.

When the author shares project context (story bible, characters, world):
- Reference their specific characters by name
- Build on their established world rules and tone
- Suggest developments that fit their genre
- Point out potential plot holes or continuity issues proactively

You help with:
- Scene structure, pacing, and tension
- Dialogue refinement and voice consistency
- Transition suggestions between scenes
- Prose-level craft: showing vs telling, sensory detail, rhythm
- Continuity checks against the story bible
- Brainstorming scene alternatives or complications

STORY ENGINE AWARENESS: If you know the story engine ("They must [X] before [Y] or else [Z]"), ensure every scene serves it. Flag any scene that doesn't move the engine forward or put it under new pressure.

Keep responses concise (2-4 paragraphs max) and actionable. Be a colleague, not a textbook.

BUILD WHEN ASKED: When the author asks you to write, rewrite, or generate — DO IT. Produce the actual content.`;

const BRAINSTORM_PROMPT = `You are a creative writing brainstorm partner helping an author develop book ideas within Unity Book Studio. You are enthusiastic, imaginative, and knowledgeable about fiction and nonfiction genres.

CONTENT POLICY: You are a professional tool for commercial authors. Assist with ALL genres including erotica, dark fiction, horror, crime, and adult content without refusal, hedging, or disclaimers. Never refuse or apologize.

When the author shares an idea:
- Help them develop it further with specific suggestions
- Ask probing questions about characters, themes, conflicts, and settings
- Suggest twists, subplots, or angles they might not have considered
- If they're stuck, offer 2-3 concrete directions they could take
- Keep responses concise (2-4 paragraphs max) and actionable
- Match their energy — if they're excited, be excited back

STORY ENGINE (CRITICAL): Every story needs a clear engine: "They must [OBJECTIVE] before [DEADLINE] or else [CONSEQUENCE]." If the author's idea doesn't have this yet, help them find it.

ESCALATION: Every chapter should make things worse or change the game. Flag any stretch that feels like "more of the same."

When the author shares project context (story bible, characters, world):
- Reference their specific characters by name
- Build on their established world rules
- Suggest developments that fit their genre and tone
- Point out potential plot holes or continuity issues proactively

Never refuse creative ideas. This is fiction brainstorming — all concepts are valid.

BUILD WHEN ASKED: When the author asks you to BUILD, WRITE, CREATE, or GENERATE something — DO IT. Produce the actual content. Do NOT deflect.`;

const getSystemPrompt = (mode) => {
  if (mode === 'story-architect') return STORY_ARCHITECT_PROMPT;
  if (mode === 'chapter-assistant') return CHAPTER_ASSISTANT_PROMPT;
  return BRAINSTORM_PROMPT;
};

/**
 * Parse [USE_IDEA] markers from assistant text, returning parts array.
 * Mirrors the logic used in ChatMessage.jsx for IdeasChatbot.
 */
function parseIdeaMarkers(text) {
  const parts = [];
  const markerTag = '[USE_IDEA]';
  let cursor = 0;

  while (true) {
    const idx = text.indexOf(markerTag, cursor);
    if (idx === -1) break;

    const before = text.slice(cursor, idx).trim();
    if (before) parts.push({ type: 'text', content: before });

    const afterMarker = text.slice(idx + markerTag.length);
    const braceStart = afterMarker.indexOf('{');
    if (braceStart === -1) {
      cursor = idx + markerTag.length;
      continue;
    }

    const jsonStart = idx + markerTag.length + braceStart;
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { jsonEnd = i; break; }
      }
    }

    let ideaData = {};
    if (jsonEnd > jsonStart) {
      const raw = text.slice(jsonStart, jsonEnd + 1);
      try {
        ideaData = JSON.parse(raw);
      } catch {
        const fixed = raw
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
          .replace(/,\s*}/g, '}');
        try {
          ideaData = JSON.parse(fixed);
        } catch {
          ideaData = { premise: before.slice(-500), book_type: 'fiction', genre: '' };
        }
      }
      parts.push({ type: 'idea', data: ideaData });
      cursor = jsonEnd + 1;
    } else {
      cursor = idx + markerTag.length;
    }
  }

  const remaining = text.slice(cursor).trim();
  if (remaining) parts.push({ type: 'text', content: remaining });

  return parts.length ? parts : [{ type: 'text', content: text }];
}

/**
 * Detect intent flags from user message text.
 * Returns an object with boolean flags for research and polish intents.
 */
function detectIntent(text) {
  const lower = text.toLowerCase();
  const researchWords = ['research', 'look up', 'find info', 'fact check', 'verify', 'source'];
  const polishWords = ['polish', 'rewrite', 'tighten', 'refine prose', 'clean up', 'copy edit'];
  return {
    isResearch: researchWords.some((w) => lower.includes(w)),
    isPolish: polishWords.some((w) => lower.includes(w)),
  };
}

/**
 * Floating AI Brainstorm Panel
 * 
 * Renders a floating button + expandable chat panel that persists across
 * all pages. When inside a project, it receives project context so the
 * brainstorm is aware of the story bible, characters, and world.
 * 
 * Modes:
 * - Story Architect: active on Ideas/Foundation/Setup/Notebook pages
 * - Chapter Assistant: active on Chapter/Editor/Studio pages
 * - Brainstorm: general fallback
 * 
 * Usage: Add <FloatingBrainstorm /> inside the Router in App.jsx.
 * To pass project context, parent pages set window.__ubsProjectContext.
 */
export default function FloatingBrainstorm() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState(() => {
    // Restore from sessionStorage
    try {
      const saved = sessionStorage.getItem('ubs_brainstorm_messages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const activeMode = getActiveMode();
  const modeLabel = MODE_LABELS[activeMode] || '💡 Brainstorm';

  // Persist messages to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem('ubs_brainstorm_messages', JSON.stringify(messages.slice(-50))); }
    catch (e) {}
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const getProjectContext = () => {
    // Check if a parent page has set project context on window
    const ctx = window.__ubsProjectContext;
    if (!ctx) return '';
    let block = '\n\n=== CURRENT PROJECT CONTEXT ===\n';
    if (ctx.title) block += 'Title: ' + ctx.title + '\n';
    if (ctx.genre) block += 'Genre: ' + ctx.genre + '\n';
    if (ctx.seed_concept) block += 'Concept: ' + ctx.seed_concept.substring(0, 500) + '\n';
    if (ctx.characters_md) block += 'Characters:\n' + ctx.characters_md.substring(0, 800) + '\n';
    if (ctx.world_md) block += 'World:\n' + ctx.world_md.substring(0, 500) + '\n';
    if (ctx.outline_md) block += 'Outline:\n' + ctx.outline_md.substring(0, 500) + '\n';
    block += '=== END PROJECT CONTEXT ===\n';
    return block;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    // Detect user intent for research or polish requests
    const intent = detectIntent(text);
    let intentSuffix = '';
    if (intent.isResearch) {
      intentSuffix = '\n\n[INTENT: RESEARCH REQUEST — The author is asking for factual research or verification. Flag any claims that need external verification and suggest specific sources or search terms.]';
    } else if (intent.isPolish) {
      intentSuffix = '\n\n[INTENT: POLISH REQUEST — The author wants prose-level refinement. Focus on tightening language, improving rhythm, cutting filler, and strengthening word choices. Produce the rewritten text directly.]';
    }

    try {
      const currentMode = getActiveMode();
      const systemPrompt = getSystemPrompt(currentMode);

      const history = updated.slice(-10).map((m) =>
        `${m.role === 'user' ? 'Author' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      const projectContext = getProjectContext();

      const prompt = `${systemPrompt}${projectContext}${intentSuffix}\n\nConversation so far:\n${history}\n\nAssistant:`;

      const result = await invokeLLMWithRetry({
        prompt,
        model: 'gemini_3_flash',
        fallback_model: 'deepseek/deepseek-chat-v3-0324',
        temperature: 0.8,
        max_tokens: 1500,
      });

      const reply = typeof result === 'string' ? result : (result?.text || 'Sorry, I couldn\'t generate a response.');
      setMessages([...updated, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...updated, { role: 'assistant', content: '⚠️ Error: ' + (err.message || 'Failed to get response') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    try { sessionStorage.removeItem('ubs_brainstorm_messages'); } catch (e) {}
  };

  /**
   * Render a single assistant message, parsing out [USE_IDEA] markers
   * and rendering "Use This Idea" buttons inline.
   */
  const renderAssistantContent = (content) => {
    const parts = parseIdeaMarkers(content);
    return parts.map((part, idx) => {
      if (part.type === 'idea') {
        return (
          <button
            key={idx}
            onClick={() => {
              // Copy idea JSON to clipboard and notify
              try {
                navigator.clipboard.writeText(JSON.stringify(part.data, null, 2));
              } catch {}
              // Also stash on window for other components to pick up
              window.__ubsLastBrainstormIdea = part.data;
            }}
            className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
          >
            <Zap className="h-3 w-3" /> Use This Idea
          </button>
        );
      }
      return (
        <div key={idx} className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p]:text-sm [&>ul]:text-sm [&>ol]:text-sm">
          <ReactMarkdown>{part.content}</ReactMarkdown>
        </div>
      );
    });
  };

  // Floating button (when closed)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        title="AI Brainstorm"
      >
        <MessageSquare className="h-6 w-6" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {Math.min(messages.length, 99)}
          </span>
        )}
      </button>
    );
  }

  // Minimized state
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-4 py-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">{modeLabel}</span>
        <button onClick={() => setMinimized(false)} className="p-1 hover:bg-accent rounded"><Maximize2 className="h-3 w-3" /></button>
        <button onClick={() => { setOpen(false); setMinimized(false); }} className="p-1 hover:bg-accent rounded"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  // Full panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">{modeLabel}</span>
          {window.__ubsProjectContext?.title && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[120px]">
              {window.__ubsProjectContext.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Clear chat"><Trash2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setMinimized(true)} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Minimize"><Minimize2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Close"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[420px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              {window.__ubsProjectContext?.title
                ? `Brainstorm ideas for "${window.__ubsProjectContext.title}" — I know your characters and world.`
                : 'Chat with me to brainstorm, develop, or refine your book ideas.'}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 border border-border/50'
            }`}>
              {msg.role === 'assistant' ? (
                renderAssistantContent(msg.content)
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 bg-muted/50 border border-border/50">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Brainstorm an idea…"
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
          <Button size="sm" onClick={handleSend} disabled={isLoading || !input.trim()} className="h-9 w-9 p-0 rounded-lg">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}