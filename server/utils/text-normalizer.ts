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
  if (!normalized) return '';
  
  // Use a more robust hash function for better distribution
  let hash1 = 0;
  let hash2 = 0;
  
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1; // Convert to 32-bit integer
    hash2 = ((hash2 << 3) + hash2) + char;
    hash2 = hash2 & hash2;
  }
  
  // Combine both hashes for better uniqueness
  return `${Math.abs(hash1).toString(36)}_${Math.abs(hash2).toString(36)}_${normalized.length}`;
}