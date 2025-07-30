import React from 'react';

interface HtmlLinkRendererProps {
  content: string;
  className?: string;
}

export function HtmlLinkRenderer({ content, className = "" }: HtmlLinkRendererProps) {
  // Function to decode HTML entities safely without innerHTML
  const decodeHtmlEntities = (text: string): string => {
    // Use the browser's built-in DOMParser for safe HTML entity decoding
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html');
    return doc.body.textContent || text;
  };

  // Debug logging
  if (content.includes('feedback_incorrect') || content.includes('feedback_correct')) {
    console.log('HtmlLinkRenderer received content:', {
      length: content.length,
      first100: content.substring(0, 100),
      last100: content.substring(content.length - 100),
      hasFeedbackTag: content.includes('feedback_incorrect') || content.includes('feedback_correct')
    });
  }

  // Function to parse HTML content and convert it to JSX elements
  const parseContent = (text: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let keyCounter = 0;
    
    // Combined regex to match various HTML tags including custom feedback tags
    // Using [\s\S] to match any character including newlines for multi-line content
    const htmlTagRegex = /<(a|b|i|strong|em|u|br|p|span|code|pre|h[1-6]|ul|ol|li|blockquote|hr|sub|sup|mark|del|ins|feedback_incorrect|feedback_correct)\b([^>]*)>([\s\S]*?)<\/\1>|<(br|hr)\s*\/?>|<\/(p|div|li)>/gi;
    
    // Process all HTML tags
    const processHtml = (htmlText: string): (string | JSX.Element)[] => {
      const htmlParts: (string | JSX.Element)[] = [];
      let htmlLastIndex = 0;
      
      const matches = Array.from(htmlText.matchAll(htmlTagRegex));
      
      for (const match of matches) {
        const matchIndex = match.index!;
        
        // Add text before the tag
        if (matchIndex > htmlLastIndex) {
          const beforeText = htmlText.slice(htmlLastIndex, matchIndex);
          if (beforeText) {
            htmlParts.push(decodeHtmlEntities(beforeText));
          }
        }
        
        const fullMatch = match[0];
        const tagName = match[1] || match[4]; // Tag name from opening tag or self-closing tag
        const attributes = match[2] || '';
        const innerContent = match[3] || '';
        
        keyCounter++;
        
        // Handle different tag types
        if (fullMatch.toLowerCase().includes('<br')) {
          // Line break
          htmlParts.push(<br key={`br-${keyCounter}`} />);
        } else if (fullMatch.toLowerCase().includes('<hr')) {
          // Horizontal rule
          htmlParts.push(<hr key={`hr-${keyCounter}`} className="my-2" />);
        } else if (fullMatch.toLowerCase().includes('</p>') || fullMatch.toLowerCase().includes('</div>') || fullMatch.toLowerCase().includes('</li>')) {
          // Add double line break for paragraph/div/li endings
          htmlParts.push('\n\n');
        } else if (tagName?.toLowerCase() === 'a') {
          // Extract href from attributes
          const hrefMatch = attributes.match(/href="([^"]*)"/);
          const href = hrefMatch ? hrefMatch[1] : '#';
          
          htmlParts.push(
            <a
              key={`link-${keyCounter}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
            >
              {processHtml(innerContent)}
            </a>
          );
        } else if (tagName?.toLowerCase() === 'b' || tagName?.toLowerCase() === 'strong') {
          // Bold text
          htmlParts.push(
            <strong key={`bold-${keyCounter}`}>
              {processHtml(innerContent)}
            </strong>
          );
        } else if (tagName?.toLowerCase() === 'i' || tagName?.toLowerCase() === 'em') {
          // Italic text
          htmlParts.push(
            <em key={`italic-${keyCounter}`}>
              {processHtml(innerContent)}
            </em>
          );
        } else if (tagName?.toLowerCase() === 'u') {
          // Underlined text
          htmlParts.push(
            <u key={`underline-${keyCounter}`}>
              {processHtml(innerContent)}
            </u>
          );
        } else if (tagName?.toLowerCase() === 'code') {
          // Inline code
          htmlParts.push(
            <code key={`code-${keyCounter}`} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">
              {decodeHtmlEntities(innerContent)}
            </code>
          );
        } else if (tagName?.toLowerCase() === 'pre') {
          // Code block
          htmlParts.push(
            <pre key={`pre-${keyCounter}`} className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
              {decodeHtmlEntities(innerContent)}
            </pre>
          );
        } else if (tagName?.toLowerCase().match(/^h[1-6]$/)) {
          // Headers
          const level = parseInt(tagName.slice(1));
          const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'];
          htmlParts.push(
            <span key={`header-${keyCounter}`} className={`${sizes[level - 1]} font-bold block my-2`}>
              {processHtml(innerContent)}
            </span>
          );
        } else if (tagName?.toLowerCase() === 'p') {
          // Paragraph
          htmlParts.push(
            <span key={`p-${keyCounter}`} className="block mb-2">
              {processHtml(innerContent)}
            </span>
          );
        } else if (tagName?.toLowerCase() === 'blockquote') {
          // Blockquote
          htmlParts.push(
            <blockquote key={`quote-${keyCounter}`} className="border-l-4 border-gray-300 pl-4 italic my-2">
              {processHtml(innerContent)}
            </blockquote>
          );
        } else if (tagName?.toLowerCase() === 'ul' || tagName?.toLowerCase() === 'ol') {
          // Lists
          const listType = tagName.toLowerCase();
          htmlParts.push(
            <span key={`list-${keyCounter}`} className={`block ${listType === 'ul' ? 'list-disc' : 'list-decimal'} ml-5 my-2`}>
              {processHtml(innerContent)}
            </span>
          );
        } else if (tagName?.toLowerCase() === 'li') {
          // List item
          htmlParts.push(
            <span key={`li-${keyCounter}`} className="block">
              • {processHtml(innerContent)}
            </span>
          );
        } else if (tagName?.toLowerCase() === 'sub') {
          // Subscript
          htmlParts.push(
            <sub key={`sub-${keyCounter}`}>
              {processHtml(innerContent)}
            </sub>
          );
        } else if (tagName?.toLowerCase() === 'sup') {
          // Superscript
          htmlParts.push(
            <sup key={`sup-${keyCounter}`}>
              {processHtml(innerContent)}
            </sup>
          );
        } else if (tagName?.toLowerCase() === 'mark') {
          // Highlighted text
          htmlParts.push(
            <mark key={`mark-${keyCounter}`} className="bg-yellow-200 dark:bg-yellow-700">
              {processHtml(innerContent)}
            </mark>
          );
        } else if (tagName?.toLowerCase() === 'del') {
          // Strikethrough
          htmlParts.push(
            <del key={`del-${keyCounter}`}>
              {processHtml(innerContent)}
            </del>
          );
        } else if (tagName?.toLowerCase() === 'ins') {
          // Inserted text
          htmlParts.push(
            <ins key={`ins-${keyCounter}`}>
              {processHtml(innerContent)}
            </ins>
          );
        } else if (tagName?.toLowerCase() === 'span') {
          // Handle span with style attribute
          const styleMatch = attributes.match(/style="([^"]*)"/);
          if (styleMatch) {
            const styleStr = styleMatch[1];
            const styleObj: React.CSSProperties = {};
            
            // Parse simple CSS properties
            styleStr.split(';').forEach(style => {
              const [property, value] = style.split(':').map(s => s.trim());
              if (property && value) {
                // Convert CSS property to camelCase
                const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                (styleObj as any)[camelProperty] = value;
              }
            });
            
            htmlParts.push(
              <span key={`span-${keyCounter}`} style={styleObj}>
                {processHtml(innerContent)}
              </span>
            );
          } else {
            // Process inner content without wrapper
            htmlParts.push(...processHtml(innerContent));
          }
        } else if (tagName?.toLowerCase() === 'feedback_incorrect') {
          // Feedback for incorrect answers - process content as array to preserve structure
          console.log('Processing feedback_incorrect tag:', {
            innerContentLength: innerContent.length,
            innerContentPreview: innerContent.substring(0, 200) + '...'
          });
          const processedContent = processHtml(innerContent);
          htmlParts.push(
            <div key={`feedback-incorrect-${keyCounter}`} className="space-y-2">
              {processedContent}
            </div>
          );
        } else if (tagName?.toLowerCase() === 'feedback_correct') {
          // Feedback for correct answers - process content as array to preserve structure
          console.log('Processing feedback_correct tag:', {
            innerContentLength: innerContent.length,
            innerContentPreview: innerContent.substring(0, 200) + '...'
          });
          const processedContent = processHtml(innerContent);
          htmlParts.push(
            <div key={`feedback-correct-${keyCounter}`} className="space-y-2">
              {processedContent}
            </div>
          );
        } else {
          // Default: just process inner content
          htmlParts.push(...processHtml(innerContent));
        }
        
        htmlLastIndex = matchIndex + fullMatch.length;
      }
      
      // Add remaining text after the last tag
      if (htmlLastIndex < htmlText.length) {
        const remainingText = htmlText.slice(htmlLastIndex);
        if (remainingText) {
          htmlParts.push(decodeHtmlEntities(remainingText));
        }
      }
      
      return htmlParts.length > 0 ? htmlParts : [htmlText];
    };
    
    return processHtml(text);
  };

  const parsedContent = parseContent(content);

  return (
    <span className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parsedContent}
    </span>
  );
}