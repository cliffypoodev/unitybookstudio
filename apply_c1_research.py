import io, sys
def apply_edit(filepath, find_str, replace_str, name):
    content = io.open(filepath, encoding='utf-8').read()
    if content.count(find_str) != 1:
        print(f"ABORT {name}: Expected 1, found {content.count(find_str)} in {filepath}")
        sys.exit(1)
    content = content.replace(find_str, replace_str)
    io.open(filepath, 'w', encoding='utf-8').write(content)
    print(f"SUCCESS: {name} applied")

apply_edit('src/lib/localLLM.js',
r'''  researcher:        'phi4',                                             // factual gathering''',
r'''  researcher:        'deepseek-r1-14b',                                  // RESEARCHMODEL-1: factual gathering. 'phi4' is not in the served catalog — every extraction batch 404'd. R1-14b is the proven fast reasoning alias already used by the critic, and R1's JSON path is proven by the architect.''',
"COMMIT 1")
