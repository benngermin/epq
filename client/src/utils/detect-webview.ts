// Utility to detect if the app is running in a webview
export function isWebView(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // Check for common webview indicators
  const webviewIndicators = [
    'wv',
    'webview', 
    // Android WebView
    (userAgent.includes('android') && userAgent.includes('version/')),
    // iOS WebView indicators
    (!userAgent.includes('safari') && userAgent.includes('applewebkit') && userAgent.includes('mobile')),
    // Check for specific app containers
    userAgent.includes('instagram'),
    userAgent.includes('fb_iab'),
    userAgent.includes('fban'),
    userAgent.includes('fbav'),
    userAgent.includes('twitter'),
    userAgent.includes('linkedin')
  ];
  
  // Additional check for iOS WKWebView
  const isIOSWebView = (window.navigator as any).standalone === false && 
                       /iphone|ipod|ipad/i.test(userAgent) &&
                       !/safari/i.test(userAgent);
  
  // Check if running in an iframe (common for webviews)
  const isInIframe = window.self !== window.top;
  
  return webviewIndicators.some(indicator => 
    typeof indicator === 'boolean' ? indicator : userAgent.includes(indicator)
  ) || isIOSWebView || isInIframe;
}

// Force a CSS reflow/repaint for webview compatibility
export function forceReflow(element: HTMLElement | null) {
  if (!element) return;
  
  // Force a reflow by accessing offsetHeight
  void element.offsetHeight;
  
  // Alternative method: toggle a class
  element.classList.add('reflow-trigger');
  requestAnimationFrame(() => {
    element.classList.remove('reflow-trigger');
  });
}