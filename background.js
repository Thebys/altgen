// Create context menu item for images
browser.contextMenus.create({
  id: "generate-alt-text",
  title: "Generate Alt Text with AI",
  contexts: ["image"],
  documentUrlPatterns: ["*://*/*"]
});

// Storage for last error message
let lastErrorMessage = null;

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-alt-text") {
    console.log("Context menu clicked on image:", info.srcUrl);
    
    // Reset error state
    lastErrorMessage = null;
    
    // Open popup proactively to show loading state
    browser.browserAction.openPopup();
    
    // Send message to content script to extract context
    browser.tabs.sendMessage(tab.id, {
      action: "extractContext",
      targetSrc: info.srcUrl
    }).catch(error => {
      console.error("Error sending message to content script:", error);
      lastErrorMessage = error.message;
      
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
    generateAltText(message.imageData, message.htmlContext, message.imageUrl, message.originalAlt)
      .then(altText => {
        console.log("Generated alt text:", altText);
        // Send generated alt text to popup
        browser.runtime.sendMessage({
          action: "displayAltText",
          altText: altText,
          imageUrl: message.imageUrl,
          originalAlt: message.originalAlt,
          wpPostId: message.wpPostId
        });
      })
      .catch(error => {
        console.error("Error generating alt text:", error);
        lastErrorMessage = error.message;
        browser.runtime.sendMessage({
          action: "displayError",
          error: error.message
        });
      });
  } else if (message.action === "openPopup") {
    browser.browserAction.openPopup();
  } else if (message.action === "checkStatus") {
    // If there was a previous error, send it to the popup
    if (lastErrorMessage) {
      browser.runtime.sendMessage({
        action: "displayError",
        error: lastErrorMessage
      });
    }
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
        prompt = `Vytvoř alt text pro tento obrázek. Popis by měl být vizuálně popisující obrázek. Prioritou je přístupnost, 
        sekunrádní zájem je SEO pro Impact Hub. Níže je také kontext - původní ALT text a URL/název souboru by měly mít pro zjištění
        kontextu větší váhu, naproti tomu HTML kontext s obrázkem vůbec nemusí souviset a měl by mít menší váhu.
        
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