// Advanced Game State Text Mining
export class AdvancedGameStateExtractor {
    // Common one-word adjectives (and hyphenated compounds) that may precede IF keywords.
    // Deliberately conservative — the LLM handles richer extraction.
    static _COMMON_ADJ =
        // colours
        'red|blue|green|yellow|white|black|brown|gray|grey|golden|silver|bronze|copper|crimson|' +
        'azure|purple|orange|pink|violet|scarlet|ivory|ebony|jade|amber|coral|navy|tan|charcoal|' +
        'indigo|magenta|ochre|khaki|beige|cream|turquoise|russet|maroon|olive|teal|' +
        // size / shape
        'big|large|small|tiny|huge|tall|short|long|narrow|wide|round|flat|thick|thin|' +
        'oblong|pointed|curved|coiled|twisted|gnarled|knotted|tapered|conical|cylindrical|spherical|' +
        // materials
        'wooden|stone|iron|brass|crystal|glass|leather|metal|steel|marble|' +
        'ceramic|porcelain|clay|wax|bone|silk|velvet|satin|wool|linen|fur|hide|' +
        'obsidian|onyx|mahogany|oak|pine|oak|ash|ebony|ivory|plastic|rubber|concrete|brick|plaster|' +
        // age / condition
        'old|new|ancient|aged|worn|rusty|broken|shiny|dull|sharp|blunt|' +
        'cracked|shattered|chipped|bent|melted|frozen|scorched|charred|stained|faded|yellowed|' +
        'bleached|warped|rotted|dusty|pristine|flawless|tattered|frayed|crumbling|weathered|' +
        // state
        'open|closed|locked|unlocked|empty|full|lit|unlit|glowing|burning|cold|hot|wet|dry|' +
        'sealed|bound|inscribed|engraved|etched|gilded|polished|burnished|hammered|studded|' +
        // texture / feel
        'clean|dirty|rough|smooth|soft|hard|solid|hollow|slippery|sticky|slimy|' +
        // character
        'strange|mysterious|magical|enchanted|ornate|plain|carved|painted|tarnished|' +
        'sacred|cursed|blessed|haunted|heavy|light|fragile|sturdy|ornamental|decorative|' +
        // hyphenated compound adjectives (well-worn, dust-covered, half-open, …)
        '[\\w]+-[\\w]+';

    static parse(gameText) {
        const state = {
            location: '',
            inventory: '',
            objects: [],
            npcs: [],
            exits: [],
            scenery: [],
            roomDescription: '',
            interactables: [],
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

        // Extract scenery (fixed examinable features)
        state.scenery = this.extractScenery(gameText);

        // Extract room description
        state.roomDescription = this.extractRoomDescription(lines);

        // Generate interactables fallback when AI is unavailable
        state.interactables = this.generateInteractables(state);

        return state;
    }

    /**
     * Parse only the current room's text (scoped extraction for panel display).
     * Uses scopeToCurrentRoom() to isolate the latest room, then filters out
     * non-interactable text (negations, distant mentions, quoted speech).
     * Full-text parse() should still be used for inline annotations.
     */
    static parseScoped(gameText) {
        const state = {
            location: '',
            inventory: '',
            objects: [],
            npcs: [],
            exits: [],
            scenery: [],
            roomDescription: '',
            interactables: [],
        };

        if (!gameText) {
            return state;
        }

        const scopedText = this.scopeToCurrentRoom(gameText);
        const filteredText = this._filterNonInteractableText(scopedText);

        const scopedLines = scopedText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        // Location and exits use unfiltered scoped text (they need full context)
        state.location = this.extractLocation(scopedLines);
        state.exits = this.extractExits(scopedText);

        // Inventory uses full game text (it's a global concept)
        state.inventory = this.extractInventory(gameText);

        // Objects, NPCs, scenery use filtered scoped text
        state.objects = this.extractObjects(filteredText);
        state.npcs = this.extractNPCs(filteredText);
        state.scenery = this.extractScenery(filteredText);

        state.roomDescription = this.extractRoomDescription(scopedLines);
        state.interactables = this.generateInteractables(state);

        return state;
    }

    /**
     * Isolate the current room's text from a full game transcript.
     * Scans backwards for the last room-title line (a short, capitalized line
     * that passes looksLikeLocation()) and returns everything from that line
     * to the end. Falls back to the last 2000 characters if no boundary is found.
     */
    static scopeToCurrentRoom(gameText) {
        if (!gameText) {
            return '';
        }

        const lines = gameText.split('\n');

        // Scan backwards looking for a room title boundary.
        // Room titles in IF are short, capitalized lines with no trailing punctuation.
        for (let i = lines.length - 1; i >= 0; i--) {
            const trimmed = lines[i].trim();

            // Skip empty lines, command echoes, and long lines
            if (!trimmed || trimmed.startsWith('>') || trimmed.length > 60) {
                continue;
            }

            // Room titles are short standalone labels — no sentence-ending punctuation
            if (/[.!?;]$/.test(trimmed)) {
                continue;
            }

            if (this.looksLikeLocation(trimmed) && /^[A-Z]/.test(trimmed)) {
                // Found a room title — return everything from here to the end
                return lines.slice(i).join('\n');
            }
        }

        // No room boundary found — fall back to last 2000 characters
        return gameText.slice(-2000);
    }

    /**
     * Remove text segments that should not produce interactable items:
     * - Quoted speech (NPC dialogue mentioning objects in other locations)
     * - Negated contexts ("there is no key", "can't see any")
     * - Distant/ambient mentions ("in the distance", "far away")
     */
    static _filterNonInteractableText(text) {
        if (!text) {
            return '';
        }

        let filtered = text;

        // Strip quoted speech (double quotes)
        filtered = filtered.replace(/"[^"]*"/g, '');
        // Strip quoted speech (single quotes around multi-word phrases)
        filtered = filtered.replace(/'[^']{3,}'/g, '');

        // Strip negated contexts
        filtered = filtered.replace(
            /(?:there is no|there are no|can't see any|isn't any|aren't any|you don't have|you have no)\b[^.!?\n]*/gi,
            ''
        );

        // Strip distant/ambient mentions
        filtered = filtered.replace(
            /(?:in the distance|far away|from here you can (?:see|hear)|miles away|somewhere (?:far|distant))[^.!?\n]*/gi,
            ''
        );

        return filtered;
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

    static _mapAdd(map, phrase) {
        const key = phrase.trim().toLowerCase();
        if (!map.has(key)) {
            map.set(key, phrase);
        }
    }

    static extractObjects(gameText) {
        const objects = new Map(); // key=lowercase, value=original-case

        // Explicit listing patterns
        const seePatterns = [
            /You (?:can )?see (.+?) here/gi,
            /There (?:is|are) (.+?) here/gi,
            /On the .+? (?:is|are) (.+?)\./gi,
            /In the .+? (?:is|are) (.+?)\./gi,
            /(?:sitting|lying|resting|placed) (?:on|in|beside|next to|atop) .{0,30}? (?:is|are) (?:a |an |the )?(.+?)(?:[,.]|$)/gi,
        ];

        for (const pattern of seePatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const objectText = match[1].trim();
                const objectList = this.splitObjectList(objectText);
                objectList.forEach((obj) => this._mapAdd(objects, obj));
            }
        }

        // Common takeable/useable item keywords found anywhere in text.
        // Ambiguous English words (can, match, bar, ring, pick, file, etc.)
        // are deliberately excluded — the LLM handles those.
        const itemKeywords = [
            // keys & access
            'key',
            'keys',
            'keycard',
            'passkey',
            'skeleton key',
            'master key',
            'padlock',

            // light sources
            'lamp',
            'lantern',
            'torch',
            'candle',
            'candles',
            'candlestick',
            'lighter',
            'flashlight',
            'flare',
            'brazier',
            'tinder',
            'tinderbox',
            'wick',

            // bladed weapons
            'sword',
            'longsword',
            'shortsword',
            'broadsword',
            'bastard sword',
            'claymore',
            'rapier',
            'sabre',
            'saber',
            'scimitar',
            'cutlass',
            'falchion',
            'katana',
            'knife',
            'dagger',
            'stiletto',
            'dirk',
            'poniard',
            'cleaver',
            'machete',
            'axe',
            'hatchet',
            'battleaxe',
            'handaxe',
            'scythe',
            'sickle',
            'katar',

            // polearms / hafted
            'spear',
            'lance',
            'pike',
            'halberd',
            'glaive',
            'polearm',
            'trident',
            'quarterstaff',
            'staff',
            'mace',
            'flail',
            'morningstar',
            'warhammer',
            'maul',
            'bludgeon',
            'cudgel',
            'crowbar',

            // ranged
            'bow',
            'longbow',
            'shortbow',
            'crossbow',
            'arrow',
            'arrows',
            'quiver',
            'javelin',
            'dart',
            'darts',
            'whip',

            // firearms / explosives
            'pistol',
            'revolver',
            'rifle',
            'musket',
            'flintlock',
            'shotgun',
            'carbine',
            'blunderbuss',
            'arquebus',
            'wand',
            'bomb',
            'grenade',
            'explosive',
            'fuse',

            // armour pieces
            'shield',
            'buckler',
            'helmet',
            'helm',
            'visor',
            'coif',
            'armor',
            'armour',
            'breastplate',
            'cuirass',
            'chainmail',
            'ringmail',
            'platemail',
            'pauldrons',
            'vambrace',
            'greaves',
            'gauntlets',
            'gorget',

            // clothing — outerwear
            'cloak',
            'coat',
            'jacket',
            'overcoat',
            'cape',
            'mantle',
            'robe',
            'gown',
            'dress',
            'surcoat',
            'tabard',
            'livery',
            'uniform',
            'smock',
            'apron',

            // clothing — innerwear / core
            'tunic',
            'shirt',
            'blouse',
            'chemise',
            'doublet',
            'jerkin',
            'vest',
            'waistcoat',
            'toga',
            'kirtle',

            // clothing — lower body
            'trousers',
            'pants',
            'breeches',
            'leggings',
            'skirt',

            // clothing — accessories
            'hat',
            'hood',
            'mask',
            'veil',
            'belt',
            'sash',
            'satchel',
            'scarf',
            'gloves',
            'mittens',
            'boots',
            'shoes',
            'sandals',
            'slippers',
            'clogs',
            'moccasins',
            'spur',
            'spurs',
            'buckle',
            'clasp',
            'brooch',

            // money & valuables
            'coin',
            'coins',
            'gem',
            'gems',
            'jewel',
            'jewels',
            'gemstone',
            'diamond',
            'ruby',
            'emerald',
            'sapphire',
            'topaz',
            'pearl',
            'pearls',
            'garnet',
            'opal',
            'amethyst',
            'onyx',
            'obsidian',
            'quartz',
            'crystal',
            'nugget',
            'ingot',

            // jewellery / wearable
            'bracelet',
            'bangle',
            'anklet',
            'necklace',
            'pendant',
            'locket',
            'brooch',
            'amulet',
            'talisman',
            'trinket',
            'badge',
            'medal',
            'medallion',
            'signet',
            'token',
            'trophy',
            'idol',
            'figurine',
            'cameo',
            'tiara',
            'circlet',
            'crown',
            'diadem',

            // magic / quest items
            'orb',
            'rune',
            'runes',
            'runestone',
            'tablet',
            'shard',
            'fragment',
            'sphere',
            'cube',
            'prism',
            'lens',
            'mirror',
            'phylactery',
            'totem',
            'artifact',
            'relic',
            'grimoire',
            'spellbook',
            'codex',
            'scepter',
            'sceptre',
            'reagent',
            'essence',
            'tincture',
            'sigil',
            'crystal ball',
            'scrying stone',
            'divining rod',

            // containers — bags / soft
            'bag',
            'sack',
            'pouch',
            'purse',
            'wallet',
            'backpack',
            'rucksack',
            'satchel',
            'knapsack',
            'haversack',
            'parcel',
            'envelope',
            'waterskin',
            'wineskin',
            'canteen',
            'gourd',

            // containers — rigid
            'box',
            'chest',
            'coffer',
            'strongbox',
            'lockbox',
            'crate',
            'barrel',
            'cask',
            'keg',
            'hogshead',
            'vase',
            'urn',
            'amphora',
            'ewer',
            'carafe',
            'decanter',
            'basket',
            'trunk',
            'briefcase',

            // vessels / drinking
            'bucket',
            'pail',
            'jar',
            'jug',
            'pitcher',
            'pot',
            'cauldron',
            'flask',
            'bottle',
            'vial',
            'cup',
            'mug',
            'goblet',
            'chalice',
            'bowl',
            'dish',
            'plate',
            'ladle',
            'spoon',
            'tongs',

            // rope & binding
            'rope',
            'cord',
            'twine',
            'cable',
            'wire',
            'chain',
            'shackle',
            'manacle',
            'cuff',
            'strap',
            'snare',
            'lasso',
            'noose',

            // climbing / movement
            'ladder',
            'grapple',
            'piton',
            'carabiner',
            'harness',
            'hook',
            'pulley',
            'plank',
            'raft',

            // levers & mechanisms
            'lever',
            'crank',
            'gear',
            'valve',
            'dial',
            'knob',
            'latch',
            'wedge',
            'peg',
            'clamp',
            'pedal',
            'spike',

            // hand tools — striking
            'hammer',
            'mallet',
            'pickaxe',
            'mattock',
            'adze',
            'chisel',

            // hand tools — cutting
            'saw',
            'hacksaw',
            'scalpel',
            'scissors',
            'shears',
            'knife',
            'penknife',

            // hand tools — digging / farming
            'shovel',
            'spade',
            'trowel',
            'rake',
            'scythe',

            // hand tools — fastening / shaping
            'wrench',
            'spanner',
            'screwdriver',
            'awl',
            'gimlet',
            'rasp',

            // needlework & textile
            'needle',
            'thread',
            'thimble',
            'spindle',
            'bobbin',

            // navigation / instruments
            'map',
            'chart',
            'atlas',
            'compass',
            'telescope',
            'spyglass',
            'binoculars',
            'magnifier',
            'magnifying glass',
            'clock',
            'hourglass',
            'sundial',
            'sextant',
            'barometer',
            'thermometer',

            // modern electronics
            'phone',
            'radio',
            'walkie-talkie',
            'microphone',
            'camera',
            'computer',
            'laptop',
            'cassette',
            'battery',
            'power cell',

            // modern identification
            'passport',
            'credential',
            'keycard',

            // paper / writing — documents
            'scroll',
            'ticket',
            'note',
            'notes',
            'letter',
            'telegram',
            'book',
            'books',
            'tome',
            'diary',
            'journal',
            'ledger',
            'logbook',
            'dossier',
            'folder',
            'report',
            'pamphlet',
            'leaflet',
            'flyer',
            'poster',
            'parchment',
            'manuscript',
            'codex',
            'blueprint',
            'schematic',
            'diagram',
            'manifest',
            'catalog',
            'catalogue',
            'label',
            'certificate',
            'permit',
            'receipt',
            'voucher',
            'coupon',
            'document',
            'documents',
            'paper',
            'papers',
            'photograph',
            'photo',
            'picture',

            // writing implements
            'pen',
            'quill',
            'pencil',
            'chalk',
            'crayon',
            'ink',
            'inkpot',

            // art / craft supplies
            'paintbrush',
            'palette',
            'canvas',
            'pigment',

            // food — staples
            'bread',
            'loaf',
            'cake',
            'pie',
            'biscuit',
            'cracker',
            'food',
            'ration',
            'rations',
            'provisions',
            'meat',
            'ham',
            'sausage',
            'bacon',
            'jerky',
            'steak',
            'fish',
            'chicken',
            'egg',
            'eggs',
            'cheese',

            // food — produce
            'fruit',
            'apple',
            'lemon',
            'pear',
            'plum',
            'grape',
            'grapes',
            'cherry',
            'cherries',
            'berries',
            'strawberry',
            'potato',
            'carrot',
            'onion',
            'garlic',
            'herb',
            'herbs',
            'mushroom',
            'seed',
            'seeds',

            // food — prepared
            'soup',
            'stew',
            'broth',
            'porridge',
            'gruel',
            'sandwich',

            // drink
            'water',
            'milk',
            'juice',
            'wine',
            'ale',
            'beer',
            'mead',
            'cider',
            'rum',
            'whiskey',
            'whisky',
            'brandy',
            'coffee',
            'tea',

            // potions / alchemy
            'potion',
            'elixir',
            'vial',
            'antidote',
            'tincture',
            'philtre',
            'salve',
            'ointment',

            // medical
            'bandage',
            'gauze',
            'splint',
            'tourniquet',
            'medicine',
            'syringe',
            'lancet',

            // natural / organic — animal parts
            'feather',
            'feathers',
            'bone',
            'bones',
            'skull',
            'tooth',
            'teeth',
            'fang',
            'claw',
            'claws',
            'talon',
            'talons',
            'antler',
            'tusk',
            'pelt',
            'fur',
            'shell',
            'carapace',
            'cocoon',
            'sinew',
            'tendon',

            // natural / organic — plant
            'leaf',
            'leaves',
            'bark',
            'root',
            'roots',
            'resin',
            'sap',
            'petal',
            'petals',
            'flower',
            'flowers',

            // natural / inorganic
            'pebble',
            'rock',
            'stone',
            'ore',
            'clay',
            'sand',
            'coal',
            'wax',
            'sulphur',
            'sulfur',
            'powder',

            // raw materials — refined
            'plank',
            'beam',
            'lumber',
            'brick',
            'tile',
            'slab',

            // household — linen
            'cloth',
            'fabric',
            'wool',
            'silk',
            'linen',
            'cotton',
            'twine',
            'cord',
            'thread',
            'blanket',
            'towel',
            'rag',
            'cushion',
            'pillow',
            'mattress',
            'napkin',
            'handkerchief',

            // household — cleaning
            'soap',
            'sponge',
            'broom',

            // kitchenware
            'skillet',
            'wok',
            'colander',
            'grater',
            'mortar',
            'pestle',
            'rolling pin',
            'cutting board',

            // music
            'flute',
            'fife',
            'piccolo',
            'lute',
            'mandolin',
            'guitar',
            'harp',
            'zither',
            'lyre',
            'fiddle',
            'violin',
            'tambourine',
            'bell',
            'bells',
            'chime',
            'chimes',
            'bugle',
            'trumpet',
            'bagpipes',
            'whistle',
            'harmonica',
            'accordion',
        ];
        const adjPattern = new RegExp(
            `(?:(?:a|an|the|some)\\s+)?(?:(?:${this._COMMON_ADJ})\\s+)?\\b(KEYWORD)\\b`,
            'gi'
        );
        for (const kw of itemKeywords) {
            const re = new RegExp(adjPattern.source.replace('KEYWORD', kw), 'gi');
            const matches = gameText.matchAll(re);
            for (const match of matches) {
                const phrase = match[0].replace(/^(?:a|an|the|some)\s+/i, '').trim();
                if (phrase.length > 0 && phrase.length < 40) {
                    this._mapAdd(objects, phrase);
                }
            }
        }

        // Doors, containers, and openable things
        const containerKw =
            'door|gate|hatch|trapdoor|chest|box|drawer|cabinet|cupboard|wardrobe|locker|safe';
        const containerPatterns = [
            new RegExp(
                `(?:a|an|the)\\s+(?:(?:${this._COMMON_ADJ})\\s+)?\\b(?:${containerKw})\\b`,
                'gi'
            ),
        ];
        for (const pattern of containerPatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const phrase = match[0].replace(/^(?:a|an|the)\s+/i, '').trim();
                this._mapAdd(objects, phrase);
            }
        }

        return Array.from(objects.values());
    }

    static extractScenery(gameText) {
        const scenery = new Map(); // key=lowercase, value=original-case

        // Fixed features that appear in descriptive prose
        const sceneryKeywords = [
            // walls, floors, ceilings, surfaces
            'wall',
            'walls',
            'floor',
            'ceiling',
            'roof',
            'surface',
            'ground',
            'pavement',
            'cobblestones',
            'flagstones',
            'tiles',
            // openings & passages
            'door',
            'gate',
            'hatch',
            'trapdoor',
            'portcullis',
            'drawbridge',
            'window',
            'windows',
            'porthole',
            'skylight',
            'vent',
            'grate',
            'grille',
            'passage',
            'corridor',
            'tunnel',
            'archway',
            'arch',
            'doorway',
            'threshold',
            'opening',
            'gap',
            'crack',
            'crevice',
            'hole',
            // elevated / structural features
            'pillar',
            'column',
            'post',
            'beam',
            'rafter',
            'buttress',
            'ledge',
            'alcove',
            'niche',
            'recess',
            'balcony',
            'parapet',
            'battlement',
            'step',
            'steps',
            'stairs',
            'staircase',
            'landing',
            'ramp',
            'mantelpiece',
            'windowsill',
            'sill',
            'lintel',
            // furniture (scenery-scale)
            'throne',
            'desk',
            'table',
            'tables',
            'chair',
            'chairs',
            'bench',
            'bed',
            'shelf',
            'shelves',
            'bookcase',
            'bookshelf',
            'cabinet',
            'cupboard',
            'wardrobe',
            'dresser',
            'chest',
            'counter',
            'bar',
            'altar',
            'pedestal',
            'plinth',
            'dais',
            'podium',
            'stand',
            'mantle',
            'hearth',
            'fireplace',
            'stove',
            'oven',
            'chimney',
            'sink',
            'basin',
            'tub',
            'bath',
            'toilet',
            // art / decoration
            'painting',
            'paintings',
            'tapestry',
            'tapestries',
            'portrait',
            'mural',
            'fresco',
            'relief',
            'carving',
            'engraving',
            'inscription',
            'plaque',
            'tablet',
            'relief',
            'mosaic',
            'frieze',
            'statue',
            'sculpture',
            'bust',
            'effigy',
            'figurine',
            'gargoyle',
            'mirror',
            'chandelier',
            'candelabra',
            'sconce',
            // light
            'fire',
            'flame',
            'flames',
            'hearth',
            // fixtures
            'fountain',
            'well',
            'pool',
            'basin',
            'trough',
            'cistern',
            'pillar',
            'obelisk',
            'monolith',
            'gravestone',
            'tombstone',
            // outdoor: land & water
            'tree',
            'trees',
            'bush',
            'bushes',
            'shrub',
            'shrubs',
            'hedge',
            'grass',
            'lawn',
            'meadow',
            'field',
            'forest',
            'grove',
            'flowers',
            'vines',
            'ivy',
            'moss',
            'lichen',
            'reeds',
            'path',
            'road',
            'track',
            'trail',
            'lane',
            'alley',
            'bridge',
            'ford',
            'pier',
            'dock',
            'jetty',
            'quay',
            'cliff',
            'cliffs',
            'ledge',
            'outcrop',
            'boulder',
            'boulders',
            'hill',
            'mountain',
            'peak',
            'valley',
            'ravine',
            'canyon',
            'cave',
            'cavern',
            'grotto',
            'hollow',
            'river',
            'stream',
            'brook',
            'creek',
            'waterfall',
            'rapids',
            'pond',
            'lake',
            'sea',
            'ocean',
            'shore',
            'beach',
            'coast',
            'sand',
            'mud',
            'marsh',
            'swamp',
            'bog',
            // sky / weather
            'sky',
            'stars',
            'moon',
            'sun',
            'clouds',
            'horizon',
            // signage
            'sign',
            'notice',
            'poster',
            'graffiti',
            'notice board',
            'bulletin board',
            // urban
            'fence',
            'railing',
            'gate',
            'lamppost',
            'streetlight',
        ];

        const adjPattern = new RegExp(
            `(?:(?:a|an|the|some)\\s+)?(?:(?:${this._COMMON_ADJ})\\s+)?\\b(KEYWORD)\\b`,
            'gi'
        );
        for (const kw of sceneryKeywords) {
            const re = new RegExp(
                adjPattern.source.replace('KEYWORD', kw.replace(/\s+/, '\\s+')),
                'gi'
            );
            const matches = gameText.matchAll(re);
            for (const match of matches) {
                const phrase = match[0].replace(/^(?:a|an|the|some)\s+/i, '').trim();
                if (phrase.length > 0 && phrase.length < 40) {
                    this._mapAdd(scenery, phrase);
                }
            }
        }

        return Array.from(scenery.values());
    }

    static extractNPCs(gameText) {
        const npcs = new Map(); // key=lowercase, value=original-case

        // Proper-noun NPC patterns
        const npcPatterns = [
            /(?:You see|There is) (?:a |an |the )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) (?:here|standing|sitting|waiting|watching)/gi,
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) (?:says|tells you|asks|looks at you|turns to you|replies|answers|shouts|whispers)/gi,
            /(?:talk to|ask|tell|give .+ to) (?:the )?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        ];

        for (const pattern of npcPatterns) {
            const matches = gameText.matchAll(pattern);
            for (const match of matches) {
                const npc = match[1].trim();
                if (this.looksLikeNPC(npc)) {
                    this._mapAdd(npcs, npc);
                }
            }
        }

        // Generic NPC role-words (lowercase) — "the guard", "a merchant", etc.
        const npcRoles = [
            // military / law
            'guard',
            'guards',
            'soldier',
            'soldiers',
            'knight',
            'captain',
            'commander',
            'general',
            'officer',
            'warden',
            'jailer',
            'gaoler',
            'watchman',
            'sentry',
            'patrol',
            'sheriff',
            'constable',
            'detective',
            'inspector',
            'spy',
            'assassin',
            // trades & professions
            'merchant',
            'shopkeeper',
            'trader',
            'vendor',
            'peddler',
            'hawker',
            'innkeeper',
            'landlord',
            'bartender',
            'barmaid',
            'waiter',
            'cook',
            'chef',
            'baker',
            'butcher',
            'miller',
            'brewer',
            'blacksmith',
            'smith',
            'armourer',
            'weaponsmith',
            'jeweller',
            'carpenter',
            'mason',
            'builder',
            'architect',
            'farmer',
            'shepherd',
            'fisherman',
            'sailor',
            'captain',
            'navigator',
            'courier',
            'messenger',
            'herald',
            'scribe',
            'clerk',
            'doctor',
            'physician',
            'surgeon',
            'healer',
            'apothecary',
            'alchemist',
            'librarian',
            'scholar',
            'professor',
            'teacher',
            'lawyer',
            'judge',
            'magistrate',
            'mayor',
            'governor',
            // social roles
            'king',
            'queen',
            'prince',
            'princess',
            'duke',
            'duchess',
            'lord',
            'lady',
            'baron',
            'baroness',
            'earl',
            'count',
            'countess',
            'noble',
            'nobleman',
            'noblewoman',
            'servant',
            'butler',
            'maid',
            'housekeeper',
            'footman',
            'coachman',
            'slave',
            'peasant',
            'serf',
            'beggar',
            'vagrant',
            'prisoner',
            'child',
            'boy',
            'girl',
            'man',
            'woman',
            'elder',
            'stranger',
            // underworld
            'thief',
            'rogue',
            'pirate',
            'smuggler',
            'bandit',
            'outlaw',
            'gangster',
            'cultist',
            'acolyte',
            'initiate',
            // magic
            'wizard',
            'witch',
            'mage',
            'sorcerer',
            'sorceress',
            'warlock',
            'enchantress',
            'necromancer',
            'shaman',
            'druid',
            'cleric',
            'paladin',
            'ranger',
            'bard',
            'monk',
            'oracle',
            'seer',
            'prophet',
            // entertainment
            'bard',
            'minstrel',
            'jester',
            'juggler',
            'acrobat',
            'performer',
            'actor',
            'dancer',
            // fantasy humanoids
            'troll',
            'goblin',
            'goblins',
            'orc',
            'orcs',
            'dwarf',
            'elf',
            'gnome',
            'halfling',
            'hobbit',
            'giant',
            'cyclops',
            'ogre',
            'centaur',
            'minotaur',
            'harpy',
            'sphinx',
            'fairy',
            'fae',
            'pixie',
            'sprite',
            'nymph',
            'dryad',
            'satyr',
            // monsters
            'dragon',
            'serpent',
            'basilisk',
            'hydra',
            'kraken',
            'leviathan',
            'werewolf',
            'vampire',
            'zombie',
            'skeleton',
            'lich',
            'wraith',
            'spectre',
            'shade',
            'revenant',
            'poltergeist',
            'banshee',
            'demon',
            'devil',
            'fiend',
            'imp',
            'angel',
            'seraph',
            'ghost',
            'spirit',
            'apparition',
            'phantom',
        ];
        const rolePattern = new RegExp(
            `(?:(?:a|an|the|your|an old|a young|a tall|a short|a large|a small)\\s+)?(?:(?:${this._COMMON_ADJ})\\s+)?\\b(ROLE)\\b`,
            'gi'
        );
        for (const role of npcRoles) {
            const re = new RegExp(rolePattern.source.replace('ROLE', role), 'gi');
            const matches = gameText.matchAll(re);
            for (const match of matches) {
                const phrase = match[0].trim();
                if (phrase.length > 0 && phrase.length < 40) {
                    this._mapAdd(npcs, phrase.replace(/^(?:a|an|the|your)\s+/i, '').trim());
                }
            }
        }

        return Array.from(npcs.values());
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

    /** @deprecated Use _analyzePhrase(phrase).headNoun instead. */
    static _baseNoun(phrase) {
        return this._analyzePhrase(phrase).headNoun;
    }

    static _COMPOUND_NOUNS = new Set([
        'garbage cans',
        'trash cans',
        'trash can',
        'garbage can',
        'front door',
        'back door',
        'side door',
        'screen door',
        'barn door',
        'notice board',
        'bulletin board',
        'cutting board',
        'chess board',
        'fire escape',
        'fire place',
        'fire pit',
        'bus stop',
        'phone booth',
        'phone box',
        'mail box',
        'post box',
        'post office',
        'power cell',
        'control panel',
        'control room',
        'manhole cover',
        'trap door',
        'display case',
        'glass case',
        'book case',
        'suit case',
        'grandfather clock',
        'cuckoo clock',
        'alarm clock',
        'park bench',
        'work bench',
        'street lamp',
        'desk lamp',
        'oil lamp',
        'coffee table',
        'dining table',
        'pool table',
        'church tower',
        'clock tower',
        'bell tower',
        'office door',
        'garden gate',
        'iron gate',
        'coat rack',
        'hat rack',
        'wine rack',
        'key ring',
        'key chain',
        'window sill',
        'book shelf',
        'estate office',
        'estate agent',
    ]);

    /**
     * Analyze a noun phrase to extract the head noun and modifier.
     * Returns {display, headNoun, modifier, fullPhrase}.
     * - "narrow window" → headNoun "window", modifier "narrow"
     * - "garbage cans" → headNoun "garbage cans", modifier ""
     * - "rusty iron key" → headNoun "key", modifier "rusty iron"
     * - "old front door" → headNoun "front door", modifier "old"
     */
    static _analyzePhrase(phrase) {
        const cleaned = phrase.trim();
        const words = cleaned.split(/\s+/);

        if (words.length <= 1) {
            return { display: cleaned, headNoun: cleaned, modifier: '', fullPhrase: cleaned };
        }

        // Check if last two words form a known compound noun
        if (words.length >= 2) {
            const lastTwo = words.slice(-2).join(' ').toLowerCase();
            if (this._COMPOUND_NOUNS.has(lastTwo)) {
                const compound = words.slice(-2).join(' ');
                const mod = words.slice(0, -2).join(' ');
                return {
                    display: cleaned,
                    headNoun: compound,
                    modifier: mod,
                    fullPhrase: cleaned,
                };
            }
        }

        // Check if preceding words are all known adjectives
        const preceding = words.slice(0, -1);
        const adjPattern = new RegExp(`^(?:${this._COMMON_ADJ})$`, 'i');
        const allAdj = preceding.every((w) => adjPattern.test(w));

        if (allAdj) {
            // All preceding words are adjectives → head noun is just the last word
            return {
                display: cleaned,
                headNoun: words[words.length - 1],
                modifier: preceding.join(' '),
                fullPhrase: cleaned,
            };
        }

        // Preceding word is not an adjective → treat last two words as a compound
        const compound = words.slice(-2).join(' ');
        const mod = words.slice(0, -2).join(' ');
        return { display: cleaned, headNoun: compound, modifier: mod, fullPhrase: cleaned };
    }

    static _BARE_DIRECTIONS = new Set([
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
        'n',
        's',
        'e',
        'w',
        'ne',
        'nw',
        'se',
        'sw',
        'in',
        'out',
    ]);

    static generateInteractables(parsedState) {
        const interactables = [];

        for (const obj of parsedState.objects) {
            const { headNoun } = this._analyzePhrase(obj);
            interactables.push({
                name: headNoun,
                type: 'object',
                _fullPhrase: obj,
                actions: [
                    { command: `examine ${headNoun}`, label: 'Examine', confidence: 0.9 },
                    { command: `take ${headNoun}`, label: 'Take', confidence: 0.7 },
                    { command: `drop ${headNoun}`, label: 'Drop', confidence: 0.5 },
                ],
            });
        }

        for (const npc of parsedState.npcs) {
            const { headNoun } = this._analyzePhrase(npc);
            interactables.push({
                name: headNoun,
                type: 'npc',
                _fullPhrase: npc,
                actions: [
                    { command: `examine ${headNoun}`, label: 'Examine', confidence: 0.85 },
                    { command: `talk to ${headNoun}`, label: 'Talk', confidence: 0.8 },
                    { command: `ask ${headNoun} about`, label: 'Ask about\u2026', confidence: 0.7 },
                    { command: `show ${headNoun}`, label: 'Show item\u2026', confidence: 0.5 },
                    { command: `give ${headNoun}`, label: 'Give item\u2026', confidence: 0.45 },
                    { command: `take from ${headNoun}`, label: 'Take from', confidence: 0.4 },
                ],
            });
        }

        for (const exit of parsedState.exits) {
            const dir = typeof exit === 'string' ? exit : exit.direction;
            if (dir && !this._BARE_DIRECTIONS.has(dir.toLowerCase())) {
                interactables.push({
                    name: dir,
                    type: 'exit',
                    actions: [{ command: `go ${dir}`, label: `Go ${dir}`, confidence: 0.95 }],
                });
            }
        }

        for (const item of parsedState.scenery || []) {
            const { headNoun } = this._analyzePhrase(item);
            interactables.push({
                name: headNoun,
                type: 'scenery',
                _fullPhrase: item,
                actions: [
                    { command: `examine ${headNoun}`, label: 'Examine', confidence: 0.85 },
                    { command: `look at ${headNoun}`, label: 'Look at', confidence: 0.7 },
                ],
            });
        }

        // Disambiguation pass: if two interactables share the same headNoun,
        // upgrade both to use the full phrase for name and commands.
        this._disambiguateInteractables(interactables);

        return interactables;
    }

    /**
     * When two interactables share the same headNoun (e.g. "red key" and "blue key"
     * both have headNoun "key"), upgrade both to use their full phrase as the name
     * and in commands so the parser can distinguish them.
     */
    static _disambiguateInteractables(interactables) {
        // Count headNoun occurrences
        const nounCounts = new Map();
        for (const item of interactables) {
            const lower = item.name.toLowerCase();
            nounCounts.set(lower, (nounCounts.get(lower) || 0) + 1);
        }

        // Upgrade items with colliding headNouns
        for (const item of interactables) {
            const lower = item.name.toLowerCase();
            if (nounCounts.get(lower) > 1 && item._fullPhrase && item._fullPhrase !== item.name) {
                const full = item._fullPhrase;
                // Rewrite commands to use full phrase
                for (const action of item.actions) {
                    action.command = action.command.replace(item.name, full);
                }
                item.name = full;
            }
        }

        // Clean up internal-only property
        for (const item of interactables) {
            delete item._fullPhrase;
        }
    }

    static splitObjectList(text) {
        // Handle "a book, a pen, and a lamp" type lists
        return text
            .split(/,\s*(?:and\s+)?|\s+and\s+/)
            .map((item) => item.replace(/^(?:a|an|the)\s+/i, '').trim())
            .filter((item) => item.length > 0);
    }
}
