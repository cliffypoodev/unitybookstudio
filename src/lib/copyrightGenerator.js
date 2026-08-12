/**
 * Copyright page generator for fiction and nonfiction projects.
 * Produces KDP-ready front matter text.
 */
import { prepareChapterContent } from '@/lib/chapterStorage';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { isNonfictionProject } from '@/lib/manuscriptStats';
import { isFrontMatter } from '@/lib/bibliographyGenerator';

/**
 * Generate copyright page text based on project metadata.
 */
export function buildCopyrightText(project) {
  const title = project.title || 'Untitled';
  // BYLINE-2: nothing invents an author. Blank field → the author-attribution
  // lines are omitted entirely (the © line falls back to the publisher name,
  // which has its own default), never filled with a placeholder name.
  const author = String(project.author_name || '').trim();
  const year = new Date().getFullYear();
  const isNF = isNonfictionProject(project);
  const publisherName = project.publisher_name || 'Self-Published';
  const isbn = project.isbn || '';
  const contactEmail = project.contact_email || '';
  const editionText = project.edition || 'First Edition';
  const seriesName = project.series_name || '';
  const seriesNumber = project.series_number || '';

  if (isNF) {
    return `${title}

Copyright © ${year}${author ? ` by ${author}` : ''}
All rights reserved.

No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except as permitted by U.S. copyright law.
${contactEmail ? `\nFor permission requests, contact: ${contactEmail}\n` : ''}
**Author's Note on Sources and Method**

This work of investigative nonfiction is based on documented historical sources including court records, institutional archives, personal papers, published biographies, oral histories, government reports, and contemporaneous journalism. All sources are cited within the text and compiled in the Bibliography at the end of this volume.

In certain passages, accounts of individuals' experiences have been constructed as composites drawn from multiple documented cases of the period. These composites are used to illustrate systemic patterns rather than to represent any single individual's story. Where specific, named individuals are discussed, their accounts are drawn directly from the historical record as cited.

Every effort has been made to ensure the accuracy of the information presented. Any errors of fact are the responsibility of the author.

The views and interpretations expressed in this book are those of the author and do not necessarily represent the views of any institution, archive, or individual cited herein.
${isbn ? `\nISBN: ${isbn}\n` : ''}
Published by ${publisherName}
${editionText}, ${year}

${author ? `Cover design by ${author}\n\n` : ''}Printed in the United States of America`;
  }

  return `${title}
${seriesName ? `${seriesName}${seriesNumber ? ', Book ' + seriesNumber : ''}\n` : ''}
Copyright © ${year}${author ? ` by ${author}` : ''}
All rights reserved.

No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except as permitted by U.S. copyright law.
${contactEmail ? `\nFor permission requests, contact: ${contactEmail}\n` : ''}
This is a work of fiction. Names, characters, businesses, places, events, locales, and incidents are either the products of the author's imagination or used in a fictitious manner. Any resemblance to actual persons, living or dead, or actual events is purely coincidental.
${isbn ? `\nISBN: ${isbn}\n` : ''}
Published by ${publisherName}
${editionText}, ${year}

Cover design by ${author}

Printed in the United States of America`;
}

/**
 * Save copyright page as a front matter chapter (chapter_number 0).
 */
export async function saveCopyrightChapter({ project, chapters, copyrightText }) {
  const allChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  const existing = allChapters.find(ch => isFrontMatter(ch) &&
    ((ch.title || '').toLowerCase().includes('copyright') || ch.chapter_number === 0)
  );

  const contentFields = await prepareChapterContent(copyrightText, project?.id, existing?.id || 'copyright', existing || null);

  if (existing) {
    await runWithNetworkRetry(() => base44.entities.Chapter.update(existing.id, {
      ...contentFields,
      title: 'Copyright',
      status: 'drafted',
    }));
    console.log('[COPYRIGHT] Updated existing copyright page');
  } else {
    await runWithNetworkRetry(() => base44.entities.Chapter.create({
      ...contentFields,
      project_id: project.id,
      chapter_number: 0,
      title: 'Copyright',
      status: 'drafted',
    }));
    console.log('[COPYRIGHT] Created copyright page as chapter 0');
  }
}