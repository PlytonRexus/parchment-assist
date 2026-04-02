// GlkOte Interception - Hooks into Parchment's display updates
export function installGlkHook(callback) {
    if (typeof window === 'undefined') {
        return false;
    }

    // Don't install multiple hooks
    if (window.__parchmentAssistGlkHook) {
        return true;
    }

    // Wait for GlkOte to be available
    const installHook = () => {
        if (window.GlkOte && window.GlkOte.update) {
            const original = window.GlkOte.update;

            window.GlkOte.update = function (data) {
                try {
                    // Parse the data before passing to original
                    const parsedData = parseGlkUpdate(data);
                    callback(parsedData);
                } catch (e) {
                    console.warn('GlkOte hook callback failed:', e);
                }

                // Call original function
                return original.call(this, data);
            };

            window.__parchmentAssistGlkHook = true;
            console.log('[Parchment-Assist] GlkOte hook installed');
            return true;
        }
        return false;
    };

    // Try to install immediately
    if (installHook()) {
        return true;
    }

    // Or wait for GlkOte to load
    const checkInterval = setInterval(() => {
        if (installHook()) {
            clearInterval(checkInterval);
        }
    }, 500);

    // Give up after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);

    return true;
}

function parseGlkUpdate(data) {
    const parsed = {
        windows: {},
        input: null,
        generation: data.gen || 0,
    };

    if (data.windows) {
        for (const [windowId, windowData] of Object.entries(data.windows)) {
            if (windowData.type === 'buffer') {
                // Main story window
                parsed.windows[windowId] = {
                    type: 'buffer',
                    content: extractBufferContent(windowData),
                    clear: windowData.clear || false,
                };
            } else if (windowData.type === 'grid') {
                // Status line window
                parsed.windows[windowId] = {
                    type: 'grid',
                    content: extractGridContent(windowData),
                    width: windowData.width || 0,
                    height: windowData.height || 0,
                };
            }
        }
    }

    if (data.input) {
        parsed.input = {
            type: data.input.type,
            window: data.input.window,
            maxlen: data.input.maxlen,
        };
    }

    return parsed;
}

function extractBufferContent(windowData) {
    if (!windowData.content) {
        return '';
    }

    let text = '';

    for (const item of windowData.content) {
        if (typeof item === 'string') {
            text += item;
        } else if (item.text) {
            text += item.text;
        }
    }

    return text;
}

function extractGridContent(windowData) {
    if (!windowData.content) {
        return '';
    }

    let text = '';

    for (const line of windowData.content) {
        if (Array.isArray(line)) {
            for (const item of line) {
                if (typeof item === 'string') {
                    text += item;
                } else if (item.text) {
                    text += item.text;
                }
            }
            text += '\n';
        }
    }

    return text.trim();
}
