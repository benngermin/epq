/**
 * Iframe Detection Utilities
 * 
 * Provides functions to detect if the application is running within an iframe
 * and gather context information about the embedding environment.
 */

/**
 * Detects if the application is running inside an iframe
 * @returns {boolean} True if running in an iframe, false otherwise
 */
export function isInIframe(): boolean {
  try {
    // Check if window.self is different from window.top
    // This is the most reliable way to detect iframes
    return window.self !== window.top;
  } catch (e) {
    // If accessing window.top throws an error (due to cross-origin restrictions),
    // we're definitely in an iframe
    return true;
  }
}

/**
 * Detects if the application is running in Replit's preview iframe
 * @returns {boolean} True if in Replit preview, false otherwise
 */
export function isReplitPreview(): boolean {
  try {
    // Check for Replit-specific conditions
    // Replit preview runs in an iframe and has specific URL patterns
    if (!isInIframe()) {
      return false;
    }

    // Check for Replit-specific environment indicators
    const isReplitDomain = 
      window.location.hostname.includes('repl.co') ||
      window.location.hostname.includes('replit.dev') ||
      window.location.hostname.includes('replit.app') ||
      window.location.hostname.includes('replitusercontent.com');

    // Check for Replit-specific query parameters or headers
    const hasReplitParams = 
      window.location.search.includes('__replit') ||
      document.referrer.includes('repl.co') ||
      document.referrer.includes('replit.dev') ||
      document.referrer.includes('replit.app');

    return isReplitDomain || hasReplitParams;
  } catch (e) {
    console.error('Error detecting Replit preview:', e);
    return false;
  }
}

/**
 * Frame context information
 */
export interface FrameContext {
  isInIframe: boolean;
  isReplitPreview: boolean;
  parentOrigin: string | null;
  referrer: string;
  currentOrigin: string;
  currentHostname: string;
  hasParentAccess: boolean;
  crossOrigin: boolean;
  userAgent: string;
  timestamp: number;
}

/**
 * Gets detailed context information about the iframe environment
 * @returns {FrameContext} Object containing iframe context details
 */
export function getFrameContext(): FrameContext {
  const inIframe = isInIframe();
  const inReplitPreview = isReplitPreview();
  
  let parentOrigin: string | null = null;
  let hasParentAccess = false;
  let crossOrigin = false;

  if (inIframe) {
    try {
      // Try to access parent window origin
      if (window.parent && window.parent.location) {
        parentOrigin = window.parent.location.origin;
        hasParentAccess = true;
      }
    } catch (e) {
      // Cross-origin restriction - we can't access parent
      crossOrigin = true;
      // Try to get origin from referrer as fallback
      if (document.referrer) {
        try {
          const referrerUrl = new URL(document.referrer);
          parentOrigin = referrerUrl.origin;
        } catch (urlError) {
          console.error('Error parsing referrer URL:', urlError);
        }
      }
    }
  }

  return {
    isInIframe: inIframe,
    isReplitPreview: inReplitPreview,
    parentOrigin,
    referrer: document.referrer,
    currentOrigin: window.location.origin,
    currentHostname: window.location.hostname,
    hasParentAccess,
    crossOrigin,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  };
}

/**
 * Logs frame context information for debugging
 * @param {string} prefix - Optional prefix for the log message
 */
export function logFrameContext(prefix: string = 'Frame Context'): void {
  const context = getFrameContext();
  console.group(`🔍 ${prefix}`);
  console.log('In iframe:', context.isInIframe);
  console.log('Replit preview:', context.isReplitPreview);
  console.log('Current origin:', context.currentOrigin);
  console.log('Parent origin:', context.parentOrigin || 'Unknown (cross-origin)');
  console.log('Referrer:', context.referrer || 'None');
  console.log('Cross-origin:', context.crossOrigin);
  console.log('Parent access:', context.hasParentAccess);
  console.groupEnd();
}

/**
 * Attempts to communicate with parent frame if in iframe
 * @param {string} message - Message to send to parent
 * @param {any} data - Optional data to send with message
 */
export function sendMessageToParent(message: string, data?: any): void {
  if (!isInIframe()) {
    console.warn('Not in iframe, cannot send message to parent');
    return;
  }

  try {
    const payload = {
      type: 'iframe-message',
      message,
      data,
      timestamp: Date.now(),
      origin: window.location.origin
    };

    // Use '*' for targetOrigin in development, but should be specific in production
    const targetOrigin = import.meta.env.PROD ? window.location.origin : '*';
    window.parent.postMessage(payload, targetOrigin);
  } catch (e) {
    console.error('Error sending message to parent frame:', e);
  }
}

/**
 * Sets up a listener for messages from parent frame
 * @param {Function} handler - Handler function for received messages
 * @returns {Function} Cleanup function to remove the listener
 */
export function listenToParentMessages(
  handler: (event: MessageEvent) => void
): () => void {
  if (!isInIframe()) {
    console.warn('Not in iframe, parent message listener not needed');
    return () => {};
  }

  const wrappedHandler = (event: MessageEvent) => {
    // In production, verify the origin
    if (import.meta.env.PROD) {
      const allowedOrigins = [
        window.location.origin,
        'https://replit.com',
        'https://repl.co'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Received message from untrusted origin:', event.origin);
        return;
      }
    }

    handler(event);
  };

  window.addEventListener('message', wrappedHandler);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', wrappedHandler);
  };
}

/**
 * Utility to detect and handle iframe-specific errors
 * @param {Error} error - The error to check
 * @returns {boolean} True if this is likely an iframe-related error
 */
export function isIframeError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorStack = error.stack?.toLowerCase() || '';
  
  const iframeErrorPatterns = [
    'blocked a frame',
    'cross-origin',
    'permission denied',
    'sandbox',
    'x-frame-options',
    'refused to display',
    'ancestors violates',
    'frame-ancestors',
    'security error',
    'domexception'
  ];

  return iframeErrorPatterns.some(pattern => 
    errorMessage.includes(pattern) || errorStack.includes(pattern)
  );
}