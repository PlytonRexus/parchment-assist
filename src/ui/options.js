// Parchment-Assist Options Page Script

class OptionsManager {
    constructor() {
        this.defaults = {
            enableOllama: true,
            enableGemini: false,
            preferLocal: true,
            ollamaModel: 'llama3',
            geminiKey: '',
            timeout: 15000,
            activeProviders: ['ollama'],
        };
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }

    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get(this.defaults);

            document.getElementById('enableOllama').checked = settings.enableOllama;
            document.getElementById('enableGemini').checked = settings.enableGemini;
            document.getElementById('preferLocal').checked = settings.preferLocal;
            document.getElementById('ollamaModel').value = settings.ollamaModel;
            document.getElementById('geminiKey').value = settings.geminiKey;
            document.getElementById('timeout').value = settings.timeout / 1000;

            console.log('Settings loaded:', settings);
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showStatus('Failed to load settings', 'error');
        }
    }

    setupEventListeners() {
        // Save settings button
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset settings button
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });

        // Test connections
        document.getElementById('testOllama').addEventListener('click', () => {
            this.testOllamaConnection();
        });

        document.getElementById('testGemini').addEventListener('click', () => {
            this.testGeminiConnection();
        });

        // Auto-save on changes (debounced)
        const inputs = [
            'enableOllama',
            'enableGemini',
            'preferLocal',
            'ollamaModel',
            'geminiKey',
            'timeout',
        ];
        inputs.forEach((id) => {
            const element = document.getElementById(id);
            const eventType = element.type === 'checkbox' ? 'change' : 'input';

            element.addEventListener(
                eventType,
                this.debounce(() => {
                    this.saveSettings(true); // Silent save
                }, 1000)
            );
        });
    }

    async saveSettings(silent = false) {
        try {
            const enableOllama = document.getElementById('enableOllama').checked;
            const enableGemini = document.getElementById('enableGemini').checked;
            const geminiKey = document.getElementById('geminiKey').value.trim();

            const activeProviders = [];
            if (enableOllama) {
                activeProviders.push('ollama');
            }
            if (enableGemini && geminiKey) {
                activeProviders.push('gemini');
            }

            const settings = {
                enableOllama,
                enableGemini,
                preferLocal: document.getElementById('preferLocal').checked,
                ollamaModel: document.getElementById('ollamaModel').value.trim() || 'llama3',
                geminiKey,
                timeout: parseInt(document.getElementById('timeout').value) * 1000,
                activeProviders,
            };

            await chrome.storage.sync.set(settings);

            // Notify service worker of settings change
            try {
                await chrome.runtime.sendMessage({ action: 'updateSettings' });
            } catch (_error) {
                console.log('Service worker not available for settings update');
            }

            if (!silent) {
                this.showStatus('Settings saved successfully!', 'success');
            }

            console.log('Settings saved:', settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showStatus('Failed to save settings', 'error');
        }
    }

    async resetSettings() {
        try {
            await chrome.storage.sync.clear();
            await this.loadSettings();
            await this.saveSettings();
            this.showStatus('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showStatus('Failed to reset settings', 'error');
        }
    }

    async testOllamaConnection() {
        const button = document.getElementById('testOllama');
        const status = document.getElementById('ollamaStatus');
        const model = document.getElementById('ollamaModel').value || 'llama3';

        button.disabled = true;
        status.className = 'status-indicator status-testing';
        this.showTestResult('Testing Ollama connection...\n');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: 'Hello, respond with just "OK"',
                    stream: false,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                status.className = 'status-indicator status-online';
                this.appendTestResult(
                    `✅ Ollama connected successfully!\nModel: ${model}\nResponse: ${data.response?.slice(0, 50)}...`
                );
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            status.className = 'status-indicator status-offline';

            if (error.name === 'AbortError') {
                this.appendTestResult(
                    `❌ Ollama connection timeout\nMake sure Ollama is running: ollama serve`
                );
            } else if (
                error.message.includes('NetworkError') ||
                error.message.includes('Failed to fetch')
            ) {
                this.appendTestResult(
                    `❌ Cannot connect to Ollama\nIs Ollama running on localhost:11434?\nStart with: ollama serve`
                );
            } else {
                this.appendTestResult(`❌ Ollama error: ${error.message}`);
            }
        } finally {
            button.disabled = false;
        }
    }

    async testGeminiConnection() {
        const button = document.getElementById('testGemini');
        const status = document.getElementById('geminiStatus');
        const apiKey = document.getElementById('geminiKey').value.trim();

        if (!apiKey) {
            this.showTestResult('\n❌ Gemini API key is required');
            return;
        }

        button.disabled = true;
        status.className = 'status-indicator status-testing';
        this.showTestResult('\nTesting Gemini connection...\n');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: 'Hello, respond with just "OK"',
                                    },
                                ],
                            },
                        ],
                    }),
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
                status.className = 'status-indicator status-online';
                this.appendTestResult(
                    `✅ Gemini connected successfully!\nResponse: ${text.slice(0, 50)}...`
                );
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`
                );
            }
        } catch (error) {
            status.className = 'status-indicator status-offline';

            if (error.name === 'AbortError') {
                this.appendTestResult(`❌ Gemini connection timeout`);
            } else if (error.message.includes('API_KEY_INVALID')) {
                this.appendTestResult(
                    `❌ Invalid Gemini API key\nGet a valid key from Google AI Studio`
                );
            } else {
                this.appendTestResult(`❌ Gemini error: ${error.message}`);
            }
        } finally {
            button.disabled = false;
        }
    }

    showTestResult(message) {
        const results = document.getElementById('testResults');
        results.className = 'test-results';
        results.textContent = message;
    }

    appendTestResult(message) {
        const results = document.getElementById('testResults');
        results.textContent += '\n' + message;
    }

    showStatus(message, type = 'success') {
        const statusDiv = document.getElementById('saveStatus');
        statusDiv.className = type;
        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden');

        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const optionsManager = new OptionsManager();
    optionsManager.init();
});

// Add some visual feedback for the page
document.addEventListener('DOMContentLoaded', () => {
    // Animate cards on load
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });

    // Add tooltips for help text
    const helpTexts = document.querySelectorAll('.help-text');
    helpTexts.forEach((help) => {
        help.addEventListener('mouseenter', () => {
            help.style.color = '#667eea';
        });

        help.addEventListener('mouseleave', () => {
            help.style.color = '#7f8c8d';
        });
    });
});
