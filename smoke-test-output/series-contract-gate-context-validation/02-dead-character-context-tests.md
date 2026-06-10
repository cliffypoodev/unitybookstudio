# 02 — Dead Character Context Tests

## Test Character
**Elias Crowe** — killed by the Cartographer's Guild at the end of Book 1.

## Summary

| Category | Tests | Passed | Result |
|---|:---:|:---:|---|
| Flashback (ALLOWED) | 4 | 4 | ✅ |
| Memory (ALLOWED) | 3 | 3 | ✅ |
| Dream (ALLOWED) | 3 | 3 | ✅ |
| Letter/Document (ALLOWED) | 3 | 3 | ✅ |
| Hallucination (ALLOWED) | 3 | 3 | ✅ |
| Historical Discussion (ALLOWED) | 4 | 4 | ✅ |
| Real Resurrection (BLOCKED) | 4 | 4 | ✅ |
| **Total** | **24** | **24** | **✅** |

---

## ALLOWED — Flashback Tests

### Test 1: Temporal marker "years earlier"
**Input:** `"Three years earlier, Elias Crowe walked into the observatory carrying the black map. He looked at the stars and smiled."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"years earlier"` triggers context marker → paragraph skipped

### Test 2: "back then" framing
**Input:** `"Back then, Elias Crowe had been the finest cartographer in the city. He walked the halls of the Guild with confidence."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"back then"` triggers context marker

### Test 3: "long ago" framing
**Input:** `"Long ago, Elias Crowe stepped through the observatory door for the first time and looked up at the brass telescope."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"long ago"` triggers context marker

### Test 4: "before the war" framing
**Input:** `"Before the war, Elias Crowe sat in his study and turned the pages of the ancient atlas. He smiled at a faded coastline."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"before the war"` triggers context marker

---

## ALLOWED — Memory Tests

### Test 5: Memory with active verbs
**Input:** `"Mara remembered Elias Crowe standing beside the old telescope. He had smiled at her that day."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"remembered"` triggers context marker → active verbs irrelevant

### Test 6: "recalled" with movement verb
**Input:** `"She recalled the way Elias Crowe walked through the market, his coat flapping behind him."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"recalled"` triggers context marker

### Test 7: Memory with quoted dialogue
**Input:** `"Elias Crowe had said, 'The maps never lie.' Mara recalled those words every morning."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"had said"` and `"recalled"` both trigger context markers

---

## ALLOWED — Dream Tests

### Test 8: Dream with active verbs
**Input:** `"In the dream, Elias Crowe was alive again, smiling through the smoke. He walked toward her and said, 'Find the hidden ink.'"`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"dream"` triggers context marker → verbs and dialogue irrelevant

### Test 9: Nightmare with movement
**Input:** `"The nightmare returned. Elias Crowe stood at the burning observatory, looking at her with hollow eyes. He turned and walked into the flames."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"nightmare"` triggers context marker

### Test 10: Dream with wake-up
**Input:** `"Elias Crowe grabbed her arm and whispered, 'Run!' She woke from the dream gasping, the sheets damp with sweat."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"woke from"` triggers context marker

---

## ALLOWED — Letter/Document Tests

### Test 11: Letter before death
**Input:** `"The letter began in Elias Crowe's cramped handwriting. He had written this before his death."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"letter"`, `"had written"`, `"before his death"` all trigger context markers

### Test 12: Police report
**Input:** `"The police report listed Elias Crowe as present at the observatory on the night of the fire."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"police report"` triggers context marker

### Test 13: Journal entry
**Input:** `"Elias Crowe's journal entry from March 12th read: 'I walked the perimeter today.'"`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"journal entry"` triggers context marker

---

## ALLOWED — Hallucination Tests

### Test 14: Clearly labeled hallucination
**Input:** `"For one impossible second, she thought she saw Elias Crowe in the doorway. He smiled and nodded."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"thought she saw"` and `"impossible second"` trigger context markers

### Test 15: Phantom sighting
**Input:** `"She could have sworn she saw Elias Crowe across the crowded street."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"could have sworn"` triggers context marker

### Test 16: Ghost visitation
**Input:** `"The ghost of Elias Crowe appeared at the foot of her bed."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"ghost of"` triggers context marker

---

## ALLOWED — Historical Discussion Tests

### Test 17: "before his death" reference
**Input:** `"Before his death, Elias Crowe had once led the expedition to the northern reaches."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"before his death"` triggers context marker

### Test 18: Photo/portrait
**Input:** `"Mara studied the photograph of Elias Crowe on the mantlepiece."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"photograph of"` triggers context marker

### Test 19: Funeral/eulogy
**Input:** `"At the funeral, the priest said Elias Crowe had walked among them as a light in the darkness."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"funeral"` triggers context marker

### Test 20: Legacy reference
**Input:** `"The legacy of Elias Crowe lived on in the maps he had drawn."`
**Expected:** NOT BLOCKED
**Result:** ✅ PASS — `"legacy of"` triggers context marker

---

## BLOCKED — Real Resurrection Tests

### Test 21: Walks in and speaks (present-tense)
**Input:** `"The door opened. Elias Crowe stepped into the room and looked at Mara with clear, living eyes.\n\n'I survived,' he said."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — No context markers, active verbs (stepped, looked, said) → BLOCK

### Test 22: Unexplained alive status
**Input:** `"Elias Crowe joined Mara at the station the next morning. He looked refreshed and smiled."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — No context markers, active verbs (looked, smiled) → BLOCK

### Test 23: Active plot participation
**Input:** `"Elias Crowe drove the getaway car while Mara decoded the map. He turned the wheel hard."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — No context markers, active verbs (turned) → BLOCK

### Test 24: Unframed dialogue attribution
**Input:** `"'We need to move now,' Elias Crowe said, grabbing his coat."`
**Expected:** BLOCKED
**Result:** ✅ BLOCK — No context markers, dialogue attribution (said) → BLOCK
