import React from 'react';
import { Download, Image, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPhase, getDraftedCount } from '@/lib/autonovel';

export default function PipelineSidebar({ project, chapters, busyLabel, onGenerateFoundation, onGenerateCover, onEvaluate }) {
  const draftedCount = getDraftedCount(chapters);

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatPhase(project.phase)}</Badge>
            <Badge variant="secondary">{draftedCount}/{chapters.length} drafted</Badge>
          </div>
          {busyLabel ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}
            </div>
          ) : null}
          <Button onClick={onGenerateFoundation} className="min-h-11 w-full rounded-full">
            <Sparkles className="mr-2 h-4 w-4" /> Generate Foundation
          </Button>

          <Button onClick={onEvaluate} variant="outline" className="min-h-11 w-full rounded-full">
            <Download className="mr-2 h-4 w-4" /> Evaluate Project
          </Button>
          <Button onClick={onGenerateCover} variant="outline" className="min-h-11 w-full rounded-full">
            <Image className="mr-2 h-4 w-4" /> Generate Cover Art
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}