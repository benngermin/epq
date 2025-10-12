import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

/**
 * Processes Markdown content to sanitized HTML
 * Supports GitHub Flavored Markdown (GFM) with tables, task lists, strikethrough, etc.
 */
export async function processMarkdown(markdown: string): Promise<string> {
  // Configure sanitization schema
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames || []),
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', // Text formatting tags
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'input', // For task list checkboxes
      'img',
      'figure', 'figcaption'
    ],
    attributes: {
      ...defaultSchema.attributes,
      '*': ['className'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      input: ['type', 'checked', 'disabled'],
      th: ['align'],
      td: ['align'],
      code: ['className'], // For syntax highlighting classes
      pre: ['className']
    },
    protocols: {
      href: ['http', 'https', 'mailto'],
      src: ['http', 'https']
    }
  };

  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm) // Support GFM features
      .use(remarkRehype, { 
        allowDangerousHtml: true // Allow raw HTML in markdown
      })
      .use(rehypeRaw) // Parse raw HTML in markdown
      .use(rehypeSanitize, sanitizeSchema) // Sanitize for security
      .use(rehypeStringify)
      .process(markdown);

    return String(result);
  } catch (error) {
    console.error('Failed to process markdown:', error);
    // Return escaped content as fallback
    const div = document.createElement('div');
    div.textContent = markdown;
    return div.innerHTML;
  }
}

/**
 * Detects if content appears to be Markdown
 */
export function isMarkdownContent(text: string): boolean {
  // Check for common Markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /^\s*[-*+]\s+/m,         // Unordered lists
    /^\s*\d+\.\s+/m,         // Ordered lists
    /\[([^\]]+)\]\(([^)]+)\)/, // Links
    /!\[([^\]]*)\]\(([^)]+)\)/, // Images
    /```[\s\S]*?```/,        // Fenced code blocks
    /`[^`]+`/,               // Inline code
    /^\|.*\|$/m,             // Tables
    /^\s*>\s+/m,             // Blockquotes
    /\*\*[^*]+\*\*/,         // Bold with complete markers
    /\*\*\w+.*?\*\*/,        // Bold text spanning content
    /\*\*\w+:/m,             // Bold label pattern (e.g., **Correct Answer:)
    /\*[^*]+\*/,             // Italic
    /__[^_]+__/,             // Alternative bold
    /_[^_]+_/,               // Alternative italic
    /~~[^~]+~~/,             // Strikethrough
    /^\s*---\s*$/m,          // Horizontal rules
    /^\s*\* \* \*\s*$/m,     // Alternative HR
    /^\s*- - -\s*$/m,        // Alternative HR
    /^\- \[[ x]\]/m          // Task lists
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Detects if content contains HTML tags
 */
export function isHtmlContent(text: string): boolean {
  // Check for HTML tags, but exclude common false positives
  const htmlPattern = /<[a-zA-Z][^>]*>/;
  const falsePositives = [
    /^<https?:\/\/[^>]+>$/,  // URLs wrapped in angle brackets
    /^<[^@]+@[^>]+>$/,        // Email addresses in angle brackets
  ];
  
  if (!htmlPattern.test(text)) {
    return false;
  }
  
  // Check if it's just a false positive
  const trimmed = text.trim();
  if (falsePositives.some(pattern => pattern.test(trimmed))) {
    return false;
  }
  
  // More specific HTML tag check
  const specificHtmlTags = /<(p|div|span|a|img|br|hr|h[1-6]|ul|ol|li|table|strong|em|code|pre|blockquote)\b[^>]*>/i;
  return specificHtmlTags.test(text);
}