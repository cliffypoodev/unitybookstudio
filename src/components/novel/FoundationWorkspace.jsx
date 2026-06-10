import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import MarkdownPanel from '@/components/novel/MarkdownPanel';
import { PROJECT_DOC_TABS } from '@/lib/autonovel';

export default function FoundationWorkspace({ activeDoc, onActiveDocChange, docDrafts, onDocChange, onSave, isSaving }) {
  return (
    <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-3xl text-foreground">Foundation Documents</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">Edit the living documents that drive world logic, chapter plans, voice, and canon.</p>
        </div>
        <Button onClick={onSave} disabled={isSaving} className="min-h-11 rounded-full px-5">
          <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <Tabs value={activeDoc} onValueChange={onActiveDocChange} className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-background/70 p-2">
          {PROJECT_DOC_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="rounded-full px-4 py-2">{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        {PROJECT_DOC_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={tab.key}>{tab.label}</Label>
              <Textarea
                id={tab.key}
                value={docDrafts[tab.key] || ''}
                onChange={(event) => onDocChange(tab.key, event.target.value)}
                className="min-h-[26rem] rounded-[1.5rem] bg-background/80 p-5"
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <MarkdownPanel content={docDrafts[tab.key]} emptyLabel={`No ${tab.label.toLowerCase()} content yet.`} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}