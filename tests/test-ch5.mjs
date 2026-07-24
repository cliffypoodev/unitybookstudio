import { generateChapterByScenes } from '../src/lib/sceneWriter.js';
import { postDraftCleanup } from '../src/lib/postDraftCleanup.js';

const project = { id: 'test-proj', title: 'Test Book', genre: 'thriller' };
const chapter = { chapter_number: 5, title: 'Chapter 5' };
const sceneContracts = [
  { scene_id: 's1', sceneNumber: 1, required_events: ['Lena enters the room.'] },
  { scene_id: 's2', sceneNumber: 2, required_events: ['Lena destroys the brass key.'] },
  { scene_id: 's3', sceneNumber: 3, required_events: ['Lena finds a new clue.'] }
];

async function run() {
  const result = await generateChapterByScenes(project, chapter, sceneContracts);
  
  if (result?.generatedScenes && Array.isArray(result.generatedScenes)) {
    result.generatedScenes.forEach((sc, idx) => {
      console.log(`[STRUCTURED-SCENES] sceneId=${sc.sceneId || 'none'} acceptedProseChars=${sc.acceptedProse?.length || 0}`);
    });

    for (let i = 0; i < result.generatedScenes.length; i++) {
      let sceneProse = result.generatedScenes[i].acceptedProse || '';
      console.log(`- Scene ${i+1} input to postDraftCleanup: ${sceneProse.length} chars`);
      const cleanup = await postDraftCleanup(sceneProse, project, chapter.chapter_number, []);
      console.log(`- Scene ${i+1} output from postDraftCleanup: ${cleanup.text.length} chars`);
    }
  }
}
run().catch(console.error);
