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

    it('should deep merge dialogue arrays (append, not replace)', () => {
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hello'] } });
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Stop!'] } });
        const profile = npcProfiler.getProfile('Guard');
        expect(profile.dialogue).toEqual(['Hello', 'Stop!']);
    });

    it('should deduplicate dialogue entries', () => {
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hello'] } });
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hello', 'Stop!'] } });
        const profile = npcProfiler.getProfile('Guard');
        expect(profile.dialogue).toEqual(['Hello', 'Stop!']);
    });

    it('should accumulate dialogue across multiple updates', () => {
        npcProfiler.updateProfiles({ Merchant: { dialogue: ['Welcome!'] } });
        npcProfiler.updateProfiles({ Merchant: { dialogue: ['Buy something?'] } });
        npcProfiler.updateProfiles({ Merchant: { dialogue: ['Good day!'] } });
        const profile = npcProfiler.getProfile('Merchant');
        expect(profile.dialogue).toEqual(['Welcome!', 'Buy something?', 'Good day!']);
    });

    it('getProfile should return an immutable copy, not the internal reference', () => {
        npcProfiler.updateProfiles({ Wizard: { description: 'Mysterious', dialogue: ['Boo!'] } });
        const profile = npcProfiler.getProfile('Wizard');
        // Mutate the returned copy
        profile.description = 'Changed';
        profile.dialogue.push('Extra');
        // Internal state must be unchanged
        const profile2 = npcProfiler.getProfile('Wizard');
        expect(profile2.description).toBe('Mysterious');
        expect(profile2.dialogue).toEqual(['Boo!']);
    });

    it('should return undefined for unknown NPC', () => {
        expect(npcProfiler.getProfile('Nobody')).toBeUndefined();
    });

    it('_deepMerge deduplicates case variants (first form kept)', () => {
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hello'] } });
        npcProfiler.updateProfiles({ Guard: { dialogue: ['hello'] } });
        expect(npcProfiler.getProfile('Guard').dialogue).toEqual(['Hello']);
    });

    it('_deepMerge deduplicates whitespace variants', () => {
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hi!'] } });
        npcProfiler.updateProfiles({ Guard: { dialogue: [' Hi! '] } });
        expect(npcProfiler.getProfile('Guard').dialogue).toEqual(['Hi!']);
    });

    it('_deepMerge keeps genuinely different strings', () => {
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Hello'] } });
        npcProfiler.updateProfiles({ Guard: { dialogue: ['Goodbye'] } });
        expect(npcProfiler.getProfile('Guard').dialogue).toEqual(['Hello', 'Goodbye']);
    });
});

describe('NpcProfiler.dedupStrings', () => {
    it('returns empty array for empty input', () => {
        expect(NpcProfiler.dedupStrings([])).toEqual([]);
    });

    it('deduplicates case variants keeping first occurrence', () => {
        expect(NpcProfiler.dedupStrings(['A', 'a', 'B'])).toEqual(['A', 'B']);
    });

    it('keeps non-string items using JSON comparison', () => {
        const obj = { x: 1 };
        expect(NpcProfiler.dedupStrings([obj, { x: 1 }, 'hello', 'Hello'])).toEqual([obj, 'hello']);
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

        // Create the command palette (which creates npcModal) via UIManager
        assist.uiManager.createCommandPalette();

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
        assist.uiManager.showNpcProfile('Gandalf');
        expect(document.getElementById('npc-modal-name').textContent).toBe('Gandalf');
        expect(document.getElementById('npc-modal-location').textContent).toBe('Moria');
        expect(document.getElementById('npc-modal-description').textContent).toBe('A wise wizard');
        const dialogueItems = document.querySelectorAll('#npc-modal-dialogue li');
        expect(dialogueItems.length).toBe(1);
        expect(dialogueItems[0].textContent).toBe('You shall not pass!');
    });
});
