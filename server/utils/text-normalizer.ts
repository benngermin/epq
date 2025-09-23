/**
 * Text normalization utility for comparing question text
 * Handles HTML, markdown, whitespace, and special characters
 */

/**
 * Normalizes question text for consistent comparison
 * @param text - The text to normalize
 * @returns Normalized text suitable for comparison
 */
export function normalizeQuestionText(text: string | null | undefined): string {
  if (!text) return '';
  
  let normalized = text.toString();
  
  // Normalize unicode to consistent form
  normalized = normalized.normalize('NFKC');
  
  // Decode common HTML entities
  normalized = normalized
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
  
  // Strip HTML tags
  normalized = normalized.replace(/<[^>]*>/g, '');
  
  // Strip markdown formatting
  // Remove bold/italic markers
  normalized = normalized.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Bold
  normalized = normalized.replace(/(\*|_)(.*?)\1/g, '$2'); // Italic
  normalized = normalized.replace(/`([^`]+)`/g, '$1'); // Inline code
  normalized = normalized.replace(/^#+\s+/gm, ''); // Headers
  normalized = normalized.replace(/^>\s+/gm, ''); // Blockquotes
  normalized = normalized.replace(/^\s*[-*+]\s+/gm, ''); // Lists
  normalized = normalized.replace(/^\s*\d+\.\s+/gm, ''); // Numbered lists
  
  // Normalize quotes and dashes
  normalized = normalized
    .replace(/['']/g, "'") // Smart single quotes to simple
    .replace(/[""]/g, '"') // Smart double quotes to simple
    .replace(/[–—]/g, '-') // En/em dashes to simple dash
    .replace(/…/g, '...'); // Ellipsis
  
  // Convert to lowercase for case-insensitive comparison
  normalized = normalized.toLowerCase();
  
  // Collapse multiple spaces/tabs/newlines into single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Trim leading/trailing whitespace
  normalized = normalized.trim();
  
  return normalized;
}

/**
 * Compares two question texts after normalization
 * @param text1 - First text to compare
 * @param text2 - Second text to compare
 * @returns True if texts match after normalization
 */
export function questionTextsMatch(text1: string | null | undefined, text2: string | null | undefined): boolean {
  return normalizeQuestionText(text1) === normalizeQuestionText(text2);
}

/**
 * Creates a hash of normalized question text for efficient comparison
 * @param text - The text to hash
 * @returns A hash string suitable for database storage and comparison
 */
export function hashQuestionText(text: string | null | undefined): string {
  const normalized = normalizeQuestionText(text);
  // Simple hash for now - in production you might want to use crypto
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}