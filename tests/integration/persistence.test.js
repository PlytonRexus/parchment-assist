import { ParchmentAssist } from '../../src/content/content.js';

describe('NPC Profile Persistence', () => {
    let parchmentAssist;
    let storageData;

    beforeEach(() => {
        storageData = {};
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        globalThis.chrome = {
            storage: {
                local: {
                    get: async (keys) => {
                        const result = {};
                        for (const key of keys) {
                            if (storageData[key]) {
                                result[key] = storageData[key];
                            }
                        }
                        return result;
                    },
                    set: async (data) => {
                        Object.assign(storageData, data);
                    },
                },
                sync: {
                    get: async () => ({}),
                    set: async () => {},
                },
            },
        };

        parchmentAssist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.chrome;
    });

    test('_saveNpcsToStorage writes npc_${gameTitle} key', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'Zork';
        parchmentAssist.npcProfiler.npcProfiles = {
            troll: { description: 'A nasty troll', dialogue: ['Go away!'] },
        };

        await parchmentAssist._saveNpcsToStorage();

        expect(storageData['npc_Zork']).toBeDefined();
        expect(storageData['npc_Zork'].troll.description).toBe('A nasty troll');
        expect(storageData['npc_Zork'].troll.dialogue).toEqual(['Go away!']);
    });

    test('_loadNpcsFromStorage restores npcProfiles and calls renderProfiles', async () => {
        storageData['npc_Zork'] = {
            wizard: { description: 'An old wizard', dialogue: ['Seek the orb'] },
        };
        document.title = 'Zork - Parchment';

        await parchmentAssist._loadNpcsFromStorage();

        expect(parchmentAssist.npcProfiler.npcProfiles.wizard).toBeDefined();
        expect(parchmentAssist.npcProfiler.npcProfiles.wizard.description).toBe('An old wizard');
    });

    test('_saveNpcsToStorage skips gracefully when gameTitle is missing', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = '';

        await expect(parchmentAssist._saveNpcsToStorage()).resolves.toBeUndefined();
        expect(Object.keys(storageData)).toHaveLength(0);
    });

    test('different game titles produce independent storage keys', async () => {
        parchmentAssist.npcProfiler.npcProfiles = {
            guard: { description: 'A guard' },
        };

        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'GameA';
        await parchmentAssist._saveNpcsToStorage();

        parchmentAssist.npcProfiler.npcProfiles = {
            knight: { description: 'A knight' },
        };
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'GameB';
        await parchmentAssist._saveNpcsToStorage();

        expect(storageData['npc_GameA'].guard).toBeDefined();
        expect(storageData['npc_GameB'].knight).toBeDefined();
        expect(storageData['npc_GameA'].knight).toBeUndefined();
    });
});

describe('Session Metadata Persistence', () => {
    let parchmentAssist;
    let storageData;

    beforeEach(() => {
        storageData = {};
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        globalThis.chrome = {
            storage: {
                local: {
                    get: async (keys) => {
                        const result = {};
                        for (const key of keys) {
                            if (storageData[key]) {
                                result[key] = storageData[key];
                            }
                        }
                        return result;
                    },
                    set: async (data) => {
                        Object.assign(storageData, data);
                    },
                },
                sync: {
                    get: async () => ({}),
                    set: async () => {},
                },
            },
        };

        parchmentAssist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.chrome;
    });

    test('_saveMetaToStorage writes meta_${gameTitle} with turnCount, commandHistory, rejectedCommands', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'Zork';
        parchmentAssist.gameStateManager.turnCount = 15;
        parchmentAssist.gameStateManager.commandHistory = ['look', 'go north', 'take key'];
        parchmentAssist.gameStateManager.rejectedCommands = new Map([
            ['eat rock', 2],
            ['fly', 1],
        ]);

        await parchmentAssist._saveMetaToStorage();

        const meta = storageData['meta_Zork'];
        expect(meta).toBeDefined();
        expect(meta.turnCount).toBe(15);
        expect(meta.commandHistory).toEqual(['look', 'go north', 'take key']);
        expect(meta.rejectedCommands).toEqual([
            ['eat rock', 2],
            ['fly', 1],
        ]);
    });

    test('_loadMetaFromStorage restores all three meta fields', async () => {
        storageData['meta_Zork'] = {
            turnCount: 42,
            commandHistory: ['open door', 'go east'],
            rejectedCommands: [
                ['jump', 3],
                ['xyzzy', 1],
            ],
        };
        document.title = 'Zork - Parchment';
        // Game text must contain the last stored command so session is recognized as continuing
        parchmentAssist.gameStateManager.rawGameState.gameText = 'You go east into the hall.';

        await parchmentAssist._loadMetaFromStorage();

        expect(parchmentAssist.gameStateManager.turnCount).toBe(42);
        expect(parchmentAssist.gameStateManager.commandHistory).toEqual(['open door', 'go east']);
        expect(parchmentAssist.gameStateManager.rejectedCommands).toBeInstanceOf(Map);
        expect(parchmentAssist.gameStateManager.rejectedCommands.get('jump')).toBe(3);
        expect(parchmentAssist.gameStateManager.rejectedCommands.get('xyzzy')).toBe(1);
    });

    test('_loadMetaFromStorage skips stale meta when game was restarted', async () => {
        storageData['meta_Zork'] = {
            turnCount: 42,
            commandHistory: ['open door', 'go east'],
            rejectedCommands: [['jump', 3]],
        };
        document.title = 'Zork - Parchment';
        // Game text does NOT contain 'go east' — game was restarted
        parchmentAssist.gameStateManager.rawGameState.gameText =
            'West of House. You are standing in an open field.';

        await parchmentAssist._loadMetaFromStorage();

        expect(parchmentAssist.gameStateManager.turnCount).toBe(0);
        expect(parchmentAssist.gameStateManager.commandHistory).toEqual([]);
    });

    test('_saveMetaToStorage skips gracefully when gameTitle is missing', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = '';

        await expect(parchmentAssist._saveMetaToStorage()).resolves.toBeUndefined();
        expect(Object.keys(storageData)).toHaveLength(0);
    });

    test('_saveMetaToStorage creates a copy of commandHistory (not a reference)', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'Zork';
        parchmentAssist.gameStateManager.commandHistory = ['look'];

        await parchmentAssist._saveMetaToStorage();
        parchmentAssist.gameStateManager.commandHistory.push('go north');

        expect(storageData['meta_Zork'].commandHistory).toEqual(['look']);
    });
});

describe('Snapshot Protocol', () => {
    let parchmentAssist;
    let storageData;

    beforeEach(() => {
        storageData = {};
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        globalThis.chrome = {
            storage: {
                local: {
                    get: async (keys) => {
                        const result = {};
                        for (const key of keys) {
                            if (storageData[key]) {
                                result[key] = storageData[key];
                            }
                        }
                        return result;
                    },
                    set: async (data) => {
                        Object.assign(storageData, data);
                    },
                },
                sync: {
                    get: async () => ({}),
                    set: async () => {},
                },
            },
        };

        parchmentAssist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.chrome;
    });

    test('_getCurrentSnapshot returns map, npcs, quests, meta bundle', () => {
        parchmentAssist.mapManager.addRoom('Hall', { items: ['torch'], exits: {} });
        parchmentAssist.npcProfiler.npcProfiles = {
            wizard: { description: 'Old wizard' },
        };
        parchmentAssist.gameStateManager.structuredGameState = { quests: ['Find the orb'] };
        parchmentAssist.gameStateManager.turnCount = 10;
        parchmentAssist.gameStateManager.commandHistory = ['look', 'go north'];
        parchmentAssist.gameStateManager.rejectedCommands = new Map([['fly', 2]]);

        const snapshot = parchmentAssist._getCurrentSnapshot();

        expect(snapshot.map).toBeDefined();
        expect(snapshot.map.graph['hall']).toBeDefined();
        expect(snapshot.map.traversed).toEqual([]);
        expect(snapshot.map.connectionMeta).toEqual({});
        expect(snapshot.npcs.wizard.description).toBe('Old wizard');
        expect(snapshot.quests).toEqual(['Find the orb']);
        expect(snapshot.meta.turnCount).toBe(10);
        expect(snapshot.meta.commandHistory).toEqual(['look', 'go north']);
        expect(snapshot.meta.rejectedCommands).toEqual([['fly', 2]]);
    });

    test('_applySnapshot restores all state and re-saves to storage', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'Zork';
        parchmentAssist.gameStateManager.structuredGameState = { quests: [] };

        const snapshot = {
            map: {
                graph: {
                    cellar: {
                        displayName: 'Cellar',
                        items: ['sword'],
                        exits: {},
                        isDeleted: false,
                    },
                },
                traversed: ['cellar|||north|||garden'],
                connectionMeta: {
                    'cellar|||north|||garden': { accessible: true, confirmed: true },
                },
            },
            npcs: { troll: { description: 'Nasty troll', dialogue: ['Grr'] } },
            quests: ['Defeat troll'],
            meta: {
                turnCount: 25,
                commandHistory: ['attack troll'],
                rejectedCommands: [['pet troll', 1]],
            },
        };

        await parchmentAssist._applySnapshot(snapshot);

        // Verify in-memory state restored
        expect(parchmentAssist.mapManager.graph['cellar']).toBeDefined();
        expect(parchmentAssist.mapManager.traversed.has('cellar|||north|||garden')).toBe(true);
        expect(parchmentAssist.mapManager.connectionMeta['cellar|||north|||garden']).toBeDefined();
        expect(parchmentAssist.npcProfiler.npcProfiles.troll.description).toBe('Nasty troll');
        expect(parchmentAssist.gameStateManager.structuredGameState.quests).toEqual([
            'Defeat troll',
        ]);
        expect(parchmentAssist.gameStateManager.turnCount).toBe(25);
        expect(parchmentAssist.gameStateManager.commandHistory).toEqual(['attack troll']);
        expect(parchmentAssist.gameStateManager.rejectedCommands.get('pet troll')).toBe(1);

        // Verify storage was re-saved
        expect(storageData['map_Zork']).toEqual(snapshot.map);
        expect(storageData['npc_Zork']).toEqual(snapshot.npcs);
        expect(storageData['meta_Zork']).toEqual(snapshot.meta);
    });

    test('_applySnapshot handles legacy map format (plain graph object)', async () => {
        parchmentAssist.gameStateManager.rawGameState.gameTitle = 'Zork';
        parchmentAssist.gameStateManager.structuredGameState = { quests: [] };

        const snapshot = {
            map: {
                cellar: {
                    displayName: 'Cellar',
                    items: ['sword'],
                    exits: {},
                    isDeleted: false,
                },
            },
            npcs: {},
            quests: [],
            meta: { turnCount: 1, commandHistory: [], rejectedCommands: [] },
        };

        await parchmentAssist._applySnapshot(snapshot);

        expect(parchmentAssist.mapManager.graph['cellar']).toBeDefined();
        expect(parchmentAssist.mapManager.traversed.size).toBe(0);
    });

    test('handleMessages responds to getStateSnapshot', () => {
        parchmentAssist.mapManager.addRoom('Garden', { items: [], exits: {} });
        parchmentAssist.gameStateManager.turnCount = 5;

        let response;
        parchmentAssist.handleMessages({ action: 'getStateSnapshot' }, {}, (r) => {
            response = r;
        });

        expect(response.success).toBe(true);
        expect(response.snapshot).toBeDefined();
        expect(response.snapshot.map.graph['garden']).toBeDefined();
        expect(response.snapshot.meta.turnCount).toBe(5);
    });
});
