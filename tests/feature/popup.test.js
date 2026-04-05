/**
 * Popup Feature Tests
 * Tests the PopupManager's "Enable on this page" functionality.
 */

import { jest } from '@jest/globals';
import { PopupManager } from '../../src/ui/popup.js';

// Minimal popup HTML structure for tests
const POPUP_HTML = `
  <span id="activeTab">Checking...</span>
  <span id="localStatus"><span></span><span id="localIndicator" class="indicator offline"></span></span>
  <span id="cloudStatus"><span></span><span id="cloudIndicator" class="indicator offline"></span></span>
  <span id="location">Unknown</span>
  <span id="inventory">Unknown</span>
  <div id="savesSection" style="display:none">
    <div class="saves-header">
      <span class="status-label">Save Slots</span>
      <button class="btn save-btn" id="saveStateBtn">📸 Save</button>
    </div>
    <div id="savesList"></div>
  </div>
  <button id="openOptions">Settings</button>
  <button id="testConnection">Test</button>
  <button id="manualSuggest">Suggest</button>
  <button id="enablePage">Enable Here</button>
`;

function makeChromeTabsMock(tabUrl = 'https://example.com/game') {
    return {
        query: jest.fn(async () => [{ id: 42, url: tabUrl }]),
        sendMessage: jest.fn(),
    };
}

function makeChromeStorageMock(localData = {}) {
    const store = { ...localData };
    return {
        local: {
            get: jest.fn(async (keys) => {
                const result = {};
                for (const k of Array.isArray(keys) ? keys : [keys]) {
                    if (k in store) {
                        result[k] = store[k];
                    }
                }
                return result;
            }),
            set: jest.fn(async (data) => {
                Object.assign(store, data);
            }),
            _store: store,
        },
        sync: {
            get: jest.fn(async () => ({ activeProviders: [] })),
        },
    };
}

function makeChromeScriptingMock() {
    return {
        executeScript: jest.fn(async () => {}),
        insertCSS: jest.fn(async () => {}),
    };
}

function makeChromeRuntimeMock() {
    return {
        openOptionsPage: jest.fn(),
        lastError: null,
        sendMessage: jest.fn(async () => ({})),
    };
}

beforeEach(() => {
    document.body.innerHTML = POPUP_HTML;
    global.chrome = {
        tabs: makeChromeTabsMock(),
        storage: makeChromeStorageMock(),
        scripting: makeChromeScriptingMock(),
        runtime: makeChromeRuntimeMock(),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
    delete global.chrome;
});

describe('Popup "Enable on this page" button', () => {
    test('button exists in DOM', () => {
        expect(document.getElementById('enablePage')).not.toBeNull();
    });

    test('button initial text contains "Enable Here"', () => {
        expect(document.getElementById('enablePage').textContent).toContain('Enable Here');
    });

    test('enableOnThisPage calls executeScript with func to set manual enable flag', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({ func: expect.any(Function) })
        );
    });

    test('enableOnThisPage injects content-loader.js via executeScript', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        const calls = chrome.scripting.executeScript.mock.calls;
        const fileCall = calls.find(
            (c) => c[0].files && c[0].files.includes('src/content/content-loader.js')
        );
        expect(fileCall).toBeDefined();
    });

    test('enableOnThisPage injects ui.css via insertCSS', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        expect(chrome.scripting.insertCSS).toHaveBeenCalledWith(
            expect.objectContaining({ files: ['src/ui/ui.css'] })
        );
    });

    test('enableOnThisPage stores the origin in chrome.storage.local', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        expect(chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                enabledOrigins: expect.arrayContaining(['https://example.com']),
            })
        );
    });

    test('enableOnThisPage updates button text to "Enabled ✓"', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        expect(document.getElementById('enablePage').textContent).toBe('Enabled ✓');
    });

    test('enableOnThisPage adds .enabled class to button', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        expect(document.getElementById('enablePage').classList.contains('enabled')).toBe(true);
    });

    test('_refreshEnableButton shows "Enabled ✓" when origin already in storage', async () => {
        global.chrome.storage = makeChromeStorageMock({
            enabledOrigins: ['https://example.com'],
        });
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/page' };
        await pm._refreshEnableButton(tab);

        const btn = document.getElementById('enablePage');
        expect(btn.textContent).toBe('Enabled ✓');
        expect(btn.classList.contains('enabled')).toBe(true);
    });

    test('_refreshEnableButton shows "▶ Enable Here" when origin not in storage', async () => {
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://other.com/page' };
        await pm._refreshEnableButton(tab);

        const btn = document.getElementById('enablePage');
        expect(btn.textContent).toBe('▶ Enable Here');
        expect(btn.classList.contains('enabled')).toBe(false);
    });

    test('enableOnThisPage does not duplicate origin in storage', async () => {
        global.chrome.storage = makeChromeStorageMock({
            enabledOrigins: ['https://example.com'],
        });
        const pm = new PopupManager();
        const tab = { id: 42, url: 'https://example.com/game' };
        await pm.enableOnThisPage(tab);

        const setCall = chrome.storage.local.set.mock.calls[0][0];
        const origins = setCall.enabledOrigins;
        const count = origins.filter((o) => o === 'https://example.com').length;
        expect(count).toBe(1);
    });
});

describe('Popup Save Slots', () => {
    test('saves section is hidden when no game title', () => {
        const section = document.getElementById('savesSection');
        expect(section.style.display).toBe('none');
    });

    test('_saveCurrentState sends getStateSnapshot and stores to saves_${gameTitle}', async () => {
        const mockSnapshot = {
            map: {},
            npcs: {},
            quests: [],
            meta: { turnCount: 1, commandHistory: [], rejectedCommands: [] },
        };
        global.chrome.tabs.sendMessage = jest.fn((tabId, msg, cb) => {
            cb({ success: true, snapshot: mockSnapshot });
        });

        const pm = new PopupManager();
        pm._currentGameTitle = 'Zork';
        pm._currentTabId = 42;

        await pm._saveCurrentState();

        expect(chrome.storage.local.set).toHaveBeenCalled();
        const setCall = chrome.storage.local.set.mock.calls.find(
            (c) => c[0]['saves_Zork'] !== undefined
        );
        expect(setCall).toBeDefined();
        const saves = setCall[0]['saves_Zork'];
        expect(saves).toHaveLength(1);
        expect(saves[0].snapshot).toEqual(mockSnapshot);
        expect(saves[0].id).toBeDefined();
        expect(saves[0].name).toBeDefined();
    });

    test('max 5 saves enforced — 6th overwrites oldest', async () => {
        const existingSaves = Array.from({ length: 5 }, (_, i) => ({
            id: String(i),
            name: `Save ${i}`,
            snapshot: { meta: { turnCount: i } },
        }));
        global.chrome.storage = makeChromeStorageMock({ saves_Zork: existingSaves });
        global.chrome.tabs.sendMessage = jest.fn((tabId, msg, cb) => {
            cb({ success: true, snapshot: { meta: { turnCount: 99 } } });
        });

        const pm = new PopupManager();
        pm._currentGameTitle = 'Zork';
        pm._currentTabId = 42;

        await pm._saveCurrentState();

        const setCall = chrome.storage.local.set.mock.calls.find(
            (c) => c[0]['saves_Zork'] !== undefined
        );
        const saves = setCall[0]['saves_Zork'];
        expect(saves).toHaveLength(5);
        // Oldest (id "0") should be gone
        expect(saves.find((s) => s.id === '0')).toBeUndefined();
        // Newest should be last
        expect(saves[saves.length - 1].snapshot.meta.turnCount).toBe(99);
    });

    test('_restoreSave sends restoreStateSnapshot with correct snapshot', async () => {
        const snapshot = { map: { Hall: {} }, meta: { turnCount: 5 } };
        global.chrome.tabs.sendMessage = jest.fn((tabId, msg, cb) => {
            cb({ success: true });
        });

        const pm = new PopupManager();
        pm._currentTabId = 42;

        await pm._restoreSave({ id: '1', name: 'Save 1', snapshot });

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            42,
            { action: 'restoreStateSnapshot', snapshot },
            expect.any(Function)
        );
    });

    test('_deleteSave removes save from storage and re-renders', async () => {
        const saves = [
            { id: '1', name: 'Save 1', snapshot: {} },
            { id: '2', name: 'Save 2', snapshot: {} },
        ];
        global.chrome.storage = makeChromeStorageMock({ saves_Zork: saves });

        const pm = new PopupManager();
        pm._currentGameTitle = 'Zork';

        await pm._deleteSave('1');

        const setCall = chrome.storage.local.set.mock.calls.find(
            (c) => c[0]['saves_Zork'] !== undefined
        );
        const remaining = setCall[0]['saves_Zork'];
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe('2');
    });
});
