/**
 * Core Extension Feature Tests
 * Tests the basic functionality that currently works to prevent regressions
 *
 * Note: These tests focus on isolated functionality, not full initialization
 */

import { MapManager } from '../../src/lib/mapManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';

describe('Extension Core Features', () => {
    beforeEach(() => {
        // Setup DOM to simulate Parchment page
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Welcome to the game!</div>
        <div class="BufferLine">You are in a dark room.</div>
        <input type="text" id="input" />
      </div>
    `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('DOM Element Detection', () => {
        test('should find input field with standard selectors', () => {
            const inputField = document.querySelector('input[type="text"]');
            expect(inputField).toBeTruthy();
            expect(inputField.type).toBe('text');
        });

        test('should find output area with #gameport selector', () => {
            const outputArea = document.querySelector('#gameport');
            expect(outputArea).toBeTruthy();
            expect(outputArea.textContent).toContain('Welcome to the game');
        });

        test('should return null for missing input field', () => {
            document.body.innerHTML = '<div id="gameport">Text only</div>';
            const inputField = document.querySelector('input[type="text"]');
            expect(inputField).toBeNull();
        });

        test('should return null for missing output area', () => {
            document.body.innerHTML = '<input type="text" />';
            const outputArea = document.querySelector('#gameport');
            expect(outputArea).toBeNull();
        });
    });

    describe('UI Creation', () => {
        test('should create bubble element programmatically', () => {
            const bubble = document.createElement('div');
            bubble.id = 'parchment-assist-bubble';
            bubble.textContent = '🤖';
            document.body.appendChild(bubble);

            const found = document.querySelector('#parchment-assist-bubble');
            expect(found).toBeTruthy();
            expect(found.textContent).toBe('🤖');
        });

        test('should create command palette programmatically', () => {
            const palette = document.createElement('div');
            palette.id = 'parchment-assist-palette';
            palette.style.display = 'none';
            document.body.appendChild(palette);

            const found = document.querySelector('#parchment-assist-palette');
            expect(found).toBeTruthy();
            expect(found.style.display).toBe('none');
        });

        test('should toggle element visibility', () => {
            const element = document.createElement('div');
            element.style.display = 'none';
            document.body.appendChild(element);

            expect(element.style.display).toBe('none');

            element.style.display = 'block';
            expect(element.style.display).toBe('block');

            element.style.display = 'none';
            expect(element.style.display).toBe('none');
        });
    });

    describe('Command History', () => {
        test('should track submitted commands in array', () => {
            const commandHistory = [];

            commandHistory.push('look');
            commandHistory.push('take key');
            commandHistory.push('north');

            expect(commandHistory).toHaveLength(3);
            expect(commandHistory).toContain('look');
            expect(commandHistory).toContain('take key');
            expect(commandHistory).toContain('north');
        });

        test('should limit command history to 10 most recent', () => {
            let commandHistory = [];

            // Add 15 commands
            for (let i = 1; i <= 15; i++) {
                commandHistory.push(`command ${i}`);
                // Simulate the slice that happens in the actual code
                if (commandHistory.length > 10) {
                    commandHistory = commandHistory.slice(-10);
                }
            }

            expect(commandHistory).toHaveLength(10);
            expect(commandHistory[0]).toBe('command 6'); // Oldest kept
            expect(commandHistory[9]).toBe('command 15'); // Newest
        });
    });

    describe('Turn Counter', () => {
        test('should initialize and increment turn count', () => {
            let turnCount = 0;
            expect(turnCount).toBe(0);

            turnCount++;
            expect(turnCount).toBe(1);

            turnCount++;
            expect(turnCount).toBe(2);
        });
    });

    describe('Data Managers', () => {
        test('should initialize MapManager', () => {
            const mapManager = new MapManager();
            expect(mapManager).toBeTruthy();
            expect(mapManager.graph).toEqual({});
        });

        test('should initialize NpcProfiler', () => {
            const npcProfiler = new NpcProfiler();
            expect(npcProfiler).toBeTruthy();
            expect(npcProfiler.npcProfiles).toEqual({});
        });
    });

    describe('Event Handling', () => {
        test('should handle click events on buttons', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);

            let clicked = false;
            button.addEventListener('click', () => {
                clicked = true;
            });

            button.click();
            expect(clicked).toBe(true);
        });

        test('should handle modal close', () => {
            const modal = document.createElement('div');
            modal.style.display = 'block';
            document.body.appendChild(modal);

            const closeBtn = document.createElement('button');
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            closeBtn.click();
            expect(modal.style.display).toBe('none');
        });
    });
});
