#!/usr/bin/env node
// Browser smoke test for a built site: for each path, at desktop (1440) and mobile (390) widths, report
// console/page errors, failed same-origin requests, horizontal overflow and broken images; save screenshots.
//
//   node smoke_test.js <baseUrl> <outDir> <path> [<path> …] [--lang-toggle "#langBtn"]
//
// Exit code 1 when any issue is found. Overflow culprits are listed (elements past the viewport edge that are
// not clipped by a scrolling/overflow-hidden ancestor) — the usual cause is an absolutely positioned child
// whose containing block sits outside a scroll container.
const fs = require('fs');
const path = require('path');
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { return require(p); } catch { /* next */ } }
  throw new Error('playwright not found');
}
const argv = process.argv.slice(2);
const toggleIdx = argv.indexOf('--lang-toggle');
const langToggle = toggleIdx > -1 ? argv.splice(toggleIdx, 2)[1] : null;
const [base, outDir, ...paths] = argv;
if (!base || !outDir || !paths.length) { console.error('usage: node smoke_test.js <baseUrl> <outDir> <path>…'); process.exit(2); }

(async () => {
  const { chromium } = loadPlaywright();
  const launch = {};
  if (process.env.PLAYWRIGHT_CHROMIUM) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
  const browser = await chromium.launch(launch);
  fs.mkdirSync(outDir, { recursive: true });
  const origin = new URL(base).origin;
  let issues = 0;
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(origin)) errs.push(`${r.status()} ${r.url()}`); });
    for (const p of paths) {
      errs.length = 0;
      await page.goto(base.replace(/\/$/, '') + p, { waitUntil: 'load' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(500);
      const result = await page.evaluate(() => {
        const W = document.documentElement.clientWidth, out = [];
        const clipped = el => { for (let a = el.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.position === 'fixed' || cs.overflowX !== 'visible') return true; } return false; };
        if (document.documentElement.scrollWidth > W + 1) {
          for (const el of document.querySelectorAll('body *')) {
            if (getComputedStyle(el).position === 'fixed' || clipped(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width && (r.right > W + 1 || r.left < -1)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
          }
        }
        const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.src);
        return { scrollWidth: document.documentElement.scrollWidth, width: W, overflow: out.slice(0, 8), broken: broken.slice(0, 8) };
      });
      const name = `${label}${p.replace(/[^a-z0-9]+/gi, '_')}`.replace(/_+$/, '') || label;
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
      const problems = [...errs];
      if (result.scrollWidth > result.width + 1) problems.push(`horizontal overflow ${result.scrollWidth}px > ${result.width}px ${result.overflow.join(', ')}`);
      result.broken.forEach(b => problems.push(`broken image ${b}`));
      issues += problems.length;
      console.log(`${problems.length ? '✗' : '✓'} ${label} ${p}${problems.length ? '\n    ' + problems.join('\n    ') : ''}`);
    }
    if (langToggle && label === 'desktop') {
      await page.goto(base.replace(/\/$/, '') + paths[0], { waitUntil: 'load' });
      await page.click(langToggle); await page.waitForTimeout(400);
      console.log(`  language toggle -> lang=${await page.evaluate(() => document.documentElement.lang)} dir=${await page.evaluate(() => document.documentElement.dir)}`);
      await page.screenshot({ path: path.join(outDir, 'desktop_lang_toggled.png') });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(issues ? `\n${issues} issue(s) found` : '\nall clean');
  process.exit(issues ? 1 : 0);
})();
