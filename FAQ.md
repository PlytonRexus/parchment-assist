# Frequently Asked Questions (FAQ)

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Privacy & Security](#privacy--security)
- [AI Backends](#ai-backends)
- [Usage & Gameplay](#usage--gameplay)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## General Questions

### What is Parchment-Assist?

Parchment-Assist is a Chrome extension that adds AI-powered clickable command suggestions to classic text-adventure games (Z-machine games) running in the Parchment web player. It makes traditional parser-based interactive fiction more accessible by providing Gruescript-style command buttons.

### Which games does it work with?

Any Z-machine game running in the Parchment web interpreter, including:

- Games on iplayif.com
- Classic Infocom games (Zork, Planetfall, Anchorhead, etc.)
- Modern IF games distributed as Z-machine files
- Thousands of games in the Interactive Fiction Database

### Is it free?

Yes! Parchment-Assist is completely free and open source (MIT License). The local AI option (Ollama) is also free. The cloud option (Google Gemini) offers a free tier with generous limits.

### Does it change the games?

No. The extension only adds a UI overlay. It doesn't modify the game files or change how they work. You can play normally by typing commands, and the AI suggestions are entirely optional.

### What platforms are supported?

- **Chrome**: ✅ Fully supported (primary platform)
- **Edge, Brave, Opera**: ✅ Fully supported (Chromium-based)
- **Firefox**: 🔄 Planned for future release
- **Safari**: ❌ Not currently planned

---

## Installation & Setup

### How do I install the extension?

**Current method** (development version):

1. Download the repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the folder

**Future**: We plan to publish on the Chrome Web Store for one-click installation.

### Do I need to install anything else?

It depends on which AI backend you choose:

- **Local AI (Ollama)**: Yes, install [Ollama](https://ollama.ai) and download a model
- **Cloud AI (Gemini)**: No, just get a free API key
- **No AI**: The extension can work with basic regex patterns without AI

### Which AI backend should I choose?

| Feature     | Ollama (Local)                    | Gemini (Cloud)      |
| ----------- | --------------------------------- | ------------------- |
| **Privacy** | Everything stays on your computer | Data sent to Google |
| **Cost**    | Free                              | Free tier available |
| **Speed**   | Fast (depends on hardware)        | Very fast           |
| **Offline** | Works offline                     | Requires internet   |
| **Setup**   | More complex                      | Very simple         |

**Recommendation**: Start with Gemini for easy setup, then switch to Ollama if you prefer privacy.

### Can I use both backends?

Yes! The extension supports hybrid mode:

1. Set up both Ollama and Gemini
2. Enable "Prefer local LLM" in settings
3. The extension tries Ollama first, falls back to Gemini if unavailable

This gives you the best of both worlds.

### What are the system requirements?

**Minimum**:

- Chrome 88+ (or Chromium-based browser)
- For Ollama: 8GB RAM, modern CPU

**Recommended**:

- Chrome 100+
- For Ollama: 16GB RAM, GPU support for faster inference

### Where do I get a Gemini API key?

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it in extension options

The free tier includes generous limits (60 requests per minute).

---

## Privacy & Security

### Is my game data private?

**With Ollama (local)**: Yes, absolutely. All processing happens on your computer. No data leaves your machine.

**With Gemini (cloud)**: Game text and context are sent to Google's servers for processing. Google's privacy policy applies.

### What data does the extension collect?

**None**. Parchment-Assist doesn't collect, store, or transmit any personal data, analytics, or telemetry. It's completely privacy-focused.

The extension only:

- Reads game text from the Parchment player
- Sends context to your chosen AI backend
- Stores settings locally in your browser

### Is my API key safe?

Yes. Your Gemini API key is stored in Chrome's encrypted sync storage. It's never logged or sent anywhere except the Gemini API endpoints.

**Best practices**:

- Don't share your API key
- Rotate keys periodically
- Use the free tier key for testing
- Revoke keys if compromised

### Can the extension access my other data?

No. The extension only has permissions for:

- **Storage**: Saving your settings
- **Active Tab**: Reading the Parchment game page
- **Scripting**: Injecting the UI overlay
- **Host permissions**: Parchment sites and AI API endpoints

It cannot access your browsing history, passwords, files, or other websites.

### Is the code open source?

Yes! The full source code is available on [GitHub](https://github.com/PlytonRexus/parchment-assist). You can review it, audit it, and contribute to it.

---

## AI Backends

### How do I install Ollama?

1. **Download**: Visit [ollama.ai](https://ollama.ai) and download for your OS
2. **Install**: Run the installer
3. **Download a model**: Open terminal and run `ollama pull llama3`
4. **Start Ollama**: Run `ollama serve`
5. **Configure extension**: Open extension options, enable "Prefer local LLM"

### Which Ollama model should I use?

**Recommended models**:

- **llama3** (default): Good balance of speed and quality
- **mistral**: Fast, good for weaker hardware
- **phi**: Very fast, smaller model
- **codellama**: Experimental, may give interesting results

**To switch models**:

```bash
ollama pull mistral
```

Then update the model name in extension options.

### Why isn't Ollama working?

**Common issues**:

1. **Ollama not running**: Make sure `ollama serve` is running in terminal
2. **Port blocked**: Check that nothing is using port 11434
3. **No model downloaded**: Run `ollama pull llama3`
4. **Firewall**: Allow Ollama through your firewall

**Test connection**: Use the "Test Connection" button in extension options.

### How much does Gemini cost?

Google Gemini has a **generous free tier**:

- 60 requests per minute
- 1,500 requests per day
- Sufficient for casual IF playing

Paid tiers are available for heavy usage, but most users stay within free limits.

### Can I use OpenAI or Claude?

Not yet, but it's planned! We're working on adding support for:

- OpenAI (GPT-4, GPT-3.5)
- Anthropic Claude
- Local transformers.js models

Follow the [roadmap](README.md#-future-enhancements) for updates.

### Which backend gives better suggestions?

**Quality ranking** (subjective):

1. **Google Gemini Pro**: Best quality, understands IF context well
2. **Ollama llama3**: Very good, especially with 8B+ models
3. **Ollama mistral**: Good, slightly less context awareness
4. **Regex fallback**: Basic but functional

---

## Usage & Gameplay

### How do I use the extension?

1. Visit a Z-machine game on iplayif.com
2. Start playing the game normally
3. AI suggestions appear below the input field
4. Click a suggestion to execute it, or keep typing manually
5. Suggestions update automatically as you play

### Can I still type commands manually?

**Yes!** The extension doesn't interfere with normal gameplay. You can:

- Type commands manually as always
- Ignore the suggestions completely
- Mix clicking suggestions with manual typing

### What keyboard shortcuts are available?

- **Alt+1 through Alt+8**: Execute suggestions 1-8
- **Alt+9**: Refresh suggestions
- **Alt+0**: Toggle suggestion panel

(Keyboard shortcuts can be disabled in settings)

### Do suggestions spoil the game?

The AI tries to suggest contextually appropriate commands without spoiling puzzles, but it's not perfect. Suggestions are based on:

- Current room description
- Visible objects and NPCs
- Recent commands

**For purists**: You can disable the extension for puzzle-heavy games and enable it for exploration-heavy games.

### Can I use it on mobile?

**Yes!** This is actually one of the main use cases. The touch-friendly buttons make parser IF playable on phones and tablets.

**Mobile tips**:

- Use Chrome on Android
- Tap suggestions instead of typing
- Enable larger suggestion buttons in settings

### Does it work offline?

**With Ollama**: Yes, completely offline once models are downloaded

**With Gemini**: No, requires internet connection

### How accurate are the suggestions?

Accuracy depends on:

- **AI model quality**: Gemini > Llama3 > Mistral
- **Game complexity**: Works better with descriptive games
- **Context available**: Improves as you play longer

Typical accuracy: 60-80% useful suggestions, occasional irrelevant ones.

---

## Troubleshooting

### "No suggestions available"

**Possible causes**:

1. **Ollama not running**: Start `ollama serve`
2. **No Gemini API key**: Add key in options
3. **Network error**: Check internet connection
4. **Request timeout**: Increase timeout in settings

**Solution**: Check extension options page for connection status.

### Suggestions are very slow

**Possible causes**:

1. **Ollama on slow hardware**: Try a smaller model (phi, mistral)
2. **Large context**: The AI processes recent game history
3. **Network latency**: Switch from Ollama to Gemini or vice versa

**Solution**: Increase timeout or use a faster backend.

### Suggestions don't make sense

**Possible causes**:

1. **Insufficient context**: Play a bit longer to build history
2. **Model mismatch**: Try a different Ollama model
3. **Complex puzzle**: AI may not understand obscure IF conventions

**Solution**: Ignore bad suggestions and type manually. Report persistent issues on GitHub.

### Extension not detecting Parchment

**Possible causes**:

1. **Custom Parchment version**: Site uses non-standard selectors
2. **Extension not loaded**: Refresh the page
3. **Incompatible site**: Not all IF players are supported

**Solution**: Report the site on GitHub so we can add support.

### API key not working

**Possible causes**:

1. **Invalid key**: Double-check you copied the full key
2. **Key revoked**: Generate a new key
3. **Rate limit exceeded**: Wait and try again

**Solution**: Test the key on [Google AI Studio](https://makersuite.google.com) first.

### Buttons overlapping game text

**Solution**: The UI bubble is draggable. Click and drag it to a different position on the screen.

### Extension conflicts with other tools

If you have other extensions that modify web pages (screen readers, page modifiers), they might conflict.

**Solution**:

1. Disable other extensions temporarily
2. Report the conflict on GitHub
3. We can add compatibility fixes

---

## Development

### How can I contribute?

See our [Contributing Guide](CONTRIBUTING.md) for detailed instructions.

**Quick start**:

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Make changes
5. Run tests: `npm test`
6. Submit a pull request

### How do I run tests?

```bash
# All tests
npm test

# Specific test file
npm test -- mapManager.test.js

# With coverage
npm test -- --coverage

# Watch mode (auto-rerun on changes)
npm test -- --watch
```

### How do I debug the extension?

1. Load unpacked extension in Chrome
2. Right-click extension icon → "Inspect popup" (for popup debugging)
3. Open Chrome DevTools on game page → Console tab (for content script)
4. Go to `chrome://extensions/` → Click "service worker" link (for background script)

### Where are the logs?

- **Content script logs**: Browser DevTools console on game page
- **Service worker logs**: `chrome://extensions/` → "service worker" → Console
- **UI logs**: Right-click extension popup → Inspect

### How do I add a new AI provider?

See [API Documentation - Extension Points](docs/API.md#adding-a-new-ai-provider) for detailed instructions.

### Can I use this for other games?

The architecture is specific to Z-machine/Parchment, but the approach can be adapted:

- **Glulx games**: Possible with modifications
- **Choice-based IF (Twine, ChoiceScript)**: Different architecture needed
- **Parser IF (non-Parchment)**: Would need custom selectors

Feel free to fork and adapt for other use cases!

### How do I report bugs?

1. Check [existing issues](https://github.com/PlytonRexus/parchment-assist/issues)
2. If new, create an issue with:
   - Browser version
   - Extension version
   - AI backend used
   - Steps to reproduce
   - Screenshots if relevant

Use the bug report template when creating issues.

---

## Still have questions?

- **GitHub Discussions**: [Ask the community](https://github.com/PlytonRexus/parchment-assist/discussions)
- **GitHub Issues**: [Report bugs](https://github.com/PlytonRexus/parchment-assist/issues)
- **Documentation**: [Read the docs](docs/)

---

**Happy adventuring!** 🎮✨
