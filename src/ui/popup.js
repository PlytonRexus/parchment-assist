// Parchment-Assist Popup Script

class PopupManager {
    constructor() {
        this.init();
    }

    async init() {
        console.log('PopupManager init');
        await this.checkActiveTab();
        await this.updateStatus();
        await this.updateGameStateStatus();
        this.setupEventListeners();
    }

    async checkActiveTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabElement = document.getElementById('activeTab');

            if (tab.url.includes('iplayif.com') || tab.url.includes('parchment')) {
                tabElement.textContent = '✅ IF Game';
                tabElement.style.color = '#2ecc71';
            } else {
                tabElement.textContent = '❌ Not IF';
                tabElement.style.color = '#e74c3c';
            }
        } catch (error) {
            console.error('Failed to check active tab:', error);
            document.getElementById('activeTab').textContent = 'Error';
        }
    }

    async updateStatus() {
        console.log('Updating status...');
        const settings = await chrome.storage.sync.get(['activeProviders']);
        console.log('Retrieved settings:', settings);
        const activeProviders = settings.activeProviders || [];
        console.log('Active providers:', activeProviders);

        if (activeProviders.includes('ollama')) {
            console.log('Checking Ollama status...');
            this.checkOllamaStatus();
        }

        if (activeProviders.includes('gemini')) {
            console.log('Checking Gemini status...');
            this.checkGeminiStatus();
        }
    }

    async checkOllamaStatus() {
        const statusElement = document.getElementById('localStatus');
        const indicator = document.getElementById('localIndicator');
        if (!statusElement || !indicator) {
            return;
        }

        try {
            const response = await fetch('http://localhost:11434/api/tags', {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });

            if (response.ok) {
                // Try to parse response to ensure it's a valid Ollama endpoint
                await response.json();
                statusElement.firstChild.textContent = 'Connected ';
                indicator.className = 'indicator online';
            } else {
                throw new Error('Not responding');
            }
        } catch (_error) {
            statusElement.firstChild.textContent = 'Offline ';
            indicator.className = 'indicator offline';
        }
    }

    async checkGeminiStatus() {
        console.log('Checking Gemini status...');
        const statusElement = document.getElementById('cloudStatus');
        const indicator = document.getElementById('cloudIndicator');
        if (!statusElement || !indicator) {
            console.log('Gemini status elements not found');
            return;
        }

        try {
            const settings = await chrome.storage.sync.get(['geminiKey']);
            console.log('Retrieved Gemini key');
            if (settings.geminiKey && settings.geminiKey.trim()) {
                statusElement.firstChild.textContent = 'Key Set ';
                indicator.className = 'indicator online';
            } else {
                statusElement.firstChild.textContent = 'No Key ';
                indicator.className = 'indicator offline';
            }
        } catch (error) {
            console.error('Error checking Gemini status:', error);
            statusElement.firstChild.textContent = 'Error ';
            indicator.className = 'indicator offline';
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        document.getElementById('openOptions').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
            window.close();
        });

        document.getElementById('testConnection').addEventListener('click', async () => {
            console.log('Test Connection button clicked');
            // Refresh status
            await this.updateStatus();
        });

        document.getElementById('manualSuggest').addEventListener('click', async () => {
            console.log('Manual Suggest button clicked');
            await this.manualSuggest();
        });
    }

    async manualSuggest() {
        console.log('Requesting manual suggestions...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'getGameState' }, (response) => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(response);
                    });
                });

                if (response && response.success) {
                    console.log('Using game state:', response.gameState);
                    const suggestionsResponse = await chrome.runtime.sendMessage({
                        action: 'getSuggestions',
                        gameState: response.gameState,
                    });
                    console.log('Received response from service worker:', suggestionsResponse);
                    if (
                        suggestionsResponse &&
                        suggestionsResponse.success &&
                        suggestionsResponse.structuredState
                    ) {
                        const { verbs, objects, npcs, exits } = suggestionsResponse.structuredState;
                        const allItems = [
                            ...(verbs || []),
                            ...(objects || []),
                            ...(npcs || []),
                            ...(exits || []),
                        ];
                        alert(`Suggestions: ${allItems.join(', ')}`);
                    } else {
                        console.error(
                            'Failed to get suggestions:',
                            suggestionsResponse?.error || 'No structured state returned'
                        );
                        alert(
                            `Failed to get suggestions: ${suggestionsResponse?.error || 'No structured state returned'}`
                        );
                    }
                } else {
                    alert('Could not get game state from content script.');
                }
            } catch (error) {
                console.error('Error getting game state:', error);
                alert(`Error getting game state: ${error.message}`);
            }
        } else {
            alert('No active tab found.');
        }
    }
    async updateGameStateStatus() {
        console.log('Updating game state status...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            return;
        }

        try {
            // 1. Get raw state from content script
            const rawStateResponse = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: 'getGameState' }, (response) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(response);
                });
            });

            if (!rawStateResponse || !rawStateResponse.success) {
                throw new Error('Failed to get raw game state from content script.');
            }
            console.log('Received raw game state:', rawStateResponse.gameState);

            // 2. Send to service worker for processing
            const suggestionsResponse = await chrome.runtime.sendMessage({
                action: 'getSuggestions',
                gameState: rawStateResponse.gameState,
            });

            if (!suggestionsResponse || !suggestionsResponse.success) {
                throw new Error(
                    suggestionsResponse?.error ||
                        'Failed to get processed state from service worker.'
                );
            }
            console.log('Received processed state:', suggestionsResponse);

            // 3. Update UI with structured state
            const { structuredState } = suggestionsResponse;
            if (structuredState) {
                document.getElementById('location').textContent =
                    structuredState.location || 'Unknown';
                document.getElementById('inventory').textContent = Array.isArray(
                    structuredState.inventory
                )
                    ? structuredState.inventory.join(', ')
                    : 'Unknown';
            } else {
                throw new Error('Structured state is missing in the response.');
            }
        } catch (error) {
            console.error('Error updating game state status:', error.message);
            document.getElementById('location').textContent = 'Error';
            document.getElementById('inventory').textContent = 'Error';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PopupManager();
    });
} else {
    new PopupManager();
}
