# 03 — Violence Output Effectiveness

> **Report Generated:** 2026-06-08T22:18 CDT
> **Scope:** Prompt-level differentiation across all 6 violence levels (0–5)
> **Result:** All levels produce distinct prompt instructions; safety constraints enforced

---

## Prompt Instructions Per Level

### Level 0 — None (No On-Page Violence)

- **Constraints block:** Not emitted
- **Project context header:** Not emitted
- **Scene violence compact:** Not emitted
- **Beat instructions:** No violence instructions generated
- **Effect:** LLM receives zero violence directives — defaults to clean output

### Level 1 — Mild Peril (Threats Implied, Never Depicted)

- **Constraints block:** `VIOLENCE LEVEL: 1/5`
- **Project context header:** `VIOLENCE: 1/5`
- **Scene violence compact:** `VIOLENCE: Level 1/5 (Mild Peril). Non-graphic.`
- **Beat instructions:** Threats implied but never depicted; YA-safe ceiling
- **Effect:** LLM instructed to keep violence off-page; tension through implication only

### Level 2 — Moderate Action (Fight Scenes with Moderate Detail)

- **Constraints block:** `VIOLENCE LEVEL: 2/5`
- **Project context header:** `VIOLENCE: 2/5`
- **Scene violence compact:** `VIOLENCE: Level 2/5 (Moderate Action). Non-graphic.`
- **Beat instructions:** Fight scenes allowed with moderate detail; no graphic depictions
- **Effect:** LLM can write action sequences but avoids visceral detail

### Level 3 — Intense (Visceral Combat, Serious Injuries On-Page)

- **Constraints block:** `VIOLENCE LEVEL: 3/5`
- **Project context header:** `VIOLENCE: 3/5`
- **Scene violence compact:** `VIOLENCE: Level 3/5 (Intense). Visceral but purposeful.`
- **Beat instructions:** Visceral combat permitted; serious injuries shown on-page; violence must serve story purpose
- **Effect:** LLM can produce intense action with physical consequences; gratuitous violence still discouraged

### Level 4 — Graphic (Detailed Depictions)

- **Constraints block:** `VIOLENCE LEVEL: 4/5`
- **Project context header:** `VIOLENCE: 4/5`
- **Scene violence compact:** `VIOLENCE: Level 4/5 (Graphic). Genre-appropriate intensity.`
- **Beat instructions:** Detailed depictions of violence permitted; genre-appropriate intensity
- **Effect:** LLM given latitude for graphic violence matching genre expectations (thriller, horror, war fiction)

### Level 5 — Extreme / Restricted (Body Horror, Grimdark)

- **Constraints block:** `VIOLENCE LEVEL: 5/5`
- **Project context header:** `VIOLENCE: 5/5`
- **Scene violence compact:** `VIOLENCE: Level 5/5 (Extreme / Restricted).` + safety warning
- **Beat instructions:** Body horror, grimdark permitted with explicit safety boundary warnings
- **Effect:** Maximum violence latitude; safety gates still enforce absolute prohibitions

---

## Summary Table

| Level | Label | Prompt Instructions | Safety Constraints | Reading-Level Cap | Status |
|---|---|---|---|---|---|
| 0 | None | No violence block emitted | N/A | N/A | ✅ |
| 1 | Mild Peril | `VIOLENCE: Level 1/5 (Mild Peril). Non-graphic.` | Standard safety gates | Max for Children/MG | ✅ |
| 2 | Moderate Action | `VIOLENCE: Level 2/5 (Moderate Action). Non-graphic.` | Standard safety gates | Max for Young Adult | ✅ |
| 3 | Intense | `VIOLENCE: Level 3/5 (Intense). Visceral but purposeful.` | Standard safety gates | Adult only | ✅ |
| 4 | Graphic | `VIOLENCE: Level 4/5 (Graphic). Genre-appropriate intensity.` | Standard safety gates | Adult only | ✅ |
| 5 | Extreme / Restricted | `VIOLENCE: Level 5/5 (Extreme / Restricted).` + safety warning | Enhanced safety gates | Adult only | ✅ |

---

## Safety Architecture

### Reading-Level Caps (Enforced in `getEffectiveContentSettings`)

| Reading Level | Maximum Violence Level | Cap Enforcement |
|---|---|---|
| Children / Middle-Grade | 1 (Mild Peril) | Hard cap — `getEffectiveContentSettings` clamps value |
| Young Adult | 2 (Moderate Action) | Hard cap — `getEffectiveContentSettings` clamps value |
| Adult / New Adult | 5 (no cap) | Full range available |

### UI Warning

When the user's selected violence level exceeds the reading-level cap, `SetupTab.jsx` (L1100–1107) displays a warning indicating the effective (capped) value will be used during generation.

### Hard Safety Invariants

- Safety gates (`manuscriptSafetyGate.js`, `pipelineValidator.js`, `llmProsePolisher.js`) remain active at **all** violence levels
- Violence level never overrides prohibited content detection
- Contamination canary in `buildProjectContextHeader` blocks business-context injection regardless of violence setting

---

## Live Output Testing Note

> [!NOTE]
> A/B output testing (verifying that different violence levels produce measurably different prose) requires live LLM calls which cannot run in CI. The prompt-level evidence above proves the instructions differ per level. For live output verification, run the app with Ollama and generate chapters at different violence levels to confirm behavioral differences in output prose.
