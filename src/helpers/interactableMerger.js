/**
 * InteractableMerger — merges AI-provided interactables with locally-extracted ones.
 *
 * AI results are authoritative (better actions, context-aware confidence). Local results
 * fill gaps for entities the AI missed. Deduplication is by normalised name.
 */
export class InteractableMerger {
    /**
     * Replace mode: AI results are authoritative for the panel.
     * Returns only AI items when available, falls back to local when AI is empty.
     *
     * @param {Array} aiInteractables   - Interactables returned by LLM
     * @param {Array} localInteractables - Interactables from AdvancedGameStateExtractor
     * @returns {Array} AI interactables (or local as fallback)
     */
    static replace(aiInteractables, localInteractables) {
        const ai = Array.isArray(aiInteractables) ? aiInteractables : [];
        const local = Array.isArray(localInteractables) ? localInteractables : [];

        if (ai.length > 0) {
            return this._removeSubsumed(ai);
        }
        return this._removeSubsumed(local);
    }

    /**
     * Merge AI interactables with locally-extracted interactables (union mode).
     * AI entries win on name collision. Local entries are appended for anything not in AI list.
     * Use this for inline text annotations where broad coverage is desired.
     *
     * @param {Array} aiInteractables   - Interactables returned by LLM
     * @param {Array} localInteractables - Interactables from AdvancedGameStateExtractor
     * @returns {Array} merged interactables, AI-first
     */
    static merge(aiInteractables, localInteractables) {
        const ai = Array.isArray(aiInteractables) ? aiInteractables : [];
        const local = Array.isArray(localInteractables) ? localInteractables : [];

        // Build a set of normalised names already covered by AI
        const aiNames = new Set(ai.map((i) => this._normalise(i.name)));

        // Add local items that are not already covered
        const extras = local.filter((i) => !aiNames.has(this._normalise(i.name)));

        return this._removeSubsumed([...ai, ...extras]);
    }

    /**
     * Remove entries whose name is a strict substring of another entry's name.
     * E.g. "wall" is dropped when "stone wall" and "little stone wall" both exist.
     */
    static _removeSubsumed(interactables) {
        const names = interactables.map((i) => this._normalise(i.name));
        return interactables.filter((item, idx) => {
            const lower = names[idx];
            return !names.some((other, j) => j !== idx && other !== lower && other.includes(lower));
        });
    }

    static _normalise(name) {
        return (name || '').trim().toLowerCase();
    }
}
