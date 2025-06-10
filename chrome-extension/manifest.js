import fs from 'node:fs';
import deepmerge from 'deepmerge';

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));

const isFirefox = process.env.__FIREFOX__ === 'true';
const isOpera = process.env.__OPERA__ === 'true';

/**
 * If you want to disable the sidePanel, you can delete withSidePanel function and remove the sidePanel HoC on the manifest declaration.
 *
 * ```js
 * const manifest = { // remove `withSidePanel()`
 * ```
 */
function withSidePanel(manifest) {
  // Firefox does not support sidePanel
  if (isFirefox) {
    return manifest;
  }
  return deepmerge(manifest, {
    side_panel: {
      default_path: 'side-panel/index.html',
    },
    permissions: ['sidePanel'],
  });
}

/**
 * Adds Opera sidebar support using the sidebar_action API.
 * This is compatible with Chrome extensions and won't break Chrome Web Store validation.
 */
function withOperaSidebar(manifest) {
  // Only add Opera sidebar_action if building specifically for Opera
  if (isFirefox || !isOpera) {
    return manifest;
  }

  return deepmerge(manifest, {
    sidebar_action: {
      default_panel: 'side-panel/index.html',
      default_title: 'Monarch', // Keep Monarch title
      default_icon: 'icons/icon-32.svg', // Updated to SVG
    },
  });
}

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = withOperaSidebar(
  withSidePanel({
    manifest_version: 3,
    default_locale: 'en',
    /**
     * if you want to support multiple languages, you can use the following reference
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
     */
    name: '__MSG_extensionName__', // Will pick up "Monarch" from messages.json
    version: packageJson.version,
    description: '__MSG_extensionDescription__', // Will pick up "AI Assistant For Everything"
    host_permissions: ['<all_urls>'],
    permissions: [
      'storage',
      'scripting',
      'tabs',
      'activeTab',
      'debugger',
      'identity',
      'identity.email',
      // Keep other permissions as they were
    ],
    oauth2: {
      client_id: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_FROM_ENV_HERE", // Use env var or placeholder
      scopes: (process.env.GOOGLE_WORKSPACE_SCOPES || "https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile").split(',')
      // Example:
      // scopes: [
      //   "https://www.googleapis.com/auth/userinfo.email",
      //   "https://www.googleapis.com/auth/userinfo.profile",
      //   "https://www.googleapis.com/auth/gmail.readonly",
      //   "https://www.googleapis.com/auth/drive.readonly"
      // ]
    },
    options_page: 'options/index.html',
    background: {
      service_worker: 'background.iife.js',
      type: 'module',
    },
    action: {
      default_icon: 'icons/icon-32.svg', // Updated to SVG
    },
    icons: {
      16: 'icons/icon-16.svg',   // Updated to SVG
      32: 'icons/icon-32.svg',   // Updated to SVG
      48: 'icons/icon-48.svg',   // Updated to SVG
      128: 'icons/icon-128.svg', // Updated to SVG
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['content/index.iife.js'],
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          '*.js', // Keep for other JS files
          '*.css', // Keep for CSS files
          // '*.svg', // Keep for other SVGs like monarch-logo.svg - this is too broad, be specific
          'monarch-logo.svg', // Explicitly keep if used directly from web_accessible_resources
          'icons/icon-16.svg',   // Added SVG
          'icons/icon-32.svg',   // Added SVG
          'icons/icon-48.svg',   // Added SVG
          'icons/icon-128.svg',  // Added SVG
          'permission/index.html',
          'permission/permission.js',
          'oauth_callback.html', // Ensure this is accessible if used
        ],
        matches: ['*://*/*'],
      },
    ],
  }),
);

export default manifest;
