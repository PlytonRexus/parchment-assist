// Jest global setup: polyfill web APIs that jsdom doesn't expose by default
import { TextDecoder, TextEncoder } from 'util';

if (!globalThis.TextDecoder) {
    globalThis.TextDecoder = TextDecoder;
}
if (!globalThis.TextEncoder) {
    globalThis.TextEncoder = TextEncoder;
}
