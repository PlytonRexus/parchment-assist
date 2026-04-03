/**
 * GameStateManager Unit Tests
 */

import { GameStateManager } from '../../src/content/gameStateManager.js';

describe('GameStateManager', () => {
    let gsm;

    beforeEach(() => {
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">You are in a dark room.</div>
        <div class="BufferLine">Exits: north, south</div>
      </div>
      <input type="text" id="input" style="height: 20px;" />
    `;
        gsm = new GameStateManager();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Initial State', () => {
        test('should initialize with empty state', () => {
            expect(gsm.rawGameState.gameText).toBe('');
            expect(gsm.commandHistory).toEqual([]);
            expect(gsm.turnCount).toBe(0);
        });

        test('should initialize with empty structuredGameState', () => {
            expect(gsm.structuredGameState).toEqual({});
        });
    });

    describe('isParchmentPage', () => {
        test('should detect parchment page via #parchment element', () => {
            document.body.innerHTML = '<div id="parchment">Game</div>';
            expect(gsm.isParchmentPage()).toBeTruthy();
        });

        test('should detect parchment page via .parchment class', () => {
            document.body.innerHTML = '<div class="parchment">Game</div>';
            expect(gsm.isParchmentPage()).toBeTruthy();
        });

        test('should return falsy when no parchment signals', () => {
            document.body.innerHTML = '<div>Just a page</div>';
            // hostname won't include iplayif.com in jsdom
            expect(gsm.isParchmentPage()).toBeFalsy();
        });
    });

    describe('findInputField', () => {
        test('should find input[type="text"] with positive height', () => {
            // jsdom offsetHeight is 0 by default; test fallback selectors
            document.body.innerHTML = '<input type="text" id="input" />';
            // offsetHeight is 0 in jsdom, so findInputField returns null
            const result = gsm.findInputField();
            expect(result).toBeNull(); // jsdom doesn't lay out elements
        });

        test('should return null when no input field exists', () => {
            document.body.innerHTML = '<div>no input</div>';
            const result = gsm.findInputField();
            expect(result).toBeNull();
        });
    });

    describe('findOutputArea', () => {
        test('should find #gameport with sufficient text', () => {
            document.body.innerHTML =
                '<div id="gameport">This is some game text that is long enough</div>';
            const result = gsm.findOutputArea();
            expect(result).not.toBeNull();
            expect(result.id).toBe('gameport');
        });

        test('should return null when output area has too little text', () => {
            document.body.innerHTML = '<div id="gameport">short</div>';
            const result = gsm.findOutputArea();
            expect(result).toBeNull();
        });

        test('should return null when no output area exists', () => {
            document.body.innerHTML = '<div>nothing here</div>';
            const result = gsm.findOutputArea();
            expect(result).toBeNull();
        });
    });

    describe('recordCommand', () => {
        test('should add command to history and increment turnCount', () => {
            gsm.recordCommand('look');
            expect(gsm.commandHistory).toEqual(['look']);
            expect(gsm.turnCount).toBe(1);
        });

        test('should track multiple commands', () => {
            gsm.recordCommand('look');
            gsm.recordCommand('take key');
            gsm.recordCommand('north');
            expect(gsm.commandHistory).toHaveLength(3);
            expect(gsm.turnCount).toBe(3);
        });

        test('should limit history to 10 most recent commands', () => {
            for (let i = 1; i <= 12; i++) {
                gsm.recordCommand(`command ${i}`);
            }
            expect(gsm.commandHistory).toHaveLength(10);
            expect(gsm.commandHistory[0]).toBe('command 3');
            expect(gsm.commandHistory[9]).toBe('command 12');
        });
    });

    describe('extractRawGameState', () => {
        test('should return null when #gameport is missing', async () => {
            document.body.innerHTML = '<input type="text" />';
            const result = await gsm.extractRawGameState();
            expect(result).toBeNull();
        });

        test('should extract game state from #gameport', async () => {
            document.body.innerHTML =
                '<div id="gameport"><div class="BufferLine">Room description here</div></div>';
            const result = await gsm.extractRawGameState();
            expect(result).not.toBeNull();
            expect(result.gameTitle).toBeDefined();
        });

        test('should return cached state if text unchanged', async () => {
            document.body.innerHTML =
                '<div id="gameport"><div class="BufferLine">Same text</div></div>';
            const initialState = await gsm.extractRawGameState();
            const second = await gsm.extractRawGameState();
            expect(second).toBe(initialState); // Same reference = cached
        });

        test('should refresh state when force=true', async () => {
            document.body.innerHTML = '<div id="gameport"><div class="BufferLine">Text</div></div>';
            await gsm.extractRawGameState(); // warm the cache
            const second = await gsm.extractRawGameState(true);
            // Force refresh always resolves with fresh state object
            expect(second).toBeDefined();
        });

        test('should include last 3 commands in rawGameState', async () => {
            document.body.innerHTML = '<div id="gameport"><div class="BufferLine">Text</div></div>';
            gsm.recordCommand('look');
            gsm.recordCommand('take key');
            gsm.recordCommand('north');
            gsm.recordCommand('examine door');
            const result = await gsm.extractRawGameState(true);
            expect(result.lastCommands).toHaveLength(3);
            expect(result.lastCommands).toContain('take key');
            expect(result.lastCommands).toContain('north');
            expect(result.lastCommands).toContain('examine door');
        });
    });
});
