/**
 * Site Adapters Unit Tests
 */

import { jest } from '@jest/globals';
import {
    IPlayIFAdapter,
    TextAdventuresAdapter,
    IFCompAdapter,
    GenericParchmentAdapter,
    detectAdapter,
} from '../../src/content/siteAdapters.js';

// Helper: create a visible input element (offsetHeight > 0)
function makeVisibleInput(id, type = 'text') {
    const el = document.createElement('input');
    el.type = type;
    if (id) {
        el.id = id;
    }
    Object.defineProperty(el, 'offsetHeight', { get: () => 20, configurable: true });
    return el;
}

// Helper: create an output element with enough text
function makeOutputEl(id, text = 'This is enough game text for the output area filter') {
    const el = document.createElement('div');
    if (id) {
        el.id = id;
    }
    el.textContent = text;
    return el;
}

afterEach(() => {
    document.body.innerHTML = '';
});

// ── matches() ────────────────────────────────────────────────────────────────

describe('IPlayIFAdapter.matches', () => {
    const adapter = new IPlayIFAdapter();

    test('returns true for iplayif.com', () => {
        expect(adapter.matches('iplayif.com')).toBe(true);
    });

    test('returns true for subdomain of iplayif.com', () => {
        expect(adapter.matches('www.iplayif.com')).toBe(true);
    });

    test('returns false for textadventures.co.uk', () => {
        expect(adapter.matches('textadventures.co.uk')).toBe(false);
    });

    test('returns false for ifcomp.org', () => {
        expect(adapter.matches('ifcomp.org')).toBe(false);
    });

    test('returns false for unknown domain', () => {
        expect(adapter.matches('example.com')).toBe(false);
    });
});

describe('TextAdventuresAdapter.matches', () => {
    const adapter = new TextAdventuresAdapter();

    test('returns true for textadventures.co.uk', () => {
        expect(adapter.matches('textadventures.co.uk')).toBe(true);
    });

    test('returns true for www.textadventures.co.uk', () => {
        expect(adapter.matches('www.textadventures.co.uk')).toBe(true);
    });

    test('returns false for iplayif.com', () => {
        expect(adapter.matches('iplayif.com')).toBe(false);
    });

    test('returns false for unknown domain', () => {
        expect(adapter.matches('example.com')).toBe(false);
    });
});

describe('IFCompAdapter.matches', () => {
    const adapter = new IFCompAdapter();

    test('returns true for ifcomp.org', () => {
        expect(adapter.matches('ifcomp.org')).toBe(true);
    });

    test('returns false for iplayif.com', () => {
        expect(adapter.matches('iplayif.com')).toBe(false);
    });

    test('returns false for textadventures.co.uk', () => {
        expect(adapter.matches('textadventures.co.uk')).toBe(false);
    });
});

describe('GenericParchmentAdapter.matches', () => {
    const adapter = new GenericParchmentAdapter();

    test('always returns true for any hostname', () => {
        expect(adapter.matches('example.com')).toBe(true);
        expect(adapter.matches('')).toBe(true);
        expect(adapter.matches('anything.else')).toBe(true);
    });
});

// ── detectAdapter() ───────────────────────────────────────────────────────────

describe('detectAdapter', () => {
    test('returns IPlayIFAdapter for iplayif.com', () => {
        const adapter = detectAdapter('iplayif.com');
        expect(adapter).toBeInstanceOf(IPlayIFAdapter);
    });

    test('returns TextAdventuresAdapter for textadventures.co.uk', () => {
        const adapter = detectAdapter('textadventures.co.uk');
        expect(adapter).toBeInstanceOf(TextAdventuresAdapter);
    });

    test('returns IFCompAdapter for ifcomp.org', () => {
        const adapter = detectAdapter('ifcomp.org');
        expect(adapter).toBeInstanceOf(IFCompAdapter);
    });

    test('returns GenericParchmentAdapter for unknown hostname', () => {
        const adapter = detectAdapter('unknown.example.com');
        expect(adapter).toBeInstanceOf(GenericParchmentAdapter);
    });

    test('always returns a non-null adapter', () => {
        expect(detectAdapter('')).not.toBeNull();
        expect(detectAdapter('random.site')).not.toBeNull();
    });
});

// ── findInputField() ──────────────────────────────────────────────────────────

describe('IPlayIFAdapter.findInputField', () => {
    const adapter = new IPlayIFAdapter();

    test('returns null when no visible input present (jsdom offsetHeight=0)', () => {
        document.body.innerHTML = '<input type="text" />';
        expect(adapter.findInputField()).toBeNull();
    });

    test('finds visible #cmdline input', () => {
        const el = makeVisibleInput('cmdline');
        document.body.appendChild(el);
        expect(adapter.findInputField()).toBe(el);
    });

    test('falls back to input[type=text] when visible', () => {
        const el = makeVisibleInput(null);
        document.body.appendChild(el);
        expect(adapter.findInputField()).toBe(el);
    });
});

describe('TextAdventuresAdapter.findInputField', () => {
    const adapter = new TextAdventuresAdapter();

    test('finds visible #gameinput first', () => {
        const el = makeVisibleInput('gameinput');
        document.body.appendChild(el);
        expect(adapter.findInputField()).toBe(el);
    });

    test('returns null when no visible input', () => {
        document.body.innerHTML = '<input id="gameinput" type="text" />';
        expect(adapter.findInputField()).toBeNull();
    });
});

describe('IFCompAdapter.findInputField', () => {
    const adapter = new IFCompAdapter();

    test('finds visible #input first', () => {
        const el = makeVisibleInput('input');
        document.body.appendChild(el);
        expect(adapter.findInputField()).toBe(el);
    });
});

describe('GenericParchmentAdapter.findInputField', () => {
    const adapter = new GenericParchmentAdapter();

    test('finds visible #gameinput (TextAdventures selector in generic union)', () => {
        const el = makeVisibleInput('gameinput');
        document.body.appendChild(el);
        expect(adapter.findInputField()).toBe(el);
    });

    test('returns null when no visible input exists', () => {
        document.body.innerHTML = '<input type="text" />';
        expect(adapter.findInputField()).toBeNull();
    });
});

// ── findOutputArea() ──────────────────────────────────────────────────────────

describe('IPlayIFAdapter.findOutputArea', () => {
    const adapter = new IPlayIFAdapter();

    test('finds #parchment with enough text', () => {
        const el = makeOutputEl('parchment');
        document.body.appendChild(el);
        expect(adapter.findOutputArea()).toBe(el);
    });

    test('returns null when text too short', () => {
        document.body.innerHTML = '<div id="parchment">hi</div>';
        expect(adapter.findOutputArea()).toBeNull();
    });
});

describe('TextAdventuresAdapter.findOutputArea', () => {
    const adapter = new TextAdventuresAdapter();

    test('finds #transcriptitems with enough text', () => {
        const el = makeOutputEl('transcriptitems');
        document.body.appendChild(el);
        expect(adapter.findOutputArea()).toBe(el);
    });

    test('falls back to #story', () => {
        const el = makeOutputEl('story');
        document.body.appendChild(el);
        expect(adapter.findOutputArea()).toBe(el);
    });
});

describe('IFCompAdapter.findOutputArea', () => {
    const adapter = new IFCompAdapter();

    test('finds #parchment with enough text', () => {
        const el = makeOutputEl('parchment');
        document.body.appendChild(el);
        expect(adapter.findOutputArea()).toBe(el);
    });
});

// ── submitCommand() ───────────────────────────────────────────────────────────

describe('IPlayIFAdapter.submitCommand', () => {
    const adapter = new IPlayIFAdapter();

    test('sets value, focuses, and dispatches Enter keydown', () => {
        const inputEl = document.createElement('input');
        const focusSpy = jest.spyOn(inputEl, 'focus');
        const events = [];
        inputEl.addEventListener('keydown', (e) => events.push(e.key));
        document.body.appendChild(inputEl);

        adapter.submitCommand('go north', inputEl);

        expect(inputEl.value).toBe('go north');
        expect(focusSpy).toHaveBeenCalled();
        expect(events).toContain('Enter');
    });
});

describe('IFCompAdapter.submitCommand', () => {
    const adapter = new IFCompAdapter();

    test('dispatches Enter keydown event', () => {
        const inputEl = document.createElement('input');
        const events = [];
        inputEl.addEventListener('keydown', (e) => events.push(e.key));
        document.body.appendChild(inputEl);

        adapter.submitCommand('take lamp', inputEl);

        expect(inputEl.value).toBe('take lamp');
        expect(events).toContain('Enter');
    });
});

describe('GenericParchmentAdapter.submitCommand', () => {
    const adapter = new GenericParchmentAdapter();

    test('dispatches Enter keydown event', () => {
        const inputEl = document.createElement('input');
        const events = [];
        inputEl.addEventListener('keydown', (e) => events.push(e.key));
        document.body.appendChild(inputEl);

        adapter.submitCommand('examine door', inputEl);

        expect(events).toContain('Enter');
    });
});

describe('TextAdventuresAdapter.submitCommand', () => {
    const adapter = new TextAdventuresAdapter();

    test('clicks #gameinputbutton when present', () => {
        const inputEl = document.createElement('input');
        inputEl.value = '';
        const btn = document.createElement('button');
        btn.id = 'gameinputbutton';
        const clickSpy = jest.spyOn(btn, 'click');
        document.body.appendChild(inputEl);
        document.body.appendChild(btn);

        adapter.submitCommand('go north', inputEl);

        expect(inputEl.value).toBe('go north');
        expect(clickSpy).toHaveBeenCalled();
    });

    test('falls back to Enter KeyboardEvent when #gameinputbutton absent', () => {
        const inputEl = document.createElement('input');
        const events = [];
        inputEl.addEventListener('keydown', (e) => events.push(e.key));
        document.body.appendChild(inputEl);

        adapter.submitCommand('examine chest', inputEl);

        expect(inputEl.value).toBe('examine chest');
        expect(events).toContain('Enter');
    });
});
