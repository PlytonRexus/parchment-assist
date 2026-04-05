/**
 * OptionsManager Unit Tests
 * Tests settings load/save/reset and provider connection handling.
 */

import { jest } from '@jest/globals';
import { OptionsManager } from '../../src/ui/options.js';

// Minimal DOM matching options.html inputs
const OPTIONS_HTML = `
  <input type="checkbox" id="enableOllama" />
  <input type="checkbox" id="enableGemini" />
  <input type="checkbox" id="preferLocal" />
  <input type="text" id="ollamaModel" />
  <input type="text" id="geminiKey" />
  <input type="number" id="timeout" />
  <button id="saveSettings">Save</button>
  <button id="resetSettings">Reset</button>
  <button id="testOllama">Test Ollama</button>
  <button id="testGemini">Test Gemini</button>
  <span id="ollamaStatus" class="status-indicator"></span>
  <span id="geminiStatus" class="status-indicator"></span>
  <div id="testResults" class="test-results hidden"></div>
  <div id="saveStatus" class="hidden"></div>
`;

function makeChromeMock(syncData = {}) {
    return {
        storage: {
            sync: {
                get: jest.fn(async (defaults) => ({ ...defaults, ...syncData })),
                set: jest.fn(async () => {}),
                clear: jest.fn(async () => {}),
            },
        },
        runtime: {
            sendMessage: jest.fn(async () => {}),
        },
    };
}

describe('OptionsManager', () => {
    let manager;
    let chrome;

    beforeEach(() => {
        document.body.innerHTML = OPTIONS_HTML;
        chrome = makeChromeMock();
        globalThis.chrome = chrome;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.chrome;
        jest.restoreAllMocks();
    });

    describe('loadSettings()', () => {
        it('populates checkboxes from storage', async () => {
            chrome.storage.sync.get = jest.fn(async () => ({
                enableOllama: true,
                enableGemini: true,
                preferLocal: false,
                ollamaModel: 'mistral',
                geminiKey: 'key123',
                timeout: 20000,
            }));
            manager = new OptionsManager();
            await manager.loadSettings();

            expect(document.getElementById('enableOllama').checked).toBe(true);
            expect(document.getElementById('enableGemini').checked).toBe(true);
            expect(document.getElementById('preferLocal').checked).toBe(false);
            expect(document.getElementById('ollamaModel').value).toBe('mistral');
            expect(document.getElementById('geminiKey').value).toBe('key123');
            expect(document.getElementById('timeout').value).toBe('20'); // divided by 1000
        });

        it('uses defaults when storage returns empty', async () => {
            chrome.storage.sync.get = jest.fn(async (defaults) => defaults);
            manager = new OptionsManager();
            await manager.loadSettings();

            expect(document.getElementById('enableOllama').checked).toBe(true);
            expect(document.getElementById('ollamaModel').value).toBe('llama3');
        });
    });

    describe('saveSettings()', () => {
        it('writes correct settings object to storage', async () => {
            document.getElementById('enableOllama').checked = true;
            document.getElementById('enableGemini').checked = false;
            document.getElementById('preferLocal').checked = true;
            document.getElementById('ollamaModel').value = 'phi3';
            document.getElementById('geminiKey').value = '';
            document.getElementById('timeout').value = '10';

            manager = new OptionsManager();
            await manager.saveSettings(true);

            expect(chrome.storage.sync.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    enableOllama: true,
                    enableGemini: false,
                    ollamaModel: 'phi3',
                    timeout: 10000,
                    activeProviders: ['ollama'],
                })
            );
        });

        it('includes gemini in activeProviders only when key is non-empty', async () => {
            document.getElementById('enableOllama').checked = false;
            document.getElementById('enableGemini').checked = true;
            document.getElementById('geminiKey').value = 'mykey';
            document.getElementById('ollamaModel').value = 'llama3';
            document.getElementById('preferLocal').checked = true;
            document.getElementById('timeout').value = '15';

            manager = new OptionsManager();
            await manager.saveSettings(true);

            const call = chrome.storage.sync.set.mock.calls[0][0];
            expect(call.activeProviders).toContain('gemini');
            expect(call.activeProviders).not.toContain('ollama');
        });

        it('falls back to "llama3" when ollamaModel is blank', async () => {
            document.getElementById('ollamaModel').value = '   ';
            document.getElementById('enableOllama').checked = true;
            document.getElementById('enableGemini').checked = false;
            document.getElementById('geminiKey').value = '';
            document.getElementById('preferLocal').checked = true;
            document.getElementById('timeout').value = '15';

            manager = new OptionsManager();
            await manager.saveSettings(true);

            const call = chrome.storage.sync.set.mock.calls[0][0];
            expect(call.ollamaModel).toBe('llama3');
        });

        it('notifies service worker via sendMessage', async () => {
            document.getElementById('enableOllama').checked = true;
            document.getElementById('enableGemini').checked = false;
            document.getElementById('geminiKey').value = '';
            document.getElementById('ollamaModel').value = 'llama3';
            document.getElementById('preferLocal').checked = true;
            document.getElementById('timeout').value = '15';

            manager = new OptionsManager();
            await manager.saveSettings(true);

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'updateSettings' });
        });

        it('handles runtime unavailable gracefully', async () => {
            chrome.runtime.sendMessage = jest.fn(async () => {
                throw new Error('Could not establish connection');
            });
            document.getElementById('enableOllama').checked = true;
            document.getElementById('enableGemini').checked = false;
            document.getElementById('geminiKey').value = '';
            document.getElementById('ollamaModel').value = 'llama3';
            document.getElementById('preferLocal').checked = true;
            document.getElementById('timeout').value = '15';

            manager = new OptionsManager();
            await expect(manager.saveSettings(true)).resolves.not.toThrow();
        });

        it('shows status when silent=false', async () => {
            document.getElementById('enableOllama').checked = true;
            document.getElementById('enableGemini').checked = false;
            document.getElementById('geminiKey').value = '';
            document.getElementById('ollamaModel').value = 'llama3';
            document.getElementById('preferLocal').checked = true;
            document.getElementById('timeout').value = '15';

            manager = new OptionsManager();
            await manager.saveSettings(false);

            const statusDiv = document.getElementById('saveStatus');
            expect(statusDiv.classList.contains('hidden')).toBe(false);
            expect(statusDiv.textContent).toContain('saved');
        });
    });

    describe('resetSettings()', () => {
        it('clears storage and reloads defaults', async () => {
            manager = new OptionsManager();
            await manager.resetSettings();

            expect(chrome.storage.sync.clear).toHaveBeenCalled();
            expect(chrome.storage.sync.get).toHaveBeenCalled();
        });
    });

    describe('testOllamaConnection()', () => {
        it('sets status-online on successful fetch', async () => {
            globalThis.fetch = jest.fn(async () => ({
                ok: true,
                json: async () => ({ response: 'OK' }),
            }));
            document.getElementById('ollamaModel').value = 'llama3';

            manager = new OptionsManager();
            await manager.testOllamaConnection();

            expect(document.getElementById('ollamaStatus').className).toContain('status-online');
            delete globalThis.fetch;
        });

        it('sets status-offline on AbortError (timeout)', async () => {
            globalThis.fetch = jest.fn(async () => {
                const err = new Error('aborted');
                err.name = 'AbortError';
                throw err;
            });
            document.getElementById('ollamaModel').value = 'llama3';

            manager = new OptionsManager();
            await manager.testOllamaConnection();

            expect(document.getElementById('ollamaStatus').className).toContain('status-offline');
            expect(document.getElementById('testResults').textContent).toContain('timeout');
            delete globalThis.fetch;
        });

        it('sets status-offline on network error', async () => {
            globalThis.fetch = jest.fn(async () => {
                throw new Error('Failed to fetch');
            });
            document.getElementById('ollamaModel').value = 'llama3';

            manager = new OptionsManager();
            await manager.testOllamaConnection();

            expect(document.getElementById('ollamaStatus').className).toContain('status-offline');
            delete globalThis.fetch;
        });
    });

    describe('testGeminiConnection()', () => {
        it('returns early without fetching when API key is empty', async () => {
            globalThis.fetch = jest.fn();
            document.getElementById('geminiKey').value = '';

            manager = new OptionsManager();
            await manager.testGeminiConnection();

            expect(fetch).not.toHaveBeenCalled();
            delete globalThis.fetch;
        });

        it('sets status-online on successful Gemini fetch', async () => {
            globalThis.fetch = jest.fn(async () => ({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'OK' }] } }],
                }),
            }));
            document.getElementById('geminiKey').value = 'valid-key';

            manager = new OptionsManager();
            await manager.testGeminiConnection();

            expect(document.getElementById('geminiStatus').className).toContain('status-online');
            delete globalThis.fetch;
        });

        it('shows API_KEY_INVALID message on invalid key error', async () => {
            globalThis.fetch = jest.fn(async () => ({
                ok: false,
                json: async () => ({ error: { message: 'API_KEY_INVALID: key not valid' } }),
                status: 400,
                statusText: 'Bad Request',
            }));
            document.getElementById('geminiKey').value = 'bad-key';

            manager = new OptionsManager();
            await manager.testGeminiConnection();

            expect(document.getElementById('geminiStatus').className).toContain('status-offline');
            expect(document.getElementById('testResults').textContent).toContain('Invalid');
            delete globalThis.fetch;
        });
    });

    describe('showStatus()', () => {
        it('removes hidden class and sets textContent', () => {
            manager = new OptionsManager();
            manager.showStatus('All good!', 'success');
            const el = document.getElementById('saveStatus');
            expect(el.classList.contains('hidden')).toBe(false);
            expect(el.textContent).toBe('All good!');
            expect(el.className).toContain('success');
        });

        it('auto-hides after 3 seconds', () => {
            jest.useFakeTimers();
            manager = new OptionsManager();
            manager.showStatus('Saved', 'success');
            const el = document.getElementById('saveStatus');
            expect(el.classList.contains('hidden')).toBe(false);
            jest.advanceTimersByTime(3000);
            expect(el.classList.contains('hidden')).toBe(true);
            jest.useRealTimers();
        });
    });

    describe('debounce()', () => {
        it('calls fn only once after the wait period', () => {
            jest.useFakeTimers();
            manager = new OptionsManager();
            const fn = jest.fn();
            const debounced = manager.debounce(fn, 200);

            debounced();
            debounced();
            debounced();
            expect(fn).not.toHaveBeenCalled();
            jest.advanceTimersByTime(200);
            expect(fn).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });
    });
});
