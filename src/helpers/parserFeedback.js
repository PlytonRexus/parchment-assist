// Parser Feedback Detector
// Detects when a Z-machine / Inform parser rejects a player command

export class ParserFeedbackDetector {
    static REJECTION_PATTERNS = [
        /\bI don['']t understand\b/i,
        /\bYou can['']t do that\b/i,
        /\bThat['']s not a verb I recogni[sz]e\b/i,
        /\bI don['']t recogni[sz]e that word\b/i,
        /\bI don['']t know the word\b/i,
        /\bYou can['']t go that way\b/i,
        /\bYou can['']t see any such thing\b/i,
        /\bThat sentence is not one I know how to parse\b/i,
        /\bYou only understood me as far as\b/i,
        /\bI only understood you as far as\b/i,
        /\bThat command is not available\b/i,
        /\bYou can['']t use multiple objects with that verb\b/i,
        /\bThat['']s not something you can\b/i,
        /\bThere are several objects here that match\b/i,
        /\bI beg your pardon\b/i,
        /\bYou seem to want to talk\b/i,
        /\bI don['']t understand that command\b/i,
        /\bI['']m not sure what you mean\b/i,
        /\bNothing happens\b/i,
    ];

    /**
     * Check whether game output text contains a parser rejection.
     * @param {string} text - Game output text to analyse.
     * @returns {{ rejected: boolean, message: string }} - `message` is the matched fragment.
     */
    static detect(text) {
        if (!text) {
            return { rejected: false, message: '' };
        }

        for (const pattern of ParserFeedbackDetector.REJECTION_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                return { rejected: true, message: match[0] };
            }
        }

        return { rejected: false, message: '' };
    }
}
