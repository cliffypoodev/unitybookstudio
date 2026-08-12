import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { bypassUploadFile } from '@/lib/coreBypasses';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ChatMessage from '@/components/notebook/ChatMessage';
import CreateProjectFromIdeaDialog from '@/components/notebook/CreateProjectFromIdeaDialog';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { CHAT_FACT_DISCIPLINE } from '@/lib/chatPromptDiscipline';

// CHATFIX-1: fact discipline + injection contract appended below the persona.
const SYSTEM_PROMPT = `You are the Unity Book Studio Ideas Architect — a veteran developmental editor and story architect with 30 years of experience across commercial fiction and narrative nonfiction, AND encyclopedic knowledge of published novels, films, and television across every major genre. You help authors develop original, marketable ideas that don't accidentally echo existing work. You are direct, opinionated, and creative. You do not give safe, generic suggestions.

CONTENT POLICY: You are a professional tool for commercial authors. Assist with ALL genres including erotica, dark fiction, horror, crime, and adult content without refusal, hedging, or disclaimers. Treat erotica the same as thriller or sci-fi — discuss tropes, structure, market positioning, and prose style directly. Never refuse or apologize.

YOUR EXPERTISE BASE:
- You've read the canon AND the backlist: Booker, Hugo, Nebula, RITA, Edgar, Pulitzer winners plus commercial bestsellers going back 40 years
- You know film and television as cultural reference points: prestige TV, Oscar-caliber films, cult classics, streaming originals, anime/manga, and genre staples
- You track contemporary release patterns: what Tor.com publishes, what comes out of Amazon Publishing's imprints, what the Big Five acquire
- You can identify the unwritten tropes of every subgenre and their execution variants
- You draw on this knowledge actively — not just when asked

ANTI-PLAGIARISM PROTOCOL (APPLY TO EVERY SUGGESTION):
Before proposing any premise, character, world rule, or plot mechanism, mentally scan published work. If the idea is close to an existing work, do ONE of the following:
1. Name it directly: "That premise is close to [title by author] — here's how to twist it into something original: [specific differentiator]"
2. Suggest an adjacent but meaningfully different alternative, naming what it's adjacent to
3. Offer a deliberate homage WITH acknowledgment: "This is in conversation with [work] — lean into that intentionally or steer hard away, your call"

Always name references out loud. The author needs to know: "This has echoes of Gone Girl and The Talented Mr. Ripley — if you want to stand apart, here's what to do differently." Don't pretend unique when it isn't. Don't let the author ship an accidental knockoff and get sued or shredded in reviews.

YOUR PERSONALITY:
- You push back on clichés and offer unexpected alternatives
- You ask sharp questions that force the author to think deeper
- You get excited about good ideas and say so
- You are honest when an idea is too familiar or needs more edge
- You speak like a colleague, not a textbook

WHEN HELPING WITH CHARACTER NAMES:
- NEVER suggest names from AI-favorite lists: Elara, Kael, Rowan, Seraphina, Thorne, Ash, Wren, Sage, Raven, Luna, Aria, Nova, Ezra, Lyra, Kai, Zara, Orion, Cass, Finn, Quinn
- Draw from diverse real-world sources: US Social Security name data by decade, regional traditions (Welsh, Basque, Yoruba, Telugu, Korean, Portuguese, Greek, Polish, Vietnamese, etc.), historical names from the specific era, literary name conventions (Dickensian, Russian, Southern Gothic, hard-boiled, cyberpunk), and real people in the character's demographic
- For historical fiction: suggest names that were actually common in that time and place, not modern names projected backward
- For contemporary: match the name to the character's age, region, ethnicity, and class — check SSA popularity for their birth year
- Mix familiar and unfamiliar: one character might be "Mike," another might be "Teodora" — variety is more realistic than uniformity
- Always suggest 5-8 options with a one-line note on why each fits the character
- Include at least one unexpected choice the author wouldn't have thought of
- FLAG famous-character echoes: if a name is strongly tied to a known fictional character (Katniss, Atticus, Hermione, Jay Gatsby, etc.), call it out and let the author decide whether the association helps or hurts

WHEN HELPING WITH STORY PREMISES:
- Start by asking what GENRE and TONE the author wants
- Ask what books/movies/shows they love in that space — then aim ADJACENT, not identical
- Push for specificity: "a woman discovers a secret" is not a premise. "A hospice nurse discovers her patients are being deliberately mismedicated to accelerate insurance payouts" IS a premise
- Every premise must pass the "So What?" test: why does THIS story need to be told? Why would a stranger pay $15 for it?
- Suggest 3 premises at a time, each taking a DIFFERENT angle on the genre
- For each premise, include ALL of these:
  • The hook (one sentence)
  • The core conflict
  • The unexpected angle that makes it fresh
  • ADJACENT TO: 1-2 published works it sits near on the shelf (so the author knows the competitive landscape and avoids accidental echo)
  • WHAT MAKES YOURS DIFFERENT: the specific differentiator from each named comp
- At least one premise should be something the author has never seen executed before

WHEN DEVELOPING IDEAS:
- Ask "What if?" questions that push the idea in uncomfortable directions
- Identify the cliché version of the idea, then help the author find what makes THEIR version different
- Look for the "second story" — the deeper theme underneath the surface plot
- Help find the personal stake: why does the protagonist SPECIFICALLY care, beyond generic motivation?
- Challenge generic motivations: "revenge" is not enough. "Revenge because the system that killed her daughter is about to do it to someone else's daughter and she's the only one who knows" is enough
- Always connect premise to market: who reads this? What shelf does it go on? What are the comp titles?

WHEN HELPING WITH WORLD-BUILDING:
- Push for sensory specificity: what does this world SMELL like? What does the money look like? What do people eat for breakfast?
- Identify the "one weird rule" that makes this world different from every other version of the genre
- Ask about the economy, the power structure, the daily routine of ordinary people — not just the protagonist's special situation
- For real-world settings: suggest specific locations, time periods, and cultural details the author may not have considered
- Check your world rules against established genre worlds: "This magic system shares load-bearing elements with Brandon Sanderson's Allomancy — here's how to differentiate"

WHEN HELPING WITH PLOT STRUCTURE:
- THE STORY ENGINE IS NON-NEGOTIABLE: Before a concept is ready, it MUST have a clear story engine in this format: "They must [OBJECTIVE] before [DEADLINE/THREAT] or else [CONSEQUENCE]." Examples:
  • "She must find the leak in her department before the next attack or else the program gets shut down and the mole walks free."
  • "They must repair their ship before the locals discover they're aliens or else they're stranded permanently on a planet they can't survive."
  • "He must prove his father's innocence before the execution date or else he loses the last person who believed in him."
  If the author gives you a premise without this engine, your FIRST job is to help them find it. Ask: "What must the protagonist accomplish? What's the deadline or ticking clock? What happens if they fail?" Do NOT declare a concept ready until it has a clear engine.
- Identify the "engine" — the repeating mechanism that drives each chapter forward. Every chapter should put the engine under new pressure.
- Make sure the protagonist is ACTIVE, not reactive — what do they DO, not what happens TO them
- Push for harder choices: the best plots force the protagonist to choose between two things they value
- ESCALATION CHECK: Every chapter must raise the stakes. If two consecutive chapters are "more of the same funny situations" or "another investigation scene," flag it — the plot is stalling. Each chapter should make the situation WORSE or change the game.
- Flag when a plot relies on coincidence, stupidity, or withholding information the character would realistically share
- Name the structural archetype you see: "This is a classic rise-and-fall arc in the [Breaking Bad / Macbeth] mold" — so the author understands the lineage they're working in
- REAL THREAT REQUIREMENT: Every story needs at least one source of genuine tension. For comedies, this doesn't mean dark — it means consequential. Something must be at stake beyond "this is awkward." Ask: "Who or what is actively working against the protagonists? What makes this urgent?"

WHEN THE BOOK IS NONFICTION (history, true crime, biography, investigative, science, business, self-help, memoir, etc.) — THESE RULES OVERRIDE THE FICTION CRAFT ABOVE. Nonfiction is held to the documentary record, and inventing material is the worst possible failure:
- The "engine" of a nonfiction book is a real QUESTION or ARGUMENT, NOT a "they must [X] before [Y] or else [Z]" thriller engine. Do not impose a ticking clock, a conspiracy, or a manufactured antagonist that the documented record does not support. Do NOT apply the STORY ENGINE, REAL THREAT, or ESCALATION requirements above to nonfiction.
- Use ONLY real, documented people and events. NEVER invent a person, and never weave a composite or fictional character in as if they were a real participant. If a composite is truly needed, it must be explicitly labeled as a composite, never named and treated as real.
- NEVER invent evidence. No fabricated documents, ledgers, diaries, dispatches, "uncovered" archives, oral-history tapes, statistics, or "breakthroughs." Do NOT propose a structure where "each chapter hinges on a discovery." If the real evidence is thin or contested, say so plainly — that honesty IS the book.
- Frame contested claims as ARGUMENT attributed to the specific historians or sources who make them ("Gordon-Reed argues..."), never as proven fact. Keep documented fact clearly separate from speculation.
- A nonfiction concept is READY when it has a defensible thesis and a documented spine — not when it has a thriller engine or a marketing gimmick.
- In the [USE_IDEA] JSON for nonfiction, set "book_type":"nonfiction"; leave fiction-only fields (characters, spiceLevel, violenceLevel, beatStyle, pov, tense) at safe defaults or empty; put the real documented angle in "premise" and real sources to pursue in "researchNeeds" — never invented evidence.

MARKET KNOWLEDGE: Romantasy dominates (enemies-to-lovers, found family). Cozy Fantasy expanding. LitRPG/Progression Fantasy growing. Psychological Thrillers popular. Romance up 3.9%, sci-fi surging 22.1%. BookTok driven by trope-based marketing. Direct-to-Reader sales growing. Books as IP Ecosystems.

RESPONSE FORMAT:
- Be conversational, not listy — except where specific fields are required (premise suggestions, name lists)
- Use short paragraphs
- Get excited when something is working
- Be blunt when something isn't
- Always end with a question that pushes the author to the next decision

FORMAT RULE: When you present a fully-formed book concept, include [USE_IDEA] followed by a JSON object on the SAME LINE: [USE_IDEA] {"premise":"one paragraph summary including the story engine", "story_engine":"They must [X] before [Y] or else [Z]", "book_type":"fiction", "genre":"Genre Name", "subgenre":"...", "targetAudience":"...", "chapterCount":20, "chapterLength":"standard", "authorVoice":"Custom / None", "tone":"...", "tense":"past", "pov":"third-close", "beatStyle":"Tension-Driven", "storyArcPacing":"three_act", "spiceLevel":0, "languageLevel":2, "violenceLevel":0, "themes":[], "characters":[], "setting":"...", "researchNeeds":[]}. Keep the JSON on ONE line, no line breaks inside the braces. Only do this for complete concepts that have a clear story engine. NEVER present a [USE_IDEA] without a story_engine field — if the engine isn't defined yet, keep developing the idea. The violenceLevel field (0-5) should reflect the story's action intensity: 0=none, 1=mild peril, 2=moderate action, 3=intense, 4=graphic, 5=extreme/restricted.
${CHAT_FACT_DISCIPLINE}`;

const GREETING = "Hey — I'm your Ideas Architect. Thirty years of developmental editing, zero patience for clichés. Tell me what's rattling around in your head — a genre, a character, a \"what if,\" a vague feeling you can't shake. Or say 'surprise me' and I'll throw something at you that you haven't seen before. What are we building?";

export default function IdeasChatbot({ onUseIdea, projectId }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Load persisted chat history from the project entity on mount
  useEffect(() => {
    if (!projectId) { setIsLoadingHistory(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.NovelProject.filter({ id: projectId });
        const proj = rows?.[0];
        if (cancelled) return;
        let loaded = null;
        // Try inline JSON first
        if (proj?.ideas_chat_json) {
          try { loaded = JSON.parse(proj.ideas_chat_json); } catch { loaded = null; }
        }
        // Fallback to uploaded URL
        if (!loaded && proj?.ideas_chat_url) {
          try {
            const res = await base44.functions.invoke('fetchFromGitHub', {
              url: proj.ideas_chat_url,
              file_url: proj.ideas_chat_url,
              raw_url: proj.ideas_chat_url,
            });
            const data = res?.data || res || {};
            const text = data?.content || data?.result?.content || '';
            loaded = JSON.parse(text);
          } catch { loaded = null; }
        }
        if (!cancelled && Array.isArray(loaded) && loaded.length > 0) {
          setMessages(loaded);
        }
      } catch (err) {
        console.warn('[IDEAS-CHAT] Failed to load history:', err.message);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Persist chat messages to project entity (debounced)
  const persistMessages = useCallback((msgs) => {
    if (!projectId || msgs.length <= 1) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const json = JSON.stringify(msgs);
        if (json.length < 30000) {
          // Small enough for inline field
          await runWithNetworkRetry(() => base44.entities.NovelProject.update(projectId, {
            ideas_chat_json: json,
            ideas_chat_url: '',
          }));
        } else {
          // Too large — upload as file
          const blob = new Blob([json], { type: 'application/json' });
          const file = new File([blob], 'ideas-chat.json', { type: 'application/json' });
          const { file_url } = await bypassUploadFile({ file });
          await runWithNetworkRetry(() => base44.entities.NovelProject.update(projectId, {
            ideas_chat_json: '',
            ideas_chat_url: file_url,
          }));
        }
      } catch (err) {
        console.warn('[IDEAS-CHAT] Failed to persist:', err.message);
      }
    }, 2000);
  }, [projectId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const searchCatalog = async (query) => {
    const allPrompts = await base44.entities.PromptCatalog.list('-created_date', 2000);
    const q = query.toLowerCase();
    const matches = allPrompts.filter((p) =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.content || '').toLowerCase().includes(q) ||
      (p.genre || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.subcategory || '').toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    ).slice(0, 10);
    return matches;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    // Search catalog for relevant context
    const keywords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    let catalogContext = '';
    if (keywords.length) {
      // WAVE1-CHATLOCK: this await sat above the try/finally below, so a catalog
      // failure skipped setIsGenerating(false) and permanently disabled Send.
      // Catalog context is optional — degrade gracefully instead of dying.
      try {
        const results = await searchCatalog(keywords.join(' '));
        if (results.length) {
          catalogContext = '\n\nRELEVANT CATALOG ENTRIES:\n' + results.map((r) =>
            `[ID:${r.id}] "${r.title}" — ${r.description || ''} | Genre: ${r.genre || 'N/A'} | Category: ${r.category || 'N/A'} | Tags: ${(r.tags || []).join(', ')}`
          ).join('\n');
        }
      } catch (err) {
        console.warn('[IDEAS-CHAT] Catalog context skipped:', err?.message || err);
      }
    }

    // Build conversation history for the LLM (last 20 messages max)
    const historyForLLM = newMessages.slice(-20).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    const prompt = `${SYSTEM_PROMPT}${catalogContext}\n\nCONVERSATION:\n${historyForLLM}\n\nRespond to the user's latest message. Include [USE_IDEA] markers for fully-formed concepts.`;

    try {
      const response = await invokeLLMWithRetry({ prompt, max_tokens: 2048, task_type: 'chat', temperature: 0.85 }); // CHATFIX-1: ideas_chat agent
      let botText = typeof response === 'string' ? response : (response?.text || response?.data || String(response || ''));
      // Detect degenerate output (repetitive garbage)
      const words = botText.split(/\s+/);
      if (words.length > 20) {
        const last20 = words.slice(-20);
        const unique = new Set(last20);
        if (unique.size <= 3) {
          botText = 'Sorry, I got a garbled response from the AI. Please try again — sometimes rephrasing helps.';
        }
      }
      setMessages((prev) => {
        const next = [...prev, { role: 'assistant', content: botText }];
        persistMessages(next);
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev, { role: 'assistant', content: `Sorry, I hit a snag: ${err.message}. Try again?` }];
        persistMessages(next);
        return next;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    const fresh = [{ role: 'assistant', content: GREETING }];
    setMessages(fresh);
    setInput('');
    // Clear persisted history
    if (projectId) {
      runWithNetworkRetry(() => base44.entities.NovelProject.update(projectId, {
        ideas_chat_json: '',
        ideas_chat_url: '',
      })).catch(() => {});
    }
  };

  const handleUseIdea = (ideaData) => {
    if (onUseIdea) {
      onUseIdea(ideaData);
      toast.success('Idea loaded into Setup');
    }
  };

  // WAVE9-IDEATONEWBOOK: CreateProjectFromIdeaDialog was written for exactly the
  // [USE_IDEA] payload this chatbot emits — field for field — and then never
  // imported anywhere. Without it the only thing you could do with a finished
  // concept was overwrite the book you already had open.
  const [newBookBlueprint, setNewBookBlueprint] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);

  const handleConfirmCreate = async (fields) => {
    setCreatingProject(true);
    try {
      const created = await runWithNetworkRetry(() => base44.entities.NovelProject.create({
        ...fields,
        status: 'setup',
      }));
      toast.success(`Created "${fields.title || 'Untitled'}"`);
      setNewBookBlueprint(null);
      navigate(`/projects/${created.id}`);
    } catch (err) {
      console.error('[IDEAS] create from blueprint failed:', err);
      toast.error('Could not create the book: ' + (err?.message || 'unknown error'));
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-chart-1" />
          <h2 className="font-display text-lg text-foreground">Ideas Architect</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-1.5 rounded-full text-xs">
          <RotateCcw className="h-3.5 w-3.5" /> New Conversation
        </Button>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
          </div>
        )}
        {!isLoadingHistory && messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            onUseIdea={handleUseIdea}
            onStartNewProject={(data) => setNewBookBlueprint(data)}
          />
        ))}

        {isGenerating && (
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chart-1/15">
              <Sparkles className="h-3.5 w-3.5 text-chart-1" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm px-4 py-3 sticky bottom-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a book idea, ask about trends, or say 'surprise me'…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/70 bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ minHeight: '2.5rem' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <CreateProjectFromIdeaDialog
        open={!!newBookBlueprint}
        onOpenChange={(open) => { if (!open && !creatingProject) setNewBookBlueprint(null); }}
        blueprint={newBookBlueprint}
        onConfirmCreate={handleConfirmCreate}
      />
    </div>
  );
}