#!/usr/bin/env node
// Run Shopify's theme-check on a theme folder and print offenses grouped by file.
//
//   npm i --prefix <scratch> @shopify/theme-check-node     # once
//   NODE_PATH=<scratch>/node_modules node theme_check.mjs <themeDir>
//
// Exit code 1 if there are errors. RemoteAsset warnings for Google Fonts are expected when Arabic fonts are on.
import { createRequire } from 'module';
import path from 'path';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(process.env.NODE_PATH || process.cwd(), 'noop.js'));
let tc;
try { tc = await import(require.resolve('@shopify/theme-check-node')); }
catch { console.error('Install first: npm i --prefix <dir> @shopify/theme-check-node, then set NODE_PATH=<dir>/node_modules'); process.exit(2); }

const offenses = await tc.check(root);
const sev = ['error', 'warning', 'info'];
const byFile = {};
for (const o of offenses) (byFile[o.uri.replace(`file://${root}/`, '')] ||= []).push(`${sev[o.severity] ?? o.severity} ${o.check}: ${o.message.split('\n')[0]} (line ${(o.start?.line ?? 0) + 1})`);
for (const [file, list] of Object.entries(byFile)) { console.log(`## ${file}`); list.forEach(l => console.log(`   ${l}`)); }
const counts = offenses.reduce((a, o) => { const k = sev[o.severity] ?? o.severity; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('TOTAL', JSON.stringify(counts));
process.exit(counts.error ? 1 : 0);
