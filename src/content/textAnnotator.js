class TextAnnotator {
    constructor({ onChoiceSubmit }) {
        this.onChoiceSubmit = onChoiceSubmit || (() => {});
        this._outputArea = null;
        this._popup = null;
        this._hideTimer = null;

        // Bind handlers so removeEventListener can match by reference
        this._onSpanMouseover = this._onSpanMouseover.bind(this);
        this._onSpanMouseout = this._onSpanMouseout.bind(this);
    }

    setupHoverListeners(outputArea) {
        this._outputArea = outputArea;
        outputArea.addEventListener('mouseover', this._onSpanMouseover);
        outputArea.addEventListener('mouseout', this._onSpanMouseout);
    }

    annotate(interactables) {
        if (!interactables || !this._outputArea) {
            return;
        }

        this._clearAnnotations();

        if (interactables.length === 0) {
            return;
        }

        // Sort longest-first so "rusty key" is matched before "key"
        const sorted = interactables.slice().sort((a, b) => b.name.length - a.name.length);

        const lines = this._outputArea.querySelectorAll('.BufferLine');
        if (lines.length === 0) {
            // Fallback: annotate the whole output area
            this._annotateNode(this._outputArea, sorted);
        } else {
            for (const line of lines) {
                this._annotateNode(line, sorted);
            }
        }
    }

    _clearAnnotations() {
        if (!this._outputArea) {
            return;
        }
        const spans = this._outputArea.querySelectorAll('.pa-interactive');
        for (const span of spans) {
            span.replaceWith(...span.childNodes);
        }
        this._hidePopup();
    }

    _annotateNode(root, sortedInteractables) {
        // Collect text nodes first — modifying DOM during tree walk is unsafe
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!node.parentElement?.classList.contains('pa-interactive')) {
                textNodes.push(node);
            }
        }

        for (const textNode of textNodes) {
            this._processTextNode(textNode, sortedInteractables);
        }
    }

    _processTextNode(textNode, sortedInteractables) {
        const text = textNode.textContent;

        // Build consumed ranges: [start, end, interactable]
        const consumed = [];

        for (const item of sortedInteractables) {
            const escaped = this._escapeRegex(item.name);
            const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                // Skip if overlaps any already-consumed range
                const overlaps = consumed.some(([cs, ce]) => start < ce && end > cs);
                if (!overlaps) {
                    consumed.push([start, end, item]);
                }
            }
        }

        if (consumed.length === 0) {
            return; // No matches — leave text node untouched
        }

        consumed.sort((a, b) => a[0] - b[0]);

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        for (const [start, end, item] of consumed) {
            // Text before this match
            if (start > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }

            const span = document.createElement('span');
            span.className = 'pa-interactive';
            span.textContent = text.slice(start, end);
            span.dataset.name = item.name;
            span.dataset.type = item.type || '';
            span.dataset.actions = JSON.stringify(item.actions || []);
            fragment.appendChild(span);

            lastIndex = end;
        }

        // Remaining text
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _onSpanMouseover(e) {
        const span = e.target.closest('.pa-interactive');
        if (!span) {
            return;
        }
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
        let actions = [];
        try {
            actions = JSON.parse(span.dataset.actions || '[]');
        } catch {
            actions = [];
        }
        this._showPopup(span, actions);
    }

    _onSpanMouseout(e) {
        const span = e.target.closest('.pa-interactive');
        if (!span) {
            return;
        }
        // If moving into the popup, don't hide
        if (this._popup && this._popup.contains(e.relatedTarget)) {
            return;
        }
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => this._hidePopup(), 150);
    }

    _showPopup(anchorSpan, actions) {
        this._hidePopup();

        if (!actions || actions.length === 0) {
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'pa-action-popup';

        // Cancel hide when mouse enters popup
        popup.addEventListener('mouseover', () => {
            clearTimeout(this._hideTimer);
            this._hideTimer = null;
        });

        // Start hide when mouse leaves popup (unless moving to a span)
        popup.addEventListener('mouseout', (e) => {
            if (e.relatedTarget?.closest('.pa-interactive')) {
                return;
            }
            clearTimeout(this._hideTimer);
            this._hideTimer = setTimeout(() => this._hidePopup(), 150);
        });

        for (const action of actions) {
            const btn = document.createElement('button');
            btn.className = 'pa-action-popup-btn';
            btn.textContent = action.label || action.command;
            btn.title = action.command;
            btn.addEventListener('click', () => {
                this.onChoiceSubmit(action.command);
                this._hidePopup();
            });
            popup.appendChild(btn);
        }

        document.body.appendChild(popup);
        this._popup = popup;
        this._positionPopup(anchorSpan);
    }

    _positionPopup(anchorSpan) {
        const rect = anchorSpan.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const scrollX = window.scrollX || window.pageXOffset || 0;
        this._popup.style.position = 'absolute';
        this._popup.style.top = `${rect.bottom + scrollY + 4}px`;
        this._popup.style.left = `${rect.left + scrollX}px`;
    }

    _hidePopup() {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }
    }

    destroy() {
        if (this._outputArea) {
            this._outputArea.removeEventListener('mouseover', this._onSpanMouseover);
            this._outputArea.removeEventListener('mouseout', this._onSpanMouseout);
        }
        this._clearAnnotations();
        this._hidePopup();
        this._outputArea = null;
    }
}

export { TextAnnotator };
