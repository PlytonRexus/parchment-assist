class UIManager {
    constructor({
        npcProfiler,
        mapManager,
        onCommandSubmit,
        onChoiceSubmit,
        onRefresh,
        onClearJournal,
    }) {
        this.npcProfiler = npcProfiler;
        this.mapManager = mapManager;
        this.onCommandSubmit = onCommandSubmit || (() => {});
        this.onChoiceSubmit = onChoiceSubmit || (() => {});
        this.onRefresh = onRefresh || (() => {});
        this.onClearJournal = onClearJournal || (() => {});

        this.commandPalette = null;
        this.bubble = null;
        this.npcModal = null;
        this.choiceMode = false;
        this.classicView = false;
        this.resizeSaveTimeout = null;
    }

    createCommandPalette() {
        if (this.bubble) {
            return;
        }

        this.bubble = document.createElement('div');
        this.bubble.id = 'parchment-assist-bubble';
        this.bubble.textContent = '🤖';
        this.bubble.setAttribute('role', 'button');
        this.bubble.setAttribute('aria-label', 'Toggle Parchment-Assist command palette');
        this.bubble.setAttribute('aria-expanded', 'false');
        this.bubble.setAttribute('tabindex', '0');
        document.body.appendChild(this.bubble);

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
                <button id="palette-classic-view-btn" class="classic-view-btn" aria-label="Toggle Classic View" title="Switch to Classic (verb/object) view">
                    <span class="classic-view-text">Classic</span>
                </button>
                <button id="palette-refresh-btn" aria-label="Refresh suggestions">🔄</button>
            </div>
            <div class="palette-content" role="tabpanel" id="palette-content" aria-labelledby="main-tab">
                <div id="palette-location" class="palette-info" role="status" aria-label="Current location"></div>
                <div id="palette-inventory" class="palette-info" role="status" aria-label="Inventory"></div>
                <div id="palette-turn-counter" class="palette-info" role="status" aria-label="Turn counter"></div>
                <div class="palette-section" id="interactables-section">
                    <h3 id="interactables-heading">What Can I Do?</h3>
                    <div id="palette-interactables" class="interactables-list" role="group" aria-labelledby="interactables-heading"></div>
                </div>
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

        this.commandPalette
            .querySelector('#palette-refresh-btn')
            .addEventListener('click', async () => {
                const refreshBtn = this.commandPalette?.querySelector('#palette-refresh-btn');
                if (refreshBtn) {
                    refreshBtn.classList.add('refreshing');
                    refreshBtn.disabled = true;
                }
                try {
                    await this.onRefresh();
                } finally {
                    if (refreshBtn) {
                        refreshBtn.classList.remove('refreshing');
                        refreshBtn.disabled = false;
                    }
                }
            });

        this.commandPalette
            .querySelector('#clear-journal-btn')
            .addEventListener('click', async () => {
                if (!confirm('Clear all journal entries? This cannot be undone.')) {
                    return;
                }
                try {
                    await this.onClearJournal();
                    const journalContainer = this.commandPalette?.querySelector('#palette-journal');
                    if (journalContainer) {
                        this.renderJournal(journalContainer, []);
                    }
                    this.showStatus('Journal cleared successfully', 'success');
                } catch (_error) {
                    this.showError('Failed to clear journal');
                }
            });

        this.commandPalette.querySelector('#palette-mode-toggle').addEventListener('click', () => {
            this.toggleChoiceMode();
        });

        this.commandPalette
            .querySelector('#palette-classic-view-btn')
            .addEventListener('click', () => {
                this.toggleClassicView();
            });

        this.setupPaletteResize();
        this.loadPaletteWidth();

        let resizeDebounceTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(() => {
                if (this.commandPalette && this.commandPalette.style.display === 'block') {
                    this.positionPalette();
                }
            }, 100);
        });

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

        if (left + paletteRect.width > viewportWidth) {
            left = bubbleRect.left - paletteRect.width - gap;
            if (left < 0) {
                left = viewportWidth - paletteRect.width - gap;
            }
        }

        if (top + paletteRect.height > viewportHeight) {
            top = viewportHeight - paletteRect.height - gap;
        }

        if (top < gap) {
            top = gap;
        }

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
            const newWidth = startWidth - delta;
            const constrainedWidth = Math.max(200, Math.min(500, newWidth));
            this.commandPalette.style.width = constrainedWidth + 'px';
            this.positionPalette();
        };

        const stopResize = async () => {
            if (!isResizing) {
                return;
            }
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const currentWidth = this.commandPalette.offsetWidth;
            try {
                await chrome.storage.sync.set({ paletteWidth: currentWidth });
            } catch (_error) {
                // Not in extension environment
            }
        };

        resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

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
                clearTimeout(this.resizeSaveTimeout);
                this.resizeSaveTimeout = setTimeout(async () => {
                    try {
                        await chrome.storage.sync.set({ paletteWidth: newWidth });
                    } catch (_error) {
                        // Not in extension environment
                    }
                }, 500);
            }
        });
    }

    async loadPaletteWidth() {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            return;
        }
        try {
            const result = await chrome.storage.sync.get([
                'paletteWidth',
                'choiceMode',
                'classicView',
            ]);
            if (result.paletteWidth) {
                const width = Math.max(200, Math.min(500, result.paletteWidth));
                this.commandPalette.style.width = width + 'px';
            }
            if (result.choiceMode !== undefined) {
                this.choiceMode = result.choiceMode;
                this.updateModeToggleUI();
            }
            if (result.classicView !== undefined) {
                this.classicView = result.classicView;
                this.updateClassicViewUI();
            }
        } catch (_error) {
            // Not in extension environment
        }
    }

    async toggleChoiceMode() {
        this.choiceMode = !this.choiceMode;
        this.updateModeToggleUI();
        try {
            await chrome.storage.sync.set({ choiceMode: this.choiceMode });
        } catch (_error) {
            // Not in extension environment
        }
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

    async toggleClassicView() {
        this.classicView = !this.classicView;
        this.updateClassicViewUI();
        try {
            await chrome.storage.sync.set({ classicView: this.classicView });
        } catch (_error) {
            // Not in extension environment
        }
    }

    updateClassicViewUI() {
        const btn = this.commandPalette?.querySelector('#palette-classic-view-btn');
        if (!btn) {
            return;
        }
        if (this.classicView) {
            btn.classList.add('classic-view-active');
            btn.setAttribute('title', 'Switch to Interactables view');
        } else {
            btn.classList.remove('classic-view-active');
            btn.setAttribute('title', 'Switch to Classic (verb/object) view');
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
        if (this.bubble) {
            this.bubble.setAttribute('aria-expanded', !isVisible);
        }
    }

    updateCommandPalette(state, turnCount) {
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
        content.querySelector('#palette-turn-counter').textContent = `Turn: ${turnCount ?? 0}`;

        const verbsSection = content.querySelector('#palette-verbs')?.parentElement;
        const objectsSection = content.querySelector('#palette-objects')?.parentElement;
        const npcsSection = content.querySelector('#palette-npcs')?.parentElement;
        const exitsSection = content.querySelector('#palette-exits')?.parentElement;
        const interactablesSection = content.querySelector('#interactables-section');
        const choicesSection = content.querySelector('#palette-choices-section');

        if (this.choiceMode) {
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
            if (interactablesSection) {
                interactablesSection.style.display = 'none';
            }

            let activeChoicesSection = choicesSection;
            if (!activeChoicesSection) {
                activeChoicesSection = document.createElement('div');
                activeChoicesSection.id = 'palette-choices-section';
                activeChoicesSection.className = 'palette-section';
                activeChoicesSection.innerHTML = `
                    <h3 id="choices-heading">Choices</h3>
                    <div id="palette-choices" class="palette-choices-list" role="group" aria-labelledby="choices-heading"></div>
                `;
                const turnCounter = content.querySelector('#palette-turn-counter');
                if (turnCounter) {
                    turnCounter.parentElement.insertBefore(
                        activeChoicesSection,
                        turnCounter.nextSibling
                    );
                }
            }
            activeChoicesSection.style.display = 'block';
            this.renderChoices(
                content.querySelector('#palette-choices'),
                state.suggestedActions || []
            );
        } else if (this.classicView) {
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
            if (interactablesSection) {
                interactablesSection.style.display = 'none';
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
        } else {
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
            if (interactablesSection) {
                interactablesSection.style.display = 'block';
            }
            if (choicesSection) {
                choicesSection.style.display = 'none';
            }

            this.renderInteractables(
                content.querySelector('#palette-interactables'),
                state.interactables || []
            );
        }

        this.renderJournal(content.querySelector('#palette-journal'), state.quests || []);
        this.renderList(
            this.commandPalette.querySelector('#palette-actions'),
            state.suggestedActions || [],
            'action'
        );
    }

    renderInteractables(container, interactables) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!interactables || interactables.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No interactable items found yet';
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            container.appendChild(emptyState);
            return;
        }

        interactables.forEach((interactable) => {
            const card = document.createElement('div');
            card.className = 'interactable-card';
            card.dataset.name = interactable.name;

            const header = document.createElement('div');
            header.className = 'interactable-header';
            header.setAttribute('role', 'button');
            header.setAttribute('tabindex', '0');
            header.setAttribute('aria-expanded', 'false');
            header.setAttribute('aria-label', `${interactable.name} — click to see actions`);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'interactable-name';
            nameSpan.textContent = interactable.name;

            const typeBadge = document.createElement('span');
            typeBadge.className = 'interactable-type-badge';
            typeBadge.textContent = interactable.type;

            header.appendChild(nameSpan);
            header.appendChild(typeBadge);

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'interactable-actions';
            actionsContainer.style.display = 'none';

            // Actions are already sorted by confidence in the service worker
            (interactable.actions || []).forEach((action) => {
                const btn = document.createElement('button');
                btn.className = 'action-button';
                btn.setAttribute('aria-label', action.label);

                const labelSpan = document.createElement('span');
                labelSpan.textContent = action.label;

                const confidenceIndicator = document.createElement('span');
                confidenceIndicator.className = 'confidence-indicator';
                confidenceIndicator.textContent = '●';
                confidenceIndicator.style.opacity = String(action.confidence);
                confidenceIndicator.setAttribute(
                    'aria-label',
                    `Confidence: ${Math.round(action.confidence * 100)}%`
                );

                btn.appendChild(labelSpan);
                btn.appendChild(confidenceIndicator);

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onCommandSubmit(action.command, 'action');
                });

                actionsContainer.appendChild(btn);
            });

            const toggleActions = () => {
                const isExpanded = actionsContainer.style.display !== 'none';
                actionsContainer.style.display = isExpanded ? 'none' : 'block';
                header.setAttribute('aria-expanded', String(!isExpanded));
            };

            header.addEventListener('click', toggleActions);
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleActions();
                }
            });

            card.appendChild(header);
            card.appendChild(actionsContainer);
            container.appendChild(card);
        });
    }

    renderList(container, items, type) {
        if (!container) {
            return;
        }

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
                element.addEventListener('click', () => this.onCommandSubmit(item.direction, type));
            } else {
                element.textContent = item;
                element.setAttribute('aria-label', `Use ${type}: ${item}`);
                element.addEventListener('click', () => this.onCommandSubmit(item, type));
            }

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

        if (!choices || choices.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Waiting for AI to suggest choices...';
            emptyState.setAttribute('role', 'status');
            emptyState.setAttribute('aria-live', 'polite');
            container.appendChild(emptyState);
            return;
        }

        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = choice;
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.setAttribute('aria-label', `Choice ${index + 1}: ${choice}`);

            button.addEventListener('click', () => {
                this.onChoiceSubmit(choice);
            });

            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.onChoiceSubmit(choice);
                }
            });

            container.appendChild(button);
        });
    }

    renderJournal(container, quests) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

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

        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);

        setTimeout(() => {
            toast.classList.add('toast-visible');
        }, 10);
    }

    showStatus(message, type = 'success') {
        console.log('Status:', message);

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

        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        setTimeout(() => {
            this.removeToast(toast);
        }, 3000);

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

    renderMap() {
        const roomListContainer = document.getElementById('room-list');
        if (!roomListContainer) {
            return;
        }

        const mapData = this.mapManager.getMap();
        roomListContainer.innerHTML = '';

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
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.setAttribute('role', 'listitem');
            roomCard.setAttribute('aria-label', `Room: ${roomName}`);

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
            if (mainContent) {
                mainContent.style.display = 'block';
            }
        }
    }

    showOnboarding(aiStatus, onGetStartedClick) {
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

        const closeOnboarding = () => {
            overlay.classList.add('onboarding-hiding');
            setTimeout(() => {
                overlay.remove();
            }, 300);
            try {
                chrome.storage.sync.set({ hasSeenOnboarding: true });
            } catch (_error) {
                // Not in extension environment
            }
        };

        overlay.querySelector('.onboarding-close').addEventListener('click', closeOnboarding);

        overlay.querySelector('#onboarding-open-settings').addEventListener('click', () => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (_error) {
                // Not in extension environment
            }
        });

        overlay.querySelector('#onboarding-get-started').addEventListener('click', async () => {
            const currentStatus = await onGetStartedClick();
            if (!currentStatus.configured) {
                try {
                    chrome.runtime.openOptionsPage();
                } catch (_error) {
                    // Not in extension environment
                }
                this.showStatus(
                    'Please configure an AI backend (Gemini or Ollama) to use Parchment-Assist',
                    'info'
                );
            } else {
                closeOnboarding();
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

        overlay.querySelector('.onboarding-backdrop').addEventListener('click', closeOnboarding);

        setTimeout(() => {
            overlay.classList.add('onboarding-visible');
        }, 10);
    }

    showConfigWarningBadge() {
        if (document.getElementById('parchment-assist-config-warning')) {
            return;
        }

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

        const refreshBtn = paletteHeader.querySelector('#palette-refresh-btn');
        if (refreshBtn) {
            paletteHeader.insertBefore(warningBadge, refreshBtn);
        } else {
            paletteHeader.appendChild(warningBadge);
        }

        warningBadge.addEventListener('click', () => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (_error) {
                // Not in extension environment
            }
            this.showStatus('Please configure an AI backend (Gemini or Ollama)', 'info');
        });

        warningBadge.style.animation = 'pulse-warning 2s ease-in-out infinite';
    }

    destroy() {
        if (this.commandPalette && this.commandPalette.parentNode) {
            this.commandPalette.parentNode.removeChild(this.commandPalette);
        }
        if (this.bubble && this.bubble.parentNode) {
            this.bubble.parentNode.removeChild(this.bubble);
        }
        if (this.npcModal && this.npcModal.parentNode) {
            this.npcModal.parentNode.removeChild(this.npcModal);
        }
    }
}

export { UIManager };
