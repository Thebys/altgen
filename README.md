# AltGen: AI-Powered Alt Text Generator for WordPress

## Overview
AltGen is a Firefox browser extension that helps improve accessibility and SEO on WordPress sites by generating high-quality alt text for images using AI. The extension analyzes both the image and its surrounding HTML context to create meaningful descriptions that accurately reflect the image's purpose.

## Key Features
- Right-click menu on images to trigger alt text generation
- Analysis of image content and surrounding HTML context
- AI-powered alt text generation via OpenAI API
- Human-in-the-loop review and editing of suggested alt text
- Optional direct updating via WordPress REST API

## User Flow
1. User navigates to a WordPress page/post with images
2. User right-clicks on an image needing better alt text
3. Extension menu option "Generate Alt Text with AI" appears
4. User clicks the option, triggering context extraction
5. Extension sends image + context to AI API
6. Generated alt text appears in popup for review
7. User can copy text to clipboard or approve direct update to WordPress

## Technical Specifications

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
  "downloads"
],
"host_permissions": [
  "*://*/*"
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

## Features

### Core Functionality
- Firefox extension.
- Context menu on images.
- Content script to extract image and HTML context.
- Basic popup UI to display controls and results.


### AI Integration
- Using OpenAI API, BYOK, gpt40 (vision).
- Implement prompt engineering for optimal alt text generation.


### WordPress Integration
- Add WordPress REST API authentication using application password
- Implement direct updating of alt text in WordPress (Media Library)
- Can trigger site-wide update if you have [Altsync wordpress plugin](https://github.com/thebys/altsync) enabled.

## Setup
1. Clone repository.
2. Load unpacked extension in Firefox Developer Edition and enable Altgen. 
3. Right click extension icon -> Manage extension -> three dots -> options
4. Configure openAI API key with access to gpt4o model. 
5. Optional. Recomended. Set up Wordpress username (users username, not application password name) and application password.
Doing this will enable updating the alt text in Media library.
6. Optional. Recomended. Get Altsync plugin to sync empty & stale or all alt text from Media Library to posts. See https://github.com/thebys/altsync.

## Limitations & Considerations
- Requires OpenAI API key (user-provided).
- Context extraction may vary based on WordPress theme structure.
- WordPress API integration requires site credentials (app password).
- Does not work with basic auth enabled.

## Future Enhancements
- Support for additional browsers (Chrome, Edge).
- Batch processing of multiple images.
- AI model selection options.
- Local model support for privacy.