/**
 * Error Handling Tests
 * Tests error scenarios and edge cases to ensure stability
 */

import { jest } from '@jest/globals';
import { UIManager } from '../../src/ui/uiManager.js';
import { GameStateManager } from '../../src/content/gameStateManager.js';
import { MapManager } from '../../src/lib/mapManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';
import { HTMLCleaner } from '../../src/helpers/htmlCleaner.js';
import { AdvancedGameStateExtractor } from '../../src/helpers/textMiner.js';

function createUIManager(overrides = {}) {
    const npcProfiler = overrides.npcProfiler || new NpcProfiler();
    const mapManager = overrides.mapManager || new MapManager();
    const ui = new UIManager({
        npcProfiler,
        mapManager,
        onCommandSubmit: jest.fn(),
        onChoiceSubmit: jest.fn(),
        onRefresh: jest.fn(),
        onClearJournal: jest.fn(),
    });
    return { ui, npcProfiler, mapManager };
}

describe('Error Handling', () => {
    describe('GameStateManager Null Safety', () => {
        let gsm;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport">
          <div class="BufferLine">Test</div>
        </div>
        <input type="text" id="input" />
      `;
            gsm = new GameStateManager();
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('should handle missing input field gracefully', () => {
            document.body.innerHTML = '<div id="gameport">Text only</div>';
            const inputField = gsm.findInputField();
            expect(inputField).toBeNull();
        });

        test('should handle missing output area gracefully', () => {
            document.body.innerHTML = '<input type="text" />';
            const outputArea = gsm.findOutputArea();
            expect(outputArea).toBeNull();
        });

        test('should return null when extracting game state with missing DOM', async () => {
            document.body.innerHTML = ''; // Remove all DOM
            const result = await gsm.extractRawGameState();
            expect(result).toBeNull();
        });
    });

    describe('UIManager Null Safety', () => {
        let ui;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport">
          <div class="BufferLine">Test</div>
        </div>
        <input type="text" id="input" />
      `;
            ({ ui } = createUIManager());
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('should handle null commandPalette in updateCommandPalette', () => {
            ui.commandPalette = null;

            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            expect(() => {
                ui.updateCommandPalette(state, 0);
            }).not.toThrow();
        });

        test('should handle missing palette-content in updateCommandPalette', () => {
            ui.createCommandPalette();

            // Remove palette-content
            const paletteContent = document.querySelector('.palette-content');
            if (paletteContent && paletteContent.parentNode) {
                paletteContent.parentNode.removeChild(paletteContent);
            }

            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            expect(() => {
                ui.updateCommandPalette(state, 0);
            }).not.toThrow();
        });
    });

    describe('MapManager Edge Cases', () => {
        let mapManager;

        beforeEach(() => {
            mapManager = new MapManager();
        });

        test('should handle adding room with null data (bug fixed)', () => {
            // Now handles null roomData gracefully
            expect(() => {
                mapManager.addRoom('Room A', null);
            }).not.toThrow();

            const room = mapManager.getRoom('Room A');
            expect(room).toBeDefined();
            expect(room.exits).toEqual({});
            expect(room.items).toEqual([]);
        });

        test('should handle adding room with undefined exits', () => {
            expect(() => {
                mapManager.addRoom('Room A', {});
            }).not.toThrow();

            const room = mapManager.getRoom('Room A');
            expect(room.exits).toEqual({});
        });

        test('should handle getRoom for non-existent room', () => {
            const room = mapManager.getRoom('NonExistent');
            expect(room).toBeUndefined();
        });

        test('should handle deleteRoom for non-existent room', () => {
            const result = mapManager.deleteRoom('NonExistent');
            expect(result).toBe(false);
        });

        test('should not include deleted rooms in getMap', () => {
            mapManager.addRoom('Room A', { exits: [] });
            mapManager.addRoom('Room B', { exits: [] });
            mapManager.deleteRoom('Room A');

            const map = mapManager.getMap();
            expect(map.rooms['Room A']).toBeUndefined();
            expect(map.rooms['Room B']).toBeDefined();
        });

        test('should handle adding connection between non-existent rooms', () => {
            expect(() => {
                mapManager.addConnection('NonExistentA', 'NonExistentB', 'north');
            }).not.toThrow();
        });
    });

    describe('NpcProfiler Edge Cases', () => {
        let npcProfiler;

        beforeEach(() => {
            npcProfiler = new NpcProfiler();
        });

        test('should handle updateProfiles with null', () => {
            expect(() => {
                npcProfiler.updateProfiles(null);
            }).not.toThrow();
        });

        test('should handle updateProfiles with undefined', () => {
            expect(() => {
                npcProfiler.updateProfiles(undefined);
            }).not.toThrow();
        });

        test('should handle updateProfiles with non-object', () => {
            expect(() => {
                npcProfiler.updateProfiles('not an object');
            }).not.toThrow();

            expect(() => {
                npcProfiler.updateProfiles(123);
            }).not.toThrow();
        });

        test('should handle getProfile for non-existent NPC', () => {
            const profile = npcProfiler.getProfile('NonExistent');
            expect(profile).toBeUndefined();
        });

        test('should merge nested data correctly', () => {
            npcProfiler.updateProfiles({
                Gandalf: {
                    description: 'A wizard',
                    dialogue: ['Line 1'],
                },
            });

            npcProfiler.updateProfiles({
                Gandalf: {
                    location: 'Rivendell',
                    dialogue: ['Line 2'],
                },
            });

            const profile = npcProfiler.getProfile('Gandalf');
            expect(profile.description).toBe('A wizard');
            expect(profile.location).toBe('Rivendell');
            // Deep merge: dialogue arrays are appended, not replaced
            expect(profile.dialogue).toEqual(['Line 1', 'Line 2']);
        });
    });

    describe('HTMLCleaner Edge Cases', () => {
        test('should handle null input', () => {
            const result = HTMLCleaner.clean(null);
            expect(result).toBe('');
        });

        test('should handle undefined input', () => {
            const result = HTMLCleaner.clean(undefined);
            expect(result).toBe('');
        });

        test('should handle empty string', () => {
            const result = HTMLCleaner.clean('');
            expect(result).toBe('');
        });

        test('should handle malformed HTML gracefully', () => {
            const malformedHtml = '<div><p>Unclosed tags<div>';
            const result = HTMLCleaner.clean(malformedHtml);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        test('should handle HTML with no BufferLine elements', () => {
            const html = '<div>Some text</div><p>More text</p>';
            const result = HTMLCleaner.clean(html);

            expect(result).toContain('Some text');
            expect(result).toContain('More text');
        });

        test('should remove scripts even in malformed HTML', () => {
            const htmlWithScript = '<div><script>alert("xss")</script>Text</div>';
            const result = HTMLCleaner.clean(htmlWithScript);

            expect(result).not.toContain('script');
            expect(result).not.toContain('alert');
        });

        test('should handle very large HTML input', () => {
            const largeHtml = '<div class="BufferLine">' + 'a'.repeat(100000) + '</div>';

            expect(() => {
                const result = HTMLCleaner.clean(largeHtml);
                expect(result.length).toBeGreaterThan(0);
            }).not.toThrow();
        });
    });

    describe('AdvancedGameStateExtractor Edge Cases', () => {
        test('should handle null input', () => {
            const state = AdvancedGameStateExtractor.parse(null);

            expect(state).toBeDefined();
            expect(state.location).toBe('');
            expect(state.inventory).toBe('');
            expect(state.objects).toEqual([]);
            expect(state.npcs).toEqual([]);
            expect(state.exits).toEqual([]);
        });

        test('should handle undefined input', () => {
            const state = AdvancedGameStateExtractor.parse(undefined);

            expect(state).toBeDefined();
            expect(state.location).toBe('');
        });

        test('should handle empty string', () => {
            const state = AdvancedGameStateExtractor.parse('');

            expect(state).toBeDefined();
            expect(state.location).toBe('');
            expect(state.objects).toEqual([]);
        });

        test('should handle very long game text', () => {
            const longText = 'You are in a room. ' + 'a'.repeat(10000);

            expect(() => {
                const state = AdvancedGameStateExtractor.parse(longText);
                expect(state).toBeDefined();
            }).not.toThrow();
        });

        test('should handle text with only special characters', () => {
            const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const state = AdvancedGameStateExtractor.parse(specialText);

            expect(state).toBeDefined();
            expect(state.location).toBeDefined();
        });

        test('should handle text with unicode characters', () => {
            const unicodeText = 'You are in the 日本 room. There is a 鍵 here.';
            const state = AdvancedGameStateExtractor.parse(unicodeText);

            expect(state).toBeDefined();
            expect(state.location).toBeDefined();
        });

        test('should not crash on malformed inventory patterns', () => {
            const text = 'You are carrying: ';
            const state = AdvancedGameStateExtractor.parse(text);

            expect(state).toBeDefined();
            expect(state.inventory).toBeDefined();
        });

        test('should handle multiple consecutive newlines', () => {
            const text = 'Room A\n\n\n\nYou see a key.';
            const state = AdvancedGameStateExtractor.parse(text);

            expect(state).toBeDefined();
            expect(state.location).toBe('Room A');
        });
    });

    describe('Rendering Edge Cases', () => {
        let ui;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport">
          <div class="BufferLine">Test</div>
        </div>
        <input type="text" id="input" />
      `;
            ({ ui } = createUIManager());
            ui.createCommandPalette();
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('should handle rendering with extremely long item names', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const longName = 'a'.repeat(1000);
            const items = [longName];

            expect(() => {
                ui.renderList(container, items, 'test');
            }).not.toThrow();

            const renderedItems = container.querySelectorAll('.palette-item');
            expect(renderedItems.length).toBe(1);
            expect(renderedItems[0].textContent).toBe(longName);

            document.body.removeChild(container);
        });

        test('should handle rendering with special characters in item names', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const specialItems = ['<script>alert("xss")</script>', '"quoted"', "it's"];

            expect(() => {
                ui.renderList(container, specialItems, 'test');
            }).not.toThrow();

            const renderedItems = container.querySelectorAll('.palette-item');
            expect(renderedItems.length).toBe(3);

            // Should not execute script
            expect(container.querySelector('script')).toBeNull();

            document.body.removeChild(container);
        });

        test('should handle rendering very large lists', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const largeList = Array.from({ length: 1000 }, (_, i) => `item${i}`);

            expect(() => {
                ui.renderList(container, largeList, 'test');
            }).not.toThrow();

            const renderedItems = container.querySelectorAll('.palette-item');
            expect(renderedItems.length).toBe(1000);

            document.body.removeChild(container);
        });

        test('should handle malformed state objects gracefully (bug fixed)', () => {
            // All these states should now work without crashing
            const testStates = [
                { location: null, inventory: null },
                { location: 123, inventory: 'not an array' },
                {},
                { objects: 'string', npcs: 42 }, // Previously crashed, now fixed
            ];

            testStates.forEach((state) => {
                expect(() => {
                    ui.updateCommandPalette(state, 0);
                }).not.toThrow();
            });
        });
    });

    describe('XSS Prevention in Toasts', () => {
        let ui;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport"><div class="BufferLine">Test</div></div>
        <input type="text" id="input" />
      `;
            ({ ui } = createUIManager());
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('showError should render XSS payload as text, not HTML', () => {
            const xssPayload = '<img src=x onerror="window.__xss=true">';
            ui.showError(xssPayload);

            const toast = document.querySelector('.parchment-assist-toast-error');
            expect(toast).not.toBeNull();

            // Message text should be the raw payload string, not executed HTML
            const msgEl = toast.querySelector('.toast-message');
            expect(msgEl.textContent).toBe(xssPayload);

            // No <img> should be injected
            expect(toast.querySelector('img')).toBeNull();
            expect(window.__xss).toBeUndefined();
        });

        test('showStatus should render XSS payload as text, not HTML', () => {
            const xssPayload = '<script>window.__xss2=true</script>';
            ui.showStatus(xssPayload);

            const toast = document.querySelector('.parchment-assist-toast-success');
            expect(toast).not.toBeNull();

            const msgEl = toast.querySelector('.toast-message');
            expect(msgEl.textContent).toBe(xssPayload);

            expect(toast.querySelector('script')).toBeNull();
            expect(window.__xss2).toBeUndefined();
        });
    });

    describe('XSS Prevention in Map Rendering', () => {
        let ui;
        let mapManager;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport"><div class="BufferLine">Test</div></div>
        <input type="text" id="input" />
        <div id="room-list"></div>
      `;
            ({ ui, mapManager } = createUIManager());
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('renderMap should escape XSS in room names', () => {
            const xssRoomName = '<img src=x onerror="window.__xssMap=true">';
            mapManager.addRoom(xssRoomName, { items: [], exits: [] });
            ui.renderMap();

            const roomList = document.getElementById('room-list');
            expect(roomList.querySelector('img')).toBeNull();
            expect(window.__xssMap).toBeUndefined();
            // Room name rendered as text
            const nameEl = roomList.querySelector('.room-name');
            expect(nameEl.textContent).toBe(xssRoomName);
        });

        test('renderMap should escape XSS in item names', () => {
            const xssItem = '<script>window.__xssItem=true</script>';
            mapManager.addRoom('Safe Room', { items: [xssItem], exits: [] });
            ui.renderMap();

            const roomList = document.getElementById('room-list');
            expect(roomList.querySelector('script')).toBeNull();
            expect(window.__xssItem).toBeUndefined();
            const li = roomList.querySelector('.room-items li');
            expect(li.textContent).toBe(xssItem);
        });

        test('delete room button removes room from display', () => {
            mapManager.addRoom('Room A', { items: [], exits: [] });
            mapManager.addRoom('Room B', { items: [], exits: [] });
            ui.renderMap();

            const deleteBtn = document.querySelector('.delete-room-btn[data-room-name="Room A"]');
            expect(deleteBtn).not.toBeNull();
            deleteBtn.click();

            const roomList = document.getElementById('room-list');
            const roomNames = [...roomList.querySelectorAll('.room-name')].map(
                (el) => el.textContent
            );
            expect(roomNames).not.toContain('Room A');
            expect(roomNames).toContain('Room B');
        });
    });

    describe('XSS Prevention in Profile Rendering', () => {
        let ui;
        let npcProfiler;

        beforeEach(() => {
            document.body.innerHTML = `
        <div id="gameport"><div class="BufferLine">Test</div></div>
        <input type="text" id="input" />
        <div id="palette-profiles"></div>
      `;
            ({ ui, npcProfiler } = createUIManager());
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        test('renderProfiles should escape XSS in NPC names', () => {
            const xssName = '<img src=x onerror="window.__xssProfile=true">';
            npcProfiler.updateProfiles({
                [xssName]: { location: 'Town', description: 'A person', dialogue: ['Hello'] },
            });
            ui.renderProfiles();

            const container = document.getElementById('palette-profiles');
            expect(container.querySelector('img')).toBeNull();
            expect(window.__xssProfile).toBeUndefined();
            const nameEl = container.querySelector('.profile-name');
            expect(nameEl.textContent).toContain(xssName);
        });

        test('renderProfiles should escape XSS in NPC location', () => {
            const xssLocation = '<script>window.__xssLoc=true</script>';
            npcProfiler.updateProfiles({
                Villager: { location: xssLocation, dialogue: [] },
            });
            ui.renderProfiles();

            const container = document.getElementById('palette-profiles');
            expect(container.querySelector('script')).toBeNull();
            expect(window.__xssLoc).toBeUndefined();
        });

        test('renderProfiles should escape XSS in NPC description', () => {
            const xssDesc = '<img src=x onerror="window.__xssDesc=true">';
            npcProfiler.updateProfiles({
                Guard: { location: 'Gate', description: xssDesc, dialogue: [] },
            });
            ui.renderProfiles();

            const container = document.getElementById('palette-profiles');
            expect(container.querySelector('img')).toBeNull();
            expect(window.__xssDesc).toBeUndefined();
        });
    });

    describe('Memory and Resource Management', () => {
        test('should not leak event listeners on multiple renderList calls', () => {
            document.body.innerHTML = `
        <div id="gameport"><div class="BufferLine">Test</div></div>
        <input type="text" id="input" />
      `;
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.createCommandPalette();

            // Render multiple times
            for (let i = 0; i < 100; i++) {
                ui.renderList(container, [`item${i}`], 'test');
            }

            // Should only have last set of items
            const items = container.querySelectorAll('.palette-item');
            expect(items.length).toBe(1);

            document.body.removeChild(container);
            document.body.innerHTML = '';
        });

        test('should handle rapid successive updateCommandPalette calls', () => {
            document.body.innerHTML = `
        <div id="gameport"><div class="BufferLine">Test</div></div>
        <input type="text" id="input" />
      `;
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            expect(() => {
                for (let i = 0; i < 100; i++) {
                    state.location = `Room ${i}`;
                    ui.updateCommandPalette(state, i);
                }
            }).not.toThrow();

            const locationEl = document.querySelector('#palette-location');
            expect(locationEl.textContent).toContain('Room 99');

            document.body.innerHTML = '';
        });
    });
});
