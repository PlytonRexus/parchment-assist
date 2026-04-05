import { AdvancedGameStateExtractor } from '../../src/helpers/textMiner.js';
import { InteractableMerger } from '../../src/helpers/interactableMerger.js';

/**
 * Tests verifying the heuristic-vs-AI override behavior:
 * - Panel: AI replaces heuristics
 * - Inline annotations: union of AI + heuristic
 * - Scoped heuristics don't bleed across rooms
 * - Cached AI results serve revisited rooms instantly
 */

describe('heuristic override behavior', () => {
    const makeItem = (name, type = 'object') => ({
        name,
        type,
        actions: [{ command: `examine ${name}`, label: 'Examine', confidence: 0.9 }],
    });

    describe('AI results replace panel contents completely', () => {
        it('replace() returns only AI items when available', () => {
            const ai = [makeItem('door'), makeItem('key')];
            const heuristic = [makeItem('door'), makeItem('window'), makeItem('brick')];
            const panel = InteractableMerger.replace(ai, heuristic);
            const names = panel.map((i) => i.name);
            expect(names).toContain('door');
            expect(names).toContain('key');
            expect(names).not.toContain('window');
            expect(names).not.toContain('brick');
        });

        it('falls back to heuristic when AI returns empty', () => {
            const heuristic = [makeItem('door'), makeItem('window')];
            const panel = InteractableMerger.replace([], heuristic);
            const names = panel.map((i) => i.name);
            expect(names).toContain('door');
            expect(names).toContain('window');
        });
    });

    describe('inline annotations include both AI and heuristic items', () => {
        it('merge() union includes heuristic extras not in AI', () => {
            const ai = [makeItem('door'), makeItem('key')];
            const heuristic = [makeItem('door'), makeItem('window'), makeItem('painting')];
            const annotations = InteractableMerger.merge(ai, heuristic);
            const names = annotations.map((i) => i.name);
            expect(names).toContain('door');
            expect(names).toContain('key');
            expect(names).toContain('window');
            expect(names).toContain('painting');
        });
    });

    describe('scoped heuristics per room', () => {
        const anchorheadTranscript = [
            'Outside the Real Estate Office',
            "A grim little cul-de-sac, tucked away in a corner of the claustrophobic tangle of narrow, twisting avenues that largely constitute the older portion of Anchorhead. Like most of the streets in this city, it is ancient, shadowy, and leads essentially nowhere. The lane ends here at the real estate agent's office, which lies to the east, and winds its way back toward the center of town to the west. A narrow, garbage-choked alley opens to the southeast.",
            '>go southeast',
            'Alley',
            'This narrow aperture between two buildings is nearly blocked with piles of rotting cardboard boxes and overstuffed garbage cans. Ugly, half-crumbling brick walls to either side totter oppressively over you. The alley ends here at a tall, wooden fence.',
            'High up on the wall of the northern building there is a narrow, transom-style window.',
            '>go northwest',
            'Outside the Real Estate Office',
            "A grim little cul-de-sac, tucked away in a corner of the claustrophobic tangle of narrow, twisting avenues that largely constitute the older portion of Anchorhead. Like most of the streets in this city, it is ancient, shadowy, and leads essentially nowhere. The lane ends here at the real estate agent's office, which lies to the east, and winds its way back toward the center of town to the west. A narrow, garbage-choked alley opens to the southeast.",
        ].join('\n');

        it('scoped parse returns current room items only', () => {
            const parsed = AdvancedGameStateExtractor.parseScoped(anchorheadTranscript);
            expect(parsed.location).toBe('Outside the Real Estate Office');
            // Should NOT include items from Alley
            const allItems = [...parsed.objects, ...parsed.scenery].map((n) => n.toLowerCase());
            expect(allItems).not.toContain('fence');
            expect(allItems).not.toContain('boxes');
        });

        it('full parse includes items from all rooms (for annotations)', () => {
            const parsed = AdvancedGameStateExtractor.parse(anchorheadTranscript);
            const allItems = [...parsed.objects, ...parsed.scenery].map((n) => n.toLowerCase());
            // Full parse should include items from both rooms
            expect(allItems.some((n) => n.includes('fence'))).toBe(true);
            expect(allItems.some((n) => n.includes('lane'))).toBe(true);
        });

        it('panel uses scoped (current room), annotations use full text', () => {
            const scopedParsed = AdvancedGameStateExtractor.parseScoped(anchorheadTranscript);
            const fullParsed = AdvancedGameStateExtractor.parse(anchorheadTranscript);

            // Simulate: AI returns good items for current room
            const aiItems = [makeItem('office door'), makeItem('lane', 'scenery')];

            // Panel = replace(AI, scopedHeuristic)
            const panel = InteractableMerger.replace(aiItems, scopedParsed.interactables);
            const panelNames = panel.map((i) => i.name);
            expect(panelNames).toContain('office door');
            expect(panelNames).toContain('lane');
            expect(panelNames).not.toContain('fence');

            // Annotations = merge(AI, fullHeuristic)
            const annotations = InteractableMerger.merge(aiItems, fullParsed.interactables);
            const annotationNames = annotations.map((i) => i.name);
            expect(annotationNames).toContain('office door');
            // Annotation coverage is broader — includes items from full text
            expect(annotationNames.length).toBeGreaterThanOrEqual(panelNames.length);
        });
    });

    describe('cached AI results on room revisit', () => {
        it('simulates cache hit on revisit', () => {
            const cache = new Map();

            // First visit: AI returns results for Kitchen
            const aiResults = {
                interactables: [makeItem('lamp'), makeItem('stove')],
                structuredState: { location: 'Kitchen' },
                timestamp: Date.now(),
            };
            cache.set('kitchen', aiResults);

            // Player moves to Garden (no cache for garden)
            expect(cache.get('garden')).toBeUndefined();

            // Player returns to Kitchen — cache hit
            const cached = cache.get('kitchen');
            expect(cached).toBeDefined();
            expect(cached.interactables.map((i) => i.name)).toContain('lamp');
            expect(cached.interactables.map((i) => i.name)).toContain('stove');
        });
    });

    describe('text filtering removes non-interactable text', () => {
        it('filters distant sounds from Anchorhead alley', () => {
            const alleyText = [
                'Alley',
                'This narrow aperture between two buildings is nearly blocked with piles of rotting cardboard boxes and overstuffed garbage cans.',
                'In the distance, you can hear the lonesome keening of a train whistle drifting on the wind.',
            ].join('\n');

            const parsed = AdvancedGameStateExtractor.parseScoped(alleyText);
            const allItems = [
                ...parsed.objects,
                ...parsed.scenery,
                ...parsed.interactables.map((i) => i.name),
            ];
            const lowerItems = allItems.map((n) => n.toLowerCase());
            // "whistle" and "train" should be filtered (distant mention)
            expect(lowerItems).not.toContain('whistle');
            expect(lowerItems).not.toContain('train');
        });

        it('filters quoted speech', () => {
            const text = [
                'Tavern',
                'A smoky room with a bar. The bartender polishes a glass.',
                'The old man says "The sword of destiny lies in the dungeon below."',
            ].join('\n');

            const parsed = AdvancedGameStateExtractor.parseScoped(text);
            const allItems = [...parsed.objects, ...parsed.scenery].map((n) => n.toLowerCase());
            expect(allItems).not.toContain('sword');
            expect(allItems).not.toContain('dungeon');
        });
    });
});
