/**
 * CommandExecutor Unit Tests
 */

import { jest } from '@jest/globals';
import { CommandExecutor } from '../../src/content/commandExecutor.js';

describe('CommandExecutor', () => {
    let inputField;
    let findInputField;
    let onError;
    let executor;

    beforeEach(() => {
        document.body.innerHTML = '<input type="text" id="cmd" />';
        inputField = document.getElementById('cmd');
        findInputField = jest.fn(() => inputField);
        onError = jest.fn();
        executor = new CommandExecutor({ findInputField, onError });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('submitCommand', () => {
        test('should set input value and dispatch Enter keydown event', () => {
            const events = [];
            inputField.addEventListener('keydown', (e) => events.push(e.key));

            const result = executor.submitCommand('look');

            expect(result).toBe(true);
            expect(inputField.value).toBe('look');
            expect(events).toContain('Enter');
        });

        test('should call onError and return false when no input field', () => {
            findInputField.mockReturnValue(null);
            const result = executor.submitCommand('look');

            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledWith('Could not find input field');
        });

        test('should focus the input field', () => {
            const focusSpy = jest.spyOn(inputField, 'focus');
            executor.submitCommand('examine key');
            expect(focusSpy).toHaveBeenCalled();
        });
    });

    describe('appendToInput', () => {
        test('should set value directly when input is empty', () => {
            inputField.value = '';
            executor.appendToInput('LOOK');
            expect(inputField.value).toBe('LOOK');
        });

        test('should append with space when input already has text', () => {
            inputField.value = 'EXAMINE';
            executor.appendToInput('KEY');
            expect(inputField.value).toBe('EXAMINE KEY');
        });

        test('should trim existing value before appending', () => {
            inputField.value = '  EXAMINE  ';
            executor.appendToInput('KEY');
            expect(inputField.value).toBe('EXAMINE KEY');
        });

        test('should do nothing when no input field', () => {
            findInputField.mockReturnValue(null);
            expect(() => executor.appendToInput('LOOK')).not.toThrow();
        });

        test('should focus the input field', () => {
            const focusSpy = jest.spyOn(inputField, 'focus');
            executor.appendToInput('north');
            expect(focusSpy).toHaveBeenCalled();
        });
    });

    describe('populateInput', () => {
        test('should set full input value', () => {
            executor.populateInput('take rusty key');
            expect(inputField.value).toBe('take rusty key');
        });

        test('should overwrite existing value', () => {
            inputField.value = 'old text';
            executor.populateInput('new command');
            expect(inputField.value).toBe('new command');
        });

        test('should do nothing when no input field', () => {
            findInputField.mockReturnValue(null);
            expect(() => executor.populateInput('look')).not.toThrow();
        });

        test('should focus the input field', () => {
            const focusSpy = jest.spyOn(inputField, 'focus');
            executor.populateInput('north');
            expect(focusSpy).toHaveBeenCalled();
        });
    });

    describe('constructor defaults', () => {
        test('should work without onError callback', () => {
            const exec = new CommandExecutor({ findInputField: jest.fn(() => null) });
            expect(() => exec.submitCommand('look')).not.toThrow();
        });
    });

    describe('submitAction adapter delegation', () => {
        test('calls submitAction instead of KeyboardEvent when provided', () => {
            const submitAction = jest.fn();
            const exec = new CommandExecutor({ findInputField, onError, submitAction });
            exec.submitCommand('go north');
            expect(submitAction).toHaveBeenCalledWith('go north', inputField);
        });

        test('does not dispatch KeyboardEvent when submitAction is provided', () => {
            const submitAction = jest.fn();
            const exec = new CommandExecutor({ findInputField, onError, submitAction });
            const events = [];
            inputField.addEventListener('keydown', (e) => events.push(e.key));
            exec.submitCommand('look');
            expect(events).toHaveLength(0);
        });

        test('falls back to KeyboardEvent when submitAction is not provided', () => {
            const events = [];
            inputField.addEventListener('keydown', (e) => events.push(e.key));
            executor.submitCommand('look');
            expect(events).toContain('Enter');
        });
    });
});
