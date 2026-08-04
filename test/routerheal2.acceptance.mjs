// ROUTERHEAL-2 acceptance. The helpers live inside the vite plugin (not exported),
// so this extracts their REAL source text by anchor and runs it against a real
// local HTTP server with stubbed shell/spawn. No logic is re-implemented here.
import fs from 'fs';
import http from 'http';
import vm from 'vm';

let failures = 0;
const check = (l, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + l); if (!ok) failures += 1; };

const SRC = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
const slice = (startMark, endMark) => {
  const a = SRC.indexOf(startMark);
  const b = SRC.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error(`anchor not found: ${startMark}`);
  return SRC.slice(a, b);
};

// ── extract the real helpers ──
const helpers = slice('function routerHealProbe()', 'async function performRouterHeal()');
check('ROUTERHEAL-2 constants are present in source',
  /ROUTERHEAL_PORT_FREE_MS\s*=\s*20000/.test(SRC) &&
  /ROUTERHEAL_SERVING_MS\s*=\s*90000/.test(SRC) &&
  /ROUTERHEAL_MIN_INTERVAL_MS\s*=\s*45000/.test(SRC));
check('healed is derived from modelsOk, not hardcoded true',
  /healed:\s*result\.modelsOk === true/.test(SRC) && !/healed:\s*true,\s*\.\.\.result/.test(SRC));
check('the fixed 5s post-spawn sleep is gone', !/routerHealSleep\(5000\)/.test(SRC));
check('the fixed 3s post-kill sleep is gone', !/routerHealSleep\(3000\)/.test(SRC));
check('a spawn retry exists', /retriedSpawn\s*=\s*true/.test(SRC));
check('cooldown can be bypassed when the router is down',
  /within cooldown but router is DOWN/.test(SRC));
check('a serving router is refused with already-serving',
  /reason:\s*'already-serving'/.test(SRC));

const PORT = 18080;
let lsofPids = '';
const ctx = {
  console: { warn() {}, log() {} },
  setTimeout,
  Date,
  ROUTERHEAL_PORT: PORT,
  ROUTERHEAL_PORT_FREE_MS: 4000,
  ROUTERHEAL_SERVING_MS: 6000,
  httpGet: (opts, cb) => http.get({ ...opts, host: '127.0.0.1' }, cb),
  routerHealExec: async () => lsofPids,
  routerHealSleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  module: {},
};
vm.createContext(ctx);
vm.runInContext(helpers + '\nthis.probe = routerHealProbe; this.portFree = routerHealPortFree; this.waitServing = routerHealWaitServing;', ctx);

const startServer = (body) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});

// ── probe ──
check('probe is false when nothing is listening', (await ctx.probe()) === false);
let srv = await startServer('{"data":[{"id":"deepseek-r1-32b"}]}');
check('probe is true against a real /v1/models response', (await ctx.probe()) === true);
await new Promise((r) => srv.close(r));

srv = await startServer('{"error":"loading"}');
check('probe is false when the body has no data array (model still loading)', (await ctx.probe()) === false);
await new Promise((r) => srv.close(r));

// ── port-free polling ──
lsofPids = '';
check('portFree returns true immediately when lsof is empty', (await ctx.portFree()) === true);
lsofPids = '12345';
const t0 = Date.now();
const stuck = await ctx.portFree();
check('portFree returns false after its deadline when the port never frees',
  stuck === false && Date.now() - t0 >= 3500);
lsofPids = '12345';
setTimeout(() => { lsofPids = ''; }, 1500);
check('portFree returns true once the port is released', (await ctx.portFree()) === true);

// ── serving polling (this is what the old fixed 5s sleep got wrong) ──
lsofPids = '';
const t1 = Date.now();
check('waitServing returns false after its deadline when nothing ever serves',
  (await ctx.waitServing()) === false && Date.now() - t1 >= 5500);

let late;
setTimeout(async () => { late = await startServer('{"data":[{"id":"x"}]}'); }, 2500);
const served = await ctx.waitServing();
check('waitServing waits out a slow cold load and returns true', served === true);
if (late) await new Promise((r) => late.close(r));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
