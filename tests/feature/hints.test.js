/**
 * Graduated Hint System Feature Tests
 * Covers: showHint() rendering, clearHintSection(), lightbulb button wiring.
 */

import { jest } from '@jest/globals';
import { UIManager } from '../../src/ui/uiManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';
import { MapManager } from '../../src/lib/mapManager.js';

function createUIManager(overrides = {}) {
    const onGetHint = overrides.onGetHint || jest.fn();
    const ui = new UIManager({
        npcProfiler: new NpcProfiler(),
        mapManager: new MapManager(),
        onCommandSubmit: jest.fn(),
        onChoiceSubmit: jest.fn(),
        onRefresh: jest.fn(),
        onClearJournal: jest.fn(),
        onGetHint,
    });
    return { ui, onGetHint };
}

describe('UIManager hint UI', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('#palette-hint-btn', () => {
        test('lightbulb button exists after createCommandPalette()', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            expect(document.getElementById('palette-hint-btn')).not.toBeNull();
        });

        test('clicking lightbulb calls onGetHint', () => {
            const { ui, onGetHint } = createUIManager();
            ui.createCommandPalette();
            document.getElementById('palette-hint-btn').click();
            expect(onGetHint).toHaveBeenCalledTimes(1);
        });
    });

    describe('showHint()', () => {
        test('does nothing when palette is not created', () => {
            const { ui } = createUIManager();
            expect(() => ui.showHint('Try looking around.', 1)).not.toThrow();
            expect(document.getElementById('hint-section')).toBeNull();
        });

        test('does nothing for empty hint string', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('', 1);
            expect(document.getElementById('hint-section')).toBeNull();
        });

        test('does nothing for null hint', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint(null, 1);
            expect(document.getElementById('hint-section')).toBeNull();
        });

        test('inserts #hint-section into palette content', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Look around more carefully.', 1);
            expect(document.getElementById('hint-section')).not.toBeNull();
        });

        test('hint-section is inserted at the top of palette-content', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('A nudge hint.', 1);
            const content = document.querySelector('.palette-content');
            expect(content.firstElementChild.id).toBe('hint-section');
        });

        test('heading shows level label for level 1 (Nudge)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Look at things.', 1);
            const heading = document.querySelector('#hint-section h3');
            expect(heading.textContent).toContain('Nudge');
        });

        test('heading shows level label for level 2 (Moderate Hint)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Try using the key.', 2);
            const heading = document.querySelector('#hint-section h3');
            expect(heading.textContent).toContain('Moderate Hint');
        });

        test('heading shows level label for level 3 (Solution)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Type: unlock door with brass key.', 3);
            const heading = document.querySelector('#hint-section h3');
            expect(heading.textContent).toContain('Solution');
        });

        test('hint text is set via textContent (not innerHTML)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            const xssPayload = '<img src=x onerror=alert(1)>';
            ui.showHint(xssPayload, 1);
            const textEl = document.querySelector('.hint-text');
            // textContent renders it as literal text, not HTML
            expect(textEl.textContent).toBe(xssPayload);
            // No img element should have been created
            expect(document.querySelector('#hint-section img')).toBeNull();
        });

        test('hint text content matches the provided hint', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Examine the rusty key.', 1);
            const textEl = document.querySelector('.hint-text');
            expect(textEl.textContent).toBe('Examine the rusty key.');
        });

        test('shows escalate note for level 1', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Vague nudge.', 1);
            expect(document.querySelector('.hint-escalate-note')).not.toBeNull();
        });

        test('shows escalate note for level 2', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Moderate hint.', 2);
            expect(document.querySelector('.hint-escalate-note')).not.toBeNull();
        });

        test('does NOT show escalate note for level 3', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('Explicit solution.', 3);
            expect(document.querySelector('.hint-escalate-note')).toBeNull();
        });

        test('calling showHint() twice replaces the previous section (escalation)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('First nudge.', 1);
            ui.showHint('Second moderate hint.', 2);
            // Only one hint section should exist
            expect(document.querySelectorAll('#hint-section').length).toBe(1);
            const textEl = document.querySelector('.hint-text');
            expect(textEl.textContent).toBe('Second moderate hint.');
        });

        test('hint section has class hint-section', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('A hint.', 1);
            const section = document.getElementById('hint-section');
            expect(section.classList.contains('hint-section')).toBe(true);
        });
    });

    describe('clearHintSection()', () => {
        test('removes hint section when it exists', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('A hint.', 1);
            expect(document.getElementById('hint-section')).not.toBeNull();
            ui.clearHintSection();
            expect(document.getElementById('hint-section')).toBeNull();
        });

        test('is a no-op when no hint section exists', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            expect(() => ui.clearHintSection()).not.toThrow();
        });

        test('is a no-op when palette is not created', () => {
            const { ui } = createUIManager();
            expect(() => ui.clearHintSection()).not.toThrow();
        });
    });

    describe('updateCommandPalette() does NOT clear hint section', () => {
        test('hint persists across updateCommandPalette() calls', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.showHint('A hint.', 1);
            const state = {
                location: 'Hall',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                room_description: '',
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
                mapData: null,
                interactables: [],
            };
            ui.updateCommandPalette(state, 5);
            expect(document.getElementById('hint-section')).not.toBeNull();
        });
    });
});
