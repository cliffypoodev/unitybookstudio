# 01 — Exported Manuscript Scan (v5.docx)

**Date:** 2026-06-07
**Source:** digital-equity-tribunal (5).docx
**Chapters:** 20

---

## Summary

| Chapter | Title | Words | Malformed | Quotes | Slop Total | Severity |
|---------|-------|-------|-----------|--------|------------|----------|
| 1 | Chapter 1: The Algorithmic Stage | 3896 | **0** | **0** | 47 | OK |
| 2 | Chapter 2: The Patron&apos;s Palette | 3705 | **0** | **0** | 25 | OK |
| 3 | Chapter 3: The Office of Echoes | 3210 | **0** | **0** | 26 | OK |
| 4 | Chapter 4: The Sacred Screen | 3453 | **0** | **0** | 20 | OK |
| 5 | Chapter 5: The Transit of Ghosts | 3088 | **2** | **0** | 32 | HIGH |
| 6 | Chapter 6: The Drift of Echoes | 3774 | **3** | **0** | 32 | HIGH |
| 7 | Chapter 7: The Anatomist&apos;s Stage | 3461 | **0** | **0** | 20 | OK |
| 8 | Chapter 8: The Pixelated Heir | 3375 | **0** | **0** | 23 | OK |
| 9 | Chapter 9: The Terminal Veil | 4508 | **0** | **0** | 32 | OK |
| 10 | Chapter 10: The Algorithmic Battlefield | 2804 | **1** | **0** | 19 | HIGH |
| 11 | Chapter 11: The Plaza Ledger | 3862 | **0** | **0** | 21 | OK |
| 12 | Chapter 12: The Anatomist&apos;s Protoco | 3503 | **0** | **0** | 23 | OK |
| 13 | Chapter 13: The Syntax of Survival | 3533 | **2** | **0** | 17 | HIGH |
| 14 | Chapter 14: The Incantation of Bytes | 3298 | **0** | **0** | 22 | OK |
| 15 | Chapter 15: The Transit of Errors | 2548 | **0** | **0** | 17 | OK |
| 16 | Chapter 16: The Whispering Glade | 3424 | **0** | **0** | 20 | OK |
| 17 | Chapter 17: The Echo Chamber | 2203 | **0** | **0** | 21 | OK |
| 18 | Chapter 18: The Stage of Errors | 4046 | **0** | **0** | 40 | OK |
| 19 | Chapter 19: The Threshold of Bytes | 3449 | **1** | **0** | 23 | HIGH |
| 20 | Chapter 20: The Battlefield Code | 3444 | **0** | **0** | 31 | OK |
| **TOTAL** | | | **9** | **0** | **511** | |

---

## Malformed Grammar Failures

| Chapter | Pattern | Match | Context |
|---------|---------|-------|---------|
| 5 | She were | `She were` | … gnawing weight in her chest. She were carrying an inheritan… |
| 5 | She was it | `She was it` | …ust good at selling scarcity? She was it monopolistic practi… |
| 6 | She were | `She were` | …ythm of their shared routine. She were those just metrics? S… |
| 6 | Was was | `Was was` | …most. “Why did she disappear? Was was it a failure, or was i… |
| 6 | a obvious | `a obvious` | …o longer a void of sound, but a obvious thing, pressing agai… |
| 10 | She were | `she were` | …al, almost ritualistic, as if she were performing an ancient… |
| 13 | He were | `he were` | …g on the mahogany table as if he were setting himself up for… |
| 13 | Was was | `Was was` | …the data set being corrupted? Was was it external fraud, hum… |
| 19 | He were | `he were` | …m the walls, positioned as if he were an exhibit himself. He… |

---

## Dialogue Quote Issues

No dialogue quote issues found.

---

## AI Slop Counts (Top Patterns)

| Pattern | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 | Ch6 | Ch7 | Ch8 | Ch9 | Ch10 | Total |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|-------|
| the weight of | 1 | 3 | 1 | 1 | 1 | 3 | 1 | 1 | 4 | 1 | **36** |
| felt | 19 | 17 | 13 | 11 | 16 | 15 | 11 | 7 | 19 | 11 | **254** |
| realized | 1 | 2 | 2 | 2 | 1 | 3 | 0 | 3 | 1 | 0 | **30** |
| narrative | 5 | 1 | 3 | 5 | 10 | 11 | 4 | 6 | 5 | 6 | **107** |
| performance | 17 | 0 | 6 | 1 | 3 | 0 | 4 | 5 | 2 | 0 | **69** |
| woven into | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | **6** |

---

## Top 5 Worst Chapters

### Ch.6: Chapter 6: The Drift of Echoes
- **Severity:** HIGH
- Malformed: 3, Quote issues: 0, Slop: 32
- Malformed examples:
  - `She were` → …ythm of their shared routine. She were those just metrics? S…
  - `Was was` → …most. “Why did she disappear? Was was it a failure, or was i…
  - `a obvious` → …o longer a void of sound, but a obvious thing, pressing agai…

### Ch.5: Chapter 5: The Transit of Ghosts
- **Severity:** HIGH
- Malformed: 2, Quote issues: 0, Slop: 32
- Malformed examples:
  - `She were` → … gnawing weight in her chest. She were carrying an inheritan…
  - `She was it` → …ust good at selling scarcity? She was it monopolistic practi…

### Ch.13: Chapter 13: The Syntax of Survival
- **Severity:** HIGH
- Malformed: 2, Quote issues: 0, Slop: 17
- Malformed examples:
  - `he were` → …g on the mahogany table as if he were setting himself up for…
  - `Was was` → …the data set being corrupted? Was was it external fraud, hum…

### Ch.19: Chapter 19: The Threshold of Bytes
- **Severity:** HIGH
- Malformed: 1, Quote issues: 0, Slop: 23
- Malformed examples:
  - `he were` → …m the walls, positioned as if he were an exhibit himself. He…

### Ch.10: Chapter 10: The Algorithmic Battlefield
- **Severity:** HIGH
- Malformed: 1, Quote issues: 0, Slop: 19
- Malformed examples:
  - `she were` → …al, almost ritualistic, as if she were performing an ancient…
