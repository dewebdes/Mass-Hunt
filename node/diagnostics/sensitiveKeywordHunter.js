import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import keyTermsJson from '../config/keyTerms.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logPath = path.resolve(__dirname, '..', 'logs', 'sensitive-keywords.log');

export function scanResponse(responseText, meta) {
    const foundTerms = keyTermsJson.keyTerms.filter(term =>
        responseText.toLowerCase().includes(term.toLowerCase())
    );

    if (foundTerms.length > 0) {
        const logEntry = `[${new Date().toISOString()}] ${meta.url}\nFound: ${foundTerms.join(', ')}\n\n`;
        fs.appendFileSync(logPath, logEntry);
        console.log(`🔍 Sensitive terms found in ${meta.url}:`, foundTerms);
    }
}
