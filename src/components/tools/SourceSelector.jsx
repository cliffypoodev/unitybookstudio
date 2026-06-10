import React from 'react';

export default function SourceSelector({ source, setSource, project }) {
  return (
    <div className="flex mb-4">
      <button
        onClick={() => setSource('project')}
        disabled={!project?.id}
        className={`px-5 py-2.5 text-[0.85rem] font-semibold border-none rounded-l-lg transition-colors ${
          source === 'project'
            ? 'bg-[#8B4513] text-white'
            : 'bg-secondary/70 text-muted-foreground hover:text-foreground'
        } ${!project?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        📂 Current Project
      </button>
      <button
        onClick={() => setSource('upload')}
        className={`px-5 py-2.5 text-[0.85rem] font-semibold border-none rounded-r-lg cursor-pointer transition-colors ${
          source === 'upload'
            ? 'bg-[#8B4513] text-white'
            : 'bg-secondary/70 text-muted-foreground hover:text-foreground'
        }`}
      >
        📄 Upload Manuscript
      </button>
    </div>
  );
}