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

const DIR_ABBREVIATIONS = {
    n: 'north',
    s: 'south',
    e: 'east',
    w: 'west',
    ne: 'northeast',
    nw: 'northwest',
    se: 'southeast',
    sw: 'southwest',
    u: 'up',
    d: 'down',
};

const VALID_DIRECTIONS = new Set([
    ...Object.keys(REVERSE_DIRECTIONS),
    ...Object.keys(DIR_ABBREVIATIONS),
]);

const IGNORED_ROOMS = new Set([
    'start screen',
    'title screen',
    'menu',
    'credits',
    'introduction',
    'loading',
]);

export class MapManager {
    constructor() {
        this.graph = {};
        this.traversed = new Set();
        this.connectionMeta = {};
    }

    _canonicalKey(name) {
        return (name || '').trim().toLowerCase();
    }

    _isIgnored(name) {
        return IGNORED_ROOMS.has(this._canonicalKey(name));
    }

    addRoom(roomName, roomData) {
        if (!roomData) {
            roomData = { items: [], exits: {} };
        }

        if (this._isIgnored(roomName)) {
            return;
        }

        const key = this._canonicalKey(roomName);
        if (!key) {
            return;
        }

        if (!this.graph[key]) {
            this.graph[key] = {
                displayName: roomName.trim(),
                items: roomData.items || [],
                exits: roomData.exits || {},
                isDeleted: false,
                status: roomData.status || 'visited',
                description: roomData.description || '',
            };
        } else {
            const existing = this.graph[key];
            if (
                roomData.exits &&
                typeof roomData.exits === 'object' &&
                !Array.isArray(roomData.exits)
            ) {
                Object.assign(existing.exits, roomData.exits);
            }
            // visited always wins over unvisited
            if (roomData.status === 'visited') {
                existing.status = 'visited';
            } else if (roomData.status === 'unvisited' && existing.status !== 'visited') {
                existing.status = 'unvisited';
            }
            // Only update description if existing is blank and incoming is non-empty
            if (
                (!existing.description || !existing.description.trim()) &&
                roomData.description &&
                roomData.description.trim()
            ) {
                existing.description = roomData.description;
            }
        }
    }

    addConnection(fromRoom, toRoom, direction) {
        const fromKey = this._canonicalKey(fromRoom);
        const toKey = this._canonicalKey(toRoom);
        if (this.graph[fromKey] && this.graph[toKey]) {
            this.graph[fromKey].exits[direction] = toKey;
            const reverse = REVERSE_DIRECTIONS[direction];
            if (reverse && !this.graph[toKey].exits[reverse]) {
                this.graph[toKey].exits[reverse] = fromKey;
            }
        }
    }

    /**
     * Fuzzy match a room name against existing rooms in the graph.
     * Tries: exact canonical key, article-stripped key, word-boundary substring match.
     * Returns the existing canonical key if found, or null.
     */
    _fuzzyMatch(name) {
        if (!name) {
            return null;
        }

        const key = this._canonicalKey(name);

        // Exact match
        if (this.graph[key]) {
            return key;
        }

        // Strip leading articles and retry
        const stripped = key.replace(/^(?:the|a|an)\s+/, '');
        if (stripped && stripped !== key && this.graph[stripped]) {
            return stripped;
        }

        // Word-boundary substring match against existing rooms
        // The shorter name must be ≥ 4 chars to avoid false positives
        const existingKeys = Object.keys(this.graph);
        for (const existing of existingKeys) {
            if (this.graph[existing].isDeleted) {
                continue;
            }
            // Check if the candidate is a word-boundary match within an existing key or vice versa
            const shorter = key.length <= existing.length ? key : existing;
            const longer = key.length <= existing.length ? existing : key;
            if (shorter.length >= 4) {
                try {
                    const regex = new RegExp(
                        `\\b${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
                    );
                    if (regex.test(longer)) {
                        return existing;
                    }
                } catch {
                    // Invalid regex from room name — skip
                }
            }
            // Also try article-stripped version
            const strippedExisting = existing.replace(/^(?:the|a|an)\s+/, '');
            if (stripped.length >= 4 && strippedExisting.length >= 4) {
                if (stripped === strippedExisting) {
                    return existing;
                }
            }
        }

        return null;
    }

    getRoom(roomName) {
        return this.graph[this._canonicalKey(roomName)];
    }

    getDisplayName(roomName) {
        const room = this.graph[this._canonicalKey(roomName)];
        return room ? room.displayName : roomName;
    }

    deleteRoom(roomName) {
        const key = this._canonicalKey(roomName);
        if (this.graph[key]) {
            this.graph[key].isDeleted = true;
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
        const deletedKeys = new Set(
            Object.keys(this.graph).filter((key) => this.graph[key].isDeleted)
        );
        for (const key of deletedKeys) {
            delete this.graph[key];
        }
        // Remove dangling exit references pointing to purged rooms
        for (const room of Object.values(this.graph)) {
            for (const dir of Object.keys(room.exits)) {
                if (deletedKeys.has(room.exits[dir])) {
                    delete room.exits[dir];
                }
            }
        }
    }

    getMap() {
        const activeRooms = {};
        for (const key in this.graph) {
            if (!this.graph[key].isDeleted) {
                const room = this.graph[key];
                const displayName = room.displayName || key;
                // Resolve exit destinations from canonical keys to display names
                const resolvedExits = {};
                for (const dir in room.exits) {
                    const destKey = room.exits[dir];
                    const destRoom = this.graph[destKey];
                    resolvedExits[dir] = destRoom ? destRoom.displayName || destKey : destKey;
                }
                activeRooms[displayName] = { ...room, exits: resolvedExits };
            }
        }

        const connections = [];
        for (const key in this.graph) {
            const room = this.graph[key];
            if (room.isDeleted) {
                continue;
            }
            const fromName = room.displayName || key;
            for (const exit in room.exits) {
                const destKey = room.exits[exit];
                const destRoom = this.graph[destKey];
                if (destRoom && !destRoom.isDeleted) {
                    const toName = destRoom.displayName || destKey;
                    const metaKey = `${key}|||${exit}|||${destKey}`;
                    const meta = this.connectionMeta[metaKey] || {};
                    connections.push({
                        from: fromName,
                        to: toName,
                        label: exit,
                        traversed: this.traversed.has(metaKey),
                        accessible: meta.accessible !== false,
                        confirmed: meta.confirmed !== false,
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

        if (this._isIgnored(mapData.roomName)) {
            return;
        }

        // Convert exits from AI array format [{direction, room}] to object format {direction: room}
        // Apply fuzzy matching to prevent duplicate room nodes from synonyms
        const exitsObj = {};
        if (Array.isArray(mapData.exits)) {
            for (const exit of mapData.exits) {
                if (exit && typeof exit.direction === 'string' && typeof exit.room === 'string') {
                    const dir = exit.direction.toLowerCase();
                    // Fuzzy match exit destination against existing rooms
                    const matchedKey = this._fuzzyMatch(exit.room);
                    if (matchedKey && this.graph[matchedKey]) {
                        exitsObj[dir] = this.graph[matchedKey].displayName;
                    } else {
                        exitsObj[dir] = exit.room;
                    }
                }
            }
        } else if (mapData.exits && typeof mapData.exits === 'object') {
            Object.assign(exitsObj, mapData.exits);
        }
        this.addRoom(mapData.roomName, { exits: exitsObj });

        const currentKey = this._canonicalKey(mapData.roomName);
        const prevKey = previousRoom ? this._canonicalKey(previousRoom) : null;

        if (prevKey && direction && prevKey !== currentKey) {
            // Normalize direction: strip command prefixes, expand abbreviations
            const stripped = direction.toLowerCase().replace(/^(go|walk|head|move)\s+/, '');
            const normalizedDir = DIR_ABBREVIATIONS[stripped] || stripped;
            this.addConnection(previousRoom, mapData.roomName, normalizedDir);
            this.traversed.add(`${prevKey}|||${normalizedDir}|||${currentKey}`);
        }

        // Process extended room metadata from AI — ONLY for rooms that are exit destinations
        if (mapData.rooms && typeof mapData.rooms === 'object') {
            const exitDestinations = new Set();
            for (const dir in exitsObj) {
                exitDestinations.add(this._canonicalKey(exitsObj[dir]));
            }
            for (const name in mapData.rooms) {
                const nameKey = this._canonicalKey(name);
                // Only create rooms that are actual exit destinations of the current room
                if (!exitDestinations.has(nameKey) && nameKey !== currentKey) {
                    continue;
                }
                const roomInfo = mapData.rooms[name];
                if (!roomInfo || typeof roomInfo !== 'object') {
                    continue;
                }
                this.addRoom(name, {
                    items: roomInfo.items || [],
                    exits: {},
                    status: roomInfo.status || 'visited',
                    description: roomInfo.description || '',
                });
            }
        }

        // Process extended connection metadata from AI
        if (Array.isArray(mapData.connections)) {
            for (const conn of mapData.connections) {
                if (!conn || !conn.from || !conn.to) {
                    continue;
                }
                // Clean and validate direction labels
                const rawLabel = conn.label ? conn.label.toLowerCase() : '';
                const cleanedLabel = rawLabel
                    .replace(/^(go|move|travel|walk|head)\s+(to\s+)?/i, '')
                    .replace(/\s+to$/i, '')
                    .trim();
                const normalizedLabel = DIR_ABBREVIATIONS[cleanedLabel] || cleanedLabel;
                if (!normalizedLabel || !VALID_DIRECTIONS.has(normalizedLabel)) {
                    continue;
                }
                const fromKey = this._fuzzyMatch(conn.from) || this._canonicalKey(conn.from);
                const toKey = this._fuzzyMatch(conn.to) || this._canonicalKey(conn.to);
                const metaKey = `${fromKey}|||${normalizedLabel}|||${toKey}`;
                this.connectionMeta[metaKey] = {
                    accessible: conn.accessible !== false,
                    confirmed: conn.confirmed !== false,
                };
                // Don't create stub rooms for connection endpoints that don't exist
                // and aren't the current room — prevents phantom rooms
                if (!this.graph[fromKey] && fromKey !== currentKey) {
                    continue;
                }
                if (!this.graph[toKey] && toKey !== currentKey) {
                    continue;
                }
                if (!this.graph[fromKey]) {
                    this.addRoom(conn.from, { exits: {} });
                }
                if (!this.graph[toKey]) {
                    this.addRoom(conn.to, { exits: {} });
                }
                this.addConnection(conn.from, conn.to, normalizedLabel);
            }
        }
    }
}
