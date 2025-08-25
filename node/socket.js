import { WebSocketServer } from 'ws';
import { corsChecker } from './diagnostics/corsChecker.js';
import { isSimpleRequest } from './diagnostics/simpleRequestClassifier.js';
import { cookieGhost } from './diagnostics/cookieGhost.js';
import { csrfLadder } from './diagnostics/csrfLadder.js'; // 🧱 CSRF diagnostic
import { isDomainBlocked } from './lib/domainBlocker.js'; // ⛔ Blocklist filter
import { xssEcho } from './diagnostics/xssEcho.js';
import { storedXssArchivist } from './diagnostics/storedXssArchivist.js';

const wss = new WebSocketServer({ port: 9090 });
console.log(`[Mass-Mirror] 🌀 WebSocket listening on port 9090`);

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

            // 🧠 Parse Feed
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

            // 📡 Feed Summary
            console.log(`\n📡 Feed Received → ${flow.feedId} [${flow.pulseMs}ms]`);
            console.log(`🌍 ${flow.method} ${flow.url} → ${flow.statusCode}`);
            console.log(`📝 Request Body Length: ${flow.requestBody.length}`);
            console.log(`📦 Response Body Length: ${flow.responseBody.length}`);

            // 🛡️ CORS Diagnostic
            const corsResult = corsChecker(flow);
            if (corsResult.flag) {
                console.log(`🛡️ CORS Flag: true`);
            }

            // 🍪 Ghost Cookie Diagnostic (Response Phase)
            const ghostResult = cookieGhost({
                headers: flow.responseHeadersArray,
                origin: flow.url,
                phase: 'response'
            });

            if (ghostResult.flag) {
                console.log(`👻 Ghost Cookies: ${ghostResult.relevantCookies.length} flagged`);
            }

            // 🧬 JS-Set Cookie Detection (Request Phase)
            const jsCookieResult = cookieGhost({
                requestHeaders: flow.requestHeadersArray,
                origin: flow.url,
                phase: 'request'
            });

            if (jsCookieResult.flag) {
                console.log(`🧬 JS-Set Cookies: ${jsCookieResult.jsCookies.length} detected`);
            }

            // 🧱 CSRF Ladder Diagnostic
            const csrfResult = csrfLadder(flow);
            if (csrfResult.flag) {
                console.log(`⚠️ CSRF Ladder: ${csrfResult.cookies.length} CORS-relevant cookies → ${csrfResult.message}`);
            }

            // 🧨 XSS Echo Diagnostic
            const xssResult = xssEcho(flow);
            if (xssResult.flag) {
                console.log(`⚠️ XSS Echo: ${xssResult.echoed.length} strings reflected`);
            }

            const storedXssResult = storedXssArchivist(flow);
            if (storedXssResult.flag) {
                console.log(`🧠 Stored XSS: ${storedXssResult.message}`);
            }


        } catch (err) {
            console.error(`[Mass-Mirror] 💥 Failed to process feed: ${err.message}`);
        }
    });

    socket.on('close', () => {
        console.log(`[Mass-Mirror] 🔌 Socket disconnected.`);
    });
});

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

        return {
            feedId,
            requestId,
            pulseMs,
            method,
            url,
            statusCode,
            requestHeadersArray,
            requestHeadersObj,
            responseHeadersArray,
            requestBody: reqBody,
            responseBody: resBody,
            mirrorTag: "mirror-shard"
        };
    } catch (err) {
        console.warn("⚠️ Failed to parse feed:", err.message);
        return null;
    }
}
