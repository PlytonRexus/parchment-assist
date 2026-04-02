// helpers/htmlCleaner.js

export class HTMLCleaner {
    static clean(rawHtml) {
        if (!rawHtml) {
            return '';
        }

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, 'text/html');

            // Remove unwanted elements
            const elementsToRemove = doc.querySelectorAll(
                'style, script, noscript, .LineInput, #loadingpane, #errorpane'
            );
            elementsToRemove.forEach((el) => el.remove());

            // Extract text from relevant containers
            const bufferLines = doc.querySelectorAll('.BufferLine');
            if (bufferLines.length > 0) {
                return Array.from(bufferLines)
                    .map((line) => line.textContent.trim())
                    .filter((text) => text)
                    .join('\n');
            }

            // Fallback for simpler structures
            return doc.body.textContent.trim();
        } catch (error) {
            console.error('Failed to clean HTML:', error);
            // Fallback to basic text extraction if parsing fails
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            return tempDiv.textContent || tempDiv.innerText || '';
        }
    }
}
