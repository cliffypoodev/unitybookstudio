# 02 — Violence Live Setup Proof

> **Report Generated:** 2026-06-08T22:18 CDT
> **Scope:** End-to-end violence level wiring from genre selection through prompt emission
> **Result:** All paths verified

---

## Code Path Trace

For each scenario below, the violence level flows through this chain:

```
User selects genre
  → applyGenreDefaults() sets violence_level from GENRE_DEFAULTS
    → User can override via SetupTab dropdown (L1157–1173)
      → Value saved to project spec
        → On reload, value read from spec (default 0 for old projects)
          → buildSetupConstraints() includes VIOLENCE LEVEL: X/5 (when ≥ 1)
            → buildProjectContextHeader() includes VIOLENCE: X/5 (when ≥ 1)
              → buildViolenceCompact() in sceneWriter includes per-scene block
```

---

## Scenario 1 — Cozy Mystery

| Step | Action | Result |
|---|---|---|
| 1. Genre selection | User picks **Mystery** | `applyGenreDefaults` sets `violence_level = 1` |
| 2. SetupTab dropdown | Dropdown shows "1 – Mild Peril" | User sees current default |
| 3. User override | User keeps default (1) | Value stays at 1 |
| 4. Save | `violence_level: 1` written to project spec | Persisted |
| 5. Reload | Project loaded, `violence_level` read from spec | Falls back to 0 if missing (old projects) |
| 6. `buildSetupConstraints` | `VIOLENCE LEVEL: 1/5` included in constraints | ✅ Emitted (≥ 1) |
| 7. `buildProjectContextHeader` | `VIOLENCE: 1/5` in compact header | ✅ Emitted (≥ 1) |
| 8. `buildViolenceCompact` | Per-scene violence block: "Mild Peril. Non-graphic." | ✅ Emitted |

---

## Scenario 2 — Horror / Thriller

| Step | Action | Result |
|---|---|---|
| 1. Genre selection | User picks **Horror** | `applyGenreDefaults` sets `violence_level = 3` |
| 2. SetupTab dropdown | Dropdown shows "3 – Intense" | User sees current default |
| 3. User override | User bumps to **4 – Graphic** | `violence_level = 4` |
| 4. Save | `violence_level: 4` written to project spec | Persisted |
| 5. Reload | Project loaded, `violence_level = 4` read from spec | ✅ |
| 6. `buildSetupConstraints` | `VIOLENCE LEVEL: 4/5` included in constraints | ✅ Emitted (≥ 1) |
| 7. `buildProjectContextHeader` | `VIOLENCE: 4/5` in compact header | ✅ Emitted (≥ 1) |
| 8. `buildViolenceCompact` | Per-scene violence block: "Graphic. Genre-appropriate intensity." | ✅ Emitted |

---

## Scenario 3 — Nonfiction Training Manual

| Step | Action | Result |
|---|---|---|
| 1. Genre selection | User picks **Self-Help** | `applyGenreDefaults` sets `violence_level = 0` |
| 2. SetupTab dropdown | Dropdown shows "0 – None" | User sees current default |
| 3. User override | User keeps default (0) | Value stays at 0 |
| 4. Save | `violence_level: 0` written to project spec | Persisted |
| 5. Reload | Project loaded, `violence_level = 0` read from spec | ✅ |
| 6. `buildSetupConstraints` | **Not emitted** — value is 0, below threshold | ✅ Suppressed (< 1) |
| 7. `buildProjectContextHeader` | **Not emitted** — value is 0, below threshold | ✅ Suppressed (< 1) |
| 8. `buildViolenceCompact` | **Not emitted** — no violence compact for level 0 | ✅ Suppressed |

---

## Summary Table

| Project | Genre | Default Violence | Set Value | Constraints Include? | Header Include? | Scene Prompt Include? | Old Project Default | Status |
|---|---|---|---|---|---|---|---|---|
| Cozy Mystery | Mystery | 1 | 1 | ✅ Yes (`VIOLENCE LEVEL: 1/5`) | ✅ Yes (`VIOLENCE: 1/5`) | ✅ Yes (Mild Peril) | 0 | ✅ |
| Horror / Thriller | Horror | 3 | 4 (overridden) | ✅ Yes (`VIOLENCE LEVEL: 4/5`) | ✅ Yes (`VIOLENCE: 4/5`) | ✅ Yes (Graphic) | 0 | ✅ |
| Nonfiction Training | Self-Help | 0 | 0 | ❌ No (suppressed) | ❌ No (suppressed) | ❌ No (suppressed) | 0 | ✅ |

---

## Genre Defaults Reference

| Genre | Default Violence Level |
|---|---|
| Horror | 3 |
| Industrial Horror | 4 |
| Thriller | 2 |
| Crime | 3 |
| Dark Fantasy | 3 |
| Mystery | 1 |
| Romance | 0 |
| Erotica | 0 |
| Self-Help | 0 |
| True Crime | 2 |
| Military History | 3 |
| Western | 2 |

---

## Reading-Level Safety Caps

| Reading Level | Maximum Violence | Enforcement |
|---|---|---|
| Children / Middle-Grade | 1 | `getEffectiveContentSettings` cap + SetupTab warning |
| Young Adult | 2 | `getEffectiveContentSettings` cap + SetupTab warning |
| Adult / New Adult | No cap | Full range 0–5 |
