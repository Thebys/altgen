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
    
    generateAltText(message.imageData, message.htmlContext, message.imageUrl, message.originalAlt)
      .then(altText => {
        console.log("Generated alt text:", altText);
        
        // Store result for popup
        processingImageData = {
          state: "completed",
          imageUrl: message.imageUrl,
          originalAlt: message.originalAlt,
          altText: altText,
          wpPostId: message.wpPostId
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
            wpPostId: message.wpPostId
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
        wpPostId: processingImageData.wpPostId
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
    
    // Get media ID from URL
    getMediaIdFromUrl(message.wpSiteUrl, message.imageUrl)
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
        // Send success response back to popup
        browser.runtime.sendMessage({
          action: "wordpressUpdateResult",
          success: true
        });
      })
      .catch(error => {
        console.error("Error updating WordPress alt text:", error);
        
        // Send error response back to popup
        browser.runtime.sendMessage({
          action: "wordpressUpdateResult",
          success: false,
          error: error.message
        });
      });
    
    // Return true to indicate we'll handle this asynchronously
    return true;
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
        sekunrádní zájem je SEO pro Impact Hub. Níže je také kontext - původní ALT text a URL/název souboru by měly mít pro zjištění
        kontextu větší váhu, naproti tomu HTML kontext s obrázkem vůbec nemusí souviset a měl by mít menší váhu. 
        Vyhni se spekulacím (pravděpodobně, asi, zřejmě, ...).
        
        Spíš konkrétní názvy souborů: 1-99, DSC*, IMG*, Impact, Hub, Praha, Brno, Ostrava, Mashup, ...
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
      credentials: 'omit', // Prevent cookies from being sent with the request
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

// Function to get WordPress media ID from image URL
async function getMediaIdFromUrl(wpSiteUrl, imageUrl) {
  try {
    console.log("Fetching media ID for image URL:", imageUrl);
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Search for media by filename
    const response = await fetch(`${wpSiteUrl}/wp-json/wp/v2/media?search=${filename}`, {
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
    console.error('Error getting media ID:', error);
    return null;
  }
} 