// Create context menu item for images
browser.contextMenus.create({
  id: "generate-alt-text",
  title: "Generate Alt Text with AI",
  contexts: ["image"],
  documentUrlPatterns: ["*://*/*"]
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-alt-text") {
    // Send message to content script to extract context
    browser.tabs.sendMessage(tab.id, {
      action: "extractContext",
      targetSrc: info.srcUrl
    });
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "processImage") {
    generateAltText(message.imageData, message.htmlContext)
      .then(altText => {
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
        browser.runtime.sendMessage({
          action: "displayError",
          error: error.message
        });
      });
  }
});

// Function to call OpenAI API for alt text generation
async function generateAltText(imageData, htmlContext) {
  try {
    // Get API key from storage
    const storage = await browser.storage.sync.get("openaiApiKey");
    const apiKey = storage.openaiApiKey;
    
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set it in the extension options.");
    }
    
    // Prepare prompt with HTML context
    const prompt = `Generate a concise, descriptive alt text for this image based on the surrounding HTML context. 
    The alt text should be accurate, informative, and help users with visual impairments understand the image's purpose.
    
    HTML Context: ${htmlContext}`;
    
    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
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
      throw new Error(data.error.message);
    }
    
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
} 