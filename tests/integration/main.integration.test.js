import { ParchmentAssist } from '../../src/content/content.js';

describe('Main Integration Tests', () => {
    let assist;

    beforeEach(() => {
        // Setup minimal DOM for ParchmentAssist initialization
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;
        assist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should update the turn counter in the UI', () => {
        // Create the command palette first (which creates all the UI elements)
        assist.createCommandPalette();

        assist.turnCount = 5;

        // Update the palette with minimal data
        assist.updateCommandPalette({
            location: 'Test Room',
            inventory: [],
            objects: [],
            npcs: [],
            exits: [],
            verbs: [],
            quests: [],
            npcProfiles: {},
            suggestedActions: [],
        });

        const turnCounterUI = document.querySelector('#palette-turn-counter');
        expect(turnCounterUI.textContent).toContain('5');
    });

    it('should display NPC profiles in the UI when updated', () => {
        // Create the command palette first
        assist.createCommandPalette();

        assist.npcProfiler.updateProfiles({ Gandalf: { description: 'A wizard' } });

        // Update the palette
        assist.updateCommandPalette({
            location: 'Test Room',
            inventory: [],
            objects: [],
            npcs: [],
            exits: [],
            verbs: [],
            quests: [],
            npcProfiles: { Gandalf: { description: 'A wizard' } },
            suggestedActions: [],
        });

        // Switch to Profiles tab to see the profiles
        assist.switchTab('profiles');

        const profileCard = document.querySelector('#palette-profiles .profile-card');
        expect(profileCard).toBeTruthy();
        expect(profileCard.innerHTML).toContain('Gandalf');
    });
});
