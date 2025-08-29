// 🧠 Shared memory for extracted request strings
export const extractedStringsMemory = new Set();

// 🔮 General-purpose memory glyph store
const memoryGlyphs = new Map();

/**
 * 🧬 Set a glyph or value in memory
 * @param {string} key 
 * @param {*} value 
 */
export function set(key, value) {
    memoryGlyphs.set(key, value);
}

/**
 * 🔍 Retrieve a glyph or value
 * @param {string} key 
 * @returns {*} value
 */
export function get(key) {
    return memoryGlyphs.get(key);
}

/**
 * 🧹 Clear all memory glyphs
 */
export function clear() {
    memoryGlyphs.clear();
}

/**
 * 📜 Get all keys
 * @returns {string[]}
 */
export function keys() {
    return [...memoryGlyphs.keys()];
}
