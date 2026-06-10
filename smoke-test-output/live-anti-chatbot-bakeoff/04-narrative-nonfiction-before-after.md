# Narrative Nonfiction — Before/After

## Premise
An investigative account of how a hiring algorithm used by Milwaukee's largest employers systematically disadvantaged applicants from minority neighborhoods for seven years, discovered by a consultant hired to optimize — not audit — the system.

## Version A: Baseline (Chatbot Cadence)

> The algorithm **seemed** simple enough. **It appeared** to be nothing more than a sorting function. But **the truth was that** this particular algorithm had been shaping the employment landscape of an entire metropolitan area for nearly seven years without anyone noticing.
>
> David **felt a sense of unease** as he examined the code. **He realized that** the system **wasn't just** filtering resumes; it was making decisions about human lives. **The weight of this realization settled over him** as he traced the logic tree.
>
> ...the algorithm also incorporated data points that no job applicant would expect: credit scores, zip codes, social media activity patterns...
>
> **Part of him wanted** to believe this was an oversight. **Another part** recognized the pattern. **The truth was that** these data points functioned as a sophisticated filter...
>
> **In that moment, David understood that** he wasn't looking at a bug. He was looking at a feature — one that had been operating in plain sight, hidden behind the veneer of objectivity that algorithms so effortlessly provide.

**Score: 36 (CHATBOT_SLOP)**

### Pattern Inventory
- 7 filter verbs (seemed, appeared, felt, realized, noticed)
- 1 "not just" construction
- 2 thesis statements ("The truth was that...")
- 1 balanced reflection ("Part of him wanted... Another part...")
- 1 generic emotion noun ("sense of unease")
- 1 lesson-statement ending ("In that moment, David understood...")
- **18 total chatbot patterns (66.7/1K words)**

### Critical Nonfiction Problem
This reads like an **essay-bot op-ed**, not investigative nonfiction. Real investigative writing leads with facts, names, dates, and data — not with the investigator's feelings. "David felt a sense of unease" has no place in serious nonfiction. Compare to the opening of any Michael Lewis, Jane Mayer, or Charles Duhigg chapter.

---

## Version B: Anti-Chatbot Hardened

> The algorithm was forty-seven lines of Python. A sorting function. It ranked job applicants for the City of Milwaukee's twelve largest employers by "predicted success probability," and it had been running, without audit, since 2019.
>
> David Hernandez found it on a Tuesday in March, three weeks into a consulting engagement he'd almost turned down. His firm had been hired to optimize the city's hiring platform, not investigate it. But the code repository contained a module called candidate_scorer.py, and when he opened it, the scoring weights didn't make sense.
>
> Education: 0.12. Experience: 0.15. Skills match: 0.18. Those were expected. But the function also pulled credit_score (weight: 0.22), zip_code mapped to a proprietary "community stability index" (weight: 0.19)...
>
> Credit score had a higher weight than education. Zip code mattered more than experience.
>
> ...Applicants from those zip codes scored, on average, 23 percentile points lower than applicants with identical education and experience from the North Shore.
>
> The algorithm didn't use race. It didn't need to. Zip code and credit score did the work.

**Score: 78 (GOOD)**

### What Changed
- Zero filter verbs — facts replace feelings
- "David felt a sense of unease" → "David Hernandez found it on a Tuesday in March" (full name, specific date, narrative momentum)
- "The truth was that this algorithm..." → "The algorithm was forty-seven lines of Python" (hard fact, zero commentary)
- Specific data: "Education: 0.12. Experience: 0.15." — The reader can see the discrimination in the numbers
- "Credit score had a higher weight than education." — One sentence. Devastating. No commentary needed.
- Ending: "The algorithm didn't use race. It didn't need to." — Lets the implication land. No lesson statement.

---

## 3 Strongest Improvements

**1. The Opening:** "The algorithm seemed simple enough. It appeared to be nothing more than a sorting function. But the truth was that..." → "The algorithm was forty-seven lines of Python. A sorting function." Version A opens like a chatbot essay. Version B opens like *The Big Short*. Hard fact. Specific number. No editorial commentary.

**2. The Data Presentation:** Version A says "credit scores, zip codes, social media activity patterns" (a generic list). Version B shows: "Education: 0.12. Experience: 0.15. Skills match: 0.18... credit_score (weight: 0.22)." The reader can DO THE MATH. They can see that credit score (0.22) weighs more than education (0.12). This is what investigative nonfiction looks like.

**3. The Ending:** Version A: "In that moment, David understood that he wasn't looking at a bug. He was looking at a feature — one that had been operating in plain sight, hidden behind the veneer of objectivity." Version B: "The algorithm didn't use race. It didn't need to. Zip code and credit score did the work." Same conclusion. A takes 35 words to explain it. B takes 16 words to make the reader feel it.

## 3 Weak/No-Change Examples

**1. Both versions mention zip codes and credit scores** — The factual content is the same. The improvement is in presentation, not discovery.

**2. The consulting firm's engagement** — A mentions it generically; B says "three weeks into a consulting engagement he'd almost turned down." Both establish the context. B adds texture but the core fact is the same.

**3. Neither version quotes sources** — Real investigative nonfiction would include interviews, document citations, FOIA references. This is a prose-level test, not a reporting test.

## 3 Potential Overcorrection Risks

**1. The B version is data-heavy.** "Education: 0.12. Experience: 0.15. Skills match: 0.18." — This works for a chapter opening but a full chapter at this density would exhaust a general reader. **Trade nonfiction needs accessibility.** The rules say "match sentence length to genre" — for nonfiction, that means longer explanatory passages between data bursts.

**2. "A Tuesday in March"** — Good specificity, but if every paragraph names a day of the week, it becomes a tic. Specificity should be earned.

**3. The B version has zero interiority.** "David Hernandez found it" — no emotional reaction. For a 300-word excerpt this is fine. For a full chapter, the reader needs to understand why Hernandez kept digging. Some controlled interiority (not "felt a sense of unease" but "He reran the numbers. Then he reran them again.") would add human stakes without falling into chatbot cadence.

---

## Delta

| Metric | Version A | Version B | Change |
|---|---|---|---|
| Composite Score | 36 | 78 | **+42** |
| Grade | CHATBOT_SLOP | GOOD | **+3 bands** |
| Chatbot Patterns | 18 | 7 | **-61%** |
| Filter Verb Density | 25.9/1K | 0/1K | **-100%** |
| Thesis Statements | 2 | 0 | **Eliminated** |
| Balanced Reflection | 1 | 0 | **Eliminated** |
