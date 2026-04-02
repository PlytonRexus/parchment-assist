import { NpcProfiler } from '../../src/lib/npc.js';
import { ParchmentAssist } from '../../src/content/content.js';

describe('NpcProfiler', () => {
    let npcProfiler;

    beforeEach(() => {
        npcProfiler = new NpcProfiler();
    });

    it('should be instantiated correctly', () => {
        expect(npcProfiler).toBeInstanceOf(NpcProfiler);
        expect(npcProfiler.getAllProfiles()).toEqual({});
    });

    it('should add and update NPC profiles', () => {
        const newNpcs = {
            Gandalf: { description: 'A wise wizard' },
            Frodo: { description: 'A hobbit' },
        };
        npcProfiler.updateProfiles(newNpcs);
        expect(npcProfiler.getProfile('Gandalf')).toEqual({ description: 'A wise wizard' });
        expect(npcProfiler.getProfile('Frodo')).toEqual({ description: 'A hobbit' });

        const updatedNpcs = {
            Gandalf: { location: 'Moria' },
            Frodo: { location: 'The Shire' },
        };
        npcProfiler.updateProfiles(updatedNpcs);
        expect(npcProfiler.getProfile('Gandalf')).toEqual({
            description: 'A wise wizard',
            location: 'Moria',
        });
        expect(npcProfiler.getProfile('Frodo')).toEqual({
            description: 'A hobbit',
            location: 'The Shire',
        });
    });
});

describe('showNpcProfile', () => {
    let assist;

    beforeEach(() => {
        // Setup complete DOM to prevent ParchmentAssist initialization errors
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;
        assist = new ParchmentAssist();

        // Create the command palette (which creates npcModal)
        assist.createCommandPalette();

        assist.npcProfiler.updateProfiles({
            Gandalf: {
                description: 'A wise wizard',
                location: 'Moria',
                dialogue: ['You shall not pass!'],
            },
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should display the NPC profile information', () => {
        assist.showNpcProfile('Gandalf');
        expect(document.getElementById('npc-modal-name').textContent).toBe('Gandalf');
        expect(document.getElementById('npc-modal-location').textContent).toBe('Moria');
        expect(document.getElementById('npc-modal-description').textContent).toBe('A wise wizard');
        const dialogueItems = document.querySelectorAll('#npc-modal-dialogue li');
        expect(dialogueItems.length).toBe(1);
        expect(dialogueItems[0].textContent).toBe('You shall not pass!');
    });
});
