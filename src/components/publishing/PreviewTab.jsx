// =============================================================
// Preview Tab — Interactive page-flip book preview using StPageFlip
// =============================================================

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { buildFlipBookPages } from '@/lib/buildFlipBookPages';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';

function buildIframeDoc(pages) {
  const pagesDivs = pages.map((p, i) => {
    const density = p.hard ? ' data-density="hard"' : '';
    return `<div class="page"${density}>${p.html}</div>`;
  }).join('\n');

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
}

#book-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}

.page {
  background: #faf6ee;
  overflow: hidden;
}

/* Cover pages */
.cover-page {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 28px; text-align: center;
}
.front-cover {
  background: linear-gradient(160deg, #1a1510 0%, #2c2418 40%, #3d2e1c 100%);
  color: #f0e8d8;
}
.cover-title {
  font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700;
  line-height: 1.25; margin-bottom: 12px; letter-spacing: 0.02em;
}
.cover-subtitle {
  font-family: 'DM Sans', sans-serif; font-size: 10px;
  color: rgba(240,232,216,0.6); margin-bottom: 20px; letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cover-author {
  font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500;
  letter-spacing: 0.15em; text-transform: uppercase; color: rgba(240,232,216,0.75);
}

.back-cover {
  background: linear-gradient(160deg, #2c2418 0%, #1a1510 100%);
  color: #c8bea8;
}
.back-blurb {
  font-family: 'Merriweather', serif; font-size: 9px; line-height: 1.9;
  max-width: 85%; margin-bottom: 18px; text-align: center;
}
.back-author {
  font-family: 'DM Sans', sans-serif; font-size: 9px; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(200,190,168,0.6);
}

/* Interior pages */
.inner-page {
  padding: 22px 20px 30px; height: 100%; overflow: hidden;
}
.title-page {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
}
.tp-title {
  font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700;
  color: #2a2218; margin-bottom: 10px;
}
.tp-subtitle {
  font-family: 'DM Sans', sans-serif; font-size: 9px; color: #8a7e6e;
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px;
}
.tp-author {
  font-family: 'Merriweather', serif; font-size: 11px; color: #5a5040;
  font-style: italic;
}

.toc-page { padding-top: 30px; }
.toc-header {
  font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700;
  color: #2a2218; margin-bottom: 16px; text-align: center;
  letter-spacing: 0.04em;
}
.toc-item {
  display: flex; gap: 8px; padding: 5px 0;
  border-bottom: 1px dotted rgba(0,0,0,0.08);
  font-size: 9px; color: #5a5040;
}
.toc-num { font-family: 'DM Sans', sans-serif; font-weight: 600; white-space: nowrap; }
.toc-title { font-family: 'Merriweather', serif; font-style: italic; }

.ch-header { text-align: center; margin-bottom: 16px; padding-top: 10px; }
.ch-number {
  font-family: 'DM Sans', sans-serif; font-size: 8px; font-weight: 600;
  letter-spacing: 0.25em; text-transform: uppercase; color: #9a8e7e;
  margin-bottom: 5px;
}
.ch-title {
  font-family: 'Merriweather', serif; font-size: 15px; font-weight: 700;
  color: #2a2218; line-height: 1.3;
}
.ch-body {
  font-family: 'Merriweather', serif; font-size: 9px; line-height: 1.85;
  color: #2e2820; text-align: justify; hyphens: auto;
}
.ch-body p { margin-bottom: 0; text-indent: 1.2em; }
.ch-body.first-page p:first-child { text-indent: 0; }
.ch-body .scene-break {
  text-align: center; padding: 10px 0; color: #9a8e7e;
  font-size: 11px; letter-spacing: 0.3em;
}
.blank-page { background: #faf6ee; }
</style>
</head>
<body>
<div id="book-container">
  <div id="book">
    ${pagesDivs}
  </div>
</div>
<script>
(function() {
  var bookEl = document.getElementById('book');
  var containerEl = document.getElementById('book-container');

  var cw = containerEl.clientWidth;
  var ch = containerEl.clientHeight;

  // Book should take ~85% of the container height, maintain 2:3 aspect
  var pageH = Math.floor(ch * 0.92);
  var pageW = Math.floor(pageH * (2/3));

  // Make sure spread doesn't exceed container width
  if (pageW * 2 > cw * 0.95) {
    pageW = Math.floor(cw * 0.95 / 2);
    pageH = Math.floor(pageW * (3/2));
  }

  var pageFlip = new St.PageFlip(bookEl, {
    width: pageW,
    height: pageH,
    size: "fixed",
    drawShadow: true,
    maxShadowOpacity: 0.25,
    flippingTime: 600,
    showCover: true,
    showPageCorners: true,
    usePortrait: false,
    useMouseEvents: true,
    autoSize: false,
  });

  pageFlip.loadFromHTML(document.querySelectorAll('#book .page'));

  // Expose API to parent
  window._flipBook = pageFlip;
  window._totalPages = ${pages.length};
  window._chapterStarts = ${JSON.stringify(pages.map((p, i) => p.isChapterStart ? i : -1).filter((i) => i >= 0))};
  window._pageLabels = ${JSON.stringify(pages.map((p) => p.label))};

  function postState() {
    var idx = pageFlip.getCurrentPageIndex();
    window.parent.postMessage({
      type: 'pageflip-state',
      currentPage: idx,
      totalPages: window._totalPages,
      label: window._pageLabels[idx] || '',
    }, '*');
  }

  pageFlip.on('flip', postState);
  postState();

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'pageflip-cmd') return;
    var cmd = e.data.cmd;
    if (cmd === 'prev') pageFlip.flipPrev();
    else if (cmd === 'next') pageFlip.flipNext();
    else if (cmd === 'first') pageFlip.flip(0);
    else if (cmd === 'last') pageFlip.flip(window._totalPages - 1);
    else if (cmd === 'goto') pageFlip.flip(e.data.page);
    else if (cmd === 'prevCh') {
      var cur = pageFlip.getCurrentPageIndex();
      var cs = window._chapterStarts;
      for (var c = cs.length - 1; c >= 0; c--) {
        if (cs[c] < cur) { pageFlip.flip(cs[c]); return; }
      }
    }
    else if (cmd === 'nextCh') {
      var cur = pageFlip.getCurrentPageIndex();
      var cs = window._chapterStarts;
      for (var c = 0; c < cs.length; c++) {
        if (cs[c] > cur) { pageFlip.flip(cs[c]); return; }
      }
    }
  });
})();
<\/script>
</body></html>`;
}

export default function PreviewTab({ project, chapters }) {
  const iframeRef = useRef(null);
  const ordered = useMemo(() => [...chapters].sort((a, b) => a.chapter_number - b.chapter_number), [chapters]);
  const hasDrafts = chapters.some((ch) => chapterHasContent(ch));

  // Resolve all chapter content (handles URL-stored content)
  // Chunked fetch (5 at a time) to stay under rate limits — prevents the
  // "50+ parallel content_md_url fetches" flood that can cause 429s when
  // the Preview tab loads a large book.
  const [resolvedChapters, setResolvedChapters] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const CHUNK = 5;
    (async () => {
      const resolved = new Array(ordered.length);
      for (let i = 0; i < ordered.length; i += CHUNK) {
        if (cancelled) return;
        const chunk = ordered.slice(i, i + CHUNK);
        const results = await Promise.all(
          chunk.map(async (ch) => {
            const content = await resolveChapterContent(ch);
            return { ...ch, content_md: content };
          })
        );
        for (let j = 0; j < chunk.length; j++) resolved[i + j] = results[j];
      }
      if (!cancelled) setResolvedChapters(resolved);
    })();
    return () => { cancelled = true; };
  }, [ordered]);

  const { pages, chapterStartIndices } = useMemo(() => buildFlipBookPages(project, resolvedChapters), [project, resolvedChapters]);
  const srcDoc = useMemo(() => buildIframeDoc(pages), [pages]);

  const [currentPage, setCurrentPage] = useState(0);
  const [pageLabel, setPageLabel] = useState('Front Cover');

  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.type === 'pageflip-state') {
        setCurrentPage(e.data.currentPage);
        setPageLabel(e.data.label);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const send = (cmd, extra) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'pageflip-cmd', cmd, ...extra }, '*');
  };

  if (!hasDrafts) {
    return (
      <div className="flex h-[68vh] items-center justify-center text-sm text-muted-foreground">
        No drafted chapters to preview yet.
      </div>
    );
  }

  return (
    <div className="flex h-[72vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-[#1a1814]">
      {/* Book area */}
      <div className="min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          title="Book preview"
          srcDoc={srcDoc}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Controls bar */}
      <div className="flex flex-col items-center gap-2 border-t border-white/5 bg-[#15130f] px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[11px] text-[#a09888] hover:bg-white/10 hover:text-[#d4cfc6]"
            onClick={() => send('prevCh')}
            disabled={currentPage <= 0}
          >
            <ChevronsLeft className="h-3.5 w-3.5" /> Prev ch.
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-[#b8b0a4] hover:bg-white/10 hover:text-[#e8e0d4]"
            onClick={() => send('prev')}
            disabled={currentPage <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-[160px] text-center">
            <div className="text-xs font-medium text-[#b8b0a4]">{pageLabel}</div>
            <div className="text-[10px] text-[#6a6258]">
              Page {currentPage + 1} of {pages.length}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-[#b8b0a4] hover:bg-white/10 hover:text-[#e8e0d4]"
            onClick={() => send('next')}
            disabled={currentPage >= pages.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[11px] text-[#a09888] hover:bg-white/10 hover:text-[#d4cfc6]"
            onClick={() => send('nextCh')}
            disabled={currentPage >= pages.length - 1}
          >
            Next ch. <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Jump dots */}
        {pages.length <= 200 && (
          <div className="flex max-w-[500px] flex-wrap items-center justify-center gap-[3px]">
            {pages.map((p, i) => (
              <button
                key={i}
                onClick={() => send('goto', { page: i })}
                className={`h-[5px] rounded-full border-0 p-0 transition-all ${
                  p.isChapterStart ? 'w-[7px] rounded-sm' : 'w-[5px]'
                } ${
                  i === currentPage
                    ? 'bg-[#b8a080]'
                    : 'bg-white/10 hover:bg-white/25'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}