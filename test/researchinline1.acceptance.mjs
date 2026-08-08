// RESEARCHQUALITY-2B acceptance battery — research_md is never blanked into a URL.
//
// The defect: prepareFoundationPayload offloaded any >9000-char research_md to
// the file store and BLANKED the inline field. Every closed-world gate reads
// project.research_md raw, so the polish/export lanes ran on a thinner evidence
// corpus than drafting (measured live 2026-08-08 on the flagship record:
// fate attestation 2/31 raw vs 14/31 with the brief). Fixture uses generic
// content only — no book-specific strings.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/lib/foundationStorage.js'), 'utf8');

let failures = 0;
const check = (name, pass) => {
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) failures += 1;
};

const uploads = [];
const ctx = {
  console: { log: () => {}, warn: () => {} },
  String, Number, Object, Array, Math, Date, JSON, Error, Promise, RegExp, setTimeout,
  base44: {
    functions: {
      invoke: async (fn, payload) => {
        uploads.push({ fn, field: payload.chapterId });
        return { data: { file_url: `local://x/${payload.chapterId}/${payload.filename}` } };
      },
    },
  },
  fetch: async () => ({ ok: false, status: 500 }),
};
vm.createContext(ctx);
const body = SRC.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
vm.runInContext(body.replace(/^export /gm, '') + '\nthis.prepareFoundationPayload = prepareFoundationPayload;', ctx);

const BIGR = ('The brief sentence about documented events. ').repeat(1200); // ~52k chars
const BIGW = ('World detail. ').repeat(900); // ~12.6k chars

const out = await ctx.prepareFoundationPayload(
  { id: 'proj-t', research_md: BIGR, research_md_url: 'local://old/blob', world_md: BIGW },
  'proj-t',
);
check('oversized research_md stays inline (never blanked)', out.research_md.length === BIGR.trim().length && out.research_md.length > 40000);
check('research_md is not uploaded to the file store', !uploads.some((u) => u.field === 'research_md'));
check('an existing research_md_url is left untouched for legacy reads', out.research_md_url === 'local://old/blob');
check('other oversized fields still offload and blank (world_md)', out.world_md === '' && String(out.world_md_url).startsWith('local://') && uploads.some((u) => u.field === 'world_md'));

const small = await ctx.prepareFoundationPayload({ id: 'p2', research_md: 'short brief', world_md: 'small' }, 'p2');
check('small research_md unaffected', small.research_md === 'short brief');

check('research_md remains in OVERFLOWABLE_FIELDS (hydration of legacy URL-backed records intact)', /OVERFLOWABLE_FIELDS = \[[^\]]*'research_md',/s.test(SRC));
check('INLINE_ALWAYS_FIELDS names research_md', SRC.includes("const INLINE_ALWAYS_FIELDS = ['research_md'];"));

if (failures === 0) console.log('ACCEPTANCE: ALL CHECKS MATCHED');
process.exit(failures === 0 ? 0 : 1);
