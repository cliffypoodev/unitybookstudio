# Overcorrection Risk Report

## What We're Watching For

The anti-chatbot rules could overcorrect in 9 ways:
1. Purple prose
2. Forced fragments
3. Fake literary grit
4. Excessive sensory detail
5. Choppy rhythm
6. Loss of clarity
7. Genre mismatch
8. Nonfiction becoming too stylized
9. Dialogue becoming less natural

---

## Risk Assessment

### 1. Purple Prose

**Risk Level: LOW**

The `SIGNATURE_VOICE_BLOCK` explicitly says "Sensory details must be earned — each one should reveal character, mood, or tension. No decorative inventory." The rules push toward specificity, not ornamentation.

**Evidence:** Version B samples do not contain any ornamental similes ("like a cathedral of light"), metaphor pileups, or thesaurus-driven word choices. The prose is leaner than Version A, not more florid.

### 2. Forced Fragments

**Risk Level: MEDIUM**

The rules say "Use fragments deliberately: 'Not anymore.' 'Gone.'" and the Version B samples include fragments: "No carpet. No cubicles." "Twelve monitors. Twelve cities."

**Test Results:** The overcorrection guard test (`antiChatbotOvercorrectionGuard.test.mjs`) validates that fragment-heavy prose scores COMPETENT or better (✅). An overcorrected "forced grit" sample with excessive fragmentation scored below EXCELLENT (✅).

**Mitigation:** The word "deliberately" in the rules is key. The rules also say "Follow two short sentences with a long, complex one" — this prevents constant fragmentation.

**Watch Point:** In full-chapter output, monitor fragment percentage. More than 15% fragments in a chapter would be a red flag.

### 3. Fake Literary Grit

**Risk Level: MEDIUM**

The rules push for "concrete specificity" and "sensory detail." An LLM could interpret this as "add gritty details to everything" — the literary equivalent of Instagram filters.

**Evidence:** The overcorrected sample ("Crunch. Gravel. Door. Marcus slammed through like a freight train...") was scored correctly — it did not reach EXCELLENT. The analyzer can distinguish genuine texture from performative grit.

**Watch Point:** Monitor for "noir vocabulary padding" — adding leather, rust, blood, bone to scenes that don't warrant them.

### 4. Excessive Sensory Detail

**Risk Level: LOW-MEDIUM**

Version A (chatbot) tends toward sensory inventory: "stale coffee grounds and ozone clung to..." The rules ban this. But an LLM might replace one kind of over-description with another.

**Evidence:** Version B samples have FEWER sensory details than A, not more. The thriller B uses "Cold hit him first — industrial cold" (one sense, one adjective) vs. A's "blinking lights and humming machinery... cold air downward in steady, relentless currents" (multiple senses, multiple adjectives).

### 5. Choppy Rhythm

**Risk Level: LOW**

**Evidence:** Sentence variance in Version B ranges σ=7.9 to σ=10.1 — healthy variation, not choppy uniformity. The overcorrection guard confirms dialogue-heavy prose and fragment prose both score COMPETENT+.

### 6. Loss of Clarity

**Risk Level: LOW**

**Evidence:** Version B samples are **more** clear than A, not less. "Credit score had a higher weight than education" is clearer than "data points that functioned as a sophisticated filter that systematically disadvantaged..." The anti-chatbot rules reduce abstraction, which improves clarity.

### 7. Genre Mismatch

**Risk Level: MEDIUM**

The rules apply uniformly. A romance and a thriller get the same `SIGNATURE_VOICE_BLOCK`. The rules say "match sentence length to genre" but enforcement depends on the LLM.

**Watch Point:** If a cozy mystery starts reading like Cormac McCarthy, the genre texture section needs strengthening. This cannot be tested without live multi-genre generation.

### 8. Nonfiction Becoming Too Stylized

**Risk Level: MEDIUM**

The nonfiction Version B reads like Charles Duhigg or Michael Lewis — data-driven narrative nonfiction. This is appropriate for trade nonfiction. But:
- Academic nonfiction should not be this stylized
- Technical guides should not use narrative techniques
- Self-help should maintain conversational warmth

**Watch Point:** The `NONFICTION_HARD_RULES` and `NONFICTION_NARRATIVE_CRAFT` blocks remain empty (Phase 3 migration). When they're re-activated, they should modulate the anti-chatbot rules for different nonfiction subgenres.

### 9. Dialogue Becoming Less Natural

**Risk Level: LOW**

**Evidence:** The thriller Version B dialogue ("It's not monitoring. Look at the access tier. Full operational authority. Send, not receive.") is more natural than A's ("Not just monitoring. Control. Full operational control.") because it eliminates the "not just" construction.

The rules explicitly say "Characters should say less than they mean" and "Ban direct emotional declaration in dialogue" — both push toward more natural dialogue, not less.

---

## Overcorrection Guard Test Results

| Test | Status |
|---|---|
| Intentional fragments not penalized | ✅ 2/2 |
| Lyrical prose not penalized | ✅ 2/2 |
| Clear nonfiction not penalized | ✅ 2/2 |
| Dialogue-heavy prose not penalized | ✅ 2/2 |
| Legitimate "was" usage not over-flagged | ✅ 1/1 |
| Forced grit doesn't score EXCELLENT | ✅ 1/1 |
| SIGNATURE_VOICE_BLOCK mentions deliberate fragment usage | ✅ 1/1 |
| **Total** | **11/11** |

---

## Verdict

**Overall overcorrection risk: LOW-MEDIUM.** The rules are well-guarded against the most common failure modes (purple prose, choppy rhythm, loss of clarity, unnatural dialogue). The medium-risk areas (forced fragments, fake grit, genre mismatch, nonfiction stylization) are acknowledged in the rules and can be monitored in live output. The overcorrection guard tests all pass.
