import { AdvancedGameStateExtractor } from '../../src/helpers/textMiner.js';

describe('AdvancedGameStateExtractor', () => {
    describe('ambiguous word rejection', () => {
        it('should NOT extract "can" from "You can\'t see any such thing."', () => {
            const objects = AdvancedGameStateExtractor.extractObjects(
                "You can't see any such thing."
            );
            expect(objects).not.toContain('can');
        });
    });

    describe('apostrophe handling', () => {
        it('should not extract "won" from "The farmer won\'t help"', () => {
            const objects = AdvancedGameStateExtractor.extractObjects("The farmer won't help");
            expect(objects).not.toContain('won');
        });

        it('should not extract false items from "couldn\'t"', () => {
            const objects = AdvancedGameStateExtractor.extractObjects("He couldn't find it");
            expect(objects).not.toContain('could');
            expect(objects).not.toContain("couldn't");
        });
    });

    describe('_baseNoun (deprecated wrapper)', () => {
        it('should return "alley" for "garbage-choked alley"', () => {
            expect(AdvancedGameStateExtractor._baseNoun('garbage-choked alley')).toBe('alley');
        });

        it('should return "key" for "key"', () => {
            expect(AdvancedGameStateExtractor._baseNoun('key')).toBe('key');
        });

        it('should return "key" for "rusty iron key"', () => {
            expect(AdvancedGameStateExtractor._baseNoun('rusty iron key')).toBe('key');
        });
    });

    describe('_analyzePhrase', () => {
        it('should return headNoun "window" for adjective+noun "narrow window"', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('narrow window');
            expect(result.headNoun).toBe('window');
            expect(result.modifier).toBe('narrow');
        });

        it('should return headNoun "garbage cans" for compound noun', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('garbage cans');
            expect(result.headNoun).toBe('garbage cans');
            expect(result.modifier).toBe('');
        });

        it('should return headNoun "key" for multiple adjectives "rusty iron key"', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('rusty iron key');
            expect(result.headNoun).toBe('key');
            expect(result.modifier).toBe('rusty iron');
        });

        it('should return headNoun "front door" for adjective + compound "old front door"', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('old front door');
            expect(result.headNoun).toBe('front door');
            expect(result.modifier).toBe('old');
        });

        it('should return headNoun "key" for single word', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('key');
            expect(result.headNoun).toBe('key');
            expect(result.modifier).toBe('');
        });

        it('should treat unknown preceding word as part of compound', () => {
            // "notice board" is a compound noun in the set
            const result = AdvancedGameStateExtractor._analyzePhrase('notice board');
            expect(result.headNoun).toBe('notice board');
        });

        it('should handle hyphenated adjective + noun', () => {
            const result = AdvancedGameStateExtractor._analyzePhrase('well-worn cloak');
            expect(result.headNoun).toBe('cloak');
            expect(result.modifier).toBe('well-worn');
        });
    });

    describe('disambiguation in generateInteractables', () => {
        it('should use full phrase when headNouns collide', () => {
            const state = {
                objects: ['red key', 'blue key'],
                npcs: [],
                exits: [],
                scenery: [],
            };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const names = interactables.map((i) => i.name);
            expect(names).toContain('red key');
            expect(names).toContain('blue key');
            expect(names).not.toContain('key');
        });

        it('should use headNoun when unique', () => {
            const state = {
                objects: ['golden key', 'brass lamp'],
                npcs: [],
                exits: [],
                scenery: [],
            };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const names = interactables.map((i) => i.name);
            expect(names).toContain('key');
            expect(names).toContain('lamp');
        });

        it('should update commands when disambiguating', () => {
            const state = {
                objects: ['red key', 'blue key'],
                npcs: [],
                exits: [],
                scenery: [],
            };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const redKey = interactables.find((i) => i.name === 'red key');
            expect(redKey.actions[0].command).toBe('examine red key');
        });
    });

    describe('adjective-qualified objects', () => {
        it('should find "rusty iron key" via listing pattern', () => {
            const objects = AdvancedGameStateExtractor.extractObjects(
                'You see the rusty iron key here.'
            );
            const hasRustyKey = objects.some((obj) => obj.includes('rusty') && obj.includes('key'));
            expect(hasRustyKey).toBe(true);
        });

        it('should match known adjective "iron" with keyword via adjective pattern', () => {
            // Without the listing pattern ("here"), the keyword pattern
            // captures one adjective: "iron" is in _COMMON_ADJ, so "iron key" is extracted.
            const objects = AdvancedGameStateExtractor.extractObjects(
                'You see the rusty iron key on the table'
            );
            const hasIronKey = objects.some((obj) => obj === 'iron key');
            expect(hasIronKey).toBe(true);
        });
    });

    describe('commands use base noun', () => {
        it('should use "key" as name and in examine command for "golden key"', () => {
            const state = {
                objects: ['golden key'],
                npcs: [],
                exits: [],
                scenery: [],
            };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const keyEntry = interactables.find((i) => i.name === 'key');
            expect(keyEntry).toBeDefined();
            const examineAction = keyEntry.actions.find((a) => a.label === 'Examine');
            expect(examineAction.command).toBe('examine key');
        });
    });

    describe('NPC action generation', () => {
        it('should produce 6 actions for an NPC with commands using base noun', () => {
            const state = {
                objects: [],
                npcs: ['guard'],
                exits: [],
                scenery: [],
            };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const guardEntry = interactables.find((i) => i.name === 'guard');
            expect(guardEntry).toBeDefined();
            expect(guardEntry.type).toBe('npc');
            expect(guardEntry.actions).toHaveLength(6);

            const commands = guardEntry.actions.map((a) => a.command);
            expect(commands).toContain('examine guard');
            expect(commands).toContain('talk to guard');
            expect(commands).toContain('ask guard about');
            expect(commands).toContain('show guard');
            expect(commands).toContain('give guard');
            expect(commands).toContain('take from guard');
        });
    });

    describe('scenery vs sentence', () => {
        it('should NOT produce "blanket the sky" as scenery', () => {
            const scenery = AdvancedGameStateExtractor.extractScenery(
                'clouds that blanket the sky'
            );
            const hasBlanketTheSky = scenery.some((s) => s.includes('blanket the sky'));
            expect(hasBlanketTheSky).toBe(false);
        });
    });

    describe('whole-word matching', () => {
        it('should NOT produce "elf" from "yourself"', () => {
            const npcs = AdvancedGameStateExtractor.extractNPCs(
                'You look at yourself in the mirror.'
            );
            expect(npcs).not.toContain('elf');
        });

        it('should NOT produce "elf" from "bookshelf"', () => {
            const npcs = AdvancedGameStateExtractor.extractNPCs(
                'There is a bookshelf against the wall.'
            );
            expect(npcs).not.toContain('elf');
        });
    });

    describe('known adjective matching', () => {
        it('should extract "golden key" when "golden" is in _COMMON_ADJ', () => {
            const objects = AdvancedGameStateExtractor.extractObjects(
                'You see the golden key here.'
            );
            const hasGoldenKey = objects.some((obj) => obj === 'golden key');
            expect(hasGoldenKey).toBe(true);
        });

        it('should extract just "key" when adjective is not in _COMMON_ADJ', () => {
            // Use text that does NOT trigger the listing pattern ("You see ... here")
            // so only the keyword adjective pattern is tested.
            const objects = AdvancedGameStateExtractor.extractObjects(
                'The forgotten key lies on the ground.'
            );
            // "forgotten" is not in _COMMON_ADJ, so the keyword pattern matches only "key"
            const hasForgottenKey = objects.some((obj) => obj.includes('forgotten'));
            expect(hasForgottenKey).toBe(false);
            const hasKey = objects.some((obj) => obj === 'key');
            expect(hasKey).toBe(true);
        });
    });

    describe('hyphenated adjective', () => {
        it('should extract "well-worn cloak" since hyphenated compounds match', () => {
            const objects = AdvancedGameStateExtractor.extractObjects(
                'You see a well-worn cloak draped over the chair.'
            );
            const hasWellWornCloak = objects.some((obj) => obj === 'well-worn cloak');
            expect(hasWellWornCloak).toBe(true);
        });
    });

    describe('container pattern', () => {
        it('should extract "wooden door" from "the wooden door"', () => {
            const objects = AdvancedGameStateExtractor.extractObjects(
                'You see the wooden door ahead.'
            );
            const hasWoodenDoor = objects.some((obj) => obj === 'wooden door');
            expect(hasWoodenDoor).toBe(true);
        });

        it('should NOT extract anything from "She would door-to-door"', () => {
            const objects = AdvancedGameStateExtractor.extractObjects('She would door-to-door');
            // "door-to-door" should not match because there is no article preceding
            // and "door-to-door" is not preceded by "a/an/the"
            const hasDoor = objects.some((obj) => obj.includes('door'));
            expect(hasDoor).toBe(false);
        });
    });

    describe('previously removed words not matched', () => {
        it('should extract "sword" but NOT "pick" from "pick up the sword"', () => {
            const objects = AdvancedGameStateExtractor.extractObjects('pick up the sword');
            const hasSword = objects.some((obj) => obj.includes('sword'));
            expect(hasSword).toBe(true);
            expect(objects).not.toContain('pick');
        });
    });

    describe('scopeToCurrentRoom', () => {
        it('should return text from the last room title to end', () => {
            const transcript = [
                'West of House',
                'You are standing in an open field. There is a mailbox here.',
                '>go north',
                'North of House',
                'You are facing the north side of a white house. There is a path here.',
            ].join('\n');
            const scoped = AdvancedGameStateExtractor.scopeToCurrentRoom(transcript);
            expect(scoped).toContain('North of House');
            expect(scoped).toContain('north side of a white house');
            expect(scoped).not.toContain('West of House');
            expect(scoped).not.toContain('mailbox');
        });

        it('should fall back to last 2000 chars when no room boundary found', () => {
            const text = 'a'.repeat(3000);
            const scoped = AdvancedGameStateExtractor.scopeToCurrentRoom(text);
            expect(scoped).toHaveLength(2000);
        });

        it('should handle single-room transcripts', () => {
            const transcript = [
                'Library',
                'A dusty room filled with books. There is a lamp on the desk.',
            ].join('\n');
            const scoped = AdvancedGameStateExtractor.scopeToCurrentRoom(transcript);
            expect(scoped).toContain('Library');
            expect(scoped).toContain('lamp');
        });

        it('should ignore command echoes when finding room boundary', () => {
            const transcript = [
                'Kitchen',
                'A brightly lit room.',
                '>Go North',
                'Living Room',
                'A cozy room with a fireplace.',
            ].join('\n');
            const scoped = AdvancedGameStateExtractor.scopeToCurrentRoom(transcript);
            expect(scoped).toContain('Living Room');
            expect(scoped).not.toContain('Kitchen');
        });

        it('should return empty string for empty input', () => {
            expect(AdvancedGameStateExtractor.scopeToCurrentRoom('')).toBe('');
            expect(AdvancedGameStateExtractor.scopeToCurrentRoom(null)).toBe('');
        });
    });

    describe('parseScoped', () => {
        it('should not extract objects from previous rooms', () => {
            const transcript = [
                'Kitchen',
                'You see a brass lamp here.',
                '>go east',
                'Hallway',
                'A narrow corridor with a painting on the wall.',
            ].join('\n');
            const state = AdvancedGameStateExtractor.parseScoped(transcript);
            const allNames = [...state.objects, ...state.scenery].map((n) => n.toLowerCase());
            expect(allNames).not.toContain('lamp');
            expect(allNames).not.toContain('brass lamp');
        });

        it('should extract objects from current room only', () => {
            const transcript = [
                'Kitchen',
                'You see a brass lamp here.',
                '>go east',
                'Hallway',
                'A narrow corridor with a painting on the wall.',
            ].join('\n');
            const state = AdvancedGameStateExtractor.parseScoped(transcript);
            const allNames = [...state.objects, ...state.scenery].map((n) => n.toLowerCase());
            expect(allNames).toContain('painting');
        });

        it('should use full game text for inventory extraction', () => {
            const transcript = [
                'You are carrying: a golden key',
                '>go east',
                'Hallway',
                'A narrow corridor.',
            ].join('\n');
            const state = AdvancedGameStateExtractor.parseScoped(transcript);
            expect(state.inventory).toContain('golden key');
        });
    });

    describe('text filtering', () => {
        it('should not extract from "there is no key here"', () => {
            const filtered =
                AdvancedGameStateExtractor._filterNonInteractableText('There is no key here.');
            const objects = AdvancedGameStateExtractor.extractObjects(filtered);
            expect(objects).not.toContain('key');
        });

        it('should not extract nouns from quoted NPC speech', () => {
            const filtered = AdvancedGameStateExtractor._filterNonInteractableText(
                'The guard says "The sword is in the tower above."'
            );
            const objects = AdvancedGameStateExtractor.extractObjects(filtered);
            expect(objects).not.toContain('sword');
        });

        it('should not extract from distant mentions', () => {
            const filtered = AdvancedGameStateExtractor._filterNonInteractableText(
                'In the distance you can hear the lonesome keening of a train whistle.'
            );
            // The filter strips everything after the distance phrase up to the sentence end
            const objects = AdvancedGameStateExtractor.extractObjects(filtered);
            expect(objects).not.toContain('whistle');
            expect(objects).not.toContain('train whistle');
        });

        it('should preserve interactables from non-filtered text', () => {
            const filtered = AdvancedGameStateExtractor._filterNonInteractableText(
                'You see a golden key on the table. There is no lamp here.'
            );
            const objects = AdvancedGameStateExtractor.extractObjects(filtered);
            expect(objects.some((o) => o.includes('key'))).toBe(true);
        });

        it('should strip "can\'t see any" patterns', () => {
            const filtered = AdvancedGameStateExtractor._filterNonInteractableText(
                "You can't see any sword here."
            );
            const objects = AdvancedGameStateExtractor.extractObjects(filtered);
            expect(objects).not.toContain('sword');
        });
    });

    describe('realistic game text regression', () => {
        it('should NOT extract "agent" from "real estate agent\'s office"', () => {
            const npcs = AdvancedGameStateExtractor.extractNPCs(
                "The lane ends here at the real estate agent's office, which lies to the east."
            );
            expect(npcs).not.toContain('agent');
        });

        it('generateInteractables should use base noun for scenery names', () => {
            const state = { objects: [], npcs: [], exits: [], scenery: ['garbage-choked alley'] };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const entry = interactables.find((i) => i.type === 'scenery');
            expect(entry.name).toBe('alley');
        });

        it('generateInteractables should use base noun for object names', () => {
            const state = { objects: ['rusty iron key'], npcs: [], exits: [], scenery: [] };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const entry = interactables.find((i) => i.type === 'object');
            expect(entry.name).toBe('key');
        });

        it('generateInteractables should use base noun for NPC names', () => {
            const state = { objects: [], npcs: ['old wizard'], exits: [], scenery: [] };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const entry = interactables.find((i) => i.type === 'npc');
            expect(entry.name).toBe('wizard');
        });

        it('generateInteractables should NOT create exit entries for bare cardinal directions', () => {
            const state = { objects: [], npcs: [], exits: ['west', 'southeast'], scenery: [] };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const exitEntries = interactables.filter((i) => i.type === 'exit');
            expect(exitEntries).toHaveLength(0);
        });

        it('generateInteractables should create exit entries for named destinations', () => {
            const state = { objects: [], npcs: [], exits: ['Tower'], scenery: [] };
            const interactables = AdvancedGameStateExtractor.generateInteractables(state);
            const exitEntries = interactables.filter((i) => i.type === 'exit');
            expect(exitEntries).toHaveLength(1);
            expect(exitEntries[0].name).toBe('Tower');
        });

        it('Anchorhead opening should not produce "agent" NPC or bare direction exits', () => {
            const text = `Outside the Real Estate Office
A grim little cul-de-sac, tucked away in a corner of the claustrophobic tangle
of narrow, twisting avenues. The lane ends here at the real estate agent's office,
which lies to the east. A narrow, garbage-choked alley opens to the southeast.`;
            const state = AdvancedGameStateExtractor.parse(text);
            const interactables = state.interactables;
            const names = interactables.map((i) => i.name);
            expect(names).not.toContain('agent');
            expect(names).not.toContain('west');
            expect(names).not.toContain('southeast');
            expect(names).not.toContain('east');
            expect(names).not.toContain('garbage-choked alley');
        });
    });

    describe('extractExits', () => {
        // --- Regression: existing explicit patterns still work ---
        it('should extract from "You can go north"', () => {
            const exits = AdvancedGameStateExtractor.extractExits('You can go north.');
            expect(exits).toContain('north');
        });

        it('should extract from "Obvious exits are north and east"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'Obvious exits are north and east.'
            );
            expect(exits).toContain('north');
            expect(exits).toContain('east');
        });

        it('should extract from "Exits: north, south, west"', () => {
            const exits = AdvancedGameStateExtractor.extractExits('Exits: north, south, west');
            expect(exits).toContain('north');
            expect(exits).toContain('south');
            expect(exits).toContain('west');
        });

        // --- Prose pattern: [structure] leads/opens to the [direction] ---
        it('should extract from "A path leads into the forest to the east"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'A path leads into the forest to the east.'
            );
            expect(exits).toContain('east');
        });

        it('should extract from "A passage leads to the west"', () => {
            const exits = AdvancedGameStateExtractor.extractExits('A passage leads to the west.');
            expect(exits).toContain('west');
        });

        it('should extract from "A narrow alley opens to the southeast"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'A narrow, garbage-choked alley opens to the southeast.'
            );
            expect(exits).toContain('southeast');
        });

        it('should extract from "a twisting lane leads up a hill to the northwest"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'a twisting lane leads up a hill to the northwest.'
            );
            expect(exits).toContain('northwest');
        });

        // --- Prose pattern: [something] lies to the [direction] ---
        it('should extract from "which lies to the east"', () => {
            const exits = AdvancedGameStateExtractor.extractExits('The office lies to the east.');
            expect(exits).toContain('east');
        });

        it('should extract from "Your front garden lies to the south"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'Your front garden lies to the south.'
            );
            expect(exits).toContain('south');
        });

        // --- Prose pattern: "To the [direction], [description]" ---
        it('should extract from "To the north, a gap in the buildings"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'To the north, a gap in the crowded press of buildings opens onto a lane.'
            );
            expect(exits).toContain('north');
        });

        it('should extract from "To the south, a side street leads across"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'To the south, a side street leads across the bridge.'
            );
            expect(exits).toContain('south');
        });

        // --- Prose pattern: "leading [direction]" ---
        it('should extract from "passages leading northwest and east"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'There are passages leading northwest and east.'
            );
            expect(exits).toContain('northwest');
            expect(exits).toContain('east');
        });

        it('should extract from "a narrow passageway leading north"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'A narrow passageway leading north.'
            );
            expect(exits).toContain('north');
        });

        // --- Prose pattern: "go/goes/going [direction]" ---
        it('should extract from "Tunnel keep going out to east and west"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'Tunnel keep going out to east and west, but normal doorway go north.'
            );
            expect(exits).toContain('east');
            expect(exits).toContain('west');
            expect(exits).toContain('north');
        });

        // --- Prose pattern: door/structure at [direction] ---
        it('should extract from "At the south end of the room is an open door"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'At the south end of the room is an open door.'
            );
            expect(exits).toContain('south');
        });

        // --- Multi-direction conjunctions ---
        it('should extract from "paths to the northeast and northwest"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'Narrow paths wind away to the northeast and northwest.'
            );
            expect(exits).toContain('northeast');
            expect(exits).toContain('northwest');
        });

        // --- Upward/downward mapping ---
        it('should map "upward" to "up"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'A dark staircase can be seen leading upward.'
            );
            expect(exits).toContain('up');
        });

        it('should map "downward" to "down"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'A stairway descends downward into darkness.'
            );
            expect(exits).toContain('down');
        });

        // --- False positive suppression ---
        it('should NOT extract from "The north wind howls through the chamber"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'The north wind howls through the chamber.'
            );
            expect(exits).not.toContain('north');
        });

        it('should NOT extract from "On the east wall is an ancient inscription"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'On the east wall is an ancient inscription.'
            );
            expect(exits).not.toContain('east');
        });

        it('should NOT extract "in" from prose like "In the corner of the room"', () => {
            const exits = AdvancedGameStateExtractor.extractExits(
                'In the corner of the room, you see a table.'
            );
            expect(exits).not.toContain('in');
        });

        it('should NOT extract "out" from "You step out of the shadows"', () => {
            const exits = AdvancedGameStateExtractor.extractExits('You step out of the shadows.');
            expect(exits).not.toContain('out');
        });

        // --- Integration: real game text ---
        it('should extract east, west, southeast from Anchorhead opening', () => {
            const text = `Outside the Real Estate Office
A grim little cul-de-sac, tucked away in a corner of the claustrophobic tangle
of narrow, twisting avenues that largely constitute the older portion of
Anchorhead. Like most of the streets in this city, it is ancient, shadowy, and
leads essentially nowhere. The lane ends here at the real estate agent's office,
which lies to the east, and winds its way back toward the center of town to the
west. A narrow, garbage-choked alley opens to the southeast.`;
            const exits = AdvancedGameStateExtractor.extractExits(text);
            expect(exits).toContain('east');
            expect(exits).toContain('west');
            expect(exits).toContain('southeast');
        });

        it('should extract west, up, down, east from Zork Kitchen', () => {
            const text =
                'You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. A dark chimney leads down and to the east is a small window which is open.';
            const exits = AdvancedGameStateExtractor.extractExits(text);
            expect(exits).toContain('west');
            expect(exits).toContain('up');
            expect(exits).toContain('down');
            expect(exits).toContain('east');
        });

        it('should extract from Anchorhead Narrow Street', () => {
            const text = `Narrow Street
As the lane winds along from east to west, it narrows until the steep, jagged
rooftops on either side of the street practically touch each other. To the
south, a side street leads across Whateley Bridge toward the center of town, and
a twisting lane leads up a hill to the northwest. A short flight of steps to the
north leads down to the local watering hole.`;
            const exits = AdvancedGameStateExtractor.extractExits(text);
            expect(exits).toContain('east');
            expect(exits).toContain('west');
            expect(exits).toContain('south');
            expect(exits).toContain('northwest');
            expect(exits).toContain('north');
        });
    });
});
