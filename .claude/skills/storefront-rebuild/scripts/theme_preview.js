#!/usr/bin/env node
// Local preview of the Shopify theme without a store: renders the theme's Liquid with liquidjs plus shims for the
// Shopify tags/filters it uses, filled with the project's data.js (window.SITE / CATS / PRODUCTS from the static kit).
//
//   npm i --prefix <scratch> liquidjs@10 && NODE_PATH=<scratch>/node_modules \
//   node theme_preview.js <themeDir> <staticSiteDir> <outDir> [--lang ar|en]
//   (cd <outDir> && python3 -m http.server 8124)   # then screenshot / smoke_test.js
//
// Renders index, a collection, a product, collections list, cart and 404. It is a preview, not Shopify: it catches
// layout/CSS/JS problems and missing translations ("[missing key]" is printed) that theme-check cannot see.
const fs = require('fs'), path = require('path');
const { Liquid, Tag } = require(require.resolve('liquidjs', { paths: [process.env.NODE_PATH || '', process.cwd()].filter(Boolean) }));
const [THEME, SITE, OUT] = process.argv.slice(2);
const LANG = (process.argv.indexOf('--lang') > -1 ? process.argv[process.argv.indexOf('--lang') + 1] : 'ar');
if (!THEME || !SITE || !OUT) { console.error('usage: node theme_preview.js <themeDir> <staticSiteDir> <outDir> [--lang ar|en]'); process.exit(2); }
const read = p => fs.readFileSync(path.join(THEME, p), 'utf8');
const stripSchema = s => s.replace(/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g, '').replace(/(posted_successfully|comments_enabled|moderated)\?/g, '$1');
const schemaOf = s => { const m = s.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/); return m ? JSON.parse(m[1]) : {}; };

// ---------- data ----------
const sandbox = {}; new Function('window', fs.readFileSync(path.join(SITE, 'assets/data.js'), 'utf8'))(sandbox);
const { SITE: S, CATS, PRODUCTS } = sandbox;
const img = (src, alt = '') => src ? { src: '/' + src, alt, width: 800, height: 800, id: src, media_type: 'image', preview_image: { src: '/' + src } } : null;
const cents = v => Math.round(v * 100);
let vid = 1000;
function toProduct(p) {
  const im = img(p.img, p.ar);
  const minAdd = (p.opts || []).reduce((s, g) => s + Math.min(...g.vals.map(v => v.p)), 0), base = p.price - minAdd;
  let variants = [{ id: ++vid, title: 'Default Title', options: ['Default Title'], option1: 'Default Title', price: cents(p.price), compare_at_price: p.old ? cents(p.old) : null, available: !!p.stock, sku: String(p.id), featured_media: null }];
  if (p.opts) {
    const combos = p.opts.reduce((acc, g) => acc.flatMap(a => g.vals.map(v => [...a, v])), [[]]);
    variants = combos.map(c => ({ id: ++vid, title: c.map(v => v.ar).join(' / '), options: c.map(v => v.ar), option1: c[0].ar, option2: c[1]?.ar, price: cents(base + c.reduce((s, v) => s + v.p, 0)), compare_at_price: null, available: true, sku: String(p.id), featured_media: null }));
  }
  const prices = variants.map(v => v.price);
  return {
    id: p.id, title: LANG === 'ar' ? p.ar : p.en, handle: p.slug, url: `/products/${p.slug}`, vendor: 'Alrayan', type: '', tags: [], description: p.dar ? `<p>${p.dar}</p>` : '',
    featured_media: im, media: im ? [im] : [], available: !!p.stock, price: Math.min(...prices), price_min: Math.min(...prices), price_max: Math.max(...prices),
    price_varies: new Set(prices).size > 1, compare_at_price: variants[0].compare_at_price, has_only_default_variant: !p.opts,
    variants, selected_or_first_available_variant: variants[0],
    options: p.opts ? p.opts.map(g => g.ar) : ['Title'],
    options_with_values: p.opts ? p.opts.map((g, i) => ({ name: g.ar, values: g.vals.map(v => v.ar), selected_value: variants[0].options[i] })) : [],
    collections: []
  };
}
const products = new Map(PRODUCTS.map(p => [p.id, toProduct(p)]));
const collections = CATS.map(c => {
  const items = c.items.map(i => products.get(i)).filter(Boolean);
  const col = { id: c.id, title: LANG === 'ar' ? c.ar : c.en, handle: c.slug, url: `/collections/${c.slug}`, products: items, products_count: items.length, all_products_count: items.length,
    featured_image: img(c.img), image: img(c.img), description: '', filters: [], sort_by: 'manual', default_sort_by: 'manual',
    sort_options: [{ value: 'manual', name: 'المميز' }, { value: 'price-ascending', name: 'السعر: من الأقل' }, { value: 'price-descending', name: 'السعر: من الأعلى' }] };
  items.forEach(p => { if (!p.collections.length) p.collections.push(col); });
  return col;
});
const colById = new Map(CATS.map((c, i) => [c.id, collections[i]]));
// a demo list filter so the facets UI renders
const withSubs = CATS.find(c => c.subs && c.subs.length) || CATS[0];
colById.get(withSubs.id).filters = [{ label: 'Type', type: 'list', param_name: 'filter.p.m.custom.type', active_values: [], values: (withSubs.subs || []).map(s => ({ label: s.ar, value: s.id, param_name: 'filter.p.m.custom.type', count: 3, active: false })) },
  { label: 'السعر', type: 'price_range', range_max: 2000, min_value: { param_name: 'filter.v.price.gte', value: null }, max_value: { param_name: 'filter.v.price.lte', value: null } }];

// ---------- settings ----------
const settingsSchema = JSON.parse(read('config/settings_schema.json'));
const settingsData = JSON.parse(read('config/settings_data.json')).current;
const settings = {};
settingsSchema.forEach(g => (g.settings || []).forEach(s => { if ('default' in s) settings[s.id] = s.default; }));
Object.assign(settings, settingsData);
settings.color_schemes = Object.entries(settingsData.color_schemes).map(([id, v]) => ({ id, settings: v.settings }));
settings.type_heading_font = { family: '"Barlow Condensed"', fallback_families: 'sans-serif', weight: 600, style: 'normal' };
settings.type_body_font = { family: 'Inter', fallback_families: 'sans-serif', weight: 400, style: 'normal' };
settings.logo = img(S.logo);

// ---------- engine ----------
const engine = new Liquid({ root: [path.join(THEME, 'snippets')], extname: '.liquid', strictFilters: false, jsTruthy: false, dynamicPartials: true });
engine.renderFileSync = undefined;
const origParse = engine.parse.bind(engine);
engine.parse = (html, file) => origParse(stripSchema(html), file);
const fsImpl = engine.options.fs;
const origReadFile = fsImpl.readFile.bind(fsImpl);
fsImpl.readFile = async f => stripSchema(await origReadFile(f));
fsImpl.readFileSync && (fsImpl.readFileSync = (orig => f => stripSchema(orig(f)))(fsImpl.readFileSync.bind(fsImpl)));

const locale = JSON.parse(read(fs.existsSync(path.join(THEME, `locales/${LANG}.json`)) ? `locales/${LANG}.json` : 'locales/en.default.json'));
const kw = args => { const o = {}, pos = []; args.forEach(a => Array.isArray(a) ? (o[a[0]] = a[1]) : pos.push(a)); return [o, pos]; };
const attr = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => v === true || v === '' ? ` ${k}` : ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
const money = c => c == null ? '' : `${(c / 100).toFixed(3)} د.ك`;
engine.registerFilter('t', (key, ...args) => {
  const [o] = kw(args);
  let v = key.split('.').reduce((d, k) => d && d[k], locale);
  if (v && typeof v === 'object') v = o.count == 1 ? v.one : o.count == 2 ? v.two || v.other : v.other;
  if (v == null) return `[missing ${key}]`;
  return String(v).replace(/{{\s*(\w+)\s*}}/g, (_, k) => o[k] ?? '');
});
engine.registerFilter('money', money);
engine.registerFilter('money_with_currency', c => `${money(c)} KWD`);
engine.registerFilter('money_without_currency', c => c == null ? '' : (c / 100).toFixed(3));
engine.registerFilter('asset_url', f => `/assets/${f}`);
engine.registerFilter('shopify_asset_url', f => `/shopify/${f}`);
engine.registerFilter('stylesheet_tag', u => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('script_tag', u => `<script src="${u}"></script>`);
engine.registerFilter('image_url', i => (i && (i.src || i.preview_image?.src)) || (typeof i === 'string' ? i : ''));
engine.registerFilter('image_tag', (src, ...args) => { const [o] = kw(args); delete o.widths; delete o.sizes; return `<img${attr({ src, ...o })}>`; });
engine.registerFilter('placeholder_svg_tag', (n, cls = '') => `<svg class="${cls}" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300"/></svg>`);
engine.registerFilter('font_face', () => '');
engine.registerFilter('font_modify', f => f);
engine.registerFilter('payment_button', () => '<div class="shopify-payment-button"><button class="btn btn--outline btn--block" type="button" disabled>Buy it now</button></div>');
engine.registerFilter('payment_type_svg_tag', t => `<svg class="payment-icon" viewBox="0 0 38 24"><rect width="38" height="24" rx="3" fill="#fff"/><text x="19" y="16" font-size="8" text-anchor="middle" fill="#333">${t}</text></svg>`);
engine.registerFilter('structured_data', () => '');
engine.registerFilter('default_errors', () => '');
engine.registerFilter('time_tag', d => `<time>${d}</time>`);
engine.registerFilter('format_address', () => '');
engine.registerFilter('handleize', s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('format_code', s => s);

// {% style %}
engine.registerTag('style', class extends Tag {
  constructor(t, rem, liquid) { super(t, rem, liquid); this.tpls = []; const stream = this.liquid.parser.parseStream(rem).on('tag:endstyle', () => stream.stop()).on('template', x => this.tpls.push(x)).on('end', () => { throw new Error('style not closed'); }); stream.start(); }
  *render(ctx, emitter) { emitter.write('<style>'); yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter); emitter.write('</style>'); }
});
// {% form 'type', obj, key: value %}
engine.registerTag('form', class extends Tag {
  constructor(t, rem, liquid) {
    super(t, rem, liquid); this.args = t.args; this.tpls = [];
    const stream = this.liquid.parser.parseStream(rem).on('tag:endform', () => stream.stop()).on('template', x => this.tpls.push(x)).on('end', () => { throw new Error('form not closed'); }); stream.start();
  }
  *render(ctx, emitter) {
    const type = (this.args.match(/'([^']+)'/) || [])[1];
    const attrs = {};
    for (const m of this.args.matchAll(/([\w-]+):\s*('([^']*)'|[\w.]+)/g)) attrs[m[1]] = m[3] !== undefined ? m[3] : yield this.liquid.evalValue(m[2], ctx);
    const action = { product: '/cart/add', customer: '/contact', contact: '/contact', localization: '/localization' }[type] || '/account';
    emitter.write(`<form method="post" action="${action}"${attr(attrs)}>`);
    ctx.push({ form: { errors: null, posted_successfully: false } });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop(); emitter.write('</form>');
  }
});
// {% paginate x by n %}
engine.registerTag('paginate', class extends Tag {
  constructor(t, rem, liquid) { super(t, rem, liquid); this.tpls = []; const stream = this.liquid.parser.parseStream(rem).on('tag:endpaginate', () => stream.stop()).on('template', x => this.tpls.push(x)).on('end', () => { throw new Error('paginate not closed'); }); stream.start(); }
  *render(ctx, emitter) { ctx.push({ paginate: { pages: 1, current_page: 1, parts: [] } }); yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter); ctx.pop(); }
});

let sectionCounter = 0;
function sectionObject(file, data = {}, id) {
  const schema = schemaOf(read(`sections/${file}.liquid`));
  const defaults = {}; (schema.settings || []).forEach(s => { if ('default' in s) defaults[s.id] = s.default; });
  const blockDefs = Object.fromEntries((schema.blocks || []).map(b => [b.type, b]));
  const blocks = (data.block_order || Object.keys(data.blocks || {})).map(bid => {
    const b = data.blocks[bid], d = {}; ((blockDefs[b.type] || {}).settings || []).forEach(s => { if ('default' in s) d[s.id] = s.default; });
    return { id: bid, type: b.type, settings: { ...d, ...b.settings }, shopify_attributes: '' };
  });
  return { id: id || `s${++sectionCounter}`, settings: { ...defaults, ...(data.settings || {}) }, blocks };
}
async function renderSection(type, data, id, globals) {
  const tpl = engine.parse(read(`sections/${type}.liquid`));
  const html = await engine.render(tpl, { ...globals, section: sectionObject(type, data, id) }, { globals });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}
async function renderGroup(name, globals) {
  const g = JSON.parse(read(`sections/${name}.json`));
  let out = '';
  for (const id of g.order) out += await renderSection(g.sections[id].type, g.sections[id], id, globals);
  return `<div class="shopify-section-group-${name}">${out}</div>`;
}
const SectionsTag = class extends Tag { constructor(t, r, l) { super(t, r, l); this.name = t.args.trim().replace(/['"]/g, ''); } *render(ctx, em) { em.write(yield renderGroup(this.name, ctx.getAll())); } };
const SectionTag = class extends Tag { constructor(t, r, l) { super(t, r, l); this.name = t.args.trim().replace(/['"]/g, ''); } *render(ctx, em) { em.write(yield renderSection(this.name, {}, this.name, ctx.getAll())); } };
engine.registerTag('sections', SectionsTag);
engine.registerTag('section', SectionTag);

// ---------- pages ----------
function globalsFor(pageType, extra = {}) {
  return {
    settings, shop: { name: 'مطحنة ومحمصة الريان', description: S.description, customer_accounts_enabled: true, enabled_payment_types: ['visa', 'master', 'knet'], url: '/' },
    request: { page_type: pageType, origin: 'http://localhost:8124', locale: { iso_code: LANG } },
    routes: { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update', search_url: '/search',
      collections_url: '/collections', all_products_collection_url: '/collections/all', account_url: '/account', account_login_url: '/account/login',
      predictive_search_url: '/search/suggest', product_recommendations_url: '/recommendations/products' },
    cart: { item_count: 0, items: [], total_price: 0, currency: { iso_code: 'KWD' }, cart_level_discount_applications: [] },
    localization: { available_languages: [{ iso_code: 'ar', endonym_name: 'العربية' }, { iso_code: 'en', endonym_name: 'English' }], language: { iso_code: LANG } },
    template: { name: pageType }, canonical_url: 'http://localhost:8124/', page_title: 'مطحنة ومحمصة الريان', content_for_header: '', powered_by_link: '', collections, ...extra
  };
}
async function renderPage(file, templateName, pageType, extra, configure) {
  const tpl = JSON.parse(read(`templates/${templateName}.json`));
  if (configure) configure(tpl);
  const g = globalsFor(pageType, extra);
  let content = '';
  for (const id of tpl.order) content += await renderSection(tpl.sections[id].type, tpl.sections[id], id, g);
  let html = await engine.render(engine.parse(read('layout/theme.liquid')), { ...g, content_for_layout: content }, { globals: g });
  html = html.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&family=Inter:wght@400;700&display=swap" rel="stylesheet"></head>');
  fs.mkdirSync(path.join(OUT, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), html);
  const missing = html.match(/\[missing [^\]]+\]/g); if (missing) console.log('MISSING', file, [...new Set(missing)]);
  console.log('rendered', file, html.length);
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const f of ['theme.css', 'theme.js']) fs.copyFileSync(path.join(THEME, 'assets', f), path.join(OUT, 'assets', f));
  fs.cpSync(path.join(SITE, 'assets/img'), path.join(OUT, 'assets/img'), { recursive: true });
  // Fill the home sections the way a merchant would in the theme editor: biggest collections first.
  const bySize = [...collections].filter(c => c.products_count).sort((a, b) => b.products_count - a.products_count);
  const findCol = re => collections.find(c => re.test(c.handle)) || bySize[0];
  await renderPage('index.html', 'index', 'index', {}, tpl => {
    const s = tpl.sections;
    for (const sec of Object.values(s)) {
      const blocks = sec.block_order || [];
      if (sec.type === 'hero-slideshow') blocks.forEach((b, i) => { sec.blocks[b].settings.image = img(S.banners[i % S.banners.length]); });
      if (sec.type === 'collection-circles') blocks.forEach((b, i) => { sec.blocks[b].settings.collection = collections[i % collections.length]; });
      if (sec.type === 'collection-tabs') blocks.forEach((b, i) => { sec.blocks[b].settings.collection = bySize[i % bySize.length]; });
      if (sec.type === 'promo-banners') blocks.forEach((b, i) => { sec.blocks[b].settings.image = bySize[(i + 2) % bySize.length].featured_image; });
      if (sec.type === 'image-with-text') sec.settings.image = (findCol(/coffee|qahwa|tea/) || bySize[0]).featured_image;
    }
    const featured = Object.values(s).filter(x => x.type === 'featured-collection');
    if (featured[0]) featured[0].settings.collection = findCol(/new|arrival|latest/);
    if (featured[1]) featured[1].settings.collection = findCol(/offer|sale|deal/);
  });
  const coll = bySize[0];
  await renderPage(`collections/${coll.handle}/index.html`, 'collection', 'collection', { collection: coll });
  const prod = [...products.values()].find(p => !p.has_only_default_variant) || [...products.values()][0];
  await renderPage(`products/${prod.handle}/index.html`, 'product', 'product', { product: prod, collection: prod.collections[0] });
  await renderPage('collections/index.html', 'list-collections', 'list-collections', {});
  await renderPage('cart/index.html', 'cart', 'cart', {});
  await renderPage('404.html', '404', '404', {});
  console.log(`preview pages: /, /collections/${coll.handle}/, /products/${prod.handle}/, /collections/, /cart/, /404.html`);
})().catch(e => { console.error(e); process.exit(1); });
