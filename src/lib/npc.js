function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

class NpcProfiler {
    constructor() {
        this.npcProfiles = {};
    }

    updateProfiles(newNpcs) {
        if (!newNpcs || typeof newNpcs !== 'object') {
            return;
        }

        for (const npcName in newNpcs) {
            if (this.npcProfiles[npcName]) {
                this._deepMerge(this.npcProfiles[npcName], newNpcs[npcName]);
            } else {
                this.npcProfiles[npcName] = deepClone(newNpcs[npcName]);
            }
        }
    }

    _deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (Array.isArray(source[key]) && Array.isArray(target[key])) {
                for (const item of source[key]) {
                    const norm = typeof item === 'string' ? item.trim().toLowerCase() : null;
                    const isDuplicate = target[key].some((existing) =>
                        norm !== null && typeof existing === 'string'
                            ? existing.trim().toLowerCase() === norm
                            : existing === item
                    );
                    if (!isDuplicate) {
                        target[key].push(item);
                    }
                }
            } else {
                target[key] = source[key];
            }
        }
    }

    getProfile(npcName) {
        if (!this.npcProfiles[npcName]) {
            return undefined;
        }
        return deepClone(this.npcProfiles[npcName]);
    }

    getAllProfiles() {
        return this.npcProfiles;
    }

    static dedupStrings(arr) {
        const seen = new Set();
        return arr.filter((item) => {
            const key = typeof item === 'string' ? item.trim().toLowerCase() : JSON.stringify(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
}

export { NpcProfiler };
