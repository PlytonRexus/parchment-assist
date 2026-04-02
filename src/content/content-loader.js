(async () => {
    const src = chrome.runtime.getURL('src/content/content.js');
    await import(src);
})();
