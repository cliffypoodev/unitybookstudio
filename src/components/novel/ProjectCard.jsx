import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPhase } from '@/lib/autonovel';

export default function ProjectCard({ project }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm">
      {project.cover_image_url ? (
        <img src={project.cover_image_url} alt={`${project.title} cover`} className="h-52 w-full object-cover" width="640" height="420" loading="lazy" />
      ) : (
        <div className="h-52 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.8),rgba(233,223,208,0.75))]" />
      )}
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatPhase(project.phase)}</Badge>
          <Badge variant="secondary">{project.chapter_count || 0}/{project.chapter_target || 0} drafted</Badge>
        </div>
        <div>
          <CardTitle className="font-display text-3xl text-foreground">{project.title || 'Untitled Project'}</CardTitle>
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">{project.tagline || project.seed_concept}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.28em]">Foundation</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{(project.foundation_score || 0).toFixed(1)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-xs uppercase tracking-[0.28em]">Novel Score</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{(project.novel_score || 0).toFixed(1)}</p>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <div className="flex gap-2 text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <FileText className="h-4 w-4" />
        </div>
        <Button asChild className="rounded-full px-5">
          <Link to={`/projects/${project.id}`}>
            Open Studio <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}