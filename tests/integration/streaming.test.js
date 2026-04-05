/**
 * Streaming Integration Tests
 * Covers rate-limiting interactions with streaming and core streaming behaviour.
 */

import { jest } from '@jest/globals';
import { LLMService } from '../../src/background/service-worker.js';

describe('Streaming Integration', () => {
    let llmService;

    beforeEach(() => {
        llmService = new LLMService();
    });

    // ── Rate limiting × streaming ────────────────────────────────────────────

    describe('Rate limiting × streaming', () => {
        it('tryOllama throws rate-limit error when limiter is exhausted', async () => {
            llmService._ollamaRateLimiter.consume = () => false;
            await expect(llmService.tryOllama('prompt', (x) => x)).rejects.toThrow(
                'Rate limited: Ollama'
            );
        });

        it('tryGemini throws rate-limit error when limiter is exhausted', async () => {
            llmService._geminiRateLimiter.consume = () => false;
            await expect(llmService.tryGemini('prompt', (x) => x)).rejects.toThrow(
                'Rate limited: Gemini'
            );
        });

        it('callProviderForStateStreaming falls back to Gemini when Ollama is rate-limited', async () => {
            // Exhaust Ollama tokens
            llmService._ollamaRateLimiter.consume = () => false;

            llmService.settings.activeProviders = ['ollama', 'gemini'];
            llmService.settings.geminiKey = 'test-key';
            llmService.settings.preferLocal = true;

            const geminiCalled = { value: false };
            llmService.tryGeminiStreaming = async (_prompt, onChunk) => {
                geminiCalled.value = true;
                onChunk('{}');
                return '{}';
            };
            llmService.tryOllamaStreaming = async () => {
                throw new Error('Rate limited: Ollama (30 req/min exceeded)');
            };

            const gameState = { gameTitle: 'T', gameText: 'x', lastCommands: [] };
            await llmService.extractStructuredStateStreaming(gameState, null).catch(() => {});
            expect(geminiCalled.value).toBe(true);
        });
    });

    // ── detectStreamingStage smoke tests ────────────────────────────────────

    describe('detectStreamingStage', () => {
        it('returns "Analyzing..." for empty input', () => {
            expect(llmService.detectStreamingStage('')).toBe('Analyzing...');
        });

        it('returns location stage label when location key is present', () => {
            expect(llmService.detectStreamingStage('{"location"')).toBe('Identifying location...');
        });

        it('returns suggested-actions label as highest priority', () => {
            const text = '{"location":"r","suggestedActions"';
            expect(llmService.detectStreamingStage(text)).toBe('Generating suggested actions...');
        });
    });

    // ── Full streaming round-trip ────────────────────────────────────────────

    describe('Full streaming round-trip', () => {
        it('extractStructuredStateStreaming calls onProgress and returns valid state', async () => {
            const fullJson = JSON.stringify({
                location: 'Hall',
                inventory: [],
                objects: ['lamp'],
                npcs: [],
                exits: [{ direction: 'north', room: 'Garden' }],
                verbs: ['examine'],
                room_description: 'A hall.',
                quests: [],
                suggestedActions: ['go north'],
                npcProfiles: {},
                mapData: { roomName: 'Hall', exits: [{ direction: 'north', room: 'Garden' }] },
                interactables: [],
            });

            llmService.callProviderForStateStreaming = async (_prompt, onChunk) => {
                onChunk(fullJson);
                return fullJson;
            };

            const progressCalls = [];
            const gameState = { gameTitle: 'G', gameText: 'text', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, (p) =>
                progressCalls.push(p)
            );

            expect(progressCalls.length).toBeGreaterThan(0);
            expect(result.location).toBe('Hall');
            expect(result.objects).toContain('lamp');
        });

        it('returns empty state when provider returns null', async () => {
            llmService.callProviderForStateStreaming = async () => null;

            const gameState = { gameTitle: 'G', gameText: 'text', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(result.location).toBe('');
            expect(result.suggestedActions).toEqual([]);
        });

        it('validates and normalizes state returned from stream (confidence clamping)', async () => {
            const raw = JSON.stringify({
                location: 'Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                room_description: '',
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
                mapData: { roomName: 'Room', exits: [] },
                interactables: [
                    {
                        name: 'coin',
                        type: 'object',
                        actions: [{ command: 'take coin', label: 'Take', confidence: 9.9 }],
                    },
                ],
            });

            llmService.callProviderForStateStreaming = async (_prompt, onChunk) => {
                onChunk(raw);
                return raw;
            };

            const gameState = { gameTitle: 'G', gameText: 'text', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(result.interactables[0].actions[0].confidence).toBe(1);
        });
    });

    // ── Rate limiter on streaming (Gemini) ──────────────────────────────────

    describe('Rate limiter on streaming (Gemini)', () => {
        it('tryGeminiStreaming calls _geminiRateLimiter.consume() and throws when exhausted', async () => {
            const consumeSpy = jest.fn(() => false);
            llmService._geminiRateLimiter.consume = consumeSpy;
            llmService.settings.geminiKey = 'test-key';

            await expect(llmService.tryGeminiStreaming('prompt', null)).rejects.toThrow(
                'Rate limited: Gemini'
            );
            expect(consumeSpy).toHaveBeenCalledTimes(1);
        });

        it('tryGeminiStreaming proceeds when rate limiter has tokens', async () => {
            const consumeSpy = jest.fn(() => true);
            llmService._geminiRateLimiter.consume = consumeSpy;
            llmService.settings.geminiKey = 'test-key';

            // Mock fetch to return a valid streaming response
            const originalFetch = globalThis.fetch;
            const sseData = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"location":"Room"}' }] } }] })}\n\n`;
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                body: {
                    getReader() {
                        let sent = false;
                        return {
                            async read() {
                                if (sent) {
                                    return { done: true, value: undefined };
                                }
                                sent = true;
                                return { done: false, value: Buffer.from(sseData) };
                            },
                        };
                    },
                },
            });

            const result = await llmService.tryGeminiStreaming('prompt', null);
            expect(consumeSpy).toHaveBeenCalledTimes(1);
            expect(result).toBe('{"location":"Room"}');

            globalThis.fetch = originalFetch;
        });
    });

    // ── No double-call on 429 ───────────────────────────────────────────────

    describe('No double-call on 429', () => {
        it('extractStructuredStateStreaming does NOT call callProviderForState on 429', async () => {
            llmService.settings.activeProviders = ['gemini'];
            llmService.settings.geminiKey = 'test-key';

            // Make streaming throw a 429 error
            llmService.callProviderForStateStreaming = async () => {
                throw new Error('Gemini streaming API error: 429');
            };

            // Spy on callProviderForState — it should NOT be called
            const nonStreamingSpy = jest.fn();
            llmService.callProviderForState = nonStreamingSpy;

            const gameState = { gameTitle: 'T', gameText: 'x', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(nonStreamingSpy).not.toHaveBeenCalled();
            // Should return empty state since rate-limited
            expect(result.location).toBe('');
        });

        it('extractStructuredStateStreaming does NOT call callProviderForState on "Rate limited" error', async () => {
            llmService.settings.activeProviders = ['gemini'];
            llmService.settings.geminiKey = 'test-key';

            llmService.callProviderForStateStreaming = async () => {
                throw new Error('Rate limited: Gemini (10 req/min exceeded)');
            };

            const nonStreamingSpy = jest.fn();
            llmService.callProviderForState = nonStreamingSpy;

            const gameState = { gameTitle: 'T', gameText: 'x', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(nonStreamingSpy).not.toHaveBeenCalled();
            expect(result.location).toBe('');
        });

        it('extractStructuredStateStreaming does NOT call callProviderForState on backoff error', async () => {
            llmService.settings.activeProviders = ['gemini'];
            llmService.settings.geminiKey = 'test-key';

            llmService.callProviderForStateStreaming = async () => {
                throw new Error('Gemini in backoff');
            };

            const nonStreamingSpy = jest.fn();
            llmService.callProviderForState = nonStreamingSpy;

            const gameState = { gameTitle: 'T', gameText: 'x', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(nonStreamingSpy).not.toHaveBeenCalled();
            expect(result.location).toBe('');
        });

        it('extractStructuredStateStreaming DOES fall back to callProviderForState on non-rate-limit errors', async () => {
            llmService.settings.activeProviders = ['gemini'];
            llmService.settings.geminiKey = 'test-key';

            // Streaming returns null (non-rate-limit failure)
            llmService.callProviderForStateStreaming = async () => null;

            const mockResponse = {
                location: 'Fallback Room',
                inventory: [],
                objects: [],
                npcs: [],
                exits: [],
                verbs: [],
                room_description: '',
                quests: [],
                suggestedActions: [],
                npcProfiles: {},
                mapData: { roomName: 'Fallback Room', exits: [] },
                interactables: [],
            };
            llmService.callProviderForState = jest.fn(async () => mockResponse);

            const gameState = { gameTitle: 'T', gameText: 'x', lastCommands: [] };
            const result = await llmService.extractStructuredStateStreaming(gameState, null);

            expect(llmService.callProviderForState).toHaveBeenCalledTimes(1);
            expect(result.location).toBe('Fallback Room');
        });
    });

    // ── Model fallback on 429 ───────────────────────────────────────────────

    describe('Model fallback on 429', () => {
        it('_advanceGeminiOnRateLimit advances model index with single key', () => {
            llmService.settings.geminiKeys = ['key1'];
            llmService._geminiKeyIndex = 0;
            llmService._geminiModelIndex = 0;

            const result = llmService._advanceGeminiOnRateLimit();

            expect(result).toBe(true);
            expect(llmService._geminiModelIndex).toBe(1);
            expect(llmService._geminiKeyIndex).toBe(0);
        });

        it('_advanceGeminiOnRateLimit follows GEMINI_MODELS fallback order', () => {
            llmService.settings.geminiKeys = ['key1'];
            const expectedModels = LLMService.GEMINI_MODELS;

            for (let i = 0; i < expectedModels.length - 1; i++) {
                expect(llmService._getGeminiModel()).toBe(expectedModels[i]);
                llmService._advanceGeminiOnRateLimit();
            }

            // After advancing through all but the last, we should be at the last model
            expect(llmService._getGeminiModel()).toBe(expectedModels[expectedModels.length - 1]);
        });

        it('_advanceGeminiOnRateLimit returns false when all models are exhausted', () => {
            llmService.settings.geminiKeys = ['key1'];
            // Set to the last model index
            llmService._geminiModelIndex = LLMService.GEMINI_MODELS.length - 1;

            const result = llmService._advanceGeminiOnRateLimit();

            expect(result).toBe(false);
        });

        it('tryGeminiStreaming calls _advanceGeminiOnRateLimit on 429 response', async () => {
            llmService.settings.geminiKey = 'key';
            llmService.settings.geminiKeys = ['key'];
            llmService._geminiModelIndex = 0;

            const originalFetch = globalThis.fetch;
            globalThis.fetch = async () => ({ ok: false, status: 429 });

            const advanceSpy = jest.fn(() => true);
            llmService._advanceGeminiOnRateLimit = advanceSpy;

            await expect(llmService.tryGeminiStreaming('prompt', null)).rejects.toThrow(
                'Gemini streaming API error: 429'
            );
            expect(advanceSpy).toHaveBeenCalledTimes(1);

            globalThis.fetch = originalFetch;
        });
    });

    // ── Backoff after all models exhausted ───────────────────────────────────

    describe('Backoff after all models exhausted', () => {
        it('sets _geminiBackoffUntil in the future when all models exhausted', () => {
            llmService.settings.geminiKeys = ['key1'];
            // Set to the last model
            llmService._geminiModelIndex = LLMService.GEMINI_MODELS.length - 1;

            const before = Date.now();
            llmService._advanceGeminiOnRateLimit();
            const after = Date.now();

            expect(llmService._geminiBackoffUntil).toBeGreaterThan(before);
            // Backoff exponent starts at 1 → 2^1 = 2 seconds
            expect(llmService._geminiBackoffUntil).toBeGreaterThanOrEqual(before + 2000);
            expect(llmService._geminiBackoffUntil).toBeLessThanOrEqual(after + 2000 + 100);
        });

        it('increases backoff exponent on successive exhaustions', () => {
            llmService.settings.geminiKeys = ['key1'];

            // First exhaustion
            llmService._geminiModelIndex = LLMService.GEMINI_MODELS.length - 1;
            llmService._advanceGeminiOnRateLimit();
            const firstBackoff = llmService._geminiBackoff;

            // Reset model index to simulate another round of failures
            llmService._geminiModelIndex = LLMService.GEMINI_MODELS.length - 1;
            llmService._advanceGeminiOnRateLimit();
            const secondBackoff = llmService._geminiBackoff;

            expect(secondBackoff).toBeGreaterThan(firstBackoff);
        });

        it('caps backoff exponent at 6 (64 seconds)', () => {
            llmService.settings.geminiKeys = ['key1'];

            // Exhaust many times to hit the cap
            for (let i = 0; i < 10; i++) {
                llmService._geminiModelIndex = LLMService.GEMINI_MODELS.length - 1;
                llmService._advanceGeminiOnRateLimit();
            }

            expect(llmService._geminiBackoff).toBe(6);
        });

        it('tryGeminiStreaming throws "Gemini in backoff" when within backoff window', async () => {
            llmService.settings.geminiKey = 'key';
            llmService._geminiBackoffUntil = Date.now() + 60000; // 60 seconds in the future

            await expect(llmService.tryGeminiStreaming('prompt', null)).rejects.toThrow(
                'Gemini in backoff'
            );
        });

        it('_resetGeminiBackoff clears backoff state', () => {
            llmService._geminiBackoff = 5;
            llmService._geminiBackoffUntil = Date.now() + 30000;

            llmService._resetGeminiBackoff();

            expect(llmService._geminiBackoff).toBe(0);
            expect(llmService._geminiBackoffUntil).toBe(0);
        });
    });
});
