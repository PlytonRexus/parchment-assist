export class MapManager {
    constructor() {
        this.graph = {};
    }

    addRoom(roomName, roomData) {
        // Handle null or undefined roomData
        if (!roomData) {
            roomData = { items: [], exits: {} };
        }

        if (!this.graph[roomName]) {
            this.graph[roomName] = {
                items: roomData.items || [],
                exits: roomData.exits || {},
                isDeleted: false,
            };
        } else if (roomData.exits) {
            this.graph[roomName].exits = roomData.exits;
        }
    }

    addConnection(fromRoom, toRoom, direction) {
        if (this.graph[fromRoom] && this.graph[toRoom]) {
            this.graph[fromRoom].exits[direction] = toRoom;
        }
    }

    getRoom(roomName) {
        return this.graph[roomName];
    }

    deleteRoom(roomName) {
        if (this.graph[roomName]) {
            this.graph[roomName].isDeleted = true;
            return true;
        }
        return false;
    }

    getMap() {
        const activeRooms = {};
        for (const roomName in this.graph) {
            if (!this.graph[roomName].isDeleted) {
                activeRooms[roomName] = this.graph[roomName];
            }
        }

        const connections = [];
        for (const roomName in activeRooms) {
            for (const exit in activeRooms[roomName].exits) {
                const destination = activeRooms[roomName].exits[exit];
                if (activeRooms[destination]) {
                    connections.push({
                        from: roomName,
                        to: destination,
                        label: exit,
                    });
                }
            }
        }
        return { rooms: activeRooms, connections };
    }

    updateMap(mapData, previousRoom, direction) {
        if (!mapData || !mapData.roomName) {
            return;
        }

        this.addRoom(mapData.roomName, { exits: mapData.exits });

        if (previousRoom && direction) {
            this.addConnection(previousRoom, mapData.roomName, direction);
        }
    }
}
