// CLOUDROUTE-1 acceptance battery — prose/model calls are local-only.
// No network calls are made; this battery exercises the pure model guard and
// source-scans the legacy seams that previously named cloud providers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../tests/helpers/aliasLoader.mjs', import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const codeOnly = (source) => source.split('\n').filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n');
const {
  assertLocalModelId,
  isCloudModelId,
  normalizeModelId,
} = await import('../src/lib/modelRouting.js');
const { invokeLLMWithRetry } = await import('../src/lib/integrationRetry.js');

let failures = 0;
const check = (name, pass, detail) => {
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`));
  if (!pass) failures += 1;
};

check('1. installed local model IDs with vendor paths remain allowed',
  assertLocalModelId('unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL') === 'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q6_K_XL');
check('2. legacy aliases normalize to an installed local model before guarding',
  !isCloudModelId(normalizeModelId('openai_gpt5')) && !isCloudModelId(normalizeModelId('gemini_3_flash')));
check('3. Anthropic provider IDs are classified as cloud routes', isCloudModelId('anthropic/claude-sonnet-4'));
check('4. OpenRouter provider IDs are classified as cloud routes', isCloudModelId('openrouter:anthropic/claude-sonnet-4'));
check('5. cloud model IDs fail closed with a CLOUDROUTE-1 error', (() => {
  try { assertLocalModelId('anthropic/claude-sonnet-4'); return false; }
  catch (err) { return /CLOUDROUTE-1.*disabled/i.test(err.message); }
})());
check('5b. the real retry entrypoint rejects a cloud ID before any request', await (async () => {
  try {
    await invokeLLMWithRetry({ prompt: 'fixture only', task_type: 'critique', model: 'openrouter:anthropic/claude-sonnet-4' }, 1);
    return false;
  } catch (err) {
    return /CLOUDROUTE-1.*disabled/i.test(err.message);
  }
})());

{
  const retry = read('src/lib/integrationRetry.js');
  const normalizeAt = retry.indexOf('normalizeModelId(payload.model)');
  const guardAt = retry.indexOf('assertLocalModelId(resolvedModel)');
  const callAt = retry.indexOf('const callParams = {');
  check('6. the central retry path guards the normalized model before building any call',
    normalizeAt >= 0 && guardAt > normalizeAt && callAt > guardAt);
}

check('7. manuscript fixer contains no Anthropic or OpenRouter model route',
  !/anthropic|openrouter/i.test(codeOnly(read('src/lib/manuscriptFixer.js'))));
check('8. legacy polish UI contains no Anthropic or OpenRouter model route',
  !/anthropic|openrouter/i.test(codeOnly(read('src/components/tools/ProjectPolishView.jsx'))));

{
  const legacy = read('base44/functions/openRouterLLM/entry.ts');
  check('9. legacy cloud LLM function is a fail-closed 410 tombstone',
    /status:\s*410/.test(legacy) && /cloud LLM routes are disabled/i.test(legacy));
  check('10. legacy cloud LLM function has no fetch, provider URL, or API-key access',
    !/\bfetch\s*\(|https?:\/\/|API_KEY|Deno\.env/i.test(legacy));
}

{
  const client = read('src/api/base44Client.js');
  check('11. local Base44 compatibility client explicitly rejects legacy cloud LLM functions',
    /Legacy cloud LLM function/.test(client) && /not available locally/.test(client));
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
