/**
 * StuckDetector Unit Tests
 * Covers stuck levels 0-3 based on room history, command repetition,
 * consecutive rejections, and inventory stagnation.
 */

import { StuckDetector } from '../../src/lib/stuckDetector.js';

function makeDetector() {
    return new StuckDetector();
}

function stayInRoom(detector, room, turns) {
    for (let i = 0; i < turns; i++) {
        detector.update({ room, inventory: [], command: null, wasRejected: false });
    }
}

describe('StuckDetector', () => {
    describe('initial state', () => {
        test('starts at level 0', () => {
            const d = makeDetector();
            expect(d.getStuckLevel()).toBe(0);
        });
    });

    describe('room-based stuck detection', () => {
        test('level 0 after 4 turns in same room', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 4);
            expect(d.getStuckLevel()).toBe(0);
        });

        test('level 1 after 5 turns in same room', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 5);
            expect(d.getStuckLevel()).toBe(1);
        });

        test('level 2 after 10 turns in same room', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 10);
            expect(d.getStuckLevel()).toBe(2);
        });

        test('level 3 after 15 turns in same room', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 15);
            expect(d.getStuckLevel()).toBe(3);
        });

        test('room change resets room stay count', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 10);
            expect(d.getStuckLevel()).toBe(2);
            d.update({ room: 'Kitchen', inventory: [], command: null, wasRejected: false });
            expect(d.getStuckLevel()).toBe(0);
        });

        test('moving to new room and staying again starts fresh count', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 10);
            // Explicit move to Kitchen counts as turn 1 in Kitchen
            d.update({ room: 'Kitchen', inventory: [], command: null, wasRejected: false });
            // 3 more stays = count 4 total → below level 1 threshold
            stayInRoom(d, 'Kitchen', 3);
            expect(d.getStuckLevel()).toBe(0);
        });
    });

    describe('command repetition detection', () => {
        test('level 0 with all unique commands', () => {
            const d = makeDetector();
            // Vary room and inventory each turn to isolate command-repeat logic
            ['go north', 'take lamp', 'examine box', 'drop sword', 'open door'].forEach(
                (cmd, i) => {
                    d.update({
                        room: `Room${i}`,
                        inventory: [`item${i}`],
                        command: cmd,
                        wasRejected: false,
                    });
                }
            );
            expect(d.getStuckLevel()).toBe(0);
        });

        test('level 1 when same command repeated 2 times in recent 5', () => {
            const d = makeDetector();
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            expect(d.getStuckLevel()).toBe(1);
        });

        test('level 2 when same command repeated 3 times in recent 5', () => {
            const d = makeDetector();
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            expect(d.getStuckLevel()).toBe(2);
        });

        test('sliding window of 5: old commands drop out', () => {
            const d = makeDetector();
            // Use different rooms and different inventory each turn to isolate command-repeat logic
            const cmds = [
                'go north',
                'go north',
                'take lamp',
                'examine box',
                'drop sword',
                'open door',
            ];
            cmds.forEach((cmd, i) => {
                d.update({
                    room: `Room${i}`,
                    inventory: [`item${i}`],
                    command: cmd,
                    wasRejected: false,
                });
            });
            // window is now last 5: ['go north', 'take lamp', 'examine box', 'drop sword', 'open door']
            // 'go north' appears once → maxRepeat = 1 → no repeat stuck
            // rooms all different → roomStayCount = 1; inventory all different → inventoryStayCount = 1
            expect(d.getStuckLevel()).toBe(0);
        });
    });

    describe('consecutive rejection detection', () => {
        test('level 0 with no rejections', () => {
            const d = makeDetector();
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            expect(d.getStuckLevel()).toBe(0);
        });

        test('level 2 after 3 consecutive rejections', () => {
            const d = makeDetector();
            for (let i = 0; i < 3; i++) {
                d.update({ room: 'Hall', inventory: [], command: 'bad cmd', wasRejected: true });
            }
            expect(d.getStuckLevel()).toBe(2);
        });

        test('level 3 after 5 consecutive rejections', () => {
            const d = makeDetector();
            for (let i = 0; i < 5; i++) {
                d.update({ room: 'Hall', inventory: [], command: 'bad cmd', wasRejected: true });
            }
            expect(d.getStuckLevel()).toBe(3);
        });

        test('non-rejected command resets consecutive rejection count', () => {
            const d = makeDetector();
            // Use unique bad commands so they don't trigger command-repetition detection
            d.update({ room: 'Hall', inventory: [], command: 'bad1', wasRejected: true });
            d.update({ room: 'Hall', inventory: [], command: 'bad2', wasRejected: true });
            d.update({ room: 'Hall', inventory: [], command: 'bad3', wasRejected: true });
            expect(d.getStuckLevel()).toBe(2); // 3 consecutive rejections
            d.update({ room: 'Hall', inventory: [], command: 'go north', wasRejected: false });
            // consecutiveRejections reset to 0; roomStayCount = 4 (< 5); recentCommands all unique
            expect(d.getStuckLevel()).toBe(0);
        });
    });

    describe('inventory stagnation detection', () => {
        test('level 3 after 15 turns with same inventory', () => {
            const d = makeDetector();
            // First update sets inventoryStayCount = 1; each subsequent increments it
            // 15 total updates → inventoryStayCount = 15 → level 3
            for (let i = 0; i < 15; i++) {
                d.update({
                    room: `Room${i}`,
                    inventory: ['lamp', 'key'],
                    command: null,
                    wasRejected: false,
                });
            }
            expect(d.getStuckLevel()).toBe(3);
        });

        test('inventory change resets stagnation count', () => {
            const d = makeDetector();
            for (let i = 0; i < 14; i++) {
                d.update({
                    room: `Room${i}`,
                    inventory: ['lamp'],
                    command: null,
                    wasRejected: false,
                });
            }
            // Take something new
            d.update({
                room: 'RoomX',
                inventory: ['lamp', 'key'],
                command: 'take key',
                wasRejected: false,
            });
            expect(d.getStuckLevel()).toBe(0);
        });
    });

    describe('reset()', () => {
        test('reset clears all counters back to level 0', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 15);
            expect(d.getStuckLevel()).toBe(3);
            d.reset();
            expect(d.getStuckLevel()).toBe(0);
        });

        test('can accumulate stuck again after reset', () => {
            const d = makeDetector();
            stayInRoom(d, 'Hall', 10);
            d.reset();
            stayInRoom(d, 'Hall', 5);
            expect(d.getStuckLevel()).toBe(1);
        });
    });

    describe('edge cases', () => {
        test('null room is ignored (no room tracking)', () => {
            const d = makeDetector();
            // 4 updates — well below any threshold (inventory stays 4 turns, roomStayCount = 0)
            for (let i = 0; i < 4; i++) {
                d.update({ room: null, inventory: [], command: null, wasRejected: false });
            }
            // roomStayCount stays 0; inventoryStayCount = 4 < 5 → level 0
            expect(d.getStuckLevel()).toBe(0);
        });

        test('undefined room is ignored', () => {
            const d = makeDetector();
            for (let i = 0; i < 4; i++) {
                d.update({ room: undefined, inventory: [], command: null, wasRejected: false });
            }
            expect(d.getStuckLevel()).toBe(0);
        });

        test('non-array inventory treated as empty string key (no crash)', () => {
            const d = makeDetector();
            expect(() => {
                d.update({ room: 'Hall', inventory: null, command: null, wasRejected: false });
                d.update({ room: 'Hall', inventory: undefined, command: null, wasRejected: false });
            }).not.toThrow();
        });
    });
});
