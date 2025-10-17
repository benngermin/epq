/**
 * Utility functions for fisheye navigation scrolling
 */

/**
 * Find the scrollable container for the editor
 * Tries multiple methods to ensure compatibility
 */
export function findScrollContainer(): HTMLElement | null {
  // Method 1: Radix ScrollArea viewport (most specific)
  let element = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
  if (element) {
    console.log('Found scroll container via Radix viewport selector');
    return element;
  }
  
  // Method 2: Our custom data-role attribute
  element = document.querySelector('[data-role="editor-scroller"]') as HTMLElement;
  if (element) {
    // Check if it has the radix viewport inside
    const viewport = element.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (viewport) {
      console.log('Found scroll container via data-role with Radix viewport');
      return viewport;
    }
    console.log('Found scroll container via data-role');
    return element;
  }
  
  // Method 3: Find any element with overflow scroll/auto that contains questions
  const questionElements = document.querySelectorAll('[id^="q-"]');
  if (questionElements.length > 0) {
    let parent = questionElements[0].parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        console.log('Found scroll container via overflow detection');
        return parent as HTMLElement;
      }
      parent = parent.parentElement;
    }
  }
  
  console.error('Could not find scroll container');
  return null;
}

/**
 * Scroll to a specific question element within the editor
 * @param questionId - The ID of the question to scroll to
 * @param offset - Additional offset from top (default: 20px)
 */
export function scrollToQuestion(questionId: number, offset: number = 20): boolean {
  console.log(`Attempting to scroll to question ${questionId}`);
  
  // Find the target question element
  const questionElement = document.getElementById(`q-${questionId}`);
  if (!questionElement) {
    console.error(`Question element with id q-${questionId} not found`);
    const availableIds = Array.from(document.querySelectorAll('[id^="q-"]')).map(el => el.id);
    console.log('Available question IDs:', availableIds);
    return false;
  }
  
  // Find the scroll container
  const scrollContainer = findScrollContainer();
  if (!scrollContainer) {
    console.error('Could not find scroll container');
    return false;
  }
  
  // Find the sticky header to calculate offset
  const header = document.querySelector('[data-role="panel-header"]') as HTMLElement;
  const headerHeight = header ? header.offsetHeight : 0;
  const totalOffset = headerHeight + offset;
  
  // Calculate the scroll position
  const elementPosition = questionElement.offsetTop;
  const targetScrollTop = elementPosition - totalOffset;
  
  console.log('Scroll calculation:', {
    elementPosition,
    headerHeight,
    totalOffset,
    targetScrollTop,
    currentScroll: scrollContainer.scrollTop
  });
  
  // Perform the scroll
  scrollContainer.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth'
  });
  
  // Focus the element after scrolling
  setTimeout(() => {
    questionElement.setAttribute('tabindex', '-1');
    questionElement.focus({ preventScroll: true });
    
    // Try to focus the first input
    const firstInput = questionElement.querySelector(
      'textarea, input:not([type="hidden"]), select, button:not([data-drag-handle])'
    ) as HTMLElement;
    
    if (firstInput) {
      firstInput.focus({ preventScroll: true });
      console.log('Focused first input in question');
    }
    
    console.log('Final scroll position:', scrollContainer.scrollTop);
  }, 500);
  
  return true;
}

/**
 * Debug function to log the current DOM structure
 */
export function debugScrollStructure(): void {
  console.group('Scroll Structure Debug');
  
  const radixViewport = document.querySelector('[data-radix-scroll-area-viewport]');
  console.log('Radix viewport found:', !!radixViewport);
  
  const editorScroller = document.querySelector('[data-role="editor-scroller"]');
  console.log('Editor scroller found:', !!editorScroller);
  
  const panelHeader = document.querySelector('[data-role="panel-header"]');
  console.log('Panel header found:', !!panelHeader);
  
  const questions = document.querySelectorAll('[id^="q-"]');
  console.log('Questions found:', questions.length);
  
  if (questions.length > 0) {
    console.log('First few question IDs:', Array.from(questions).slice(0, 5).map(q => q.id));
  }
  
  // Find scrollable elements
  const allElements = document.querySelectorAll('*');
  const scrollableElements = Array.from(allElements).filter(el => {
    const style = window.getComputedStyle(el as HTMLElement);
    return style.overflowY === 'auto' || style.overflowY === 'scroll';
  });
  
  console.log('Scrollable elements found:', scrollableElements.length);
  scrollableElements.forEach((el, index) => {
    console.log(`Scrollable ${index}:`, {
      tag: el.tagName,
      className: el.className,
      id: el.id,
      dataRole: el.getAttribute('data-role')
    });
  });
  
  console.groupEnd();
}