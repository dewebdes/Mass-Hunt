// corsChecker.js (ESM-compatible)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔧 Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📜 Log file path—modularize as needed
const parentDir = path.resolve(__dirname, '..');

// 📂 Log file path: ../log/cors.lo
const logPath = path.resolve(parentDir, 'logs', 'cors.log');

// 🧠 Seen signature store to suppress repetitive pulses
const seenFeeds = new Set();

export function corsChecker(flow) {
    const headers = flow.headers || [];

    // 🎯 Filter Access-Control headers
    const acHeaders = headers.filter(h =>
        h.name?.toLowerCase().includes("access-control-allow")
    );

    if (acHeaders.length === 0) return { flag: false };

    // 🪞 Compose signature for deduplication
    const signature = `${flow.url}|` + acHeaders
        .map(h => `${h.name}:${h.value}`)
        .join('|');

    // 🧱 Block duplicate signature from re-logging
    if (seenFeeds.has(signature)) return { flag: false };
    seenFeeds.add(signature);

    // 🌊 Build anomaly object
    const anomalyDetails = {
        timestamp: new Date().toISOString(),
        module: "corsChecker",
        url: flow.url,
        headers: acHeaders,
        pulseMs: flow.pulseMs,
        feedId: flow.feedId,
        mirrorTag: flow.mirrorTag,
        narrative: "Access-Control headers detected",
        shardHint: "Potential CORS exposure"
    };

    // 🔊 Terminal pulse
    console.log("[CORS Anomaly]", JSON.stringify(anomalyDetails, null, 2));

    // 📂 Archive to file
    fs.appendFile(logPath, JSON.stringify(anomalyDetails) + '\n', err => {
        if (err) console.error("Log write failed:", err);
    });

    return { flag: true };
}
