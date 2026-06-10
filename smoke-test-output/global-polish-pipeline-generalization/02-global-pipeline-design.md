# Global Pipeline Design

## Universal Polish/Export Pipeline Contract

For every project and every chapter:

```
1. Resolve canonical chapter content
2. Run manuscript safety gate (universal)
3. Run LLM prose polish if enabled for profile
4. Run deterministic punctuation/grammar repair
5. Run dialogue mechanics repair if shouldRunDialogueRepair(text, project)
6. Run AI-slop deterministic reduction if shouldRunAISlopReduction(project)
7. Run flagged-sentence LLM recast if shouldRunLLMSentenceRecast(project, model)
8. Run polish quality gate
9. Save through canonical safe/stale-clearing path
10. Run export-resolved surface repair (pre-export)
11. Run export safety gate
12. Export only clean/resolved text
```

## Decision Points

| Step | Decision Function | Input |
|---|---|---|
| Dialogue repair | `shouldRunDialogueRepair(text, project)` | Text + project |
| Slop reduction | `shouldRunAISlopReduction(project)` | Project |
| LLM recast | `shouldRunLLMSentenceRecast(project, model)` | Project + model config |
| Polish intensity | `getAllowedPolishIntensity(project)` | Project |
| Slop budgets | `getSlopBudgetsForProject(project)` | Project |
| Safety thresholds | `getSafetyThresholdsForProject(project)` | Project |

## Invariants

- Hard safety gates ALWAYS on for all project types
- Process leak detection: universal
- Contamination detection: universal (with project-type exceptions)
- Malformed grammar: universal
- Export safety gate: universal
- Stale URL blocker: universal
- Unsafe export override: dev-only
