import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import playwright from 'playwright';

// 🧭 Reconstruct __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧭 Chrome path and config location
const CHROME_PATH = path.resolve(__dirname, 'C:\\Program Files\\Google\\Chrome\\Application', 'chrome.exe');
const scopedPath = path.join(__dirname, '..', 'config', 'scopedDomain.json');
const outputPath = path.join(__dirname, '..', 'memory', 'home-params.txt');

async function extractGlyphs(url) {
    const browser = await playwright.chromium.launch({
        executablePath: CHROME_PATH,
        headless: true
    });

    const page = await browser.newPage();

    // 🧱 Block CSS for clarity
    await page.route('**/*', route => {
        if (['stylesheet', 'image', 'font'].includes(route.request().resourceType())) {
            route.abort();
        } else {
            route.continue();
        }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const body = await page.content();
    const glyphs = new Set();

    // 🧭 Query Params
    const queryParams = new URL(url).searchParams;
    for (const [key] of queryParams) glyphs.add(key);

    // 🧪 JS Variables
    [...body.matchAll(/(let|const|var)\s([\w\,\s]+)\s*?(\n|\r|;|=)/g)]
        .forEach(match => match[2].split(',').forEach(v => glyphs.add(v.trim())));

    // 🧬 JSON/Object Keys
    [...body.matchAll(/["']([\w\-]+)["']\s*?:/g)].forEach(m => glyphs.add(m[1]));

    // 🧿 Template Literals
    [...body.matchAll(/\${\s*([\w\-]+)\s*}/g)].forEach(m => glyphs.add(m[1]));

    // 🗝️ Function Inputs
    [...body.matchAll(/\(\s*["']?([\w\-]+)["']?(?:\s*,\s*["']?([\w\-]+)["']?)*\)/g)]
        .forEach(m => { for (let i = 1; i < m.length; i++) if (m[i]) glyphs.add(m[i]); });

    // 🚪 Path Variables
    [...body.matchAll(/\/\{(.*?)\}/g)].forEach(m => glyphs.add(m[1]));

    // 🧵 Inline Query Keys
    [...body.matchAll(/[\?&]([\w\-]+)=/g)].forEach(m => glyphs.add(m[1]));

    // 🧍 HTML Attributes
    [...body.matchAll(/name\s*=\s*["']([\w\-]+)["']/g)].forEach(m => glyphs.add(m[1]));
    [...body.matchAll(/id\s*=\s*["']([\w\-]+)["']/g)].forEach(m => glyphs.add(m[1]));

    await browser.close();
    return [...glyphs].filter(Boolean);
}

(async () => {
    let homepage;
    try {
        const config = JSON.parse(fs.readFileSync(scopedPath, 'utf-8'));
        const domain = config?.domain;
        if (typeof domain === 'string') {
            homepage = `https://${domain}`;
        }
    } catch (err) {
        console.error(`⚠️ Failed to read scopedDomain.json: ${err.message}`);
        return;
    }

    if (!homepage || typeof homepage !== 'string') {
        console.error('⚠️ Invalid or missing "domain" in scopedDomain.json');
        return;
    }

    console.log(`\n🔍 Extracting homepage parameters from ${homepage}...`);
    const homeParams = await extractGlyphs(homepage);

    fs.writeFileSync(outputPath, homeParams.join('\n'), 'utf-8');
    console.log(`\n📁 Saved: home-params.txt (${homeParams.length} glyphs)`);
})();
