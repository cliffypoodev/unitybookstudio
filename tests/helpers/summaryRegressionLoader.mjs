// Test-only dependency isolation. This loader is never used by the app or draft runner.
const sources = new Map([
  ['@/lib/integrationRetry', `export async function invokeLLMWithRetry(args) {
    globalThis.__summaryTestCalls.push(args);
    return JSON.stringify({chapter:14, events:'Fixture events', physical_state:args.prompt.includes('FINAL_STATE_MARKER')?'FINAL_STATE_MARKER':'missing ending'});
  }`],
  ['@/lib/modelRouting', `export function pickModel(){return 'fixture-no-network';}`],
  ['@/api/base44Client', `export const base44={entities:{Chapter:{async update(id,fields){globalThis.__summaryTestSaves.push({id,fields});}}}};`],
  ['@/lib/chapterStorage', `export async function resolveChapterContent(c){return c.content_md||'';}`]
]);
export async function resolve(specifier, context, nextResolve) {
  if(sources.has(specifier)) return {shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(sources.get(specifier))};
  return nextResolve(specifier,context);
}
