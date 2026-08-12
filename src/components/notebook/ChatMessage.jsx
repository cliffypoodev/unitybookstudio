import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, User, Zap, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

function parseIdeaMarkers(text) {
  // Split text by [USE_IDEA] markers and extract the JSON that follows
  const parts = [];
  const markerTag = '[USE_IDEA]';
  let cursor = 0;

  while (true) {
    const idx = text.indexOf(markerTag, cursor);
    if (idx === -1) break;

    const before = text.slice(cursor, idx).trim();
    if (before) parts.push({ type: 'text', content: before });

    // Find the opening brace after the marker
    const afterMarker = text.slice(idx + markerTag.length);
    const braceStart = afterMarker.indexOf('{');
    if (braceStart === -1) {
      cursor = idx + markerTag.length;
      continue;
    }

    // Balanced-brace extraction to handle nested quotes / multiline
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
        // Try fixing smart quotes and other common issues
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

export default function ChatMessage({ message, onUseIdea, onStartNewProject }) {
  const isUser = message.role === 'user';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const parts = isUser ? [{ type: 'text', content: message.content }] : parseIdeaMarkers(message.content);

  return (
    <div
      className={`flex items-start gap-3 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chart-1/15">
          <Sparkles className="h-3.5 w-3.5 text-chart-1" />
        </div>
      )}

      {/* Bubble */}
      <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        {parts.map((part, idx) => {
          if (part.type === 'idea') {
            // WAVE9-IDEATONEWBOOK: "Use This Idea" overwrites the premise, genre
            // and book type of the project you currently have open, with no
            // warning and no alternative. Starting a NEW book from an idea is
            // the obvious other thing to want, and the dialog for it has been
            // sitting unimported since it was written.
            return (
              <div key={idx} className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUseIdea?.(part.data)}
                  className="gap-1.5 rounded-full border-chart-1/40 bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 text-xs"
                >
                  <Zap className="h-3 w-3" /> Use in This Book
                </Button>
                {onStartNewProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onStartNewProject(part.data)}
                    className="gap-1.5 rounded-full border-border/60 text-xs"
                  >
                    <FilePlus className="h-3 w-3" /> Start a New Book
                  </Button>
                )}
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isUser
                  ? 'rounded-tr-sm bg-primary text-primary-foreground'
                  : 'rounded-tl-sm bg-card border border-border/50 text-card-foreground'
              }`}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{part.content}</p>
              ) : (
                <ReactMarkdown
                  className="prose prose-sm prose-slate dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  components={{
                    p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    h1: ({ children }) => <h1 className="text-base font-bold my-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold my-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold my-1.5">{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-chart-1/40 pl-3 my-2 text-muted-foreground italic">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="px-1 py-0.5 rounded bg-muted text-xs">{children}</code>
                    ),
                  }}
                >
                  {part.content}
                </ReactMarkdown>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}