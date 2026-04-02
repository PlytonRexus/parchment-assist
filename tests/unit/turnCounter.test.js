import { ParchmentAssist } from '../../src/content/content.js';

describe('Turn Counter', () => {
    let assist;

    beforeEach(() => {
        // Setup minimal DOM to prevent initialization errors
        document.body.innerHTML = `
      <div id="gameport">
        <div class="BufferLine">Test game text</div>
      </div>
      <input type="text" id="input" />
    `;

        assist = new ParchmentAssist();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize turnCount to 0', () => {
        expect(assist.turnCount).toBe(0);
    });

    it('should increment turnCount directly', () => {
        // Test the turn counter logic directly
        expect(assist.turnCount).toBe(0);

        assist.turnCount++;
        expect(assist.turnCount).toBe(1);

        assist.turnCount++;
        expect(assist.turnCount).toBe(2);
    });
});
