import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function parsePromptFile(text, defaultBookType) {
  const blocks = text.split(/={10,}/);
  const prompts = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || /^===\s*PROMPT\s*\d+\s*===$/.test(trimmed)) continue;

    // Remove the "=== PROMPT N ===" header if present
    const cleaned = trimmed.replace(/^===\s*PROMPT\s*\d+\s*===\s*\n*/i, '').trim();
    if (cleaned.length < 50) continue;

    // Extract category from the doubled prefix pattern: "CategoryCategory..."
    // Pattern: "Word Word...Word Word...actual content"
    let category = '';
    let content = cleaned;

    // Try to detect the doubled category prefix
    // Look for a pattern where the first ~50 chars repeat
    for (let len = 5; len <= 80; len++) {
      const candidate = cleaned.substring(0, len);
      if (cleaned.substring(len, len * 2) === candidate) {
        category = candidate.trim();
        content = cleaned.substring(len * 2).trim();
        break;
      }
    }

    // Extract a short title from the first sentence or first 100 chars
    let title = '';
    const firstSentenceMatch = content.match(/^(.{20,120}?)[.!?]\s/);
    if (firstSentenceMatch) {
      title = firstSentenceMatch[1].trim();
    } else {
      title = content.substring(0, 100).trim();
    }

    // Build description from first ~300 chars
    const description = content.substring(0, 300).trim();

    // Detect genre from category or content
    let genre = category || '';

    // Detect tags from category
    const tags = [];
    if (category) tags.push(category);

    // Detect fiction vs nonfiction
    let bookType = defaultBookType;
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('nonfiction') || lowerContent.includes('non-fiction') || lowerContent.includes('true stories') || lowerContent.includes('real-world')) {
      bookType = 'nonfiction';
    } else if (lowerContent.includes('cozy mystery') || lowerContent.includes('mystery') || lowerContent.includes('fiction') || lowerContent.includes('novel') || lowerContent.includes('story')) {
      bookType = 'fiction';
    }

    prompts.push({
      title: title.substring(0, 200),
      description: description,
      content: content,
      category: category,
      subcategory: '',
      genre: genre,
      book_type: bookType,
      tags: tags,
      word_count: 0,
    });
  }

  return prompts;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { file_urls, default_book_type } = await req.json();
    if (!file_urls || !file_urls.length) {
      return Response.json({ error: 'No file URLs provided' }, { status: 400 });
    }

    let totalImported = 0;
    const results = [];

    for (const url of file_urls) {
      console.log(`Fetching file: ${url}`);
      const response = await fetch(url);
      const text = await response.text();
      console.log(`File size: ${text.length} chars`);

      const prompts = parsePromptFile(text, default_book_type || 'fiction');
      console.log(`Parsed ${prompts.length} prompts from file`);

      // Insert in batches of 50
      const batchSize = 50;
      let fileImported = 0;
      for (let i = 0; i < prompts.length; i += batchSize) {
        const batch = prompts.slice(i, i + batchSize);
        try {
          await base44.asServiceRole.entities.PromptCatalog.bulkCreate(batch);
          fileImported += batch.length;
          console.log(`Imported batch ${Math.floor(i / batchSize) + 1}: ${batch.length} prompts`);
        } catch (err) {
          console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
          // Try one by one
          for (const prompt of batch) {
            try {
              await base44.asServiceRole.entities.PromptCatalog.create(prompt);
              fileImported++;
            } catch (innerErr) {
              console.error(`Single insert failed:`, innerErr.message);
            }
          }
        }
      }

      totalImported += fileImported;
      results.push({ url, parsed: prompts.length, imported: fileImported });
    }

    return Response.json({ success: true, totalImported, results });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});