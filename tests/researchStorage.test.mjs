import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert';

console.log('── Testing researchStorage.js ──');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  return fn().then(() => {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  }).catch(err => {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failed++;
  });
}

async function main() {
  const codePath = path.resolve('src/lib/researchStorage.js');
  const code = fs.readFileSync(codePath, 'utf-8');
  const strippedCode = code.replace(/import .*;/g, '').replace(/export /g, '');

  const mockBase44 = {
    functions: {
      invoke: async (fnName, params) => {
        if (fnName === 'uploadToGitHub') {
          if (params.content.includes('FAIL_UPLOAD')) return null;
          return { data: { file_url: `local://mock/${params.chapterId}` } };
        }
        if (fnName === 'fetchFromGitHub') {
          if (params.url.includes('404')) throw new Error('404 Not Found');
          if (params.url.includes('local://mock')) return { data: { content: 'Mocked full external content fetched. It needs to be longer than fifty characters to pass the validation.' } };
          return { data: { content: null } };
        }
      }
    }
  };

  const context = vm.createContext({
    base44: mockBase44,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    }
  });

  vm.runInContext(strippedCode, context);

  // Grab the functions from the context
  const { prepareResearchContent, resolveResearchContent, checkResearchIntegrity } = context;

  await runTest('prepareResearchContent: inline if small', async () => {
    const res = await prepareResearchContent('small content', 'proj1');
    assert.strictEqual(res.research_md, 'small content');
    assert.strictEqual(res.research_md_url, '');
  });

  await runTest('prepareResearchContent: stores full text inline on upload success', async () => {
    const largeContent = 'a'.repeat(20000);
    const res = await prepareResearchContent(largeContent, 'proj1');
    assert.strictEqual(res.research_md, largeContent);
    assert.ok(res.research_md_url.startsWith('local://'));
  });

  await runTest('prepareResearchContent: stores full text inline on upload failure', async () => {
    const largeContent = 'a'.repeat(20000) + 'FAIL_UPLOAD';
    const res = await prepareResearchContent(largeContent, 'proj1');
    assert.strictEqual(res.research_md, largeContent);
    assert.strictEqual(res.research_md_url, '');
  });

  await runTest('resolveResearchContent: fetches via base44', async () => {
    const project = { research_md_url: 'local://mock/123', research_md: 'fallback' };
    const text = await resolveResearchContent(project);
    assert.strictEqual(text, 'Mocked full external content fetched. It needs to be longer than fifty characters to pass the validation.');
  });

  await runTest('resolveResearchContent: falls back to inline on fetch failure', async () => {
    const project = { research_md_url: 'http://example.com/404', research_md: 'inline fallback content' };
    const text = await resolveResearchContent(project);
    assert.strictEqual(text, 'inline fallback content');
  });

  await runTest('checkResearchIntegrity: detects dead URL + truncated stub', async () => {
    const project = { 
      research_md_url: 'http://example.com/404', 
      research_md: 'preview text\n\n[Full research stored externally]' 
    };
    const res = await checkResearchIntegrity(project);
    assert.strictEqual(res.isTruncated, true);
  });

  await runTest('checkResearchIntegrity: does not flag if fallback is full text', async () => {
    const project = { 
      research_md_url: 'http://example.com/404', 
      research_md: 'a'.repeat(1000) // Longer than 600, no marker
    };
    const res = await checkResearchIntegrity(project);
    assert.strictEqual(res.isTruncated, false);
  });

  console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
