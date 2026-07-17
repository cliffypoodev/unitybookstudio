import { mergeFreshChapterRecords } from '../src/lib/exportRefreshResolver.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log('\n── TEST: exportRefreshResolver ──');

// 1. Cached Chapter 1 contains /no_think, but the newly fetched record is clean: export refreshes it and passes.
{
  const cached = [{ id: 'ch1', content_md: '/no_think', content_md_url: 'old_url', updated_date: 1 }];
  const fresh = [{ id: 'ch1', content_md_url: 'new_url', updated_date: 2 }];
  const result = mergeFreshChapterRecords(cached, fresh);
  
  assert(result[0].content_md === undefined, 'Changed content_md_url clears content_md');
  assert(result[0].__staleSnapshotRefreshed === true, 'Sets __staleSnapshotRefreshed flag');
}

// 2. Cached and freshly fetched records both contain /no_think: export remains blocked.
// (In the context of the resolver, if the record hasn't changed, it should NOT refresh).
{
  const cached = [{ id: 'ch2', content_md: '/no_think', content_md_url: 'same_url', updated_date: 1 }];
  const fresh = [{ id: 'ch2', content_md_url: 'same_url', updated_date: 1 }];
  const result = mergeFreshChapterRecords(cached, fresh);
  
  assert(result[0].content_md === '/no_think', 'Identical records keep existing content_md');
  assert(result[0].__staleSnapshotRefreshed === undefined, 'Does NOT set __staleSnapshotRefreshed flag');
}

console.log(`\n============================================================`);
console.log(`exportRefreshResolver REGRESSION: ${passed} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) process.exit(1);
