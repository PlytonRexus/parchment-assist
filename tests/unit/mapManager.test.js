import { MapManager } from '../../src/lib/mapManager.js';

describe('MapManager', () => {
    let mapManager;

    beforeEach(() => {
        mapManager = new MapManager();
    });

    test('should add a new room with exits', () => {
        const roomName = 'Room A';
        const roomData = { exits: ['north', 'south'] };
        mapManager.addRoom(roomName, roomData);
        const room = mapManager.getRoom(roomName);
        expect(room).toBeDefined();
        expect(room.exits).toEqual(['north', 'south']);
    });

    test('should update exits for an existing room', () => {
        const roomName = 'Room A';
        mapManager.addRoom(roomName, { exits: ['north'] });
        mapManager.addRoom(roomName, { exits: ['east', 'west'] });
        const room = mapManager.getRoom(roomName);
        expect(room.exits).toEqual(['east', 'west']);
    });

    test('should add a connection between two rooms', () => {
        mapManager.addRoom('Room A', {});
        mapManager.addRoom('Room B', {});
        mapManager.addConnection('Room A', 'Room B', 'north');
        const roomA = mapManager.getRoom('Room A');
        expect(roomA.exits.north).toBe('Room B');
    });

    test('should not create "Unknown" rooms', () => {
        const roomName = 'Room A';
        const mapData = { roomName, exits: ['north', 'south'] };
        mapManager.updateMap(mapData);
        const room = mapManager.getRoom(roomName);
        expect(room.exits).toEqual(['north', 'south']);
        const map = mapManager.getMap();
        const roomNames = Object.keys(map.rooms);
        expect(roomNames).not.toContain(expect.stringContaining('Unknown'));
    });

    test('should correctly update map from player movement', () => {
        const previousRoom = 'Room A';
        const currentRoom = 'Room B';
        const direction = 'north';
        mapManager.addRoom(previousRoom, {});
        const mapData = { roomName: currentRoom, exits: ['south'] };
        mapManager.updateMap(mapData, previousRoom, direction);
        const roomA = mapManager.getRoom(previousRoom);
        expect(roomA.exits[direction]).toBe(currentRoom);
    });

    describe('bidirectional connections', () => {
        test('north->south: adding A->B north auto-creates B->A south', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'north');
            expect(mapManager.getRoom('Room A').exits.north).toBe('Room B');
            expect(mapManager.getRoom('Room B').exits.south).toBe('Room A');
        });

        test('east->west: adding A->B east auto-creates B->A west', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'east');
            expect(mapManager.getRoom('Room B').exits.west).toBe('Room A');
        });

        test('up->down: adding A->B up auto-creates B->A down', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'up');
            expect(mapManager.getRoom('Room B').exits.down).toBe('Room A');
        });

        test('in->out: adding A->B in auto-creates B->A out', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'in');
            expect(mapManager.getRoom('Room B').exits.out).toBe('Room A');
        });

        test('northeast->southwest: diagonal auto-reverse', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'northeast');
            expect(mapManager.getRoom('Room B').exits.southwest).toBe('Room A');
        });

        test('should not overwrite existing reverse exit', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addRoom('Room C', {});
            // Manually set B->south = C
            mapManager.getRoom('Room B').exits.south = 'Room C';
            // Adding A->B north should NOT overwrite B->south
            mapManager.addConnection('Room A', 'Room B', 'north');
            expect(mapManager.getRoom('Room B').exits.south).toBe('Room C');
        });

        test('unknown direction does not create reverse', () => {
            mapManager.addRoom('Room A', {});
            mapManager.addRoom('Room B', {});
            mapManager.addConnection('Room A', 'Room B', 'across');
            expect(mapManager.getRoom('Room A').exits.across).toBe('Room B');
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
            // Add 21 rooms and delete them all; after the 20th deletion purge fires
            for (let i = 0; i < 21; i++) {
                mapManager.addRoom(`Room ${i}`, {});
            }
            for (let i = 0; i < 20; i++) {
                mapManager.deleteRoom(`Room ${i}`);
            }
            // After 20 deletions the purge has fired, so deleted rooms are gone
            for (let i = 0; i < 20; i++) {
                expect(mapManager.getRoom(`Room ${i}`)).toBeUndefined();
            }
            // Room 20 was never deleted
            expect(mapManager.getRoom('Room 20')).toBeDefined();
        });
    });
});
