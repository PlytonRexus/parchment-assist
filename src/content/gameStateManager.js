import { HTMLCleaner } from '../helpers/htmlCleaner.js';

class GameStateManager {
    constructor() {
        this.rawGameState = {
            lastCommands: [],
            gameText: '',
            gameTitle: '',
        };
        this.structuredGameState = {};
        this.commandHistory = [];
        this.turnCount = 0;
        this.lastGameText = '';
        this._mergingQuests = false;
        this.rejectedCommands = new Map(); // command (lowercase) → rejection count
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

    findInputField() {
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

    recordCommand(command) {
        this.commandHistory.push(command);
        this.turnCount++;
        if (this.commandHistory.length > 10) {
            this.commandHistory = this.commandHistory.slice(-10);
        }
    }

    recordRejection(command) {
        if (!command) {
            return;
        }
        const normalized = command.trim().toLowerCase();
        this.rejectedCommands.set(normalized, (this.rejectedCommands.get(normalized) || 0) + 1);
    }

    clearRejections() {
        this.rejectedCommands.clear();
    }

    filterByRejections(interactables, threshold = 2) {
        if (!interactables) {
            return [];
        }
        const result = [];
        for (const item of interactables) {
            const filteredActions = (item.actions || []).filter((action) => {
                const normalized = (action.command || '').trim().toLowerCase();
                return (this.rejectedCommands.get(normalized) || 0) < threshold;
            });
            if (filteredActions.length > 0) {
                result.push({ ...item, actions: filteredActions });
            }
        }
        return result;
    }

    async extractRawGameState(force = false) {
        return new Promise((resolve) => {
            const outputArea = this.findOutputArea() || document.querySelector('#gameport');
            if (!outputArea) {
                resolve(null);
                return;
            }
            const gameHtml = outputArea.innerHTML;
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
            const stored = await chrome.storage.local.get([storageKey]);
            const savedQuests = stored[storageKey] || [];
            const newQuests = this.structuredGameState?.quests || [];

            const mergedQuests = [...savedQuests];
            newQuests.forEach((newQuest) => {
                const existingIndex = mergedQuests.findIndex(
                    (q) =>
                        q.description.toLowerCase().trim() ===
                        newQuest.description.toLowerCase().trim()
                );
                if (existingIndex !== -1) {
                    if (
                        newQuest.status === 'completed' &&
                        mergedQuests[existingIndex].status !== 'completed'
                    ) {
                        mergedQuests[existingIndex].status = 'completed';
                    }
                } else {
                    mergedQuests.push(newQuest);
                }
            });

            await chrome.storage.local.set({ [storageKey]: mergedQuests });
            this.structuredGameState.quests = mergedQuests;
        } catch (error) {
            console.log('[GameStateManager] Error merging quests:', error);
        } finally {
            this._mergingQuests = false;
        }
    }

    async clearJournal() {
        const gameTitle = this.rawGameState?.gameTitle || 'Unknown';
        const storageKey = `quests_${gameTitle}`;
        await chrome.storage.local.set({ [storageKey]: [] });
        if (this.structuredGameState) {
            this.structuredGameState.quests = [];
        }
    }
}

export { GameStateManager };
