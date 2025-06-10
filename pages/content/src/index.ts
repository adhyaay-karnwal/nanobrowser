console.log('Monarch content script loaded'); // Changed from nanobrowser

/**
 * Injects the buildDomTree.js script into the current page.
 * This script is responsible for constructing a simplified DOM tree representation.
 */
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('buildDomTree.js');
  (document.head || document.documentElement).appendChild(script);
  console.log('Monarch: buildDomTree.js injected'); // Changed from nanobrowser
} catch (e) {
  console.error('Monarch: Failed to inject buildDomTree.js:', e); // Changed from nanobrowser
}

const HIGHLIGHT_OVERLAY_ID = 'monarch-highlight-overlay'; // Changed from nanobrowser-highlight-overlay
let highlightedElements: HTMLElement[] = [];

/**
 * Removes all existing highlight overlays from the page.
 */
function cleanupHighlights() {
  const existingOverlay = document.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }
  highlightedElements = [];
}

/**
 * Creates and displays a highlight overlay over the specified DOM element.
 * @param element The DOM element to highlight.
 */
function highlightElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const highlightDiv = document.createElement('div');
  highlightDiv.id = HIGHLIGHT_OVERLAY_ID;
  // Updated styles for Monarch theme (already done in previous step, confirmed)
  highlightDiv.style.cssText = `
    position: fixed;
    left: ${rect.left + window.scrollX}px;
    top: ${rect.top + window.scrollY}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: rgba(30, 58, 138, 0.4); /* Professional dark blue, semi-transparent */
    border: 2px solid rgb(30, 58, 138); /* Solid dark blue border */
    border-radius: 4px; /* Slightly rounded corners */
    z-index: 2147483647; /* Max z-index */
    pointer-events: none; /* Allow clicks to pass through */
    box-sizing: border-box;
    transition: all 0.2s ease-in-out; /* Smooth transition for dynamic highlights */
  `;
  document.body.appendChild(highlightDiv);
  highlightedElements.push(element);
}

/**
 * Finds a clickable element, prioritizing buttons and links,
 * or the element itself if it's interactive.
 * @param element The starting DOM element.
 * @returns The interactive element or null if not found.
 */
function getClickableElement(element: HTMLElement): HTMLElement | null {
  if (
    element.tagName === 'BUTTON' ||
    element.tagName === 'A' ||
    element.tagName === 'INPUT' || // Consider various input types
    element.getAttribute('role') === 'button' ||
    element.getAttribute('role') === 'link' ||
    element.isContentEditable // Check if element is content editable
  ) {
    return element;
  }
  // Check parents for clickable elements
  let parent = element.parentElement;
  while (parent) {
    if (
      parent.tagName === 'BUTTON' ||
      parent.tagName === 'A' ||
      parent.getAttribute('role') === 'button' ||
      parent.getAttribute('role') === 'link'
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null; // No suitable clickable element found
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Monarch content script received message:', request); // Changed from nanobrowser

  if (request.action === 'highlight_elements') {
    cleanupHighlights(); // Clear previous highlights
    const { selectors } = request;
    let firstElement: HTMLElement | null = null;

    selectors.forEach((selector: string) => {
      try {
        const element = getElementBySelectorOrXpath(selector) as HTMLElement;
        if (element && isElementVisible(element)) {
          highlightElement(element);
          if (!firstElement) {
            firstElement = element;
          }
        } else {
          console.warn(`Monarch: Element not found or not visible for selector: ${selector}`); // Changed
        }
      } catch (error) {
        console.error(`Monarch: Error finding element for selector ${selector}:`, error); // Changed
      }
    });

    // Scroll to the first highlighted element if it exists
    if (firstElement) {
      firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    sendResponse({ status: 'success', count: highlightedElements.length });
  } else if (request.action === 'remove_highlight') {
    cleanupHighlights();
    sendResponse({ status: 'success' });
  } else if (request.action === 'click_element') {
    try {
      const element = getElementBySelectorOrXpath(request.selector) as HTMLElement;
      if (element && isElementVisible(element)) {
        const clickableElement = getClickableElement(element) || element;
        clickableElement.click();
        sendResponse({ status: 'success' });
      } else {
        sendResponse({ status: 'error', message: 'Element not found or not visible' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ status: 'error', message: `Failed to click element: ${errorMessage}` });
    }
  } else if (request.action === 'type_into_element') {
    try {
      const element = getElementBySelectorOrXpath(request.selector) as HTMLInputElement | HTMLTextAreaElement;
      if (element && isElementVisible(element)) {
        // Focus the element before typing
        element.focus();

        // Set the value directly
        element.value = request.text;

        // Dispatch input and change events to simulate user typing
        // and trigger any event listeners on the page
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent);

        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);

        // Blur the element after typing
        element.blur();

        sendResponse({ status: 'success' });
      } else {
        sendResponse({ status: 'error', message: 'Element not found or not visible for typing' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ status: 'error', message: `Failed to type into element: ${errorMessage}` });
    }
  } else if (request.action === 'scroll_element') {
    try {
      const element = getElementBySelectorOrXpath(request.selector) as HTMLElement;
      if (element && isElementVisible(element)) {
        element.scrollIntoView({ behavior: 'smooth', block: request.block || 'center' });
        sendResponse({ status: 'success' });
      } else {
        sendResponse({ status: 'error', message: 'Element not found or not visible for scrolling' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ status: 'error', message: `Failed to scroll to element: ${errorMessage}` });
    }
  } else if (request.action === 'get_attribute_value') {
    try {
      const element = getElementBySelectorOrXpath(request.selector) as HTMLElement;
      if (element) {
        const value = element.getAttribute(request.attributeName);
        sendResponse({ status: 'success', value: value });
      } else {
        sendResponse({ status: 'error', message: 'Element not found' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ status: 'error', message: `Failed to get attribute: ${errorMessage}` });
    }
  } else if (request.action === 'set_attribute_value') {
    try {
      const element = getElementBySelectorOrXpath(request.selector) as HTMLElement;
      if (element) {
        element.setAttribute(request.attributeName, request.value);
        sendResponse({ status: 'success' });
      } else {
        sendResponse({ status: 'error', message: 'Element not found' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ status: 'error', message: `Failed to set attribute: ${errorMessage}` });
    }
  }
  // Keep the message channel open for asynchronous responses
  return true;
});

/**
 * Retrieves a DOM element using either a CSS selector or an XPath expression.
 * @param selectorOrXpath The CSS selector or XPath expression.
 * @returns The found HTMLElement or null if not found.
 */
function getElementBySelectorOrXpath(selectorOrXpath: string): HTMLElement | null {
  try {
    // Try querySelector first
    const element = document.querySelector(selectorOrXpath) as HTMLElement;
    if (element) return element;
  } catch (e) {
    // querySelector might fail with complex XPaths, so we ignore the error and try XPath
    // console.warn('Monarch: Failed to use querySelector, trying XPath:', e); // Changed
  }

  try {
    // Try XPath if querySelector fails or returns null
    const xpathResult = document.evaluate(
      selectorOrXpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    if (xpathResult.singleNodeValue) {
      return xpathResult.singleNodeValue as HTMLElement;
    }
  } catch (e) {
    console.error('Monarch: Failed to evaluate XPath:', e); // Changed
  }

  return null;
}

/**
 * Checks if a given DOM element is currently visible in the viewport.
 * @param el The DOM element to check.
 * @returns True if the element is visible, false otherwise.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom >= 0 &&
    rect.left < window.innerWidth &&
    rect.right >= 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}
