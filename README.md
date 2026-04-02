# Parchment-Assist

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://github.com/PlytonRexus/parchment-assist/workflows/CI/badge.svg)](https://github.com/PlytonRexus/parchment-assist/actions)
[![Coverage](https://img.shields.io/badge/coverage-view%20report-blue)](https://github.com/PlytonRexus/parchment-assist)
[![Chrome Web Store](https://img.shields.io/badge/chrome-coming%20soon-inactive)](https://github.com/PlytonRexus/parchment-assist)

**AI-powered command suggestions for Z-machine games in the Parchment web player**

Parchment-Assist is a Chrome extension that adds Gruescript-style clickable command buttons to traditional parser-based interactive fiction games running in the Parchment web interpreter. It uses AI (either local via Ollama or cloud via Google Gemini) to analyze the current game state and suggest contextually appropriate commands.

## Table of Contents

- [Features](#-features)
- [Screenshots](#-screenshots)
- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Platform Support](#-platform-support)
- [Installation](#-installation)
- [Setup](#️-setup)
- [Usage](#-usage)
- [Configuration](#-configuration-options)
- [Project Structure](#-project-structure)
- [How It Works](#-how-it-works)
- [Privacy & Security](#️-privacy--security)
- [Troubleshooting](#-troubleshooting)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [FAQ](#-frequently-asked-questions)
- [Future Enhancements](#-future-enhancements)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

## ✨ Features

- **Smart Command Suggestions**: AI analyzes game text to suggest relevant commands
- **One-Click Commands**: Click buttons to instantly execute suggestions
- **Keyboard Shortcuts**: Alt+1, Alt+2, etc. for quick access
- **Dual AI Support**: Works with both local Ollama models and Google Gemini API
- **Automatic Fallback**: Regex-based suggestions when AI is unavailable
- **Real-time Updates**: Suggestions update as the game state changes
- **Touch-Friendly**: Makes parser IF accessible on mobile devices
- **Zero Modification**: Works with existing Parchment games without changes

## 📸 Screenshots

> **Note**: Screenshots coming soon! We're preparing visual examples of the extension in action.

Planned screenshots will showcase:

- Command suggestions in a live game
- Extension options page
- AI backend configuration
- Touch-friendly mobile interface
- Keyboard shortcuts in action

See the `/screenshots` directory for the latest visuals.

## 🚀 Quick Start

**TL;DR**: Install the extension → Set up Ollama OR get a Gemini API key → Visit iplayif.com → Start playing!

```bash
# For local AI (recommended):
1. Install Ollama from https://ollama.ai
2. Run: ollama pull llama3
3. Run: ollama serve
4. Load extension in Chrome
5. Visit any Z-machine game on iplayif.com

# For cloud AI:
1. Get API key from https://makersuite.google.com/app/apikey
2. Load extension in Chrome
3. Open extension options, enter API key
4. Visit any Z-machine game on iplayif.com
```

## 📋 Prerequisites

Before installing Parchment-Assist, ensure you have:

- **Chrome/Chromium Browser**: Version 88 or higher
  - Also compatible with Edge, Brave, and other Chromium-based browsers
- **For Development**: Node.js >=18.0.0 and npm >=9.0.0
- **For Local AI** (optional): [Ollama](https://ollama.ai) installed
- **For Cloud AI** (optional): [Google Gemini API key](https://makersuite.google.com/app/apikey)

## 🌐 Platform Support

| Platform | Status           | Notes                               |
| -------- | ---------------- | ----------------------------------- |
| Chrome   | ✅ Supported     | Primary target platform             |
| Edge     | ✅ Supported     | Chromium-based, fully compatible    |
| Brave    | ✅ Supported     | Chromium-based, fully compatible    |
| Opera    | ✅ Supported     | Chromium-based, fully compatible    |
| Firefox  | 🔄 Planned       | Mozilla Add-ons version coming soon |
| Safari   | ❌ Not supported | No current plans                    |

### Supported Games

Works with any Z-machine game on:

- iplayif.com
- Any website hosting Parchment-based games
- Games like Planetfall, Anchorhead, Photopia, and thousands of others

## 🚀 Installation

### Method 1: Load Unpacked (Development)

1. Download and extract the `parchment-assist` folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `parchment-assist` folder
5. The extension should now be active

### Method 2: Chrome Web Store (Future)

_This extension is not yet published to the Chrome Web Store_

## ⚙️ Setup

### Option 1: Local AI (Recommended)

1. Install [Ollama](https://ollama.ai) on your computer
2. Download a model: `ollama pull llama3`
3. Start Ollama: `ollama serve`
4. Open extension options and ensure "Prefer local LLM" is checked

### Option 2: Cloud AI (Google Gemini)

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open extension options and enter your API key
3. Optionally disable "Prefer local LLM" to use cloud-first

### Option 3: Hybrid (Best Experience)

- Set up both local and cloud options
- Extension will try local first, fall back to cloud if needed

## 🎯 Usage

1. **Visit a Z-machine game** on iplayif.com
2. **AI suggestions appear** below the command input field
3. **Click suggestions** to execute them instantly
4. **Use keyboard shortcuts**: Alt+1 through Alt+8
5. **Suggestions update automatically** as you play

### Example Workflow

```
> LOOK
You are in a small room. There is a key on the table.
[AI Suggestions appear]
[EXAMINE KEY] [TAKE KEY] [LOOK AT TABLE] [INVENTORY]
```

## 🔧 Configuration Options

- **Prefer Local LLM**: Try Ollama before cloud services
- **Ollama Model**: Specify which local model to use (default: llama3)
- **Gemini API Key**: Your Google AI API key for cloud inference
- **Max Suggestions**: Number of buttons to show (4-10)
- **Timeout**: How long to wait for AI responses (10-30s)

## 📁 Project Structure

```
parchment-assist/
├── src/                        # Source code
│   ├── assets/icons/           # Extension icons
│   ├── background/             # Background scripts
│   │   └── service-worker.js   # AI request handling
│   ├── content/                # Content scripts
│   │   └── content.js          # DOM interaction & game state
│   ├── helpers/                # Utility functions
│   │   ├── htmlCleaner.js      # HTML sanitization
│   │   └── textMiner.js        # Text extraction
│   ├── lib/                    # Core libraries
│   │   ├── mapManager.js       # Location tracking
│   │   └── npc.js              # NPC profiling
│   └── ui/                     # UI components
│       ├── options.html/js     # Settings page
│       ├── popup.html/js       # Extension popup
│       └── ui.css              # Styling
├── tests/                      # Test suite
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── feature/                # Feature tests
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # System design
│   ├── API.md                  # API reference
│   ├── DEPLOYMENT.md           # Release guide
│   └── INSTALL.md              # Installation guide
├── .github/                    # GitHub configuration
│   ├── workflows/              # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── manifest.json               # Extension manifest (MV3)
├── package.json                # Node.js dependencies
├── jest.config.js              # Test configuration
├── eslint.config.js            # Linting rules
├── .prettierrc.js              # Code formatting
├── CHANGELOG.md                # Version history
├── SECURITY.md                 # Security policy
├── CONTRIBUTING.md             # Contribution guide
├── FAQ.md                      # Common questions
└── README.md                   # This file
```

## 🧠 How It Works

1. **Content Script** monitors the Parchment player for text changes
2. **Game State Extraction** captures location, inventory, recent commands
3. **AI Request** sends context to either Ollama or Gemini
4. **Response Parsing** extracts valid commands from AI response
5. **Button Rendering** displays clickable suggestions
6. **Command Execution** injects selected commands into the game

## 🛡️ Privacy & Security

- **Local Processing**: When using Ollama, no data leaves your computer
- **Minimal Data**: Only game text and commands are processed
- **No Tracking**: Extension doesn't collect or store personal data
- **Optional Cloud**: Gemini usage is entirely optional
- **Open Source**: Full source code available for inspection

## 🐛 Troubleshooting

### "No suggestions available"

- Check if Ollama is running (`ollama serve`)
- Verify your Gemini API key in options
- Try the connection test in options

### "Connection error"

- Ensure Ollama is accessible at `http://localhost:11434`
- Check your internet connection for Gemini
- Try reloading the game page

### Buttons not appearing

- Confirm you're on a supported site (iplayif.com)
- Check that the game has started (input field visible)
- Try refreshing the page

### AI gives poor suggestions

- Try a different Ollama model (`ollama pull mistral`)
- Increase the timeout in options
- The AI learns from context, so play a bit first

## 🔮 Future Enhancements

- **Glulx Support**: Extend to modern IF formats
- **Firefox Port**: Mozilla Add-ons support
- **Custom Prompts**: User-defined AI instructions
- **Command History**: Smart suggestion based on past actions
- **Multi-language**: Support for non-English games
- **Voice Input**: Speech-to-command functionality

## 📚 API Documentation

For detailed technical documentation about the extension's architecture, APIs, and integration points, see:

- **[API Documentation](docs/API.md)** - Comprehensive API reference
- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and component overview
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Release process and Chrome Web Store submission

## 🤝 Contributing

This extension is open source and contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Development Setup

```bash
# Clone the repository
git clone https://github.com/PlytonRexus/parchment-assist.git
cd parchment-assist

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Run all quality checks
npm run validate
```

For detailed contribution guidelines, code of conduct, and development practices, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Supported AI Models

- **Ollama**: Any GGUF model (llama3, mistral, phi, etc.)
- **Gemini**: Pro and Flash models via API
- **Future**: OpenAI, Anthropic, local transformers.js

## ❓ Frequently Asked Questions

For common questions and answers, see our [FAQ](FAQ.md).

Quick answers:

- **Is my data private?** Yes, with Ollama everything stays local. Gemini sends data to Google.
- **Does it work offline?** Yes, if you use Ollama for local AI processing.
- **Can I use it on mobile?** Yes! The touch-friendly buttons work great on mobile Chrome.
- **What games are supported?** Any Z-machine game running in Parchment.

See [FAQ.md](FAQ.md) for more questions and detailed answers.

## 📜 License

MIT License - Feel free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

## 🔒 Security

For information about reporting security vulnerabilities, see our [Security Policy](SECURITY.md).

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each version.

## 🙏 Acknowledgments

- **Parchment Team** for the excellent web IF interpreter
- **Infocom** for creating the Z-machine standard
- **Interactive Fiction Community** for keeping parser IF alive
- **@robinjohnson** for Gruescript inspiration
- **Ollama Team** for making local AI accessible
- **Google** for the Gemini API

---

**Made with ❤️ for the Interactive Fiction community**

_Turn any Z-machine game into a modern, touch-friendly experience!_
