import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import he from 'he';
import { stringExtractor } from './stringExtractor.js';

// 🔧 Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 Log path
const logPath = path.resolve(__dirname, '..', 'logs', 'xss.log');

// 🧠 Seen signature store
const seenEchoes = new Set();

export function xssEcho(flow) {
    const { requestStrings } = stringExtractor(flow);
    const responseBody = flow.responseBody || '';
    const echoed = [];

    for (const { value: str } of requestStrings) {
        if (!str || str.length < 3) continue;

        const variants = [
            str,
            he.encode(str),
            he.decode(str),
            encodeURIComponent(str),
            decodeURIComponent(str)
        ];

        for (const variant of variants) {
            if (responseBody.includes(variant)) {
                echoed.push({
                    original: str,
                    variant,
                    context: detectContext(variant, responseBody)
                });
                break;
            }
        }
    }

    if (echoed.length === 0) return { flag: false };

    // 🪞 Compose signature
    const signature = `${flow.url}|` + echoed.map(e => e.original).join('|');
    if (seenEchoes.has(signature)) return { flag: false };
    seenEchoes.add(signature);

    // 🧱 Build anomaly object
    const anomalyDetails = {
        echoed,
        timestamp: new Date().toISOString(),
        module: "xssEcho",
        url: flow.url,
        statusCode: flow.statusCode || "unknown",
        pulseMs: flow.pulseMs,
        feedId: flow.feedId || "unknown",
        mirrorTag: flow.mirrorTag || "mirror-shard",
        narrative: `${echoed.length} request-originated strings echoed in response`,
        shardHint: "Potential XSS reflection",
        riskScore: Math.min(100, echoed.length * 20)
    };

    // 🔊 Terminal pulse
    console.log(`⚠️ [XSS Echo] ${anomalyDetails.narrative}`);
    echoed.forEach(e => {
        console.log(`   🔁 ${e.original} → echoed as ${e.variant} [${e.context}]`);
    });

    // 📂 Archive to file
    /*fs.appendFile(logPath, JSON.stringify(anomalyDetails) + '\n', err => {
        if (err) console.error("Log write failed:", err);
    });*/
    // 📂 Archive to file (custom format)
    const logEntry = [
        flow.url,
        echoed.map(e => e.original).join(', '),
        anomalyDetails.riskScore,
        '' // separator line
    ].join('\n');

    fs.appendFile(logPath, logEntry + '\n', err => {
        if (err) console.error("Log write failed:", err);
    });

    return {
        flag: true,
        echoed,
        message: anomalyDetails.narrative,
        riskLevel: "⚠️ Medium",
        riskScore: anomalyDetails.riskScore
    };
}

function detectContext(variant, body) {
    if (body.includes(`<script>${variant}</script>`)) return "script block";
    if (body.includes(`="${variant}"`)) return "attribute";
    if (body.includes(`<div>${variant}</div>`)) return "HTML tag";
    if (body.includes(`>${variant}<`)) return "inline HTML";
    return "unknown";
}
