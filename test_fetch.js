import { base44 } from './src/api/base44Client.js';
async function run() {
  const url = "local://foundation-project/research_md/foundation-research_md-foundation-project-20260607130746-tbwy8a";
  const res = await base44.functions.invoke('fetchFromGitHub', { url });
  console.log("res:", Object.keys(res), "data keys:", res.data ? Object.keys(res.data) : null);
  if (res.data && res.data.content) console.log("content len:", res.data.content.length);
}
run().catch(console.error);
