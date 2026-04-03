class CommandExecutor {
    constructor({ findInputField, onError }) {
        this.findInputField = findInputField;
        this.onError = onError || (() => {});
    }

    submitCommand(command) {
        const inputField = this.findInputField();
        if (!inputField) {
            this.onError('Could not find input field');
            return false;
        }
        inputField.value = command;
        inputField.focus();
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
        });
        inputField.dispatchEvent(enterEvent);
        return true;
    }

    appendToInput(text) {
        const inputField = this.findInputField();
        if (!inputField) {
            return;
        }
        const currentValue = inputField.value.trim();
        inputField.value = currentValue === '' ? text : `${currentValue} ${text}`;
        inputField.focus();
    }

    populateInput(command) {
        const inputField = this.findInputField();
        if (!inputField) {
            return;
        }
        inputField.value = command;
        inputField.focus();
    }
}

export { CommandExecutor };
