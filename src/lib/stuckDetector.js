export class StuckDetector {
    constructor() {
        this._currentRoom = null;
        this._roomStayCount = 0;
        this._inventoryKey = null; // null signals "not yet seen"
        this._inventoryStayCount = 0;
        this._consecutiveRejections = 0;
        this._recentCommands = [];
    }

    update({ room, inventory, command, wasRejected }) {
        if (room !== null && room !== undefined) {
            if (room !== this._currentRoom) {
                this._currentRoom = room;
                this._roomStayCount = 1; // first turn in this room
            } else {
                this._roomStayCount++;
            }
        }

        const key = Array.isArray(inventory) ? [...inventory].sort().join(',') : '';
        if (key !== this._inventoryKey) {
            this._inventoryKey = key;
            this._inventoryStayCount = 1; // first turn with this inventory
        } else {
            this._inventoryStayCount++;
        }

        this._consecutiveRejections = wasRejected ? this._consecutiveRejections + 1 : 0;

        if (command) {
            this._recentCommands.push(command.toLowerCase().trim());
            if (this._recentCommands.length > 5) {
                this._recentCommands = this._recentCommands.slice(-5);
            }
        }
    }

    reset() {
        this._roomStayCount = 0;
        this._inventoryKey = null;
        this._inventoryStayCount = 0;
        this._consecutiveRejections = 0;
        this._recentCommands = [];
    }

    getStuckLevel() {
        const maxRepeat = this._maxCommandRepeat();

        if (
            this._roomStayCount >= 15 ||
            this._inventoryStayCount >= 15 ||
            this._consecutiveRejections >= 5
        ) {
            return 3;
        }

        if (this._roomStayCount >= 10 || this._consecutiveRejections >= 3 || maxRepeat >= 3) {
            return 2;
        }

        if (this._roomStayCount >= 5 || maxRepeat >= 2) {
            return 1;
        }

        return 0;
    }

    _maxCommandRepeat() {
        if (!this._recentCommands.length) {
            return 0;
        }
        const counts = {};
        for (const c of this._recentCommands) {
            counts[c] = (counts[c] || 0) + 1;
        }
        return Math.max(...Object.values(counts));
    }
}
