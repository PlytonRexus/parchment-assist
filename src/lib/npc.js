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
                // Append unique items from source array
                for (const item of source[key]) {
                    if (!target[key].includes(item)) {
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
}

export { NpcProfiler };
