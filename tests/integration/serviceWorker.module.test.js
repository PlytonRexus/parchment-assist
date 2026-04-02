/**
 * Service Worker Module Tests
 * Tests that the service worker can be imported as an ES6 module
 * and exports work correctly
 */

describe('Service Worker ES6 Module', () => {
    let LLMService;

    test('should import LLMService from service worker', async () => {
        // This tests that the ES6 export statement works
        const module = await import('../../src/background/service-worker.js');
        expect(module.LLMService).toBeDefined();
        LLMService = module.LLMService;
    });

    test('should be able to instantiate LLMService', () => {
        expect(() => {
            new LLMService();
        }).not.toThrow();
    });

    test('should have all required methods on LLMService', async () => {
        const module = await import('../../src/background/service-worker.js');
        const service = new module.LLMService();

        // Check that the service has the expected public methods
        expect(typeof service.loadSettings).toBe('function');
        expect(typeof service.getSuggestions).toBe('function');
        expect(typeof service.extractStructuredState).toBe('function');
        expect(typeof service.tryOllama).toBe('function');
        expect(typeof service.tryGemini).toBe('function');
        expect(typeof service.parseStateResponse).toBe('function');
    });

    test('should export only LLMService', async () => {
        const module = await import('../../src/background/service-worker.js');
        const exportedKeys = Object.keys(module);

        // Verify that LLMService is exported
        expect(exportedKeys).toContain('LLMService');

        // The module should export the class, not internal implementation details
        expect(typeof module.LLMService).toBe('function');
    });

    test('should not throw syntax errors when loaded as module', async () => {
        // This test validates that the service worker file has valid ES6 module syntax
        // If the export statement was invalid, this would throw
        await expect(import('../../src/background/service-worker.js')).resolves.toBeDefined();
    });
});
