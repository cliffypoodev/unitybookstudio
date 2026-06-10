# 06 — Live Continuation Proof: Book 1 → Book 2

## Scenario

**Series:** The Black Map Chronicles
**Book 1** established:
- Protagonist: Mara Vale (alive)
- Supporting: Elias Crowe (DEAD — killed by Cartographer's Guild)
- Resolved: Who burned the observatory (it was the Guild)
- World: Guild controls all map-making, observatory destroyed
- Ending: Mara receives a sealed map from Elias after his death

**Book 2** requirements:
- Entry: Mara alive, Elias dead, open threads: black-map conspiracy + Guild leadership
- Exit: Close black-map conspiracy, open Guild's ultimate plan, end with Mara discovering the map is a gateway

---

## Test 1: Prompt Construction

### Continuity Block Generated
```
=== SERIES CONTINUITY (from Book 1) ===
DEATHS (DEAD — do NOT resurrect): Elias Crowe was killed by the Cartographer's Guild at the end of Book 1
RESOLVED THREADS (CLOSED — do not reopen): Who burned the observatory — it was the Guild to destroy evidence of the black map
WORLD STATE: The Cartographer's Guild controls all map-making. The observatory is destroyed.
PREVIOUS BOOK ENDED: Mara receives a sealed map from Elias after his death, delivered by a courier who vanishes.
=== END SERIES CONTINUITY ===
```

**Result:** ✅ All canon constraints present. Dead character marked. Resolved thread locked. World state injected.

### Volume Contract Block (Chapter 1/20)
```
=== SERIES CONTINUITY CONTRACTS (MANDATORY) ===
This volume is being rewritten to fit seamlessly between adjacent volumes in the series.
You MUST honor both contracts below. Violating either contract breaks series continuity.

ENTRY CONTRACT (what the previous volume delivered — your starting state):
Characters who MUST be alive: Mara Vale
Characters who MUST be dead: Elias Crowe
Open threads to pick up: black-map conspiracy; Cartographer's Guild leadership
World facts assumed true: The observatory is destroyed; Mara has the sealed map

EXIT CONTRACT (what the next volume expects — your ending state):
Characters who MUST be alive at end: Mara Vale
Threads that must be OPEN at end: The guild's ultimate plan
Threads that must be CLOSED at end: black-map conspiracy

POSITION: Opening chapters. Establish the entry contract state.
=== END CONTRACTS ===
```

**Result:** ✅ Entry/exit contracts present with position-aware guidance.

---

## Test 2: Clean Prose Passes

**Input:**
```
Mara Vale traced the lines of the sealed map with trembling fingers. The hidden ink began to glow.
```

**Gate Result:** ✅ PASS — no dead character resurrection, no resolved thread reopening.

---

## Test 3: Violating Prose Blocked

**Input:**
```
Elias Crowe walked through the door and smiled at Mara. "I have returned," Elias said.
```

**Gate Result:** ❌ BLOCK — Dead character resurrection detected: Elias Crowe

---

## Test 4: Contract Position Awareness

| Chapter | Total | Position | Guidance |
|---------|-------|----------|----------|
| 1 | 20 | 5% | Opening chapters. Establish the entry contract state. |
| 10 | 20 | 50% | Mid-volume. Drive the story forward. |
| 19 | 20 | 95% | Final chapters. Deliver the exit contract. |
| 20 | 20 | 100% | Final chapters. Deliver the exit contract. |

**Result:** ✅ Position-aware guidance varies correctly by chapter.

---

## Conclusion

The full Book 1 → Book 2 pipeline now:
1. Loads the correct SeriesBible entity (not the project)
2. Injects dead character constraints into the LLM prompt
3. Injects resolved thread locks into the LLM prompt
4. Provides position-aware contract guidance per chapter
5. Validates generated prose for canon violations
6. Blocks export of manuscripts that violate series canon
