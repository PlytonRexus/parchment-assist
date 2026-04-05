import { InteractableMerger } from '../../src/helpers/interactableMerger.js';

describe('InteractableMerger', () => {
    const makeItem = (name, type = 'object') => ({
        name,
        type,
        actions: [{ command: `examine ${name}`, label: 'Examine', confidence: 0.9 }],
    });

    describe('replace()', () => {
        it('should return AI list when non-empty', () => {
            const ai = [makeItem('key'), makeItem('lamp')];
            const local = [makeItem('door'), makeItem('window')];
            const result = InteractableMerger.replace(ai, local);
            const names = result.map((i) => i.name);
            expect(names).toContain('key');
            expect(names).toContain('lamp');
            expect(names).not.toContain('door');
            expect(names).not.toContain('window');
        });

        it('should fall back to local when AI is empty', () => {
            const local = [makeItem('door'), makeItem('window')];
            const result = InteractableMerger.replace([], local);
            const names = result.map((i) => i.name);
            expect(names).toContain('door');
            expect(names).toContain('window');
        });

        it('should fall back to local when AI is null', () => {
            const local = [makeItem('door')];
            const result = InteractableMerger.replace(null, local);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('door');
        });

        it('should apply _removeSubsumed to AI list', () => {
            const ai = [makeItem('key'), makeItem('brass key')];
            const result = InteractableMerger.replace(ai, []);
            // "key" is subsumed by "brass key"
            const names = result.map((i) => i.name);
            expect(names).toContain('brass key');
            expect(names).not.toContain('key');
        });

        it('should return empty array when both are empty', () => {
            const result = InteractableMerger.replace([], []);
            expect(result).toHaveLength(0);
        });
    });

    describe('merge() (union)', () => {
        it('should include local extras not in AI', () => {
            const ai = [makeItem('key')];
            const local = [makeItem('door'), makeItem('key')];
            const result = InteractableMerger.merge(ai, local);
            const names = result.map((i) => i.name);
            expect(names).toContain('key');
            expect(names).toContain('door');
        });

        it('should not duplicate names present in both', () => {
            const ai = [makeItem('key')];
            const local = [makeItem('key')];
            const result = InteractableMerger.merge(ai, local);
            const keyItems = result.filter((i) => i.name === 'key');
            expect(keyItems).toHaveLength(1);
        });

        it('should prefer AI entry on name collision', () => {
            const ai = [
                {
                    name: 'key',
                    type: 'object',
                    actions: [{ command: 'take key', label: 'Take', confidence: 0.95 }],
                },
            ];
            const local = [
                {
                    name: 'key',
                    type: 'scenery',
                    actions: [{ command: 'examine key', label: 'Examine', confidence: 0.5 }],
                },
            ];
            const result = InteractableMerger.merge(ai, local);
            const keyItem = result.find((i) => i.name === 'key');
            expect(keyItem.type).toBe('object'); // AI version wins
        });

        it('should remove subsumed entries after merge', () => {
            const ai = [makeItem('brass key')];
            const local = [makeItem('key')];
            const result = InteractableMerger.merge(ai, local);
            const names = result.map((i) => i.name);
            expect(names).toContain('brass key');
            expect(names).not.toContain('key');
        });
    });
});
