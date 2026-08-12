import React, { useRef, useState } from 'react';
import { Upload, X as XIcon, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { bypassUploadFile } from '@/lib/coreBypasses';
import { runWithNetworkRetry } from '@/lib/requestRetry';

/**
 * Publisher Logo Upload
 *
 * Lets the user upload their own publisher logo for this project. Saved to
 * project.publisher_logo_url, which the Full Wrap composite uses to render
 * the logo on the spine (replacing the old hardcoded Unity Publishing URL).
 *
 * If no logo is set, the user sees an upload prompt. Once set, a thumbnail
 * + clear button are shown.
 */
export default function PublisherLogoUpload({ project, onLogoChange }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const currentLogo = project?.publisher_logo_url || '';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await bypassUploadFile({ file });
      if (!file_url) throw new Error('Upload returned no URL');
      await runWithNetworkRetry(() =>
        base44.entities.NovelProject.update(project.id, { publisher_logo_url: file_url })
      );
      onLogoChange?.(file_url);
      toast.success('Publisher logo uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'unknown'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!project?.id) return;
    try {
      await runWithNetworkRetry(() =>
        base44.entities.NovelProject.update(project.id, { publisher_logo_url: '' })
      );
      onLogoChange?.('');
      toast.success('Logo cleared');
    } catch (err) {
      toast.error('Clear failed: ' + (err?.message || 'unknown'));
    }
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium">Publisher Logo</label>
      {currentLogo ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2">
          <img
            src={currentLogo}
            alt="Publisher logo"
            className="h-10 w-10 rounded object-contain bg-zinc-100"
          />
          <span className="flex-1 text-[10px] text-muted-foreground truncate">
            Uploaded logo
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            title="Clear logo"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-3 text-center">
          <ImageIcon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-[10px] text-muted-foreground mb-1.5">No logo set</p>
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-6 gap-1 rounded text-[10px]"
          >
            {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
            {uploading ? 'Uploading…' : 'Upload Logo'}
          </Button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <p className="text-[9px] text-muted-foreground italic">
        Appears on the spine when enabled. Transparent PNG recommended.
      </p>
    </div>
  );
}