// Parchment-Assist Service Worker
// Handles LLM requests to Ollama and Gemini APIs

class LLMService {
    constructor() {
        this.cache = new Map();
        this.requestQueue = new Map();
        this.settings = {
            preferLocal: true,
            ollamaModel: 'llama3',
            geminiKey: '',
            timeout: 15000,
            activeProviders: [],
        };
        this.settingsPromise = this.loadSettings();
    }

    async loadSettings() {
        try {
            const stored = await chrome.storage.sync.get([
                'preferLocal',
                'ollamaModel',
                'geminiKey',
                'activeProviders',
            ]);
            this.settings = { ...this.settings, ...stored };
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    generateCacheKey(gameState) {
        const key = JSON.stringify({
            location: gameState.location,
            recentText: gameState.gameText.slice(-200), // Last 200 chars
            commands: gameState.lastCommands,
        });

        // Simple hash
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    async getSuggestions(gameState, force = false) {
        const cacheKey = this.generateCacheKey(gameState);
        if (!force && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }
        }

        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey);
        }

        const requestPromise = (async () => {
            try {
                await this.settingsPromise;
                const structuredState = await this.extractStructuredState(gameState);
                if (
                    structuredState &&
                    structuredState.quests &&
                    typeof chrome !== 'undefined' &&
                    chrome.storage
                ) {
                    const storageKey = `quests_${gameState.gameTitle}`;
                    await chrome.storage.local.set({ [storageKey]: structuredState.quests });
                }
                const response = { structuredState };
                this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
                if (this.cache.size > 50) {
                    const oldestKey = Array.from(this.cache.keys())[0];
                    this.cache.delete(oldestKey);
                }
                return response;
            } finally {
                this.requestQueue.delete(cacheKey);
            }
        })();

        this.requestQueue.set(cacheKey, requestPromise);
        return requestPromise;
    }

    async callProviderForState(prompt) {
        const providers = [
            {
                name: 'ollama',
                try: () => this.tryOllama(prompt, this.parseStateResponse.bind(this)),
                enabled: this.settings.activeProviders.includes('ollama'),
            },
            {
                name: 'gemini',
                try: () => this.tryGemini(prompt, this.parseStateResponse.bind(this)),
                enabled:
                    this.settings.activeProviders.includes('gemini') && this.settings.geminiKey,
            },
        ];

        const providerOrder = this.settings.preferLocal ? providers : providers.reverse();

        for (const provider of providerOrder) {
            if (provider.enabled) {
                try {
                    console.log(`Trying provider for state extraction: ${provider.name}`);
                    const result = await provider.try();
                    if (result) {
                        console.log(`Provider ${provider.name} succeeded for state extraction`);
                        return result;
                    }
                } catch (error) {
                    console.log(
                        `Provider ${provider.name} failed for state extraction: ${error.message}`
                    );
                }
            }
        }
        return null;
    }

    async callProviderForStateStreaming(prompt, onChunk) {
        const providers = [
            {
                name: 'ollama',
                try: () => this.tryOllamaStreaming(prompt, onChunk),
                enabled: this.settings.activeProviders.includes('ollama'),
            },
            {
                name: 'gemini',
                try: () => this.tryGeminiStreaming(prompt, onChunk),
                enabled:
                    this.settings.activeProviders.includes('gemini') && this.settings.geminiKey,
            },
        ];

        const providerOrder = this.settings.preferLocal ? providers : [...providers].reverse();

        for (const provider of providerOrder) {
            if (provider.enabled) {
                try {
                    console.log(`Trying streaming provider: ${provider.name}`);
                    const text = await provider.try();
                    if (text) {
                        console.log(`Streaming provider ${provider.name} succeeded`);
                        return text;
                    }
                } catch (error) {
                    console.log(`Streaming provider ${provider.name} failed: ${error.message}`);
                }
            }
        }
        return null;
    }

    _buildStatePrompt(gameState) {
        return `You are a text-parsing AI. Extract structured information from the following interactive fiction game text.

**Game:** ${gameState.gameTitle || 'Unknown'}
**Raw Game Text:**
\`\`\`
${gameState.gameText.slice(-100000)}
\`\`\`

**Your Task:**
Analyze the text and return a JSON object with ALL of the following fields: "location", "inventory", "objects", "npcs", "exits", "verbs", "room_description", "quests", "suggestedActions", "npcProfiles", and "mapData".

**JSON Schema:**
{
  "location": "string",
  "inventory": ["string"],
  "objects": ["string"],
  "npcs": ["string"],
  "exits": [{"direction": "string", "room": "string"}],
  "verbs": ["string"],
  "room_description": "string",
  "quests": [{"description": "string", "status": "active" | "completed"}],
  "suggestedActions": ["string"],
  "npcProfiles": {
    "string": {
      "description": "string",
      "location": "string",
      "dialogue": ["string"]
    }
  },
  "mapData": {
    "roomName": "string",
    "exits": [{"direction": "string", "room": "string"}]
  },
  "interactables": [
    {
      "name": "string",
      "type": "object" | "npc" | "exit",
      "actions": [
        {"command": "string", "label": "string", "confidence": 0.0}
      ]
    }
  ]
}

**Instructions:**
*   **Always** return a valid JSON object with all fields.
*   If a field is not present, use an empty string "" or empty array [].
*   **Objects:** For objects with adjectives (e.g., "rusty iron key"), also include the base noun ("key").
*   **Verbs:** From the list below, select up to 10 verbs that are most relevant to the current game text.
    ["ATTACK", "ASK", "BUY", "CLIMB", "CLOSE", "CUT", "DIG", "DRINK", "DROP", "EAT", "ENTER", "EXAMINE", "FILL", "GIVE", "INVENTORY", "JUMP", "LISTEN", "LOOK", "MOVE", "OPEN", "PULL", "PUSH", "READ", "SEARCH", "SIT", "SLEEP", "SMELL", "STAND", "TAKE", "TALK TO", "THROW", "TIE", "TURN ON", "TURN OFF", "UNLOCK", "USE", "WAIT", "WEAR"]
*   **Exits:** Return an array of objects, where each object has a "direction" and "room" property. If the room name is not mentioned, use "an unknown area".
*   **Interactables:** For every object, NPC, and navigable exit in the scene, create an entry in "interactables". Each entry must have:
    - **name:** The item/NPC/direction name (e.g., "rusty key", "old wizard", "north")
    - **type:** One of "object", "npc", or "exit"
    - **actions:** An array of 2-5 contextually appropriate parser commands for this specific interactable, sorted by confidence (highest first). Each action has:
      - **command:** The full parser command (e.g., "take rusty key", "ask old wizard about the quest")
      - **label:** A short verb label (e.g., "Take", "Ask about quest")
      - **confidence:** A float 0.0–1.0 indicating how useful this action is given the current context
    - Example: {"name": "rusty key", "type": "object", "actions": [{"command": "take rusty key", "label": "Take", "confidence": 0.95}, {"command": "examine rusty key", "label": "Examine", "confidence": 0.85}]}
    - Example exit: {"name": "north", "type": "exit", "actions": [{"command": "go north", "label": "Go north", "confidence": 0.90}]}
*   **Suggested Actions**: This is CRITICAL for choice-based gameplay. Based on the current situation, suggest 4-6 highly plausible, contextual actions the player would realistically want to take next. These should be:
    - Complete, actionable parser commands (e.g., "examine the rusty key", "ask guard about the prisoner", "unlock door with brass key")
    - Directly relevant to the current scene, available objects, NPCs, and story context
    - Focused on story progression, puzzle-solving, or meaningful exploration
    - Varied in type (examining objects, talking to NPCs, using items, moving to significant locations)
    - Avoid generic actions like "look", "inventory", "help", "wait", or simple cardinal directions unless they're specifically relevant
    - Avoid overly obvious or redundant commands
    - Use specific object names from the current context (prefer "examine brass key" over "examine key" if multiple keys exist)
    Examples for a scene with a locked door and guard: ["ask guard about the locked door", "examine the door lock closely", "search guard for keys", "go back to entrance hall"]
*   **Quests:** Extract any explicit or implicit objectives, goals, or tasks from the game text. Include:
    - Explicit goals mentioned directly: "Find the golden chalice" → {"description": "Find the golden chalice", "status": "active"}
    - Implicit tasks from obstacles: "The door is locked" → {"description": "Unlock the door", "status": "active"}
    - Story objectives: "You must rescue the princess" → {"description": "Rescue the princess", "status": "active"}
    - Completed goals: If text mentions completing something, mark "status": "completed"
    - If no clear objectives exist yet, return an empty array.
    Examples: [{"description": "Find a way to open the locked door", "status": "active"}, {"description": "Locate the missing key", "status": "active"}, {"description": "Escape the dark room", "status": "completed"}]
*   **NPC Profiles:** For each NPC mentioned in the "npcs" array, create a detailed entry in "npcProfiles" with:
    - **Key:** The NPC's name exactly as it appears in the "npcs" array
    - **description:** Physical description, appearance, or notable traits mentioned in the game text
    - **location:** The room name where the NPC was last seen (use the current location)
    - **dialogue:** Array of any quoted speech, conversation snippets, or things the NPC has said
    - If no NPCs are present or no details are available, return an empty object {}
    Example: {"old wizard": {"description": "A frail old man in tattered robes, leaning on a staff", "location": "Tower Room", "dialogue": ["You shall not pass!", "Beware the dragon to the north"]}}
*   Respond with only the JSON object.`;
    }

    _emptyState() {
        return {
            location: '',
            inventory: [],
            objects: [],
            npcs: [],
            exits: [],
            verbs: [],
            room_description: '',
            quests: [],
            suggestedActions: [],
            npcProfiles: {},
            mapData: { roomName: '', exits: [] },
            interactables: [],
        };
    }

    _validateAndNormalizeState(response) {
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
            return this._emptyState();
        }

        const rawInteractables = Array.isArray(response.interactables)
            ? response.interactables
            : [];
        // Sanitise each interactable — keep only well-formed entries
        const interactables = rawInteractables
            .filter(
                (i) =>
                    i &&
                    typeof i.name === 'string' &&
                    ['object', 'npc', 'exit'].includes(i.type) &&
                    Array.isArray(i.actions)
            )
            .map((i) => ({
                name: i.name,
                type: i.type,
                actions: i.actions
                    .filter(
                        (a) => a && typeof a.command === 'string' && typeof a.label === 'string'
                    )
                    .map((a) => ({
                        command: a.command,
                        label: a.label,
                        confidence:
                            typeof a.confidence === 'number'
                                ? Math.min(1, Math.max(0, a.confidence))
                                : 0.5,
                    }))
                    .sort((a, b) => b.confidence - a.confidence),
            }));

        const validated = {
            location: typeof response.location === 'string' ? response.location : '',
            inventory: Array.isArray(response.inventory) ? response.inventory : [],
            objects: Array.isArray(response.objects) ? response.objects : [],
            npcs: Array.isArray(response.npcs) ? response.npcs : [],
            exits: Array.isArray(response.exits) ? response.exits : [],
            verbs: Array.isArray(response.verbs) ? response.verbs : [],
            room_description:
                typeof response.room_description === 'string' ? response.room_description : '',
            quests: Array.isArray(response.quests) ? response.quests : [],
            suggestedActions: Array.isArray(response.suggestedActions)
                ? response.suggestedActions
                : [],
            npcProfiles:
                typeof response.npcProfiles === 'object' && !Array.isArray(response.npcProfiles)
                    ? response.npcProfiles
                    : {},
            mapData:
                response.mapData &&
                typeof response.mapData === 'object' &&
                !Array.isArray(response.mapData)
                    ? response.mapData
                    : { roomName: response.location || '', exits: response.exits || [] },
            interactables,
        };

        // Ensure mapData has the required structure
        if (!validated.mapData.roomName && validated.location) {
            validated.mapData.roomName = validated.location;
        }
        if (!Array.isArray(validated.mapData.exits)) {
            validated.mapData.exits = validated.exits;
        }

        // Backward compat: derive old fields from interactables when those fields are empty
        if (interactables.length > 0) {
            if (!validated.objects.length) {
                validated.objects = interactables
                    .filter((i) => i.type === 'object')
                    .map((i) => i.name);
            }
            if (!validated.npcs.length) {
                validated.npcs = interactables.filter((i) => i.type === 'npc').map((i) => i.name);
            }
            if (!validated.exits.length) {
                validated.exits = interactables
                    .filter((i) => i.type === 'exit')
                    .map((i) => ({ direction: i.name, room: '' }));
            }
        }

        return validated;
    }

    async extractStructuredState(gameState) {
        const prompt = this._buildStatePrompt(gameState);
        const response = await this.callProviderForState(prompt);
        return this._validateAndNormalizeState(response);
    }

    async extractStructuredStateStreaming(gameState, onProgress) {
        const prompt = this._buildStatePrompt(gameState);

        const onChunk = (accumulatedText) => {
            if (onProgress) {
                onProgress({ stage: this.detectStreamingStage(accumulatedText), accumulatedText });
            }
        };

        const fullText = await this.callProviderForStateStreaming(prompt, onChunk);
        if (fullText) {
            const parsed = this.parseStateResponse(fullText);
            return this._validateAndNormalizeState(parsed);
        }

        // Streaming unavailable or all providers failed — fall back to non-streaming
        const response = await this.callProviderForState(prompt);
        return this._validateAndNormalizeState(response);
    }

    async rephraseCommand(failedCommand, rejectionMessage, gameText) {
        const prompt = `You are helping a player in an interactive fiction game.

The player typed: "${failedCommand}"
The game responded: "${rejectionMessage}"

Recent game context:
${(gameText || '').slice(-300)}

Suggest 2-3 alternative commands the player could try instead.
Return ONLY a JSON array, no other text:
[{"command": "VERB NOUN", "label": "Short label"}]`;

        const parseArrayResponse = (text) => {
            if (!text) {
                return null;
            }
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start === -1 || end === -1) {
                return null;
            }
            try {
                return JSON.parse(text.substring(start, end + 1));
            } catch {
                return null;
            }
        };

        const providers = [
            {
                name: 'ollama',
                try: () => this.tryOllama(prompt, parseArrayResponse, 200),
                enabled: this.settings.activeProviders.includes('ollama'),
            },
            {
                name: 'gemini',
                try: () => this.tryGemini(prompt, parseArrayResponse, 200),
                enabled:
                    this.settings.activeProviders.includes('gemini') && this.settings.geminiKey,
            },
        ];

        const providerOrder = this.settings.preferLocal ? providers : [...providers].reverse();

        for (const provider of providerOrder) {
            if (provider.enabled) {
                try {
                    const result = await provider.try();
                    if (result && Array.isArray(result)) {
                        return result
                            .filter((item) => item && typeof item.command === 'string')
                            .slice(0, 3);
                    }
                } catch (error) {
                    console.log(`Rephrase provider ${provider.name} failed: ${error.message}`);
                }
            }
        }
        return [];
    }

    async getHint(rawGameState, structuredGameState, hintLevel) {
        const instructions = [
            '',
            'Give a vague, encouraging nudge. Do NOT reveal the solution. Point the player toward an area or object to focus on.',
            'Give a more specific hint. Suggest what type of action to try, without giving the exact command.',
            'Provide the explicit solution — tell the player exactly what command to type.',
        ];

        const location =
            typeof structuredGameState.location === 'string'
                ? structuredGameState.location
                : 'unknown';
        const inventory = Array.isArray(structuredGameState.inventory)
            ? structuredGameState.inventory
            : [];
        const recentCommands = Array.isArray(rawGameState.lastCommands)
            ? rawGameState.lastCommands
            : [];
        const recentText = (rawGameState.gameText || '').slice(-1000);

        const prompt =
            `You are an assistant for a parser interactive fiction game. ` +
            `The player is stuck (hint level ${hintLevel}/3).\n\n` +
            `Room: ${location}\n` +
            `Inventory: ${inventory.join(', ') || 'empty'}\n` +
            `Recent commands: ${recentCommands.join(', ') || 'none'}\n` +
            `Recent game text:\n${recentText}\n\n` +
            `Task: ${instructions[hintLevel]}\n\n` +
            `Respond with ONLY the hint (1-3 sentences). No JSON, no preamble.`;

        const parseTextResponse = (text) => (text ? text.trim() : null);

        const providers = [
            {
                name: 'ollama',
                try: () => this.tryOllama(prompt, parseTextResponse, 200),
                enabled: this.settings.activeProviders.includes('ollama'),
            },
            {
                name: 'gemini',
                try: () => this.tryGemini(prompt, parseTextResponse, 200),
                enabled:
                    this.settings.activeProviders.includes('gemini') && this.settings.geminiKey,
            },
        ];

        const providerOrder = this.settings.preferLocal ? providers : [...providers].reverse();

        for (const provider of providerOrder) {
            if (provider.enabled) {
                try {
                    const result = await provider.try();
                    if (result) {
                        return result;
                    }
                } catch (error) {
                    console.log(`Hint provider ${provider.name} failed: ${error.message}`);
                }
            }
        }
        return 'Try examining objects around you more carefully.';
    }

    detectStreamingStage(text) {
        if (!text) {
            return 'Analyzing...';
        }
        if (text.includes('"suggestedActions"')) {
            return 'Generating suggested actions...';
        }
        if (text.includes('"interactables"')) {
            return 'Identifying interactables...';
        }
        if (text.includes('"npcProfiles"')) {
            return 'Profiling NPCs...';
        }
        if (text.includes('"mapData"')) {
            return 'Mapping area...';
        }
        if (text.includes('"objects"')) {
            return 'Listing objects...';
        }
        if (text.includes('"location"')) {
            return 'Identifying location...';
        }
        return 'Analyzing...';
    }

    async tryOllama(prompt, responseParser, maxTokens = 500) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.settings.ollamaModel,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        max_tokens: maxTokens,
                    },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            const parser = responseParser || this.parseResponse.bind(this);
            // Removed: console.log('Ollama response:', data.response);
            // Security: Don't log API responses that may contain user data
            return parser(data.response);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async tryOllamaStreaming(prompt, onChunk, maxTokens = 500) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.settings.ollamaModel,
                    prompt,
                    stream: true,
                    options: { temperature: 0.7, top_p: 0.9, max_tokens: maxTokens },
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) {
                        continue;
                    }
                    try {
                        const chunk = JSON.parse(line);
                        if (chunk.response) {
                            accumulated += chunk.response;
                            if (onChunk) {
                                onChunk(accumulated);
                            }
                        }
                        if (chunk.done) {
                            return accumulated;
                        }
                    } catch {
                        // skip malformed lines
                    }
                }
            }

            return accumulated || null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async tryGemini(prompt, responseParser, maxTokens = 50000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

        try {
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.settings.geminiKey,
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: prompt,
                                    },
                                ],
                            },
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            topP: 0.9,
                            maxOutputTokens: maxTokens,
                            stopSequences: [],
                        },
                    }),
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parser = responseParser || this.parseResponse.bind(this);
            // Removed: console.log('Gemini response:', text);
            // Security: Don't log API responses that may contain user data
            return parser(text);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async tryGeminiStreaming(prompt, onChunk, maxTokens = 50000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

        try {
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent?alt=sse',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.settings.geminiKey,
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            topP: 0.9,
                            maxOutputTokens: maxTokens,
                        },
                    }),
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini streaming API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                // Gemini streams SSE: "data: {...}\n\n"
                const events = buffer.split('\n\n');
                buffer = events.pop(); // keep incomplete event

                for (const event of events) {
                    const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
                    if (!dataLine) {
                        continue;
                    }
                    try {
                        const data = JSON.parse(dataLine.slice(6)); // remove "data: "
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            accumulated += text;
                            if (onChunk) {
                                onChunk(accumulated);
                            }
                        }
                    } catch {
                        // skip malformed events
                    }
                }
            }

            return accumulated || null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    parseStateResponse(text) {
        if (!text) {
            return null;
        }

        const startIndex = text.indexOf('{');
        if (startIndex === -1) {
            console.error('Could not find start of JSON object in text:', text);
            return null;
        }

        const endIndex = text.lastIndexOf('}');
        if (endIndex === -1) {
            console.error('Could not find end of JSON object in text:', text);
            return null;
        }

        const jsonString = text.substring(startIndex, endIndex + 1);

        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error(
                'Failed to parse extracted JSON string:',
                error,
                'Extracted string:',
                jsonString,
                'Original text:',
                text
            );
            return null;
        }
    }
}

// Export for testing
export { LLMService };

// Initialize service for browser environment
if (typeof chrome !== 'undefined' && chrome.runtime) {
    const llmService = new LLMService();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getSuggestions') {
            llmService
                .getSuggestions(request.gameState, request.force)
                .then((response) => {
                    sendResponse({
                        success: true,
                        structuredState: response.structuredState || {},
                        rawResponse: response.rawResponse,
                    });
                })
                .catch((error) => {
                    console.error('Error getting suggestions:', error);
                    sendResponse({
                        success: false,
                        error: error.message,
                    });
                });
            return true; // Keep message channel open for async response
        }

        if (request.action === 'updateSettings') {
            llmService.loadSettings().then(() => {
                sendResponse({ success: true });
            });
            return true;
        }

        if (request.action === 'rephraseCommand') {
            llmService
                .rephraseCommand(request.failedCommand, request.rejectionMessage, request.gameText)
                .then((alternatives) => {
                    sendResponse({ success: true, alternatives });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;
        }

        if (request.action === 'getHint') {
            llmService
                .getHint(request.rawGameState, request.structuredGameState, request.hintLevel)
                .then((hint) => {
                    sendResponse({ success: true, hint });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;
        }
    });

    // Long-lived port for streaming responses
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'streaming') {
            return;
        }

        port.onMessage.addListener(async (request) => {
            if (request.action !== 'getSuggestionsStreaming') {
                return;
            }

            const { gameState, force } = request;

            try {
                await llmService.settingsPromise;

                const cacheKey = llmService.generateCacheKey(gameState);
                if (!force && llmService.cache.has(cacheKey)) {
                    const cached = llmService.cache.get(cacheKey);
                    if (Date.now() - cached.timestamp < 300000) {
                        port.postMessage({
                            type: 'done',
                            structuredState: cached.data.structuredState,
                        });
                        return;
                    }
                }

                const onProgress = ({ stage }) => {
                    try {
                        port.postMessage({ type: 'progress', stage });
                    } catch {
                        // port may already be closed
                    }
                };

                const structuredState = await llmService.extractStructuredStateStreaming(
                    gameState,
                    onProgress
                );

                if (structuredState.quests && chrome.storage) {
                    await chrome.storage.local.set({
                        [`quests_${gameState.gameTitle}`]: structuredState.quests,
                    });
                }

                const response = { structuredState };
                llmService.cache.set(cacheKey, { data: response, timestamp: Date.now() });
                if (llmService.cache.size > 50) {
                    const oldestKey = Array.from(llmService.cache.keys())[0];
                    llmService.cache.delete(oldestKey);
                }

                port.postMessage({ type: 'done', structuredState });
            } catch (error) {
                console.error('Streaming error:', error);
                try {
                    port.postMessage({ type: 'error', error: error.message });
                } catch {
                    // port may already be closed
                }
            }
        });
    });
}

// Handle extension installation (only in extension environment)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install') {
            console.log('Parchment-Assist installed');
            // Open options page on first install
            chrome.runtime.openOptionsPage();
        }
    });

    console.log('Parchment-Assist service worker started');
}
