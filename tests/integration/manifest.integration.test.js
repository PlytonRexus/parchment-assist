/**
 * Manifest Validation Tests
 * Tests the manifest.json structure and configuration
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = join(__dirname, '../../manifest.json');

describe('Manifest Configuration', () => {
    let manifest;

    beforeAll(() => {
        const manifestContent = readFileSync(manifestPath, 'utf-8');
        manifest = JSON.parse(manifestContent);
    });

    describe('Basic Structure', () => {
        test('should have manifest_version 3', () => {
            expect(manifest.manifest_version).toBe(3);
        });

        test('should have required metadata', () => {
            expect(manifest.name).toBe('Parchment-Assist');
            expect(manifest.version).toBeDefined();
            expect(manifest.description).toBeDefined();
        });

        test('should have required permissions', () => {
            expect(manifest.permissions).toContain('storage');
            expect(manifest.permissions).toContain('scripting');
            expect(manifest.permissions).toContain('activeTab');
        });
    });

    describe('Background Service Worker', () => {
        test('should configure service worker correctly', () => {
            expect(manifest.background).toBeDefined();
            expect(manifest.background.service_worker).toBe('src/background/service-worker.js');
        });

        test('should configure service worker as ES6 module', () => {
            // This is critical - without type: "module", ES6 export/import will fail
            expect(manifest.background.type).toBe('module');
        });
    });

    describe('Content Scripts', () => {
        test('should have content script configuration', () => {
            expect(manifest.content_scripts).toBeDefined();
            expect(manifest.content_scripts.length).toBeGreaterThan(0);
        });

        test('should load content-loader.js', () => {
            const contentScript = manifest.content_scripts[0];
            expect(contentScript.js).toContain('src/content/content-loader.js');
        });

        test('should load ui.css', () => {
            const contentScript = manifest.content_scripts[0];
            expect(contentScript.css).toContain('src/ui/ui.css');
        });

        test('should match iplayif.com', () => {
            const contentScript = manifest.content_scripts[0];
            expect(contentScript.matches).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('iplayif.com'),
                ])
            );
        });
    });

    describe('Web Accessible Resources', () => {
        test('should expose content.js as web accessible', () => {
            const resources = manifest.web_accessible_resources[0];
            expect(resources.resources).toContain('src/content/content.js');
        });

        test('should expose helper modules', () => {
            const resources = manifest.web_accessible_resources[0];
            expect(resources.resources).toContain('src/helpers/htmlCleaner.js');
            expect(resources.resources).toContain('src/lib/npc.js');
            expect(resources.resources).toContain('src/lib/mapManager.js');
        });
    });

    describe('Host Permissions', () => {
        test('should allow localhost Ollama access', () => {
            expect(manifest.host_permissions).toContain('http://localhost:11434/*');
        });

        test('should allow Gemini API access', () => {
            expect(manifest.host_permissions).toContain(
                'https://generativelanguage.googleapis.com/*'
            );
        });
    });

    describe('UI Configuration', () => {
        test('should configure options page', () => {
            expect(manifest.options_page).toBe('src/ui/options.html');
        });

        test('should configure action popup', () => {
            expect(manifest.action.default_popup).toBe('src/ui/popup.html');
            expect(manifest.action.default_title).toBe('Parchment-Assist');
        });

        test('should configure extension icons', () => {
            expect(manifest.icons).toEqual({
                16: 'src/assets/icons/icon16.png',
                32: 'src/assets/icons/icon32.png',
                48: 'src/assets/icons/icon48.png',
                128: 'src/assets/icons/icon128.png',
            });
        });
    });
});
