/**
 * TextAnnotator Feature Tests
 * Covers: annotation correctness, span attributes, hover popup, click-to-execute, edge cases.
 */

import { jest } from '@jest/globals';
import { TextAnnotator } from '../../src/content/textAnnotator.js';

function makeOutputArea(html) {
    const div = document.createElement('div');
    div.id = 'output';
    div.innerHTML = html;
    document.body.appendChild(div);
    return div;
}

function makeAnnotator(overrides = {}) {
    const onChoiceSubmit = overrides.onChoiceSubmit || jest.fn();
    const ta = new TextAnnotator({ onChoiceSubmit });
    return { ta, onChoiceSubmit };
}

const sampleInteractables = [
    {
        name: 'rusty key',
        type: 'object',
        actions: [
            { label: 'Take', command: 'take rusty key', confidence: 0.95 },
            { label: 'Examine', command: 'examine rusty key', confidence: 0.9 },
        ],
    },
    {
        name: 'key',
        type: 'object',
        actions: [{ label: 'Take', command: 'take key', confidence: 0.8 }],
    },
    {
        name: 'north',
        type: 'exit',
        actions: [{ label: 'Go north', command: 'go north', confidence: 0.98 }],
    },
];

// ── Group A: Annotation Correctness ──────────────────────────────────────────

describe('TextAnnotator annotation correctness', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('A1 — wraps matching text in .pa-interactive span', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">You see a rusty key on the table.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(1);
    });

    test('A2 — case-insensitive matching preserves original casing', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">You see a Rusty Key here.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        const span = outputArea.querySelector('.pa-interactive');
        expect(span).not.toBeNull();
        expect(span.textContent).toBe('Rusty Key');
    });

    test('A3 — word boundary: does not match partial words', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">A monkey swings from the monkey-bars.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([{ name: 'monk', type: 'object', actions: [] }]);
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(0);
    });

    test('A4 — longest-first prevents shorter name from shadowing longer', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">Pick up the rusty key carefully.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        // both "rusty key" and "key" in interactables
        ta.annotate(sampleInteractables);
        const spans = outputArea.querySelectorAll('.pa-interactive');
        expect(spans.length).toBe(1);
        expect(spans[0].dataset.name).toBe('rusty key');
    });

    test('A5 — no double-wrapping on second annotate call', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        ta.annotate([sampleInteractables[0]]);
        const spans = outputArea.querySelectorAll('.pa-interactive');
        // Should still be exactly 1, not nested
        expect(spans.length).toBe(1);
        expect(spans[0].querySelector('.pa-interactive')).toBeNull();
    });

    test('A6 — re-annotate with different interactable clears previous spans', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">Go north to find the rusty key.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]); // annotate "rusty key"
        ta.annotate([sampleInteractables[2]]); // re-annotate with "north" only
        const spans = outputArea.querySelectorAll('.pa-interactive');
        const names = Array.from(spans).map((s) => s.dataset.name);
        expect(names).not.toContain('rusty key');
        expect(names).toContain('north');
    });

    test('A7 — empty interactables array produces no spans', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([]);
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(0);
    });

    test('A8 — null interactables does not throw', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">Some text.</div>');
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        expect(() => ta.annotate(null)).not.toThrow();
        expect(() => ta.annotate(undefined)).not.toThrow();
    });

    test('A9 — multiple distinct matches in the same buffer line', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">Go north to find the rusty key.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0], sampleInteractables[2]]); // "rusty key" + "north"
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(2);
    });

    test('A10 — text outside output area is not annotated', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const outside = document.createElement('div');
        outside.textContent = 'rusty key';
        document.body.appendChild(outside);

        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);

        // Outside div should have no spans
        expect(outside.querySelectorAll('.pa-interactive').length).toBe(0);
    });
});

// ── Group B: Span Attributes ──────────────────────────────────────────────────

describe('TextAnnotator span attributes', () => {
    let outputArea;
    let ta;

    beforeEach(() => {
        document.body.innerHTML = '';
        outputArea = makeOutputArea(
            '<div class="BufferLine">You see a rusty key on the floor.</div>'
        );
        ({ ta } = makeAnnotator());
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('B1 — span has class pa-interactive', () => {
        const span = outputArea.querySelector('.pa-interactive');
        expect(span.classList.contains('pa-interactive')).toBe(true);
    });

    test('B2 — span data-name matches interactable name', () => {
        const span = outputArea.querySelector('.pa-interactive');
        expect(span.dataset.name).toBe('rusty key');
    });

    test('B3 — span data-type matches interactable type', () => {
        const span = outputArea.querySelector('.pa-interactive');
        expect(span.dataset.type).toBe('object');
    });

    test('B4 — span data-actions is valid JSON with correct structure', () => {
        const span = outputArea.querySelector('.pa-interactive');
        let actions;
        expect(() => {
            actions = JSON.parse(span.dataset.actions);
        }).not.toThrow();
        expect(Array.isArray(actions)).toBe(true);
        expect(actions.length).toBe(2);
        expect(actions[0].command).toBe('take rusty key');
    });
});

// ── Group C: Hover Popup ──────────────────────────────────────────────────────

describe('TextAnnotator hover popup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    function setupAndAnnotate() {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">You see a rusty key here.</div>'
        );
        const { ta, onChoiceSubmit } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        const span = outputArea.querySelector('.pa-interactive');
        return { ta, onChoiceSubmit, outputArea, span };
    }

    test('C1 — mouseover on .pa-interactive shows popup', () => {
        const { outputArea, span } = setupAndAnnotate();
        span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, target: span }));
        // The event is dispatched on span but bubbles to outputArea — simulate via outputArea
        // We need the event's target to be the span
        const event = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(event, 'target', { value: span });
        outputArea.dispatchEvent(event);
        expect(document.querySelector('.pa-action-popup')).not.toBeNull();
    });

    test('C2 — popup contains correct number of buttons', () => {
        const { outputArea, span } = setupAndAnnotate();
        const event = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(event, 'target', { value: span });
        outputArea.dispatchEvent(event);
        const popup = document.querySelector('.pa-action-popup');
        expect(popup.querySelectorAll('.pa-action-popup-btn').length).toBe(2);
    });

    test('C3 — button labels match action labels', () => {
        const { outputArea, span } = setupAndAnnotate();
        const event = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(event, 'target', { value: span });
        outputArea.dispatchEvent(event);
        const btns = document.querySelectorAll('.pa-action-popup-btn');
        expect(btns[0].textContent).toBe('Take');
        expect(btns[1].textContent).toBe('Examine');
    });

    test('C4 — popup is still present immediately after mouseout', () => {
        const { outputArea, span } = setupAndAnnotate();
        const overEvent = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(overEvent, 'target', { value: span });
        outputArea.dispatchEvent(overEvent);

        const outEvent = new MouseEvent('mouseout', {
            bubbles: true,
            relatedTarget: document.body,
        });
        Object.defineProperty(outEvent, 'target', { value: span });
        outputArea.dispatchEvent(outEvent);

        // Timer not yet elapsed — popup should still be present
        expect(document.querySelector('.pa-action-popup')).not.toBeNull();
    });

    test('C5 — popup is hidden after hide timer elapses', () => {
        const { outputArea, span } = setupAndAnnotate();
        const overEvent = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(overEvent, 'target', { value: span });
        outputArea.dispatchEvent(overEvent);

        const outEvent = new MouseEvent('mouseout', {
            bubbles: true,
            relatedTarget: document.body,
        });
        Object.defineProperty(outEvent, 'target', { value: span });
        outputArea.dispatchEvent(outEvent);

        jest.advanceTimersByTime(200);
        expect(document.querySelector('.pa-action-popup')).toBeNull();
    });

    test('C6 — mouseover on popup cancels hide timer', () => {
        const { outputArea, span } = setupAndAnnotate();

        // Show popup
        const overEvent = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(overEvent, 'target', { value: span });
        outputArea.dispatchEvent(overEvent);

        // Start hide timer via mouseout from span
        const outEvent = new MouseEvent('mouseout', {
            bubbles: true,
            relatedTarget: document.body,
        });
        Object.defineProperty(outEvent, 'target', { value: span });
        outputArea.dispatchEvent(outEvent);

        // Mouse enters popup — cancel the hide timer
        const popup = document.querySelector('.pa-action-popup');
        popup.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        jest.advanceTimersByTime(200);
        // Popup should still be present
        expect(document.querySelector('.pa-action-popup')).not.toBeNull();
    });
});

// ── Group D: Click-to-Execute ─────────────────────────────────────────────────

describe('TextAnnotator click-to-execute', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    function getPopup(outputArea, span) {
        const event = new MouseEvent('mouseover', { bubbles: true });
        Object.defineProperty(event, 'target', { value: span });
        outputArea.dispatchEvent(event);
        return document.querySelector('.pa-action-popup');
    }

    test('D1 — clicking first popup button calls onChoiceSubmit with correct command', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const { ta, onChoiceSubmit } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        const span = outputArea.querySelector('.pa-interactive');
        const popup = getPopup(outputArea, span);
        popup.querySelector('.pa-action-popup-btn').click();
        expect(onChoiceSubmit).toHaveBeenCalledWith('take rusty key');
    });

    test('D2 — clicking a button dismisses the popup', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        const span = outputArea.querySelector('.pa-interactive');
        const popup = getPopup(outputArea, span);
        popup.querySelector('.pa-action-popup-btn').click();
        expect(document.querySelector('.pa-action-popup')).toBeNull();
    });

    test('D3 — clicking second button calls onChoiceSubmit with second command', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">You see a rusty key.</div>');
        const { ta, onChoiceSubmit } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        const span = outputArea.querySelector('.pa-interactive');
        const popup = getPopup(outputArea, span);
        const btns = popup.querySelectorAll('.pa-action-popup-btn');
        btns[1].click();
        expect(onChoiceSubmit).toHaveBeenCalledWith('examine rusty key');
    });
});

// ── Group E: Edge Cases & Lifecycle ──────────────────────────────────────────

describe('TextAnnotator edge cases and lifecycle', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('E1 — clearAnnotations restores original text content', () => {
        const originalText = 'You see a rusty key on the table.';
        const outputArea = makeOutputArea(`<div class="BufferLine">${originalText}</div>`);
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(1);

        ta.annotate([]); // _clearAnnotations is called internally
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(0);
        expect(outputArea.querySelector('.BufferLine').textContent).toBe(originalText);
    });

    test('E2 — annotate without setupHoverListeners does not throw', () => {
        const { ta } = makeAnnotator();
        // _outputArea is null — should return early without throwing
        expect(() => ta.annotate(sampleInteractables)).not.toThrow();
    });

    test('E3 — destroy removes event listeners and clears annotations', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">You see a rusty key here.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]);
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(1);

        ta.destroy();

        // Annotations should be cleared
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(0);

        // Mouseover after destroy should not create a popup
        const event = new MouseEvent('mouseover', { bubbles: true });
        outputArea.dispatchEvent(event);
        expect(document.querySelector('.pa-action-popup')).toBeNull();
    });

    test('E4 — destroy is safe to call multiple times', () => {
        const outputArea = makeOutputArea('<div class="BufferLine">Some text.</div>');
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        expect(() => {
            ta.destroy();
            ta.destroy();
        }).not.toThrow();
    });

    test('E5 — buffer line with no matching text is left unchanged', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">A dark cave stretches before you.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([sampleInteractables[0]]); // "rusty key" not in text
        expect(outputArea.querySelectorAll('.pa-interactive').length).toBe(0);
        expect(outputArea.querySelector('.BufferLine').textContent).toBe(
            'A dark cave stretches before you.'
        );
    });

    test('E6 — interactable name with regex-special characters is handled safely', () => {
        const outputArea = makeOutputArea(
            '<div class="BufferLine">You find 3.5 gold coins on the ground.</div>'
        );
        const { ta } = makeAnnotator();
        ta.setupHoverListeners(outputArea);
        ta.annotate([
            {
                name: '3.5 gold',
                type: 'object',
                actions: [{ label: 'Take', command: 'take 3.5 gold', confidence: 0.9 }],
            },
        ]);
        const span = outputArea.querySelector('.pa-interactive');
        expect(span).not.toBeNull();
        expect(span.dataset.name).toBe('3.5 gold');
    });
});
