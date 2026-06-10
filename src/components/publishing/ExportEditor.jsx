import React, { useMemo, forwardRef } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { getLineHeightValue, parseTrimSize } from '@/lib/publishConstants';

const Font = Quill.import('formats/font');

Font.whitelist = [
  'Cormorant Garamond',
  'Georgia',
  'Merriweather',
  'Libre Baskerville',
  'Lora',
  'Playfair Display',
  'Inter',
  'Arial',
  'Times New Roman',
];

Quill.register(Font, true);

const Size = Quill.import('formats/size');

Size.whitelist = [
  '10px',
  '11px',
  '12px',
  '13px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '28px',
  '32px',
  '36px',
  '48px',
];

Quill.register(Size, true);

const QUILL_MODULES = {
  toolbar: false,
  history: {
    delay: 1000,
    maxStack: 150,
    userOnly: true,
  },
  clipboard: {
    matchVisual: false,
  },
};

const QUILL_FORMATS = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'align',
  'list',
  'indent',
  'blockquote',
  'code-block',
  'link',
  'image',
];

function getPageWidth(publishSettings) {
  try {
    const dim = parseTrimSize(publishSettings?.trimSize);
    const inches = Number(dim?.w || 6);
    return Math.min(Math.max(inches * 96, 520), 850);
  } catch {
    return 672;
  }
}

const ExportEditor = forwardRef(function ExportEditor({ value, onChange, publishSettings }, ref) {
  const ps = publishSettings || {};
  const lineHeight = getLineHeightValue(ps.lineHeight);

  const pageWidth = useMemo(() => getPageWidth(ps), [ps?.trimSize]);

  const editorStyle = useMemo(
    () => ({
      fontFamily: `'${ps.paragraphFont || 'Cormorant Garamond'}', Georgia, serif`,
      fontSize: `${Math.max(Number(ps.fontSize || 12), 11)}pt`,
      lineHeight: Math.max(parseFloat(lineHeight || 1.5), 1.35),
    }),
    [ps.paragraphFont, ps.fontSize, lineHeight]
  );

  const pageStyle = useMemo(
    () => ({
      maxWidth: `${pageWidth}px`,
      minHeight: `${Math.round(pageWidth * 1.42)}px`,
    }),
    [pageWidth]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f3eee5]">
      <div className="flex shrink-0 items-center justify-between border-b border-border/35 bg-background/45 px-3 py-1.5 text-[10px] text-muted-foreground sm:px-4">
        <span>Manuscript editor</span>
        <span className="truncate">
          {ps.trimSize || '6x9'} · {ps.paragraphFont || 'Default'} · {ps.fontSize || 12}pt
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-6 sm:py-5 lg:px-8">
        <div
          className="mx-auto overflow-hidden rounded-[1rem] border border-border/50 bg-white shadow-[0_14px_35px_rgba(0,0,0,0.10)] sm:rounded-[1.4rem] sm:shadow-[0_20px_55px_rgba(0,0,0,0.12)]"
          style={pageStyle}
        >
          <div className="border-b border-border/25 bg-gradient-to-r from-muted/35 via-background to-muted/35 px-4 py-1.5 text-center text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:px-6 sm:py-2 sm:text-[10px]">
            Draft Page
          </div>

          <div className="min-h-[inherit] flex flex-col" style={editorStyle}>
            <ReactQuill
              ref={ref}
              value={value}
              onChange={onChange}
              theme="snow"
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              className="export-quill-editor flex min-h-[inherit] flex-1 flex-col [&_.ql-toolbar]:hidden [&_.ql-container]:min-h-[inherit] [&_.ql-container]:flex-1 [&_.ql-container]:border-0 [&_.ql-container]:font-inherit [&_.ql-container]:text-inherit [&_.ql-editor]:min-h-[inherit] [&_.ql-editor]:px-5 [&_.ql-editor]:py-6 sm:[&_.ql-editor]:px-12 sm:[&_.ql-editor]:py-10 lg:[&_.ql-editor]:px-16 lg:[&_.ql-editor]:py-12"
            />
          </div>
        </div>
      </div>

      <style>{`
        .export-quill-editor .ql-editor {
          color: #1f1a17;
        }

        .export-quill-editor .ql-editor p {
          margin-bottom: 0.85em;
        }

        .export-quill-editor .ql-editor h1,
        .export-quill-editor .ql-editor h2,
        .export-quill-editor .ql-editor h3 {
          font-family: inherit;
          line-height: 1.2;
        }

        .export-quill-editor .ql-editor h1 {
          text-align: center;
          margin: 1.5em 0 1em;
          font-size: 1.85em;
          font-weight: 600;
        }

        .export-quill-editor .ql-editor h2 {
          margin: 1.25em 0 0.75em;
          font-size: 1.35em;
          font-weight: 600;
        }

        .export-quill-editor .ql-editor h3 {
          margin: 1em 0 0.5em;
          font-size: 1.12em;
          font-weight: 600;
        }

        .export-quill-editor .ql-editor blockquote {
          border-left: 3px solid rgba(139, 69, 19, 0.35);
          margin: 1.25em 0;
          padding: 0.25em 0 0.25em 1em;
          color: #4c4138;
          font-style: italic;
        }

        .export-quill-editor .ql-editor ul,
        .export-quill-editor .ql-editor ol {
          margin: 0.8em 0;
        }

        .export-quill-editor .ql-editor a {
          color: #7a3f12;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .export-quill-editor .ql-editor {
            font-size: 0.95em;
          }
        }
      `}</style>
    </div>
  );
});

export default ExportEditor;