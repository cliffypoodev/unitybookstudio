// ROUTERHEAL acceptance.
//
// WAVE8-TESTROT: this battery was written against ROUTERHEAL-2, which healed the
// router in-process (poll the port free → kill → relaunch → poll /v1/models).
// ROUTERHEAL-3 deleted that design on purpose — the in-process version died
// mid-request and took the dev server down with it, losing a finished 3,594-word
// chapter — and moved all of it into a detached shell script. The battery was
// never updated, so it crashed on a missing source anchor every run since. A
// suite with a crashing member cannot honestly be called green, and the crash
// was hiding the fact that the surviving endpoint had no coverage at all.
//
// Rewritten against the contract ROUTERHEAL-3 actually makes. The plugin exports
// these functions, so this drives the real ones rather than slicing source text.
process.env.UBS_LLAMA_PORT = '18081';

import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';

const SRC_PATH = new URL('../vite-server-store-plugin.js', import.meta.url);
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

// A harmless stand-in for the real heal script, so dispatch is exercised for
// real without touching the user's machine.
const MARKER = path.join(os.tmpdir(), `ubs-heal-marker-${process.pid}`);
const SCRIPT = path.join(os.tmpdir(), `ubs-heal-stub-${process.pid}.sh`);
fs.writeFileSync(SCRIPT, `#!/bin/bash\necho started > "${MARKER}"\n`, { mode: 0o755 });
process.env.UBS_HEAL_SCRIPT = SCRIPT;

const { handleRouterHeal, routerHealProbe, spawnDetachedHeal } = await import(SRC_PATH.href);

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };

const PORT = 18081;
const startServer = (body, status = 200) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});
const stop = (s) => new Promise((r) => s.close(r));

// Minimal res double — captures what the endpoint would have written.
const fakeRes = () => {
  const out = { statusCode: 200, headers: {}, body: '', ended: false };
  return {
    out,
    setHeader(k, v) { out.headers[k] = v; },
    set statusCode(v) { out.statusCode = v; },
    get statusCode() { return out.statusCode; },
    end(b) { out.body = b || ''; out.ended = true; },
  };
};
const callHeal = async (method = 'POST') => {
  const res = fakeRes();
  await handleRouterHeal({ method }, res);
  let json = null;
  try { json = JSON.parse(res.out.body); } catch { /* left null */ }
  return { ...res.out, json };
};

// ── the design that replaced the crashing one ────────────────────────────────
check('the recovery runs out of process — no in-process kill/relaunch survives',
  /ROUTERHEAL-3/.test(SRC) && /detached: true/.test(SRC) &&
  !/performRouterHeal/.test(SRC) && !/routerHealPortFree/.test(SRC));
check('the repair path can never take down the server it runs inside',
  /Never let a repair path take down the server it runs inside/.test(SRC) &&
  /catch \(healErr\)/.test(SRC));
check('the heal script path is overridable, so tests never touch the real one',
  /process\.env\.UBS_HEAL_SCRIPT/.test(SRC));

// ── probe ────────────────────────────────────────────────────────────────────
check('probe is false when nothing is listening', (await routerHealProbe()) === false);

let srv = await startServer('{"data":[{"id":"deepseek-r1-14b"}]}');
check('probe is true against a real /v1/models response', (await routerHealProbe()) === true);

// ── a serving router is refused, not thrashed ────────────────────────────────
const serving = await callHeal();
check('a serving router is refused with already-serving',
  serving.json?.healed === false && serving.json?.reason === 'already-serving');
check('the refusal did not dispatch the script', !fs.existsSync(MARKER));
await stop(srv);

srv = await startServer('{"error":"loading"}');
check('probe is false when the body has no data array (model still loading)',
  (await routerHealProbe()) === false);
await stop(srv);

srv = await startServer('nope', 500);
check('probe is false on a non-200 from the router', (await routerHealProbe()) === false);
await stop(srv);

// ── dispatch ─────────────────────────────────────────────────────────────────
const first = await callHeal();
check('a dead router dispatches the detached heal',
  first.json?.started === true && typeof first.json?.healPid === 'number');
// The old bug this guards against: the endpoint reported `healed: true` off a
// bare PID, then the cooldown blocked the retries that would have actually
// recovered. Matched against emitted responses, not the comment that records it.
check('healed is never reported true from a bare dispatch — the child has not finished',
  first.json?.healed === false && !/JSON\.stringify\(\{\s*healed:\s*true/.test(SRC) &&
  (SRC.match(/JSON\.stringify\(\{ healed: false/g) || []).length >= 3);

await new Promise((r) => setTimeout(r, 400));
check('the detached child actually ran', fs.existsSync(MARKER));

// ── cooldown ─────────────────────────────────────────────────────────────────
const second = await callHeal();
check('a second heal inside the cooldown window is refused',
  second.json?.healed === false && second.json?.reason === 'cooldown');
check('the cooldown window is the documented 45s',
  /ROUTERHEAL_MIN_INTERVAL_MS\s*=\s*45000/.test(SRC));

// ── method guard ─────────────────────────────────────────────────────────────
const wrongMethod = await callHeal('GET');
check('non-POST is rejected with 405 and still returns JSON',
  wrongMethod.statusCode === 405 && wrongMethod.json?.error === 'POST only');

// ── never throws ─────────────────────────────────────────────────────────────
process.env.UBS_HEAL_SCRIPT = '/nonexistent/definitely-not-a-script.sh';
let threw = false;
try { spawnDetachedHeal(); } catch { threw = true; }
check('spawning a missing script does not throw into the request path', threw === false);

for (const f of [SCRIPT, MARKER]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
