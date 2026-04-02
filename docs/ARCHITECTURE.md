# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parchment-Assist is a Chrome extension that adds AI-powered clickable command suggestions to Z-machine interactive fiction games running in the Parchment web interpreter. It creates a Gruescript-style interface for traditional parser-based IF games.

## Development Commands

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- mapManager.test.js
npm test -- npcProfiler.test.js
npm test -- turnCounter.test.js
```

### Installing Extension in Chrome

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select this directory
4. After code changes, click the refresh icon on the extension card

### Setting Up AI Backends

- **Ollama (Local)**: Run `ollama serve` in terminal, then `ollama pull llama3`
- **Gemini (Cloud)**: Get API key from https://makersuite.google.com/app/apikey

## Code Architecture

### Extension Entry Points

**content-loader.js** → Loads **content.js** as ES6 module into the page context. This two-stage loading is required because Chrome extension content scripts don't support ES6 imports directly.

**content.js** → Main content script. Instantiates `ParchmentAssist` class which orchestrates the entire extension. Runs in the page context (not isolated extension context) to access the game DOM.

**service-worker.js** → Background service worker that handles AI requests via `LLMService` class. Manages caching, request queuing, and provider selection (Ollama vs Gemini).

### Core Classes

**ParchmentAssist** (content.js)

- Detects Parchment games via DOM inspection
- Creates the draggable UI bubble and command palette
- Observes game text changes using MutationObserver
- Extracts raw game state and sends to service worker
- Renders structured data (location, inventory, NPCs, map, etc.) in the palette

**LLMService** (service-worker.js)

- Manages dual AI provider architecture (local Ollama, cloud Gemini)
- Implements request caching (5-minute TTL) and deduplication
- Sends structured prompts to extract JSON game state
- Falls back between providers based on `preferLocal` setting

**MapManager** (mapManager.js)

- Maintains a graph of discovered rooms and their connections
- Supports soft deletion (sets `isDeleted: true` rather than removing)
- Returns active rooms and connections for rendering

**NpcProfiler** (npc.js)

- Stores and updates NPC information (description, location, dialogue)
- Merges new NPC data with existing profiles

### Helper Utilities

**HTMLCleaner** (helpers/htmlCleaner.js)

- Cleans Parchment output HTML by removing scripts, styles, and UI elements
- Extracts text from `.BufferLine` elements (Parchment's text container)
- Fallback to basic text extraction if parsing fails

**AdvancedGameStateExtractor** (helpers/textMiner.js)

- Regex-based text parser for extracting structured data from game text
- Identifies location names, inventory, objects, NPCs, exits, room descriptions
- Used as fallback when AI is unavailable

**probeZMachine** (helpers/vmProbe.js)

- Attempts to access Z-machine VM internals (memory, program counter, globals)
- Currently exploratory - not heavily used in production flow

### Data Flow

1. MutationObserver in content.js detects game text changes
2. `extractRawGameState()` gathers text, commands, title
3. Content script sends `getStructuredState` message to service worker
4. Service worker calls `extractStructuredState()` which prompts AI with JSON schema
5. AI response is parsed, cached, and returned to content script
6. Content script renders structured data in the command palette UI

### AI Prompt Architecture

The service worker sends a detailed JSON schema prompt requesting:

- **location**: Current room name
- **inventory**: Player's items
- **objects**: Interactive objects in current room
- **npcs**: Non-player characters present
- **exits**: Available directions with destination room names
- **verbs**: Contextually relevant verbs from curated list
- **quests**: Active and completed objectives
- **suggestedActions**: 5 natural language commands (e.g., "ask the man about the ruby")
- **npcProfiles**: Character descriptions and dialogue history
- **mapData**: Room name and exit data for graph building

The AI must return valid JSON. Empty fields use `""` or `[]`.

### Important Implementation Details

**ES6 Module Loading**: content.js uses `import` statements and must be loaded via content-loader.js wrapper. When adding new modules, they must be listed in `web_accessible_resources` in manifest.json.

**Parchment Detection**: The extension checks multiple selectors to find input fields and output areas because different Parchment implementations use different DOM structures.

**Request Deduplication**: Service worker hashes game state to create cache keys, preventing duplicate AI requests for the same game state.

**Provider Fallback Logic**: If `preferLocal` is true, tries Ollama first, then Gemini. Order reverses if false. Each provider has an enabled check before attempting.

**Turn Counter**: Tracks game turns and room changes. Useful for quest progression tracking.

## Testing Strategy

- **Unit Tests**: mapManager.test.js, npcProfiler.test.js, turnCounter.test.js test core classes in isolation
- **Integration Tests**: main.integration.test.js and map.integration.test.js test multi-class workflows
- Uses `jest-environment-jsdom` to simulate browser DOM
- No transforms needed (modern Node supports ES6 modules)

## Extension Manifest Structure

- **Manifest V3** (modern Chrome extensions API)
- **host_permissions**: Needs localhost:11434 for Ollama, googleapis.com for Gemini, and all HTTPS sites for Parchment games
- **content_scripts**: Injects on all sites (checks for Parchment at runtime)
- **web_accessible_resources**: ES6 modules must be listed here to be imported from content scripts

## Common Development Patterns

**Adding a new helper class:**

1. Create file in `helpers/` or root
2. Export class/function with `export { ClassName }`
3. Import in content.js: `import { ClassName } from './helpers/file.js'`
4. Add to `web_accessible_resources` in manifest.json
5. Write unit test in `<module>.test.js`

**Modifying AI prompt:**

- Edit the JSON schema in service-worker.js `extractStructuredState()` method
- Update response parsing if new fields added
- Adjust content.js UI rendering to display new data

**Changing Parchment selectors:**

- Update `findInputField()` or `findOutputArea()` in content.js
- Test on iplayif.com and other Parchment sites
