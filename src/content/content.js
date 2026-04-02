// Parchment-Assist Content Script
// Injects clickable command buttons into Z-machine games running in Parchment

import { HTMLCleaner } from '../helpers/htmlCleaner.js';
import { NpcProfiler } from '../lib/npc.js';
import { MapManager } from '../lib/mapManager.js';

class ParchmentAssist {
    constructor() {
        this.commandPalette = null;
        this.bubble = null;
        this.npcProfiler = new NpcProfiler();
        this.mapManager = new MapManager();
        this.npcModal = null;
        this.lastGameText = '';
        this.commandHistory = [];
        this.isActive = false;
        this.turnCount = 0;
        this.previousRoom = null;
        this.rawGameState = {
            lastCommands: [],
            gameText: '',
            gameTitle: '',
            npcProfiles: {},
        };
        this.structuredGameState = {};
        this.debounceTimer = null;
        this.mutationObserver = null;
        this.choiceMode = false; // Toggle between Parser Mode and Choice Mode
        this.resizeSaveTimeout = null; // For debouncing resize saves
        this._mergingQuests = false; // Mutex to prevent concurrent mergeQuests calls

        this.init();
    }

    init() {
        this.log('ParchmentAssist class instantiated');
        if (this.isParchmentPage()) {
            this.log('Parchment page detected, initializing...');
            this.waitForParchmentReady();
        } else {
            this.log('Not a Parchment page, stopping.');
            return;
        }
    }

    handleMessages(request, sender, sendResponse) {
        this.log('Message received in handleMessages:', request);
        if (request.action === 'getGameState') {
            this.extractRawGameState().then((rawGameState) => {
                sendResponse({ success: true, gameState: rawGameState });
            });
            return true;
        }
    }

    isParchmentPage() {
        return (
            window.location.hostname.includes('iplayif.com') ||
            document.querySelector('#parchment') ||
            document.querySelector('.parchment') ||
            (document.querySelector('input[type="text"]') &&
                document.title.toLowerCase().includes('parchment'))
        );
    }

    waitForParchmentReady() {
        this.log('Waiting for Parchment to be ready...');
        const checkReady = () => {
            const inputField = this.findInputField();
            const outputArea = this.findOutputArea();
            const gameport = document.querySelector('#gameport');
            this.log('Checking for #gameport in waitForParchmentReady:', gameport);

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

    findInputField() {
        // Try various selectors for Parchment input fields
        const selectors = [
            'input[type="text"]',
            '#input',
            '.input',
            '#cmdline',
            '#command-line-input',
            '.command-line',
            'input[placeholder*="command"]',
            'input[placeholder*="Command"]',
            'input[name="command"]',
            'textarea',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetHeight > 0) {
                return element;
            }
        }
        return null;
    }

    findOutputArea() {
        // Try various selectors for Parchment output areas
        const selectors = [
            '#output',
            '.output',
            '#story',
            '.story',
            '#parchment',
            '.parchment',
            'pre',
            '.text-buffer',
            '#text-buffer',
            '#gameport',
            '.game-output',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.length > 10) {
                return element;
            }
        }
        return null;
    }

    async startAssist() {
        this.log('Starting assist...');
        this.isActive = true;
        this.createCommandPalette();
        this.setupEventListeners();
        this.startObservingChanges();
        this.log('Parchment-Assist started successfully');

        // Show onboarding for first-time users
        await this.checkFirstRun();
    }

    createCommandPalette() {
        if (this.bubble) {
            return;
        }

        // Create the bubble
        this.bubble = document.createElement('div');
        this.bubble.id = 'parchment-assist-bubble';
        this.bubble.textContent = '🤖';
        this.bubble.setAttribute('role', 'button');
        this.bubble.setAttribute('aria-label', 'Toggle Parchment-Assist command palette');
        this.bubble.setAttribute('aria-expanded', 'false');
        this.bubble.setAttribute('tabindex', '0');
        document.body.appendChild(this.bubble);

        // Create the palette (initially hidden)
        this.commandPalette = document.createElement('div');
        this.commandPalette.id = 'parchment-assist-palette';
        this.commandPalette.className = 'parchment-assist-palette';
        this.commandPalette.style.display = 'none';
        this.commandPalette.innerHTML = `
            <div class="palette-resize-handle" aria-label="Resize palette" role="separator" tabindex="0"></div>
            <div class="palette-tabs" role="tablist" aria-label="Command palette tabs">
                <button class="tab-button active" data-tab="main" role="tab" aria-selected="true" aria-controls="palette-content">Main</button>
                <button class="tab-button" data-tab="map" role="tab" aria-selected="false" aria-controls="map-tab-content">Map</button>
                <button class="tab-button" data-tab="actions" role="tab" aria-selected="false" aria-controls="actions-tab-content">Actions</button>
                <button class="tab-button" data-tab="profiles" role="tab" aria-selected="false" aria-controls="profiles-tab-content">Profiles</button>
            </div>
            <div class="palette-header">
                <button id="palette-mode-toggle" class="mode-toggle-btn" aria-label="Toggle Choice Mode" title="Toggle between Parser Mode and Choice Mode">
                    <span class="mode-icon">🎮</span>
                    <span class="mode-text">Parser</span>
                </button>
                <button id="palette-refresh-btn" aria-label="Refresh suggestions">🔄</button>
            </div>
            <div class="palette-content" role="tabpanel" id="palette-content" aria-labelledby="main-tab">
                <div id="palette-location" class="palette-info" role="status" aria-label="Current location"></div>
                <div id="palette-inventory" class="palette-info" role="status" aria-label="Inventory"></div>
                <div id="palette-turn-counter" class="palette-info" role="status" aria-label="Turn counter"></div>
                <div class="palette-section">
                    <h3 id="verbs-heading">Verbs</h3>
                    <div id="palette-verbs" class="palette-list" role="group" aria-labelledby="verbs-heading"></div>
                </div>
                <div class="palette-section">
                    <h3 id="objects-heading">Objects</h3>
                    <div id="palette-objects" class="palette-list" role="group" aria-labelledby="objects-heading"></div>
                </div>
                <div class="palette-section">
                    <h3 id="npcs-heading">Current NPCs</h3>
                    <div id="palette-npcs" class="palette-list" role="group" aria-labelledby="npcs-heading"></div>
                </div>
                <div class="palette-section">
                    <h3 id="exits-heading">Exits</h3>
                    <div id="palette-exits" class="palette-list" role="group" aria-labelledby="exits-heading"></div>
                </div>
                <div class="palette-section">
                    <h3 id="journal-heading">
                        Journal
                        <button id="clear-journal-btn" class="section-action-btn" aria-label="Clear journal" title="Clear all quests">🗑️</button>
                    </h3>
                    <div id="palette-journal" class="palette-list" role="list" aria-labelledby="journal-heading"></div>
                </div>
            </div>
            <div id="map-tab-content" class="tab-content" role="tabpanel" aria-labelledby="map-tab" style="display: none;">
                <div id="room-list" role="list" aria-label="Discovered rooms"></div>
            </div>
            <div id="actions-tab-content" class="tab-content" role="tabpanel" aria-labelledby="actions-tab" style="display: none;">
                <div id="palette-actions" class="palette-list" role="group" aria-label="Suggested actions"></div>
            </div>
            <div id="profiles-tab-content" class="tab-content" role="tabpanel" aria-labelledby="profiles-tab" style="display: none; padding: 10px;">
                <div id="palette-profiles" class="profiles-grid" role="list" aria-label="NPC Profiles"></div>
            </div>
        `;
        document.body.appendChild(this.commandPalette);

        this.makeDraggable(this.bubble);

        this.bubble.addEventListener('click', () => {
            this.togglePalette();
        });

        // Keyboard support for bubble
        this.bubble.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.togglePalette();
            }
        });

        this.commandPalette.querySelectorAll('.tab-button').forEach((button) => {
            button.addEventListener('click', (event) => {
                const tabName = event.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        this.commandPalette.querySelector('#palette-refresh-btn').addEventListener('click', () => {
            this.forceRefresh();
        });

        // Clear journal button
        this.commandPalette.querySelector('#clear-journal-btn').addEventListener('click', () => {
            this.clearJournal();
        });

        // Mode toggle button
        this.commandPalette.querySelector('#palette-mode-toggle').addEventListener('click', () => {
            this.toggleChoiceMode();
        });

        // Setup resize handle
        this.setupPaletteResize();

        // Load saved palette width
        this.loadPaletteWidth();

        // Reposition palette on window resize (debounced)
        let resizeDebounceTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(() => {
                if (this.commandPalette && this.commandPalette.style.display === 'block') {
                    this.positionPalette();
                }
            }, 100);
        });

        // Create NPC Profile Modal
        this.npcModal = document.createElement('div');
        this.npcModal.id = 'parchment-assist-npc-modal';
        this.npcModal.className = 'parchment-assist-modal';
        this.npcModal.style.display = 'none';
        this.npcModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <h2 id="npc-modal-name"></h2>
                <p><strong>Location:</strong> <span id="npc-modal-location"></span></p>
                <p><strong>Description:</strong></p>
                <p id="npc-modal-description"></p>
                <p><strong>Dialogue:</strong></p>
                <ul id="npc-modal-dialogue"></ul>
            </div>
        `;
        document.body.appendChild(this.npcModal);

        const closeModal = () => {
            this.npcModal.classList.add('closing');
            setTimeout(() => {
                this.npcModal.style.display = 'none';
                this.npcModal.classList.remove('closing');
            }, 300);
        };

        this.npcModal.querySelector('.modal-close').addEventListener('click', closeModal);

        window.addEventListener('click', (event) => {
            if (event.target === this.npcModal) {
                closeModal();
            }
        });

        // Close modal on Escape key
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.npcModal.style.display === 'block') {
                closeModal();
            }
        });
    }

    makeDraggable(element) {
        let pos1 = 0,
            pos2 = 0,
            pos3 = 0,
            pos4 = 0;
        element.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;
                const maxTop = window.innerHeight - element.offsetHeight;
                const maxLeft = window.innerWidth - element.offsetWidth;
                element.style.top = Math.min(Math.max(0, newTop), maxTop) + 'px';
                element.style.left = Math.min(Math.max(0, newLeft), maxLeft) + 'px';
                this.positionPalette();
            };
        };
    }

    positionPalette() {
        if (!this.bubble || !this.commandPalette) {
            return;
        }

        const bubbleRect = this.bubble.getBoundingClientRect();
        const paletteRect = this.commandPalette.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const gap = 10;

        let left = bubbleRect.right + gap;
        let top = bubbleRect.top;

        // Check if palette would overflow right edge
        if (left + paletteRect.width > viewportWidth) {
            // Try positioning to the left of bubble
            left = bubbleRect.left - paletteRect.width - gap;

            // If still overflows, position at right edge of viewport
            if (left < 0) {
                left = viewportWidth - paletteRect.width - gap;
            }
        }

        // Check if palette would overflow bottom edge
        if (top + paletteRect.height > viewportHeight) {
            // Align bottom of palette with bottom of viewport
            top = viewportHeight - paletteRect.height - gap;
        }

        // Ensure palette doesn't overflow top edge
        if (top < gap) {
            top = gap;
        }

        // Ensure palette doesn't overflow left edge
        if (left < gap) {
            left = gap;
        }

        this.commandPalette.style.left = left + 'px';
        this.commandPalette.style.top = top + 'px';
    }

    setupPaletteResize() {
        const resizeHandle = this.commandPalette?.querySelector('.palette-resize-handle');
        if (!resizeHandle) {
            return;
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = this.commandPalette.offsetWidth;
            resizeHandle.classList.add('resizing');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const doResize = (e) => {
            if (!isResizing) {
                return;
            }

            const delta = e.clientX - startX;
            const newWidth = startWidth - delta; // Subtract because handle is on left edge

            // Enforce min/max width
            const constrainedWidth = Math.max(200, Math.min(500, newWidth));

            this.commandPalette.style.width = constrainedWidth + 'px';
            this.positionPalette(); // Reposition to prevent overflow
        };

        const stopResize = async () => {
            if (!isResizing) {
                return;
            }

            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save the new width to storage
            const currentWidth = this.commandPalette.offsetWidth;
            try {
                await chrome.storage.sync.set({ paletteWidth: currentWidth });
                this.log(`Palette width saved: ${currentWidth}px`);
            } catch (error) {
                this.log('Error saving palette width:', error);
            }
        };

        resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        // Keyboard resize support
        resizeHandle.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const currentWidth = this.commandPalette.offsetWidth;
                const step = e.shiftKey ? 20 : 5;
                const newWidth =
                    e.key === 'ArrowLeft'
                        ? Math.max(200, currentWidth + step)
                        : Math.max(200, Math.min(500, currentWidth - step));

                this.commandPalette.style.width = newWidth + 'px';
                this.positionPalette();

                // Debounce save
                clearTimeout(this.resizeSaveTimeout);
                this.resizeSaveTimeout = setTimeout(async () => {
                    try {
                        await chrome.storage.sync.set({ paletteWidth: newWidth });
                    } catch (error) {
                        this.log('Error saving palette width:', error);
                    }
                }, 500);
            }
        });
    }

    async loadPaletteWidth() {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            return; // Not in extension environment
        }

        try {
            const result = await chrome.storage.sync.get(['paletteWidth', 'choiceMode']);
            if (result.paletteWidth) {
                const width = Math.max(200, Math.min(500, result.paletteWidth));
                this.commandPalette.style.width = width + 'px';
                this.log(`Loaded palette width: ${width}px`);
            }
            if (result.choiceMode !== undefined) {
                this.choiceMode = result.choiceMode;
                this.updateModeToggleUI();
                this.log(`Loaded choice mode: ${this.choiceMode}`);
            }
        } catch (error) {
            this.log('Error loading palette width:', error);
        }
    }

    async toggleChoiceMode() {
        this.choiceMode = !this.choiceMode;
        this.updateModeToggleUI();

        // Save preference
        try {
            await chrome.storage.sync.set({ choiceMode: this.choiceMode });
            this.log(`Choice mode ${this.choiceMode ? 'enabled' : 'disabled'}`);
        } catch (error) {
            this.log('Error saving choice mode:', error);
        }

        // Refresh UI to show/hide choice mode content
        if (this.structuredGameState) {
            this.updateCommandPalette(this.structuredGameState);
        }

        // Show feedback
        this.showStatus(
            this.choiceMode
                ? 'Choice Mode enabled - Click choices to auto-submit'
                : 'Parser Mode enabled - Click items to build commands',
            'info'
        );
    }

    updateModeToggleUI() {
        const toggleBtn = this.commandPalette?.querySelector('#palette-mode-toggle');
        if (!toggleBtn) {
            return;
        }

        const icon = toggleBtn.querySelector('.mode-icon');
        const text = toggleBtn.querySelector('.mode-text');

        if (this.choiceMode) {
            toggleBtn.classList.add('choice-mode-active');
            icon.textContent = '🎯';
            text.textContent = 'Choice';
            toggleBtn.setAttribute('title', 'Switch to Parser Mode');
        } else {
            toggleBtn.classList.remove('choice-mode-active');
            icon.textContent = '🎮';
            text.textContent = 'Parser';
            toggleBtn.setAttribute('title', 'Switch to Choice Mode');
        }
    }

    togglePalette() {
        if (!this.commandPalette) {
            return;
        }
        const isVisible = this.commandPalette.style.display === 'block';
        this.commandPalette.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this.positionPalette();
        }
        // Update ARIA attribute
        if (this.bubble) {
            this.bubble.setAttribute('aria-expanded', !isVisible);
        }
    }

    setupEventListeners() {
        const inputField = this.findInputField();
        if (!inputField) {
            return;
        }

        // Listen for command submissions
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.commandHistory.push(e.target.value.trim());
                this.turnCount++;
                if (this.commandHistory.length > 10) {
                    this.commandHistory = this.commandHistory.slice(-10);
                }

                // Debounce the suggestion request
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.requestSuggestions();
                }, 1500); // Wait 1.5s after command submission
            }
        });

        // Listen for focus changes to hide/show buttons appropriately
        inputField.addEventListener('focus', () => {
            if (this.commandPalette) {
                this.commandPalette.style.display = 'block';
            }
        });

        // Keyboard shortcuts (Alt+1 through Alt+9)
        document.addEventListener('keydown', (e) => {
            // Only activate shortcuts when palette is visible
            if (!this.commandPalette || this.commandPalette.style.display === 'none') {
                return;
            }

            // Don't intercept when user is typing in an input or textarea
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return;
            }

            // Alt+1 through Alt+9 for quick suggestions
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;

                // Get active tab to determine which items to use
                const activeTab = this.commandPalette.querySelector('.tab-button.active');
                if (!activeTab) {
                    return;
                }

                const tabName = activeTab.dataset.tab;
                let items = [];

                if (tabName === 'actions') {
                    // Get suggested actions from Actions tab
                    items = Array.from(
                        this.commandPalette.querySelectorAll('#palette-actions .palette-item')
                    );
                } else if (tabName === 'main') {
                    // Get clickable items from Main tab (objects, NPCs, exits, verbs)
                    items = Array.from(
                        this.commandPalette.querySelectorAll(
                            '#palette-objects .palette-item, #palette-npcs .palette-item, #palette-exits .palette-item, #palette-verbs .palette-item'
                        )
                    );
                }

                // Click the item if it exists
                if (items[index]) {
                    items[index].click();
                    // Visual feedback: highlight the item briefly
                    items[index].style.background = '#3498db';
                    setTimeout(() => {
                        items[index].style.background = '';
                    }, 200);
                }
            }

            // Alt+0 to toggle palette visibility
            if (e.altKey && e.key === '0') {
                e.preventDefault();
                this.togglePalette();
            }

            // Alt+R to refresh suggestions
            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                const refreshBtn = this.commandPalette.querySelector('#palette-refresh-btn');
                if (refreshBtn) {
                    refreshBtn.click();
                }
            }
        });
    }

    startObservingChanges() {
        const outputArea = this.findOutputArea();
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
                    this.extractRawGameState().then(() => {
                        this.requestSuggestions();
                    });
                }, 2000); // Wait 2s after text changes
            }
        });

        this.mutationObserver.observe(outputArea, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    async extractRawGameState(force = false) {
        return new Promise((resolve) => {
            this.log('--- Starting Raw Game State Extraction ---');
            const gameport = document.querySelector('#gameport');
            if (!gameport) {
                this.log('ERROR: Could not find #gameport element.');
                resolve(null);
                return;
            }

            const gameHtml = gameport.innerHTML;
            const cleanedText = HTMLCleaner.clean(gameHtml);
            if (!force && cleanedText === this.lastGameText) {
                resolve(this.rawGameState);
                return;
            }
            this.lastGameText = cleanedText;
            const title = document.title.replace(/ - Parchment/i, '').trim();

            this.rawGameState = {
                lastCommands: this.commandHistory.slice(-3),
                gameText: cleanedText,
                gameTitle: title,
            };

            this.log('Final rawGameState object:', this.rawGameState);
            this.log('--- Finished Raw Game State Extraction ---');
            resolve(this.rawGameState);
        });
    }

    async mergeQuests() {
        if (this._mergingQuests) {
            return;
        }
        this._mergingQuests = true;
        try {
            const gameTitle = this.rawGameState?.gameTitle || 'Unknown';
            const storageKey = `quests_${gameTitle}`;

            // Get saved quests from storage
            const stored = await chrome.storage.local.get([storageKey]);
            const savedQuests = stored[storageKey] || [];

            // Get new quests from AI response
            const newQuests = this.structuredGameState?.quests || [];

            // Merge quests: keep all saved, add new unique ones, update completed status
            const mergedQuests = [...savedQuests];

            newQuests.forEach((newQuest) => {
                // Find if quest already exists (match by description)
                const existingIndex = mergedQuests.findIndex(
                    (q) =>
                        q.description.toLowerCase().trim() ===
                        newQuest.description.toLowerCase().trim()
                );

                if (existingIndex !== -1) {
                    // Quest exists - update status if changed to completed
                    if (
                        newQuest.status === 'completed' &&
                        mergedQuests[existingIndex].status !== 'completed'
                    ) {
                        mergedQuests[existingIndex].status = 'completed';
                        this.log(`Quest completed: "${newQuest.description}"`);
                    }
                } else {
                    // New quest - add it
                    mergedQuests.push(newQuest);
                    this.log(`New quest added: "${newQuest.description}"`);
                }
            });

            // Save merged quests back to storage
            await chrome.storage.local.set({ [storageKey]: mergedQuests });

            // Update structuredGameState with merged quests
            this.structuredGameState.quests = mergedQuests;

            this.log(`Quest merge complete: ${mergedQuests.length} total quests`);
        } catch (error) {
            this.log('Error merging quests:', error);
            // Don't fail the whole update if quest merging fails
        } finally {
            this._mergingQuests = false;
        }
    }

    async clearJournal() {
        if (!confirm('Clear all journal entries? This cannot be undone.')) {
            return;
        }
        try {
            const gameTitle = this.rawGameState?.gameTitle || 'Unknown';
            const storageKey = `quests_${gameTitle}`;

            // Clear quests from storage
            await chrome.storage.local.set({ [storageKey]: [] });

            // Clear quests from current state
            if (this.structuredGameState) {
                this.structuredGameState.quests = [];
            }

            // Update the UI
            const journalContainer = this.commandPalette?.querySelector('#palette-journal');
            if (journalContainer) {
                this.renderJournal(journalContainer, []);
            }

            this.log('Journal cleared for game:', gameTitle);
            this.showStatus('Journal cleared successfully', 'success');
        } catch (error) {
            this.log('Error clearing journal:', error);
            this.showError('Failed to clear journal');
        }
    }

    async requestSuggestions(force = false) {
        if (!this.isActive) {
            return;
        }

        this.showLoadingState(true);

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSuggestions',
                gameState: this.rawGameState,
                force: force,
            });

            if (response && response.success) {
                this.structuredGameState = response.structuredState;
                this.npcProfiler.updateProfiles(this.structuredGameState.npcProfiles);
                if (this.structuredGameState.mapData) {
                    const lastCommand =
                        this.commandHistory.length > 0
                            ? this.commandHistory[this.commandHistory.length - 1]
                            : null;
                    this.mapManager.updateMap(
                        this.structuredGameState.mapData,
                        this.previousRoom,
                        lastCommand
                    );
                    this.renderMap();
                }
                this.previousRoom = this.structuredGameState.location;

                // CRITICAL FIX: Retrieve and merge quests from storage
                await this.mergeQuests();

                this.updateCommandPalette(this.structuredGameState);
            } else {
                this.showError(
                    'Failed to get structured state: ' + (response?.error || 'Unknown error')
                );
            }
        } catch (error) {
            this.log('Error requesting structured state:', error);
            this.showError('Connection error');
        } finally {
            this.showLoadingState(false);
        }
    }

    updateCommandPalette(state) {
        console.log('Updating command palette with state:', state);
        if (!this.commandPalette || !state) {
            return;
        }

        const content = this.commandPalette.querySelector('.palette-content');
        if (!content) {
            return;
        }

        content.querySelector('#palette-location').textContent =
            '📍 ' + (state.location || 'Unknown');
        content.querySelector('#palette-inventory').textContent =
            '🎒 ' +
            (Array.isArray(state.inventory) && state.inventory.length
                ? state.inventory.join(', ')
                : 'Empty');
        content.querySelector('#palette-turn-counter').textContent = `Turn: ${this.turnCount}`;

        // In Choice Mode, hide parser elements and show choices prominently
        if (this.choiceMode) {
            // Hide traditional parser sections
            const verbsSection = content.querySelector('#palette-verbs')?.parentElement;
            const objectsSection = content.querySelector('#palette-objects')?.parentElement;
            const npcsSection = content.querySelector('#palette-npcs')?.parentElement;
            const exitsSection = content.querySelector('#palette-exits')?.parentElement;

            if (verbsSection) {
                verbsSection.style.display = 'none';
            }
            if (objectsSection) {
                objectsSection.style.display = 'none';
            }
            if (npcsSection) {
                npcsSection.style.display = 'none';
            }
            if (exitsSection) {
                exitsSection.style.display = 'none';
            }

            // Render choices prominently in a special section
            let choicesSection = content.querySelector('#palette-choices-section');
            if (!choicesSection) {
                choicesSection = document.createElement('div');
                choicesSection.id = 'palette-choices-section';
                choicesSection.className = 'palette-section';
                choicesSection.innerHTML = `
                    <h3 id="choices-heading">Choices</h3>
                    <div id="palette-choices" class="palette-choices-list" role="group" aria-labelledby="choices-heading"></div>
                `;
                // Insert after turn counter
                const turnCounter = content.querySelector('#palette-turn-counter');
                if (turnCounter) {
                    turnCounter.parentElement.insertBefore(choicesSection, turnCounter.nextSibling);
                }
            }
            choicesSection.style.display = 'block';
            this.renderChoices(
                content.querySelector('#palette-choices'),
                state.suggestedActions || []
            );
        } else {
            // Parser Mode - show traditional sections, hide choices
            const verbsSection = content.querySelector('#palette-verbs')?.parentElement;
            const objectsSection = content.querySelector('#palette-objects')?.parentElement;
            const npcsSection = content.querySelector('#palette-npcs')?.parentElement;
            const exitsSection = content.querySelector('#palette-exits')?.parentElement;
            const choicesSection = content.querySelector('#palette-choices-section');

            if (verbsSection) {
                verbsSection.style.display = 'block';
            }
            if (objectsSection) {
                objectsSection.style.display = 'block';
            }
            if (npcsSection) {
                npcsSection.style.display = 'block';
            }
            if (exitsSection) {
                exitsSection.style.display = 'block';
            }
            if (choicesSection) {
                choicesSection.style.display = 'none';
            }

            this.renderList(
                content.querySelector('#palette-verbs'),
                ['LOOK', 'INVENTORY', 'EXAMINE', 'HELP', 'WAIT', 'ABOUT', ...(state.verbs || [])],
                'verb'
            );
            this.renderList(
                content.querySelector('#palette-objects'),
                [...(state.objects || []), ...(state.inventory || [])],
                'object'
            );
            this.renderList(content.querySelector('#palette-npcs'), state.npcs || [], 'npc');
            this.renderList(
                content.querySelector('#palette-exits'),
                state.exits && state.exits.length
                    ? state.exits
                    : [
                          'NORTH',
                          'SOUTH',
                          'EAST',
                          'WEST',
                          'UP',
                          'DOWN',
                          'NORTHEAST',
                          'NORTHWEST',
                          'SOUTHEAST',
                          'SOUTHWEST',
                      ],
                'exit'
            );
        }

        this.renderJournal(content.querySelector('#palette-journal'), state.quests || []);
        this.renderList(
            this.commandPalette.querySelector('#palette-actions'),
            state.suggestedActions || [],
            'action'
        );
    }

    renderList(container, items, type) {
        if (!container) {
            return;
        }

        // Validate items is iterable
        if (!items || (!Array.isArray(items) && typeof items !== 'object')) {
            console.warn(
                '[Parchment-Assist] renderList: items must be iterable, got:',
                typeof items
            );
            items = [];
        }

        container.innerHTML = '';
        const seen = new Set();
        const uniqueItems = items.filter((item) => {
            const key = typeof item === 'object' ? JSON.stringify(item) : item;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });

        // Show empty state if no items
        if (uniqueItems.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            const emptyMessages = {
                verb: 'No suggested verbs yet',
                object: 'No objects found',
                npc: 'No NPCs here',
                exit: 'No exits detected',
                profile: 'No NPC profiles yet',
                action: 'Waiting for AI suggestions...',
            };
            emptyState.textContent = emptyMessages[type] || 'No items';
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            container.appendChild(emptyState);
            return;
        }

        uniqueItems.forEach((item) => {
            const element = document.createElement('div');
            element.className = 'palette-item';
            element.setAttribute('role', 'button');
            element.setAttribute('tabindex', '0');

            if (type === 'exit' && typeof item === 'object' && item.direction) {
                const label = `${item.direction} to ${item.room || 'an unknown area'}`;
                element.textContent = label;
                element.setAttribute('aria-label', `Go ${label}`);
                element.addEventListener('click', () =>
                    this.handlePaletteClick(item.direction, type)
                );
            } else {
                element.textContent = item;
                element.setAttribute('aria-label', `Use ${type}: ${item}`);
                element.addEventListener('click', () => this.handlePaletteClick(item, type));
            }

            // Add keyboard support (Enter/Space to activate)
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    element.click();
                }
            });

            element.dataset.type = type;
            container.appendChild(element);
        });
    }

    renderChoices(container, choices) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        // Show empty state if no choices
        if (!choices || choices.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Waiting for AI to suggest choices...';
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            container.appendChild(emptyState);
            return;
        }

        // Render each choice as a large, prominent button
        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = choice;
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.setAttribute('aria-label', `Choice ${index + 1}: ${choice}`);

            // Auto-submit on click
            button.addEventListener('click', () => {
                this.submitChoice(choice);
            });

            // Keyboard support (Enter/Space to activate)
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.submitChoice(choice);
                }
            });

            container.appendChild(button);
        });
    }

    submitChoice(choice) {
        const inputField = this.findInputField();
        if (!inputField) {
            this.showError('Could not find input field');
            return;
        }

        this.commandHistory.push(choice);
        this.turnCount++;
        if (this.commandHistory.length > 10) {
            this.commandHistory = this.commandHistory.slice(-10);
        }

        // Fill input and submit
        inputField.value = choice;
        inputField.focus();

        // Trigger Enter key event to submit
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
        });
        inputField.dispatchEvent(enterEvent);

        this.log(`Choice submitted: "${choice}"`);
    }

    renderJournal(container, quests) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        // Show empty state if no quests
        if (!quests || quests.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No quests or objectives yet';
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            container.appendChild(emptyState);
            return;
        }

        quests.forEach((quest, index) => {
            const element = document.createElement('div');
            element.className = 'journal-entry';
            element.setAttribute('role', 'listitem');
            element.setAttribute(
                'aria-label',
                `Quest ${index + 1}: ${quest.description}${quest.status === 'completed' ? ' - Completed' : ''}`
            );
            if (quest.status === 'completed') {
                element.classList.add('completed');
            }
            element.textContent = quest.description;
            container.appendChild(element);
        });
    }

    handlePaletteClick(item, type) {
        const inputField = this.findInputField();
        if (!inputField) {
            return;
        }

        const textToAppend = item;
        if (type === 'profile') {
            this.showNpcProfile(item);
            return;
        }

        const currentValue = inputField.value.trim();
        if (currentValue === '') {
            inputField.value = textToAppend;
        } else {
            inputField.value = `${currentValue} ${textToAppend}`;
        }
        inputField.focus();
    }

    showNpcProfile(npcName) {
        const profile = this.npcProfiler.getProfile(npcName);
        if (profile) {
            document.getElementById('npc-modal-name').textContent = npcName;
            document.getElementById('npc-modal-location').textContent =
                profile.location || 'Unknown';
            document.getElementById('npc-modal-description').textContent =
                profile.description || 'No description available.';

            const dialogueList = document.getElementById('npc-modal-dialogue');
            dialogueList.innerHTML = '';
            if (profile.dialogue && profile.dialogue.length > 0) {
                profile.dialogue.forEach((line) => {
                    const li = document.createElement('li');
                    li.textContent = line;
                    dialogueList.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'No dialogue recorded.';
                dialogueList.appendChild(li);
            }

            this.npcModal.style.display = 'block';
        }
    }

    populateInput(command) {
        const inputField = this.findInputField();
        if (!inputField) {
            return;
        }

        inputField.value = command;
        inputField.focus();
    }

    showLoadingState(isLoading) {
        if (!this.commandPalette) {
            return;
        }

        let loadingIndicator = this.commandPalette.querySelector('.palette-loading-indicator');

        if (isLoading) {
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'palette-loading-indicator';
                loadingIndicator.innerHTML = `
                    <div class="loading-spinner"></div>
                    <span class="loading-text">Loading suggestions...</span>
                `;
                const paletteContent = this.commandPalette.querySelector('.palette-content');
                if (paletteContent) {
                    paletteContent.prepend(loadingIndicator);
                }
            }
        } else {
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    }

    showError(message) {
        console.error('Error:', message);

        // Create toast notification using DOM construction (no innerHTML) to prevent XSS
        const toast = document.createElement('div');
        toast.className = 'parchment-assist-toast parchment-assist-toast-error';

        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = '⚠️';

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';

        toastContent.appendChild(icon);
        toastContent.appendChild(msg);
        toastContent.appendChild(closeBtn);
        toast.appendChild(toastContent);

        document.body.appendChild(toast);

        // Close button handler
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);

        // Slide in animation
        setTimeout(() => {
            toast.classList.add('toast-visible');
        }, 10);
    }

    showStatus(message, type = 'success') {
        console.log('Status:', message);

        // Create toast notification using DOM construction (no innerHTML) to prevent XSS
        const toast = document.createElement('div');
        const toastClass =
            type === 'success' ? 'parchment-assist-toast-success' : 'parchment-assist-toast-info';
        toast.className = `parchment-assist-toast ${toastClass}`;

        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = type === 'success' ? '✓' : 'ℹ️';

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';

        toastContent.appendChild(iconSpan);
        toastContent.appendChild(msg);
        toastContent.appendChild(closeBtn);
        toast.appendChild(toastContent);

        document.body.appendChild(toast);

        // Close button handler
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto-dismiss after 3 seconds for success messages
        setTimeout(() => {
            this.removeToast(toast);
        }, 3000);

        // Slide in animation
        setTimeout(() => {
            toast.classList.add('toast-visible');
        }, 10);
    }

    removeToast(toast) {
        if (!toast) {
            return;
        }
        toast.classList.remove('toast-visible');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    async checkAIConfiguration() {
        try {
            const settings = await chrome.storage.sync.get([
                'geminiKey',
                'preferLocal',
                'activeProviders',
            ]);

            // Check if Gemini is configured
            const hasGemini =
                settings.activeProviders?.includes('gemini') &&
                settings.geminiKey &&
                settings.geminiKey.trim() !== '';

            // Check if Ollama is configured
            const hasOllama = settings.activeProviders?.includes('ollama');

            return {
                configured: hasGemini || hasOllama,
                provider:
                    hasGemini && !settings.preferLocal ? 'gemini' : hasOllama ? 'ollama' : null,
                hasGemini: hasGemini,
                hasOllama: hasOllama,
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
                // Wait a moment for the page to settle
                setTimeout(() => {
                    this.showOnboarding();
                }, 1000);
            } else {
                // Check if AI is configured and show warning badge if not
                const aiStatus = await this.checkAIConfiguration();
                if (!aiStatus.configured) {
                    this.showConfigWarningBadge();
                }
            }
        } catch (error) {
            this.log('Error checking first run:', error);
        }
    }

    async showOnboarding() {
        // Check AI configuration status
        const aiStatus = await this.checkAIConfiguration();

        // Create onboarding overlay
        const overlay = document.createElement('div');
        overlay.className = 'parchment-assist-onboarding';
        overlay.innerHTML = `
            <div class="onboarding-backdrop"></div>
            <div class="onboarding-content">
                <div class="onboarding-header">
                    <h2>🤖 Welcome to Parchment-Assist!</h2>
                    <button class="onboarding-close" aria-label="Close">&times;</button>
                </div>
                <div class="onboarding-body">
                    <p class="onboarding-intro">AI-powered command suggestions for your interactive fiction adventures!</p>

                    <div class="onboarding-feature onboarding-setup-status ${aiStatus.configured ? 'setup-complete' : 'setup-required'}">
                        <div class="feature-icon">${aiStatus.configured ? '✅' : '⚠️'}</div>
                        <div class="feature-content">
                            <h3>AI Backend ${aiStatus.configured ? 'Configured' : 'Setup Required'}</h3>
                            <p id="setup-status-text">${
                                aiStatus.configured
                                    ? `Using ${aiStatus.provider === 'gemini' ? 'Gemini API' : 'Ollama (local)'}`
                                    : 'You must configure an AI backend (Ollama or Gemini) before using this extension'
                            }</p>
                        </div>
                    </div>

                    <div class="onboarding-feature">
                        <div class="feature-icon">🤖</div>
                        <div class="feature-content">
                            <h3>Robot Bubble</h3>
                            <p>Click the robot bubble (top-right) to toggle the command palette</p>
                        </div>
                    </div>

                    <div class="onboarding-feature">
                        <div class="feature-icon">📋</div>
                        <div class="feature-content">
                            <h3>Three Tabs</h3>
                            <p><strong>Main:</strong> Game info, objects, NPCs<br>
                               <strong>Map:</strong> Discovered rooms and connections<br>
                               <strong>Actions:</strong> AI-suggested commands</p>
                        </div>
                    </div>

                    <div class="onboarding-feature">
                        <div class="feature-icon">⌨️</div>
                        <div class="feature-content">
                            <h3>Keyboard Shortcuts</h3>
                            <p><strong>Alt+1-9:</strong> Quick-execute suggestions<br>
                               <strong>Alt+0:</strong> Toggle palette<br>
                               <strong>Alt+R:</strong> Refresh suggestions</p>
                        </div>
                    </div>
                </div>
                <div class="onboarding-footer">
                    <button class="onboarding-btn-secondary" id="onboarding-open-settings">
                        ⚙️ Open Settings
                    </button>
                    <button class="onboarding-btn-primary" id="onboarding-get-started" ${!aiStatus.configured ? 'disabled' : ''}>
                        Get Started!
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close button handler
        const closeOnboarding = () => {
            overlay.classList.add('onboarding-hiding');
            setTimeout(() => {
                overlay.remove();
            }, 300);
            // Mark onboarding as seen
            chrome.storage.sync.set({ hasSeenOnboarding: true });
        };

        overlay.querySelector('.onboarding-close').addEventListener('click', closeOnboarding);

        // "Open Settings" button handler
        overlay.querySelector('#onboarding-open-settings').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // "Get Started!" button handler
        overlay.querySelector('#onboarding-get-started').addEventListener('click', async () => {
            // Recheck AI configuration in case user configured it
            const currentStatus = await this.checkAIConfiguration();

            if (!currentStatus.configured) {
                // Still not configured - open options page
                chrome.runtime.openOptionsPage();
                this.showStatus(
                    'Please configure an AI backend (Gemini or Ollama) to use Parchment-Assist',
                    'info'
                );
            } else {
                // Configured - proceed with onboarding
                closeOnboarding();
                // Show the palette to help user get started
                if (this.commandPalette) {
                    this.commandPalette.style.display = 'block';
                    this.positionPalette();
                    if (this.bubble) {
                        this.bubble.setAttribute('aria-expanded', 'true');
                    }
                }
                this.showStatus(
                    `AI configured successfully using ${currentStatus.provider === 'gemini' ? 'Gemini' : 'Ollama'}!`,
                    'success'
                );
            }
        });

        // Close on backdrop click
        overlay.querySelector('.onboarding-backdrop').addEventListener('click', closeOnboarding);

        // Fade in
        setTimeout(() => {
            overlay.classList.add('onboarding-visible');
        }, 10);
    }

    showConfigWarningBadge() {
        // Check if warning badge already exists
        if (document.getElementById('parchment-assist-config-warning')) {
            return;
        }

        // Create warning badge in palette header
        const paletteHeader = this.commandPalette?.querySelector('.palette-header');
        if (!paletteHeader) {
            return;
        }

        const warningBadge = document.createElement('button');
        warningBadge.id = 'parchment-assist-config-warning';
        warningBadge.className = 'palette-config-warning';
        warningBadge.textContent = '⚙️';
        warningBadge.setAttribute(
            'aria-label',
            'AI backend not configured - click to open settings'
        );
        warningBadge.setAttribute('title', 'AI backend not configured');

        // Insert before the refresh button
        const refreshBtn = paletteHeader.querySelector('#palette-refresh-btn');
        if (refreshBtn) {
            paletteHeader.insertBefore(warningBadge, refreshBtn);
        } else {
            paletteHeader.appendChild(warningBadge);
        }

        // Click handler to open options page
        warningBadge.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
            this.showStatus('Please configure an AI backend (Gemini or Ollama)', 'info');
        });

        // Add pulsing effect for visibility
        warningBadge.style.animation = 'pulse-warning 2s ease-in-out infinite';
    }

    log(message, ...args) {
        console.log('[Parchment-Assist]', message, ...args);
    }

    destroy() {
        this.isActive = false;

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        if (this.commandPalette && this.commandPalette.parentNode) {
            this.commandPalette.parentNode.removeChild(this.commandPalette);
        }

        if (this.bubble && this.bubble.parentNode) {
            this.bubble.parentNode.removeChild(this.bubble);
        }

        if (this.npcModal && this.npcModal.parentNode) {
            this.npcModal.parentNode.removeChild(this.npcModal);
        }

        clearTimeout(this.debounceTimer);

        this.log('Parchment-Assist stopped');
    }

    updateMap(mapData) {
        if (mapData && mapData.roomName) {
            this.mapManager.addRoom(mapData.roomName, {
                items: mapData.objects || [],
                exits: mapData.exits || [],
            });
            if (mapData.exits && Array.isArray(mapData.exits)) {
                mapData.exits.forEach((exit) => {
                    if (typeof exit === 'object' && exit.direction) {
                        this.mapManager.addConnection(
                            mapData.roomName,
                            exit.room || `Unknown from ${mapData.roomName} via ${exit.direction}`,
                            exit.direction
                        );
                    } else {
                        this.mapManager.addConnection(
                            mapData.roomName,
                            `Unknown from ${mapData.roomName} via ${exit}`,
                            exit
                        );
                    }
                });
            }
        }
    }

    renderMap() {
        const roomListContainer = document.getElementById('room-list');
        if (!roomListContainer) {
            return;
        }

        const mapData = this.mapManager.getMap();
        roomListContainer.innerHTML = '';

        // Show empty state if no rooms
        const roomNames = Object.keys(mapData.rooms || {});
        if (roomNames.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🗺️</div>
                    <p style="margin: 0; font-size: 14px; color: #bdc3c7;">No rooms discovered yet</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #95a5a6;">Explore the game to map locations</p>
                </div>
            `;
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            roomListContainer.appendChild(emptyState);
            return;
        }

        for (const roomName in mapData.rooms) {
            const room = mapData.rooms[roomName];
            console.log('room.exits:', room.exits);
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.setAttribute('role', 'listitem');
            roomCard.setAttribute('aria-label', `Room: ${roomName}`);

            // Room header (safe DOM construction — no innerHTML with AI-derived data)
            const roomHeader = document.createElement('div');
            roomHeader.className = 'room-header';

            const roomNameSpan = document.createElement('span');
            roomNameSpan.className = 'room-name';
            roomNameSpan.textContent = roomName;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-room-btn';
            deleteBtn.dataset.roomName = roomName;
            deleteBtn.setAttribute('aria-label', `Delete ${roomName} from map`);
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => {
                this.mapManager.deleteRoom(roomName);
                this.renderMap();
            });

            roomHeader.appendChild(roomNameSpan);
            roomHeader.appendChild(deleteBtn);

            // Room details
            const roomDetails = document.createElement('div');
            roomDetails.className = 'room-details';

            const roomItemsDiv = document.createElement('div');
            roomItemsDiv.className = 'room-items';
            const itemsLabel = document.createElement('strong');
            itemsLabel.textContent = 'Items:';
            const itemsList = document.createElement('ul');
            if (Array.isArray(room.items)) {
                room.items.forEach((item) => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    itemsList.appendChild(li);
                });
            }
            roomItemsDiv.appendChild(itemsLabel);
            roomItemsDiv.appendChild(itemsList);

            const roomExitsDiv = document.createElement('div');
            roomExitsDiv.className = 'room-exits';
            const exitsLabel = document.createElement('strong');
            exitsLabel.textContent = 'Exits:';
            const exitsList = document.createElement('ul');
            if (Array.isArray(room.exits)) {
                room.exits.forEach((exit) => {
                    const li = document.createElement('li');
                    if (typeof exit === 'object' && exit.direction) {
                        li.textContent = `${exit.direction} to ${exit.room || 'an unknown area'}`;
                    } else {
                        li.textContent = exit;
                    }
                    exitsList.appendChild(li);
                });
            } else if (typeof room.exits === 'object' && room.exits !== null) {
                Object.entries(room.exits).forEach(([direction, dest]) => {
                    const li = document.createElement('li');
                    li.textContent = `${direction} to ${dest}`;
                    exitsList.appendChild(li);
                });
            }
            roomExitsDiv.appendChild(exitsLabel);
            roomExitsDiv.appendChild(exitsList);

            roomDetails.appendChild(roomItemsDiv);
            roomDetails.appendChild(roomExitsDiv);

            roomCard.appendChild(roomHeader);
            roomCard.appendChild(roomDetails);
            roomListContainer.appendChild(roomCard);
        }
    }

    renderProfiles() {
        const profilesContainer = document.getElementById('palette-profiles');
        if (!profilesContainer) {
            return;
        }

        const profiles = this.npcProfiler.getAllProfiles();
        const profileNames = Object.keys(profiles);
        profilesContainer.innerHTML = '';

        // Show empty state if no profiles
        if (profileNames.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">👥</div>
                    <p style="margin: 0; font-size: 14px; color: #bdc3c7;">No NPCs encountered yet</p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #95a5a6;">Interact with characters to build profiles</p>
                </div>
            `;
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            profilesContainer.appendChild(emptyState);
            return;
        }

        // Render each profile as a card
        profileNames.forEach((npcName) => {
            const profile = profiles[npcName];
            const profileCard = document.createElement('div');
            profileCard.className = 'profile-card';
            profileCard.setAttribute('role', 'listitem');
            profileCard.setAttribute('aria-label', `Profile: ${npcName}`);

            const dialoguePreview =
                profile.dialogue && profile.dialogue.length > 0
                    ? profile.dialogue[0]
                    : 'No dialogue recorded';

            // Safe DOM construction — no innerHTML with AI-derived data
            const profileHeader = document.createElement('div');
            profileHeader.className = 'profile-header';
            const profileNameSpan = document.createElement('span');
            profileNameSpan.className = 'profile-name';
            profileNameSpan.textContent = `👤 ${npcName}`;
            profileHeader.appendChild(profileNameSpan);

            const profileDetails = document.createElement('div');
            profileDetails.className = 'profile-details';

            const locationDiv = document.createElement('div');
            locationDiv.className = 'profile-location';
            const locationLabel = document.createElement('strong');
            locationLabel.textContent = '📍 Location:';
            locationDiv.appendChild(locationLabel);
            locationDiv.append(` ${profile.location || 'Unknown'}`);

            profileDetails.appendChild(locationDiv);

            if (profile.description) {
                const descDiv = document.createElement('div');
                descDiv.className = 'profile-description';
                const descLabel = document.createElement('strong');
                descLabel.textContent = 'Description:';
                descDiv.appendChild(descLabel);
                descDiv.append(` ${profile.description}`);
                profileDetails.appendChild(descDiv);
            }

            const dialogueDiv = document.createElement('div');
            dialogueDiv.className = 'profile-dialogue-preview';
            const dialogueLabel = document.createElement('strong');
            dialogueLabel.textContent = '💬 Recent:';
            dialogueDiv.appendChild(dialogueLabel);
            dialogueDiv.append(` "${dialoguePreview}"`);
            profileDetails.appendChild(dialogueDiv);

            const viewBtn = document.createElement('button');
            viewBtn.className = 'profile-view-btn';
            viewBtn.dataset.npcName = npcName;
            viewBtn.textContent = 'View Full Profile';
            viewBtn.addEventListener('click', () => {
                this.showNpcProfile(npcName);
            });
            profileDetails.appendChild(viewBtn);

            profileCard.appendChild(profileHeader);
            profileCard.appendChild(profileDetails);
            profilesContainer.appendChild(profileCard);
        });
    }

    switchTab(tabName) {
        const palette = this.commandPalette;
        palette.querySelectorAll('.tab-button').forEach((button) => {
            button.classList.remove('active');
            button.setAttribute('aria-selected', 'false');
        });
        const activeTab = palette.querySelector(`.tab-button[data-tab="${tabName}"]`);
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');

        // Hide all tab contents
        const mainContent = palette.querySelector('.palette-content');
        const mapContent = palette.querySelector('#map-tab-content');
        const actionsContent = palette.querySelector('#actions-tab-content');
        const profilesContent = palette.querySelector('#profiles-tab-content');

        if (mainContent) {
            mainContent.style.display = 'none';
        }
        if (mapContent) {
            mapContent.style.display = 'none';
        }
        if (actionsContent) {
            actionsContent.style.display = 'none';
        }
        if (profilesContent) {
            profilesContent.style.display = 'none';
        }

        // Show selected tab content
        if (tabName === 'map') {
            if (mapContent) {
                mapContent.style.display = 'block';
            }
            this.renderMap();
        } else if (tabName === 'actions') {
            if (actionsContent) {
                actionsContent.style.display = 'block';
            }
        } else if (tabName === 'profiles') {
            if (profilesContent) {
                profilesContent.style.display = 'block';
            }
            this.renderProfiles();
        } else {
            // Default to main tab
            if (mainContent) {
                mainContent.style.display = 'block';
            }
        }
    }

    async forceRefresh() {
        this.log('Forcing refresh...');
        const refreshBtn = this.commandPalette?.querySelector('#palette-refresh-btn');

        if (refreshBtn) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
        }

        try {
            await this.extractRawGameState(true);
            await this.requestSuggestions(true);
            this.showStatus('Suggestions refreshed!', 'success');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            }
        }
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
