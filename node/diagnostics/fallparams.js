// node/diagnostics/fallparams.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🧭 Reconstruct __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📜 Paths
const homeParamsPath = path.join(__dirname, '..', 'memory', 'home-params.txt');
const paramsPath = path.join(__dirname, '..', 'logs', 'params.txt');
const requestHeadersPath = path.join(__dirname, '..', 'logs', 'request-headers.txt');
const responseHeadersPath = path.join(__dirname, '..', 'logs', 'response-headers.txt');
const valuesPath = path.join(__dirname, '..', 'logs', 'values.txt');

// 🧪 Extract glyphs from incoming flow
export function extractFallParams(flow) {
    const contentTypeHeader = flow.responseHeadersArray.find(h =>
        h.name.toLowerCase() === 'content-type'
    );
    const contentType = contentTypeHeader?.value?.toLowerCase() || '';

    const isAsset = (
        contentType.startsWith('image/') ||
        contentType.startsWith('font/') ||
        contentType.startsWith('application/font-') ||
        contentType === 'application/octet-stream' ||
        contentType === 'text/css'
    );
    if (isAsset) {
        console.log(`🧼 Skipped asset flow: ${contentType}`);
        return;
    }

    const glyphs = new Set();
    const requestHeaderKeys = new Set();
    const responseHeaderKeys = new Set();
    const detectedValues = new Set();

    // 🌐 Query Params
    try {
        const queryParams = new URL(flow.url).searchParams;
        for (const [key, value] of queryParams) {
            glyphs.add(key);
            detectedValues.add(value);
        }
    } catch { }

    // 🧪 JS Variables
    [...flow.responseBody.matchAll(/(let|const|var)\s([\w\,\s]+)\s*?(\n|\r|;|=)/g)]
        .forEach(match => match[2].split(',').forEach(v => glyphs.add(v.trim())));

    // 🧬 JSON/Object Keys
    [...flow.responseBody.matchAll(/["']([\w\-]+)["']\s*?:/g)].forEach(m => glyphs.add(m[1]));

    // 🧿 Template Literals
    [...flow.responseBody.matchAll(/\${\s*([\w\-]+)\s*}/g)].forEach(m => glyphs.add(m[1]));

    // 🗝️ Function Inputs
    [...flow.responseBody.matchAll(/\(\s*["']?([\w\-]+)["']?(?:\s*,\s*["']?([\w\-]+)["']?)*\)/g)]
        .forEach(m => { for (let i = 1; i < m.length; i++) if (m[i]) glyphs.add(m[i]); });

    // 🚪 Path Variables
    [...flow.responseBody.matchAll(/\/\{(.*?)\}/g)].forEach(m => glyphs.add(m[1]));

    // 🧵 Inline Query Keys
    [...flow.responseBody.matchAll(/[\?&]([\w\-]+)=([^&"'<>]+)/g)]
        .forEach(m => {
            glyphs.add(m[1]);
            detectedValues.add(m[2]);
        });

    // 🧍 HTML Attributes
    [...flow.responseBody.matchAll(/name\s*=\s*["']([\w\-]+)["']/g)].forEach(m => glyphs.add(m[1]));
    [...flow.responseBody.matchAll(/id\s*=\s*["']([\w\-]+)["']/g)].forEach(m => glyphs.add(m[1]));

    // 🧠 Header Keys & Values
    flow.requestHeadersArray.forEach(h => {
        const name = h.name.toUpperCase();//.to.toLowerCase();
        //if (name === ':method' || name === ':path') return; // 🧼 Skip pseudo-headers
        //if (h.name.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$/)) return; // 🧼 Skip method line
        //if (h.name.match(/^\/.*$/)) return; // 🧼 Skip path line

        if (name.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+\/.*\s+HTTP\/\d(\.\d)?$/)) return;

        requestHeaderKeys.add(h.name);
        if (h.value) detectedValues.add(h.value);
    });

    flow.responseHeadersArray.forEach(h => {
        responseHeaderKeys.add(h.name);
        // response header values are excluded from values.txt
    });

    const allHeaders = [...flow.requestHeadersArray, ...flow.responseHeadersArray];
    allHeaders.forEach(h => {
        if (h.value.includes('=') && h.value.length < 200) {
            [...h.value.matchAll(/([\w\-]+)=([^&"'<>]+)/g)]
                .forEach(match => {
                    glyphs.add(match[1]);
                    if (h.name && !responseHeaderKeys.has(h.name)) {
                        detectedValues.add(match[2]);
                    }
                });
        }
    });

    const isJSON = contentType.includes('application/json');
    const isXML = contentType.includes('application/xml') || contentType.includes('text/xml');

    const tryParseJSON = (text) => {
        try {
            const obj = JSON.parse(text);
            const walk = (node) => {
                if (typeof node === 'object' && node !== null) {
                    for (const key in node) {
                        glyphs.add(key);
                        const val = node[key];
                        if (typeof val === 'string' || typeof val === 'number') {
                            detectedValues.add(String(val));
                        }
                        walk(val);
                    }
                }
            };
            walk(obj);
        } catch { }
    };

    if (isJSON) {
        tryParseJSON(flow.requestBody);
        tryParseJSON(flow.responseBody);
        flow.requestHeadersArray.forEach(h => tryParseJSON(h.value));
    }

    if (isXML) {
        [...flow.responseBody.matchAll(/<([\w\-]+)[\s>]/g)].forEach(m => glyphs.add(m[1]));
    }

    // 🧹 Load home glyphs
    let homeParams = [];
    if (fs.existsSync(homeParamsPath)) {
        try {
            const raw = fs.readFileSync(homeParamsPath, 'utf-8');
            homeParams = raw.split('\n').map(p => p.trim()).filter(Boolean);
        } catch { }
    }

    // 🧠 Load existing logs
    const loadExisting = (filePath) => {
        const set = new Set();
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                raw.split('\n').map(p => p.trim()).filter(Boolean).forEach(p => set.add(p));
            } catch { }
        }
        return set;
    };

    const existingParams = loadExisting(paramsPath);
    const existingRequestHeaders = loadExisting(requestHeadersPath);
    const existingResponseHeaders = loadExisting(responseHeadersPath);
    const existingValues = loadExisting(valuesPath);

    const filteredParams = [...glyphs].filter(p => !homeParams.includes(p) && !existingParams.has(p));
    const filteredRequestHeaders = [...requestHeaderKeys].filter(p => !existingRequestHeaders.has(p));
    const filteredResponseHeaders = [...responseHeaderKeys].filter(p => !existingResponseHeaders.has(p));
    const filteredValues = [...detectedValues].filter(p => !existingValues.has(p));

    // 📁 Ensure logs folder exists
    const ensureFolder = (filePath) => {
        const folder = path.dirname(filePath);
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    };

    [paramsPath, requestHeadersPath, responseHeadersPath, valuesPath].forEach(ensureFolder);

    // 🪶 Append to logs
    const appendIfAny = (filePath, items, label) => {
        if (items.length > 0) {
            fs.appendFileSync(filePath, items.join('\n') + '\n', 'utf-8');
            console.log(`✅ Appended ${items.length} new ${label}`);
        } else {
            console.log(`🛡️ No new ${label} to append`);
        }
    };

    appendIfAny(paramsPath, filteredParams, 'glyphs to params.txt');
    appendIfAny(requestHeadersPath, filteredRequestHeaders, 'request headers');
    appendIfAny(responseHeadersPath, filteredResponseHeaders, 'response headers');
    appendIfAny(valuesPath, filteredValues, 'values');
}
