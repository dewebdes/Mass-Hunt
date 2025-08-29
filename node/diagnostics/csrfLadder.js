import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔧 Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 Log file path: ../logs/csrf.log
const parentDir = path.resolve(__dirname, '..');
const logPath = path.resolve(parentDir, 'logs', 'csrf.log');

// 🧠 Seen signature store to suppress duplicates
const seenFlows = new Set();

export function csrfLadder(flow) {
    const isRedirect = flow.statusCode?.startsWith('3');
    const requestHeaders = flow.requestHeadersArray || [];

    if (!isRedirect || requestHeaders.length === 0) return { flag: false };

    const cookieHeader = requestHeaders.find(h => h.name.toLowerCase() === 'cookie');
    if (!cookieHeader || !cookieHeader.value) return { flag: false };

    const cookies = cookieHeader.value.split(';').map(c => c.trim());

    const corsRelevantCookies = cookies.filter(name =>
        name.toLowerCase().includes('session') ||
        name.toLowerCase().includes('auth') ||
        name.toLowerCase().includes('token')
    );

    if (corsRelevantCookies.length === 0) return { flag: false };

    // 🪞 Compose signature for deduplication
    const signature = `${flow.url}|${flow.statusCode}|` + corsRelevantCookies.join('|');
    if (seenFlows.has(signature)) return { flag: false };
    seenFlows.add(signature);

    // 🧱 Build anomaly object
    const anomalyDetails = {
        narrative: "302",
        timestamp: new Date().toISOString(),
        module: "csrfLadder",
        url: flow.url,
        statusCode: flow.statusCode,
        cookies: corsRelevantCookies,
        pulseMs: flow.pulseMs,
        feedId: flow.feedId || "unknown",
        mirrorTag: flow.mirrorTag || "mirror-shard",
        shardHint: "Potential CSRF exposure"
    };

    // 🔊 Terminal pulse
    console.log(`⚠️ [CSRF Ladder] ${anomalyDetails.narrative}`);
    corsRelevantCookies.forEach(name => {
        console.log(`   🍪 ${name} → CORS-relevant`);
    });

    // 📂 Archive to file
    fs.appendFile(logPath, JSON.stringify(anomalyDetails) + '\n', err => {
        if (err) console.error("Log write failed:", err);
    });

    return {
        flag: true,
        cookies: corsRelevantCookies,
        message: anomalyDetails.narrative,
        riskLevel: "⚠️ High"
    };
}
