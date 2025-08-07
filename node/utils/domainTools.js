// utils/domainTools.js

export function extractDomain(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        // Strip subdomains if needed (e.g. tracker.example.com → example.com)
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.'); // crude but effective
        }

        return hostname;
    } catch (err) {
        console.warn(`⚠️ [DomainTools] Failed to parse domain from URL: ${url}`);
        return '(unknown)';
    }
}
