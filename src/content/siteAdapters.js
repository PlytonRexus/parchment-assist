// Site adapter pattern: each adapter handles DOM detection and command submission
// for a specific IF game hosting platform.

function _makeEnterEvent() {
    return new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
    });
}

function _findFirst(selectors, filter) {
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && filter(el)) {
            return el;
        }
    }
    return null;
}

class IPlayIFAdapter {
    matches(hostname) {
        return hostname.includes('iplayif.com');
    }

    findInputField() {
        return _findFirst(
            [
                '#cmdline',
                'input[type="text"]',
                '#input',
                '.input',
                '#command-line-input',
                '.command-line',
                'input[placeholder*="command"]',
                'input[placeholder*="Command"]',
                'input[name="command"]',
                'textarea',
            ],
            (el) => el.offsetHeight > 0
        );
    }

    findOutputArea() {
        return _findFirst(
            [
                '#parchment',
                '.parchment',
                '#output',
                '.output',
                '#story',
                '.story',
                'pre',
                '.text-buffer',
                '#text-buffer',
                '#gameport',
                '.game-output',
            ],
            (el) => el.textContent.length > 10
        );
    }

    submitCommand(command, inputField) {
        inputField.value = command;
        inputField.focus();
        inputField.dispatchEvent(_makeEnterEvent());
    }
}

class TextAdventuresAdapter {
    matches(hostname) {
        return hostname.includes('textadventures.co.uk');
    }

    findInputField() {
        return _findFirst(
            ['#gameinput', 'input[type="text"]', 'textarea'],
            (el) => el.offsetHeight > 0
        );
    }

    findOutputArea() {
        return _findFirst(
            ['#transcriptitems', '#story', '#output', '.game-output'],
            (el) => el.textContent.length > 10
        );
    }

    submitCommand(command, inputField) {
        inputField.value = command;
        inputField.focus();
        const submitBtn = document.querySelector('#gameinputbutton');
        if (submitBtn) {
            submitBtn.click();
        } else {
            inputField.dispatchEvent(_makeEnterEvent());
        }
    }
}

class IFCompAdapter {
    matches(hostname) {
        return hostname.includes('ifcomp.org');
    }

    findInputField() {
        return _findFirst(
            ['#input', 'input[type="text"]', '#cmdline'],
            (el) => el.offsetHeight > 0
        );
    }

    findOutputArea() {
        return _findFirst(
            ['#parchment', '.parchment', '#output', '#story'],
            (el) => el.textContent.length > 10
        );
    }

    submitCommand(command, inputField) {
        inputField.value = command;
        inputField.focus();
        inputField.dispatchEvent(_makeEnterEvent());
    }
}

class GenericParchmentAdapter {
    matches() {
        return true;
    }

    findInputField() {
        return _findFirst(
            [
                '#cmdline',
                '#gameinput',
                '#input',
                'input[type="text"]',
                '.input',
                '#command-line-input',
                '.command-line',
                'input[placeholder*="command"]',
                'input[placeholder*="Command"]',
                'input[name="command"]',
                'textarea',
            ],
            (el) => el.offsetHeight > 0
        );
    }

    findOutputArea() {
        return _findFirst(
            [
                '#parchment',
                '.parchment',
                '#transcriptitems',
                '#output',
                '.output',
                '#story',
                '.story',
                'pre',
                '.text-buffer',
                '#text-buffer',
                '#gameport',
                '.game-output',
            ],
            (el) => el.textContent.length > 10
        );
    }

    submitCommand(command, inputField) {
        inputField.value = command;
        inputField.focus();
        inputField.dispatchEvent(_makeEnterEvent());
    }
}

const _ADAPTERS = [
    new IPlayIFAdapter(),
    new TextAdventuresAdapter(),
    new IFCompAdapter(),
    new GenericParchmentAdapter(),
];

export function detectAdapter(hostname) {
    return _ADAPTERS.find((a) => a.matches(hostname));
}

export { IPlayIFAdapter, TextAdventuresAdapter, IFCompAdapter, GenericParchmentAdapter };
