import { summarizeExtractedText, toMarkdownDocument } from './content.js';

export function buildPageProjection({
  engine,
  surface,
  title,
  url,
  mainText,
  markdown,
  includeMarkdown = false,
} = {}) {
  const normalizedTitle = String(title ?? '').trim() || 'Untitled';
  const normalizedUrl = String(url ?? '').trim() || 'unknown';
  const normalizedMainText = String(mainText ?? '').trim();
  const result = {
    engine: String(engine ?? 'runtime'),
    surface: String(surface ?? 'content'),
    title: normalizedTitle,
    url: normalizedUrl,
    summary: summarizeExtractedText(normalizedMainText),
    main_text: normalizedMainText,
  };

  if (markdown !== undefined) {
    result.markdown = markdown;
  } else if (includeMarkdown) {
    result.markdown = toMarkdownDocument({ title: normalizedTitle, text: normalizedMainText });
  }

  return result;
}
