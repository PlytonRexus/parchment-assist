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
                Object.assign(this.npcProfiles[npcName], newNpcs[npcName]);
            } else {
                this.npcProfiles[npcName] = { ...newNpcs[npcName] };
            }
        }
    }

    getProfile(npcName) {
        return this.npcProfiles[npcName];
    }

    getAllProfiles() {
        return this.npcProfiles;
    }
}

export { NpcProfiler };
