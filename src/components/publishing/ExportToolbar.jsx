import React from 'react';
import { Save, Settings, Printer, Download, FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ExportToolbar({
  onSave, isSaving, canSave,
  onExport, exportDisabled,
  onOpenSettings,
  chapterTitle, chapterNumber,
  wordCount,
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 bg-background/60 px-4 py-2">
      {/* Left: Chapter info */}
      <div className="flex items-center gap-3">
        {chapterNumber && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Chapter {chapterNumber}
            </span>
            {chapterTitle && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm font-medium text-foreground">{chapterTitle}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        <span className="mr-2 text-[11px] tabular-nums text-muted-foreground">
          {wordCount.toLocaleString()} words
        </span>

        <Button
          onClick={onSave}
          disabled={isSaving || !canSave}
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 rounded-lg px-3 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving…' : 'Save'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-lg px-3 text-xs" disabled={exportDisabled}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              <Printer className="mr-2 h-3.5 w-3.5" /> Print / PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('docx')}>
              <Download className="mr-2 h-3.5 w-3.5" /> DOCX
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('md')}>
              <FileText className="mr-2 h-3.5 w-3.5" /> Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('clipboard')}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={onOpenSettings}
          size="sm"
          variant="ghost"
          className="h-8 w-8 rounded-lg p-0"
          title="Publishing settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}