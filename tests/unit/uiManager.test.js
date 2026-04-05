/**
 * UIManager Unit Tests
 */

import { jest } from '@jest/globals';
import { UIManager } from '../../src/ui/uiManager.js';
import { NpcProfiler } from '../../src/lib/npc.js';
import { MapManager } from '../../src/lib/mapManager.js';

function createUIManager(overrides = {}) {
    const npcProfiler = overrides.npcProfiler || new NpcProfiler();
    const mapManager = overrides.mapManager || new MapManager();
    const onCommandSubmit = overrides.onCommandSubmit || jest.fn();
    const onChoiceSubmit = overrides.onChoiceSubmit || jest.fn();
    const onRefresh = overrides.onRefresh || jest.fn();
    const onClearJournal = overrides.onClearJournal || jest.fn();
    const onUndoAI = overrides.onUndoAI || jest.fn();

    const ui = new UIManager({
        npcProfiler,
        mapManager,
        onCommandSubmit,
        onChoiceSubmit,
        onRefresh,
        onClearJournal,
        onUndoAI,
    });
    return { ui, npcProfiler, mapManager, onCommandSubmit, onChoiceSubmit, onRefresh, onUndoAI };
}

describe('UIManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
      <div id="gameport"><div class="BufferLine">Test</div></div>
      <input type="text" id="input" />
    `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('createCommandPalette', () => {
        test('should create bubble and palette elements', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            expect(document.getElementById('parchment-assist-bubble')).not.toBeNull();
            expect(document.getElementById('parchment-assist-palette')).not.toBeNull();
        });

        test('should create NPC modal', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            expect(document.getElementById('parchment-assist-npc-modal')).not.toBeNull();
        });

        test('should not create duplicate palette on second call', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.createCommandPalette();

            const bubbles = document.querySelectorAll('#parchment-assist-bubble');
            expect(bubbles.length).toBe(1);
        });

        test('should start with palette hidden', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            const palette = document.getElementById('parchment-assist-palette');
            expect(palette.style.display).toBe('none');
        });
    });

    describe('togglePalette', () => {
        test('should show palette when hidden', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.togglePalette();
            expect(ui.commandPalette.style.display).toBe('block');
        });

        test('should hide palette when visible', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.commandPalette.style.display = 'block';

            ui.togglePalette();
            expect(ui.commandPalette.style.display).toBe('none');
        });

        test('should not throw when commandPalette is null', () => {
            const { ui } = createUIManager();
            ui.commandPalette = null;
            expect(() => ui.togglePalette()).not.toThrow();
        });
    });

    describe('renderList', () => {
        test('should render items as palette-item elements', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderList(container, ['sword', 'key', 'lantern'], 'object');

            const items = container.querySelectorAll('.palette-item');
            expect(items.length).toBe(3);
            const texts = Array.from(items).map((el) => el.textContent);
            expect(texts).toContain('sword');
            expect(texts).toContain('key');
            expect(texts).toContain('lantern');

            document.body.removeChild(container);
        });

        test('should call onCommandSubmit when item is clicked', () => {
            const { ui, onCommandSubmit } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderList(container, ['north'], 'exit');
            container.querySelector('.palette-item').click();

            expect(onCommandSubmit).toHaveBeenCalledWith('north', 'exit');

            document.body.removeChild(container);
        });

        test('should show empty state for empty list', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderList(container, [], 'verb');

            const emptyState = container.querySelector('.empty-state');
            expect(emptyState).not.toBeNull();
            expect(emptyState.textContent).toContain('No suggested verbs yet');

            document.body.removeChild(container);
        });

        test('should deduplicate items', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderList(container, ['look', 'look', 'take'], 'verb');

            const items = container.querySelectorAll('.palette-item');
            expect(items.length).toBe(2);

            document.body.removeChild(container);
        });

        test('should handle null container gracefully', () => {
            const { ui } = createUIManager();
            expect(() => ui.renderList(null, ['item'], 'test')).not.toThrow();
        });

        test('should render exit objects with direction label', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderList(container, [{ direction: 'north', room: 'Hall' }], 'exit');

            const item = container.querySelector('.palette-item');
            expect(item.textContent).toContain('north');
            expect(item.textContent).toContain('Hall');

            document.body.removeChild(container);
        });
    });

    describe('renderChoices', () => {
        test('should render choices as choice-button elements', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderChoices(container, ['Go north', 'Take key']);

            const buttons = container.querySelectorAll('.choice-button');
            expect(buttons.length).toBe(2);
            const texts = Array.from(buttons).map((b) => b.textContent);
            expect(texts).toContain('Go north');
            expect(texts).toContain('Take key');

            document.body.removeChild(container);
        });

        test('should call onChoiceSubmit when choice is clicked', () => {
            const { ui, onChoiceSubmit } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderChoices(container, ['Take the sword']);
            container.querySelector('.choice-button').click();

            expect(onChoiceSubmit).toHaveBeenCalledWith('Take the sword');

            document.body.removeChild(container);
        });

        test('should show empty state for empty choices', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderChoices(container, []);

            const emptyState = container.querySelector('.empty-state');
            expect(emptyState).not.toBeNull();

            document.body.removeChild(container);
        });
    });

    describe('renderJournal', () => {
        test('should render quest entries', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderJournal(container, [
                { description: 'Find the key', status: 'active' },
                { description: 'Escape the dungeon', status: 'completed' },
            ]);

            const entries = container.querySelectorAll('.journal-entry');
            expect(entries.length).toBe(2);
            expect(entries[1].classList.contains('completed')).toBe(true);

            document.body.removeChild(container);
        });

        test('should show empty state for no quests', () => {
            const { ui } = createUIManager();
            const container = document.createElement('div');
            document.body.appendChild(container);

            ui.renderJournal(container, []);

            const emptyState = container.querySelector('.empty-state');
            expect(emptyState).not.toBeNull();
            expect(emptyState.textContent).toBe('No quests or objectives yet');

            document.body.removeChild(container);
        });
    });

    describe('showError / showStatus', () => {
        test('showError creates an error toast', () => {
            const { ui } = createUIManager();
            ui.showError('Something went wrong');

            const toast = document.querySelector('.parchment-assist-toast-error');
            expect(toast).not.toBeNull();
            expect(toast.querySelector('.toast-message').textContent).toBe('Something went wrong');
        });

        test('showStatus creates a success toast by default', () => {
            const { ui } = createUIManager();
            ui.showStatus('Done!');

            const toast = document.querySelector('.parchment-assist-toast-success');
            expect(toast).not.toBeNull();
            expect(toast.querySelector('.toast-message').textContent).toBe('Done!');
        });

        test('showStatus creates an info toast for type=info', () => {
            const { ui } = createUIManager();
            ui.showStatus('Info message', 'info');

            const toast = document.querySelector('.parchment-assist-toast-info');
            expect(toast).not.toBeNull();
        });

        test('showError renders XSS payload as text', () => {
            const { ui } = createUIManager();
            const payload = '<img src=x onerror="window.__xssTest=true">';
            ui.showError(payload);

            const toast = document.querySelector('.parchment-assist-toast-error');
            expect(toast.querySelector('img')).toBeNull();
            expect(toast.querySelector('.toast-message').textContent).toBe(payload);
        });
    });

    describe('showLoadingState', () => {
        test('should add loading indicator when true', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showLoadingState(true);

            const indicator = document.querySelector('.palette-loading-indicator');
            expect(indicator).not.toBeNull();
        });

        test('should remove loading indicator when false', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showLoadingState(true);
            ui.showLoadingState(false);

            const indicator = document.querySelector('.palette-loading-indicator');
            expect(indicator).toBeNull();
        });

        test('should not throw when commandPalette is null', () => {
            const { ui } = createUIManager();
            ui.commandPalette = null;
            expect(() => ui.showLoadingState(true)).not.toThrow();
        });
    });

    describe('switchTab', () => {
        test('should activate the selected tab button', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.switchTab('map');

            const mapTab = document.querySelector('.tab-button[data-tab="map"]');
            expect(mapTab.classList.contains('active')).toBe(true);
        });

        test('should show map tab content when switching to map', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.switchTab('map');

            const mapContent = document.getElementById('map-tab-content');
            expect(mapContent.style.display).toBe('block');
        });

        test('should hide main content when switching to map', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.switchTab('map');

            const mainContent = document.querySelector('.palette-content');
            expect(mainContent.style.display).toBe('none');
        });
    });

    describe('renderMap', () => {
        test('should show empty state when no rooms', () => {
            document.body.innerHTML += '<div id="room-list"></div>';
            const { ui } = createUIManager();
            ui.mapViewMode = 'list';

            ui.renderMap();

            const emptyState = document.querySelector('#room-list .empty-state');
            expect(emptyState).not.toBeNull();
        });

        test('should render room cards for each room', () => {
            document.body.innerHTML += '<div id="room-list"></div>';
            const { ui, mapManager } = createUIManager();
            ui.mapViewMode = 'list';

            mapManager.addRoom('Dark Cave', { items: ['torch'], exits: [] });
            mapManager.addRoom('Bright Hall', { items: [], exits: [] });

            ui.renderMap();

            const roomCards = document.querySelectorAll('.room-card');
            expect(roomCards.length).toBe(2);
        });

        test('should render room name as text (XSS safe)', () => {
            document.body.innerHTML += '<div id="room-list"></div>';
            const { ui, mapManager } = createUIManager();
            ui.mapViewMode = 'list';

            const xssName = '<script>window.xss=1</script>';
            mapManager.addRoom(xssName, { items: [], exits: [] });

            ui.renderMap();

            const nameEl = document.querySelector('.room-name');
            expect(nameEl.textContent).toBe(xssName);
            expect(document.querySelector('script')).toBeNull();
        });
    });

    describe('renderMap visual mode', () => {
        test('should render SVG map by default (visual mode)', () => {
            document.body.innerHTML +=
                '<div id="map-visual-container"></div><div id="room-list"></div>';
            const { ui, mapManager } = createUIManager();

            mapManager.addRoom('Dark Cave', { items: [], exits: {} });
            ui.renderMap();

            const svg = document.querySelector('#map-visual-container svg');
            expect(svg).not.toBeNull();
            const nodes = document.querySelectorAll('.map-node');
            expect(nodes.length).toBe(1);
        });

        test('should toggle between visual and list views', () => {
            document.body.innerHTML +=
                '<div id="map-visual-container"></div><div id="room-list"></div>';
            const { ui, mapManager } = createUIManager();

            mapManager.addRoom('Room A', { items: [], exits: {} });

            // Default is visual
            ui.renderMap();
            expect(document.querySelector('#map-visual-container svg')).not.toBeNull();

            // Switch to list
            ui.mapViewMode = 'list';
            ui.renderMap();
            expect(document.querySelectorAll('.room-card').length).toBe(1);
        });

        test('setCurrentRoom should update currentRoom property', () => {
            const { ui } = createUIManager();
            ui.setCurrentRoom('Throne Room');
            expect(ui.currentRoom).toBe('Throne Room');
        });

        test('visual map should highlight current room', () => {
            document.body.innerHTML +=
                '<div id="map-visual-container"></div><div id="room-list"></div>';
            const { ui, mapManager } = createUIManager();

            mapManager.addRoom('Room A', { items: [], exits: {} });
            mapManager.addRoom('Room B', { items: [], exits: {} });
            ui.setCurrentRoom('Room A');
            ui.renderMap();

            const current = document.querySelector('.map-node-current');
            expect(current).not.toBeNull();
            expect(current.getAttribute('data-room')).toBe('Room A');
        });
    });

    describe('renderProfiles', () => {
        test('should show empty state when no profiles', () => {
            document.body.innerHTML += '<div id="palette-profiles"></div>';
            const { ui } = createUIManager();

            ui.renderProfiles();

            const emptyState = document.querySelector('#palette-profiles .empty-state');
            expect(emptyState).not.toBeNull();
        });

        test('should render profile cards for each NPC', () => {
            document.body.innerHTML += '<div id="palette-profiles"></div>';
            const { ui, npcProfiler } = createUIManager();

            npcProfiler.updateProfiles({
                Wizard: { location: 'Tower', description: 'Old man', dialogue: ['Hello'] },
            });

            ui.renderProfiles();

            const cards = document.querySelectorAll('.profile-card');
            expect(cards.length).toBe(1);
            expect(document.querySelector('.profile-name').textContent).toContain('Wizard');
        });
    });

    describe('updateCommandPalette', () => {
        test('should render location with emoji', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.updateCommandPalette({ location: 'Forest', inventory: [], suggestedActions: [] }, 5);

            const locationEl = document.getElementById('palette-location');
            expect(locationEl.textContent).toContain('Forest');
            expect(locationEl.textContent).toContain('📍');
        });

        test('should display the provided turnCount', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.updateCommandPalette({ location: 'Room', inventory: [], suggestedActions: [] }, 17);

            const turnEl = document.getElementById('palette-turn-counter');
            expect(turnEl.textContent).toContain('17');
        });

        test('should not throw for null state', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            expect(() => ui.updateCommandPalette(null, 0)).not.toThrow();
        });

        test('should not throw when commandPalette is null', () => {
            const { ui } = createUIManager();
            ui.commandPalette = null;
            expect(() =>
                ui.updateCommandPalette({ location: 'Room', inventory: [] }, 0)
            ).not.toThrow();
        });
    });

    describe('destroy', () => {
        test('should remove palette and bubble from DOM', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            expect(document.getElementById('parchment-assist-bubble')).not.toBeNull();
            ui.destroy();
            expect(document.getElementById('parchment-assist-bubble')).toBeNull();
            expect(document.getElementById('parchment-assist-palette')).toBeNull();
        });
    });

    describe('choiceMode', () => {
        test('should start in parser mode (choiceMode = false)', () => {
            const { ui } = createUIManager();
            expect(ui.choiceMode).toBe(false);
        });

        test('should toggle choiceMode', async () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            await ui.toggleChoiceMode();
            expect(ui.choiceMode).toBe(true);
            await ui.toggleChoiceMode();
            expect(ui.choiceMode).toBe(false);
        });

        test('should show choices section in choice mode', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.choiceMode = true;

            ui.updateCommandPalette(
                {
                    location: 'Room',
                    inventory: [],
                    suggestedActions: ['Go north', 'Take sword'],
                    quests: [],
                },
                0
            );

            const choicesSection = document.getElementById('palette-choices-section');
            expect(choicesSection).not.toBeNull();
            expect(choicesSection.style.display).toBe('block');
        });
    });

    describe('showAILoadingIndicator', () => {
        test('should create .ai-loading-indicator inside #interactables-section when true', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showAILoadingIndicator(true);

            const indicator = document.querySelector(
                '#interactables-section .ai-loading-indicator'
            );
            expect(indicator).not.toBeNull();
        });

        test('should remove .ai-loading-indicator when false', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showAILoadingIndicator(true);
            ui.showAILoadingIndicator(false);

            const indicator = document.querySelector('.ai-loading-indicator');
            expect(indicator).toBeNull();
        });

        test('should not throw when commandPalette is null', () => {
            const { ui } = createUIManager();
            ui.commandPalette = null;
            expect(() => ui.showAILoadingIndicator(true)).not.toThrow();
        });
    });

    describe('showUndoAIButton / hideUndoAIButton', () => {
        test('should create .undo-ai-btn inside #interactables-section', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showUndoAIButton();

            const btn = document.querySelector('#interactables-section .undo-ai-btn');
            expect(btn).not.toBeNull();
        });

        test('calling showUndoAIButton twice should not duplicate the button', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showUndoAIButton();
            ui.showUndoAIButton();

            const buttons = document.querySelectorAll('.undo-ai-btn');
            expect(buttons.length).toBe(1);
        });

        test('hideUndoAIButton should remove the .undo-ai-btn element', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();

            ui.showUndoAIButton();
            ui.hideUndoAIButton();

            const btn = document.querySelector('.undo-ai-btn');
            expect(btn).toBeNull();
        });

        test('clicking the undo button should call the onUndoAI callback', () => {
            const { ui, onUndoAI } = createUIManager();
            ui.createCommandPalette();

            ui.showUndoAIButton();
            const btn = document.querySelector('.undo-ai-btn');
            btn.click();

            expect(onUndoAI).toHaveBeenCalledTimes(1);
        });

        test('hideUndoAIButton should not throw when commandPalette is null', () => {
            const { ui } = createUIManager();
            ui.commandPalette = null;
            expect(() => ui.hideUndoAIButton()).not.toThrow();
        });
    });

    describe('Keyboard shortcut targets', () => {
        test('switchTab("map") activates the map tab', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.switchTab('map');
            const mapBtn = document.querySelector('.tab-button[data-tab="map"]');
            expect(mapBtn.classList.contains('active')).toBe(true);
        });

        test('toggleChoiceMode() flips choiceMode flag', async () => {
            const { ui } = createUIManager();
            expect(ui.choiceMode).toBe(false);
            await ui.toggleChoiceMode();
            expect(ui.choiceMode).toBe(true);
            await ui.toggleChoiceMode();
            expect(ui.choiceMode).toBe(false);
        });

        test('switchTab("map") and switchTab("main") navigate correctly', () => {
            const { ui } = createUIManager();
            ui.createCommandPalette();
            ui.switchTab('map');
            const mapBtn = document.querySelector('.tab-button[data-tab="map"]');
            expect(mapBtn.classList.contains('active')).toBe(true);
            ui.switchTab('main');
            const mainBtn = document.querySelector('.tab-button[data-tab="main"]');
            expect(mainBtn.classList.contains('active')).toBe(true);
            expect(mapBtn.classList.contains('active')).toBe(false);
        });
    });
});
