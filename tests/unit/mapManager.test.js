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
});
