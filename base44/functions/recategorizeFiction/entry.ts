import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Maps every existing fiction category to one of 6 top-level categories
const CATEGORY_MAP = {
  // ── DRAMA ──
  'Drama': 'Drama',
  'Literary Fiction': 'Drama',
  'Inspirational': 'Drama',
  'Inspirational Fiction': 'Drama',
  'Historical Fiction': 'Drama',
  'Coming of Age': 'Drama',
  'Family Saga': 'Drama',
  'Women\'s Fiction': 'Drama',
  'Dystopian': 'Drama',
  'Speculative Fiction': 'Drama',
  'Science Fiction': 'Drama',
  'Sci-Fi': 'Drama',
  'PSYCHOLOGICAL & INTERNAL HORROR': 'Horror',
  'ACADEMIC & INSTITUTIONAL HORROR': 'Horror',

  // ── ROMANCE ──
  'Romance': 'Romance',
  'Romance & Fantasy': 'Romance',
  'Romantic Comedy': 'Romance',
  'Rom-Com': 'Romance',
  'Paranormal Romance': 'Romance',
  'Fantasy Romance': 'Romance',
  'Dark Romance': 'Romance',
  'Historical Romance': 'Romance',
  'Contemporary Romance': 'Romance',
  'Erotica': 'Romance',
  'LGBTQ+': 'Romance',

  // ── MYSTERY ──
  'Mystery': 'Mystery',
  'Mystery & Thriller': 'Mystery',
  'Cozy Mystery': 'Mystery',
  'Detective Fiction': 'Mystery',
  'Police Procedural': 'Mystery',
  'Whodunit': 'Mystery',
  'Noir': 'Mystery',
  'Crime Fiction': 'Mystery',
  'True Crime Fiction': 'Mystery',
  'Legal Thriller': 'Mystery',
  'LOVECRAFTIAN NOIR & DETECTIVE HORROR': 'Mystery',

  // ── THRILLER ──
  'Thriller': 'Thriller',
  'Thriller & Suspense': 'Thriller',
  'Psychological Thriller': 'Thriller',
  'Espionage': 'Thriller',
  'Spy Thriller': 'Thriller',
  'Political Thriller': 'Thriller',
  'Medical Thriller': 'Thriller',
  'Techno-Thriller': 'Thriller',
  'Suspense': 'Thriller',
  'Conspiracy': 'Thriller',

  // ── HORROR ──
  'Horror': 'Horror',
  'Cosmic Horror': 'Horror',
  'Gothic Horror': 'Horror',
  'Supernatural Horror': 'Horror',
  'Slasher': 'Horror',
  'Body Horror': 'Horror',
  'Folk Horror': 'Horror',
  'Lovecraftian': 'Horror',
  'ARCHAEOLOGY & ARTIFACTS': 'Horror',
  'COASTAL, MARITIME & ISLAND HORROR': 'Horror',
  'CULTS, COMMUNES & RELIGIOUS HORROR': 'Horror',
  'DIMENSIONAL & COSMIC THRESHOLD HORROR': 'Horror',
  'DREAMLANDS & ALTERED PERCEPTION': 'Horror',
  'ECOLOGICAL & ENVIRONMENTAL HORROR': 'Horror',
  'FAMILY, BLOODLINE & ANCESTRAL HORROR': 'Horror',
  'FOLK HORROR & RURAL ISOLATION': 'Horror',
  'GAMES, RITUALS & CURSED RECREATION': 'Horror',
  'HYBRID CREATURE & TRANSFORMATION HORROR': 'Horror',
  'ISOLATION & CONFINEMENT HORROR': 'Horror',
  'MEDIA, BROADCAST & SIGNAL HORROR': 'Horror',
  'MEDICAL & BODY HORROR': 'Horror',
  'MICROSCOPIC & INVISIBLE HORROR': 'Horror',
  'MUSIC, SOUND & ACOUSTIC HORROR': 'Horror',
  'NECROMANCY & DEATH RITES': 'Horror',
  'OCCULT OBJECTS & ARTIFACT HORROR': 'Horror',
  'TEMPORAL & TIME-LOOP HORROR': 'Horror',
  'UNDERGROUND & SUBTERRANEAN HORROR': 'Horror',
  'URBAN & ARCHITECTURAL HORROR': 'Horror',
  'WEATHER, ATMOSPHERIC & CELESTIAL HORROR': 'Horror',
  'WILDERNESS & SURVIVAL HORROR': 'Horror',

  // ── ACTION/ADVENTURE ──
  'Action/Adventure': 'Action/Adventure',
  'Adventure': 'Action/Adventure',
  'Action': 'Action/Adventure',
  'Fantasy': 'Action/Adventure',
  'Epic Fantasy': 'Action/Adventure',
  'Urban Fantasy': 'Action/Adventure',
  'Dark Fantasy': 'Action/Adventure',
  'Military Fiction': 'Action/Adventure',
  'Western': 'Action/Adventure',
  'Post-Apocalyptic': 'Action/Adventure',
  'Survival': 'Action/Adventure',
  'Superhero': 'Action/Adventure',
  'Steampunk': 'Action/Adventure',
  'LitRPG': 'Action/Adventure',
  'Progression Fantasy': 'Action/Adventure',
  'Sword & Sorcery': 'Action/Adventure',
};

// Fuzzy matching fallback: keywords to category
const KEYWORD_FALLBACKS = [
  { keywords: ['horror', 'lovecraft', 'cosmic', 'eldritch', 'cthulhu', 'necronomicon', 'arkham', 'occult', 'supernatural', 'haunted', 'cursed', 'nightmare', 'ritual', 'cult'], category: 'Horror' },
  { keywords: ['romance', 'love', 'romantic', 'rom-com', 'erotica', 'spice', 'passion', 'heartbreak'], category: 'Romance' },
  { keywords: ['mystery', 'detective', 'whodunit', 'cozy', 'sleuth', 'clue', 'murder mystery', 'noir'], category: 'Mystery' },
  { keywords: ['thriller', 'suspense', 'espionage', 'spy', 'conspiracy', 'chase'], category: 'Thriller' },
  { keywords: ['adventure', 'quest', 'fantasy', 'dragon', 'sword', 'magic', 'warrior', 'kingdom', 'epic', 'military', 'survival'], category: 'Action/Adventure' },
  { keywords: ['drama', 'literary', 'family', 'coming of age', 'historical', 'dystopian', 'speculative', 'inspirational'], category: 'Drama' },
];

function resolveCategory(existingCategory, existingGenre, existingSubcategory, content) {
  // 1. Direct map from existing category
  if (existingCategory && CATEGORY_MAP[existingCategory]) {
    return CATEGORY_MAP[existingCategory];
  }

  // 2. Direct map from existing genre
  if (existingGenre && CATEGORY_MAP[existingGenre]) {
    return CATEGORY_MAP[existingGenre];
  }

  // 3. Case-insensitive category match
  if (existingCategory) {
    const upperCat = existingCategory.toUpperCase();
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (key.toUpperCase() === upperCat) return val;
    }
  }

  // 4. Keyword fallback from category + genre + subcategory + content
  const searchText = [existingCategory, existingGenre, existingSubcategory, (content || '').substring(0, 500)].join(' ').toLowerCase();
  for (const fb of KEYWORD_FALLBACKS) {
    if (fb.keywords.some(kw => searchText.includes(kw))) {
      return fb.category;
    }
  }

  // 5. Default
  return 'Drama';
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // Fetch all fiction entries
  const allFiction = await base44.asServiceRole.entities.PromptCatalog.filter({ book_type: 'fiction' }, 'category', 2000);

  const stats = {};
  const updates = [];
  const unmapped = new Set();

  for (const entry of allFiction) {
    const oldCat = entry.category || '';
    const genre = entry.genre || '';
    const subcat = entry.subcategory || '';
    const content = entry.content || '';

    const newCat = resolveCategory(oldCat, genre, subcat, content);

    // Keep genre as subcategory if it's more specific than the new category
    // Use existing subcategory if present, otherwise use old category as subcategory
    let newSubcat = subcat;
    if (!newSubcat || newSubcat === oldCat) {
      // Use genre as subcategory if it's different from the new top-level
      if (genre && genre !== newCat) {
        newSubcat = genre;
      } else if (oldCat && oldCat !== newCat) {
        newSubcat = oldCat;
      }
    }

    stats[newCat] = (stats[newCat] || 0) + 1;

    if (oldCat !== newCat || entry.subcategory !== newSubcat) {
      updates.push({
        id: entry.id,
        oldCategory: oldCat,
        newCategory: newCat,
        newSubcategory: newSubcat,
        title: entry.title?.substring(0, 60),
      });
    }
  }

  if (!dryRun) {
    const batchStart = body.batchStart || 0;
    const batchSize = body.batchSize || 50;
    const batch = updates.slice(batchStart, batchStart + batchSize);
    let updated = 0;
    for (const u of batch) {
      await base44.asServiceRole.entities.PromptCatalog.update(u.id, {
        category: u.newCategory,
        subcategory: u.newSubcategory,
      });
      updated++;
      // Delay to avoid rate limiting
      if (updated % 5 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    return Response.json({
      status: batchStart + batchSize >= updates.length ? 'complete' : 'partial',
      totalFiction: allFiction.length,
      totalUpdates: updates.length,
      updatedThisBatch: updated,
      nextBatchStart: batchStart + batchSize,
      categoryDistribution: stats,
    });
  }

  return Response.json({
    status: 'dry_run',
    totalFiction: allFiction.length,
    wouldUpdate: updates.length,
    categoryDistribution: stats,
    sampleUpdates: updates.slice(0, 20),
  });
  } catch (error) {
    console.error('Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});