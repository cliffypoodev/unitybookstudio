import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const SYSTEM_CONTEXT = `You are a creative writing brainstorm partner helping an author develop book ideas. You are enthusiastic, imaginative, and knowledgeable about fiction and nonfiction genres. When the author shares an idea:
- Help them develop it further with specific suggestions
- Ask probing questions about characters, themes, conflicts, and settings
- Suggest twists, subplots, or angles they might not have considered
- If they're stuck, offer 2-3 concrete directions they could take
- Keep responses concise (2-4 paragraphs max) and actionable
- Match their energy — if they're excited, be excited back
Never refuse creative ideas. This is fiction brainstorming — all concepts are valid.`;

export default function IdeasChat({ activePrompt }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // When a prompt is selected, seed the conversation
  useEffect(() => {
    if (activePrompt?.content && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `I see you're looking at **"${activePrompt.title}"**. Want me to help you develop this idea further, put a unique spin on it, or brainstorm something inspired by it?`
      }]);
    }
  }, [activePrompt?.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = updated.slice(-10).map((m) => `${m.role === 'user' ? 'Author' : 'Brainstorm Partner'}: ${m.content}`).join('\n\n');
      const promptContext = activePrompt?.content ? `\n\nCurrent prompt being discussed: "${activePrompt.title}" — ${activePrompt.content.slice(0, 500)}` : '';

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${SYSTEM_CONTEXT}${promptContext}\n\nConversation so far:\n${history}\n\nRespond to the author's latest message. Be specific, creative, and helpful.`,
      });

      const text = typeof response === 'string' ? response : response?.data || response?.response || '';
      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong — try again.' }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-3 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center pt-12 px-4">
            <p className="text-sm text-muted-foreground leading-7">
              Chat with me to brainstorm, develop, or refine your book ideas. Ask anything!
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {['Give me a thriller premise', 'Help me build a character', 'I need a plot twist'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border/70 bg-white/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/80 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7 ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/60 border border-border/50 text-foreground'
            }`}>
              {msg.role === 'user' ? (
                <p>{msg.content}</p>
              ) : (
                <ReactMarkdown
                  className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  components={{
                    p: ({ children }) => <p className="my-1 leading-7">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/60 border border-border/50 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/50 pt-3 mt-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Brainstorm an idea…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/70 bg-white/50 px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ maxHeight: '120px', minHeight: '38px' }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading} className="shrink-0 rounded-xl h-[38px] w-[38px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={handleClear} className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <Trash2 className="h-3 w-3" /> Clear chat
          </button>
        )}
      </div>
    </div>
  );
}