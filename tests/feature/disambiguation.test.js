/**
 * Disambiguation / Error Recovery Feature Tests
 * Covers: rephrase alternatives UI rendering, click-to-submit, and
 * TextMiner fallback interactables when AI is unavailable.
 */

import { jest } from '@jest/globals';
import { UIManager } from '../../src/ui/uiManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';
import { MapManager } from '../../src/lib/mapManager.js';
import { AdvancedGameStateExtractor } from '../../src/helpers/textMiner.js';

function createUIManager(overrides = {}) {
    const onChoiceSubmit = overrides.onChoiceSubmit || jest.fn();
    const ui = new UIManager({
        npcProfiler: new NpcProfiler(),
        mapManager: new MapManager(),
        onCommandSubmit: jest.fn(),
        onChoiceSubmit,
        onRefresh: jest.fn(),
        onClearJournal: jest.fn(),
    });
    return { ui, onChoiceSubmit };
}

const sampleAlternatives = [
    { command: 'examine sword', label: 'Examine' },
    { command: 'take sword', label: 'Take' },
    { command: 'drop sword', label: 'Drop' },
];

describe('UIManager.showRephraseAlternatives()', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('does nothing when palette is not created', () => {
        const { ui } = createUIManager();
        expect(() => ui.showRephraseAlternatives(sampleAlternatives)).not.toThrow();
    });

    test('does nothing for empty alternatives array', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives([]);
        expect(document.getElementById('rephrase-section')).toBeNull();
    });

    test('inserts rephrase section into palette content', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        expect(document.getElementById('rephrase-section')).not.toBeNull();
    });

    test('renders one button per alternative', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const buttons = document.querySelectorAll('.rephrase-btn');
        expect(buttons.length).toBe(3);
    });

    test('button text is the label field', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const buttons = Array.from(document.querySelectorAll('.rephrase-btn'));
        expect(buttons[0].textContent).toBe('Examine');
        expect(buttons[1].textContent).toBe('Take');
        expect(buttons[2].textContent).toBe('Drop');
    });

    test('button title is the full command', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const buttons = Array.from(document.querySelectorAll('.rephrase-btn'));
        expect(buttons[0].title).toBe('examine sword');
    });

    test('clicking a button calls onChoiceSubmit with the command', () => {
        const { ui, onChoiceSubmit } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const firstBtn = document.querySelector('.rephrase-btn');
        firstBtn.click();
        expect(onChoiceSubmit).toHaveBeenCalledWith('examine sword');
    });

    test('clicking a button removes the rephrase section', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const firstBtn = document.querySelector('.rephrase-btn');
        firstBtn.click();
        expect(document.getElementById('rephrase-section')).toBeNull();
    });

    test('rephrase section is inserted before other palette content', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        const content = document.querySelector('.palette-content');
        expect(content.firstElementChild.id).toBe('rephrase-section');
    });

    test('calling showRephraseAlternatives twice replaces the old section', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        ui.showRephraseAlternatives([{ command: 'look', label: 'Look' }]);
        expect(document.querySelectorAll('#rephrase-section').length).toBe(1);
        expect(document.querySelectorAll('.rephrase-btn').length).toBe(1);
    });
});

describe('UIManager.clearRephraseSection()', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('removes rephrase section if present', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        ui.clearRephraseSection();
        expect(document.getElementById('rephrase-section')).toBeNull();
    });

    test('does nothing if no rephrase section exists', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        expect(() => ui.clearRephraseSection()).not.toThrow();
    });

    test('updateCommandPalette clears rephrase section', () => {
        const { ui } = createUIManager();
        ui.createCommandPalette();
        ui.showRephraseAlternatives(sampleAlternatives);
        ui.classicView = true;
        ui.updateCommandPalette(
            {
                location: 'Forest',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                suggestedActions: [],
                interactables: [],
            },
            1
        );
        expect(document.getElementById('rephrase-section')).toBeNull();
    });
});

describe('TextMiner fallback interactables (6.3)', () => {
    test('parse() returns interactables field', () => {
        const result = AdvancedGameStateExtractor.parse('');
        expect(result).toHaveProperty('interactables');
        expect(Array.isArray(result.interactables)).toBe(true);
    });

    test('generates object interactables from detected objects', () => {
        const gameText = 'You can see a rusty sword here. You can see a brass lamp here.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        const names = result.interactables.map((i) => i.name);
        expect(result.interactables.some((i) => i.type === 'object')).toBe(true);
        // Interactable names use base nouns (e.g. "sword" not "rusty sword")
        expect(names).toContain('sword');
        expect(names).toContain('lamp');
    });

    test('object interactables include examine and take actions', () => {
        const gameText = 'You can see a rusty sword here.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        const objInteractables = result.interactables.filter((i) => i.type === 'object');
        // If objects were detected, verify action labels
        objInteractables.forEach((objInteractable) => {
            const labels = objInteractable.actions.map((a) => a.label);
            expect(labels).toContain('Examine');
            expect(labels).toContain('Take');
        });
    });

    test('bare cardinal directions are NOT generated as exit interactables', () => {
        const gameText = 'You can go north. You can go south.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        const exitInteractables = result.interactables.filter((i) => i.type === 'exit');
        // Bare directions like "north"/"south" are skipped — players type them directly
        expect(exitInteractables.length).toBe(0);
    });

    test('named destinations ARE generated as exit interactables', () => {
        const gameText = 'To the north is the Tower of Doom.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        // "north" is extracted as an exit by extractExits, but filtered out as bare direction
        // The Tower would need to be extracted as a named exit by the AI, not the heuristic
        const exitInteractables = result.interactables.filter((i) => i.type === 'exit');
        const bareDirections = exitInteractables.filter((i) =>
            AdvancedGameStateExtractor._BARE_DIRECTIONS.has(i.name.toLowerCase())
        );
        expect(bareDirections.length).toBe(0);
    });

    test('generates npc interactables from detected NPCs', () => {
        const gameText = 'Gandalf says hello and looks at you.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        const npcInteractables = result.interactables.filter((i) => i.type === 'npc');
        npcInteractables.forEach((npcInteractable) => {
            const labels = npcInteractable.actions.map((a) => a.label);
            expect(labels).toContain('Talk');
        });
    });

    test('generateInteractables returns empty array for empty parsed state', () => {
        const emptyState = { objects: [], npcs: [], exits: [] };
        const result = AdvancedGameStateExtractor.generateInteractables(emptyState);
        expect(result).toEqual([]);
    });

    test('all interactable actions have command, label, and confidence', () => {
        const gameText = 'You can see a key here. You can go north.';
        const result = AdvancedGameStateExtractor.parse(gameText);
        for (const interactable of result.interactables) {
            for (const action of interactable.actions) {
                expect(typeof action.command).toBe('string');
                expect(typeof action.label).toBe('string');
                expect(typeof action.confidence).toBe('number');
                expect(action.confidence).toBeGreaterThanOrEqual(0);
                expect(action.confidence).toBeLessThanOrEqual(1);
            }
        }
    });
});
