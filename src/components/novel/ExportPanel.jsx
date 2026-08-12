/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live export UI is publishing/ExportTab.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function buildManuscript(project, chapters) {
  const ordered = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  return [`# ${project.title || 'Untitled Project'}`, '', project.tagline || '', '', ...ordered.flatMap((chapter) => [`## Chapter ${chapter.chapter_number}: ${chapter.title}`, '', chapter.content_md || chapter.beat_summary || '', ''])].join('\n');
}

export default function ExportPanel({ project, chapters }) {
  const hasDrafts = chapters.some((chapter) => chapter.content_md);

  const handleMarkdownDownload = () => {
    const manuscript = buildManuscript(project, chapters);
    const blob = new Blob([manuscript], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(project.title || 'autonovel').replace(/\s+/g, '-').toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfDownload = () => {
    const manuscript = buildManuscript(project, chapters);
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const lines = pdf.splitTextToSize(manuscript, 470);
    let y = 60;
    lines.forEach((line) => {
      if (y > 740) {
        pdf.addPage();
        y = 60;
      }
      pdf.text(line, 70, y);
      y += 16;
    });
    pdf.save(`${(project.title || 'autonovel').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Exports</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Button onClick={handleMarkdownDownload} disabled={!hasDrafts} className="min-h-11 rounded-full">
          <FileText className="mr-2 h-4 w-4" /> Download Markdown
        </Button>
        <Button onClick={handlePdfDownload} disabled={!hasDrafts} variant="outline" className="min-h-11 rounded-full">
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </CardContent>
    </Card>
  );
}