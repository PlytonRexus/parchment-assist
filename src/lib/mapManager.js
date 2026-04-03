const REVERSE_DIRECTIONS = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
    up: 'down',
    down: 'up',
    northeast: 'southwest',
    southwest: 'northeast',
    northwest: 'southeast',
    southeast: 'northwest',
    in: 'out',
    out: 'in',
};

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
            const reverse = REVERSE_DIRECTIONS[direction];
            if (reverse && !this.graph[toRoom].exits[reverse]) {
                this.graph[toRoom].exits[reverse] = fromRoom;
            }
        }
    }

    getRoom(roomName) {
        return this.graph[roomName];
    }

    deleteRoom(roomName) {
        if (this.graph[roomName]) {
            this.graph[roomName].isDeleted = true;
            const deletedCount = Object.values(this.graph).filter((r) => r.isDeleted).length;
            if (deletedCount >= 20) {
                this.purgeDeleted();
            }
            return true;
        }
        return false;
    }

    purgeDeleted() {
        // Remove all soft-deleted rooms from the graph
        const deletedNames = new Set(
            Object.keys(this.graph).filter((name) => this.graph[name].isDeleted)
        );
        for (const name of deletedNames) {
            delete this.graph[name];
        }
        // Remove dangling exit references pointing to purged rooms
        for (const room of Object.values(this.graph)) {
            for (const dir of Object.keys(room.exits)) {
                if (deletedNames.has(room.exits[dir])) {
                    delete room.exits[dir];
                }
            }
        }
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
