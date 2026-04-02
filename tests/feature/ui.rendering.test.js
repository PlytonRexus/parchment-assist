/**
 * UI Rendering Tests
 * Tests DOM manipulation and UI rendering functionality
 */

import { ParchmentAssist } from '../../src/content/content.js';

describe('UI Rendering', () => {
    let assist;

    beforeEach(() => {
        // Setup minimal DOM
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        assist = new ParchmentAssist();
        assist.createCommandPalette();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Command Palette Rendering', () => {
        test('should render location with emoji', () => {
            const state = {
                location: 'Dark Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const locationEl = document.querySelector('#palette-location');
            expect(locationEl.textContent).toContain('📍');
            expect(locationEl.textContent).toContain('Dark Room');
        });

        test('should render empty inventory with emoji', () => {
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

            assist.updateCommandPalette(state);

            const inventoryEl = document.querySelector('#palette-inventory');
            expect(inventoryEl.textContent).toContain('🎒');
            expect(inventoryEl.textContent).toContain('Empty');
        });

        test('should render inventory with items', () => {
            const state = {
                location: 'Room',
                inventory: ['sword', 'key', 'lantern'],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const inventoryEl = document.querySelector('#palette-inventory');
            expect(inventoryEl.textContent).toContain('sword');
            expect(inventoryEl.textContent).toContain('key');
            expect(inventoryEl.textContent).toContain('lantern');
        });

        test('should render turn counter', () => {
            assist.turnCount = 42;

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

            assist.updateCommandPalette(state);

            const turnEl = document.querySelector('#palette-turn-counter');
            expect(turnEl.textContent).toContain('42');
        });

        test('should render default verbs when state has no verbs', () => {
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

            assist.updateCommandPalette(state);

            const verbsContainer = document.querySelector('#palette-verbs');
            const verbItems = verbsContainer.querySelectorAll('.palette-item');

            // Should have default verbs
            expect(verbItems.length).toBeGreaterThan(0);

            const verbTexts = Array.from(verbItems).map((item) => item.textContent);
            expect(verbTexts).toContain('LOOK');
            expect(verbTexts).toContain('INVENTORY');
            expect(verbTexts).toContain('EXAMINE');
        });

        test('should render custom verbs from state', () => {
            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: ['ATTACK', 'UNLOCK'],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const verbsContainer = document.querySelector('#palette-verbs');
            const verbItems = verbsContainer.querySelectorAll('.palette-item');
            const verbTexts = Array.from(verbItems).map((item) => item.textContent);

            expect(verbTexts).toContain('ATTACK');
            expect(verbTexts).toContain('UNLOCK');
        });

        test('should render objects list', () => {
            const state = {
                location: 'Room',
                inventory: [],
                objects: ['key', 'sword', 'book'],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const objectsContainer = document.querySelector('#palette-objects');
            const objectItems = objectsContainer.querySelectorAll('.palette-item');

            expect(objectItems.length).toBeGreaterThanOrEqual(3);

            const objectTexts = Array.from(objectItems).map((item) => item.textContent);
            expect(objectTexts).toContain('key');
            expect(objectTexts).toContain('sword');
            expect(objectTexts).toContain('book');
        });

        test('should render NPCs list', () => {
            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: ['Guard', 'Merchant', 'Wizard'],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const npcsContainer = document.querySelector('#palette-npcs');
            const npcItems = npcsContainer.querySelectorAll('.palette-item');

            expect(npcItems.length).toBe(3);

            const npcTexts = Array.from(npcItems).map((item) => item.textContent);
            expect(npcTexts).toContain('Guard');
            expect(npcTexts).toContain('Merchant');
            expect(npcTexts).toContain('Wizard');
        });

        test('should render exits from state', () => {
            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [
                    { direction: 'north', room: 'Hall' },
                    { direction: 'south', room: 'Garden' },
                ],
                verbs: [],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const exitsContainer = document.querySelector('#palette-exits');
            const exitItems = exitsContainer.querySelectorAll('.palette-item');

            // Should have at least the exits from state
            expect(exitItems.length).toBeGreaterThan(0);
        });

        test('should render default exits when no exits in state', () => {
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

            assist.updateCommandPalette(state);

            const exitsContainer = document.querySelector('#palette-exits');
            const exitItems = exitsContainer.querySelectorAll('.palette-item');

            // Should have default cardinal directions
            expect(exitItems.length).toBeGreaterThan(0);

            const exitTexts = Array.from(exitItems).map((item) => item.textContent);
            expect(exitTexts).toContain('NORTH');
            expect(exitTexts).toContain('SOUTH');
            expect(exitTexts).toContain('EAST');
            expect(exitTexts).toContain('WEST');
        });

        test('should render NPC profiles in Profiles tab', () => {
            assist.npcProfiler.updateProfiles({
                Gandalf: {
                    description: 'A wizard',
                    location: 'Rivendell',
                    dialogue: ['You shall not pass!'],
                },
                Frodo: {
                    description: 'A hobbit',
                    location: 'Shire',
                    dialogue: ['I will take the ring'],
                },
            });

            // Switch to Profiles tab to render profiles
            assist.switchTab('profiles');

            const profilesContainer = document.querySelector('#palette-profiles');
            const profileCards = profilesContainer.querySelectorAll('.profile-card');

            expect(profileCards.length).toBe(2);

            // Check that profile cards contain the NPC names
            const profileHTML = profilesContainer.innerHTML;
            expect(profileHTML).toContain('Gandalf');
            expect(profileHTML).toContain('Frodo');
            expect(profileHTML).toContain('A wizard');
            expect(profileHTML).toContain('A hobbit');
        });

        test('should render suggested actions', () => {
            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                quests: [],
                suggestedActions: ['examine key', 'talk to guard', 'open door'],
                npcProfiles: {},
            };

            assist.updateCommandPalette(state);

            const actionsContainer = document.querySelector('#palette-actions');
            const actionItems = actionsContainer.querySelectorAll('.palette-item');

            expect(actionItems.length).toBe(3);

            const actionTexts = Array.from(actionItems).map((item) => item.textContent);
            expect(actionTexts).toContain('examine key');
            expect(actionTexts).toContain('talk to guard');
            expect(actionTexts).toContain('open door');
        });
    });

    describe('List Rendering', () => {
        test('should render list items with correct class', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const items = ['item1', 'item2', 'item3'];
            assist.renderList(container, items, 'test-type');

            const listItems = container.querySelectorAll('.palette-item');
            expect(listItems.length).toBe(3);

            listItems.forEach((item) => {
                expect(item.className).toBe('palette-item');
            });

            document.body.removeChild(container);
        });

        test('should deduplicate items in list', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const items = ['item1', 'item2', 'item1', 'item3', 'item2'];
            assist.renderList(container, items, 'test-type');

            const listItems = container.querySelectorAll('.palette-item');
            // Should only have 3 unique items
            expect(listItems.length).toBe(3);

            const texts = Array.from(listItems).map((item) => item.textContent);
            expect(texts).toContain('item1');
            expect(texts).toContain('item2');
            expect(texts).toContain('item3');

            document.body.removeChild(container);
        });

        test('should clear container before rendering', () => {
            const container = document.createElement('div');
            container.innerHTML = '<div>old content</div>';
            document.body.appendChild(container);

            const items = ['new1', 'new2'];
            assist.renderList(container, items, 'test-type');

            expect(container.textContent).not.toContain('old content');
            expect(container.textContent).toContain('new1');
            expect(container.textContent).toContain('new2');

            document.body.removeChild(container);
        });

        test('should handle empty items array', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            assist.renderList(container, [], 'test-type');

            const listItems = container.querySelectorAll('.palette-item');
            expect(listItems.length).toBe(0);

            document.body.removeChild(container);
        });

        test('should handle null container gracefully', () => {
            // Should not throw error
            expect(() => {
                assist.renderList(null, ['item1'], 'test-type');
            }).not.toThrow();
        });
    });

    describe('Quest Journal Rendering', () => {
        test('should render active quests', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const quests = [
                { description: 'Find the key', status: 'active' },
                { description: 'Defeat the dragon', status: 'active' },
            ];

            assist.renderJournal(container, quests);

            expect(container.textContent).toContain('Find the key');
            expect(container.textContent).toContain('Defeat the dragon');

            document.body.removeChild(container);
        });

        test('should render completed quests differently', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const quests = [
                { description: 'Find the key', status: 'completed' },
                { description: 'Defeat the dragon', status: 'active' },
            ];

            assist.renderJournal(container, quests);

            const questElements = container.querySelectorAll('.journal-entry');
            expect(questElements.length).toBe(2);

            // Find completed quest element
            const completedQuest = Array.from(questElements).find((el) =>
                el.textContent.includes('Find the key')
            );
            expect(completedQuest).toBeTruthy();
            expect(completedQuest.classList.contains('completed')).toBe(true);

            document.body.removeChild(container);
        });

        test('should handle empty quest list', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            assist.renderJournal(container, []);

            // Empty quest list shows empty state message
            const emptyState = container.querySelector('.empty-state');
            expect(emptyState).not.toBeNull();
            expect(emptyState.textContent).toBe('No quests or objectives yet');
            expect(emptyState.getAttribute('role')).toBe('status');
            expect(emptyState.getAttribute('aria-live')).toBe('polite');
            expect(container.querySelectorAll('.journal-entry').length).toBe(0);

            document.body.removeChild(container);
        });

        test('should handle null container gracefully', () => {
            expect(() => {
                assist.renderJournal(null, [{ description: 'Quest', status: 'active' }]);
            }).not.toThrow();
        });
    });

    describe('NPC Modal', () => {
        test('should display NPC modal with profile data', () => {
            assist.npcProfiler.updateProfiles({
                Gandalf: {
                    description: 'A wise wizard',
                    location: 'Rivendell',
                    dialogue: ['You shall not pass!', 'A wizard is never late.'],
                },
            });

            assist.showNpcProfile('Gandalf');

            const modal = document.querySelector('#parchment-assist-npc-modal');
            expect(modal.style.display).toBe('block');

            expect(document.querySelector('#npc-modal-name').textContent).toBe('Gandalf');
            expect(document.querySelector('#npc-modal-location').textContent).toBe('Rivendell');
            expect(document.querySelector('#npc-modal-description').textContent).toBe(
                'A wise wizard'
            );

            const dialogueItems = document.querySelectorAll('#npc-modal-dialogue li');
            expect(dialogueItems.length).toBe(2);
            expect(dialogueItems[0].textContent).toBe('You shall not pass!');
            expect(dialogueItems[1].textContent).toBe('A wizard is never late.');
        });

        test('should handle NPC with minimal profile data', () => {
            assist.npcProfiler.updateProfiles({
                Guard: {},
            });

            assist.showNpcProfile('Guard');

            const modal = document.querySelector('#parchment-assist-npc-modal');
            expect(modal.style.display).toBe('block');

            expect(document.querySelector('#npc-modal-name').textContent).toBe('Guard');
        });

        test('should handle non-existent NPC gracefully', () => {
            expect(() => {
                assist.showNpcProfile('NonExistent');
            }).not.toThrow();
        });
    });

    describe('Null/Empty State Handling', () => {
        test('should handle null state in updateCommandPalette', () => {
            expect(() => {
                assist.updateCommandPalette(null);
            }).not.toThrow();
        });

        test('should handle undefined state in updateCommandPalette', () => {
            expect(() => {
                assist.updateCommandPalette(undefined);
            }).not.toThrow();
        });

        test('should handle missing palette sections gracefully', () => {
            // Remove a palette section
            const verbsSection = document.querySelector('#palette-verbs');
            if (verbsSection && verbsSection.parentNode) {
                verbsSection.parentNode.removeChild(verbsSection);
            }

            const state = {
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: ['LOOK'],
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
            };

            // Should not throw even with missing section
            expect(() => {
                assist.updateCommandPalette(state);
            }).not.toThrow();
        });
    });
});
