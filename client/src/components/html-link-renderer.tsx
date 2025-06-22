import React from 'react';

interface HtmlLinkRendererProps {
  content: string;
  className?: string;
}

export function HtmlLinkRenderer({ content, className = "" }: HtmlLinkRendererProps) {
  // Function to parse HTML links and convert them to JSX elements
  const parseContent = (text: string) => {
    // Regular expression to match HTML anchor tags
    const linkRegex = /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText) {
          parts.push(beforeText);
        }
      }

      // Add the clickable link
      const href = match[1];
      const linkText = match[2];
      
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
        >
          {linkText}
        </a>
      );

      lastIndex = linkRegex.lastIndex;
    }

    // Add remaining text after the last link
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }

    // If no links were found, return the original text
    return parts.length > 0 ? parts : [text];
  };

  const parsedContent = parseContent(content);

  return (
    <span className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parsedContent.map((part, index) => (
        <span key={index}>{part}</span>
      ))}
    </span>
  );
}