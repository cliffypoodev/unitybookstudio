import io, sys
def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    if content.count(find_str) != 1:
        print(f"ABORT {name}: Expected 1, found {content.count(find_str)} in {filepath}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

apply_edit('src/pages/ProjectStudio.jsx',
r'''      const researchMd = formatNonfictionResearchMarkdown(data, subject);
      const researchFields = await prepareResearchContent(researchMd, project.id);

      setDocDrafts((current) => ({
        ...current,
        research_md: researchMd,
      }));

      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, {
        research_data: JSON.stringify(data),
        ...researchFields,
      }));''',
r'''      // RESEARCHORDER-1: the save used to happen HERE — before the duplicate-quote
      // guard and the verbatim/attribution-binding guard (GATEFIX-13) below. Their
      // blanking then happened in memory only, and refreshAll() reloaded the
      // UN-blanked quotes from the DB. The save now runs after the guards.''',
"COMMIT 3 Edit 1")

apply_edit('src/pages/ProjectStudio.jsx',
r'''      const figs = (data.key_figures || []).length;
      const evs = (data.key_events || []).length;
      toast.success(`Deep research saved — ${pages.filter((p) => p.content).length} sources read, ${figs} figures, ${evs} events.`);''',
r'''      // RESEARCHORDER-1: persist AFTER the integrity guards so blanked quotes stay blanked.
      const researchMd = formatNonfictionResearchMarkdown(data, subject);
      const researchFields = await prepareResearchContent(researchMd, project.id);

      setDocDrafts((current) => ({
        ...current,
        research_md: researchMd,
      }));

      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, {
        research_data: JSON.stringify(data),
        ...researchFields,
      }));

      const figs = (data.key_figures || []).length;
      const evs = (data.key_events || []).length;
      toast.success(`Deep research saved — ${pages.filter((p) => p.content).length} sources read, ${figs} figures, ${evs} events.`);''',
"COMMIT 3 Edit 2")
