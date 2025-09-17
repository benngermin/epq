import React, { Fragment } from "react";

/**
 * Parses text to convert URLs, markdown-style links, and BBCode links into clickable React elements
 * Supports:
 * - Markdown links: [text](url)
 * - BBCode links: [url=link]text[/url] with optional [color=colorname]
 * - Plain URLs: https://example.com
 */
export function parseTextWithLinks(text: string): JSX.Element[] {
  if (!text) return [];

  // First, strip BBCode color tags while preserving the content
  // We'll handle [color=...] tags by removing them but keeping the content
  let processedText = text.replace(/\[color=[^\]]+\]/gi, '');
  processedText = processedText.replace(/\[\/color\]/gi, '');

  // Combined regex to match markdown links, BBCode URLs, and plain URLs
  // Group 1: Full markdown link match
  // Group 2: Markdown link text
  // Group 3: Markdown link URL
  // Group 4: BBCode URL match
  // Group 5: BBCode URL link
  // Group 6: BBCode URL text
  // Group 7: Plain URL
  const linkRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\[url=([^\]]+)\]([^\[]+)\[\/url\])|(https?:\/\/[^\s\[\]()]+)/gi;
  
  const elements: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = linkRegex.exec(processedText)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      elements.push(
        <Fragment key={`text-${keyIndex++}`}>
          {processedText.slice(lastIndex, match.index)}
        </Fragment>
      );
    }

    // Check if it's a markdown link, BBCode URL, or plain URL
    if (match[1]) {
      // Markdown link: [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      elements.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
          data-testid={`link-external-${keyIndex}`}
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      // BBCode URL: [url=link]text[/url]
      const bbcodeUrl = match[5];
      const bbcodeText = match[6];
      elements.push(
        <a
          key={`link-${keyIndex++}`}
          href={bbcodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
          data-testid={`link-external-${keyIndex}`}
        >
          {bbcodeText}
        </a>
      );
    } else if (match[7]) {
      // Plain URL
      const plainUrl = match[7];
      elements.push(
        <a
          key={`link-${keyIndex++}`}
          href={plainUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
          data-testid={`link-external-${keyIndex}`}
        >
          {plainUrl}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last link
  if (lastIndex < processedText.length) {
    elements.push(
      <Fragment key={`text-${keyIndex++}`}>
        {processedText.slice(lastIndex)}
      </Fragment>
    );
  }

  // If no links were found, return the original text (processedText has color tags stripped)
  if (elements.length === 0) {
    return [<Fragment key="text-0">{processedText}</Fragment>];
  }

  return elements;
}