import React from 'react';

interface HtmlLinkRendererProps {
  content: string;
  className?: string;
}

export function HtmlLinkRenderer({ content, className = "" }: HtmlLinkRendererProps) {
  let keyCounter = 0;

  // Security function to validate URLs
  const sanitizeUrl = (url: string): string => {
    if (!url || url.trim() === '') return '#';
    
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:', 'blob:'];
    const cleanUrl = url.toLowerCase().trim().replace(/[\s\0-\x1f]/g, '');
    
    try {
      const decodedUrl = decodeURIComponent(cleanUrl).toLowerCase();
      if (dangerousProtocols.some(protocol => 
        cleanUrl.startsWith(protocol) || 
        decodedUrl.startsWith(protocol) ||
        cleanUrl.includes(`%${protocol.charCodeAt(0).toString(16)}`)
      )) {
        console.warn('Blocked potentially dangerous URL:', url);
        return '#';
      }
    } catch (e) {
      console.warn('Blocked malformed URL:', url);
      return '#';
    }
    
    return url;
  };

  // Security function to validate CSS styles
  const sanitizeStyle = (styleStr: string): React.CSSProperties => {
    const dangerousPatterns = [
      /javascript:/gi,
      /expression\s*\(/gi,
      /import\s+/gi,
      /@import/gi,
      /behavior:/gi,
      /-moz-binding:/gi,
      /url\s*\([^)]*javascript:/gi,
      /url\s*\([^)]*data:/gi,
      /on\w+\s*=/gi,
      /<script/gi,
      /&#/gi,
      /\\[0-9a-fA-F]/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(styleStr)) {
        console.warn('Blocked potentially dangerous style:', styleStr);
        return {};
      }
    }
    
    const styleObj: React.CSSProperties = {};
    styleStr.split(';').forEach(style => {
      const [property, value] = style.split(':').map(s => s.trim());
      if (property && value) {
        const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        (styleObj as any)[camelProperty] = value;
      }
    });
    
    return styleObj;
  };

  // Convert DOM node to React element recursively
  const convertNodeToReact = (node: Node): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map(convertNodeToReact).filter(child => child !== null);
    
    keyCounter++;
    const key = `${tagName}-${keyCounter}`;
    
    // Handle different HTML elements
    switch (tagName) {
      case 'a':
        const href = sanitizeUrl(element.getAttribute('href') || '');
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
          >
            {children}
          </a>
        );
        
      case 'b':
      case 'strong':
        return <strong key={key}>{children}</strong>;
        
      case 'i':
      case 'em':
        return <em key={key}>{children}</em>;
        
      case 'u':
        return <u key={key}>{children}</u>;
        
      case 'br':
        return <br key={key} />;
        
      case 'hr':
        return <hr key={key} className="my-2" />;
        
      case 'p':
        return (
          <div key={key} className="mb-2">
            {children}
          </div>
        );
        
      case 'div':
        return (
          <div key={key} className="mb-2">
            {children}
          </div>
        );
        
      case 'span':
        const styleAttr = element.getAttribute('style');
        const style = styleAttr ? sanitizeStyle(styleAttr) : {};
        return (
          <span key={key} style={style}>
            {children}
          </span>
        );
        
      case 'code':
        return (
          <code key={key} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        );
        
      case 'pre':
        return (
          <pre key={key} className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto my-2">
            {children}
          </pre>
        );
        
      case 'h1':
        return <h1 key={key} className="text-2xl font-bold my-3">{children}</h1>;
      case 'h2':
        return <h2 key={key} className="text-xl font-bold my-3">{children}</h2>;
      case 'h3':
        return <h3 key={key} className="text-lg font-bold my-2">{children}</h3>;
      case 'h4':
        return <h4 key={key} className="text-base font-bold my-2">{children}</h4>;
      case 'h5':
        return <h5 key={key} className="text-sm font-bold my-2">{children}</h5>;
      case 'h6':
        return <h6 key={key} className="text-sm font-bold my-2">{children}</h6>;
        
      case 'blockquote':
        return (
          <blockquote key={key} className="border-l-4 border-gray-300 pl-4 italic my-2">
            {children}
          </blockquote>
        );
        
      case 'ul':
        return (
          <ul key={key} className="list-disc ml-5 my-2 space-y-1">
            {children}
          </ul>
        );
        
      case 'ol':
        return (
          <ol key={key} className="list-decimal ml-5 my-2 space-y-1">
            {children}
          </ol>
        );
        
      case 'li':
        return (
          <li key={key}>
            {children}
          </li>
        );
        
      case 'sub':
        return <sub key={key}>{children}</sub>;
        
      case 'sup':
        return <sup key={key}>{children}</sup>;
        
      case 'mark':
        return (
          <mark key={key} className="bg-yellow-200 dark:bg-yellow-700">
            {children}
          </mark>
        );
        
      case 'del':
        return <del key={key}>{children}</del>;
        
      case 'ins':
        return <ins key={key}>{children}</ins>;
        
      case 'feedback_incorrect':
        return (
          <div key={key} className="bg-red-50 border border-red-200 rounded p-3 my-2">
            {children}
          </div>
        );
        
      case 'feedback_correct':
        return (
          <div key={key} className="bg-green-50 border border-green-200 rounded p-3 my-2">
            {children}
          </div>
        );
        
      default:
        // For unknown tags, just render the children
        return <span key={key}>{children}</span>;
    }
  };

  // Main parsing function using DOMParser
  const parseContent = (text: string): React.ReactNode => {
    if (!text || text.trim() === '') {
      return text;
    }
    
    try {
      // First, preserve newlines by converting them to <br> tags
      // This ensures line breaks in AI responses are maintained
      let processedText = text;
      
      // Check if the content already contains HTML tags
      const hasHtmlTags = /<[^>]+>/.test(text);
      
      if (!hasHtmlTags) {
        // If it's plain text, only wrap in paragraphs if there are actual paragraph breaks
        const paragraphs = text.split(/\n\n+/);
        
        if (paragraphs.length > 1) {
          // Multiple paragraphs - wrap each in <p> tags
          processedText = paragraphs
            .map(paragraph => {
              // Within each paragraph, replace single newlines with <br>
              return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
            })
            .join('');
        } else {
          // Single paragraph or simple text - just replace newlines with <br>
          processedText = text.replace(/\n/g, '<br>');
        }
      } else {
        // If it already has HTML, just ensure newlines within text nodes are preserved
        // by converting them to <br> tags, but only outside of existing tags
        processedText = text.replace(/(\n)(?![^<]*>)/g, '<br>');
      }
      
      // Sanitize input by removing potential script tags and other dangerous elements
      const sanitizedText = processedText
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[\s\S]*?<\/embed>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove inline event handlers
        
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${sanitizedText}</div>`, 'text/html');
      
      // Check for parser errors
      const parserErrors = doc.querySelector('parsererror');
      if (parserErrors) {
        console.warn('DOMParser encountered errors, falling back to plain text');
        return text;
      }
      
      const container = doc.body.firstChild as Element;
      if (!container) {
        return text;
      }
      
      const reactElements = Array.from(container.childNodes).map(convertNodeToReact);
      
      // Filter out null elements and return
      return reactElements.filter(element => element !== null);
      
    } catch (error) {
      console.error('Failed to parse HTML content:', error);
      // Fallback to original text
      return text;
    }
  };

  const parsedContent = parseContent(content);

  return (
    <div className={`leading-relaxed ${className}`}>
      {parsedContent}
    </div>
  );
}