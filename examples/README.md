# Parchment-Assist Examples

This directory contains example configurations, usage scenarios, and integration examples for Parchment-Assist.

## Directory Structure

```
examples/
├── configurations/     # Example configuration files
├── scenarios/         # Usage scenarios and walkthroughs
└── README.md          # This file
```

## Examples Included

### Configuration Examples

**Ollama Local Setup** (`configurations/ollama-local.md`)

- Complete Ollama installation and configuration
- Model selection and optimization
- Performance tuning tips

**Gemini Cloud Setup** (`configurations/gemini-cloud.md`)

- Getting and configuring Gemini API key
- Rate limit management
- Cost optimization strategies

**Hybrid Configuration** (`configurations/hybrid-setup.md`)

- Best of both worlds: local + cloud
- Automatic fallback configuration
- When to use each backend

### Usage Scenarios

**Playing Classic IF** (`scenarios/classic-if-gameplay.md`)

- Using Parchment-Assist with Zork
- Example command suggestions
- Tips for best experience

**Mobile Gaming** (`scenarios/mobile-gaming.md`)

- Touch-optimized gameplay
- Gesture shortcuts
- Mobile-specific tips

**Accessibility Use Cases** (`scenarios/accessibility.md`)

- Reduced typing for accessibility
- Screen reader compatibility (future)
- Voice command integration (future)

## Quick Start Examples

### Basic Ollama Setup

```bash
# 1. Install Ollama
# Download from https://ollama.ai

# 2. Download a model
ollama pull llama3

# 3. Start Ollama
ollama serve

# 4. Configure extension
# - Open extension options
# - Check "Prefer local LLM"
# - Model name: llama3
# - Save settings

# 5. Test
# Visit https://iplayif.com
# Start any game
# AI suggestions should appear
```

### Basic Gemini Setup

```bash
# 1. Get API key
# Visit https://makersuite.google.com/app/apikey
# Click "Create API Key"
# Copy the key

# 2. Configure extension
# - Open extension options
# - Paste API key in "Gemini API Key" field
# - Uncheck "Prefer local LLM" (optional)
# - Save settings

# 3. Test
# Visit https://iplayif.com
# Start any game
# AI suggestions should appear
```

## Example Game Sessions

### Example 1: Exploring Zork

**Game output:**

```
West of House
You are standing in an open field west of a white house, with a boarded front door.
There is a small mailbox here.
```

**AI Suggestions:**

```
[OPEN MAILBOX]
[EXAMINE MAILBOX]
[READ MAILBOX]
[GO NORTH]
[GO SOUTH]
[LOOK AROUND]
```

**Explanation:** AI recognizes the mailbox as an interactive object and suggests relevant commands.

### Example 2: NPC Interaction

**Game output:**

```
Town Square
You are in a bustling town square. A merchant stands near a stall.
```

**AI Suggestions:**

```
[TALK TO MERCHANT]
[ASK MERCHANT ABOUT WARES]
[EXAMINE STALL]
[BUY FROM MERCHANT]
[GREET MERCHANT]
```

**Explanation:** AI identifies the NPC and suggests appropriate social interactions.

## Configuration Files

### settings.json Example

```json
{
  "preferLocal": true,
  "ollamaModel": "llama3",
  "geminiApiKey": "your-api-key-here",
  "maxSuggestions": 6,
  "timeout": 15000,
  "enableKeyboardShortcuts": true,
  "enableAutoRefresh": true
}
```

### Advanced Ollama Configuration

```bash
# Use a different model
ollama pull mistral
# Update extension options to use "mistral"

# Use a larger model for better quality
ollama pull llama3:70b
# Update extension options to use "llama3:70b"

# Use a faster model for quick responses
ollama pull phi
# Update extension options to use "phi"
```

## Integration Examples

### Custom Parchment Page

If you're hosting your own Parchment instance, Parchment-Assist should work automatically. The extension detects:

- `.Input` / `.Output` classes
- `#input` / `#output` IDs
- Custom selectors (see API docs for adding support)

### Testing with Different Games

```
# Infocom classics
https://iplayif.com/?story=https://...zork1.z5

# Modern IF
https://iplayif.com/?story=https://...photopia.z5

# Competition entries
https://iplayif.com/?story=https://...entry.z8
```

## Tips and Best Practices

### For Best AI Suggestions

1. **Play a few turns first**: Let AI build context
2. **Use descriptive commands**: AI learns from your style
3. **Mix suggestions and manual**: Don't rely 100% on AI
4. **Adjust timeout**: Increase for complex games
5. **Try different models**: Each has strengths

### Performance Optimization

**For Ollama:**

- Use smaller models on older hardware (phi, mistral)
- Use larger models on GPU-enabled systems (llama3:70b)
- Adjust timeout based on your hardware

**For Gemini:**

- Watch rate limits (60 requests/minute on free tier)
- Use hybrid mode to reduce API usage
- Enable caching to avoid duplicate requests

### Troubleshooting Common Issues

See the [FAQ](../FAQ.md) for detailed troubleshooting, or check these quick fixes:

**No suggestions appearing:**

```bash
# Check Ollama is running
ollama list
ollama serve

# Test Gemini API key
# Use "Test Connection" button in options
```

**Slow suggestions:**

```bash
# Switch to a faster model
ollama pull phi

# Or increase timeout in options
# Settings → Timeout → 30 seconds
```

## Contributing Examples

We welcome contributions of:

- New configuration examples
- Usage scenarios
- Integration guides
- Screenshots of example sessions
- Tips and tricks

Please submit via Pull Request with:

- Clear description
- Step-by-step instructions
- Expected results
- Any required files

## Questions?

If you have questions about these examples or need help with specific use cases:

- Open a [GitHub Discussion](https://github.com/PlytonRexus/parchment-assist/discussions)
- Check the [FAQ](../FAQ.md)
- Review the [Documentation](../docs/)

---

**Happy adventuring!** 🎮
