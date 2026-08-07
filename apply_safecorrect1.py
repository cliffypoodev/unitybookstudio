import io, sys

p = 'src/pages/ProjectStudio.jsx'
c = io.open(p, encoding='utf-8').read()

f1 = r'''        onProgress: (label) => setBusyLabel(formatProgressLabel(label)),
        allowLLM: true,
        mode: 'nonfiction','''
r1 = r'''        onProgress: (label) => setBusyLabel(formatProgressLabel(label)),
        allowLLM: false,
        mode: 'nonfiction','''

f2 = r'''      onProgress: (label) => setBusyLabel(label),
      allowLLM: true,
      mode: 'fiction',
      sceneDuplicateSweep: runSceneDuplicateSweep,'''
r2 = r'''      onProgress: (label) => setBusyLabel(label),
      allowLLM: false,
      mode: 'fiction',
      sceneDuplicateSweep: runSceneDuplicateSweep,'''

for f, r, name in [(f1, r1, "Edit 1 (nonfiction)"), (f2, r2, "Edit 2 (fiction)")]:
    count = c.count(f)
    if count != 1:
        print(f"ABORT {name}: Expected 1, found {count}")
        sys.exit(1)
    c = c.replace(f, r)

io.open(p, 'w', encoding='utf-8').write(c)
print("SUCCESS: SAFECORRECT-1 applied")
