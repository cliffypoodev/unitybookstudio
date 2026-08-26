# UBS — PROOFREADER-1: app-side contract (for Claude Code, NOT for ChatGPT)
Claude (Cowork) · 2026-08-24 · anchors verified against the working tree at `2cfa197`.
Companion to `claude_UBS-PROOFREADER-n8n-chatgpt-prompt-2026-08-24.md` (the n8n side, built by ChatGPT).
The two sides meet at the HTTP contract in §5/§6 of that prompt. **Do not change the contract on this side;
if it needs changing, change the prompt first and re-issue it to ChatGPT.**

Where this sits in the master plan: after Arc B (REGENLANE-1 / POLISHSAFE-4) — it is the same
"detect → regenerate → verify → flag" rule, running outside the tab. It does not replace Arcs A–E.
It can land any time after PREFLIGHT-1 without conflicting with them, because it only adds.

## Discovery (read before changing anything; paste raw output)
```
grep -n "onFixEntireManuscript" src/pages/ProjectStudio.jsx src/components/review/ManuscriptDashboard.jsx
sed -n 56,75p vite.config.js                       # existing /llama /search-bridge /comfyui-api proxies
sed -n 498,530p vite-server-store-plugin.js        # PROTECTED_PREFIXES + session gate
grep -n "^export" src/lib/chapterStorage.js src/lib/verifiedChapterSave.js
sed -n 5760,5800p src/pages/ProjectStudio.jsx      # the NF polish SAVE LOOP — the save pattern to reuse
```
Expected: `ManuscriptDashboard.jsx:116 onFixEntireManuscript,` and `ProjectStudio.jsx:6830
… onFixEntireManuscript={handlePolishRouted} …`; `PROTECTED_PREFIXES = ['/api/store/', '/api/routerheal',
'/llama', '/search-bridge']` at line 500.

## Change 1 — `/n8n/*` proxy, session-gated (vite.config.js + vite-server-store-plugin.js)
Add a proxy entry next to `/search-bridge` (vite.config.js ~line 65):
```js
'/n8n': { target: process.env.UBS_N8N_URL || 'http://127.0.0.1:5678', changeOrigin: true,
          rewrite: (p) => p.replace(/^\/n8n/, '') },
```
Add `'/n8n'` to `PROTECTED_PREFIXES` (vite-server-store-plugin.js line 500) so LAN strangers get 401
exactly like `/llama`. The browser is the only caller; n8n never calls the app.
Env: `UBS_N8N_URL` (document in README next to `UBS_DATA_DIR`).

## Change 2 — `src/lib/proofreaderClient.js` (new, ~80 lines)
```js
export async function startProofread(payload)      // POST /n8n/webhook/ubs-proofreader/start → { job_id }
export async function proofreadStatus(jobId)       // GET  /n8n/webhook/ubs-proofreader/status?job_id=
export async function proofreadResult(jobId)       // GET  /n8n/webhook/ubs-proofreader/result?job_id=  (409 while running)
export async function cancelProofread(jobId)       // POST /n8n/webhook/ubs-proofreader/cancel
export function buildProofreadPayload({ project, chapters /* resolved */ })
```
`buildProofreadPayload` produces §6 of the prompt verbatim: `job` from the project (`book_type` via the
NFCLASS-1 authority `isNonfictionProject(project) ? 'nonfiction' : 'fiction'` — never a raw
`book_type ===` read; `content_lane`, `spice_level`, `pov_mode`, `tense`, `genre`), `project`
(`characters_md`, `banned_words` from `parseCustomBannedWords()`, `banned_names` from
`parseCustomBannedNames()`, `author_voice_notes`), `chapters` = body chapters only
(`chapterHasContent && isBodyChapter`), each `{ chapter_id: ch.id, chapter_number, title, content_md:
await resolveChapterContent(ch) }` — resolved, never `content_md` raw (PROSEFEED-1: URL-stored chapters
have an empty field). `options` from Setup with the prompt's defaults.

## Change 3 — the button + progress (ManuscriptDashboard.jsx, ProjectStudio.jsx)
Next to "Fix Entire Manuscript" add **"Proofread with fleet"** → `handleProofreadWithFleet` in
ProjectStudio.jsx, modelled on `handleManuscriptPolishNonfiction` (line ~5673):
1. `captureSnapshot('Proofreader')` (same recovery snapshot the polish handlers take).
2. Load + resolve chapters exactly as the polish handler does (`loaded = [{ chapter, content, original }]`).
3. `startProofread(buildProofreadPayload(...))` → keep `job_id` in component state **and** in
   `localStorage['ubs.proofreader.job.' + project.id]` so a tab reload can re-attach.
4. Poll `proofreadStatus` every 3 s; render `phase_label` and `percent` in the existing `busyLabel`
   slot (`setBusyLabel(formatProgressLabel(...))`) plus a small progress bar in ManuscriptDashboard.
   Cancel button → `cancelProofread`.
5. On `state: done` → `proofreadResult` → **save loop copied from the NF polish SAVE LOOP (lines
   5766–5800)**: for each returned chapter with `changed: true`, `prepareChapterContent` →
   `prepareBackupContent(original)` if no backup exists yet → `staleClear` → `Chapter.update` →
   read-back → `verifySaveParagraphMatch`. Do not write a chapter whose `reverted` is true.
   Save the report as `PublishingAsset.create({ project_id, kind: 'proofread_report', label: 'Proofreader
   <date>', content: JSON.stringify(report) })` so it shows in Saved Assets; toast the flag count.
6. `state: failed | cancelled` → toast the `error`, save nothing, leave the snapshot.
This lands in `content_md` (with `backup_content` preserved) — which is what the Export tab renders, so the
"final copy" on Export *is* the proofread text. No new entity field.

## Battery — `test/proofreader-1.test.mjs` (mock n8n with a tiny http server on a random port)
- payload builder: nonfiction project → `job.book_type === 'nonfiction'`; URL-stored chapter → resolved
  `content_md` non-empty; non-body chapters excluded.
- `/n8n/*` without a session cookie → 401 (extend the AUTH battery's LAN-stranger case).
- done-path: mocked result with one changed chapter + one `reverted: true` chapter → exactly one
  `Chapter.update`, `backup_content` set from the original, `PublishingAsset` created with kind
  `proofread_report`.
- failed-path: no `Chapter.update` calls.
- reload re-attach: `localStorage` job id → polling resumes.

## VERIFY (paste raw)
```
git diff --stat
node test/run-all.mjs 2>&1 | tail -3          # must stay 110+ green, 0 red (+ the new battery)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5180/n8n/webhook/ubs-proofreader/status?job_id=x   # 401 without cookie
```
STOP if: the diff touches `manuscriptPolishRunner.js`, `sceneWriter.js`, any detector in `src/lib`,
or any file under `data/`. This arc adds a client and a button; it changes no prose logic.
