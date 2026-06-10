# 08 — Remaining Work

## Completed in This Pass

- [x] Fix `getSeriesContinuity` in sceneWriter.js to correctly resolve SeriesBible entities
- [x] Inject `buildVolumeContractBlock` into live generation/rewrite prompts
- [x] Wire `runSeriesContractGate` into Draft path (post-generation gate)
- [x] Wire `runSeriesContractGate` into Export path (pre-export gate)
- [x] Flavor-aware injection (continuation / standalone / anthology)
- [x] Position-aware contract guidance (opening / mid / final chapters)
- [x] Create regression tests (44 new tests, all passing)
- [x] Verify existing tests (37 tests, all passing)
- [x] Verify build (clean)

## Deferred to Future Pass

### Polish Series Awareness
The `llmProsePolisher.js` polisher currently operates on individual chapters without series context. Future work:
- [ ] Pass series continuity block into the polish system prompt
- [ ] Add post-polish series contract gate
- [ ] Ensure polish doesn't accidentally remove series-canon-critical sentences

### Rewrite Series Awareness
The rewrite pipeline should respect the same contracts:
- [ ] Wire volume contracts into rewrite prompts
- [ ] Add post-rewrite series contract gate

### Volume Bible Staleness Check
The staleness detection logic exists in the test harness but needs production wiring:
- [ ] Add staleness check when creating a new project from a series (spinoff flow)
- [ ] Add staleness check before Draft All for linked volumes
- [ ] Show UI indicator in SeriesManager when a volume bible is stale

### Series Manager UI Enhancements (out of scope per user directive)
- [ ] Visual indicator of contract compliance status per volume
- [ ] One-click "re-extract volume bible" button
- [ ] Cross-volume continuity health dashboard

### Series Contract Gate Tuning
- [ ] Reduce false positives for mentioned-but-dead characters (e.g., flashbacks, memories)
- [ ] Add sentiment analysis for resolved thread mentions (mentioning != reopening)
- [ ] Add voice drift detection between volumes

---

## Risk Assessment

| Item | Risk | Mitigation |
|------|------|------------|
| False positive dead character blocks | Medium | Post-gen gate warns only; export gate blocks. User can inspect report. |
| Polish removing canon sentences | Low | Deferred — polisher is conservative by design |
| Performance (extra entity load) | Low | SeriesBible loads are in Promise.all, parallel with other loads |
| ExportSafetyGate now async | Low | Already called inside async useCallback; ExportTab already awaits |
| Dynamic import in exportSafetyGate | Low | Try/catch wraps entire block; failure is non-fatal warning |
