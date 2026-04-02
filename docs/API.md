# API Documentation

This document provides comprehensive API documentation for the Parchment-Assist extension, covering the core classes, message passing interface, and integration points.

## Table of Contents

- [Overview](#overview)
- [Core Classes](#core-classes)
  - [ParchmentAssist](#parchmentassist)
  - [LLMService](#llmservice)
  - [MapManager](#mapmanager)
  - [NpcProfiler](#npcprofiler)
- [Helper Utilities](#helper-utilities)
- [Message Passing API](#message-passing-api)
- [Data Structures](#data-structures)
- [Extension Points](#extension-points)

## Overview

Parchment-Assist uses a multi-tier architecture:

- **Content Script** (`content.js`): Interacts with the page DOM and renders the UI
- **Background Service Worker** (`service-worker.js`): Handles AI requests and manages state
- **Helper Modules**: Provide utility functions for text processing, game state extraction, and data management

Communication between content script and service worker happens via Chrome's message passing API.

## Core Classes

### ParchmentAssist

**Location**: `src/content/content.js`

The main orchestrator class that runs in the page context and manages the entire extension lifecycle.

#### Constructor

```javascript
new ParchmentAssist();
```

Initializes the extension, sets up DOM observers, and creates the UI components.

#### Key Methods

##### `init()`

```javascript
async init(): Promise<void>
```

Initializes the extension by:

- Detecting the Parchment game interface
- Creating the UI bubble and command palette
- Setting up mutation observers
- Starting game state monitoring

**Throws**: Error if Parchment interface cannot be detected

---

##### `detectParchment()`

```javascript
detectParchment(): { inputField: HTMLElement, outputArea: HTMLElement } | null
```

Attempts to find Parchment DOM elements using multiple selector strategies.

**Returns**: Object containing `inputField` and `outputArea` elements, or `null` if not found

**Supported Selectors**:

- `.Input` / `.Output` (standard Parchment)
- `.parchment-input` / `.parchment-output`
- `#input` / `#output`

---

##### `extractRawGameState()`

```javascript
extractRawGameState(): Object
```

Extracts the current game state from the DOM.

**Returns**:

```javascript
{
  gameText: string,           // Recent game output
  recentCommands: string[],   // Last 5 player commands
  fullText: string,          // Complete game transcript
  gameTitle: string          // Game name (if detectable)
}
```

---

##### `getStructuredState(rawState)`

```javascript
async getStructuredState(rawState: Object): Promise<Object>
```

Sends raw game state to the service worker for AI processing.

**Parameters**:

- `rawState`: Object returned from `extractRawGameState()`

**Returns**: Structured game state object (see [Data Structures](#structured-game-state))

---

##### `renderStructuredData(data)`

```javascript
renderStructuredData(data: Object): void
```

Renders the structured game state in the command palette UI.

**Parameters**:

- `data`: Structured game state object

---

### LLMService

**Location**: `src/background/service-worker.js`

Manages AI provider communication and request caching.

#### Constructor

```javascript
new LLMService();
```

Initializes the LLM service with caching and provider configuration.

#### Key Methods

##### `extractStructuredState(rawState, options)`

```javascript
async extractStructuredState(
  rawState: Object,
  options?: { preferLocal?: boolean }
): Promise<Object>
```

Processes raw game state through AI to extract structured data.

**Parameters**:

- `rawState`: Raw game state from content script
- `options.preferLocal`: Whether to try Ollama before Gemini (default: from settings)

**Returns**: Structured game state (see [Data Structures](#structured-game-state))

**Caching**: Results are cached for 5 minutes based on game state hash

---

##### `callOllama(prompt, model)`

```javascript
async callOllama(prompt: string, model?: string): Promise<string>
```

Sends a prompt to the local Ollama instance.

**Parameters**:

- `prompt`: The prompt text
- `model`: Model name (default: from settings, typically "llama3")

**Returns**: AI response text

**Endpoint**: `http://localhost:11434/api/generate`

**Throws**: Error if Ollama is not running or request fails

---

##### `callGemini(prompt, apiKey)`

```javascript
async callGemini(prompt: string, apiKey?: string): Promise<string>
```

Sends a prompt to Google Gemini API.

**Parameters**:

- `prompt`: The prompt text
- `apiKey`: Gemini API key (default: from settings)

**Returns**: AI response text

**Endpoint**: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent`

**Throws**: Error if API key is invalid or request fails

---

##### `getCacheKey(rawState)`

```javascript
getCacheKey(rawState: Object): string
```

Generates a cache key based on game state hash.

**Parameters**:

- `rawState`: Raw game state object

**Returns**: SHA-256 hash string (used as cache key)

---

### MapManager

**Location**: `src/lib/mapManager.js`

Manages the game world map as a directed graph of rooms and connections.

#### Constructor

```javascript
new MapManager();
```

Initializes an empty map graph.

#### Key Methods

##### `addRoom(roomName, description)`

```javascript
addRoom(roomName: string, description?: string): void
```

Adds a new room to the map or updates an existing room.

**Parameters**:

- `roomName`: Unique room identifier
- `description`: Optional room description

---

##### `addConnection(fromRoom, direction, toRoom)`

```javascript
addConnection(fromRoom: string, direction: string, toRoom: string): void
```

Creates a directed connection between two rooms.

**Parameters**:

- `fromRoom`: Source room name
- `direction`: Direction (e.g., "north", "east", "up")
- `toRoom`: Destination room name

**Auto-creates**: Rooms if they don't exist

---

##### `deleteRoom(roomName)`

```javascript
deleteRoom(roomName: string): void
```

Soft-deletes a room (sets `isDeleted: true` rather than removing).

**Parameters**:

- `roomName`: Room to delete

---

##### `getActiveRooms()`

```javascript
getActiveRooms(): Object[]
```

Returns all non-deleted rooms.

**Returns**: Array of room objects:

```javascript
{
  name: string,
  description: string,
  isDeleted: false,
  connections: Object[]
}
```

---

##### `getRoom(roomName)`

```javascript
getRoom(roomName: string): Object | null
```

Retrieves a specific room.

**Returns**: Room object or `null` if not found

---

##### `getAllConnections()`

```javascript
getAllConnections(): Object[]
```

Returns all connections between active rooms.

**Returns**: Array of connection objects:

```javascript
{
  from: string,
  direction: string,
  to: string
}
```

---

### NpcProfiler

**Location**: `src/lib/npc.js`

Maintains profiles of NPCs encountered in the game.

#### Constructor

```javascript
new NpcProfiler();
```

Initializes an empty NPC database.

#### Key Methods

##### `updateNpc(name, data)`

```javascript
updateNpc(name: string, data: Object): void
```

Updates or creates an NPC profile.

**Parameters**:

- `name`: NPC identifier
- `data`: Object containing NPC information

**Data Structure**:

```javascript
{
  description?: string,     // Physical description
  location?: string,        // Current location
  dialogue?: string[],      // Conversation history
  relationship?: string,    // Relationship status
  notes?: string           // Additional information
}
```

**Behavior**: Merges new data with existing profile

---

##### `getNpc(name)`

```javascript
getNpc(name: string): Object | null
```

Retrieves an NPC profile.

**Returns**: NPC object or `null` if not found

---

##### `getAllNpcs()`

```javascript
getAllNpcs(): Object[]
```

Returns all NPC profiles.

**Returns**: Array of NPC objects with names

---

##### `deleteNpc(name)`

```javascript
deleteNpc(name: string): void
```

Removes an NPC profile.

**Parameters**:

- `name`: NPC to delete

---

## Helper Utilities

### HTMLCleaner

**Location**: `src/helpers/htmlCleaner.js`

#### `cleanHTML(html)`

```javascript
cleanHTML(html: string): string
```

Cleans Parchment output HTML by removing scripts, styles, and UI elements.

**Parameters**:

- `html`: Raw HTML string

**Returns**: Cleaned text content

**Features**:

- Removes `<script>` and `<style>` tags
- Extracts text from `.BufferLine` elements
- Strips HTML tags
- Normalizes whitespace

---

### AdvancedGameStateExtractor

**Location**: `src/helpers/textMiner.js`

#### `extractState(text)`

```javascript
extractState(text: string): Object
```

Uses regex patterns to extract structured data from game text.

**Parameters**:

- `text`: Game output text

**Returns**:

```javascript
{
  location: string,
  inventory: string[],
  objects: string[],
  npcs: string[],
  exits: string[],
  description: string
}
```

**Use Case**: Fallback when AI is unavailable

---

### probeZMachine

**Location**: `src/helpers/vmProbe.js`

#### `probeZMachine()`

```javascript
probeZMachine(): Object | null
```

Attempts to access Z-machine VM internals (experimental).

**Returns**: VM state object or `null` if unavailable

---

## Message Passing API

The extension uses Chrome's message passing for content script ↔ service worker communication.

### Content Script → Service Worker

#### `getStructuredState`

Requests AI processing of raw game state.

**Message Format**:

```javascript
{
  type: 'getStructuredState',
  payload: {
    gameText: string,
    recentCommands: string[],
    fullText: string,
    gameTitle: string
  }
}
```

**Response**:

```javascript
{
  location: string,
  inventory: string[],
  objects: string[],
  npcs: string[],
  exits: Array<{ direction: string, destination: string }>,
  verbs: string[],
  quests: {
    active: string[],
    completed: string[]
  },
  suggestedActions: string[],
  npcProfiles: Object[],
  mapData: {
    currentRoom: string,
    exits: Object[]
  }
}
```

---

#### `testConnection`

Tests AI backend connectivity.

**Message Format**:

```javascript
{
  type: 'testConnection',
  payload: {
    provider: 'ollama' | 'gemini',
    apiKey?: string
  }
}
```

**Response**:

```javascript
{
  success: boolean,
  message: string,
  latency?: number
}
```

---

### Service Worker → Content Script

The service worker can send updates to content scripts (currently unused but available):

```javascript
chrome.tabs.sendMessage(tabId, {
  type: 'update',
  payload: { ... }
});
```

---

## Data Structures

### Structured Game State

The primary data structure returned by `LLMService.extractStructuredState()`:

```typescript
interface StructuredGameState {
  // Current location
  location: string;

  // Player's inventory
  inventory: string[];

  // Interactive objects in current room
  objects: string[];

  // NPCs in current room
  npcs: string[];

  // Available exits with destinations
  exits: Array<{
    direction: string; // e.g., "north", "down"
    destination: string; // Room name
  }>;

  // Contextually relevant verbs
  verbs: string[];

  // Quest tracking
  quests: {
    active: string[];
    completed: string[];
  };

  // AI-suggested commands
  suggestedActions: string[];

  // NPC profiles with dialogue history
  npcProfiles: Array<{
    name: string;
    description: string;
    location: string;
    dialogue: string[];
  }>;

  // Map data for graph building
  mapData: {
    currentRoom: string;
    exits: Array<{
      direction: string;
      destination: string;
    }>;
  };
}
```

---

### Options/Settings

Stored in `chrome.storage.sync`:

```typescript
interface ExtensionSettings {
  // AI Configuration
  preferLocal: boolean; // Try Ollama first
  ollamaModel: string; // Model name (default: "llama3")
  geminiApiKey: string; // Gemini API key

  // UI Configuration
  maxSuggestions: number; // Number of buttons (4-10)
  timeout: number; // AI request timeout (ms)

  // Feature Flags
  enableKeyboardShortcuts: boolean;
  enableAutoRefresh: boolean;
}
```

---

## Extension Points

### Adding a New AI Provider

1. **Add provider method** to `LLMService` in `service-worker.js`:

```javascript
async callNewProvider(prompt, config) {
  // Implementation
}
```

2. **Update provider selection logic** in `extractStructuredState()`:

```javascript
if (settings.preferNewProvider && settings.newProviderEnabled) {
  response = await this.callNewProvider(prompt, settings.newProviderConfig);
}
```

3. **Add settings UI** in `src/ui/options.html`

4. **Update settings schema** in storage

---

### Adding a New Helper Class

1. **Create file** in `src/helpers/` or `src/lib/`:

```javascript
export class NewHelper {
  // Implementation
}
```

2. **Import in content.js**:

```javascript
import { NewHelper } from './helpers/newHelper.js';
```

3. **Add to manifest.json** `web_accessible_resources`:

```json
{
  "resources": ["src/helpers/newHelper.js"],
  "matches": ["<all_urls>"]
}
```

4. **Write tests** in `tests/unit/newHelper.test.js`

---

### Modifying the AI Prompt

The AI prompt is defined in `service-worker.js` `extractStructuredState()` method.

**Current prompt structure**:

```javascript
const prompt = `
Analyze this interactive fiction game state and return JSON:

${rawState.gameText}

Return this exact JSON structure:
{
  "location": "current room name",
  "inventory": ["item1", "item2"],
  ...
}
`;
```

**To add new fields**:

1. Update the JSON schema in the prompt
2. Update response parsing
3. Update UI rendering in `content.js`
4. Update type definitions in this doc

---

### Custom DOM Selectors

To support additional Parchment implementations, modify `detectParchment()` in `content.js`:

```javascript
const selectors = [
  { input: '.Input', output: '.Output' },
  { input: '.parchment-input', output: '.parchment-output' },
  { input: '#input', output: '#output' },
  // Add new selectors here
  { input: '.custom-input', output: '.custom-output' },
];
```

---

## Performance Considerations

### Caching

- AI responses are cached for 5 minutes
- Cache keys are based on game state hash
- Identical game states reuse cached results

### Request Deduplication

- Multiple rapid requests for the same state are deduplicated
- Only one AI request is made per unique game state

### Debouncing

- DOM mutation observer uses debouncing (500ms) to avoid excessive requests
- Game state updates are batched

---

## Security Considerations

### API Key Storage

- API keys are stored in `chrome.storage.sync` (encrypted by Chrome)
- Never logged or sent to non-AI endpoints

### Content Security

- HTML cleaning removes scripts and styles
- User input is sanitized before injection
- No `eval()` or dynamic code execution

### Network Requests

- Ollama: localhost only (no external network)
- Gemini: HTTPS only with API key authentication
- No third-party analytics or tracking

---

## Error Handling

### AI Request Failures

```javascript
try {
  const state = await getStructuredState(rawState);
} catch (error) {
  if (error.message.includes('Ollama')) {
    // Fall back to Gemini
  } else if (error.message.includes('API key')) {
    // Prompt user for API key
  } else {
    // Use regex-based fallback
    const state = AdvancedGameStateExtractor.extractState(rawState.gameText);
  }
}
```

### Network Errors

- Automatic retry with exponential backoff
- Provider fallback (Ollama → Gemini)
- Graceful degradation to regex extraction

---

## Testing APIs

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- mapManager.test.js

# With coverage
npm test -- --coverage
```

### Mocking Chrome APIs

Tests use jest to mock Chrome extension APIs:

```javascript
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn() },
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};
```

---

## Further Reading

- [Architecture Guide](ARCHITECTURE.md) - System design and data flow
- [Installation Guide](INSTALL.md) - Setup instructions
- [Deployment Guide](DEPLOYMENT.md) - Release process
- [Contributing Guide](../CONTRIBUTING.md) - Development practices

---

**Questions or need clarification?** Open an issue or discussion on GitHub!
