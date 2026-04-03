/**
 * Interactables Panel Feature Tests
 * Covers rendering, expand/collapse, click-to-submit, confidence ordering, and classic-view toggle.
 */

import { jest } from '@jest/globals';
import { UIManager } from '../../src/ui/uiManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';
import { MapManager } from '../../src/lib/mapManager.js';

function createUIManager(overrides = {}) {
    const onCommandSubmit = overrides.onCommandSubmit || jest.fn();
    const ui = new UIManager({
        npcProfiler: new NpcProfiler(),
        mapManager: new MapManager(),
        onCommandSubmit,
        onChoiceSubmit: jest.fn(),
        onRefresh: jest.fn(),
        onClearJournal: jest.fn(),
    });
    return { ui, onCommandSubmit };
}

const sampleInteractables = [
    {
        name: 'rusty key',
        type: 'object',
        actions: [
            { command: 'take rusty key', label: 'Take', confidence: 0.95 },
            { command: 'examine rusty key', label: 'Examine', confidence: 0.85 },
        ],
    },
    {
        name: 'old wizard',
        type: 'npc',
        actions: [
            { command: 'talk to old wizard', label: 'Talk', confidence: 0.9 },
            { command: 'ask old wizard about quest', label: 'Ask about quest', confidence: 0.75 },
        ],
    },
    {
        name: 'north',
        type: 'exit',
        actions: [{ command: 'go north', label: 'Go north', confidence: 0.98 }],
    },
];

describe('Interactables Panel', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('renderInteractables', () => {
        test('shows empty state when no interactables', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, []);

            expect(container.querySelector('.empty-state')).not.toBeNull();
            expect(container.querySelectorAll('.interactable-card').length).toBe(0);
        });

        test('renders one card per interactable', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            expect(container.querySelectorAll('.interactable-card').length).toBe(3);
        });

        test('each card shows the interactable name', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            const names = Array.from(container.querySelectorAll('.interactable-name')).map(
                (el) => el.textContent
            );
            expect(names).toContain('rusty key');
            expect(names).toContain('old wizard');
            expect(names).toContain('north');
        });

        test('each card shows the interactable type badge', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            const badges = Array.from(container.querySelectorAll('.interactable-type-badge')).map(
                (el) => el.textContent
            );
            expect(badges).toContain('object');
            expect(badges).toContain('npc');
            expect(badges).toContain('exit');
        });

        test('action buttons start hidden (cards collapsed)', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            container.querySelectorAll('.interactable-actions').forEach((actionsDiv) => {
                expect(actionsDiv.style.display).toBe('none');
            });
        });

        test('clicking card header expands actions', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            const firstCard = container.querySelector('.interactable-card');
            const header = firstCard.querySelector('.interactable-header');
            const actionsDiv = firstCard.querySelector('.interactable-actions');

            header.click();

            expect(actionsDiv.style.display).toBe('block');
            expect(header.getAttribute('aria-expanded')).toBe('true');
        });

        test('clicking header again collapses actions', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            const firstCard = container.querySelector('.interactable-card');
            const header = firstCard.querySelector('.interactable-header');
            const actionsDiv = firstCard.querySelector('.interactable-actions');

            header.click(); // expand
            header.click(); // collapse

            expect(actionsDiv.style.display).toBe('none');
            expect(header.getAttribute('aria-expanded')).toBe('false');
        });

        test('clicking an action button calls onCommandSubmit with the command', () => {
            const { ui, onCommandSubmit } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            // Expand first card
            const firstCard = container.querySelector('.interactable-card');
            firstCard.querySelector('.interactable-header').click();

            // Click the first action button (Take, confidence 0.95)
            const firstActionBtn = firstCard.querySelector('.action-button');
            firstActionBtn.click();

            expect(onCommandSubmit).toHaveBeenCalledWith('take rusty key', 'action');
        });

        test('action buttons include a confidence indicator', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            // Expand first card
            const firstCard = container.querySelector('.interactable-card');
            firstCard.querySelector('.interactable-header').click();

            const indicators = firstCard.querySelectorAll('.confidence-indicator');
            expect(indicators.length).toBeGreaterThan(0);
        });

        test('confidence indicator opacity reflects confidence value', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);

            const firstCard = container.querySelector('.interactable-card');
            firstCard.querySelector('.interactable-header').click();

            const indicators = firstCard.querySelectorAll('.confidence-indicator');
            // First action has confidence 0.95
            expect(indicators[0].style.opacity).toBe('0.95');
            // Second action has confidence 0.85
            expect(indicators[1].style.opacity).toBe('0.85');
        });

        test('clears previous content on re-render', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const container = document.getElementById('palette-interactables');
            ui.renderInteractables(container, sampleInteractables);
            ui.renderInteractables(container, [sampleInteractables[0]]);

            expect(container.querySelectorAll('.interactable-card').length).toBe(1);
        });

        test('does nothing if container is null', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            // Should not throw
            expect(() => ui.renderInteractables(null, sampleInteractables)).not.toThrow();
        });
    });

    describe('updateCommandPalette interactables mode (classicView=false)', () => {
        test('shows interactables section and hides classic sections by default', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.commandPalette.style.display = 'block';

            const state = {
                location: 'Library',
                inventory: [],
                exits: [],
                verbs: [],
                objects: [],
                npcs: [],
                quests: [],
                suggestedActions: [],
                interactables: sampleInteractables,
            };

            ui.updateCommandPalette(state, 1);

            const content = ui.commandPalette.querySelector('.palette-content');
            const interactablesSection = content.querySelector('#interactables-section');
            const verbsSection = content.querySelector('#palette-verbs')?.parentElement;

            expect(interactablesSection.style.display).toBe('block');
            expect(verbsSection.style.display).toBe('none');
        });

        test('renders interactable cards via updateCommandPalette', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const state = {
                location: 'Library',
                inventory: [],
                exits: [],
                verbs: [],
                objects: [],
                npcs: [],
                quests: [],
                suggestedActions: [],
                interactables: sampleInteractables,
            };

            ui.updateCommandPalette(state, 1);

            const cards = ui.commandPalette.querySelectorAll('.interactable-card');
            expect(cards.length).toBe(3);
        });
    });

    describe('updateCommandPalette classic mode (classicView=true)', () => {
        test('shows classic sections and hides interactables section', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.classicView = true;

            const state = {
                location: 'Library',
                inventory: [],
                exits: [],
                verbs: ['LOOK'],
                objects: ['book'],
                npcs: [],
                quests: [],
                suggestedActions: [],
                interactables: sampleInteractables,
            };

            ui.updateCommandPalette(state, 1);

            const content = ui.commandPalette.querySelector('.palette-content');
            const interactablesSection = content.querySelector('#interactables-section');
            const verbsSection = content.querySelector('#palette-verbs')?.parentElement;

            expect(interactablesSection.style.display).toBe('none');
            expect(verbsSection.style.display).toBe('block');
        });
    });

    describe('Classic View toggle', () => {
        test('palette header contains classic view button', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            expect(document.getElementById('palette-classic-view-btn')).not.toBeNull();
        });

        test('toggleClassicView flips classicView flag', async () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            expect(ui.classicView).toBe(false);
            await ui.toggleClassicView();
            expect(ui.classicView).toBe(true);
            await ui.toggleClassicView();
            expect(ui.classicView).toBe(false);
        });

        test('updateClassicViewUI adds active class when classic view is on', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.classicView = true;
            ui.updateClassicViewUI();

            const btn = document.getElementById('palette-classic-view-btn');
            expect(btn.classList.contains('classic-view-active')).toBe(true);
        });

        test('updateClassicViewUI removes active class when classic view is off', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.classicView = true;
            ui.updateClassicViewUI();
            ui.classicView = false;
            ui.updateClassicViewUI();

            const btn = document.getElementById('palette-classic-view-btn');
            expect(btn.classList.contains('classic-view-active')).toBe(false);
        });
    });
});
