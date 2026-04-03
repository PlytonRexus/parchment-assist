import { GameStateManager } from '../../src/content/gameStateManager.js';

describe('Turn Counter', () => {
    let gsm;

    beforeEach(() => {
        gsm = new GameStateManager();
    });

    it('should initialize turnCount to 0', () => {
        expect(gsm.turnCount).toBe(0);
    });

    it('should increment turnCount directly', () => {
        // Test the turn counter logic directly
        expect(gsm.turnCount).toBe(0);

        gsm.turnCount++;
        expect(gsm.turnCount).toBe(1);

        gsm.turnCount++;
        expect(gsm.turnCount).toBe(2);
    });
});
