import React, { useMemo, useState } from 'react';
import ToolsSideNav from '@/components/tools/ToolsSideNav';
import IdeasSubPage from '@/components/tools/IdeasSubPage';
import ProofreadSubPage from '@/components/tools/ProofreadSubPage';
import TransformSubPage from '@/components/tools/TransformSubPage';
import CompareSubPage from '@/components/tools/CompareSubPage';
import PublishingSubPage from '@/components/tools/PublishingSubPage';
import AnalyticsSubPage from '@/components/tools/AnalyticsSubPage';
import CriticSubPage from '@/components/tools/CriticSubPage';
import ResearchSubPage from '@/components/tools/ResearchSubPage';
import AnthologyPolishView from '@/components/tools/AnthologyPolishView';
import { isAnthologyProject } from '@/lib/anthologyEngine';

export default function ToolsTab({
  project,
  chapters,
  onUsePrompt,
  onUseIdea,
  busyLabel,
  setBusyLabel,
  onProjectRefresh,
  onRefreshAll,
}) {
  const [activeTool, setActiveTool] = useState('ideas');

  const isAnthology = isAnthologyProject(project);

  const safeSetBusyLabel = useMemo(() => {
    return typeof setBusyLabel === 'function' ? setBusyLabel : () => {};
  }, [setBusyLabel]);

  const safeRefreshAll = useMemo(() => {
    return typeof onRefreshAll === 'function' ? onRefreshAll : () => {};
  }, [onRefreshAll]);

  const safeProjectRefresh = useMemo(() => {
    return typeof onProjectRefresh === 'function' ? onProjectRefresh : () => {};
  }, [onProjectRefresh]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ToolsSideNav
        activeTool={activeTool}
        onSelect={setActiveTool}
        isAnthology={isAnthology}
      />

      <div className="min-w-0 flex-1 overflow-x-hidden pr-1">
        {activeTool === 'ideas' && (
          <IdeasSubPage
            onUsePrompt={onUsePrompt}
            onUseIdea={onUseIdea}
            projectId={project?.id}
          />
        )}

        {activeTool === 'proofread' && (
          <ProofreadSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
            onRefreshAll={safeRefreshAll}
          />
        )}

        {activeTool === 'critic' && (
          <CriticSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
          />
        )}

        {activeTool === 'research' && (
          <ResearchSubPage
            project={project}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
            onProjectRefresh={safeProjectRefresh}
          />
        )}

        {activeTool === 'transform' && (
          <TransformSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
          />
        )}

        {activeTool === 'compare' && (
          <CompareSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
          />
        )}

        {activeTool === 'publishing' && (
          <PublishingSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
          />
        )}

        {activeTool === 'analytics' && (
          <AnalyticsSubPage
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
          />
        )}

        {activeTool === 'anthology' && isAnthology && (
          <AnthologyPolishView
            project={project}
            chapters={chapters}
            busyLabel={busyLabel}
            setBusyLabel={safeSetBusyLabel}
            onRefreshAll={safeRefreshAll}
          />
        )}
      </div>
    </div>
  );
}