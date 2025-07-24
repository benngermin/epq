import React from 'react';

interface HtmlLinkRendererProps {
  content: string;
  className?: string;
}

export function HtmlLinkRenderer({ content, className = "" }: HtmlLinkRendererProps) {
  // Enhanced function to parse multiple HTML tags and convert them to JSX elements
  const parseContent = (text: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = [];
    
    // Define patterns for different HTML tags we want to support
    const patterns = [
      // Links
      {
        regex: /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
        component: (match: RegExpMatchArray, key: string) => (
          <a
            key={key}
            href={match[1]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
          >
            {parseContent(match[2])}
          </a>
        )
      },
      // Bold
      {
        regex: /<b>(.*?)<\/b>/gi,
        component: (match: RegExpMatchArray, key: string) => (
          <strong key={key}>{parseContent(match[1])}</strong>
        )
      },
      // Italic
      {
        regex: /<i>(.*?)<\/i>/gi,
        component: (match: RegExpMatchArray, key: string) => (
          <em key={key}>{parseContent(match[1])}</em>
        )
      },
      // Custom feedback tags - render as styled divs
      {
        regex: /<feedback_incorrect>([\s\S]*?)<\/feedback_incorrect>/gi,
        component: (match: RegExpMatchArray, key: string) => (
          <div key={key} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg my-2">
            {parseContent(match[1])}
          </div>
        )
      },
      {
        regex: /<feedback_correct>([\s\S]*?)<\/feedback_correct>/gi,
        component: (match: RegExpMatchArray, key: string) => (
          <div key={key} className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg my-2">
            {parseContent(match[1])}
          </div>
        )
      }
    ];
    
    // Combine all patterns into one regex
    const combinedRegex = new RegExp(
      patterns.map(p => p.regex.source).join('|'),
      'gi'
    );
    
    let lastIndex = 0;
    const matches = Array.from(text.matchAll(combinedRegex));
    
    for (const match of matches) {
      const matchIndex = match.index!;
      
      // Add text before the match
      if (matchIndex > lastIndex) {
        const beforeText = text.slice(lastIndex, matchIndex);
        if (beforeText) {
          parts.push(beforeText);
        }
      }
      
      // Find which pattern matched
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const patternMatch = match[0].match(new RegExp(pattern.regex.source, 'i'));
        if (patternMatch) {
          parts.push(pattern.component(patternMatch, `${matchIndex}-${i}`));
          break;
        }
      }
      
      lastIndex = matchIndex + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }
    
    return parts.length > 0 ? parts : [text];
  };

  const parsedContent = parseContent(content);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parsedContent.map((part, index) => 
        typeof part === 'string' ? <span key={index}>{part}</span> : part
      )}
    </div>
  );
}