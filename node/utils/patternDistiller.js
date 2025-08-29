import stringSimilarity from 'string-similarity';

function groupUrls(urls) {
    const groups = {};
    urls.forEach((urlObj) => {
        const baseUrl = urlObj.url.split('?')[0];
        const key = baseUrl.split('/').slice(0, -1).join('/') + ':' + baseUrl.length;
        if (!groups[key]) groups[key] = [];
        groups[key].push(urlObj);
    });
    return Object.values(groups).map(group => group[group.length - 1]);
}

function calculateSimilarity(urls, threshold = 0.85) {
    const uniqueUrls = [];
    urls.forEach((urlObj) => {
        let isUnique = true;
        for (let i = 0; i < uniqueUrls.length; i++) {
            if (stringSimilarity.compareTwoStrings(urlObj.url, uniqueUrls[i].url) > threshold) {
                isUnique = false;
                break;
            }
        }
        if (isUnique) uniqueUrls.push(urlObj);
    });
    return uniqueUrls;
}

export function distillPatterns(rawUrls) {
    const grouped = groupUrls(rawUrls);
    return calculateSimilarity(grouped);
}
