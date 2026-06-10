import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function MarkdownPanel({ content, emptyLabel }) {
  if (!content) {
    return <div className="rounded-[1.5rem] border border-dashed border-border bg-background/60 p-6 text-sm leading-7 text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-6">
      <ReactMarkdown className="prose prose-slate max-w-none text-sm leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {content}
      </ReactMarkdown>
    </div>
  );
}