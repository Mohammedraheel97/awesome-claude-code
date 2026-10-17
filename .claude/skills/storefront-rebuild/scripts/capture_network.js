#!/usr/bin/env node
// Render a page in Chromium, save screenshots + rendered DOM, and record every JSON/API response it makes.
// Works for JS-rendered sites (Flutter, React, Vue…) whose content never appears in the raw HTML.
//
//   node capture_network.js <url> <outDir> [--width 1440] [--height 900] [--wait 8000]
//
// Writes: <outDir>/viewport.png, full.png, dom.html, requests.txt (method + URL + POST body of API calls),
//         network.json ([{url, method, status, postData, body}] for JSON responses, bodies truncated at 400 KB)
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('playwright not found: npm i playwright (or set NODE_PATH)');
}

const args = process.argv.slice(2);
const [url, outDir] = args;
if (!url || !outDir) { console.error('usage: node capture_network.js <url> <outDir> [--width N] [--height N] [--wait ms]'); process.exit(2); }
const opt = name => { const i = args.indexOf(`--${name}`); return i > -1 ? +args[i + 1] : undefined; };
const width = opt('width') || 1440, height = opt('height') || 900, wait = opt('wait') || 8000;

(async () => {
  const { chromium } = loadPlaywright();
  const launch = { };
  if (process.env.PLAYWRIGHT_CHROMIUM) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
  else if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launch).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width, height } });
  const calls = [], lines = [];
  page.on('request', r => {
    if (['xhr', 'fetch'].includes(r.resourceType()) || /\/api\//.test(r.url())) lines.push(`${r.method()} ${r.url()}${r.postData() ? `  BODY: ${r.postData().slice(0, 500)}` : ''}`);
  });
  page.on('response', async r => {
    const ct = r.headers()['content-type'] || '';
    if (!/json/.test(ct)) return;
    let body = '';
    try { body = (await r.text()).slice(0, 400000); } catch { /* body unavailable */ }
    calls.push({ url: r.url(), method: r.request().method(), status: r.status(), postData: r.request().postData() || null, body });
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => console.error('goto:', e.message));
  await page.waitForTimeout(wait);
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'viewport.png') });
  await page.screenshot({ path: path.join(outDir, 'full.png'), fullPage: true });
  fs.writeFileSync(path.join(outDir, 'dom.html'), await page.content());
  fs.writeFileSync(path.join(outDir, 'network.json'), JSON.stringify(calls, null, 1));
  fs.writeFileSync(path.join(outDir, 'requests.txt'), lines.join('\n') + '\n');
  console.log(`captured ${calls.length} JSON responses, ${lines.length} API requests -> ${outDir}`);
  for (const c of calls) console.log(`${c.status} ${c.method} ${c.url} (${c.body.length} chars)`);
  await browser.close();
})();
