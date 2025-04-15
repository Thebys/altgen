// Global variables
let currentImageUrl = '';
let currentWpPostId = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");
  
  // Get UI elements
  const loadingSection = document.getElementById('loading');
  const errorSection = document.getElementById('error');
  const resultSection = document.getElementById('result');
  const errorMessage = document.getElementById('error-message');
  const previewImage = document.getElementById('preview-image');
  const originalAlt = document.getElementById('original-alt');
  const altTextArea = document.getElementById('alt-text');
  const copyBtn = document.getElementById('copy-btn');
  const updateWpBtn = document.getElementById('update-wp-btn');
  const statusMessage = document.getElementById('status-message');
  const closeErrorBtn = document.getElementById('close-error');
  
  // Add event listeners
  copyBtn.addEventListener('click', copyAltTextToClipboard);
  updateWpBtn.addEventListener('click', updateWordPressAltText);
  closeErrorBtn.addEventListener('click', () => {
    errorSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    
    // Try to trigger the process again if there was an error
    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Check if we have active tabs
      if (tabs && tabs.length > 0) {
        console.log("Retrying after error, active tab:", tabs[0].url);
      } else {
        console.warn("No active tabs found for retry");
      }
    });
  });
  
  // Listen for messages from background script
  browser.runtime.onMessage.addListener(message => {
    console.log("Popup received message:", message.action);
    
    if (message.action === 'displayAltText') {
      // Store image data
      currentImageUrl = message.imageUrl;
      currentWpPostId = message.wpPostId;
      
      // Update UI
      previewImage.src = message.imageUrl;
      originalAlt.textContent = message.originalAlt || '(none)';
      altTextArea.value = message.altText;
      
      // Show WordPress update button if we have post ID
      if (currentWpPostId) {
        updateWpBtn.classList.remove('hidden');
      }
      
      // Show result section
      loadingSection.classList.add('hidden');
      errorSection.classList.add('hidden');
      resultSection.classList.remove('hidden');
    } 
    else if (message.action === 'displayError') {
      // Show error
      errorMessage.textContent = message.error;
      loadingSection.classList.add('hidden');
      resultSection.classList.add('hidden');
      errorSection.classList.remove('hidden');
    }
  });
  
  // Check if we need to show an error message from any previous failures
  browser.runtime.sendMessage({ action: "checkStatus" });
});

/**
 * Copy generated alt text to clipboard
 */
function copyAltTextToClipboard() {
  const altTextArea = document.getElementById('alt-text');
  const statusMessage = document.getElementById('status-message');
  
  // Select text
  altTextArea.select();
  
  // Copy to clipboard
  try {
    document.execCommand('copy');
    statusMessage.textContent = 'Copied to clipboard!';
    
    // Clear status message after 2 seconds
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 2000);
  } catch (err) {
    statusMessage.textContent = 'Failed to copy text';
  }
}

/**
 * Update WordPress image alt text via REST API
 */
async function updateWordPressAltText() {
  const altTextArea = document.getElementById('alt-text');
  const statusMessage = document.getElementById('status-message');
  const altText = altTextArea.value.trim();
  
  if (!altText) {
    statusMessage.textContent = 'Alt text cannot be empty';
    statusMessage.style.color = '#e74c3c';
    return;
  }
  
  if (!currentWpPostId) {
    statusMessage.textContent = 'WordPress post ID not available';
    statusMessage.style.color = '#e74c3c';
    return;
  }
  
  // Get WordPress credentials from storage
  browser.storage.sync.get(['wpSiteUrl', 'wpUsername', 'wpApplicationPassword'], async (items) => {
    if (!items.wpSiteUrl || !items.wpUsername || !items.wpApplicationPassword) {
      statusMessage.textContent = 'WordPress credentials not configured in options';
      statusMessage.style.color = '#e74c3c';
      return;
    }
    
    try {
      statusMessage.textContent = 'Updating WordPress...';
      statusMessage.style.color = '#3498db';
      
      // Get media attachment ID from image URL
      const mediaId = await getMediaIdFromUrl(items.wpSiteUrl, currentImageUrl);
      
      if (!mediaId) {
        throw new Error('Could not find media ID for this image');
      }
      
      // Update media alt text
      const authHeader = 'Basic ' + btoa(`${items.wpUsername}:${items.wpApplicationPassword}`);
      const response = await fetch(`${items.wpSiteUrl}/wp-json/wp/v2/media/${mediaId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          alt_text: altText
        })
      });
      
      if (!response.ok) {
        throw new Error(`WordPress API error: ${response.status}`);
      }
      
      statusMessage.textContent = 'Alt text updated in WordPress!';
      statusMessage.style.color = '#27ae60';
      
      // Clear status message after 3 seconds
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 3000);
      
    } catch (error) {
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.style.color = '#e74c3c';
    }
  });
}

/**
 * Get WordPress media ID from image URL
 * @param {string} wpSiteUrl - WordPress site URL
 * @param {string} imageUrl - Image URL
 * @returns {Promise<string|null>} Media ID or null
 */
async function getMediaIdFromUrl(wpSiteUrl, imageUrl) {
  try {
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Search for media by filename
    const response = await fetch(`${wpSiteUrl}/wp-json/wp/v2/media?search=${filename}`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return data[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting media ID:', error);
    return null;
  }
} 