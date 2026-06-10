import React, { useRef, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';

export default function UploadZone({ onFileSelect, uploading }) {
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-background/50 p-12 cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-sm font-medium text-foreground">
        {uploading ? 'Parsing document…' : 'Drop a .docx file here or click to browse'}
      </p>
      <p className="text-xs text-muted-foreground">Supports .docx, .doc, and .txt files</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.txt"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0])}
      />
    </div>
  );
}