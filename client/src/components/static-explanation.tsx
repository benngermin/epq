import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen, AlertCircle } from "lucide-react";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { useState, useEffect } from "react";
import { parseTextWithLinks } from "@/lib/text-parser";
import { processMarkdown, isMarkdownContent, isHtmlContent } from "@/lib/markdown-processor";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";

interface StaticExplanationProps {
  explanation: string;
  onReviewQuestion?: () => void;
  questionVersionId?: number;
}

export function StaticExplanation({ explanation, onReviewQuestion, questionVersionId }: StaticExplanationProps) {
  const [hasError, setHasError] = useState(false);
  const [processedContent, setProcessedContent] = useState<string | string[]>([]);
  const [contentType, setContentType] = useState<'plain' | 'markdown' | 'html'>('plain');
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    const processExplanation = async () => {
      try {
        // Validate and process explanation text
        if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
          setHasError(true);
          setProcessedContent(['No explanation is available for this question.']);
          setContentType('plain');
          return;
        }
        
        // Sanitize explanation text (remove potentially harmful content)
        const sanitizedExplanation = explanation
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
          .trim();
        
        // Detect content type and process accordingly
        const isHtml = isHtmlContent(sanitizedExplanation);
        const isMarkdown = isMarkdownContent(sanitizedExplanation);
        
        // Check if content has markdown syntax even if wrapped in HTML
        // Look for strong markdown patterns that indicate we should process as markdown
        const hasMarkdownSyntax = (
          sanitizedExplanation.includes('**') || 
          /\*\*[^*]+\*\*/.test(sanitizedExplanation) || // Bold text
          /\*[^*\n]+\*/.test(sanitizedExplanation) ||    // Italic text  
          sanitizedExplanation.includes('__') ||
          /_[^_\n]+_/.test(sanitizedExplanation)         // Alternative italic
        );
        
        console.log('[StaticExplanation] Content detection:', {
          isHTML: isHtml,
          isMarkdown: isMarkdown,
          hasMarkdownSyntax: hasMarkdownSyntax,
          first200Chars: sanitizedExplanation.substring(0, 200),
          hasBoldMarkers: sanitizedExplanation.includes('**'),
          hasCorrectAnswer: sanitizedExplanation.includes('**Correct Answer:**'),
          hasExplanation: sanitizedExplanation.includes('**Explanation:**'),
          totalLength: sanitizedExplanation.length
        });
        
        // If content has both HTML and markdown, extract text from HTML and process as markdown
        if (isHtml && hasMarkdownSyntax) {
          console.log('[StaticExplanation] Detected HTML-wrapped markdown, extracting text...');
          // Strip HTML tags to get pure text with markdown
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = sanitizedExplanation;
          const extractedText = tempDiv.textContent || tempDiv.innerText || '';
          
          console.log('[StaticExplanation] Extracted text:', extractedText.substring(0, 200));
          
          // Process the extracted text as markdown
          setIsProcessing(true);
          setContentType('markdown');
          const html = await processMarkdown(extractedText);
          console.log('[StaticExplanation] Processed markdown to HTML:', html.substring(0, 200));
          setProcessedContent(html);
          setHasError(false);
          setIsProcessing(false);
        } else if (isHtml && !hasMarkdownSyntax) {
          // Pure HTML content - render directly with HtmlLinkRenderer
          setContentType('html');
          setProcessedContent(sanitizedExplanation);
          setHasError(false);
        } else if (isMarkdown) {
          // Pure Markdown content - process to HTML then render
          setIsProcessing(true);
          setContentType('markdown');
          console.log('Processing markdown:', sanitizedExplanation.substring(0, 100));
          const html = await processMarkdown(sanitizedExplanation);
          console.log('Generated HTML:', html.substring(0, 500));
          console.log('Full HTML:', html);
          setProcessedContent(html);
          setHasError(false);
          setIsProcessing(false);
        } else {
          // Plain text - use existing logic
          setContentType('plain');
          const lines = sanitizedExplanation.split(/\n+/);
          const filtered = lines
            .map(line => line.trim())
            .filter(line => line.length > 0);
          
          if (filtered.length === 0) {
            setHasError(true);
            setProcessedContent(['The explanation content appears to be empty.']);
          } else {
            setHasError(false);
            setProcessedContent(filtered);
          }
        }
      } catch (error) {
        console.error('Error processing static explanation:', error);
        setHasError(true);
        setProcessedContent(['An error occurred while processing the explanation.']);
        setContentType('plain');
      }
    };
    
    processExplanation();
  }, [explanation]);
  
  // Create a unique message ID for feedback - handle missing questionVersionId
  const messageId = `static-${questionVersionId || 'unknown'}-${Date.now()}`;
  
  // Use validated questionVersionId, default to 0 if invalid
  const validQuestionVersionId = questionVersionId && questionVersionId > 0 ? questionVersionId : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-2 border-b">
        <div className="flex items-center gap-2">
          {hasError ? (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          ) : (
            <BookOpen className="h-4 w-4 text-primary" />
          )}
          <h3 className="font-semibold">
            {hasError ? 'Explanation Unavailable' : 'Explanation'}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-3xl mx-auto">
          {isProcessing ? (
            <p className="text-muted-foreground italic">Processing content...</p>
          ) : contentType === 'html' || contentType === 'markdown' ? (
            // Render HTML or processed Markdown with HtmlLinkRenderer
            <HtmlLinkRenderer 
              content={typeof processedContent === 'string' ? processedContent : ''} 
              className="prose dark:prose-invert max-w-none"
            />
          ) : (
            // Plain text rendering with parseTextWithLinks
            <div className="space-y-3">
              {Array.isArray(processedContent) && processedContent.length > 0 ? (
                processedContent.map((paragraph, index) => (
                  <p 
                    key={`paragraph-${index}`} 
                    className={`text-base leading-relaxed whitespace-pre-wrap ${
                      hasError ? 'text-muted-foreground italic' : 'text-foreground'
                    }`}
                    data-testid={`text-explanation-${index}`}
                  >
                    {hasError ? paragraph : parseTextWithLinks(paragraph)}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground italic">
                  No explanation content available.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer with feedback and Review Question button */}
      <div className="border-t">
        {/* Only show feedback buttons if we have valid content and not an error */}
        {!hasError && !isProcessing && (Array.isArray(processedContent) ? processedContent.length > 0 : processedContent) && (
          <div className="px-3 py-1 pt-[0px] pb-[0px]">
            <FeedbackButtons
              messageId={messageId}
              questionVersionId={validQuestionVersionId}
              conversation={[
                { id: messageId, role: "assistant", content: Array.isArray(processedContent) ? processedContent.join('\n\n') : explanation }
              ]}
              disclaimerText="Expert-authored explanation for this complex topic"
              variant="static"
            />
          </div>
        )}
        
        {/* Review Question button */}
        <div className="px-3 pb-2">
          {onReviewQuestion && (
            <Button
              onClick={onReviewQuestion}
              variant="outline"
              className="w-full py-2 md:py-3 text-sm md:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              data-testid="button-review-question"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Review Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}