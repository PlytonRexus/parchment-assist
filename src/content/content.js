// Parchment-Assist Content Script
// Orchestrator: wires together UIManager, GameStateManager, CommandExecutor, MapManager, NpcProfiler

import { NpcProfiler } from '../lib/npc.js';
import { MapManager } from '../lib/mapManager.js';
import { UIManager } from '../ui/uiManager.js';
import { GameStateManager } from './gameStateManager.js';
import { CommandExecutor } from './commandExecutor.js';

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

        this.uiManager = new UIManager({
            npcProfiler: this.npcProfiler,
            mapManager: this.mapManager,
            onCommandSubmit: (item) => this.commandExecutor.appendToInput(item),
            onChoiceSubmit: (choice) => this.handleChoiceSubmit(choice),
            onRefresh: () => this.handleRefresh(),
            onClearJournal: () => this.gameStateManager.clearJournal(),
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
                this.debounceTimer = setTimeout(() => {
                    this.gameStateManager.extractRawGameState().then(() => {
                        this.requestSuggestions();
                    });
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

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSuggestions',
                gameState: this.gameStateManager.rawGameState,
                force: force,
            });

            if (response && response.success) {
                this.gameStateManager.structuredGameState = response.structuredState;
                this.npcProfiler.updateProfiles(
                    this.gameStateManager.structuredGameState.npcProfiles
                );
                if (this.gameStateManager.structuredGameState.mapData) {
                    const lastCommand =
                        this.gameStateManager.commandHistory.length > 0
                            ? this.gameStateManager.commandHistory[
                                  this.gameStateManager.commandHistory.length - 1
                              ]
                            : null;
                    this.mapManager.updateMap(
                        this.gameStateManager.structuredGameState.mapData,
                        this.previousRoom,
                        lastCommand
                    );
                    this.uiManager.renderMap();
                }
                this.previousRoom = this.gameStateManager.structuredGameState.location;
                await this.gameStateManager.mergeQuests();
                this.uiManager.updateCommandPalette(
                    this.gameStateManager.structuredGameState,
                    this.gameStateManager.turnCount
                );
            } else {
                this.uiManager.showError(
                    'Failed to get structured state: ' + (response?.error || 'Unknown error')
                );
            }
        } catch (error) {
            this.log('Error requesting structured state:', error);
            this.uiManager.showError('Connection error');
        } finally {
            this.uiManager.showLoadingState(false);
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
