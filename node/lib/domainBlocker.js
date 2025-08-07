import blockedDomains from '../config/domainBlocklist.json' assert { type: 'json' };

export function isDomainBlocked(domain) {
    if (!domain) return false;

    return blockedDomains.some(blocked => {
        return domain === blocked || domain.endsWith(`.${blocked}`);
    });
}
