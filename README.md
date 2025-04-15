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

## MVP Implementation Plan

### Phase 1: Core Functionality
- Set up extension structure with manifest
- Implement context menu on images
- Create content script to extract image and HTML context
- Build basic popup UI to display results

### Phase 2: AI Integration
- Add OpenAI API integration
- Implement prompt engineering for optimal alt text generation
- Add user controls for AI model/settings

### Phase 3: WordPress Integration
- Add WordPress REST API authentication
- Implement direct updating of alt text in WordPress
- Add batch processing capabilities

## Development Setup
1. Clone repository
2. Install dependencies with `npm install`
3. Load unpacked extension in Firefox Developer Edition
4. Configure API keys in options page

## Limitations & Considerations
- Requires OpenAI API key (user-provided)
- Context extraction may vary based on WordPress theme structure
- WordPress API integration requires site credentials

## Future Enhancements
- Support for additional browsers (Chrome, Edge)
- Batch processing of multiple images
- AI model selection options
- Local model support for privacy
- Auto-detection of images without alt text
- Usage statistics and reporting 