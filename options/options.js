// Save options to browser.storage
function saveOptions(e) {
  e.preventDefault();
  
  // Get input values
  const openaiApiKey = document.getElementById('openai-api-key').value;
  const wpSiteUrl = document.getElementById('wp-site-url').value;
  const wpUsername = document.getElementById('wp-username').value;
  const wpAppPassword = document.getElementById('wp-app-password').value;
  
  // Save to storage
  browser.storage.sync.set({
    openaiApiKey: openaiApiKey,
    wpSiteUrl: wpSiteUrl,
    wpUsername: wpUsername,
    wpApplicationPassword: wpAppPassword
  }).then(() => {
    // Update status to let user know options were saved
    const status = document.getElementById('status-message');
    status.textContent = 'Options saved!';
    
    // Clear status message after 2 seconds
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
}

// Restore options from browser.storage
function restoreOptions() {
  browser.storage.sync.get({
    openaiApiKey: '',
    wpSiteUrl: '',
    wpUsername: '',
    wpApplicationPassword: ''
  }).then((items) => {
    document.getElementById('openai-api-key').value = items.openaiApiKey;
    document.getElementById('wp-site-url').value = items.wpSiteUrl;
    document.getElementById('wp-username').value = items.wpUsername;
    document.getElementById('wp-app-password').value = items.wpApplicationPassword;
  });
}

// Register event listeners
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-btn').addEventListener('click', saveOptions); 