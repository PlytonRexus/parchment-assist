# Quick Installation Guide

## Step 1: Download & Extract

- Download the `parchment-assist.zip` file
- Extract it to a folder on your computer
- Remember the location of the `parchment-assist` folder

## Step 2: Enable Developer Mode in Chrome

1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Turn on "Developer mode" (toggle in top-right corner)

## Step 3: Load the Extension

1. Click "Load unpacked" button
2. Navigate to and select the `parchment-assist` folder
3. Click "Select Folder"
4. The extension should now appear in your extensions list

## Step 4: Set Up AI Backend

Choose one or both options:

### Option A: Local AI (Ollama) - Recommended

1. Install Ollama from https://ollama.ai
2. Open terminal/command prompt
3. Run: `ollama pull llama3`
4. Run: `ollama serve`
5. In extension options, ensure "Prefer local LLM" is checked

### Option B: Cloud AI (Gemini)

1. Go to https://makersuite.google.com/app/apikey
2. Create a free Google account if needed
3. Generate an API key
4. In extension options, paste your API key

## Step 5: Test It Out

1. Visit https://iplayif.com
2. Load any Z-machine game (try "Bronze" or "Photopia")
3. Start playing - AI suggestions should appear below the input
4. Click suggestions or use Alt+1, Alt+2, etc.

## Troubleshooting

- If no suggestions appear, check the extension options page
- Use the connection test buttons to verify AI backends
- Make sure you're on a supported site (iplayif.com)

That's it! Enjoy enhanced interactive fiction gaming! 🎮🤖
