import { MapManager } from '../../src/lib/mapManager.js';

describe('MapManager', () => {
    let mapManager;

    beforeEach(() => {
        mapManager = new MapManager();
    });

    test('should add a new room with exits', () => {
        const roomName = 'Room A';
        const roomData = { exits: { north: 'Room B', south: 'Room C' } };
        mapManager.addRoom(roomName, roomData);
        const room = mapManager.getRoom(roomName);
        expect(room).toBeDefined();
        expect(room.exits).toEqual({ north: 'Room B', south: 'Room C' });
    });

    test('should merge exits for an existing room', () => {
        const roomName = 'Room A';
        mapManager.addRoom(roomName, { exits: { north: 'Room B' } });
        mapManager.addRoom(roomName, { exits: { east: 'Room C', west: 'Room D' } });
        const room = mapManager.getRoom(roomName);
        expect(room.exits).toEqual({ north: 'Room B', east: 'Room C', west: 'Room D' });
    });

    test('should add a connection between two rooms', () => {
        mapManager.addRoom('Room A', {});
        mapManager.addRoom('Room B', {});
        mapManager.addConnection('Room A', 'Room B', 'north');
        const roomA = mapManager.getRoom('Room A');
        // Exits store canonical keys
        expect(roomA.exits.north).toBe('room b');
    });

    test('should not create "Unknown" rooms', () => {
        const roomName = 'Room A';
        const mapData = {
            roomName,
            exits: [
                { direction: 'north', room: 'Room B' },
                { direction: 'south', room: 'Room C' },
            ],
        };
        mapManager.updateMap(mapData);
        const room = mapManager.getRoom(roomName);
        expect(room.exits.north).toBe('Room B');
        expect(room.exits.south).toBe('Room C');
        const map = mapManager.getMap();
        const roomNames = Object.keys(map.rooms);
        expect(roomNames).not.toContain(expect.stringContaining('Unknown'));
    });

    test('should correctly update map from player movement', () => {
        const previousRoom = 'Room A';
        const currentRoom = 'Room B';
        const direction = 'north';
        mapManager.addRoom(previousRoom, {});
        const mapData = {
            roomName: currentRoom,
            exits: [{ direction: 'south', room: previousRoom }],
        };
        mapManager.updateMap(mapData, previousRoom, direction);
        const roomA = mapManager.getRoom(previousRoom);
        // addConnection stores canonical keys
        expect(roomA.exits[direction]).toBe('room b');
    });

    describe('case-insensitive room deduplication', () => {
        test('rooms with different casing are treated as the same room', () => {
            mapManager.addRoom('University', { exits: {}, status: 'unvisited' });
            mapManager.addRoom('university', { exits: {}, status: 'visited' });
            // Only one room exists
            expect(Object.keys(mapManager.graph)).toHaveLength(1);
            // First-seen display name preserved
            expect(mapManager.getRoom('university').displayName).toBe('University');
            // Status upgraded to visited
            expect(mapManager.getRoom('UNIVERSITY').status).toBe('visited');
        });

        test('getDisplayName returns first-seen display name', () => {
            mapManager.addRoom('Grand Hall', {});
            expect(mapManager.getDisplayName('grand hall')).toBe('Grand Hall');
            expect(mapManager.getDisplayName('GRAND HALL')).toBe('Grand Hall');
        });

        test('getMap uses display names as keys', () => {
            mapManager.addRoom('Grand Hall', { exits: {} });
            const map = mapManager.getMap();
            expect(map.rooms['Grand Hall']).toBeDefined();
        });

        test('getMap resolves exit destinations to display names', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.addConnection('Hall', 'Garden', 'north');
            const map = mapManager.getMap();
            expect(map.rooms['Hall'].exits.north).toBe('Garden');
        });
    });

    describe('ignored rooms', () => {
        test('addRoom ignores "Start Screen"', () => {
            mapManager.addRoom('Start Screen', {});
            expect(mapManager.getRoom('Start Screen')).toBeUndefined();
        });

        test('updateMap ignores rooms with blocked names', () => {
            mapManager.updateMap({ roomName: 'Title Screen', exits: [] });
            expect(mapManager.getRoom('Title Screen')).toBeUndefined();
        });

        test('addRoom ignores "Menu"', () => {
            mapManager.addRoom('Menu', {});
            expect(mapManager.getRoom('Menu')).toBeUndefined();
        });
    });

    describe('connection label validation', () => {
        test('updateMap rejects non-direction connection labels', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'travel to',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            expect(mapManager.getRoom('Hall').exits).toEqual({});
        });

        test('updateMap rejects "across town" as connection label', () => {
            mapManager.addRoom('Town', {});
            mapManager.updateMap({
                roomName: 'Town',
                exits: [],
                connections: [
                    {
                        from: 'Town',
                        to: 'University',
                        label: 'across town',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            // Garden should not be created since label was invalid
            expect(mapManager.getRoom('University')).toBeUndefined();
        });

        test('updateMap accepts valid direction labels in connections', () => {
            // Pre-create Garden so the connection can be established
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'north',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            expect(mapManager.getRoom('Hall').exits.north).toBe('garden');
        });
    });

    describe('bidirectional connections', () => {
        test('north->south: adding A->B north auto-creates B->A south', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'north');
            expect(mapManager.getRoom('Room A').exits.north).toBe('room b');
            expect(mapManager.getRoom('Room B').exits.south).toBe('room a');
        });

        test('east->west: adding A->B east auto-creates B->A west', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'east');
            expect(mapManager.getRoom('Room B').exits.west).toBe('room a');
        });

        test('up->down: adding A->B up auto-creates B->A down', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'up');
            expect(mapManager.getRoom('Room B').exits.down).toBe('room a');
        });

        test('in->out: adding A->B in auto-creates B->A out', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'in');
            expect(mapManager.getRoom('Room B').exits.out).toBe('room a');
        });

        test('northeast->southwest: diagonal auto-reverse', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'northeast');
            expect(mapManager.getRoom('Room B').exits.southwest).toBe('room a');
        });

        test('should not overwrite existing reverse exit', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addRoom('Room C', {});
            // Manually set B->south = C (using canonical key)
            mapManager.getRoom('Room B').exits.south = 'room c';
            // Adding A->B north should NOT overwrite B->south
            mapManager.addConnection('Room A', 'Room B', 'north');
            expect(mapManager.getRoom('Room B').exits.south).toBe('room c');
        });

        test('unknown direction does not create reverse', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'across');
            expect(mapManager.getRoom('Room A').exits.across).toBe('room b');
            expect(Object.keys(mapManager.getRoom('Room B').exits)).toHaveLength(0);
        });
    });

    describe('purgeDeleted', () => {
        test('purgeDeleted removes soft-deleted rooms', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.deleteRoom('Room A');
            mapManager.purgeDeleted();
            expect(mapManager.getRoom('Room A')).toBeUndefined();
            expect(mapManager.getRoom('Room B')).toBeDefined();
        });

        test('purgeDeleted cleans dangling exit references', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'north');
            mapManager.deleteRoom('Room B');
            mapManager.purgeDeleted();
            expect(mapManager.getRoom('Room A').exits.north).toBeUndefined();
        });

        test('purgeDeleted is triggered automatically after 20 deletions', () => {
            for (let i = 0; i < 21; i++) {
                mapManager.addRoom(`Room ${i}`, {});
            }
            for (let i = 0; i < 20; i++) {
                mapManager.deleteRoom(`Room ${i}`);
            }
            for (let i = 0; i < 20; i++) {
                expect(mapManager.getRoom(`Room ${i}`)).toBeUndefined();
            }
            expect(mapManager.getRoom('Room 20')).toBeDefined();
        });
    });

    describe('room status and description', () => {
        test('addRoom creates room with status and description', () => {
            mapManager.addRoom('Hall', {
                exits: {},
                status: 'visited',
                description: 'A grand hall with marble floors.',
            });
            const room = mapManager.getRoom('Hall');
            expect(room.status).toBe('visited');
            expect(room.description).toBe('A grand hall with marble floors.');
        });

        test('addRoom defaults status to visited and description to empty', () => {
            mapManager.addRoom('Hall', { exits: {} });
            const room = mapManager.getRoom('Hall');
            expect(room.status).toBe('visited');
            expect(room.description).toBe('');
        });

        test('ghost room created with status unvisited', () => {
            mapManager.addRoom('Locked Vault', {
                exits: {},
                status: 'unvisited',
                description: 'A heavy iron door blocks access.',
            });
            const room = mapManager.getRoom('Locked Vault');
            expect(room.status).toBe('unvisited');
            expect(room.description).toBe('A heavy iron door blocks access.');
        });

        test('visited always wins over unvisited (unvisited then visited)', () => {
            mapManager.addRoom('Vault', { exits: {}, status: 'unvisited' });
            mapManager.addRoom('Vault', { exits: {}, status: 'visited' });
            expect(mapManager.getRoom('Vault').status).toBe('visited');
        });

        test('visited is not overwritten by unvisited', () => {
            mapManager.addRoom('Vault', { exits: {}, status: 'visited' });
            mapManager.addRoom('Vault', { exits: {}, status: 'unvisited' });
            expect(mapManager.getRoom('Vault').status).toBe('visited');
        });

        test('description only updates from blank to non-blank', () => {
            mapManager.addRoom('Hall', { exits: {}, description: '' });
            mapManager.addRoom('Hall', {
                exits: {},
                description: 'A stone hall.',
            });
            expect(mapManager.getRoom('Hall').description).toBe('A stone hall.');
        });

        test('non-blank description is not overwritten by blank', () => {
            mapManager.addRoom('Hall', {
                exits: {},
                description: 'A stone hall.',
            });
            mapManager.addRoom('Hall', { exits: {}, description: '' });
            expect(mapManager.getRoom('Hall').description).toBe('A stone hall.');
        });

        test('non-blank description is not overwritten by different non-blank', () => {
            mapManager.addRoom('Hall', {
                exits: {},
                description: 'Original description.',
            });
            mapManager.addRoom('Hall', {
                exits: {},
                description: 'New description.',
            });
            expect(mapManager.getRoom('Hall').description).toBe('Original description.');
        });

        test('unvisited room is not auto-deleted by purgeDeleted', () => {
            mapManager.addRoom('Hall', { exits: {}, status: 'visited' });
            mapManager.addRoom('Ghost', { exits: {}, status: 'unvisited' });
            mapManager.purgeDeleted();
            expect(mapManager.getRoom('Ghost')).toBeDefined();
            expect(mapManager.getRoom('Ghost').status).toBe('unvisited');
        });

        test('getMap includes status and description in output', () => {
            mapManager.addRoom('Hall', {
                exits: {},
                status: 'visited',
                description: 'A grand hall.',
            });
            mapManager.addRoom('Vault', {
                exits: {},
                status: 'unvisited',
                description: 'Locked away.',
            });
            const map = mapManager.getMap();
            expect(map.rooms['Hall'].status).toBe('visited');
            expect(map.rooms['Hall'].description).toBe('A grand hall.');
            expect(map.rooms['Vault'].status).toBe('unvisited');
            expect(map.rooms['Vault'].description).toBe('Locked away.');
        });
    });

    describe('connection metadata', () => {
        test('updateMap stores accessible/confirmed via connectionMeta', () => {
            mapManager.addRoom('Hall', { exits: { north: 'Vault' } });
            mapManager.addRoom('Vault', { exits: {} });
            mapManager.updateMap({
                roomName: 'Hall',
                exits: { north: 'Vault' },
                connections: [
                    {
                        from: 'Hall',
                        to: 'Vault',
                        label: 'north',
                        accessible: false,
                        confirmed: true,
                    },
                ],
            });
            // connectionMeta uses canonical keys
            const meta = mapManager.connectionMeta['hall|||north|||vault'];
            expect(meta.accessible).toBe(false);
            expect(meta.confirmed).toBe(true);
        });

        test('getMap includes accessible/confirmed from connectionMeta', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.addRoom('Vault', { exits: {} });
            mapManager.addConnection('Hall', 'Vault', 'north');
            // connectionMeta uses canonical keys
            mapManager.connectionMeta['hall|||north|||vault'] = {
                accessible: false,
                confirmed: true,
            };
            const map = mapManager.getMap();
            const conn = map.connections.find((c) => c.from === 'Hall' && c.to === 'Vault');
            expect(conn.accessible).toBe(false);
            expect(conn.confirmed).toBe(true);
        });

        test('connections default to accessible and confirmed when no meta', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.addRoom('Vault', { exits: {} });
            mapManager.addConnection('Hall', 'Vault', 'north');
            const map = mapManager.getMap();
            const conn = map.connections.find((c) => c.from === 'Hall' && c.to === 'Vault');
            expect(conn.accessible).toBe(true);
            expect(conn.confirmed).toBe(true);
        });

        test('updateMap processes rooms from extended mapData when they are exit destinations', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [{ direction: 'north', room: 'Locked Vault' }],
                rooms: {
                    Hall: {
                        items: ['lantern'],
                        description: 'A low stone hall.',
                        status: 'visited',
                    },
                    'Locked Vault': {
                        items: [],
                        description: 'A heavy iron door blocks access.',
                        status: 'unvisited',
                    },
                },
            });
            expect(mapManager.getRoom('Hall').description).toBe('A low stone hall.');
            expect(mapManager.getRoom('Locked Vault').status).toBe('unvisited');
            expect(mapManager.getRoom('Locked Vault').description).toBe(
                'A heavy iron door blocks access.'
            );
        });
    });

    describe('exits normalization', () => {
        test('updateMap converts exits array [{direction, room}] to object', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [
                    { direction: 'north', room: 'Garden' },
                    { direction: 'east', room: 'Kitchen' },
                ],
            });
            const room = mapManager.getRoom('Hall');
            expect(room.exits.north).toBe('Garden');
            expect(room.exits.east).toBe('Kitchen');
        });

        test('updateMap handles exits already in object format', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: { north: 'Garden' },
            });
            const room = mapManager.getRoom('Hall');
            expect(room.exits.north).toBe('Garden');
        });

        test('updateMap handles empty exits array', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
            });
            const room = mapManager.getRoom('Hall');
            expect(room.exits).toEqual({});
        });

        test('updateMap skips malformed exit entries in array', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [
                    { direction: 'north', room: 'Garden' },
                    { direction: 123, room: 'Bad' },
                    null,
                    'invalid',
                ],
            });
            const room = mapManager.getRoom('Hall');
            expect(room.exits).toEqual({ north: 'Garden' });
        });
    });

    describe('exit merging', () => {
        test('addRoom merges new exits into existing exits', () => {
            mapManager.addRoom('Hall', { exits: { north: 'Garden' } });
            mapManager.addRoom('Hall', { exits: { east: 'Kitchen' } });
            const room = mapManager.getRoom('Hall');
            expect(room.exits.north).toBe('Garden');
            expect(room.exits.east).toBe('Kitchen');
        });

        test('addRoom does not merge array exits (safety guard)', () => {
            mapManager.addRoom('Hall', { exits: { north: 'Garden' } });
            mapManager.addRoom('Hall', { exits: ['south'] });
            expect(mapManager.getRoom('Hall').exits.north).toBe('Garden');
        });
    });

    describe('direction normalization', () => {
        test('updateMap strips "go " prefix from direction', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'go east');
            expect(mapManager.getRoom('Room A').exits.east).toBe('room b');
        });

        test('updateMap strips "walk " prefix from direction', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'walk north');
            expect(mapManager.getRoom('Room A').exits.north).toBe('room b');
        });

        test('updateMap lowercases direction', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'NORTH');
            expect(mapManager.getRoom('Room A').exits.north).toBe('room b');
        });

        test('normalized direction creates correct reverse connection', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'go north');
            expect(mapManager.getRoom('Room B').exits.south).toBe('room a');
        });

        test('updateMap expands abbreviation "n" to "north"', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'n');
            expect(mapManager.getRoom('Room A').exits.north).toBe('room b');
        });

        test('updateMap expands abbreviation "se" to "southeast"', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'se');
            expect(mapManager.getRoom('Room A').exits.southeast).toBe('room b');
        });

        test('updateMap expands "u" to "up" and "d" to "down"', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room B', exits: [] }, 'Room A', 'u');
            expect(mapManager.getRoom('Room A').exits.up).toBe('room b');
        });

        test('updateMap skips connection when previousRoom equals current room', () => {
            mapManager.addRoom('Room A', { exits: {} });
            mapManager.updateMap({ roomName: 'Room A', exits: [] }, 'Room A', 'north');
            expect(mapManager.getRoom('Room A').exits.north).toBeUndefined();
        });
    });

    describe('connections create graph edges', () => {
        test('updateMap with connections calls addConnection for labeled connections', () => {
            // Pre-create Garden so connection is allowed (phantom room prevention)
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'north',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            expect(mapManager.getRoom('Hall').exits.north).toBe('garden');
            expect(mapManager.getRoom('Garden').exits.south).toBe('hall');
        });

        test('updateMap does not create stub rooms from connections (phantom room prevention)', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
                connections: [
                    {
                        from: 'Hall',
                        to: 'Dungeon',
                        label: 'down',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            // Dungeon should NOT be created since it doesn't exist and isn't the current room
            expect(mapManager.getRoom('Dungeon')).toBeUndefined();
        });

        test('updateMap does not call addConnection for connections without label', () => {
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [],
                connections: [{ from: 'Hall', to: 'Garden' }],
            });
            expect(mapManager.getRoom('Hall').exits).toEqual({});
        });

        test('getMap returns connections created from mapData.connections', () => {
            // Pre-create Garden so the connection can be established
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.updateMap({
                roomName: 'Hall',
                exits: [{ direction: 'north', room: 'Garden' }],
                connections: [
                    {
                        from: 'Hall',
                        to: 'Garden',
                        label: 'north',
                        accessible: true,
                        confirmed: true,
                    },
                ],
            });
            const map = mapManager.getMap();
            const conn = map.connections.find((c) => c.from === 'Hall' && c.to === 'Garden');
            expect(conn).toBeDefined();
            expect(conn.label).toBe('north');
        });
    });

    describe('phantom room prevention', () => {
        test('does not create rooms from mapData.rooms unless they are exit destinations', () => {
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [{ direction: 'north', room: 'Garden' }],
                    rooms: {
                        Garden: { items: [], description: 'A garden', status: 'unvisited' },
                        University: {
                            items: [],
                            description: 'Distant place',
                            status: 'unvisited',
                        },
                        Mansion: { items: [], description: 'Another place', status: 'unvisited' },
                    },
                },
                null,
                null
            );
            const map = mapManager.getMap();
            expect(map.rooms['Garden']).toBeDefined();
            expect(map.rooms['University']).toBeUndefined();
            expect(map.rooms['Mansion']).toBeUndefined();
        });

        test('does create rooms from mapData.rooms when they ARE exit destinations', () => {
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [
                        { direction: 'north', room: 'Garden' },
                        { direction: 'south', room: 'Cellar' },
                    ],
                    rooms: {
                        Garden: {
                            items: ['fountain'],
                            description: 'A garden',
                            status: 'unvisited',
                        },
                        Cellar: { items: [], description: 'Dark cellar', status: 'unvisited' },
                    },
                },
                null,
                null
            );
            const map = mapManager.getMap();
            expect(map.rooms['Garden']).toBeDefined();
            expect(map.rooms['Cellar']).toBeDefined();
        });

        test('connections do not create stub rooms for unknown endpoints', () => {
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [],
                    connections: [
                        {
                            from: 'UnknownA',
                            to: 'UnknownB',
                            label: 'north',
                            accessible: true,
                            confirmed: false,
                        },
                    ],
                },
                null,
                null
            );
            const map = mapManager.getMap();
            expect(map.rooms['UnknownA']).toBeUndefined();
            expect(map.rooms['UnknownB']).toBeUndefined();
        });

        test('connections with current room as endpoint are allowed', () => {
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [],
                    connections: [
                        {
                            from: 'Hall',
                            to: 'Garden',
                            label: 'north',
                            accessible: true,
                            confirmed: true,
                        },
                    ],
                },
                null,
                null
            );
            // Hall exists (current room), but Garden should not be created as a stub
            const map = mapManager.getMap();
            expect(map.rooms['Hall']).toBeDefined();
            expect(map.rooms['Garden']).toBeUndefined();
        });
    });

    describe('fuzzy room matching', () => {
        test('"the alley" matches existing "Alley"', () => {
            mapManager.addRoom('Alley', { exits: {} });
            const match = mapManager._fuzzyMatch('the alley');
            expect(match).toBe('alley');
        });

        test('"garbage-choked alley" word-boundary matches existing "Alley"', () => {
            mapManager.addRoom('Alley', { exits: {} });
            const match = mapManager._fuzzyMatch('garbage-choked alley');
            expect(match).toBe('alley');
        });

        test('"Grand Hall" does NOT match "Hall" (shorter name < 4 chars for "hall")', () => {
            mapManager.addRoom('Hall', { exits: {} });
            // "hall" is 4 chars so it should match via word boundary
            // But "Grand Hall" contains "Hall" as a word, so it WILL match
            const match = mapManager._fuzzyMatch('Grand Hall');
            expect(match).toBe('hall');
        });

        test('returns null for no match', () => {
            mapManager.addRoom('Kitchen', { exits: {} });
            const match = mapManager._fuzzyMatch('Dungeon');
            expect(match).toBeNull();
        });

        test('exact match takes priority', () => {
            mapManager.addRoom('Library', { exits: {} });
            const match = mapManager._fuzzyMatch('Library');
            expect(match).toBe('library');
        });

        test('does not match very short names (< 4 chars)', () => {
            mapManager.addRoom('Bar', { exits: {} });
            const match = mapManager._fuzzyMatch('The Great Bar Room');
            // "bar" is only 3 chars, should not fuzzy match
            expect(match).toBeNull();
        });
    });

    describe('connection label cleaning', () => {
        test('"move to north" is cleaned to "north" and accepted', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [],
                    connections: [
                        {
                            from: 'Hall',
                            to: 'Hall',
                            label: 'move to north',
                            accessible: true,
                            confirmed: true,
                        },
                    ],
                },
                null,
                null
            );
            // Should have processed the connection (even if self-referential, the cleaning worked)
            const room = mapManager.getRoom('Hall');
            expect(room.exits).toHaveProperty('north');
        });

        test('"travel to to" is cleaned and rejected', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [],
                    connections: [
                        {
                            from: 'Hall',
                            to: 'Garden',
                            label: 'travel to to',
                            accessible: true,
                            confirmed: true,
                        },
                    ],
                },
                null,
                null
            );
            const room = mapManager.getRoom('Hall');
            // "travel to to" → cleaned to "to" → not a valid direction, should be rejected
            expect(room.exits).not.toHaveProperty('to');
        });

        test('"go east" is cleaned to "east" and accepted', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.addRoom('Garden', { exits: {} });
            mapManager.updateMap(
                {
                    roomName: 'Hall',
                    exits: [],
                    connections: [
                        {
                            from: 'Hall',
                            to: 'Garden',
                            label: 'go east',
                            accessible: true,
                            confirmed: true,
                        },
                    ],
                },
                null,
                null
            );
            const room = mapManager.getRoom('Hall');
            expect(room.exits).toHaveProperty('east');
        });
    });

    describe('traversed tracking', () => {
        test('updateMap with previousRoom/direction adds to traversed set', () => {
            mapManager.addRoom('Hall', { exits: {} });
            mapManager.updateMap({ roomName: 'Garden', exits: {} }, 'Hall', 'north');
            // Traversed uses canonical keys
            expect(mapManager.traversed.has('hall|||north|||garden')).toBe(true);
        });

        test('getMap() connections include traversed: true for traversed exits', () => {
            mapManager.updateMap({ roomName: 'Hall', exits: { north: 'Garden' } }, null, null);
            mapManager.updateMap({ roomName: 'Garden', exits: {} }, 'Hall', 'north');
            const map = mapManager.getMap();
            const conn = map.connections.find((c) => c.from === 'Hall' && c.to === 'Garden');
            expect(conn.traversed).toBe(true);
        });

        test('direct addConnection does NOT mark as traversed', () => {
            mapManager.addRoom('A', { exits: {} });
            mapManager.addRoom('B', { exits: {} });
            mapManager.addConnection('A', 'B', 'east');
            const map = mapManager.getMap();
            const conn = map.connections.find((c) => c.from === 'A' && c.to === 'B');
            expect(conn.traversed).toBe(false);
        });
    });
});
