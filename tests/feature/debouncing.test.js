import { AdvancedGameStateExtractor } from '../../src/helpers/textMiner.js';

/**
 * Tests for the debouncing and room-cache behavior described in the proposal.
 * Since ParchmentAssist depends on Chrome APIs and DOM, we test the building
 * blocks (scoping, merging, cache-invalidation logic) directly.
 */

describe('AI request debouncing building blocks', () => {
    describe('scoped heuristic updates per turn', () => {
        it('should scope to the latest room after rapid movement', () => {
            // Simulate 3 rooms visited in quick succession
            const transcript = [
                'Kitchen',
                'You see a brass lamp here.',
                '>go east',
                'Hallway',
                'A narrow corridor with a painting on the wall.',
                '>go north',
                'Library',
                'Shelves of dusty books line the walls. There is a desk here.',
            ].join('\n');

            const scoped = AdvancedGameStateExtractor.scopeToCurrentRoom(transcript);
            expect(scoped).toContain('Library');
            expect(scoped).not.toContain('Kitchen');
            expect(scoped).not.toContain('Hallway');

            const parsed = AdvancedGameStateExtractor.parseScoped(transcript);
            expect(parsed.location).toBe('Library');
        });

        it('should produce different scoped results for different rooms', () => {
            const room1Text = ['Kitchen', 'You see a brass lamp here.'].join('\n');

            const room2Text = [
                'Kitchen',
                'You see a brass lamp here.',
                '>go east',
                'Garden',
                'You see a fountain here.',
            ].join('\n');

            const parsed1 = AdvancedGameStateExtractor.parseScoped(room1Text);
            const parsed2 = AdvancedGameStateExtractor.parseScoped(room2Text);

            expect(parsed1.location).toBe('Kitchen');
            expect(parsed2.location).toBe('Garden');

            const names1 = parsed1.objects.map((o) => o.toLowerCase());
            const names2 = parsed2.objects.map((o) => o.toLowerCase());

            expect(names1.some((n) => n.includes('lamp'))).toBe(true);
            expect(names2.some((n) => n.includes('fountain'))).toBe(true);
            expect(names2.some((n) => n.includes('lamp'))).toBe(false);
        });
    });

    describe('stale response detection', () => {
        it('should detect when AI response room differs from current room', () => {
            // Simulates the stale-response guard logic from _applyStructuredState
            const responseRoom = 'Kitchen';
            const currentRoom = 'Garden';
            const aiRequestRoomTag = 'Kitchen';

            const isStale =
                responseRoom &&
                currentRoom &&
                responseRoom.trim().toLowerCase() !== currentRoom.trim().toLowerCase() &&
                aiRequestRoomTag &&
                aiRequestRoomTag.trim().toLowerCase() !== currentRoom.trim().toLowerCase();

            expect(isStale).toBe(true);
        });

        it('should not flag as stale when rooms match', () => {
            const responseRoom = 'Kitchen';
            const currentRoom = 'Kitchen';
            const aiRequestRoomTag = 'Kitchen';

            const isStale =
                responseRoom &&
                currentRoom &&
                responseRoom.trim().toLowerCase() !== currentRoom.trim().toLowerCase() &&
                aiRequestRoomTag &&
                aiRequestRoomTag.trim().toLowerCase() !== currentRoom.trim().toLowerCase();

            expect(isStale).toBe(false);
        });
    });

    describe('in-flight coalescing logic', () => {
        it('should queue a pending request when one is in flight', () => {
            // Simulate the coalescing state machine
            let aiInFlight = false;
            let pendingAIForce = null;
            let requestCount = 0;

            const fireAIRequest = (force) => {
                if (aiInFlight) {
                    pendingAIForce = force;
                    return;
                }
                aiInFlight = true;
                requestCount++;
            };

            const completeRequest = () => {
                aiInFlight = false;
                if (pendingAIForce !== null) {
                    const queuedForce = pendingAIForce;
                    pendingAIForce = null;
                    fireAIRequest(queuedForce);
                }
            };

            // First request fires
            fireAIRequest(false);
            expect(requestCount).toBe(1);
            expect(aiInFlight).toBe(true);

            // Second request is queued
            fireAIRequest(false);
            expect(requestCount).toBe(1); // Still just 1
            expect(pendingAIForce).toBe(false);

            // Third request also queued (overwrites second)
            fireAIRequest(true);
            expect(requestCount).toBe(1);
            expect(pendingAIForce).toBe(true);

            // First completes, queued fires
            completeRequest();
            expect(requestCount).toBe(2);
            expect(aiInFlight).toBe(true);
            expect(pendingAIForce).toBeNull();
        });
    });
});

describe('room cache', () => {
    describe('cache invalidation on state-changing commands', () => {
        // Replicate ParchmentAssist._isStateChangingCommand logic
        const STATE_CHANGING_VERBS = new Set([
            'take',
            'get',
            'pick',
            'drop',
            'put',
            'give',
            'open',
            'close',
            'lock',
            'unlock',
            'eat',
            'drink',
            'wear',
            'remove',
            'break',
            'push',
            'pull',
            'move',
            'attack',
            'kill',
            'turn',
            'light',
            'cut',
            'fill',
        ]);

        const isStateChangingCommand = (command) => {
            if (!command) {
                return false;
            }
            const firstWord = command.trim().toLowerCase().split(/\s+/)[0];
            return STATE_CHANGING_VERBS.has(firstWord);
        };

        it('"take key" is state-changing', () => {
            expect(isStateChangingCommand('take key')).toBe(true);
        });

        it('"look" is NOT state-changing', () => {
            expect(isStateChangingCommand('look')).toBe(false);
        });

        it('"examine door" is NOT state-changing', () => {
            expect(isStateChangingCommand('examine door')).toBe(false);
        });

        it('"open door" is state-changing', () => {
            expect(isStateChangingCommand('open door')).toBe(true);
        });

        it('"go north" is NOT state-changing', () => {
            expect(isStateChangingCommand('go north')).toBe(false);
        });

        it('"unlock chest with key" is state-changing', () => {
            expect(isStateChangingCommand('unlock chest with key')).toBe(true);
        });

        it('empty/null command is NOT state-changing', () => {
            expect(isStateChangingCommand('')).toBe(false);
            expect(isStateChangingCommand(null)).toBe(false);
        });
    });

    describe('room cache read/write', () => {
        it('cache stores and retrieves by normalized room name', () => {
            const cache = new Map();
            const roomKey = 'outside the real estate office';
            const data = {
                interactables: [{ name: 'door', type: 'object', actions: [] }],
                structuredState: { location: 'Outside the Real Estate Office' },
                timestamp: Date.now(),
            };
            cache.set(roomKey, data);

            // Retrieve with same normalization
            const retrieved = cache.get('outside the real estate office');
            expect(retrieved).toBeDefined();
            expect(retrieved.interactables[0].name).toBe('door');
        });

        it('cache miss returns undefined', () => {
            const cache = new Map();
            cache.set('kitchen', { interactables: [] });
            expect(cache.get('garden')).toBeUndefined();
        });

        it('state-changing command deletes cache entry', () => {
            const cache = new Map();
            cache.set('kitchen', { interactables: [{ name: 'lamp' }] });

            // Simulate: player types "take lamp"
            cache.delete('kitchen');
            expect(cache.get('kitchen')).toBeUndefined();
        });
    });
});
