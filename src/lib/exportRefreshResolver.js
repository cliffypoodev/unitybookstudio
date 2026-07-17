// src/lib/exportRefreshResolver.js

/**
 * Merges cached chapters with fresh records from the database.
 * If the source identity (content_md_url or updated_date) has changed,
 * it clears content_md to force a re-resolve of the chapter body.
 */
export function mergeFreshChapterRecords(cachedChapters, freshRecords) {
  return cachedChapters.map((cached) => {
    const fresh = freshRecords.find((f) => f.id === cached.id);
    if (!fresh) return cached;

    if (
      cached.content_md_url !== fresh.content_md_url ||
      cached.updated_date !== fresh.updated_date
    ) {
      // console.log(`[EXPORT] Chapter ${cached.chapter_number} snapshot is stale. Enforcing fresh resolve.`);
      return {
        ...cached,
        ...fresh,
        content_md: undefined, // Force re-resolve
        local_editor_override: false,
        __staleSnapshotRefreshed: true,
      };
    }
    return { ...cached, ...fresh };
  });
}
