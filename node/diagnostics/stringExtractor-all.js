import he from 'he';

export function stringExtractor(flow) {
    const requestStrings = [
        ...extractFromText(flow.requestBody || '', 'requestBody'),
        ...extractFromHeaders(flow.requestHeadersArray || [], 'requestHeaders'),
        ...extractQueryParams(flow.url || '', 'requestQuery')
    ];

    const responseStrings = [
        ...extractFromText(flow.responseBody || '', 'responseBody'),
        ...extractFromHeaders(flow.responseHeadersArray || [], 'responseHeaders')
    ];

    const allStrings = Array.from(
        new Map(
            [...requestStrings, ...responseStrings].map(s => [normalize(s.value), s])
        ).values()
    );

    // Add reflectionHint to request strings based on presence in response
    const responseSet = new Set(responseStrings.map(s => normalize(s.value)));
    requestStrings.forEach(s => {
        s.reflectionHint = responseSet.has(normalize(s.value)) ? 'reflected' : 'not-reflected';
    });

    return {
        requestStrings,
        responseStrings,
        allStrings
    };
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

function extractFromHeaders(headers, sourceTag) {
    const skip = ['user-agent', 'accept', 'accept-encoding', 'content-length'];
    return headers
        .filter(h => h.name && !skip.includes(h.name.toLowerCase()))
        .flatMap(h => extractFromText(h.value, sourceTag));
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

function normalize(str) {
    return decodeURIComponent(he.decode(str)).toLowerCase();
}

function hintType(str) {
    if (/^https?:\/\//.test(str)) return "url";
    if (/^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/.test(str)) return "email";
    if (/script|onerror|onload|<|>/.test(str)) return "script-like";
    return "generic";
}
