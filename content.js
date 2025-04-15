// Listen for messages from the background script
browser.runtime.onMessage.addListener(message => {
  if (message.action === "extractContext") {
    extractImageContext(message.targetSrc);
  }
});

/**
 * Extract the image and surrounding HTML context
 * @param {string} targetSrc - Source URL of the clicked image
 */
async function extractImageContext(targetSrc) {
  try {
    // Find the image element
    const imgElement = findImageBySrc(targetSrc);
    if (!imgElement) {
      throw new Error("Could not find the image element");
    }
    
    // Get image data
    const imageData = await getImageAsBase64(targetSrc);
    
    // Get original alt text
    const originalAlt = imgElement.alt || "";
    
    // Get WordPress post ID if available
    const wpPostId = extractWordPressPostId();
    
    // Extract surrounding context
    const htmlContext = extractSurroundingContext(imgElement);
    
    // Send data to background script
    browser.runtime.sendMessage({
      action: "processImage",
      imageData: imageData,
      imageUrl: targetSrc,
      originalAlt: originalAlt,
      htmlContext: htmlContext,
      wpPostId: wpPostId
    });
    
    // Open the popup
    browser.runtime.sendMessage({ action: "openPopup" });
    
  } catch (error) {
    console.error("Error extracting context:", error);
    browser.runtime.sendMessage({
      action: "displayError",
      error: error.message
    });
  }
}

/**
 * Find image element by its src attribute
 * @param {string} src - Image source URL
 * @returns {HTMLImageElement|null} The image element or null if not found
 */
function findImageBySrc(src) {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.src === src) {
      return img;
    }
  }
  return null;
}

/**
 * Extract relevant surrounding context from the image
 * @param {HTMLImageElement} imgElement - The image element
 * @returns {string} HTML context as a string
 */
function extractSurroundingContext(imgElement) {
  let context = "";
  
  // Get parent element (could be figure, div, etc.)
  const parent = imgElement.parentElement;
  
  // Get caption if available
  const figcaption = parent.querySelector('figcaption');
  if (figcaption) {
    context += `Caption: ${figcaption.textContent.trim()}\n`;
  }
  
  // Get nearest heading
  const nearestHeading = findNearestHeading(imgElement);
  if (nearestHeading) {
    context += `Nearest Heading: ${nearestHeading.textContent.trim()}\n`;
  }
  
  // Get surrounding paragraphs
  const surroundingParagraphs = getSurroundingParagraphs(imgElement);
  if (surroundingParagraphs.length > 0) {
    context += `Surrounding Paragraphs: ${surroundingParagraphs.join('\n')}\n`;
  }
  
  // Get parent section content
  const section = findParentSection(imgElement);
  if (section) {
    context += `Section Content: ${section.textContent.trim().substring(0, 500)}...\n`;
  }
  
  return context;
}

/**
 * Find the nearest heading element to the image
 * @param {HTMLElement} element - The image element
 * @returns {HTMLElement|null} The nearest heading or null
 */
function findNearestHeading(element) {
  // Check previous siblings
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName.match(/^H[1-6]$/)) {
      return sibling;
    }
    sibling = sibling.previousElementSibling;
  }
  
  // Check parent's previous siblings
  let parent = element.parentElement;
  while (parent && parent.tagName !== 'BODY') {
    sibling = parent.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.match(/^H[1-6]$/)) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    parent = parent.parentElement;
  }
  
  return null;
}

/**
 * Get surrounding paragraph text
 * @param {HTMLElement} element - The image element
 * @returns {string[]} Array of paragraph text
 */
function getSurroundingParagraphs(element) {
  const paragraphs = [];
  
  // Get parent element
  const parent = element.parentElement;
  
  // Get siblings
  const siblings = Array.from(parent.parentElement.children);
  const elementIndex = siblings.indexOf(parent);
  
  // Get previous paragraph
  if (elementIndex > 0) {
    const prevSibling = siblings[elementIndex - 1];
    if (prevSibling.tagName === 'P') {
      paragraphs.push(prevSibling.textContent.trim());
    }
  }
  
  // Get next paragraph
  if (elementIndex < siblings.length - 1) {
    const nextSibling = siblings[elementIndex + 1];
    if (nextSibling.tagName === 'P') {
      paragraphs.push(nextSibling.textContent.trim());
    }
  }
  
  return paragraphs;
}

/**
 * Find parent section or article containing the image
 * @param {HTMLElement} element - The image element
 * @returns {HTMLElement|null} Parent section/article or null
 */
function findParentSection(element) {
  let parent = element.parentElement;
  while (parent && parent.tagName !== 'BODY') {
    if (parent.tagName === 'SECTION' || parent.tagName === 'ARTICLE') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Extract WordPress post ID from the page if available
 * @returns {string|null} WordPress post ID or null
 */
function extractWordPressPostId() {
  // Look for post ID in body class
  const bodyClasses = document.body.className;
  const postIdMatch = bodyClasses.match(/postid-(\d+)/);
  if (postIdMatch && postIdMatch[1]) {
    return postIdMatch[1];
  }
  
  // Look for post ID in REST API link
  const apiLink = document.querySelector('link[rel="https://api.w.org/"]');
  if (apiLink) {
    const href = apiLink.getAttribute('href');
    const postMatch = href.match(/\/wp-json\/wp\/v2\/posts\/(\d+)/);
    if (postMatch && postMatch[1]) {
      return postMatch[1];
    }
  }
  
  return null;
}

/**
 * Convert image to base64 data
 * @param {string} src - Image source URL
 * @returns {Promise<string>} Base64 encoded image data
 */
async function getImageAsBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Get base64 data without the prefix
      const base64Data = canvas.toDataURL('image/jpeg')
        .replace(/^data:image\/jpeg;base64,/, '');
      
      resolve(base64Data);
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = src;
  });
} 