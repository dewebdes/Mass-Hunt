import fs from 'fs';
import path from 'path';
import { extractDomain } from '../utils/domainTools.js';
import { isDomainBlocked } from '../lib/domainBlocker.js';

const cookieMemory = new Set();     // Global memory of ghost cookie fingerprints
const jsCookieMemory = new Map();   // Per-domain memory of JS-set cookie names

const logPath = path.resolve('logs/intrested-cookies.txt');

// 🧬 Fingerprint includes name + domain + path for ghost cookies
function fingerprint({ name, domain, path = '/' }) {
    return `${name} @ ${domain}${path}`;
}

// 🪞 Log cookie with symbolic clarity
function logIntrestedCookie({ feedId, name, domain, path = '/', type, corsRelevant = false, csrfRisk = false }) {
    if (isDomainBlocked(domain)) {
        console.log(`🕳️ Skipped cookie log for blocked domain: ${domain}`);
        return;
    }

    const timestamp = new Date().toISOString();
    const corsTag = corsRelevant ? '🔓 CORS ✅' : '';
    const csrfTag = csrfRisk ? '⚠️ CSRF' : '';
    const flags = [corsTag, csrfTag].filter(Boolean).join(' ');

    const line = `[${timestamp}] 🪞 ${type} → ${name} @ ${domain}${path} [feed: ${feedId || 'unknown'}]${flags ? ' ' + flags : ''}`;

    console.log(line);

    fs.appendFile(logPath, line + '\n', err => {
        if (err) {
            console.warn(`⚠️ Failed to write cookie log: ${err.message}`);
        }
    });

    if (!feedId) {
        console.warn(`🕳️ Missing feedId for cookie: ${name} @ ${domain}`);
    }
}

export function cookieGhost({ requestHeaders, headers, origin, phase = 'response', feedId = 'unknown' }) {
    const originDomain = extractDomain(origin);

    if (phase === 'response') {
        const resSetCookieHeaders = headers
            .filter(h => h.name?.toLowerCase() === 'set-cookie')
            .map(h => h.value);

        const relevantCookies = [];

        for (const setCookie of resSetCookieHeaders) {
            const name = setCookie.split('=')[0].trim();
            const lower = setCookie.toLowerCase();

            const domainMatch = /domain=([^;]+)/i.exec(setCookie);
            const pathMatch = /path=([^;]+)/i.exec(setCookie);

            const cookieDomain = domainMatch?.[1]?.trim().toLowerCase() || originDomain;
            const cookiePath = pathMatch?.[1]?.trim() || '/';
            const isImplicitDomain = !domainMatch;

            const isSameSiteNone = lower.includes('samesite=none');
            const isMissingSameSite = !lower.includes('samesite');
            const isNotSecure = !lower.includes('secure');
            const isCrossSite = cookieDomain !== originDomain;

            const isCorsRelevant = isSameSiteNone || isMissingSameSite || isCrossSite;
            const isCsrfRisk = isSameSiteNone && isNotSecure;

            const key = fingerprint({ name, domain: cookieDomain, path: cookiePath });

            // 🧠 Track ghost cookies by full fingerprint
            if ((isCorsRelevant || isCsrfRisk) && !cookieMemory.has(key)) {
                cookieMemory.add(key);

                const ghost = {
                    name,
                    raw: setCookie,
                    domain: cookieDomain,
                    path: cookiePath,
                    corsRelevant: isCorsRelevant,
                    csrfRisk: isCsrfRisk,
                    implicit: isImplicitDomain
                };

                relevantCookies.push(ghost);

                logIntrestedCookie({
                    feedId,
                    name: ghost.name,
                    domain: ghost.domain,
                    path: ghost.path,
                    type: 'ghost-cookie',
                    corsRelevant: ghost.corsRelevant,
                    csrfRisk: ghost.csrfRisk
                });
            }
        }

        return {
            relevantCookies,
            flag: relevantCookies.length > 0,
            tag: relevantCookies.length > 0 ? 'ghost-cookie: true' : 'ghost-cookie: false'
        };
    }

    if (phase === 'request') {
        const reqCookieHeader = requestHeaders.find(h => h.name?.toLowerCase() === 'cookie')?.value || '';
        const reqCookies = reqCookieHeader
            .split(';')
            .map(c => c.trim().split('=')[0])
            .filter(Boolean);

        const knownJsCookies = jsCookieMemory.get(originDomain) || new Set();
        const newJsCookies = [];

        for (const name of reqCookies) {
            // 🧠 JS cookies are scoped per domain, no path info available
            const key = fingerprint({ name, domain: originDomain });
            if (!cookieMemory.has(key) && !knownJsCookies.has(name)) {
                newJsCookies.push(name);
                knownJsCookies.add(name);

                logIntrestedCookie({
                    feedId,
                    name,
                    domain: originDomain,
                    type: 'js-cookie'
                });
            }
        }

        jsCookieMemory.set(originDomain, knownJsCookies);

        return {
            jsCookies: newJsCookies,
            flag: newJsCookies.length > 0,
            tag: newJsCookies.length > 0 ? 'js-cookie: true' : 'js-cookie: false'
        };
    }

    return { error: 'Invalid phase' };
}
