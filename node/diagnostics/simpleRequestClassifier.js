export function isSimpleRequest(flow) {
    if (!flow?.method || !flow?.requestHeaders) return false;

    const method = flow.method.toUpperCase();
    const allowedMethods = ['GET', 'HEAD', 'POST'];

    const contentType = flow.requestHeaders['content-type']?.toLowerCase();
    const allowedContentTypes = [
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain'
    ];

    // Validate method
    if (!allowedMethods.includes(method)) return false;

    // Validate Content-Type for POST
    if (method === 'POST' && contentType && !allowedContentTypes.includes(contentType)) {
        return false;
    }

    // Detect custom headers (headers not considered simple)
    const forbiddenHeaders = Object.keys(flow.requestHeaders).filter(h =>
        !['accept', 'accept-language', 'content-language', 'content-type'].includes(h.toLowerCase())
    );
    if (forbiddenHeaders.length > 0) return false;

    return true;
}
