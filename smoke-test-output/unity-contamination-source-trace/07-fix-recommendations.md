# Fix Recommendations

> Generated: 2026-06-08

---

## Priority Matrix

| # | Fix | Severity | Effort | Priority |
|---|-----|----------|--------|----------|
| 1 | Remove "Unity Living" from catalog | 🔴 Critical | Trivial (1 line) | **IMMEDIATE** |
| 2 | Add book_type guard to bibliography routing | 🔴 Critical | Low (add conditional) | **IMMEDIATE** |
| 3 | Add anti-contamination canary to prompt payload | 🟡 Medium | Low (add string) | **SHORT-TERM** |
| 4 | Make safety gate block+retry (not warn-only) | 🟡 Medium | Medium (control flow change) | **SHORT-TERM** |
| 5 | Add Ollama context isolation (keep_alive=0) | 🟢 Low | Trivial (1 parameter) | **SHORT-TERM** |
| 6 | Regression test | 🔴 Critical | Medium (test file) | **IMMEDIATE** |

---

## Fix 1: Remove "Unity Living" from `anthologyCatalog.js` line 876

**IMMEDIATE** — Eliminates Contamination Vector #1

### What to change

In `anthologyCatalog.js` at line 876-877, replace the catalog entry text:

```diff
- "description": "Hook: The economics of streaming for independent labels. North Star: Practical strategies for Unity Living-style management.",
- "content": "Hook: The economics of streaming for independent labels. North Star: Practical strategies for Unity Living-style management.",
+ "description": "Hook: The economics of streaming for independent labels. North Star: Practical strategies for independent label management.",
+ "content": "Hook: The economics of streaming for independent labels. North Star: Practical strategies for independent label management.",
```

### Why this works

- Removes the only Unity reference in the prompt catalog
- Preserves the intent of the prompt entry (independent label management strategies)
- No other catalog entries contain Unity references
- The entry title "The $0.003 Revolution" and Music Industry genre remain unchanged

### Risk

- **None** — this is a text content change in a prompt suggestion; it does not affect application logic

---

## Fix 2: Add project-scoping to bibliography domain detection

**IMMEDIATE** — Eliminates Contamination Vector #2

### What to change

In `bibliographyGenerator.js`, add a `book_type` guard before line 118 in the `detectProjectDomain` function:

```diff
  detectProjectDomain(manuscriptText, projectMeta) {
+   // Only detect caregiving domain for nonfiction projects
+   if (projectMeta?.book_type !== 'nonfiction') {
+     return null; // Fiction projects should never trigger domain-specific bibliography injection
+   }
    if (CAREGIVING_RE.test(manuscriptText)) {
      return 'caregiving';
    }
```

### Why this works

- Fiction projects will never trigger caregiving bibliography injection, regardless of their content
- Nonfiction projects that are genuinely about caregiving will still receive appropriate bibliography sources
- The fix is minimal and non-breaking — it adds a guard, not a rewrite

### Additional consideration

- The function signature may need to be updated to accept `projectMeta` if it doesn't already
- All callers of `detectProjectDomain` should be updated to pass the project metadata
- Consider making domain detection opt-in via project configuration rather than automatic text matching

---

## Fix 3: Add anti-contamination canary to prompt payload

**SHORT-TERM** — Defense-in-depth against model-level bleed

### What to change

In the `buildProjectContextHeader` function, append an anti-contamination instruction:

```javascript
// Add to the end of buildProjectContextHeader output:
const CONTAMINATION_GATE = `
CONTAMINATION GATE: Do not mention Unity Supported Living, Unity Media, 
Medicaid, DSP, waiver programs, care documentation, or compliance 
documentation unless the project is explicitly about these topics.
`;
```

### Why this works

- Provides an explicit instruction to the LLM to avoid Unity/caregiving content
- Acts as defense-in-depth even if Vectors 1 and 2 are not fully patched
- Protects against KV cache bleed (Vector 3) by giving the model an explicit negative instruction
- Does not interfere with legitimate caregiving-themed projects (the gate says "unless the project is explicitly about these topics")

### Risk

- **Low** — adding negative instructions can occasionally cause the Streisand effect (the model mentions the forbidden terms because they were brought to its attention). Monitor initial outputs after deployment.

---

## Fix 4: Make safety gate block+retry for prose generation

**SHORT-TERM** — Converts detection into prevention

### Current behavior

`manuscriptSafetyGate.js` (lines 228-232) **detects** Unity contamination terms and **warns** but does not block generation or trigger a retry.

### Proposed behavior

```javascript
// In manuscriptSafetyGate.js, after contamination detection:
if (contaminationDetected) {
  // Block the contaminated output
  logger.error('CONTAMINATION BLOCKED: Unity terms detected in generated prose');
  
  // Retry with explicit anti-contamination suffix
  const retryPrompt = originalPrompt + '\n\n' + 
    'CRITICAL: Your previous response contained contamination from an unrelated domain. ' +
    'Do NOT mention Unity Supported Living, Unity Media, Medicaid, DSP, waiver programs, ' +
    'or any caregiving compliance documentation. Regenerate the response cleanly.';
  
  return retry(retryPrompt, { maxRetries: 2 });
}
```

### Why this works

- Converts the existing detection infrastructure into an active prevention mechanism
- Provides the LLM with explicit feedback about what went wrong on retry
- Limits retries to prevent infinite loops
- The safety gate already correctly identifies contamination — this fix just changes the response from "warn" to "block+retry"

---

## Fix 5: Ollama context isolation

**SHORT-TERM** — Eliminates KV cache bleed (Vector 3)

### What to change

In `localLLM.js`, add `keep_alive` parameter to Ollama API calls:

```diff
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      stream: false,
+     keep_alive: 0,  // Force model unload after each call — eliminates KV cache bleed
    }),
  });
```

### Why this works

- Setting `keep_alive: 0` forces Ollama to unload the model from memory after each request
- This ensures no KV cache persists between calls
- Completely eliminates the possibility of context bleed between projects

### Trade-off

- **Cold start penalty**: Each call requires a full model load (~5-15 seconds depending on model size and hardware)
- **Alternative**: Use `"options": { "num_ctx": 0 }` to force context reset without unloading model weights (faster but less thorough)
- **Recommended**: Start with `keep_alive: 0` for maximum safety, then evaluate performance impact and consider relaxing to a shorter `keep_alive` (e.g., `"keep_alive": "10s"`) if cold starts are unacceptable

---

## Fix 6: Regression Test

**IMMEDIATE** — Prevents recurrence

### Test file

A dedicated regression test file should be created (or is being created separately) that validates:

1. **Catalog scan**: No prompt catalog entry in `anthologyCatalog.js` contains Unity Supported Living references ("Unity Living", "Unity Supported Living", "Unity Media")
2. **Bibliography guard**: `bibliographyGenerator.detectProjectDomain` returns `null` for fiction projects, even when manuscript text contains caregiving terms
3. **Prompt payload scan**: Generated prompt payloads for fiction projects contain no Unity/caregiving contamination terms
4. **Output scan**: Generated prose from fiction projects contains no Unity/caregiving references
5. **Safety gate enforcement**: `manuscriptSafetyGate.js` blocks (not just warns) when contamination is detected

### Test assertions

```javascript
// Catalog cleanliness
expect(catalogEntries.every(e => 
  !e.description.includes('Unity Living') && 
  !e.content.includes('Unity Living')
)).toBe(true);

// Bibliography scoping
expect(detectProjectDomain(
  'The caregiver helped with Medicaid paperwork', 
  { book_type: 'fiction' }
)).toBeNull();

// Output cleanliness
const CONTAMINATION_TERMS = [
  'Unity Supported Living',
  'Unity Media Solutions', 
  'Missouri DMH',
  'Medicaid Provider Manual',
  'CMS HCBS',
];
expect(generatedProse).not.toContainAny(CONTAMINATION_TERMS);
```

---

## Implementation Order

```
1. Fix 1 (catalog cleanup)          ← 5 minutes, eliminates Vector 1
2. Fix 2 (bibliography guard)       ← 30 minutes, eliminates Vector 2  
3. Fix 6 (regression test)          ← 1 hour, prevents recurrence
4. Fix 3 (prompt canary)            ← 15 minutes, defense-in-depth
5. Fix 5 (Ollama keep_alive)        ← 5 minutes, eliminates Vector 3
6. Fix 4 (safety gate block+retry)  ← 2 hours, converts warn→block
```

> **Total estimated effort**: ~4 hours for complete remediation, with the two critical fixes deployable in under 1 hour.
