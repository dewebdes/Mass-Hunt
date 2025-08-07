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
                return;
            }

            const requestHeadersArray = parts[4].split('\n').map(line => {
                const [name, ...rest] = line.split(':');
                return { name: name?.trim(), value: rest.join(':').trim() };
            });

            const requestHeadersObj = Object.fromEntries(
                requestHeadersArray.map(h => [h.name?.toLowerCase(), h.value])
            );

            const responseHeadersArray = parts[6].split('\n').map(line => {
                const [name, ...rest] = line.split(':');
                return { name: name?.trim(), value: rest.join(':').trim() };
            });

            const flow = {
                feedId: parts[0].replace(/^PAIR_FEED:/, ''),
                pulseMs: parseInt(parts[1]),
                method: parts[2],
                url: parts[3],
                headers: responseHeadersArray,
                requestHeaders: parts[4],
                requestBody: parts[5],
                responseBody: parts[7],
                mirrorTag: "mirror-shard"
            };

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
                headers: responseHeadersArray,
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
                requestHeaders: requestHeadersArray,
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
                 requestHeaders: requestHeadersObj
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
