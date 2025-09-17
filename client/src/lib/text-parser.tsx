import React, { Fragment } from "react";

/**
 * Parses text to convert URLs and markdown-style links into clickable React elements
 * Supports:
 * - Markdown links: [text](url)
 * - Plain URLs: https://example.com
 */
export function parseTextWithLinks(text: string): JSX.Element[] {
  if (!text) return [];

  // Combined regex to match both markdown links and plain URLs
  // Group 1: Full markdown link match
  // Group 2: Markdown link text
  // Group 3: Markdown link URL
  // Group 4: Plain URL
  const linkRegex = /(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s\[\]()]+)/g;
  
  const elements: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      elements.push(
        <Fragment key={`text-${keyIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      );
    }

    // Check if it's a markdown link or plain URL
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
      // Plain URL
      const plainUrl = match[4];
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
  if (lastIndex < text.length) {
    elements.push(
      <Fragment key={`text-${keyIndex++}`}>
        {text.slice(lastIndex)}
      </Fragment>
    );
  }

  // If no links were found, return the original text
  if (elements.length === 0) {
    return [<Fragment key="text-0">{text}</Fragment>];
  }

  return elements;
}