/* Shared site core: data access, i18n, product cards, header/search, menu, cart & checkout.
   Page scripts register a renderer with AR.page(fn); it re-runs when the language changes. */
(() => {
  'use strict';
  const S = window.SITE, CATS = window.CATS, PRODUCTS = window.PRODUCTS;
  const byId = new Map(PRODUCTS.map(p => [p.id, p]));
  const catById = new Map(CATS.map(c => [c.id, c]));
  const catBySlug = new Map(CATS.map(c => [c.slug, c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };

  /* ---------- i18n ---------- */
  const T = {
    ar: {
      skip: 'تخطي إلى المحتوى', menu: 'القائمة', search: 'بحث', cart: 'السلة', close: 'إغلاق', prev: 'السابق', next: 'التالي', mainNav: 'الأقسام الرئيسية',
      brandName: 'مطحنة ومحمصة الريان', brandShort: 'الريان', brandTag: 'مطحنة ومحمصة', home: 'الرئيسية', allCollections: 'جميع الأقسام', allCollectionsArrow: 'جميع الأقسام ←',
      announce: 'خصم 15% على الطلبات من 6 د.ك فما فوق — استخدم الكود', searchPh: 'ابحث عن قهوة، مكسرات، بهارات…',
      seeAllResults: n => `عرض كل النتائج (${n})`, noSearch: 'لا توجد نتائج. جرّب كلمة أخرى.',
      footerAbout: 'أجود القهوة المحمصة والمكسرات والبهارات والمربيات والمخللات والفواكه المجففة — كل ما يلزمك متوفر لدى الريان.',
      shop: 'تسوق', visitTitle: 'زورونا', hoursText: 'يوميًا 10:30 صباحًا – 12:00 منتصف الليل', hoursFri: 'الجمعة: من 1:30 ظهرًا',
      payTitle: 'دفع آمن ومضمون', payNote: 'كي نت، فيزا / ماستر، أو الدفع عند الاستلام.', rights: '© مطحنة ومحمصة الريان — جميع الحقوق محفوظة',
      needHelp: 'هل تحتاج للمساعدة؟', couponPh: 'كود الخصم', apply: 'تطبيق', delivery: 'توصيل', pickup: 'استلام من الفرع',
      name: 'الاسم', phone: 'رقم الهاتف', address: 'العنوان (المنطقة، القطعة، الشارع، المنزل)', notes: 'ملاحظات',
      subtotal: 'المجموع', discount: 'الخصم', total: 'الإجمالي', sendWa: 'إتمام الطلب عبر واتساب',
      waNote: 'سيتم فتح واتساب برسالة جاهزة بتفاصيل طلبك لتأكيده مع الفريق.',
      addToCart: 'أضف إلى السلة', chooseOpts: 'اختر الخيارات', outOfStock: 'غير متوفر', from: 'من', kwd: 'د.ك', off: n => `خصم ${n}%`, isNew: 'جديد',
      viewAll: 'عرض الكل', viewAllArrow: 'عرض الكل ←', products: n => `${n} منتج`, all: 'الكل', allProducts: 'جميع المنتجات',
      empty: 'سلتك فارغة', startShopping: 'ابدأ التسوق', remove: 'حذف', added: 'تمت الإضافة إلى السلة', viewCart: 'عرض السلة', copied: 'تم نسخ الكود 15OFF',
      couponOk: 'تم تطبيق كود الخصم', couponBad: 'كود الخصم غير صحيح', couponMin: m => `الحد الأدنى للطلب ${(+m).toFixed(3)} د.ك لتفعيل الخصم`,
      couponGap: g => `أضف ${g} لتحصل على خصم 15%`, couponActive: 'خصم 15% مفعّل على طلبك 🎉', couponHint: 'طلبك مؤهل لخصم 15% — استخدم الكود 15OFF',
      wa: 'مرحبًا مطحنة الريان، أرغب بتأكيد الطلب التالي:', waName: 'الاسم', waPhone: 'الهاتف', waMethod: 'طريقة الاستلام', waAddr: 'العنوان', waNotes: 'ملاحظات', waCode: 'كود الخصم',
      waProduct: 'مرحبًا مطحنة الريان، أرغب بطلب:',
      about: S.description, addrFull: S.address_ar + '، مقابل مسجد المطيري'
    },
    en: {
      skip: 'Skip to content', menu: 'Menu', search: 'Search', cart: 'Cart', close: 'Close', prev: 'Previous', next: 'Next', mainNav: 'Main categories',
      brandName: 'Alrayan Mills & Roastery', brandShort: 'Alrayan', brandTag: 'Mills & Roastery', home: 'Home', allCollections: 'All collections', allCollectionsArrow: 'All collections →',
      announce: '15% off orders of 6 KWD and up — use code', searchPh: 'Search coffee, nuts, spices…',
      seeAllResults: n => `See all results (${n})`, noSearch: 'No results. Try another word.',
      footerAbout: 'The finest roasted coffee, nuts, spices, jams, pickles and dried fruits — everything you need is at Alrayan.',
      shop: 'Shop', visitTitle: 'Visit us', hoursText: 'Daily 10:30 AM – 12:00 AM', hoursFri: 'Friday: from 1:30 PM',
      payTitle: 'Safe & secure payment', payNote: 'KNET, Visa / Master, or cash on delivery.', rights: '© Alrayan Mills & Roastery — All rights reserved',
      needHelp: 'Need help?', couponPh: 'Discount code', apply: 'Apply', delivery: 'Delivery', pickup: 'Branch pickup',
      name: 'Name', phone: 'Phone number', address: 'Address (area, block, street, house)', notes: 'Notes',
      subtotal: 'Subtotal', discount: 'Discount', total: 'Total', sendWa: 'Complete order via WhatsApp',
      waNote: 'WhatsApp opens with a ready message containing your order so the team can confirm it.',
      addToCart: 'Add to cart', chooseOpts: 'Choose options', outOfStock: 'Out of stock', from: 'From', kwd: 'KWD', off: n => `${n}% off`, isNew: 'New',
      viewAll: 'View all', viewAllArrow: 'View all →', products: n => `${n} product${n === 1 ? '' : 's'}`, all: 'All', allProducts: 'All products',
      empty: 'Your cart is empty', startShopping: 'Start shopping', remove: 'Remove', added: 'Added to cart', viewCart: 'View cart', copied: 'Code 15OFF copied',
      couponOk: 'Discount applied', couponBad: 'Invalid discount code', couponMin: m => `Minimum order ${(+m).toFixed(3)} KWD for the discount`,
      couponGap: g => `Add ${g} more to get 15% off`, couponActive: '15% off applied to your order 🎉', couponHint: 'Your order qualifies for 15% off — use code 15OFF',
      wa: 'Hello Alrayan, I would like to confirm this order:', waName: 'Name', waPhone: 'Phone', waMethod: 'Method', waAddr: 'Address', waNotes: 'Notes', waCode: 'Discount code',
      waProduct: 'Hello Alrayan, I would like to order:',
      about: 'Alrayan Mills & Roastery is your first choice for the finest freshly roasted coffee, distinctive flavoured nuts, a premium selection of spices, 100% natural jams and pickles, olive oil and premium olives, dried fruits, legumes and grains — everything you need is available at Alrayan.',
      addrFull: S.address_en + ', opposite Al-Mutairi Mosque'
    }
  };
  let lang = store.get('lang', 'ar');
  if (!T[lang]) lang = 'ar';
  const dict = { ar: {}, en: {} };   // page scripts add their own strings
  const t = (k, ...a) => { const v = k in dict[lang] ? dict[lang][k] : T[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  const fmtN = n => (+n).toFixed(3);
  const money = n => `${fmtN(n)} ${t('kwd')}`;
  const pick = (o, ar = 'ar', en = 'en') => (lang === 'ar' ? o[ar] : o[en]) || o[ar] || o[en] || '';
  const pname = p => pick(p);
  const cname = c => pick(c);
  const pdesc = p => pick(p, 'dar', 'den');
  const asset = path => '/' + path;
  const productUrl = p => `/products/${p.slug}/`;
  const collectionUrl = c => c === 'all' ? '/collections/all/' : `/collections/${c.slug}/`;
  const catOf = p => catById.get(p.cat) || CATS.find(c => c.items.includes(p.id));
  const itemsOf = c => c.items.map(i => byId.get(i)).filter(Boolean);
  const norm = s => (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  const matches = (p, q) => { const n = norm(q); return norm(p.ar).includes(n) || norm(p.en).includes(n); };

  /* ---------- product helpers ---------- */
  const minAdd = p => (p.opts || []).reduce((s, g) => s + Math.min(...g.vals.map(v => v.p)), 0);
  const unitPrice = (p, sel = []) => p.opts ? p.price - minAdd(p) + p.opts.reduce((s, g, i) => s + (g.vals.find(v => v.id === sel[i]) || g.vals[0]).p, 0) : p.price;
  const defaultSel = p => (p.opts || []).map(g => g.vals[0].id);
  const selLabel = (p, sel) => (p.opts || []).map((g, i) => pick(g.vals.find(v => v.id === sel[i]) || g.vals[0])).join(' · ');
  const discountPct = p => p.old && !p.opts ? Math.round((1 - p.price / p.old) * 100) : 0;
  const newIds = new Set((catById.get(81) || { items: [] }).items);

  function priceHTML(p) {
    return `<div class="price">${p.opts ? `<small>${t('from')}</small>` : ''}<span>${money(p.price)}</span>${discountPct(p) ? `<s>${money(p.old)}</s>` : ''}</div>`;
  }
  function cardHTML(p) {
    const name = esc(pname(p)), url = productUrl(p), pct = discountPct(p);
    const badge = !p.stock ? `<span class="badge muted-badge">${t('outOfStock')}</span>` : pct ? `<span class="badge">${t('off', pct)}</span>` : newIds.has(p.id) ? `<span class="badge dark">${t('isNew')}</span>` : '';
    const action = !p.stock ? `<button class="btn" type="button" disabled>${t('outOfStock')}</button>`
      : p.opts ? `<a class="btn btn-soft" href="${url}">${t('chooseOpts')}</a>`
      : `<button class="btn" type="button" data-add="${p.id}">${t('addToCart')}</button>`;
    return `<article class="card">
      <a class="card-media" href="${url}" tabindex="-1" aria-hidden="true"><img src="${asset(p.img)}" alt="" loading="lazy" decoding="async" width="320" height="320">${badge}</a>
      <div class="card-body"><a class="card-title" href="${url}">${name}</a>${priceHTML(p)}${action}</div>
    </article>`;
  }
  function railHTML(items) {
    const rtl = lang === 'ar';
    return `<button class="rail-arrow a-start" type="button" data-rail="-1" aria-label="${t('prev')}">${rtl ? '›' : '‹'}</button>
      <div class="rail">${items.map(cardHTML).join('')}</div>
      <button class="rail-arrow a-end" type="button" data-rail="1" aria-label="${t('next')}">${rtl ? '‹' : '›'}</button>`;
  }

  let toastTimer;
  function toast(msg, action) {
    const el = $('#toast');
    el.innerHTML = esc(msg) + (action ? ` <button type="button" class="toast-action" data-toast-action>${esc(action.label)}</button>` : '');
    el.hidden = false; el.onclick = e => { if (action && e.target.closest('[data-toast-action]')) { el.hidden = true; action.run(); } };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------- cart ---------- */
  const saved = store.get('cart', {});
  const cart = { items: {}, coupon: !!saved.coupon };
  for (const [k, l] of Object.entries(saved.items || {})) if (l && byId.has(l.id) && l.q > 0 && Array.isArray(l.v)) cart.items[k] = l;
  const persist = () => store.set('cart', cart);
  const cartLines = () => Object.entries(cart.items).map(([key, l]) => { const p = byId.get(l.id); return { key, p, q: l.q, sel: l.v, unit: unitPrice(p, l.v) }; });
  function totals() {
    const sub = cartLines().reduce((s, l) => s + l.unit * l.q, 0), v = S.voucher;
    const disc = cart.coupon && sub >= v.min ? Math.round(sub * v.pct * 10) / 1000 : 0;
    return { sub, disc, total: sub - disc };
  }
  function renderCart() {
    const lines = cartLines(), n = lines.reduce((s, l) => s + l.q, 0);
    const badge = $('#cartCount'); badge.textContent = n; badge.hidden = n === 0;
    $('#checkout').hidden = !lines.length;
    const tt = totals(), gap = S.voucher.min - tt.sub, note = $('#freeNote');
    note.hidden = !lines.length;
    note.innerHTML = gap > 0 ? `${esc(t('couponGap', money(gap)))}<span class="bar"><span style="width:${Math.min(100, tt.sub / S.voucher.min * 100)}%"></span></span>`
      : esc(t(cart.coupon ? 'couponActive' : 'couponHint'));
    const body = $('#cartBody');
    if (!lines.length) { body.innerHTML = `<div class="cart-empty"><svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true"><path d="M5 8h14l-1 11.5a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 8Z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.4" fill="none"/></svg><span>${t('empty')}</span><a class="btn" href="/collections/all/">${t('startShopping')}</a></div>`; return; }
    body.innerHTML = lines.map(({ key, p, q, sel, unit }) => `<div class="line">
      <a href="${productUrl(p)}"><img src="${asset(p.img)}" alt="" width="64" height="64"></a>
      <div><a class="line-title" href="${productUrl(p)}">${esc(pname(p))}</a>${p.opts ? `<small class="muted">${esc(selLabel(p, sel))}</small>` : ''}<div class="price">${money(unit * q)}</div><button class="rm" type="button" data-rm="${esc(key)}">${t('remove')}</button></div>
      <div class="qty"><button type="button" data-dec="${esc(key)}" aria-label="-">−</button><output>${q}</output><button type="button" data-inc="${esc(key)}" aria-label="+">+</button></div></div>`).join('');
    $('#tSub').textContent = money(tt.sub);
    $('#tDiscRow').hidden = !tt.disc; $('#tDisc').textContent = '− ' + money(tt.disc);
    $('#tTotal').textContent = money(tt.total);
    if (cart.coupon) $('#couponInput').value = S.voucher.code;
  }
  function addToCart(id, qty = 1, sel = []) {
    const key = [id, ...sel].join('|'), cur = cart.items[key];
    cart.items[key] = { id, v: sel, q: Math.min(99, (cur ? cur.q : 0) + qty) };
    persist(); renderCart();
    const btn = $('#cartBtn'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    toast(t('added'), { label: t('viewCart'), run: openCart });
  }
  function setQty(key, q) { if (!cart.items[key]) return; if (q <= 0) delete cart.items[key]; else cart.items[key].q = Math.min(99, q); persist(); renderCart(); }
  function applyCoupon(code) {
    if ((code || '').trim().toUpperCase() !== S.voucher.code.toUpperCase()) { cart.coupon = false; persist(); renderCart(); toast(t('couponBad')); return; }
    cart.coupon = true; persist(); renderCart();
    toast(totals().sub >= S.voucher.min ? t('couponOk') : t('couponMin', S.voucher.min));
  }
  const waLink = text => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
  function checkout(e) {
    e.preventDefault();
    const lines = cartLines(); if (!lines.length) return;
    const method = $('input[name=method]:checked').value, tt = totals();
    const out = [t('wa'), ''];
    lines.forEach(({ p, q, sel, unit }, i) => out.push(`${i + 1}. ${pname(p)}${p.opts ? ` (${selLabel(p, sel)})` : ''} × ${q} — ${money(unit * q)}`));
    out.push('', `${t('subtotal')}: ${money(tt.sub)}`);
    if (tt.disc) out.push(`${t('waCode')} ${S.voucher.code}: − ${money(tt.disc)}`);
    out.push(`${t('total')}: ${money(tt.total)}`, '', `${t('waName')}: ${$('#custName').value.trim()}`, `${t('waPhone')}: ${$('#custPhone').value.trim()}`,
      `${t('waMethod')}: ${t(method)}`);
    if (method === 'delivery') out.push(`${t('waAddr')}: ${$('#custAddr').value.trim()}`);
    const note = $('#custNote').value.trim(); if (note) out.push(`${t('waNotes')}: ${note}`);
    window.open(waLink(out.join('\n')), '_blank', 'noopener');
  }
  function syncMethod() { const del = $('input[name=method]:checked').value === 'delivery'; $('#custAddr').hidden = !del; $('#custAddr').required = del; }

  /* ---------- drawers ---------- */
  let openEl = null, lastFocus = null;
  function openLayer(el) {
    closeLayer(true);
    lastFocus = document.activeElement; openEl = el;
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false; document.body.classList.add('locked');
    el.focus({ preventScroll: true });
  }
  function closeLayer(silent) {
    if (!openEl) return;
    openEl.classList.remove('open'); openEl.setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true; document.body.classList.remove('locked');
    openEl = null; if (!silent && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  const openCart = () => { renderCart(); openLayer($('#cartDrawer')); };

  /* ---------- header: menu & search ---------- */
  function renderMenu() {
    $('#menuList').innerHTML = `<a href="/">${t('home')}</a><a href="/collections/">${t('allCollections')}</a><a href="/collections/all/">${t('allProducts')} <small>${PRODUCTS.length}</small></a>` +
      CATS.map(c => `<a href="${collectionUrl(c)}"><span class="menu-cat"><img src="${asset(c.img)}" alt="" loading="lazy" width="36" height="36">${esc(cname(c))}</span><small>${c.n}</small></a>`).join('') +
      `<a href="/#about">${t('visitTitle')}</a>`;
  }
  function renderSearch(q) {
    const box = $('#searchResults');
    if (!q.trim()) { box.innerHTML = ''; return; }
    const found = PRODUCTS.filter(p => matches(p, q));
    box.innerHTML = found.length
      ? `<ul class="sr-list">${found.slice(0, 6).map(p => `<li><a href="${productUrl(p)}"><img src="${asset(p.img)}" alt="" width="48" height="48" loading="lazy"><span>${esc(pname(p))}<small>${esc(cname(catOf(p)))}</small></span><b>${money(p.price)}</b></a></li>`).join('')}</ul>
         <a class="sr-all" href="/collections/all/?q=${encodeURIComponent(q)}">${t('seeAllResults', found.length)}</a>`
      : `<p class="sr-empty">${t('noSearch')}</p>`;
  }
  function toggleSearch(show) {
    const panel = $('#searchPanel'); panel.hidden = !show; $('#searchBtn').setAttribute('aria-expanded', show);
    if (show) $('#searchInput').focus();
  }

  /* ---------- static text & shared chrome ---------- */
  function applyI18n() {
    const root = document.documentElement;
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (typeof v === 'string') el.textContent = v; });
    const attr = (sel, key, name) => $$(sel).forEach(el => { const v = t(el.dataset[key]); if (typeof v === 'string') el.setAttribute(name, v); });
    attr('[data-i18n-aria]', 'i18nAria', 'aria-label');
    attr('[data-i18n-ph]', 'i18nPh', 'placeholder');
    attr('[data-i18n-title]', 'i18nTitle', 'title');
    $$('[data-cat-name]').forEach(el => { const c = catById.get(+el.dataset.catName); if (c) el.textContent = cname(c); });
    $$('[data-cat-link]').forEach(el => { const c = catById.get(+el.dataset.catLink); if (c) el.href = collectionUrl(c); });
    $$('[data-addr]').forEach(el => { el.textContent = t('addrFull'); });
    const lb = $('#langBtn'); lb.textContent = lang === 'ar' ? 'EN' : 'ع'; lb.lang = lang === 'ar' ? 'en' : 'ar';
    lb.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
    const path = location.pathname;
    $$('.main-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === path));
    const social = [['instagram', 'Instagram', S.instagram], ['tiktok', 'TikTok', S.tiktok], ['facebook', 'Facebook', S.facebook]].filter(s => s[2]);
    $('#footerSocial').innerHTML = social.map(([k, n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${n}">${ICONS[k]}</a>`).join('');
    $('#footerPay').innerHTML = S.payments.map(m => `<img src="${asset(m.img)}" alt="${esc(pick(m))}" loading="lazy" height="36">`).join('');
  }
  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3-3.46V8.1A6.5 6.5 0 1 0 17 14.5V8.6a6.6 6.6 0 0 0 3.5 1.1V6.6A3.6 3.6 0 0 1 17 3h-3Z" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4A21 21 0 0 0 14.3 4c-2.3 0-3.8 1.4-3.8 4v2.5H8v3h2.5V21h3Z" fill="currentColor"/></svg>'
  };

  let pageRender = null;
  function renderAll() { applyI18n(); renderMenu(); renderCart(); syncMethod(); if ($('#searchInput').value) renderSearch($('#searchInput').value); if (pageRender) pageRender(); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const g = s => e.target.closest(s);
    let el;
    if ((el = g('[data-add]'))) { addToCart(+el.dataset.add); return; }
    if ((el = g('[data-rail]'))) {
      const rail = $('.rail', el.closest('.carousel')), sign = document.documentElement.dir === 'rtl' ? -1 : 1;
      rail.scrollBy({ left: +el.dataset.rail * sign * rail.clientWidth * .85, behavior: 'smooth' }); return;
    }
    if (g('[data-copy-code]')) {
      navigator.clipboard?.writeText(S.voucher.code).catch(() => {});
      cart.coupon = true; persist(); renderCart(); toast(t('copied')); return;
    }
    if ((el = g('[data-inc]'))) { setQty(el.dataset.inc, cart.items[el.dataset.inc].q + 1); return; }
    if ((el = g('[data-dec]'))) { setQty(el.dataset.dec, cart.items[el.dataset.dec].q - 1); return; }
    if ((el = g('[data-rm]'))) { setQty(el.dataset.rm, 0); return; }
    if (g('[data-close]') || e.target.id === 'scrim') { closeLayer(); return; }
    if (!$('#searchPanel').hidden && !g('#searchPanel') && !g('#searchBtn')) toggleSearch(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLayer(); toggleSearch(false); } });
  $('#menuBtn').onclick = () => openLayer($('#menuDrawer'));
  $('#cartBtn').onclick = openCart;
  $('#searchBtn').onclick = () => toggleSearch($('#searchPanel').hidden);
  $('#searchClose').onclick = () => toggleSearch(false);
  let searchTimer;
  $('#searchInput').oninput = e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => renderSearch(e.target.value), 120); };
  $('#langBtn').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('lang', lang); renderAll(); };
  $('#applyCoupon').onclick = () => applyCoupon($('#couponInput').value);
  $('#checkout').onsubmit = checkout;
  $$('input[name=method]').forEach(r => { r.onchange = syncMethod; });
  window.addEventListener('storage', e => {
    if (e.key !== 'cart') return;
    const s = store.get('cart', {}); cart.coupon = !!s.coupon; cart.items = {};
    for (const [k, l] of Object.entries(s.items || {})) if (l && byId.has(l.id) && l.q > 0 && Array.isArray(l.v)) cart.items[k] = l;
    renderCart();
  });

  window.AR = {
    S, CATS, PRODUCTS, byId, catById, catBySlug, $, $$, esc, store, dict, t, money, fmtN, pick, pname, cname, pdesc, asset,
    productUrl, collectionUrl, catOf, itemsOf, matches, minAdd, unitPrice, defaultSel, selLabel, discountPct, priceHTML,
    cardHTML, railHTML, toast, addToCart, openCart, waLink,
    get lang() { return lang; },
    page(fn) { pageRender = fn; renderAll(); }
  };
  renderAll();
})();
