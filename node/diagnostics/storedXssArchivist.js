import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stringExtractor } from './stringExtractor.js';
import { extractedStringsMemory } from '../lib/memoryStore.js'; // 🧠 Shared memory glyph

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.resolve(__dirname, '..', 'logs', 'stored-xss.log');

export function storedXssArchivist(flow) {
    const { requestStrings } = stringExtractor(flow);
    const responseBody = flow.responseBody || '';
    const echoed = [];

    // 🔍 Search for echoes of previously stored strings
    for (const str of extractedStringsMemory) {
        if (str && responseBody.includes(str)) {
            echoed.push(str);
        }
    }

    if (echoed.length > 0) {
        const anomalyDetails = {
            echoed,
            timestamp: new Date().toISOString(),
            module: "storedXssArchivist",
            url: flow.url,
            statusCode: flow.statusCode || "unknown",
            feedId: flow.feedId || "unknown",
            mirrorTag: flow.mirrorTag || "mirror-shard",
            narrative: `${echoed.length} previously seen strings echoed in response`,
            shardHint: "Potential Stored XSS",
            riskScore: Math.min(100, echoed.length * 25)
        };

        // 🔊 Console pulse
        console.log(`🧠 [Stored XSS] ${anomalyDetails.narrative}`);
        echoed.forEach(e => {
            console.log(`   🪞 Echoed: ${e}`);
        });

        // 📂 Archive to file
        fs.appendFile(logPath, JSON.stringify(anomalyDetails) + '\n', err => {
            if (err) console.error("Log write failed:", err);
        });
    }

    // 🧠 After scanning, store current request strings
    for (const { value } of requestStrings) {
        if (value && value.length >= 3) {
            extractedStringsMemory.add(value);
        }
    }

    return {
        flag: echoed.length > 0,
        echoed,
        message: echoed.length > 0 ? `${echoed.length} stored strings echoed` : null,
        riskLevel: echoed.length > 0 ? "⚠️ High" : null,
        riskScore: echoed.length * 25
    };
}
