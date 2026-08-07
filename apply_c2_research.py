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
r'''      for (let b = 0; b < batches.length; b++) {
        setBusyLabel(`Deep research — extracting facts (batch ${b + 1}/${batches.length})…`);''',
r'''      let failedBatches = 0; // RESEARCHFAIL-1
      for (let b = 0; b < batches.length; b++) {
        setBusyLabel(`Deep research — extracting facts (batch ${b + 1}/${batches.length})…`);''',
"COMMIT 2 Edit 1")

apply_edit('src/pages/ProjectStudio.jsx',
r'''        } catch (batchErr) {
          console.warn('[RESEARCH] batch ' + (b + 1) + '/' + batches.length + ' failed, skipping: ' + (batchErr?.message || batchErr));
        }''',
r'''        } catch (batchErr) {
          failedBatches++; // RESEARCHFAIL-1
          console.warn('[RESEARCH] batch ' + (b + 1) + '/' + batches.length + ' failed, skipping: ' + (batchErr?.message || batchErr));
        }''',
"COMMIT 2 Edit 2")

apply_edit('src/pages/ProjectStudio.jsx',
r'''      const data = merged;
      setResearchData(data);''',
r'''      const data = merged;

      // RESEARCHFAIL-1: a research run that extracted nothing must FAIL, loudly,
      // before anything is saved or marked complete. Measured 2026-08-06: the
      // researcher model did not exist, all 10 extraction batches errored, and the
      // run still saved an empty brief and toasted success — one click away from a
      // story bible generated from an empty closed world (i.e., pure fabrication).
      // Failing loud is the standing design rule ("nothing was saved").
      const totalExtracted = ['key_figures', 'key_events', 'institutions', 'timeline', 'primary_sources', 'competing_narratives', 'key_documents']
        .reduce((n, k) => n + ((data[k] || []).length), 0);
      if (failedBatches >= batches.length && batches.length > 0) {
        throw new Error('research extraction failed: all ' + batches.length + ' batches errored (check the researcher model routing) — nothing was saved');
      }
      if (totalExtracted === 0) {
        throw new Error('research extracted zero documented items from ' + pages.filter((p) => p.content).length + ' fetched sources — nothing was saved');
      }
      if (failedBatches > 0) {
        toast.warning('Research completed with ' + failedBatches + '/' + batches.length + ' failed extraction batches — coverage may be thin.');
      }
      setResearchData(data);''',
"COMMIT 2 Edit 3")
