# AltGen Setup Instructions

Follow these steps to complete the setup of your AltGen Firefox extension:

## 1. Add Icon Files

Before loading the extension, you need to create icon files in the `icons` directory:

- `altgen-19.png` (19x19 pixels)
- `altgen-38.png` (38x38 pixels)
- `altgen-48.png` (48x48 pixels)
- `altgen-96.png` (96x96 pixels)

You can use any image editor to create these icons, or download an accessibility-related icon from a free icon site.

## 2. Load the Extension in Firefox

1. Open Firefox
2. Type `about:debugging` in the URL bar
3. Click "This Firefox" on the left sidebar
4. Click "Load Temporary Add-on..."
5. Navigate to your AltGen directory and select the `manifest.json` file
6. The extension should now appear in the list of temporary extensions

## 3. Configure the Extension

1. Click on the AltGen icon in the Firefox toolbar
2. Select "Options" to open the options page
3. Enter your OpenAI API key (required)
4. Optionally, configure your WordPress site details if you want to use the direct update feature:
   - WordPress Site URL
   - WordPress Username
   - WordPress Application Password (not your regular password)
5. Select your default AltSync mode (empty or all)

## 4. Using the Extension

1. Navigate to any WordPress site
2. Right-click on an image
3. Select "Generate Alt Text with AI" from the context menu
4. Review the generated alt text in the popup
5. Use the "Copy to Clipboard" button to copy the text
6. Paste it into the WordPress image alt text field, or use the "Update in WordPress" button if you've configured WordPress integration
7. After updating, you can use the "Sync Alt Text" button to sync the alt text across all instances of this image on your site

## 5. Using AltSync

The AltSync feature allows you to update all instances of an image across your site:

1. Generate alt text for an image and update it in WordPress
2. After successful update, the Sync options will appear
3. Select a sync mode:
   - "Update Empty Alt Text Only" (safer, only updates instances with empty alt text)
   - "Update All Instances" (replaces all alt text with the new version)
4. Click "Sync Alt Text" to apply the changes across your site
5. The status message will show how many instances were updated

## Troubleshooting

- **OpenAI API errors**: Check that your API key is valid and has sufficient credits
- **Cross-origin errors**: Some sites may block access to their images. Try using the extension on your own WordPress site
- **WordPress update errors**: Verify your WordPress credentials and ensure that the REST API is enabled
- **AltSync errors**: Ensure the AltSync WordPress plugin is installed and activated on your site

## Development Notes

If you want to make changes to the extension:

1. Edit the files as needed
2. Reload the extension in `about:debugging` by clicking "Reload"
3. Test your changes

For permanent installation, the extension would need to be packaged and submitted to the Firefox Add-ons store. 