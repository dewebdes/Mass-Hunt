import { WebSocketServer } from 'ws';
import { corsChecker } from './diagnostics/corsChecker.js';
import { isSimpleRequest } from './diagnostics/simpleRequestClassifier.js';
import { cookieGhost } from './diagnostics/cookieGhost.js';
import { isDomainBlocked } from './lib/domainBlocker.js'; // ⛔ Blocklist filter

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
            if (parts.length < 8) {
                console.warn("⚠️ Feed structure invalid or incomplete");
                console.log("🧪 Raw Feed:", raw);
                return;
            }

            // 🧠 Parse Feed
            const flow = parseFeed(parts);
            if (!flow) return;

            // ⛔ Domain Blocklist Check
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

            // 📊 Log Feed Summary
            console.log(`\n📡 Feed Received → ${flow.feedId} [${flow.pulseMs}ms]`);
            console.log(`🌍 ${flow.method} ${flow.url}`);
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
                console.log(`👻 Ghost Cookies Relevant to CORS/CSRF:`);
                ghostResult.relevantCookies.forEach(c => {
                    console.log(`   🍪 ${c.name}`);
                    console.log(`      ↪️ Domain: ${c.domain}`);
                    console.log(`      🔓 CORS-Relevant: ${c.corsRelevant ? '✅' : '❌'}`);
                    console.log(`      ⚠️ CSRF Risk: ${c.csrfRisk ? '⚠️ Yes' : 'No'}`);
                });
            }

            // 🧬 JS-Set Cookie Detection (Request Phase)
            const jsCookieResult = cookieGhost({
                requestHeaders: flow.requestHeadersArray,
                origin: flow.url,
                phase: 'request'
            });

            if (jsCookieResult.flag) {
                console.log(`🧬 JS-Set Cookies Detected:`);
                jsCookieResult.jsCookies.forEach(name => {
                    console.log(`   🍪 ${name} → setByJS`);
                });
            }

            /* const isSimple = isSimpleRequest({
                 method: flow.method,
                 requestHeaders: flow.requestHeadersObj
             });
             console.log(`🔍 Simple Request: ${isSimple ? '✅ Yes' : '❌ No'}`);*/

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
        const reqHeadersRaw = parts[5];
        const reqBody = parts[6];
        const resHeadersRaw = parts[7];
        const resBody = parts[8];

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
