// Create context menu item for images
browser.contextMenus.create({
  id: "generate-alt-text",
  title: "Generate Alt Text with AI",
  contexts: ["image"],
  documentUrlPatterns: ["*://*/*"]
});

// Storage for last error message
let lastErrorMessage = null;
let processingImageData = null;
let preloadedMediaId = null; // Add a variable to store preloaded media ID

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-alt-text") {
    console.log("Context menu clicked on image:", info.srcUrl);
    
    // Reset error state
    lastErrorMessage = null;
    
    // Set processing flag
    processingImageData = {
      state: "extracting_context",
      imageUrl: info.srcUrl
    };
    
    // Instead of opening popup, set badge to indicate processing
    browser.browserAction.setBadgeText({ text: "⏳" });
    browser.browserAction.setBadgeBackgroundColor({ color: "#3498db" });
    
    // Send message to content script to extract context
    browser.tabs.sendMessage(tab.id, {
      action: "extractContext",
      targetSrc: info.srcUrl
    }).catch(error => {
      console.error("Error sending message to content script:", error);
      lastErrorMessage = error.message;
      
      // Update badge to indicate error
      browser.browserAction.setBadgeText({ text: "❌" });
      browser.browserAction.setBadgeBackgroundColor({ color: "#e74c3c" });
      
      // Handle case where content script isn't loaded yet
      if (error.message.includes("Could not establish connection")) {
        console.log("Attempting to inject content script manually");
        
        // Inject content script manually
        browser.tabs.executeScript(tab.id, { file: "content.js" })
          .then(() => {
            console.log("Content script injected, retrying message");
            // Retry sending the message
            setTimeout(() => {
              browser.tabs.sendMessage(tab.id, {
                action: "extractContext",
                targetSrc: info.srcUrl
              }).catch(err => {
                console.error("Retry failed:", err);
                lastErrorMessage = "Could not communicate with the page. Please reload and try again.";
                browser.runtime.sendMessage({
                  action: "displayError",
                  error: lastErrorMessage
                });
              });
            }, 500); // Short delay to ensure script is loaded
          })
          .catch(injectError => {
            console.error("Failed to inject content script:", injectError);
            lastErrorMessage = "Could not access page content. This might be due to browser security restrictions.";
            browser.runtime.sendMessage({
              action: "displayError",
              error: lastErrorMessage
            });
          });
      } else {
        browser.runtime.sendMessage({
          action: "displayError",
          error: error.message
        });
      }
    });
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);
  
  if (message.action === "processImage") {
    console.log("Processing image, HTML context length:", message.htmlContext?.length || 0);
    
    // Update processing state
    processingImageData = {
      state: "generating_alt_text",
      imageUrl: message.imageUrl,
      originalAlt: message.originalAlt
    };
    
    // Update badge to indicate processing
    browser.browserAction.setBadgeText({ text: "⏳" });
    browser.browserAction.setBadgeBackgroundColor({ color: "#3498db" });
    
    // Start preloading media ID if this is a WordPress site
    if (message.isWordPressSite) {
      // Get the site URL
      browser.storage.sync.get(['wpSiteUrl'], (items) => {
        if (items.wpSiteUrl) {
          // Preload the media ID in parallel with the AI call
          console.log("Preloading media ID for image:", message.imageUrl);
          getMediaIdFromUrl(items.wpSiteUrl, message.imageUrl)
            .then(mediaId => {
              console.log("Preloaded media ID:", mediaId);
              preloadedMediaId = mediaId;
            })
            .catch(error => {
              console.error("Error preloading media ID:", error);
              // Don't set an error here, as this is just a preloading step
            });
        }
      });
    }
    
    generateAltText(message.imageData, message.htmlContext, message.imageUrl, message.originalAlt)
      .then(altText => {
        console.log("Generated alt text:", altText);
        
        // Store result for popup
        processingImageData = {
          state: "completed",
          imageUrl: message.imageUrl,
          originalAlt: message.originalAlt,
          altText: altText,
          wpPostId: message.wpPostId,
          isWordPressSite: message.isWordPressSite,
          mediaId: preloadedMediaId // Include the preloaded media ID
        };
        
        // Update badge to indicate success
        browser.browserAction.setBadgeText({ text: "✓" });
        browser.browserAction.setBadgeBackgroundColor({ color: "#27ae60" });
        
        // Send generated alt text to popup if it's open - wrapped in try/catch
        // to avoid errors when popup isn't open
        try {
          browser.runtime.sendMessage({
            action: "displayAltText",
            altText: altText,
            imageUrl: message.imageUrl,
            originalAlt: message.originalAlt,
            wpPostId: message.wpPostId,
            isWordPressSite: message.isWordPressSite,
            mediaId: preloadedMediaId // Include the preloaded media ID
          }).catch(err => {
            // Ignore the error - popup not open
            console.log("Popup not open yet, data will be sent when opened");
          });
        } catch (error) {
          console.log("Error sending message to popup (likely not open):", error);
        }
      })
      .catch(error => {
        console.error("Error generating alt text:", error);
        lastErrorMessage = error.message;
        
        // Update badge to indicate error
        browser.browserAction.setBadgeText({ text: "❌" });
        browser.browserAction.setBadgeBackgroundColor({ color: "#e74c3c" });
        
        // Send error to popup if it's open - wrapped in try/catch
        try {
          browser.runtime.sendMessage({
            action: "displayError",
            error: error.message
          }).catch(err => {
            // Ignore the error - popup not open
            console.log("Popup not open yet, error will be shown when opened");
          });
        } catch (error) {
          console.log("Error sending error message to popup (likely not open):", error);
        }
      });
  } else if (message.action === "checkStatus") {
    // If there's processing data available, send it to the popup
    if (processingImageData && processingImageData.state === "completed") {
      browser.runtime.sendMessage({
        action: "displayAltText",
        altText: processingImageData.altText,
        imageUrl: processingImageData.imageUrl,
        originalAlt: processingImageData.originalAlt,
        wpPostId: processingImageData.wpPostId,
        isWordPressSite: processingImageData.isWordPressSite,
        mediaId: processingImageData.mediaId // Include the preloaded media ID
      });
    } 
    // If there was a previous error, send it to the popup
    else if (lastErrorMessage) {
      browser.runtime.sendMessage({
        action: "displayError",
        error: lastErrorMessage
      });
    }
    // If we're still processing, indicate that
    else if (processingImageData) {
      browser.runtime.sendMessage({
        action: "displayProcessing",
        state: processingImageData.state,
        imageUrl: processingImageData.imageUrl
      });
    }
  } else if (message.action === "updateWordPressAltText") {
    // Handle the WordPress alt text update request from popup
    console.log("Received request to update WordPress alt text", message);
    
    // If we already have the media ID, use it; otherwise, get it
    const getMediaId = message.mediaId 
      ? Promise.resolve(message.mediaId)
      : getMediaIdFromUrl(message.wpSiteUrl, message.imageUrl);
    
    getMediaId
      .then(mediaId => {
        if (!mediaId) {
          throw new Error("Could not find media ID for this image");
        }
        
        // Call the update function
        return updateWordPressAltText(
          mediaId, 
          message.altText, 
          message.wpSiteUrl, 
          message.wpUsername, 
          message.wpApplicationPassword
        );
      })
      .then(() => {
        // Send success message back to popup
        browser.runtime.sendMessage({
          action: "wordpressUpdateResult",
          success: true
        });
      })
      .catch(error => {
        console.error("Error in WordPress update flow:", error);
        
        // Send error message back to popup
        browser.runtime.sendMessage({
          action: "wordpressUpdateResult",
          success: false,
          error: error.message
        });
      });
  } else if (message.action === "syncAltText") {
    // Handle the AltSync request from popup
    console.log("Received request to sync alt text", message);
    
    // If we already have the media ID, use it; otherwise, get it
    const getMediaId = message.mediaId 
      ? Promise.resolve(message.mediaId)
      : getMediaIdFromUrl(message.wpSiteUrl, message.imageUrl);
    
    getMediaId
      .then(mediaId => {
        if (!mediaId) {
          throw new Error("Could not find media ID for this image");
        }
        
        // Call the sync function
        return syncAltText(
          mediaId,
          message.syncMode,
          message.wpSiteUrl,
          message.wpUsername,
          message.wpApplicationPassword
        );
      })
      .then((syncResult) => {
        // Send success message back to popup
        browser.runtime.sendMessage({
          action: "altSyncResult",
          success: true,
          message: syncResult.message,
          updatedCount: syncResult.updated_count
        });
      })
      .catch(error => {
        console.error("Error in AltSync flow:", error);
        
        // Send error message back to popup
        browser.runtime.sendMessage({
          action: "altSyncResult",
          success: false,
          error: error.message
        });
      });
  } else if (message.action === "checkAltSyncPlugin") {
    // Handle the check for AltSync plugin availability
    console.log("Checking if AltSync plugin is available on:", message.wpSiteUrl);
    
    checkAltSyncStatus(message.wpSiteUrl)
      .then(statusResult => {
        // Send status result back to popup
        browser.runtime.sendMessage({
          action: "altSyncPluginStatus",
          available: statusResult.success === true,
          version: statusResult.version || null,
          message: statusResult.message || null
        });
      })
      .catch(error => {
        console.error("Error checking AltSync plugin status:", error);
        
        // Send error message back to popup
        browser.runtime.sendMessage({
          action: "altSyncPluginStatus",
          available: false,
          error: error.message
        });
      });
  }
});

// Reset data when loading a new page
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Reset preloaded data when navigating to a new page
    preloadedMediaId = null;
  }
});

// Function to call OpenAI API for alt text generation
async function generateAltText(imageData, htmlContext, imageUrl, originalAlt) {
  try {
    // Get API key and language from storage
    const storage = await browser.storage.sync.get(["openaiApiKey", "language"]);
    const apiKey = storage.openaiApiKey;
    const language = storage.language || 'en';
    
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set it in the extension options.");
    }
    
    console.log("Preparing API call with HTML context length:", htmlContext?.length || 0);
    
    // Prepare prompt with HTML context, language, filename, and alt text
    let prompt;
    
    switch (language) {
      case 'cs':
        prompt = `Vytvoř prosím alt text pro tento obrázek. Popis by měl být vizuálně popisující obrázek. Prioritou je přístupnost, 
        sekunrádní zájem je SEO. Níže je také kontext - původní ALT text a URL/název souboru by měly mít pro zjištění
        kontextu větší váhu, naproti tomu HTML kontext s obrázkem vůbec nemusí souviset a měl by mít menší váhu. 
        Vyhni se spekulacím (pravděpodobně, asi, zřejmě, ...).
        
        Spíš konkrétní názvy souborů: 1-99, DSC*, IMG*, ...
        Spíš obecné / generické / ilustrativní názvy souborů: photo, image, stock, eng, english, ...

        URL a Název souboru: ${imageUrl}
        Původní alt text: ${originalAlt}
        
        HTML kontext: ${htmlContext}
        Jazyk: čeština.
        Vypiš pouze alt text:
        `;
        break;
      default:
        prompt = `Generate a concise, descriptive alt text for this image. The description should be visually descriptive. 
        Accessibility is the priority. Below is supplementary HTML context that may be useful for generating the alt text, 
        but it MAY NOT be directly related to the image, so it should not be given too much weight!
        
        URL and filename: ${imageUrl}
        Original alt text: ${originalAlt}
        
        HTML Context: ${htmlContext}
        Language: English`;
    }
    
    console.log("Calling OpenAI API with language:", language, "and prompt:", prompt);
    
    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",  // Use the latest GPT-4o model
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageData}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error("API error:", data.error);
      throw new Error(data.error.message);
    }
    
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Function to update WordPress image alt text via REST API
async function updateWordPressAltText(mediaId, altText, wpSiteUrl, wpUsername, wpApplicationPassword) {
  try {
    console.log("Attempting to update WordPress alt text for media ID:", mediaId);
    console.log("Alt text to update:", altText);
    console.log("WordPress site URL:", wpSiteUrl);
    console.log("WordPress username:", wpUsername);
    
    // Prepare authentication header
    const authHeader = 'Basic ' + btoa(`${wpUsername}:${wpApplicationPassword}`);
    console.log("Authorization header:", authHeader);
    
    // Update media alt text
    const response = await fetch(`${wpSiteUrl}/wp-json/wp/v2/media/${mediaId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      // If you are logged in Wordpress administrator, somehow your cookies might get confused with the application password process used by this extension.
      // The following line is to prevent sending such user credentials, so that Wordpress interprets it as authenticated via application password.
      // See: https://github.com/WP-API/Basic-Auth/issues/35#issuecomment-1628176509
      credentials: 'omit', 
      body: JSON.stringify({
        alt_text: altText
      })
    });
    
    console.log("Request headers:", {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    });
    console.log("Request payload:", JSON.stringify({
      alt_text: altText
    }));
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("WordPress API error:", errorData);
      throw new Error(`WordPress API error: ${response.status} - ${errorData.message}`);
    }
    
    console.log("Successfully updated alt text in WordPress for media ID:", mediaId);
    return true;
  } catch (error) {
    console.error("Error updating WordPress alt text:", error);
    throw error;
  }
}

// Function to sync alt text across the WordPress site
async function syncAltText(mediaId, syncMode, wpSiteUrl, wpUsername, wpApplicationPassword) {
  try {
    console.log("Attempting to sync alt text across site for media ID:", mediaId);
    console.log("Sync mode:", syncMode);
    console.log("WordPress site URL:", wpSiteUrl);
    
    // Prepare authentication header
    const authHeader = 'Basic ' + btoa(`${wpUsername}:${wpApplicationPassword}`);
    
    // Call the AltSync API
    const response = await fetch(`${wpSiteUrl}/wp-json/altsync/v1/sync-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      credentials: 'omit', // Prevent sending cookies to avoid authentication conflicts
      body: JSON.stringify({
        attachment_id: mediaId,
        sync_mode: syncMode
      })
    });
    
    console.log("Request headers:", {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    });
    console.log("Request payload:", JSON.stringify({
      attachment_id: mediaId,
      sync_mode: syncMode
    }));
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("AltSync API error:", errorData);
      throw new Error(`AltSync API error: ${response.status} - ${errorData.message}`);
    }
    
    const responseData = await response.json();
    console.log("Successfully synced alt text across site:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error syncing alt text:", error);
    throw error;
  }
}

// Function to check if AltSync plugin is active
async function checkAltSyncStatus(wpSiteUrl) {
  try {
    console.log("Checking AltSync plugin status for site:", wpSiteUrl);
    
    // Call the AltSync status API
    const response = await fetch(`${wpSiteUrl}/wp-json/altsync/v1/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'omit' // Prevent sending cookies to avoid authentication conflicts
    });
    
    if (!response.ok) {
      console.log("AltSync plugin is not available (status endpoint returned error)");
      return { success: false };
    }
    
    const responseData = await response.json();
    console.log("AltSync plugin status:", responseData);
    
    return responseData;
  } catch (error) {
    console.error("Error checking AltSync status:", error);
    return { success: false };
  }
}

// Function to get WordPress media ID from image URL
async function getMediaIdFromUrl(wpSiteUrl, imageUrl) {
  try {
    console.log("Fetching media ID for image URL:", imageUrl);
    
    // Extract filename from URL and decode it
    const urlParts = imageUrl.split('/');
    const filenameWithQuery = urlParts[urlParts.length - 1];
    // Remove query parameters if any
    const filename = filenameWithQuery.split('?')[0];
    
    // Decode URL encoded characters
    const decodedFilename = decodeURIComponent(filename);
    console.log("Searching for media with filename:", decodedFilename);
    
    // First try with the exact filename
    let mediaId = await searchMediaByFilename(wpSiteUrl, decodedFilename);
    
    // If not found and filename appears to have a resolution suffix, try removing it
    if (!mediaId) {
      // Handle different WordPress resolution patterns:
      // - filename-400x400.jpg (standard resized version)
      // - filename-400x400-c-default.jpg (cropped versions)
      // Also handle filenames that might already have hyphens

      // Extract the base name and extension
      const filenameParts = decodedFilename.match(/^(.+)\.([^.]+)$/);
      
      if (filenameParts) {
        const [, basePart, extension] = filenameParts;
        
        // Remove resolution suffix if it exists
        let baseFilename;
        
        // Try to find and remove resolution pattern at the end (like -400x400)
        const resolutionMatch = basePart.match(/^(.+)-\d+x\d+(?:-.+)?$/);
        if (resolutionMatch) {
          baseFilename = `${resolutionMatch[1]}.${extension}`;
          console.log("No match found. Trying with base filename:", baseFilename);
          mediaId = await searchMediaByFilename(wpSiteUrl, baseFilename);
        }
        
        // If still not found, try a broader approach: search by just the first part of the filename
        // This helps with WordPress's unpredictable naming patterns
        if (!mediaId && basePart.includes('-')) {
          const firstPart = basePart.split('-')[0];
          console.log("Still no match. Trying partial search with:", firstPart);
          
          // Search by the first part of the filename using the WordPress REST API search parameter
          const searchPartialUrl = `${wpSiteUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(firstPart)}&per_page=5`;
          console.log("Partial search URL:", searchPartialUrl);
          
          const response = await fetch(searchPartialUrl, {
            // If you are logged in Wordpress administrator, somehow your cookies might get confused with the application password process used by this extension.
            // The following line is to prevent sending such user credentials, so that Wordpress interprets it as authenticated via application password.
            // See: https://github.com/WP-API/Basic-Auth/issues/35#issuecomment-1628176509
            credentials: 'omit'
          });
          const data = await response.json();
          
          if (data && data.length > 0) {
            // If we found multiple results, try to find the one most similar to our original filename
            for (const item of data) {
              const sourceUrl = item.source_url || '';
              const sourceParts = sourceUrl.split('/');
              const sourceFilename = sourceParts[sourceParts.length - 1];
              
              console.log("Comparing with potential match:", sourceFilename);
              
              // If this item's filename contains our first part, use it
              if (sourceFilename.includes(firstPart)) {
                console.log("Found potential match by partial filename:", item.id);
                mediaId = item.id;
                break;
              }
            }
          }
        }
      }
    }
    
    return mediaId;
  } catch (error) {
    console.error('Error getting media ID:', error);
    return null;
  }
}

// Helper function to search for media by filename
async function searchMediaByFilename(wpSiteUrl, filename) {
  try {
    // Search for media by filename (exact match with per_page=1)
    const searchUrl = `${wpSiteUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(filename)}&per_page=1`;
    console.log("Search URL:", searchUrl);
    
    const response = await fetch(searchUrl, {
      credentials: 'omit' // Prevent cookies from being sent with the request
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log("Found media ID:", data[0].id);
      return data[0].id;
    }
    
    console.warn("No media found for filename:", filename);
    return null;
  } catch (error) {
    console.error('Error searching media by filename:', error);
    return null;
  }
} 