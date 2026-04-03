/**
 * ParserFeedbackDetector Unit Tests
 * Covers all rejection patterns, non-rejection pass-through, and edge cases.
 */

import { ParserFeedbackDetector } from '../../src/helpers/parserFeedback.js';

describe('ParserFeedbackDetector.detect()', () => {
    describe('rejection patterns', () => {
        const rejectionCases = [
            ["I don't understand that sentence.", "I don't understand"],
            ["You can't do that here.", "You can't do that"],
            ["That's not a verb I recognise.", 'not a verb I recognise'],
            ["That's not a verb I recognize.", 'not a verb I recognize'],
            ["I don't recognise that word.", "don't recognise that word"],
            ["I don't recognize that word.", "don't recognize that word"],
            ["I don't know the word 'frobnicate'.", "I don't know the word"],
            ["You can't go that way.", "You can't go that way"],
            ["You can't see any such thing.", "You can't see any such thing"],
            [
                'That sentence is not one I know how to parse.',
                'That sentence is not one I know how to parse',
            ],
            ['You only understood me as far as wanting to go.', 'You only understood me as far as'],
            ['I only understood you as far as wanting to take.', 'I only understood you as far as'],
            ['That command is not available in this context.', 'That command is not available'],
            [
                "You can't use multiple objects with that verb.",
                "You can't use multiple objects with that verb",
            ],
            ["That's not something you can do right now.", "That's not something you can"],
            [
                'There are several objects here that match that description.',
                'There are several objects here that match',
            ],
            ['I beg your pardon?', 'I beg your pardon'],
            [
                'You seem to want to talk to someone, but there is no one here.',
                'You seem to want to talk',
            ],
            ["I don't understand that command.", "I don't understand that command"],
            ["I'm not sure what you mean by that.", "I'm not sure what you mean"],
            ['Nothing happens.', 'Nothing happens'],
        ];

        test.each(rejectionCases)('detects rejection in: "%s"', (text) => {
            const result = ParserFeedbackDetector.detect(text);
            expect(result.rejected).toBe(true);
            expect(result.message).toBeTruthy();
        });

        test('returned message contains matched text from input', () => {
            const result = ParserFeedbackDetector.detect("I don't understand that sentence.");
            expect(result.message).toMatch(/understand/i);
        });

        test('returns matched fragment, not the full input text', () => {
            const fullText =
                "You walk into the room and hear a sound. I don't understand that command.";
            const result = ParserFeedbackDetector.detect(fullText);
            expect(result.rejected).toBe(true);
            expect(result.message.length).toBeLessThan(fullText.length);
        });
    });

    describe('non-rejection pass-through', () => {
        const normalCases = [
            'You are in the forest.',
            'You take the rusty sword.',
            'The door swings open.',
            'A friendly wizard greets you.',
            'You can see a key here.',
            'Your inventory contains: a lantern, a key.',
            'Obvious exits: north, south.',
            'The wizard says hello.',
            'You have been here before.',
            'Score: 10 of 100.',
        ];

        test.each(normalCases)('does not reject: "%s"', (text) => {
            const result = ParserFeedbackDetector.detect(text);
            expect(result.rejected).toBe(false);
            expect(result.message).toBe('');
        });
    });

    describe('edge cases', () => {
        test('returns not-rejected for empty string', () => {
            const result = ParserFeedbackDetector.detect('');
            expect(result.rejected).toBe(false);
            expect(result.message).toBe('');
        });

        test('returns not-rejected for null', () => {
            const result = ParserFeedbackDetector.detect(null);
            expect(result.rejected).toBe(false);
            expect(result.message).toBe('');
        });

        test('returns not-rejected for undefined', () => {
            const result = ParserFeedbackDetector.detect(undefined);
            expect(result.rejected).toBe(false);
            expect(result.message).toBe('');
        });

        test('partial word "understand" in non-rejection context is not matched', () => {
            // "misunderstand" should NOT trigger — requires word boundary
            const result = ParserFeedbackDetector.detect('I misunderstand things sometimes.');
            expect(result.rejected).toBe(false);
        });

        test('"Nothing happens" phrase specifically required — not just "nothing"', () => {
            // Phrase requires the full "Nothing happens" match
            const result = ParserFeedbackDetector.detect('The nothing here is profound.');
            expect(result.rejected).toBe(false);
        });

        test('detection is case-insensitive', () => {
            const result = ParserFeedbackDetector.detect("YOU CAN'T DO THAT.");
            expect(result.rejected).toBe(true);
        });

        test('rejection found anywhere in multi-line text', () => {
            const text =
                "You enter the room.\nYou see a table.\nYou can't do that here.\nThe table is wooden.";
            const result = ParserFeedbackDetector.detect(text);
            expect(result.rejected).toBe(true);
        });
    });
});
