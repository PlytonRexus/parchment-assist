// Parchment-Assist Content Script
// Orchestrator: wires together UIManager, GameStateManager, CommandExecutor, MapManager, NpcProfiler

import { NpcProfiler } from '../lib/npc.js';
import { MapManager } from '../lib/mapManager.js';
import { UIManager } from '../ui/uiManager.js';
import { GameStateManager } from './gameStateManager.js';
import { CommandExecutor } from './commandExecutor.js';
import { ParserFeedbackDetector } from '../helpers/parserFeedback.js';
import { StuckDetector } from '../lib/stuckDetector.js';
import { TextAnnotator } from './textAnnotator.js';
import { AdvancedGameStateExtractor } from '../helpers/textMiner.js';
import { InteractableMerger } from '../helpers/interactableMerger.js';

class ParchmentAssist {
    constructor() {
        this.npcProfiler = new NpcProfiler();
        this.mapManager = new MapManager();
        this.gameStateManager = new GameStateManager();

        // Arrow functions ensure late-bound this references resolve correctly at call time
        this.commandExecutor = new CommandExecutor({
            findInputField: () => this.gameStateManager.findInputField(),
            onError: (msg) => this.uiManager.showError(msg),
            submitAction: (cmd, field) =>
                this.gameStateManager.getAdapter().submitCommand(cmd, field),
        });

        this.stuckDetector = new StuckDetector();
        this.textAnnotator = new TextAnnotator({
            onChoiceSubmit: (command) => this.handleChoiceSubmit(command),
        });
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
            onUndoAI: () => this._undoAIOptimization(),
        });

        this.isActive = false;
        this.debounceTimer = null;
        this.mutationObserver = null;
        this.previousRoom = null;
        // Entity accumulation: Map<roomName, interactable[]>
        this._roomInteractables = new Map();
        // Heuristic-first rendering: store last heuristic-only interactables for undo
        this._lastHeuristicInteractables = [];
        // Annotation interactables: union of AI + heuristic for inline text coverage
        this._lastAnnotationInteractables = [];

        // AI request debouncing and in-flight management
        this._aiDebounceTimer = null;
        this._aiInFlight = false;
        this._aiRequestRoomTag = null; // room name when AI request was sent
        this._pendingAIForce = null; // queued force flag while request in flight
        this._currentScopedText = '';
        this._currentHeuristicHints = [];

        // Room-scoped AI cache: Map<normalizedRoomName, {interactables, structuredState, timestamp}>
        this._roomAICache = new Map();

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
        if (request.action === 'getStateSnapshot') {
            sendResponse({ success: true, snapshot: this._getCurrentSnapshot() });
            return true;
        }
        if (request.action === 'restoreStateSnapshot') {
            this._applySnapshot(request.snapshot).then(() => {
                sendResponse({ success: true });
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
        await this._loadNpcsFromStorage();
        await this._loadMetaFromStorage();
        this.setupEventListeners();
        this.startObservingChanges();
        const outputArea = this.gameStateManager.findOutputArea();
        if (outputArea) {
            this.textAnnotator.setupHoverListeners(outputArea);
        }
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
                const command = e.target.value.trim();
                this.gameStateManager.recordCommand(command);
                // Invalidate room cache on state-changing commands
                if (ParchmentAssist._isStateChangingCommand(command)) {
                    const roomKey = (this.previousRoom || '').trim().toLowerCase();
                    if (roomKey) {
                        this._roomAICache.delete(roomKey);
                    }
                }
                // No separate debounce here — the MutationObserver fires when
                // the game responds, which triggers requestSuggestions()
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
                if (tabName === 'main') {
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

            if (e.altKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                this._requestHint();
            }

            if (e.altKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                this.uiManager.switchTab('map');
            }

            if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                this.uiManager.toggleChoiceMode();
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
                        this.gameStateManager.recordRejection(lastCommand);
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

        // 1. Extract raw game state
        await this.gameStateManager.extractRawGameState();
        const fullText = this.gameStateManager.rawGameState.gameText || '';

        // 2. Scoped heuristic for panel (current room only)
        const scopedText = AdvancedGameStateExtractor.scopeToCurrentRoom(fullText);
        const scopedParsed = AdvancedGameStateExtractor.parseScoped(fullText);
        this._lastHeuristicInteractables = scopedParsed.interactables;
        this._currentScopedText = scopedText;
        this._currentHeuristicHints = scopedParsed.interactables.map((i) => i.name);

        // 3. Check room AI cache for instant display on revisit
        const currentRoom = scopedParsed.location || this.previousRoom || '';
        const roomKey = currentRoom.trim().toLowerCase();
        const cached = this._roomAICache.get(roomKey);

        if (cached && !force) {
            // Show cached AI results in panel immediately
            const stateForPalette = {
                ...cached.structuredState,
                interactables: cached.interactables,
            };
            this.uiManager.updateCommandPalette(stateForPalette, this.gameStateManager.turnCount);
        } else {
            // Show scoped heuristic results (provisional)
            const currentStructured = this.gameStateManager.structuredGameState || {};
            const heuristicState = {
                ...currentStructured,
                interactables: scopedParsed.interactables,
            };
            this.uiManager.updateCommandPalette(heuristicState, this.gameStateManager.turnCount);
        }

        // 4. Full-text heuristic for inline annotations (broad coverage)
        const fullParsed = AdvancedGameStateExtractor.parse(fullText);
        this._annotateGameText(fullParsed.interactables);

        // 5. Reset AI debounce timer — fires after 2s of inactivity
        clearTimeout(this._aiDebounceTimer);
        this._aiDebounceTimer = setTimeout(() => {
            this._fireAIRequest(force);
        }, 2000);
    }

    async _fireAIRequest(force = false) {
        // Coalesce: if a request is already in flight, queue this one
        if (this._aiInFlight) {
            this._pendingAIForce = force;
            return;
        }

        this._aiInFlight = true;
        const currentRoom =
            this.gameStateManager.structuredGameState?.location || this.previousRoom || '';
        this._aiRequestRoomTag = currentRoom;
        this.uiManager.showAILoadingIndicator(true);

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
            this.uiManager.showAILoadingIndicator(false);
            this._aiInFlight = false;

            // If another request was queued while we were in flight, fire it now
            if (this._pendingAIForce !== null) {
                const queuedForce = this._pendingAIForce;
                this._pendingAIForce = null;
                this._fireAIRequest(queuedForce);
            }
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
                scopedText: this._currentScopedText,
                heuristicHints: this._currentHeuristicHints,
                force,
            });
        });
    }

    async _requestViaMessage(force) {
        const response = await chrome.runtime.sendMessage({
            action: 'getSuggestions',
            gameState: this.gameStateManager.rawGameState,
            scopedText: this._currentScopedText,
            heuristicHints: this._currentHeuristicHints,
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
        // Skip empty state if we already have valid data (AI provider failure)
        const hasNoLocation = !structuredState.location;
        const hadValidState = this.gameStateManager.structuredGameState?.location;
        if (hasNoLocation && hadValidState) {
            this.log('Skipping empty state update — preserving last-known-good state');
            return;
        }

        // Stale response guard: if AI response is for a different room than
        // where the player currently is, cache it but don't update the panel
        const responseRoom = structuredState.location || '';
        const currentRoom = this.previousRoom || '';
        const isStale =
            responseRoom &&
            currentRoom &&
            responseRoom.trim().toLowerCase() !== currentRoom.trim().toLowerCase() &&
            this._aiRequestRoomTag &&
            this._aiRequestRoomTag.trim().toLowerCase() !== currentRoom.trim().toLowerCase();

        // Always update map and NPC profiles even for stale responses
        this.gameStateManager.structuredGameState = structuredState;
        this.npcProfiler.updateProfiles(structuredState.npcProfiles);
        this._saveNpcsToStorage();
        if (structuredState.mapData) {
            const lastCommand =
                this.gameStateManager.commandHistory.length > 0
                    ? this.gameStateManager.commandHistory[
                          this.gameStateManager.commandHistory.length - 1
                      ]
                    : null;
            const direction = lastCommand ? this._extractDirection(lastCommand) : null;
            this.mapManager.updateMap(structuredState.mapData, this.previousRoom, direction);
            this.uiManager.renderMap();
            this._saveMapToStorage();
        }

        if (isStale) {
            this.log(
                `Stale AI response for "${responseRoom}" — player is in "${currentRoom}", caching only`
            );
            // Cache the response for the room it describes
            const staleRoomKey = responseRoom.trim().toLowerCase();
            if (staleRoomKey) {
                const stalePanel = InteractableMerger.replace(
                    structuredState.interactables || [],
                    []
                );
                this._roomAICache.set(staleRoomKey, {
                    interactables: stalePanel,
                    structuredState,
                    timestamp: Date.now(),
                });
            }
            return;
        }

        // Clear rejection blacklist when player moves to a new room
        if (structuredState.location && structuredState.location !== this.previousRoom) {
            this.gameStateManager.clearRejections();
        }

        this.previousRoom = structuredState.location;
        this.uiManager.setCurrentRoom(this.mapManager.getDisplayName(structuredState.location));
        await this.gameStateManager.mergeQuests();

        // Panel path: AI replaces heuristics (AI is authoritative for the panel)
        const panelInteractables = InteractableMerger.replace(
            structuredState.interactables || [],
            this._lastHeuristicInteractables
        );

        // Annotation path: union of AI + heuristic for broad text coverage
        const fullParsed = AdvancedGameStateExtractor.parse(
            this.gameStateManager.rawGameState.gameText || ''
        );
        this._lastAnnotationInteractables = InteractableMerger.merge(
            structuredState.interactables || [],
            fullParsed.interactables
        );

        // If replace produced nothing, fall back to last heuristic results
        const effectiveInteractables =
            panelInteractables.length > 0
                ? panelInteractables
                : this._lastHeuristicInteractables || [];

        // Add inventory items as interactables (so they're clickable when mentioned in text)
        const withInventory = this._addInventoryInteractables(
            effectiveInteractables,
            structuredState.inventory || []
        );

        // Accumulate entities across turns within the same room
        // AI results replace accumulated data; heuristics merge on top
        const isAIResponse = (structuredState.interactables || []).length > 0;
        const accumulatedInteractables = this._accumulateRoomInteractables(
            structuredState.location,
            withInventory,
            isAIResponse
        );

        // Filter interactables by rejection blacklist before rendering
        const filteredInteractables =
            this.gameStateManager.filterByRejections(accumulatedInteractables);
        const stateForPalette = { ...structuredState, interactables: filteredInteractables };
        this.uiManager.updateCommandPalette(stateForPalette, this.gameStateManager.turnCount);

        // Cache AI results for this room (for instant display on revisit)
        const cacheRoomKey = (structuredState.location || '').trim().toLowerCase();
        if (cacheRoomKey && isAIResponse) {
            this._roomAICache.set(cacheRoomKey, {
                interactables: filteredInteractables,
                structuredState,
                timestamp: Date.now(),
            });
        }

        // Show undo button if AI modified the heuristic list
        if (structuredState.location && this._lastHeuristicInteractables.length > 0) {
            this.uiManager.showUndoAIButton();
        }

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

        // Annotate game text with union of AI + heuristic for broader coverage
        this._annotateGameText(this._lastAnnotationInteractables || stateForPalette.interactables);
        this._saveMetaToStorage();
    }

    _extractDirection(command) {
        const normalized = command
            .toLowerCase()
            .replace(/^(go|walk|head|move)\s+/, '')
            .trim();
        const validDirections = new Set([
            'north',
            'south',
            'east',
            'west',
            'up',
            'down',
            'northeast',
            'northwest',
            'southeast',
            'southwest',
            'n',
            's',
            'e',
            'w',
            'ne',
            'nw',
            'se',
            'sw',
            'in',
            'out',
            'enter',
            'exit',
        ]);
        return validDirections.has(normalized) ? normalized : null;
    }

    /**
     * Add inventory items to the interactables list so they become clickable
     * whenever they appear in game text (e.g., "use the brass key on the door").
     */
    _addInventoryInteractables(interactables, inventory) {
        if (!inventory || inventory.length === 0) {
            return interactables;
        }
        const existingNames = new Set(interactables.map((i) => i.name.trim().toLowerCase()));
        const extras = [];
        for (const item of inventory) {
            const name = (typeof item === 'string' ? item : item.name || '').trim();
            if (!name || existingNames.has(name.toLowerCase())) {
                continue;
            }
            extras.push({
                name,
                type: 'object',
                actions: [
                    { command: `examine ${name}`, label: 'Examine', confidence: 0.85 },
                    { command: `drop ${name}`, label: 'Drop', confidence: 0.6 },
                    { command: `use ${name}`, label: 'Use', confidence: 0.55 },
                ],
            });
        }
        return [...interactables, ...extras];
    }

    /**
     * Accumulate interactables across turns within the same room.
     * If the player is still in the same room, merge new interactables with previously
     * known ones so entities from earlier turns aren't lost.
     * Clears cached data when the room changes.
     * When isAI is true, replaces accumulated data entirely (AI is authoritative).
     */
    _accumulateRoomInteractables(roomName, newInteractables, isAI = false) {
        const key = roomName || '_unknown';

        if (roomName !== this.previousRoom || isAI) {
            // Room changed or AI response arrived — start fresh
            this._roomInteractables.set(key, newInteractables);
            return newInteractables;
        }

        // Same room, heuristic update — merge with previous entities
        const existing = this._roomInteractables.get(key) || [];
        const accumulated = InteractableMerger.merge(newInteractables, existing);
        this._roomInteractables.set(key, accumulated);
        return accumulated;
    }

    _annotateGameText(interactables) {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        try {
            this.textAnnotator.annotate(interactables);
        } finally {
            const outputArea = this.gameStateManager.findOutputArea();
            if (outputArea && this.mutationObserver) {
                this.mutationObserver.observe(outputArea, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                });
            }
        }
    }

    static _STATE_CHANGING_VERBS = new Set([
        'take',
        'get',
        'pick',
        'drop',
        'put',
        'give',
        'open',
        'close',
        'lock',
        'unlock',
        'eat',
        'drink',
        'wear',
        'remove',
        'break',
        'push',
        'pull',
        'move',
        'attack',
        'kill',
        'turn',
        'light',
        'cut',
        'fill',
    ]);

    static _isStateChangingCommand(command) {
        if (!command) {
            return false;
        }
        const firstWord = command.trim().toLowerCase().split(/\s+/)[0];
        return ParchmentAssist._STATE_CHANGING_VERBS.has(firstWord);
    }

    _undoAIOptimization() {
        if (!this._lastHeuristicInteractables || !this._lastHeuristicInteractables.length) {
            return;
        }
        const currentStructured = this.gameStateManager.structuredGameState || {};
        const heuristicState = {
            ...currentStructured,
            interactables: this._lastHeuristicInteractables,
        };
        this.uiManager.updateCommandPalette(heuristicState, this.gameStateManager.turnCount);
        this.uiManager.hideUndoAIButton();
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
            const mapPayload = {
                graph: JSON.parse(JSON.stringify(this.mapManager.graph)),
                traversed: Array.from(this.mapManager.traversed),
                connectionMeta: JSON.parse(JSON.stringify(this.mapManager.connectionMeta)),
            };
            await chrome.storage.local.set({ [`map_${gameTitle}`]: mapPayload });
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
                const saved = result[key];
                // Support both old format (plain graph object) and new format (with traversed/connectionMeta)
                const graphData =
                    saved.graph && typeof saved.graph === 'object' && !Array.isArray(saved.graph)
                        ? saved.graph
                        : saved;
                // Migrate through addRoom to canonicalize keys and filter ignored rooms
                for (const roomKey in graphData) {
                    const room = graphData[roomKey];
                    if (!room || typeof room !== 'object') {
                        continue;
                    }
                    const name = room.displayName || roomKey;
                    this.mapManager.addRoom(name, {
                        items: room.items || [],
                        exits: room.exits || {},
                        status: room.status || 'visited',
                        description: room.description || '',
                    });
                }
                if (saved.traversed) {
                    this.mapManager.traversed = new Set(saved.traversed);
                }
                if (saved.connectionMeta) {
                    this.mapManager.connectionMeta = saved.connectionMeta;
                }
                this.uiManager.renderMap();
            }
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    async _saveNpcsToStorage() {
        const gameTitle = this.gameStateManager.rawGameState.gameTitle;
        if (!gameTitle) {
            return;
        }
        try {
            await chrome.storage.local.set({
                [`npc_${gameTitle}`]: JSON.parse(JSON.stringify(this.npcProfiler.npcProfiles)),
            });
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    async _loadNpcsFromStorage() {
        try {
            const gameTitle = document.title.replace(/ - Parchment/i, '').trim();
            if (!gameTitle) {
                return;
            }
            const result = await chrome.storage.local.get([`npc_${gameTitle}`]);
            const stored = result[`npc_${gameTitle}`];
            if (stored && typeof stored === 'object') {
                this.npcProfiler.npcProfiles = stored;
                this.uiManager.renderProfiles();
            }
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    async _saveMetaToStorage() {
        const gameTitle = this.gameStateManager.rawGameState.gameTitle;
        if (!gameTitle) {
            return;
        }
        try {
            await chrome.storage.local.set({
                [`meta_${gameTitle}`]: {
                    turnCount: this.gameStateManager.turnCount,
                    commandHistory: this.gameStateManager.commandHistory.slice(),
                    rejectedCommands: Array.from(this.gameStateManager.rejectedCommands.entries()),
                },
            });
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    async _loadMetaFromStorage() {
        try {
            const gameTitle = document.title.replace(/ - Parchment/i, '').trim();
            if (!gameTitle) {
                return;
            }
            const result = await chrome.storage.local.get([`meta_${gameTitle}`]);
            const meta = result[`meta_${gameTitle}`];
            if (meta) {
                // Detect stale session: if stored commands exist but the game
                // text doesn't contain the most recent one, the game was restarted
                const gameText = this.gameStateManager.rawGameState.gameText || '';
                const storedHistory = meta.commandHistory || [];
                const lastStoredCmd = storedHistory[storedHistory.length - 1];
                if (
                    lastStoredCmd &&
                    !gameText.toLowerCase().includes(lastStoredCmd.toLowerCase())
                ) {
                    return;
                }
                if (typeof meta.turnCount === 'number') {
                    this.gameStateManager.turnCount = meta.turnCount;
                }
                if (Array.isArray(meta.commandHistory)) {
                    this.gameStateManager.commandHistory = meta.commandHistory;
                }
                if (Array.isArray(meta.rejectedCommands)) {
                    this.gameStateManager.rejectedCommands = new Map(meta.rejectedCommands);
                }
            }
        } catch (_error) {
            // Not in extension environment or storage error
        }
    }

    _getCurrentSnapshot() {
        return {
            map: {
                graph: JSON.parse(JSON.stringify(this.mapManager.graph)),
                traversed: Array.from(this.mapManager.traversed),
                connectionMeta: JSON.parse(JSON.stringify(this.mapManager.connectionMeta)),
            },
            npcs: JSON.parse(JSON.stringify(this.npcProfiler.npcProfiles)),
            quests: JSON.parse(
                JSON.stringify(this.gameStateManager.structuredGameState?.quests || [])
            ),
            meta: {
                turnCount: this.gameStateManager.turnCount,
                commandHistory: this.gameStateManager.commandHistory.slice(),
                rejectedCommands: Array.from(this.gameStateManager.rejectedCommands.entries()),
            },
        };
    }

    async _applySnapshot(snapshot) {
        // Support both old format (plain graph) and new format (with traversed/connectionMeta)
        const mapData = snapshot.map;
        if (mapData.graph && typeof mapData.graph === 'object' && !Array.isArray(mapData.graph)) {
            this.mapManager.graph = JSON.parse(JSON.stringify(mapData.graph));
            this.mapManager.traversed = new Set(mapData.traversed || []);
            this.mapManager.connectionMeta = JSON.parse(
                JSON.stringify(mapData.connectionMeta || {})
            );
        } else {
            // Legacy snapshot: map is just the graph object
            this.mapManager.graph = JSON.parse(JSON.stringify(mapData));
        }
        this.npcProfiler.npcProfiles = JSON.parse(JSON.stringify(snapshot.npcs));
        if (this.gameStateManager.structuredGameState) {
            this.gameStateManager.structuredGameState.quests = JSON.parse(
                JSON.stringify(snapshot.quests)
            );
        }
        this.gameStateManager.turnCount = snapshot.meta.turnCount;
        this.gameStateManager.commandHistory = snapshot.meta.commandHistory.slice();
        this.gameStateManager.rejectedCommands = new Map(snapshot.meta.rejectedCommands || []);

        const gameTitle =
            this.gameStateManager.rawGameState?.gameTitle ||
            document.title.replace(/ - Parchment/i, '').trim();
        if (gameTitle) {
            try {
                await Promise.all([
                    chrome.storage.local.set({ [`map_${gameTitle}`]: snapshot.map }),
                    chrome.storage.local.set({ [`npc_${gameTitle}`]: snapshot.npcs }),
                    chrome.storage.local.set({ [`meta_${gameTitle}`]: snapshot.meta }),
                ]);
            } catch (_error) {
                // Not in extension environment or storage error
            }
        }
        this.uiManager.renderMap();
        this.uiManager.renderProfiles();
        if (this.gameStateManager.structuredGameState) {
            this.uiManager.updateCommandPalette(
                this.gameStateManager.structuredGameState,
                this.gameStateManager.turnCount
            );
        }
    }

    destroy() {
        this.isActive = false;
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        this.uiManager.destroy();
        this.textAnnotator.destroy();
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
