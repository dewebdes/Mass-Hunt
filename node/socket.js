import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

import { corsChecker } from './diagnostics/corsChecker.js';
import { isSimpleRequest } from './diagnostics/simpleRequestClassifier.js';
import { cookieGhost } from './diagnostics/cookieGhost.js';
import { csrfLadder } from './diagnostics/csrfLadder.js';
import { isDomainBlocked } from './lib/domainBlocker.js';
import { xssEcho } from './diagnostics/xssEcho.js';
import { storedXssArchivist } from './diagnostics/storedXssArchivist.js';
import { scanResponse } from './diagnostics/sensitiveKeywordHunter.js';
import { extractFallParams } from './diagnostics/fallparams.js';
import { distillPatterns } from './utils/patternDistiller.js';

// 🔧 Resolve __dirname
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 Correct scoped domain path
const scopedDomainPath = path.resolve(__dirname, '..', 'node', 'config', 'scopedDomain.json');

const scopedDomain = (() => {
    try {
        const config = JSON.parse(fs.readFileSync(scopedDomainPath, 'utf-8'));
        const domain = config.domain;
        if (!domain || typeof domain !== 'string') throw new Error('Missing or invalid "domain"');
        return new URL(`https://${domain}`).hostname;
    } catch (err) {
        console.warn(`⚠️ Failed to read scopedDomain.json or parse domain: ${err.message}`);
        return null;
    }
})();

// 🧹 Ritual Prompt
function promptResetLogs() {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('🧹 Reset logs and memory before starting? (y/N): ', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
}

function clearFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
        }
        console.log(`🧼 Cleared ${folderPath}`);
    } catch (err) {
        console.warn(`⚠️ Failed to clear ${folderPath}: ${err.message}`);
    }
}

// 🧠 URL Collector
const collectedUrls = [];

function saveDistilledUrls() {
    try {
        const distilled = distillPatterns(collectedUrls);
        const outputPath = path.resolve(__dirname, 'logs', 'urls.txt');
        const content = distilled.map(u => u.url).join('\n');
        fs.writeFileSync(outputPath, content, 'utf8');
        console.log(`🧠 Distilled URL patterns saved to ${outputPath}`);
    } catch (err) {
        console.warn(`⚠️ Failed to save distilled URLs: ${err.message}`);
    }
}



// 🌀 Startup Ritual
(async () => {
    const shouldReset = await promptResetLogs();
    if (shouldReset) {
        clearFolder(path.resolve(__dirname, 'logs'));
        clearFolder(path.resolve(__dirname, 'memory'));
    }

    const wss = new WebSocketServer({ port: 9090 });
    console.log(`[Mass-Mirror] 🌀 WebSocket listening on port 9090`);

    runShard('homeGlyphInitializer.js'); // 🧙‍♂️ Extract homepage echoes

    wss.on('connection', socket => {
        console.log(`[Mass-Mirror] ↪️ Socket connected.`);

        socket.on('message', msg => {
            try {
                const raw = msg.toString('utf8').trim();
                if (!raw.startsWith('PAIR_FEED:')) {
                    console.log('⚠️ [UNHANDLED]', raw.slice(0, 100));
                    return;
                }

                const parts = raw.split('#massmirror#');
                if (parts.length < 9) {
                    console.warn("⚠️ Feed structure invalid or incomplete");
                    console.log("🧪 Raw Feed:", raw);
                    return;
                }

                const flow = parseFeed(parts);
                if (!flow) return;

                const domain = (() => {
                    try {
                        return new URL(flow.url).hostname;
                    } catch {
                        return null;
                    }
                })();

                if (isDomainBlocked(domain)) {
                    console.log(`🕳️ Skipped flow from blocked domain: ${domain}`);
                    return;
                }

                console.log(`\n📡 Feed Received → ${flow.feedId} [${flow.pulseMs}ms]`);
                console.log(`🌍 ${flow.method} ${flow.url} → ${flow.statusCode}`);
                console.log(`📝 Request Body Length: ${flow.requestBody.length}`);
                console.log(`📦 Response Body Length: ${flow.responseBody.length}`);

                if (flow?.url) {
                    collectedUrls.push({ url: flow.url });
                }

                if (domain === scopedDomain) {
                    extractFallParams(flow);
                }

                const corsResult = corsChecker(flow);
                if (corsResult.flag) {
                    console.log(`🛡️ CORS Flag: true`);
                }

                const ghostResult = cookieGhost({
                    headers: flow.responseHeadersArray,
                    origin: flow.url,
                    phase: 'response'
                });

                if (ghostResult.flag) {
                    console.log(`👻 Ghost Cookies: ${ghostResult.relevantCookies.length} flagged`);
                }

                const jsCookieResult = cookieGhost({
                    requestHeaders: flow.requestHeadersArray,
                    origin: flow.url,
                    phase: 'request'
                });

                if (jsCookieResult.flag) {
                    console.log(`🧬 JS-Set Cookies: ${jsCookieResult.jsCookies.length} detected`);
                }

                const csrfResult = csrfLadder(flow);
                if (csrfResult.flag) {
                    console.log(`⚠️ CSRF Ladder: ${csrfResult.cookies.length} CORS-relevant cookies → ${csrfResult.message}`);
                }

                const xssResult = xssEcho(flow);
                if (xssResult.flag) {
                    console.log(`⚠️ XSS Echo: ${xssResult.echoed.length} strings reflected`);
                }

                const storedXssResult = storedXssArchivist(flow);
                if (storedXssResult.flag) {
                    console.log(`🧠 Stored XSS: ${storedXssResult.message}`);
                }

                scanResponse(flow.responseBody, { url: flow.url });

            } catch (err) {
                console.error(`[Mass-Mirror] 💥 Failed to process feed: ${err.message}`);
            }
        });

        socket.on('close', () => {
            console.log(`[Mass-Mirror] 🔌 Socket disconnected.`);
        });
    });

    // 🧩 Console Command Listener
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (input) => {
        const command = input.trim().toLowerCase();
        if (command === 'save()') {
            saveDistilledUrls();
        } else if (command === 'exit()') {
            console.log('👋 Exiting Mass-Hunt...');
            rl.close();
            process.exit(0);
        } else {
            console.log(`⚠️ Unknown command: ${input.trim()}`);
        }
    });
})();

// 🔧 Ritual Shard Runner
function runShard(name) {
    const shardPath = path.resolve(__dirname, 'diagnostics', name);
    const proc = spawn('node', [shardPath], {
        stdio: 'inherit',
        shell: true
    });

    proc.on('exit', code => {
        const status = code === 0 ? '✅' : '⚠️';
        console.log(`[Mass-Mirror] ${status} ${name} exited with code ${code}`);
    });
}

// 🧩 Feed Parser Helper
function parseFeed(parts) {
    try {
        const feedId = parts[0].replace(/^PAIR_FEED:/, '');
        const requestId = parts[1];
        const pulseMs = parseInt(parts[2], 10);
        const method = parts[3];
        const url = parts[4];
        const statusCode = parts[5];
        const reqHeadersRaw = parts[6];
        const reqBody = parts[7];
        const resHeadersRaw = parts[8];
        const resBody = parts[9];

        const requestHeadersArray = reqHeadersRaw.split('\n').map(line => {
            const [name, ...rest] = line.split(':');
            return { name: name?.trim(), value: rest.join(':').trim() };
        });

        const requestHeadersObj = Object.fromEntries(
            requestHeadersArray.map(h => [h.name?.toLowerCase(), h.value])
        );

        const responseHeadersArray = resHeadersRaw.split('\n').map(line => {
            const [name, ...rest] = line.split(':');
            return { name: name?.trim(), value: rest.join(':').trim() };
        });

        const responseHeadersObj = Object.fromEntries(
            responseHeadersArray.map(h => [h.name?.toLowerCase(), h.value])
        );

        return {
            feedId,
            requestId,
            pulseMs,
            method,
            url,
            statusCode,
            requestHeadersArray,
            requestHeadersObj,
            requestBody: reqBody,
            responseHeadersArray,
            responseHeadersObj,
            responseBody: resBody
        };
    } catch (err) {
        console.warn(`⚠️ Failed to parse feed: ${err.message}`);
        return null;
    }
}
