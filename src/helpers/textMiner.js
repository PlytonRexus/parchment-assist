// Advanced Game State Text Mining
export class AdvancedGameStateExtractor {
    static parse(gameText) {
        const state = {
            location: '',
            inventory: '',
            objects: [],
            npcs: [],
            exits: [],
            roomDescription: '',
        };

        if (!gameText) {
            return state;
        }

        const lines = gameText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        // Extract location
        state.location = this.extractLocation(lines);

        // Extract inventory
        state.inventory = this.extractInventory(gameText);

        // Extract objects mentioned
        state.objects = this.extractObjects(gameText);

        // Extract NPCs
        state.npcs = this.extractNPCs(gameText);

        // Extract exits
        state.exits = this.extractExits(gameText);

        // Extract room description
        state.roomDescription = this.extractRoomDescription(lines);

        return state;
    }

    static extractLocation(lines) {
        // Look for location patterns in various forms
        const locationPatterns = [
            // Standard room titles (usually short, capitalized)
            /^([A-Z][A-Za-z\s',.-]{3,50})$/,
            // "You are in/at/on" patterns
            /^You are (?:in|at|on|inside|outside) (.+?)(?:\.|$)/i,
            // Location descriptions that start rooms
            /^This is (.+?)(?:\.|$)/i,
            // Parchment-style location headers
            /^\s*([A-Z][A-Za-z\s',.-]{3,50})\s*$/,
        ];

        // Check last few lines for location (usually recent)
        for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
            const line = lines[i];

            // Skip command echoes and common non-location text
            if (
                line.startsWith('>') ||
                line.includes("don't understand") ||
                line.includes("can't see") ||
                line.length > 100
            ) {
                continue;
            }

            for (const pattern of locationPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const location = match[1].trim();
                    // Validate it looks like a location
                    if (this.looksLikeLocation(location)) {
                        return location;
                    }
                }
            }
        }

        return '';
    }

    static looksLikeLocation(text) {
        // Heuristics for location names
        if (text.length < 3 || text.length > 60) {
            return false;
        }

        // Should start with capital letter
        if (!/^[A-Z]/.test(text)) {
            return false;
        }

        // Shouldn't be common non-location phrases
        const nonLocationPhrases = [
            "you can't",
            "i don't",
            'there is',
            'you see',
            'you have',
            'you are carrying',
            'taken',
            'dropped',
        ];

        const lowerText = text.toLowerCase();
        return !nonLocationPhrases.some((phrase) => lowerText.includes(phrase));
    }

    static extractInventory(gameText) {
        const inventoryPatterns = [
            /You are carrying:([\s\S]+?)(?:\n\n|\n>|$)/i,
            /You have:([\s\S]+?)(?:\n\n|\n>|$)/i,
            /Inventory:([\s\S]+?)(?:\n\n|\n>|$)/i,
            /(?:You are carrying|You have):\s*([^\n]+)/i,
        ];

        for (const pattern of inventoryPatterns) {
            const match = gameText.match(pattern);
            if (match) {
                return this.cleanInventoryText(match[1]);
            }
        }

        // Check for "You are empty-handed" or similar
        if (/empty.?handed|carrying nothing|you have nothing/i.test(gameText)) {
            return 'empty-handed';
        }

        return '';
    }

    static cleanInventoryText(inventoryText) {
        return inventoryText
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\s*-\s*/gm, '')
            .trim();
    }

    static extractObjects(gameText) {
        const objects = new Set();

        // Look for "You see..." patterns
        const seePatterns = [
            /You (?:can )?see (.+?) here/gi,
            /There is (.+?) here/gi,
            /On the .+? (?:is|are) (.+?)\./gi,
            /In the .+? (?:is|are) (.+?)\./gi,
        ];

        for (const pattern of seePatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const objectText = match[1].trim();
                // Split multiple objects
                const objectList = this.splitObjectList(objectText);
                objectList.forEach((obj) => objects.add(obj));
            }
        }

        return Array.from(objects);
    }

    static extractNPCs(gameText) {
        const npcs = new Set();

        // Common NPC patterns
        const npcPatterns = [
            /(?:You see|There is) (?:a |an |the )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) (?:here|standing|sitting)/gi,
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) (?:says|tells you|asks|looks at you)/gi,
            /(?:talk to|ask|tell) (?:the )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        ];

        for (const pattern of npcPatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const npc = match[1].trim();
                if (this.looksLikeNPC(npc)) {
                    npcs.add(npc);
                }
            }
        }

        return Array.from(npcs);
    }

    static looksLikeNPC(text) {
        // Basic heuristics for NPC names
        if (text.length < 2 || text.length > 30) {
            return false;
        }

        // Should be proper case
        if (!/^[A-Z]/.test(text)) {
            return false;
        }

        // Common non-NPC words to filter out (IF nouns and pronouns)
        const nonNpcWords = [
            'You',
            'The',
            'This',
            'That',
            'Here',
            'There',
            'Door',
            'Window',
            'Wall',
            'Room',
            'Hall',
            'Hallway',
            'Key',
            'Sword',
            'Lamp',
            'Lantern',
            'Table',
            'Chair',
            'Floor',
            'Ceiling',
            'Passage',
            'Corridor',
            'Stairs',
            'North',
            'South',
            'East',
            'West',
        ];

        return !nonNpcWords.includes(text);
    }

    static extractExits(gameText) {
        const exits = new Set();

        // Look for exit patterns
        const exitPatterns = [
            /You can (?:go |see exits? )?(north|south|east|west|up|down|northeast|northwest|southeast|southwest|in|out)/gi,
            /Obvious exits? (?:are |lead )?([^.\n]+)/gi,
            /(?:Exits?|You can go):?\s*([^.\n]+)/gi,
        ];

        for (const pattern of exitPatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const exitText = match[1];
                const directions = this.parseDirections(exitText);
                directions.forEach((dir) => exits.add(dir));
            }
        }

        return Array.from(exits);
    }

    static parseDirections(text) {
        const directions = [
            'north',
            'south',
            'east',
            'west',
            'up',
            'down',
            'northeast',
            'northwest',
            'southeast',
            'southwest',
            'in',
            'out',
            'enter',
            'exit',
        ];

        return directions.filter((dir) => new RegExp(`\\b${dir}\\b`, 'i').test(text));
    }

    static extractRoomDescription(lines) {
        // Try to find the main room description paragraph
        let descriptionStart = -1;

        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];

            // Skip command echoes
            if (line.startsWith('>')) {
                continue;
            }

            // Look for description-like content
            if (
                line.length > 50 &&
                !line.includes('You') &&
                !line.includes("can't") &&
                !/^[A-Z][a-z\s]{3,50}$/.test(line)
            ) {
                descriptionStart = i;
                break;
            }
        }

        if (descriptionStart >= 0) {
            return lines
                .slice(Math.max(0, descriptionStart - 2), descriptionStart + 3)
                .join(' ')
                .trim();
        }

        return '';
    }

    static splitObjectList(text) {
        // Handle "a book, a pen, and a lamp" type lists
        return text
            .split(/,\s*(?:and\s+)?|\s+and\s+/)
            .map((item) => item.replace(/^(?:a|an|the)\s+/i, '').trim())
            .filter((item) => item.length > 0);
    }
}
