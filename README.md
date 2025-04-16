# AltGen: AI-Powered Alt Text Generator for WordPress

![Version](https://img.shields.io/badge/version-0.9.6-blue)
![Firefox](https://img.shields.io/badge/Firefox-Compatible-orange)
![WordPress](https://img.shields.io/badge/WordPress-Compatible-green)

## 🔍 Overview
AltGen is a Firefox browser extension that helps improve accessibility and SEO on WordPress sites by generating high-quality alt text for images using AI. The extension analyzes both the image and its surrounding HTML context to create meaningful descriptions that accurately reflect the image's purpose.

## ✨ Key Features
- Right-click menu on images to trigger alt text generation
- Analysis of image content and surrounding HTML context
- AI-powered alt text generation via OpenAI API
- Human-in-the-loop review and editing of suggested alt text
- Optional direct updating via WordPress REST API
- Integration with [**AltSync WordPress plugin**](https://github.com/thebys/altsync) for site-wide alt text sync/update

## 🔄 User Flow
1. User navigates to a WordPress page/post with images
2. User right-clicks on an image needing better alt text
3. Extension menu option "Generate Alt Text with AI" appears
4. User clicks the option, triggering context extraction
5. Extension sends image + context to AI API
6. Generated alt text appears in popup for review
7. User can copy text to clipboard or approve direct update to WordPress

## 🛠️ Technical Specifications

### Browser Compatibility
- Firefox (primary target)
- Chrome/Edge (potential future support)

### Required Permissions
```json
"permissions": [
  "activeTab",
  "scripting", 
  "storage",
  "contextMenus",
  "downloads",
  "<all_urls>"
]
```

### Components
- **Manifest** (`manifest.json`): Extension configuration
- **Background Script**: Handles context menu creation and API communication
- **Content Script**: Extracts image and surrounding HTML context
- **Popup UI**: Displays generated alt text with editing/approval options
- **Options Page**: Stores API keys and WordPress credentials

### APIs & Integration
- **OpenAI API**: For generating alt text (GPT-4 or newer with vision capabilities)
- **WordPress REST API**: For updating image metadata (optional)

## 💡 Features

### Core Functionality
- Firefox extension with context menu on images
- Content script to extract image and HTML context
- Intuitive popup UI to display controls and results

### AI Integration
- OpenAI API integration (BYOK, GPT-4o with vision capabilities)
- Optimized prompt engineering for high-quality alt text generation

### WordPress Integration
- WordPress REST API authentication using application password
- Direct updating of alt text in WordPress Media Library
- Integration with [AltSync WordPress plugin](https://github.com/thebys/altsync) for site-wide alt text updates

## 📦 Installation
1. Clone repository
2. Load unpacked extension in Firefox Developer Edition and enable AltGen
3. Right-click extension icon → Manage extension → three dots → options
4. Configure OpenAI API key with access to GPT-4o model

## 🚀 Setup & Configuration
1. **API Setup**: Enter your OpenAI API key in the extension options
2. **WordPress Integration (Optional but Recommended)**:
   - Set up WordPress username (user's username, not application password name)
   - Configure application password to enable updating alt text in Media Library
3. **AltSync Plugin (Optional but Recommended)**:
   - Install [AltSync plugin](https://github.com/thebys/altsync) to sync alt text from Media Library to posts

## ⚠️ Limitations & Considerations
- Requires OpenAI API key (user-provided)
- Context extraction may vary based on WordPress theme structure
- WordPress API integration requires site credentials (app password)
- Does not work with basic auth enabled
- Mostly vibecoded and kinda slow

## ❓ FAQ
### Does this work with non-WordPress sites?
The extension works primarily with WordPress sites, especially for updating alt text. On sites where nobody cared for this so far. However, you can still use it to generate alt text suggestions on any site.

### How secure is my OpenAI API key?
Your API key is stored locally in your browser's extension storage.

### Can I use a different AI model?
Currently, the extension is optimized for OpenAI's GPT-4o, but we're exploring support for additional models in future updates. Feel free to fork this, even submit a PR.

## 🔮 Future Enhancements
- Support for additional browsers (Chrome, Edge)
- Batch processing of multiple images
- AI model selection options
- Local model support for privacy

## Credits
<p align="center">
<a href="https://impacthub.cz/" target="_blank">
  <img width="200" src="./misc/logo-impact-hub.jpg"><br>
Development sponsored by Impact Hub Czech Republic.
</a>
</p>