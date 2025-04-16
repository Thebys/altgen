// Global variables
let currentImageUrl = '';
let currentWpPostId = null;
let currentMediaId = null;
let altTextSaved = false;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");
  
  // Get UI elements
  const loadingSection = document.getElementById('loading');
  const loadingMessage = document.getElementById('loading-message');
  const errorSection = document.getElementById('error');
  const resultSection = document.getElementById('result');
  const errorMessage = document.getElementById('error-message');
  const previewImage = document.getElementById('preview-image');
  const originalAlt = document.getElementById('original-alt');
  const altTextArea = document.getElementById('alt-text');
  const copyBtn = document.getElementById('copy-btn');
  const updateWpBtn = document.getElementById('update-wp-btn');
  const syncOptionsDiv = document.getElementById('sync-options');
  const syncModeSelect = document.getElementById('sync-mode');
  const syncBtn = document.getElementById('sync-btn');
  const statusMessage = document.getElementById('status-message');
  const closeErrorBtn = document.getElementById('close-error');
  
  // Add event listeners
  copyBtn.addEventListener('click', copyAltTextToClipboard);
  updateWpBtn.addEventListener('click', updateWordPressAltText);
  syncBtn.addEventListener('click', syncAltTextAcrossSite);
  closeErrorBtn.addEventListener('click', () => {
    errorSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    loadingMessage.textContent = 'Waiting for image selection...';
  });
  
  // Load default sync mode from options
  browser.storage.sync.get(['defaultSyncMode'], (items) => {
    if (items.defaultSyncMode) {
      syncModeSelect.value = items.defaultSyncMode;
    }
  });
  
  // Listen for messages from background script
  browser.runtime.onMessage.addListener(message => {
    console.log("Popup received message:", message.action);
    
    if (message.action === 'displayAltText') {
      // Store image data
      currentImageUrl = message.imageUrl;
      currentWpPostId = message.wpPostId;
      altTextSaved = false;
      
      // Update UI
      previewImage.src = message.imageUrl;
      originalAlt.textContent = message.originalAlt || '(none)';
      altTextArea.value = message.altText;
      
      // Show WordPress update button only on WordPress sites
      if (message.isWordPressSite === true) {
        updateWpBtn.classList.remove('hidden');
      } else {
        updateWpBtn.classList.add('hidden');
        syncOptionsDiv.classList.add('hidden');
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
    else if (message.action === 'displayProcessing') {
      // Update loading message based on state
      if (message.state === 'extracting_context') {
        loadingMessage.textContent = 'Extracting image context...';
      } else if (message.state === 'generating_alt_text') {
        loadingMessage.textContent = 'Generating alt text with AI...';
        
        // Set preview image if available
        if (message.imageUrl) {
          previewImage.src = message.imageUrl;
        }
      }
      
      // Show loading section
      errorSection.classList.add('hidden');
      resultSection.classList.add('hidden');
      loadingSection.classList.remove('hidden');
    }
    else if (message.action === 'wordpressUpdateResult') {
      if (message.success) {
        statusMessage.textContent = 'Alt text updated in WordPress!';
        statusMessage.style.color = '#27ae60';
        altTextSaved = true;
        
        // Now show the sync options
        syncOptionsDiv.classList.remove('hidden');
      } else {
        statusMessage.textContent = `Error: ${message.error}`;
        statusMessage.style.color = '#e74c3c';
        altTextSaved = false;
      }
      
      // Style the message
      statusMessage.style.fontWeight = 'bold';
      
      // Clear status message after time
      setTimeout(() => {
        statusMessage.style.fontWeight = 'normal';
        
        // Only clear the status message if there's no sync result displayed
        if (!statusMessage.textContent.includes('synced')) {
          statusMessage.textContent = '';
        }
      }, 5000);
    }
    else if (message.action === 'altSyncResult') {
      if (message.success) {
        statusMessage.textContent = message.message || `Alt text synced to ${message.updatedCount} posts!`;
        statusMessage.style.color = '#27ae60';
      } else {
        statusMessage.textContent = `Sync error: ${message.error}`;
        statusMessage.style.color = '#e74c3c';
      }
      
      // Style the message
      statusMessage.style.fontWeight = 'bold';
      
      // Clear status message after time
      setTimeout(() => {
        statusMessage.style.fontWeight = 'normal';
      }, 8000);
    }
  });
  
  // Check status when popup opens
  browser.runtime.sendMessage({ action: "checkStatus" });
  
  // Show default loading state if nothing else happens
  loadingMessage.textContent = 'Waiting for image selection...';
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
  
  if (!currentImageUrl) {
    statusMessage.textContent = 'Image URL not available';
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
      
      // Add a message listener for the response
      const messageListener = (message) => {
        if (message.action === 'wordpressUpdateResult') {
          // Remove this listener once we get our response
          browser.runtime.onMessage.removeListener(messageListener);
          
          if (message.success) {
            statusMessage.textContent = 'Alt text updated in WordPress!';
            statusMessage.style.color = '#27ae60';
          } else {
            statusMessage.textContent = `Error: ${message.error}`;
            statusMessage.style.color = '#e74c3c';
          }
          
          // Clear status message after 3 seconds
          setTimeout(() => {
            statusMessage.textContent = '';
          }, 5000);
        }
      };
      
      // Register the listener
      browser.runtime.onMessage.addListener(messageListener);
      
      // Send the update request to the background script
      browser.runtime.sendMessage({
        action: 'updateWordPressAltText',
        imageUrl: currentImageUrl,
        altText: altText,
        wpSiteUrl: items.wpSiteUrl,
        wpUsername: items.wpUsername,
        wpApplicationPassword: items.wpApplicationPassword
      });
      
    } catch (error) {
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.style.color = '#e74c3c';
    }
  });
}

/**
 * Sync alt text across the WordPress site using AltSync API
 */
function syncAltTextAcrossSite() {
  const statusMessage = document.getElementById('status-message');
  const syncModeSelect = document.getElementById('sync-mode');
  const syncMode = syncModeSelect.value;
  
  if (!altTextSaved) {
    statusMessage.textContent = 'Please save alt text to WordPress first';
    statusMessage.style.color = '#e74c3c';
    return;
  }
  
  if (!currentImageUrl) {
    statusMessage.textContent = 'Image URL not available';
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
      statusMessage.textContent = 'Syncing alt text across site...';
      statusMessage.style.color = '#3498db';
      
      // Send the sync request to the background script
      browser.runtime.sendMessage({
        action: 'syncAltText',
        imageUrl: currentImageUrl,
        syncMode: syncMode,
        wpSiteUrl: items.wpSiteUrl,
        wpUsername: items.wpUsername,
        wpApplicationPassword: items.wpApplicationPassword
      });
      
    } catch (error) {
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.style.color = '#e74c3c';
    }
  });
} 