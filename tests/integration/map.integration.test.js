import { ParchmentAssist } from '../../src/content/content.js';
import { MapManager } from '../../src/lib/mapManager.js';
import { LLMService } from '../../src/background/service-worker.js';

describe('ParchmentAssist and MapManager Integration', () => {
    let parchmentAssist;

    beforeEach(() => {
        // Setup complete DOM to prevent initialization errors
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        parchmentAssist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('ParchmentAssist should instantiate MapManager', () => {
        expect(parchmentAssist.mapManager).toBeInstanceOf(MapManager);
        expect(parchmentAssist.mapManager.graph).toBeDefined();
    });

    test('should update map when updateMap is called with mapData', () => {
        const mockMapData = {
            roomName: 'Troll Room',
            exits: [{ direction: 'west', room: 'Cellar' }],
        };

        // Simulate receiving map data
        parchmentAssist.mapManager.addRoom('Troll Room', { exits: mockMapData.exits });

        // Verify that the room was added
        const room = parchmentAssist.mapManager.getRoom('Troll Room');
        expect(room).toBeDefined();
        expect(room.exits).toEqual(mockMapData.exits);
    });
});

describe('LLMService and Map Data Integration', () => {
    let llmService;

    beforeEach(() => {
        llmService = new LLMService();
    });

    test('extractStructuredState should return mapData structure', async () => {
        const mockGameState = {
            gameTitle: 'Zork',
            gameText: 'You are in a troll room. A nasty-looking troll is here.',
        };

        const mockProviderResponse = {
            location: 'Troll Room',
            inventory: [],
            objects: ['nasty-looking troll'],
            npcs: ['troll'],
            exits: [{ direction: 'west', room: 'Cellar' }],
            verbs: ['ATTACK', 'LOOK'],
            room_description: 'You are in a troll room. A nasty-looking troll is here.',
            quests: [],
            npcProfiles: {},
            suggestedActions: [],
            mapData: {
                roomName: 'Troll Room',
                exits: [{ direction: 'west', room: 'Cellar' }],
            },
        };

        // Mock the provider call manually
        const originalMethod = llmService.callProviderForState;
        llmService.callProviderForState = async () => mockProviderResponse;

        const structuredState = await llmService.extractStructuredState(mockGameState);

        // Restore original method
        llmService.callProviderForState = originalMethod;

        expect(structuredState).toBeDefined();
        expect(structuredState.mapData).toBeDefined();
        expect(structuredState.mapData.roomName).toBe('Troll Room');
        expect(structuredState.mapData.exits).toHaveLength(1);
        expect(structuredState.mapData.exits[0].direction).toBe('west');
    });
});
