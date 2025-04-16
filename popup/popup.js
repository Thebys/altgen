// Global variables
let currentImageUrl = '';
let currentWpPostId = null;
let currentMediaId = null;
let altTextSaved = false;
let syncInProgress = false; // Flag to track if sync is in progress
let updateInProgress = false; // Flag to track if update is in progress
let debounceTimer = null; // For debouncing buttons

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
  
  // Add event listeners with debouncing
  copyBtn.addEventListener('click', debounce(copyAltTextToClipboard, 500));
  updateWpBtn.addEventListener('click', debounce(updateWordPressAltText, 500));
  syncBtn.addEventListener('click', debounce(syncAltTextAcrossSite, 500));
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
      currentMediaId = message.mediaId;
      altTextSaved = false;
      
      // Update UI to indicate if media ID was preloaded
      if (message.mediaId) {
        console.log("Media ID was preloaded:", message.mediaId);
        // Optionally, update the UI to indicate the file was found
        // For example, update the update button to indicate readiness
        if (updateWpBtn) {
          updateWpBtn.classList.add('ready'); // Add a CSS class for styling if desired
        }
      }
      
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
      // Reset update in progress flag
      updateInProgress = false;
      
      // Re-enable update button
      const updateWpBtn = document.getElementById('update-wp-btn');
      updateWpBtn.disabled = false;
      updateWpBtn.textContent = 'Update in WordPress';
      
      if (message.success) {
        statusMessage.textContent = 'Alt text successfully updated in Media Library!';
        statusMessage.style.color = '#27ae60';
        altTextSaved = true;
        
        // Check if AltSync plugin is available
        browser.storage.sync.get(['wpSiteUrl'], (items) => {
          if (items.wpSiteUrl) {
            // Send message to check AltSync plugin status
            browser.runtime.sendMessage({
              action: "checkAltSyncPlugin",
              wpSiteUrl: items.wpSiteUrl
            });
          } else {
            // Just show sync options without checking plugin
            syncOptionsDiv.classList.remove('hidden');
          }
        });
        
        // Add a warning about sync below the status message
        setTimeout(() => {
          const warningHtml = document.createElement('p');
          warningHtml.textContent = 'Warning: Syncing will update this image across all pages. Choose "Empty" for safer updates.';
          warningHtml.style.color = '#e67e22';
          warningHtml.style.fontSize = '0.85em';
          warningHtml.style.fontWeight = 'bold';
          warningHtml.style.marginTop = '5px';
          warningHtml.id = 'sync-warning';
          
          // Remove existing warning if any
          const existingWarning = document.getElementById('sync-warning');
          if (existingWarning) {
            existingWarning.remove();
          }
          
          // Insert warning before sync options
          syncOptionsDiv.parentNode.insertBefore(warningHtml, syncOptionsDiv);
        }, 100);
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
      // Reset sync in progress flag
      syncInProgress = false;
      
      // Re-enable sync button
      const syncBtn = document.getElementById('sync-btn');
      const syncBtnText = document.getElementById('sync-btn-text') || syncBtn;
      syncBtn.disabled = false;
      syncBtnText.textContent = syncBtn.getAttribute('data-original-text') || 'Sync with AltSync';
      
      if (message.success) {
        statusMessage.textContent = message.message || `Alt text successfully synced to ${message.updatedCount} page instances!`;
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
    else if (message.action === 'altSyncPluginStatus') {
      if (message.available) {
        // Show sync options if plugin is available
        syncOptionsDiv.classList.remove('hidden');
        
        // Update the sync button text with version if available
        if (message.version) {
          const syncBtnText = document.getElementById('sync-btn-text');
          if (syncBtnText) {
            syncBtnText.textContent = `Sync with AltSync v${message.version}`;
          }
        }
      } else {
        // Create a message about AltSync plugin not being available with a link
        const altSyncNotAvailable = document.createElement('div');
        altSyncNotAvailable.className = 'altsync-info';
        altSyncNotAvailable.innerHTML = `
          <p>AltSync plugin not detected on your site.</p>
          <p><a href="https://github.com/thebys/altsync" target="_blank">Install the AltSync plugin</a> to enable synchronizing alt text across your WordPress site.</p>
        `;
        altSyncNotAvailable.style.marginTop = '10px';
        altSyncNotAvailable.style.backgroundColor = '#f8f8f8';
        altSyncNotAvailable.style.padding = '8px';
        altSyncNotAvailable.style.borderRadius = '4px';
        altSyncNotAvailable.style.fontSize = '0.9em';
        
        // Remove existing message if any
        const existingMessage = document.querySelector('.altsync-info');
        if (existingMessage) {
          existingMessage.remove();
        }
        
        // Add message before or in place of sync options
        if (syncOptionsDiv.parentNode) {
          syncOptionsDiv.parentNode.insertBefore(altSyncNotAvailable, syncOptionsDiv);
        }
        
        // Hide the sync options
        syncOptionsDiv.classList.add('hidden');
      }
    }
  });
  
  // Check status when popup opens
  browser.runtime.sendMessage({ action: "checkStatus" });
  
  // Show default loading state if nothing else happens
  loadingMessage.textContent = 'Waiting for image selection...';
});

/**
 * Debounce function to prevent multiple rapid clicks
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  return function(...args) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      func.apply(this, args);
    }, wait);
  };
}

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
  // Prevent multiple clicks
  if (updateInProgress) {
    return;
  }
  
  const altTextArea = document.getElementById('alt-text');
  const statusMessage = document.getElementById('status-message');
  const updateWpBtn = document.getElementById('update-wp-btn');
  
  // Set update in progress flag
  updateInProgress = true;
  
  // Disable the button during update
  updateWpBtn.disabled = true;
  updateWpBtn.textContent = 'Updating...';
  
  // Check if alt text is empty
  if (!altTextArea.value.trim()) {
    statusMessage.textContent = 'Alt text cannot be empty';
    statusMessage.style.color = '#e74c3c';
    updateWpBtn.disabled = false;
    updateWpBtn.textContent = 'Update in WordPress';
    updateInProgress = false;
    return;
  }
  
  try {
    // Get WordPress credentials from storage
    const items = await browser.storage.sync.get(['wpSiteUrl', 'wpUsername', 'wpApplicationPassword']);
    
    if (!items.wpSiteUrl || !items.wpUsername || !items.wpApplicationPassword) {
      throw new Error('WordPress credentials are not set. Please configure them in the extension options.');
    }
    
    // Send the update request to the background script, including the preloaded media ID
    browser.runtime.sendMessage({
      action: 'updateWordPressAltText',
      imageUrl: currentImageUrl,
      altText: altTextArea.value,
      wpSiteUrl: items.wpSiteUrl,
      wpUsername: items.wpUsername,
      wpApplicationPassword: items.wpApplicationPassword,
      mediaId: currentMediaId // Pass the preloaded media ID
    });
    
    // We don't reset the updateInProgress flag here because we're waiting for the result message
  } catch (error) {
    statusMessage.textContent = `Error: ${error.message}`;
    statusMessage.style.color = '#e74c3c';
    
    // Reset state
    updateWpBtn.disabled = false;
    updateWpBtn.textContent = 'Update in WordPress';
    updateInProgress = false;
  }
}

/**
 * Sync alt text across the WordPress site using AltSync API
 */
function syncAltTextAcrossSite() {
  // Prevent multiple clicks
  if (syncInProgress) {
    return;
  }
  
  const statusMessage = document.getElementById('status-message');
  const syncBtn = document.getElementById('sync-btn');
  const syncBtnText = document.getElementById('sync-btn-text') || syncBtn;
  const syncModeSelect = document.getElementById('sync-mode');
  const syncMode = syncModeSelect.value;
  
  // Save original button text if not already saved
  if (!syncBtn.getAttribute('data-original-text')) {
    syncBtn.setAttribute('data-original-text', syncBtnText.textContent);
  }
  
  // Set sync in progress flag
  syncInProgress = true;
  
  // Disable button and show progress
  syncBtn.disabled = true;
  syncBtnText.textContent = 'Syncing...';
  
  if (!altTextSaved) {
    statusMessage.textContent = 'Please save alt text to WordPress first';
    statusMessage.style.color = '#e74c3c';
    
    // Reset state
    syncBtn.disabled = false;
    syncBtnText.textContent = syncBtn.getAttribute('data-original-text');
    syncInProgress = false;
    return;
  }
  
  if (!currentImageUrl) {
    statusMessage.textContent = 'Image URL not available';
    statusMessage.style.color = '#e74c3c';
    
    // Reset state
    syncBtn.disabled = false;
    syncBtnText.textContent = syncBtn.getAttribute('data-original-text');
    syncInProgress = false;
    return;
  }
  
  try {
    // Get WordPress credentials from storage
    browser.storage.sync.get(['wpSiteUrl', 'wpUsername', 'wpApplicationPassword'], (items) => {
      if (!items.wpSiteUrl || !items.wpUsername || !items.wpApplicationPassword) {
        statusMessage.textContent = 'WordPress credentials are not set. Please configure them in the extension options.';
        statusMessage.style.color = '#e74c3c';
        syncBtn.disabled = false;
        syncBtnText.textContent = syncBtn.getAttribute('data-original-text');
        syncInProgress = false;
        return;
      }
      
      // Send the sync request to the background script, including the preloaded media ID
      browser.runtime.sendMessage({
        action: 'syncAltText',
        imageUrl: currentImageUrl,
        syncMode: syncMode,
        wpSiteUrl: items.wpSiteUrl,
        wpUsername: items.wpUsername,
        wpApplicationPassword: items.wpApplicationPassword,
        mediaId: currentMediaId // Pass the preloaded media ID
      });
      
      // We don't reset the syncInProgress flag here because we're waiting for the result message
    });
  } catch (error) {
    statusMessage.textContent = `Error: ${error.message}`;
    statusMessage.style.color = '#e74c3c';
    
    // Reset state
    syncBtn.disabled = false;
    syncBtnText.textContent = syncBtn.getAttribute('data-original-text');
    syncInProgress = false;
  }
} 