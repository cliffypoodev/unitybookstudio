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
r'''  // Step A: Triplet list detection — ALL project types
  onProgress?.('Polish: Breaking triplet sensory lists…');
  const tripletResult = detectAndFixTriplets(loaded);
  allChanges.push(...tripletResult.changes);''',
r'''  // Step A: Triplet list rewrites — RETIRED FOR ALL PROJECT TYPES (TRIPLETRETIRE-1)
  // detectAndFixTriplets deleted the middle item of factual three-item lists
  // ("the freight sheds, the firehouse, and the elevated railway trestle" lost
  // "the firehouse") and its fragment-merge rule semicolon-merged initials and
  // citation lines ("later. W. E. B. Du Bois" -> "later; w. E. B; du Bois").
  // Measured 2026-08-06 on the real pipeline. A list is content, not an AI
  // tell; deletion is not variation. Same retirement as Steps B and C.
  const tripletResult = { fixed: 0, changes: [] };
  console.log('[POLISH] Step A (triplet rewrites): RETIRED — content deletion measured 2026-08-06; flag-only via proofreader');''',
"COMMIT 1")
