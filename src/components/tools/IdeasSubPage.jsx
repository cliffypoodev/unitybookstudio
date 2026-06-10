import React, { useState } from 'react';
import IdeasCatalogBrowser from '@/components/notebook/IdeasCatalogBrowser';
import IdeasChatbot from '@/components/notebook/IdeasChatbot';

export default function IdeasSubPage({ onUsePrompt, onUseIdea, projectId }) {
  const [view, setView] = useState('catalog');

  return (
    <div className="flex flex-col">
      {/* Toggle */}
      <div className="flex gap-0 mb-4 shrink-0">
        <button
          onClick={() => setView('catalog')}
          className={`px-5 py-2 border-none text-[0.8rem] font-semibold cursor-pointer rounded-l-md transition-colors ${
            view === 'catalog'
              ? 'bg-[#8B4513] text-white'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          📚 Catalog
        </button>
        <button
          onClick={() => setView('chatbot')}
          className={`px-5 py-2 border-none text-[0.8rem] font-semibold cursor-pointer rounded-r-md transition-colors ${
            view === 'chatbot'
              ? 'bg-[#8B4513] text-white'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          💬 AI Brainstorm
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === 'catalog' ? (
          <IdeasCatalogBrowser onUsePrompt={onUsePrompt} />
        ) : (
          <IdeasChatbot
            onUseIdea={onUseIdea}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
}