import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { batch, totalBatches } = body;

  if (!batch || !Array.isArray(batch) || batch.length === 0) {
    return Response.json({ error: 'Missing batch array' }, { status: 400 });
  }

  let created = 0;
  let errors = 0;

  // Process in sub-batches of 25
  for (let i = 0; i < batch.length; i += 25) {
    const subBatch = batch.slice(i, i + 25);
    try {
      await base44.asServiceRole.entities.PromptCatalog.bulkCreate(subBatch);
      created += subBatch.length;
    } catch (e) {
      console.error(`Sub-batch failed at ${i}:`, e.message);
      for (const rec of subBatch) {
        try {
          await base44.asServiceRole.entities.PromptCatalog.create(rec);
          created++;
        } catch (e2) {
          errors++;
          console.error('Single fail:', rec.title?.slice(0, 40), e2.message);
        }
      }
    }
  }

  return Response.json({ created, errors, batchSize: batch.length });
});