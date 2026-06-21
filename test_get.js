import { base44 } from './src/api/base44Client.js';
async function run() {
  const url = "local://foundation-project/research_md/foundation-research_md-foundation-project-20260607130746-tbwy8a";
  const cleanKey = url.replace('local://', '');
  const res = await base44.entities._FileStore.get(cleanKey);
  console.log("res:", res ? Object.keys(res) : null);
  if (res && res.content) console.log("content len:", res.content.length);
}
run().catch(console.error);
