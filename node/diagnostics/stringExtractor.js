import he from 'he';

export function stringExtractor(flow) {
    const requestStrings = [
        ...extractQueryParams(flow.url || '', 'requestQuery'),
        ...extractCookies(flow.requestHeadersArray || [], 'requestCookies'),
        ...extractFromText(flow.requestBody || '', 'requestBody')
    ];

    const allStrings = Array.from(
        new Map(requestStrings.map(s => [normalize(s.value), s])).values()
    );

    return {
        requestStrings,
        allStrings
    };
}

function extractQueryParams(url, sourceTag) {
    const query = url.split('?')[1];
    if (!query) return [];
    return query.split('&')
        .map(p => p.split('=')[1])
        .filter(Boolean)
        .map(str => ({
            value: str,
            source: sourceTag,
            typeHint: hintType(str)
        }));
}

function extractCookies(headers, sourceTag) {
    const cookieHeader = headers.find(h => h.name?.toLowerCase() === 'cookie');
    if (!cookieHeader || !cookieHeader.value) return [];
    return cookieHeader.value.split(';')
        .map(p => p.split('=')[1])
        .filter(Boolean)
        .map(str => ({
            value: str.trim(),
            source: sourceTag,
            typeHint: hintType(str)
        }));
}

function extractFromText(text, sourceTag) {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/[^&=\s"'<>]{3,}/g) || [];
    return matches.map(str => ({
        value: str,
        source: sourceTag,
        typeHint: hintType(str)
    }));
}

function normalize(str) {
    return decodeURIComponent(he.decode(str)).toLowerCase();
}

function hintType(str) {
    if (/^https?:\/\//.test(str)) return "url";
    if (/^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/.test(str)) return "email";
    if (/script|onerror|onload|<|>/.test(str)) return "script-like";
    return "generic";
}
