import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

let failures = 0;
const check = (label, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok || !detail ? '' : `\n      ${detail}`));
  if (!ok) failures += 1;
};

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const year = new Date().getFullYear();

// 1. Functional: copyrightGenerator
const cgSrc = fs.readFileSync(path.join(ROOT, 'src/lib/copyrightGenerator.js'), 'utf8');
const cgCode = cgSrc.replace(/export\s+/g, '').replace(/import\s+.*?;/g, '');
const cgSandbox = {
  isNonfictionProject: (p) => p.fiction_or_nonfiction === 'Nonfiction'
};
vm.createContext(cgSandbox);
vm.runInContext(cgCode, cgSandbox);

const buildCopyrightText = cgSandbox.buildCopyrightText;

// Blank author
const nfBlank = buildCopyrightText({ title: 'T', fiction_or_nonfiction: 'Nonfiction', author_name: '' });
check('Copyright (Blank): NO "by Unknown Author"', !nfBlank.includes('by Unknown Author'));
check('Copyright (Blank): NO "Cover design by"', !nfBlank.includes('Cover design by'));
check('Copyright (Blank): "Copyright © <year>" present without " by "', nfBlank.includes(`Copyright © ${year}`) && !nfBlank.includes(`Copyright © ${year} by `));

const ficBlank = buildCopyrightText({ title: 'T', fiction_or_nonfiction: 'Fiction', author_name: ' ' });
check('Copyright (Fic Blank): "Copyright © <year>" present without " by "', ficBlank.includes(`Copyright © ${year}`) && !ficBlank.includes(`Copyright © ${year} by `));

// Author Vera Quill
const nfVera = buildCopyrightText({ title: 'T', fiction_or_nonfiction: 'Nonfiction', author_name: 'Vera Quill' });
check('Copyright (Vera): "Copyright © <year> by Vera Quill" present', nfVera.includes(`Copyright © ${year} by Vera Quill`));
check('Copyright (Vera): "Cover design by Vera Quill" present', nfVera.includes('Cover design by Vera Quill'));

// 2. Functional: buildFlipBookPages
const fbpSrc = fs.readFileSync(path.join(ROOT, 'src/lib/buildFlipBookPages.js'), 'utf8');
const fbpCode = fbpSrc.replace(/export\s+/g, '').replace(/import\s+.*?;/g, '');
const fbpSandbox = {
  escapeHtml: (str) => String(str),
  deduplicateChapters: (c) => c,
  buildChapterPages: () => []
};
vm.createContext(fbpSandbox);
vm.runInContext(fbpCode, fbpSandbox);

const buildFlipBookPages = fbpSandbox.buildFlipBookPages;
const pagesBlank = buildFlipBookPages({ title: 'T', author_name: '' }, []).pages;
check('Flipbook (Blank): no tp-author div', !pagesBlank.some(p => (p.html || p).includes('tp-author')));

const pagesVera = buildFlipBookPages({ title: 'T', author_name: 'Vera Quill' }, []).pages;
check('Flipbook (Vera): "by Vera Quill" rendered', pagesVera.some(p => (p.html || p).includes('<div class="tp-author">by Vera Quill</div>')));

// 3. Source assertions
const cgClean = cgSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('Source: Unknown Author absent from copyrightGenerator', !cgClean.includes('Unknown Author'));

const fbpClean = fbpSrc.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
check('Source: || \'Author\' absent from flipbook title-page', !fbpClean.includes("|| 'Author'"));

console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
