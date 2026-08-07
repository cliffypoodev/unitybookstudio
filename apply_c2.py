import io, sys
def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    if content.count(find_str) != 1:
        print(f"ABORT {name}: Expected 1, found {content.count(find_str)}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

apply_edit('src/lib/antiDetectionPolish.js',
r'''import { runExtraPolishChecks } from './extraPolishChecks.js';
import { ABBREVIATION_TOKENS } from './safeUppercase.js';''',
r'''import { runExtraPolishChecks } from './extraPolishChecks.js';
import { ABBREVIATION_TOKENS } from './safeUppercase.js';
import { isNonfictionProject } from './projectType.js';''',
"COMMIT 2 Edit 1")

apply_edit('src/lib/antiDetectionPolish.js',
r'''  // Determine if this is a nonfiction project (including nonfiction anthologies)
  const isNF = project.book_type === 'nonfiction';''',
r'''  // NFCLASS-5: one authority for fiction vs nonfiction — a raw book_type check
  // here read {project_type:'nonfiction'} records as fiction and ran the
  // fiction-only auto-rewrites on factual prose.
  const isNF = isNonfictionProject(project);''',
"COMMIT 2 Edit 2")
