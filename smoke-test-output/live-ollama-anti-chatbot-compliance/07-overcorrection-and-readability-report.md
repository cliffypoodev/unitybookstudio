# 07 — Overcorrection and Readability Report

**Finding: Fiction-oriented prose rules cause overcorrection in nonfiction, producing text that is neither good fiction nor good nonfiction**

---

## The Overcorrection Problem

The `SIGNATURE_VOICE_BLOCK` contains 51 lines of prose rules organized into 8 categories: Sentence Rhythm, Concrete Specificity, Verb Strength, Paragraph Turns, Subtext and Implication, Anti-Chatbot Cadence, Silence and White Space, and Genre Texture.

Of these 8 categories, **6 are fiction-specific**:
- Sentence Rhythm ("Use fragments deliberately")
- Concrete Specificity ("Replace every generic emotion with a physical sensation")
- Paragraph Turns ("Every paragraph must change the scene's pressure")
- Subtext and Implication ("Characters should say less than they mean")
- Silence and White Space ("After a major revelation or emotional blow, let a line break do the work")
- Genre Texture ("A thriller should have velocity and edge")

Only 2 are genre-neutral:
- Verb Strength (partially — "ban filter verbs" applies to all prose)
- Anti-Chatbot Cadence (pattern bans like "not just" apply universally)

When these fiction rules are applied to narrative nonfiction, the model overcorrects — trading clarity for atmosphere, data for decoration, and precision for literary pretension.

## Evidence: Three Overcorrection Patterns

### 1. Sensory Decoration Replacing Data Precision

The rule: *"Replace every generic noun with a specific one. Not 'the building' — 'the brownstone.'"*

Applied to nonfiction, this produces:

> *Version B:* "The corner of David Hernandez's **mahogany desk** was littered with discarded printouts: payroll reports, preliminary audit checklists, and **four coffee-stained mugs holding the residue of caffeine jitters**." (line 1)

In a Michael Lewis chapter, you would never read "four coffee-stained mugs holding the residue of caffeine jitters." The "specific noun" rule made the model specify the desk wood (mahogany) and count the coffee mugs (four). These details are decorative, not functional. They don't advance the chapter's argument about algorithmic bias.

Compare Version A:

> *Version A:* "David Hernandez sat in a chair that had seen better days, surrounded by the faint, institutional scent of recycled air and stale coffee." (line 1)

"A chair that had seen better days" is generic, but it's efficient. It places the reader and moves on. The nonfiction reader is here for the algorithm, not the furniture.

### 2. Atmosphere Replacing Analysis

The rule: *"Sensory details must be earned — each one should reveal character, mood, or tension."*

In fiction, this is excellent advice. In nonfiction, it causes:

> *Version B:* "He slid a finger across the top sheet—a stack of CivicMetrics documentation—and leaned back in his ergonomic chair, **letting the squeak of the caster wheels fill the momentary void**. The air conditioning unit hummed, **a steady, low thrumming sound that seemed to measure time itself**." (line 1)

The squeaky chair and the air conditioning hum are mood-setting devices borrowed from fiction scene-craft. They consume 30+ words that Version A uses to present the algorithm's scope:

> *Version A:* "His desk at Delaney & Associates was less an office space and more a staging ground for discovery. He wasn't looking for malpractice; he was supposed to be optimizing the user experience for Milwaukee's centralized hiring platform—a system so massive it processed nearly fifty thousand applications annually across twelve major municipal employers" (line 1)

Version A's opening paragraph gives the reader the institutional context, the scale of the system, and the investigator's mandate. Version B's opening paragraph gives the reader mahogany, coffee mugs, squeaky chairs, and humming air conditioning. The trade is catastrophic for nonfiction.

### 3. Metaphor Replacing Mechanics

The rule: *"Every paragraph should contain at least one verb that only this specific scene could use."*

Applied to nonfiction data presentation:

> *Version B:* "He found that the algorithm gave undue heft—**actual mathematical muscle**—to peripheral factors." (line 7)

"Actual mathematical muscle" is a mixed metaphor applied to statistical weights. In fiction, personifying a system can build tension. In nonfiction about algorithmic bias, it obscures the mechanism. The reader needs to know that `score_zip` is weighted at 0.25. They don't need to know the algorithm has "muscle."

> *Version B:* "Their average simulated score **bled out** a quantifiable deficit." (line 11)

"Bled out" implies violence and death. It's emotionally loaded language applied to a statistical comparison. A Michael Lewis or Charles Duhigg would use: "Their average score fell 23 points below." Clean. Direct. The data *is* the shock — you don't need to tell the reader to be shocked.

## Readability Assessment — All Version B Outputs

### Thriller B — Readable but Dense

The thriller Version B is readable and paced appropriately for the genre. Sentences average 21 words. Paragraphs are moderate length. Technical jargon (GIS overlays, signal processing, spectrum analyzers) is embedded naturally through character perspective.

One readability issue: the passage is 1,125 words of continuous escalation with no pressure release. Every paragraph increases the stakes. This is exhausting for the reader. A human editor would insert one moment of mundane physical action (adjusting a flashlight, pulling off a glove) to give the reader a micro-rest.

The "adrenalized adrenaline" phrase (line 35) is a readability failure — it pulls the reader out of the story to wonder if the author had a stroke.

### Literary B — Strong Opening, Degrading Clarity

The literary Version B opens with excellent readability — sensory, grounded, clear. By the ending, the prose becomes more abstract and harder to parse:

> "Elena felt her entire body stiffen, suddenly aware of the weight of every unsaid memory pressing against her ribs." (line 33)

"The weight of every unsaid memory pressing against her ribs" is a conceptual construction that demands the reader assemble the metaphor (memories have weight, they press on ribs). It's not unreadable, but it's less immediate than the opening's "burned ozone and stale disinfectant."

The POV slip ("I could see" — line 17) is a critical readability error that would halt any reader familiar with third-person narration.

### Nonfiction B — Readability Harmed by Overcorrection

Version B nonfiction is *less readable* than Version A for its intended audience. Trade nonfiction readers expect:
- Clean declarative sentences
- Data presented without editorialization
- Efficient scene-setting that moves quickly to the argument

Version B provides:
- Atmospheric scene-setting that delays the argument
- Metaphorical language that obscures data ("mathematical muscle," "bled out")
- 27% fewer words, meaning the analysis is compressed and incomplete

The word count drop (965 → 706) is itself a readability problem. The shorter text omits intermediate analytical steps (the systematic variable zeroing that Version A includes in lines 17–21), forcing the reader to take the 23-point gap on faith rather than watching the investigator discover it.

## Genre-Specific Rule Requirements

The overcorrection evidence demands genre-conditional rules. A proposed split:

| Rule Category | Fiction | Nonfiction |
|---|---|---|
| Sentence Rhythm | Vary aggressively; use fragments | Vary moderately; no fragments |
| Concrete Specificity | Sensory details for character/mood | Specificity for data/evidence — name the variable, the number, the zip code |
| Verb Strength | Ban filter verbs | Ban hedging verbs ("seems," "appears") but allow "shows," "reveals," "demonstrates" |
| Paragraph Turns | Change emotional pressure | Change the argument's stakes — new evidence, new implication |
| Subtext | Characters say less than they mean | Data says more than the author states — let the numbers speak |
| Anti-Chatbot | Same rules apply | Same rules apply |
| Genre Texture | Match genre shelf | Match the tradition (Lewis, Duhigg, Mayer) — clarity, pacing, revelation structure |

## Conclusion

The `SIGNATURE_VOICE_BLOCK` is a fiction tool being applied as a universal tool. When the genre matches (thriller, literary fiction), it provides marginal benefit. When the genre doesn't match (nonfiction), it produces overcorrection that degrades every measured metric. The solution is not to weaken the rules for fiction — they're already marginal there. The solution is to create a separate nonfiction rule set, or to add genre-conditional logic that detects the genre from the user prompt and applies the appropriate directives.
