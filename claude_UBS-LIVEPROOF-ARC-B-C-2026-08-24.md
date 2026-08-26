# LIVE PROOF — Arc B (REGENLANE-1) + Arc C (POLISHSAFE-4) on REDUX, 2026-08-24 ~15:21 CDT
Driven by Claude (Cowork) in Cliff's Chrome; evidence from the browser console + a diff of the saved
chapters against the PREFLIGHT-1 snapshot (data/recovery-backups/pre-fixplan-20260824T102514), run
through the app's own scanMalformedSentences. Code under test: HEAD b5da657e (Arc C pushed).

## Verdict: PASS for both arcs, with two findings for the next arc (below)
- [REGENLANE] lines for 16 of 20 chapters (4 had no targets): **targets 29, regenerated 19, skipped 10.**
  Every skip was a verifier rejection (`still-flagged`) — the paragraph stayed as it was. Zero new damage.
- **No** `[STRUCTURE-GUARD] Regenerate Lane … REVERTED` (the STOP condition never fired).
- `[POLISH][VOCAB]`: "No vocabulary exceeded caps" — flag path only, no `removed`.
- Save: `[POLISH-DEBUG] SAVE COMPLETE: saved=14 unchanged=6 failures=0`.
- Saved text vs snapshot (the app's own detector):
```
ch 1  malformed  2 ->  0  paras 68 -> 68  words 3870 -> 3870  CHANGED
ch 2  malformed  1 ->  0  paras 53 -> 53  words 3740 -> 3740  CHANGED
ch 3  malformed  2 ->  2  paras 144 -> 144  words 4713 -> 4713  same
ch 4  malformed 10 ->  0  paras 55 -> 55  words 4160 -> 4173  CHANGED
ch 5  malformed  0 ->  0  paras 60 -> 60  words 4207 -> 4207  same
ch 6  malformed  3 ->  3  paras 88 -> 88  words 4310 -> 4310  CHANGED
ch 7  malformed  2 ->  0  paras 99 -> 99  words 4237 -> 4238  CHANGED
ch 8  malformed 11 ->  0  paras 67 -> 67  words 4225 -> 4237  CHANGED
ch 9  malformed  0 ->  0  paras 73 -> 73  words 3670 -> 3670  same
ch10  malformed  2 ->  0  paras 216 -> 216  words 4172 -> 4175  CHANGED
ch11  malformed  0 ->  0  paras 162 -> 162  words 3629 -> 3629  same
ch12  malformed  1 ->  1  paras 163 -> 163  words 4410 -> 4410  same
ch13  malformed  1 ->  0  paras 23 -> 23  words 3930 -> 3931  CHANGED
ch14  malformed  2 ->  2  paras 68 -> 68  words 4472 -> 4472  CHANGED
ch15  malformed 25 ->  1  paras 78 -> 78  words 4198 -> 4231  CHANGED
ch16  malformed 12 ->  1  paras 66 -> 66  words 4030 -> 4040  CHANGED
ch17  malformed  0 ->  0  paras 40 -> 40  words 3894 -> 3894  same
ch18  malformed  2 ->  0  paras 66 -> 66  words 4691 -> 4693  CHANGED
ch19  malformed  1 ->  0  paras 81 -> 81  words 3796 -> 3798  CHANGED
ch20  malformed  1 ->  0  paras 45 -> 45  words 3505 -> 3506  CHANGED

TOTAL malformed 78 -> 10 | paragraphs 1715 -> 1715 | words 81859 -> 81937 (delta 78) | chapters changed 14/20
remaining by kind { 'dropped-subject': 3, 'name-echo': 1, 'bare-verb': 5, agreement: 1 }
```
  Target was ≤ 15 remaining; **78 → 10**. Paragraph count identical (1,715 → 1,715, per-chapter identical).
  Word delta +78 (+0.1%), entirely from the lane's rewrites and the subject-restoration heals.
- Remaining 10 by kind: bare-verb 5, dropped-subject 3, name-echo 1 ("JB looked at JB."), agreement 1.
  The 5 bare-verb ones are the detector's homograph blind spot ("The warmth **spread** up his arm",
  "a slow, rhythmic **throb**.", "unable to **settle**,") — not defects. The lane correctly refused to ship
  a rewrite that still tripped the scan, so nothing was harmed; the detector is what needs the fix.

## Findings (not blockers; assign to the next arcs)
1. **SUBJECTREPAIR-1 chose the wrong actor once and it is now saved.** Ch.10 para 7:
   "Thompson stopped wiping. His gaze fell on the notebook. His eyes met Sadie's. Looked back at the
   notebook." → "**Zinnia** looked back at the notebook." The actor is Thompson. The verifier accepts any
   cast name and the gender guard only fires when the sentence carries a bound pronoun, so a wrong
   *name* passes. Data fix now (edit that sentence to "He looked back at the notebook."); code fix later:
   when the preceding sentence's subject is unambiguous, the verifier should reject a different cast
   name (Arc D territory, STATECONTRACT/pronoun-lock adjacent). Ch.15 "Was wedged" → "Roderick was
   wedged" is the same shape but happens to be right (Rodge = Roderick).
2. **RESOLVED (POLISHSAFE-4-RETIRE-MIDSENTENCE-CAP-DOWNCASE, commit 644be62e).** Ch.14 para 42 "…a quiet,
   steady gaze that said, We're still here." → "…said, we're still here." Root cause: not "Sentence Case
   & Wound Repair" — `capitalizationPolish.js`'s `fixMidSentenceCaps` (part of the "Capitalization
   Hygiene" stage), which downcases common words on a safe-list after a comma or a lowercase word. "We"
   is on that list, and the pattern can't distinguish a genuine mid-sentence cap error from the start of
   an embedded clause after a comma. Both of its patterns shared the flaw; both are flag-only now,
   text is never mutated. Reproduced the exact live-proof sentence as a regression check before landing.
3. Pre-existing, harmless, worth an inventory note: "Pre-Quote Artifact Repair" and "Final Artifact
   Cleanup" tried to reduce paragraph counts on 12 chapters and were reverted by STRUCTURE-GUARD every
   time (e.g. Ch.3 144 → 130). They are effectively dead stages.
4. Detector homographs (bare-verb false positives above) — MALFORMEDSENT-1 tweak, small.
5. The polish runner logged START twice (15:21:18 and 15:21:25) after a Vite module reload
   (`?t=1787600271400`); only the second run completed and saved. Not a defect, but worth knowing that
   HMR mid-run restarts the polish from scratch.

## Bare-verb sentences the lane could not clear (for the detector fix)
- "The warmth spread up his arm, settling in his shoulder."  (Ch.6)
- "The crystal pulsed again, a slow, rhythmic throb."  (Ch.6)
- "The gauge needle bounced back and forth, unable to settle, and …"  (Ch.12)
