// Parchment-Assist Content Script
// Orchestrator: wires together UIManager, GameStateManager, CommandExecutor, MapManager, NpcProfiler

import { NpcProfiler } from '../lib/npc.js';
import { MapManager } from '../lib/mapManager.js';
import { UIManager } from '../ui/uiManager.js';
import { GameStateManager } from './gameStateManager.js';
import { CommandExecutor } from './commandExecutor.js';
import { ParserFeedbackDetector } from '../helpers/parserFeedback.js';
import { StuckDetector } from '../lib/stuckDetector.js';

class ParchmentAssist {
    constructor() {
        this.npcProfiler = new NpcProfiler();
        this.mapManager = new MapManager();
        this.gameStateManager = new GameStateManager();

        // Arrow functions ensure late-bound this references resolve correctly at call time
        this.commandExecutor = new CommandExecutor({
            findInputField: () => this.gameStateManager.findInputField(),
            onError: (msg) => this.uiManager.showError(msg),
        });

        this.stuckDetector = new StuckDetector();
        this._hintLevel = 0;
        this._lastRejected = false;
        this._hintToastShown = false;

        this.uiManager = new UIManager({
            npcProfiler: this.npcProfiler,
            mapManager: this.mapManager,
            onCommandSubmit: (item) => this.commandExecutor.appendToInput(item),
            onChoiceSubmit: (choice) => this.handleChoiceSubmit(choice),
            onRefresh: () => this.handleRefresh(),
            onClearJournal: () => this.gameStateManager.clearJournal(),
            onGetHint: () => this._requestHint(),
        });

        this.isActive = false;
        this.debounceTimer = null;
        this.mutationObserver = null;
        this.previousRoom = null;

        this.init();
    }

    init() {
        this.log('ParchmentAssist class instantiated');
        if (this.gameStateManager.isParchmentPage()) {
            this.log('Parchment page detected, initializing...');
            this.waitForParchmentReady();
        } else {
            this.log('Not a Parchment page, stopping.');
        }
    }

    handleMessages(request, sender, sendResponse) {
        this.log('Message received in handleMessages:', request);
        if (request.action === 'getGameState') {
            this.gameStateManager.extractRawGameState().then((rawGameState) => {
                sendResponse({ success: true, gameState: rawGameState });
            });
            return true;
        }
    }

    waitForParchmentReady() {
        this.log('Waiting for Parchment to be ready...');
        const checkReady = () => {
            const inputField = this.gameStateManager.findInputField();
            const outputArea = this.gameStateManager.findOutputArea();
            if (inputField && outputArea) {
                this.log('Parchment ready, starting assist');
                this.startAssist();
            } else {
                this.log('Parchment not ready, checking again in 1 second...');
                setTimeout(checkReady, 1000);
            }
        };
        checkReady();
    }

    async startAssist() {
        this.log('Starting assist...');
        this.isActive = true;
        this.uiManager.createCommandPalette();
        await this._loadMapFromStorage();
        this.setupEventListeners();
        this.startObservingChanges();
        this.log('Parchment-Assist started successfully');
        await this.checkFirstRun();
    }

    setupEventListeners() {
        const inputField = this.gameStateManager.findInputField();
        if (!inputField) {
            return;
        }

        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.gameStateManager.recordCommand(e.target.value.trim());
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.requestSuggestions();
                }, 1500);
            }
        });

        inputField.addEventListener('focus', () => {
            const palette = this.uiManager.commandPalette;
            if (palette) {
                palette.style.display = 'block';
            }
        });

        document.addEventListener('keydown', (e) => {
            const palette = this.uiManager.commandPalette;
            if (!palette || palette.style.display === 'none') {
                return;
            }

            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return;
            }

            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                const activeTab = palette.querySelector('.tab-button.active');
                if (!activeTab) {
                    return;
                }
                const tabName = activeTab.dataset.tab;
                let items = [];
                if (tabName === 'actions') {
                    items = Array.from(palette.querySelectorAll('#palette-actions .palette-item'));
                } else if (tabName === 'main') {
                    items = Array.from(
                        palette.querySelectorAll(
                            '#palette-objects .palette-item, #palette-npcs .palette-item, #palette-exits .palette-item, #palette-verbs .palette-item'
                        )
                    );
                }
                if (items[index]) {
                    items[index].click();
                    items[index].style.background = '#3498db';
                    setTimeout(() => {
                        items[index].style.background = '';
                    }, 200);
                }
            }

            if (e.altKey && e.key === '0') {
                e.preventDefault();
                this.uiManager.togglePalette();
            }

            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                const refreshBtn = palette.querySelector('#palette-refresh-btn');
                if (refreshBtn) {
                    refreshBtn.click();
                }
            }
        });
    }

    startObservingChanges() {
        const outputArea = this.gameStateManager.findOutputArea();
        if (!outputArea) {
            return;
        }

        this.mutationObserver = new MutationObserver((mutations) => {
            let textChanged = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    textChanged = true;
                }
            });
            if (textChanged) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(async () => {
                    await this.gameStateManager.extractRawGameState();
                    const gameText = this.gameStateManager.rawGameState.gameText || '';
                    const lastCommand =
                        this.gameStateManager.commandHistory[
                            this.gameStateManager.commandHistory.length - 1
                        ] || '';
                    const feedback = ParserFeedbackDetector.detect(gameText.slice(-500));
                    this._lastRejected = feedback.rejected;
                    if (feedback.rejected && lastCommand) {
                        this._requestRephrase(lastCommand, feedback.message);
                    }
                    this.requestSuggestions();
                }, 2000);
            }
        });

        this.mutationObserver.observe(outputArea, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    async requestSuggestions(force = false) {
        if (!this.isActive) {
            return;
        }

        this.uiManager.showLoadingState(true);
        this.uiManager.updateLoadingText('Analyzing...');

        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.connect) {
                await this._requestViaStreamingPort(force);
            } else {
                await this._requestViaMessage(force);
            }
        } catch (error) {
            this.log('Error requesting structured state:', error);
            this.uiManager.showError('Connection error');
        } finally {
            this.uiManager.showLoadingState(false);
        }
    }

    _requestViaStreamingPort(force) {
        return new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({ name: 'streaming' });
            let settled = false;

            const settle = (fn) => {
                if (!settled) {
                    settled = true;
                    fn();
                }
            };

            port.onMessage.addListener((msg) => {
                if (msg.type === 'progress') {
                    this.uiManager.updateLoadingText(msg.stage);
                } else if (msg.type === 'done') {
                    port.disconnect();
                    this._applyStructuredState(msg.structuredState)
                        .then(() => settle(resolve))
                        .catch((err) => settle(() => reject(err)));
                } else if (msg.type === 'error') {
                    port.disconnect();
                    this.uiManager.showError(
                        'Failed to get suggestions: ' + (msg.error || 'Unknown error')
                    );
                    settle(resolve);
                }
            });

            port.onDisconnect.addListener(() => {
                const err = chrome.runtime?.lastError;
                if (err) {
                    settle(() => reject(new Error(err.message)));
                } else {
                    settle(resolve);
                }
            });

            port.postMessage({
                action: 'getSuggestionsStreaming',
                gameState: this.gameStateManager.rawGameState,
                force,
            });
        });
    }

    async _requestViaMessage(force) {
        const response = await chrome.runtime.sendMessage({
            action: 'getSuggestions',
            gameState: this.gameStateManager.rawGameState,
            force,
        });

        if (response && response.success) {
            await this._applyStructuredState(response.structuredState || {});
        } else {
            this.uiManager.showError(
                'Failed to get structured state: ' + (response?.error || 'Unknown error')
            );
        }
    }

    async _applyStructuredState(structuredState) {
        this.gameStateManager.structuredGameState = structuredState;
        this.npcProfiler.updateProfiles(structuredState.npcProfiles);
        if (structuredState.mapData) {
            const lastCommand =
                this.gameStateManager.commandHistory.length > 0
                    ? this.gameStateManager.commandHistory[
                          this.gameStateManager.commandHistory.length - 1
                      ]
                    : null;
            this.mapManager.updateMap(structuredState.mapData, this.previousRoom, lastCommand);
            this.uiManager.renderMap();
            this._saveMapToStorage();
        }
        this.previousRoom = structuredState.location;
        this.uiManager.setCurrentRoom(structuredState.location);
        await this.gameStateManager.mergeQuests();
        this.uiManager.updateCommandPalette(structuredState, this.gameStateManager.turnCount);

        // Stuck detection
        const lastCmd =
            this.gameStateManager.commandHistory[this.gameStateManager.commandHistory.length - 1] ||
            null;
        this.stuckDetector.update({
            room: structuredState.location || null,
            inventory: structuredState.inventory || [],
            command: lastCmd,
            wasRejected: this._lastRejected,
        });

        const stuckLevel = this.stuckDetector.getStuckLevel();

        if (stuckLevel === 0 && this._hintLevel > 0) {
            this._hintLevel = 0;
            this.uiManager.clearHintSection();
            this._hintToastShown = false;
        }

        if (stuckLevel >= 2 && !this._hintToastShown) {
            this.uiManager.showStatus('Need a hint? Click the \ud83d\udca1 button.', 'info');
            this._hintToastShown = true;
        }
    }

    handleChoiceSubmit(choice) {
        this.gameStateManager.recordCommand(choice);
        this.commandExecutor.submitCommand(choice);
    }

    async handleRefresh() {
        await this.gameStateManager.extractRawGameState(true);
        await this.requestSuggestions(true);
        this.uiManager.showStatus('Suggestions refreshed!', 'success');
    }

    async _requestRephrase(failedCommand, rejectionMessage) {
        try {
            const gameText = this.gameStateManager.rawGameState.gameText || '';
            const response = await chrome.runtime.sendMessage({
                action: 'rephraseCommand',
                failedCommand,
                rejectionMessage,
                gameText: gameText.slice(-500),
            });
            if (response && response.success && response.alternatives.length > 0) {
                this.uiManager.showRephraseAlternatives(response.alternatives);
            }
        } catch (_error) {
            // Rephrase failed silently — not critical
        }
    }

    async _requestHint() {
        if (this._hintLevel >= 3) {
            return;
        }
        const nextLevel = this._hintLevel + 1;
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getHint',
                rawGameState: this.gameStateManager.rawGameState,
                structuredGameState: this.gameStateManager.structuredGameState,
                hintLevel: nextLevel,
            });
            if (response?.success) {
                this._hintLevel = nextLevel;
                this.uiManager.showHint(response.hint, nextLevel);
            } else {
                this.uiManager.showError('Could not get hint. Please try again.');
            }
        } catch {
            this.uiManager.showError('Could not get hint. Please try again.');
        }
    }

    async checkAIConfiguration() {
        try {
            const settings = await chrome.storage.sync.get([
                'geminiKey',
                'preferLocal',
                'activeProviders',
            ]);
            const hasGemini =
                settings.activeProviders?.includes('gemini') &&
                settings.geminiKey &&
                settings.geminiKey.trim() !== '';
            const hasOllama = settings.activeProviders?.includes('ollama');
            return {
                configured: hasGemini || hasOllama,
                provider:
                    hasGemini && !settings.preferLocal ? 'gemini' : hasOllama ? 'ollama' : null,
                hasGemini,
                hasOllama,
            };
        } catch (error) {
            this.log('Error checking AI configuration:', error);
            return { configured: false, provider: null, hasGemini: false, hasOllama: false };
        }
    }

    async checkFirstRun() {
        try {
            const result = await chrome.storage.sync.get(['hasSeenOnboarding']);
            if (!result.hasSeenOnboarding) {
                setTimeout(async () => {
                    const aiStatus = await this.checkAIConfiguration();
                    this.uiManager.showOnboarding(aiStatus, () => this.checkAIConfiguration());
                }, 1000);
            } else {
                const aiStatus = await this.checkAIConfiguration();
                if (!aiStatus.configured) {
                    this.uiManager.showConfigWarningBadge();
                }
            }
        } catch (error) {
            this.log('Error checking first run:', error);
        }
    }

    async _saveMapToStorage() {
        const gameTitle = this.gameStateManager.rawGameState.gameTitle;
        if (!gameTitle) {
            return;
        }
        try {
            const graphData = JSON.parse(JSON.stringify(this.mapManager.graph));
            await chrome.storage.local.set({ [`map_${gameTitle}`]: graphData });
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    async _loadMapFromStorage() {
        try {
            const gameTitle = document.title.replace(/ - Parchment/i, '').trim();
            if (!gameTitle) {
                return;
            }
            const key = `map_${gameTitle}`;
            const result = await chrome.storage.local.get([key]);
            if (result[key]) {
                this.mapManager.graph = result[key];
                this.uiManager.renderMap();
            }
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    destroy() {
        this.isActive = false;
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        this.uiManager.destroy();
        clearTimeout(this.debounceTimer);
        this.log('Parchment-Assist stopped');
    }

    log(message, ...args) {
        console.log('[Parchment-Assist]', message, ...args);
    }
}

// Export for testing
export { ParchmentAssist };

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.parchmentAssist = new ParchmentAssist();
        } catch (error) {
            console.error('[Parchment-Assist] Initialization failed:', error);
        }
    });
} else {
    try {
        window.parchmentAssist = new ParchmentAssist();
    } catch (error) {
        console.error('[Parchment-Assist] Initialization failed:', error);
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.parchmentAssist) {
        window.parchmentAssist.destroy();
    }
});

// Global message listener (only in extension environment)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (window.parchmentAssist && typeof window.parchmentAssist.handleMessages === 'function') {
            return window.parchmentAssist.handleMessages(request, sender, sendResponse);
        }
        return false;
    });
}
