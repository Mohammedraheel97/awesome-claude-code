(() => {
  'use strict';
  const S = window.SITE, CATS = window.CATS, PRODUCTS = window.PRODUCTS;
  const byId = new Map(PRODUCTS.map(p => [p.id, p]));
  const catById = new Map(CATS.map(c => [c.id, c]));
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
      skip: 'تخطي إلى المحتوى', menu: 'القائمة', search: 'بحث', cart: 'السلة', close: 'إغلاق', prev: 'السابق', next: 'التالي',
      brandName: 'مطحنة ومحمصة الريان', searchPh: 'ابحث عن منتج…', promoTag: 'عرض خاص', copyCode: 'انسخ كود الخصم',
      f1: 'توصيل أو استلام من الفرع', f2: 'مربيات ومخللات طبيعية 100%', f3: 'دفع آمن: كي نت وفيزا / ماستر', f4: 'تواصل معنا عبر واتساب',
      shopByCat: 'تسوق حسب القسم', ctaTitle: 'نكهات المكسرات الفاخرة', ctaText: 'أشهى أنواع المكسرات المتميزة بنكهاتنا الفريدة، طازجة ومحمصة بعناية.',
      shopNow: 'تسوق الآن', allProducts: 'جميع المنتجات', showMore: 'عرض المزيد', noResults: 'لا توجد منتجات مطابقة.',
      aboutTitle: 'عن الريان', visitTitle: 'زورونا', addr: 'العنوان', hours: 'ساعات العمل', hoursText: 'يوميًا من 10:30 صباحًا حتى 12:00 منتصف الليل',
      hoursFri: 'الجمعة: من 1:30 ظهرًا', call: 'اتصل بنا', directions: 'الاتجاهات على الخريطة',
      footerAbout: 'أجود القهوة والمكسرات والبهارات والمربيات والمخللات والفواكه المجففة — كل ما يلزمك متوفر لدى الريان.',
      quickLinks: 'روابط سريعة', payTitle: 'دفع آمن ومضمون', rights: '© مطحنة ومحمصة الريان — جميع الحقوق محفوظة',
      needHelp: 'هل تحتاج للمساعدة؟', categories: 'الأقسام', couponPh: 'كود الخصم', apply: 'تطبيق', delivery: 'توصيل', pickup: 'الاستلام',
      name: 'الاسم', phone: 'رقم الهاتف', address: 'العنوان (المنطقة، القطعة، الشارع، المنزل)', notes: 'ملاحظات',
      subtotal: 'المجموع', discount: 'الخصم', total: 'الإجمالي', sendWa: 'إتمام الطلب عبر واتساب',
      waNote: 'سيتم فتح واتساب برسالة جاهزة بتفاصيل طلبك لتأكيده مع الفريق.', addToCart: 'أضف الى السلة', outOfStock: 'غير متوفر',
      viewAll: 'عرض الكل', from: 'من', chooseOpts: 'اختر الخيارات', viewCol: 'عرض المجموعة', products: n => `${n} منتجًا`, all: 'الكل', results: n => `${n} منتج`,
      empty: 'السلة فارغة', startShopping: 'ابدأ التسوق', remove: 'حذف', added: 'تمت الإضافة إلى السلة', copied: 'تم نسخ الكود',
      couponOk: 'تم تطبيق كود الخصم', couponBad: 'كود الخصم غير صحيح', couponMin: m => `الحد الأدنى للطلب ${fmtN(m)} د.ك`,
      kwd: 'د.ك', about: S.description,
      heroes: [
        ['من الشجر إلى الحجر', 'زيت الزيتون والزيتون الفاخر والمربيات والمخللات الطبيعية 100%', 'تسوق المونة'],
        ['مكسرات فاخرة طازجة', 'أجود أنواع المكسرات الخام والمميزة بنكهاتنا الفريدة', 'تسوق الآن'],
        ['نكهات الكاجو المميزة', 'كاجو محمّص بنكهات متنوعة يناسب كل الأذواق', 'تسوق الآن']
      ],
      promo: S.voucher.ar, wa: 'مرحبًا مطحنة الريان، أرغب بتأكيد الطلب التالي:', waName: 'الاسم', waPhone: 'الهاتف', waMethod: 'طريقة الاستلام',
      waDelivery: 'توصيل', waPickup: 'استلام من الفرع', waAddr: 'العنوان', waNotes: 'ملاحظات', waCode: 'كود الخصم', waTotal: 'الإجمالي'
    },
    en: {
      skip: 'Skip to content', menu: 'Menu', search: 'Search', cart: 'Cart', close: 'Close', prev: 'Previous', next: 'Next',
      brandName: 'Alrayan Mills & Roastery', searchPh: 'Search for a product…', promoTag: 'Special offer', copyCode: 'Copy discount code',
      f1: 'Delivery or branch pickup', f2: '100% natural jams & pickles', f3: 'Secure pay: KNET, Visa / Master', f4: 'Chat with us on WhatsApp',
      shopByCat: 'Shop by category', ctaTitle: 'Premium Roasted Nuts', ctaText: 'The finest nuts in our signature flavours, freshly roasted with care.',
      shopNow: 'Shop now', allProducts: 'All products', showMore: 'Show more', noResults: 'No matching products.',
      aboutTitle: 'About Alrayan', visitTitle: 'Visit us', addr: 'Address', hours: 'Opening hours', hoursText: 'Daily from 10:30 AM to 12:00 AM',
      hoursFri: 'Friday: from 1:30 PM', call: 'Call us', directions: 'Get directions',
      footerAbout: 'The finest coffee, nuts, spices, jams, pickles and dried fruits — everything you need is at Alrayan.',
      quickLinks: 'Quick links', payTitle: 'Safe & secure payment', rights: '© Alrayan Mills & Roastery — All rights reserved',
      needHelp: 'Need help?', categories: 'Categories', couponPh: 'Discount code', apply: 'Apply', delivery: 'Delivery', pickup: 'Pickup',
      name: 'Name', phone: 'Phone number', address: 'Address (area, block, street, house)', notes: 'Notes',
      subtotal: 'Subtotal', discount: 'Discount', total: 'Total', sendWa: 'Complete order via WhatsApp',
      waNote: 'WhatsApp will open with a ready message containing your order so the team can confirm it.', addToCart: 'Add to cart', outOfStock: 'Out of stock',
      viewAll: 'View all', from: 'From', chooseOpts: 'Choose options', viewCol: 'View collection', products: n => `${n} product${n === 1 ? '' : 's'}`, all: 'All', results: n => `${n} item${n === 1 ? '' : 's'}`,
      empty: 'Your cart is empty', startShopping: 'Start shopping', remove: 'Remove', added: 'Added to cart', copied: 'Code copied',
      couponOk: 'Discount applied', couponBad: 'Invalid discount code', couponMin: m => `Minimum order ${fmtN(m)} KWD`,
      kwd: 'KWD', about: 'Alrayan Mills & Roastery is your first choice for the finest freshly roasted coffee, distinctive flavoured nuts, a premium selection of spices, 100% natural jams and pickles, olive oil and premium olives, dried fruits of every kind, legumes and grains — everything you need is available at Alrayan.',
      heroes: [
        ['Natural Mouneh, Pure Taste', 'Olive oil, premium olives, and 100% natural jams and pickles', 'Shop mouneh'],
        ['Fresh Premium Nuts', 'The finest raw nuts and our signature flavoured mixes', 'Shop now'],
        ['Signature Cashew Flavours', 'Roasted cashews in flavours for every taste', 'Shop now']
      ],
      promo: '15% off for every 6 KD & up', wa: 'Hello Alrayan, I would like to confirm this order:', waName: 'Name', waPhone: 'Phone', waMethod: 'Method',
      waDelivery: 'Delivery', waPickup: 'Branch pickup', waAddr: 'Address', waNotes: 'Notes', waCode: 'Discount code', waTotal: 'Total'
    }
  };
  let lang = store.get('lang', 'ar');
  if (!T[lang]) lang = 'ar';
  const t = (k, ...a) => { const v = T[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  const fmtN = n => (+n).toFixed(3);
  const money = n => `${fmtN(n)} ${t('kwd')}`;
  const pname = p => (lang === 'ar' ? p.ar : p.en) || p.ar || p.en;
  const cname = c => (lang === 'ar' ? c.ar : c.en) || c.ar;

  /* ---------- state ---------- */
  const saved = store.get('cart', { items: {}, coupon: false });
  const cart = { items: {}, coupon: !!saved.coupon };
  for (const [k, l] of Object.entries(saved.items || {})) if (l && byId.has(l.id) && l.q > 0 && Array.isArray(l.v)) cart.items[k] = l;
  const filter = { cat: 'all', sub: 0, q: '', limit: 24 };
  const PAGE = 24;
  const persist = () => store.set('cart', cart);

  /* ---------- helpers ---------- */
  const norm = s => (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }
  const priceHTML = p => `<div class="price">${p.opts ? `<small>${t('from')}</small>` : ''}<span>${money(p.price)}</span>${p.old && !p.opts ? `<s>${money(p.old)}</s>` : ''}</div>`;
  const optGroupName = g => (lang === 'ar' ? g.ar : g.en) || g.ar;
  const optValName = v => (lang === 'ar' ? v.ar : v.en) || v.ar;
  const unitPrice = (p, sel) => p.opts ? p.opts.reduce((s, g, i) => s + (g.vals.find(v => v.id === sel[i]) || g.vals[0]).p, p.price - p.opts.reduce((s2, g) => s2 + Math.min(...g.vals.map(v => v.p)), 0)) : p.price;
  const defaultSel = p => (p.opts || []).map(g => g.vals[0].id);
  const selLabel = (p, sel) => (p.opts || []).map((g, i) => optValName(g.vals.find(v => v.id === sel[i]) || g.vals[0])).join(' · ');

  function cardHTML(p) {
    const name = esc(pname(p));
    return `<article class="card" data-id="${p.id}">
      <button class="card-img" data-open="${p.id}" aria-label="${name}"><img src="${p.img}" alt="" loading="lazy" decoding="async" width="300" height="300"></button>
      <h3 data-open="${p.id}">${name}</h3>
      ${priceHTML(p)}
      <button class="btn" ${p.opts ? `data-open="${p.id}"` : `data-add="${p.id}"`} ${p.stock ? '' : 'disabled'}>${!p.stock ? t('outOfStock') : p.opts ? t('chooseOpts') : t('addToCart')}</button>
    </article>`;
  }

  /* ---------- static text ---------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'مطحنة ومحمصة الريان | قهوة، مكسرات وبهارات في الكويت' : 'Alrayan Mills & Roastery | Coffee, Nuts & Spices in Kuwait';
    $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (typeof v === 'string') el.textContent = v; });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-ph]').forEach(el => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
    $('#langBtn').textContent = lang === 'ar' ? 'English' : 'العربية';
    $('#promoTitle').textContent = t('promo');
    $('#promoCode').textContent = S.voucher.code;
    $('#aboutText').textContent = t('about');
    $('#addr').textContent = lang === 'ar' ? S.address_ar + '، مقابل مسجد المطيري' : S.address_en + ', opposite Al-Mutairi Mosque';
    for (const [id, num] of [['tel1', S.phone], ['tel2', S.phone2]]) { const a = $('#' + id); a.textContent = `+965 ${num}`; a.href = `tel:+965${num}`; }
    $('#mapLink').href = `https://www.google.com/maps?q=${S.lat},${S.lng}`;
    $('#waFloat').href = `https://wa.me/${S.whatsapp}`;
    $('#social').innerHTML = [['Instagram', S.instagram], ['TikTok', S.tiktok], ['Facebook', S.facebook]].filter(x => x[1]).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join('');
    $('#pay').innerHTML = S.payments.map(m => `<img src="${m.img}" alt="${esc(lang === 'ar' ? m.ar : m.en)}" loading="lazy" height="40">`).join('');
  }

  /* ---------- hero ---------- */
  const HERO_CTA = [{ cat: 72 }, { cat: 48 }, { cat: 51, sub: 13 }];
  let heroIdx = 0, heroTimer;
  function renderHero() {
    const hs = t('heroes');
    $('#heroTrack').innerHTML = S.banners.map((src, i) => `<div class="hero-slide" role="group" aria-roledescription="slide" aria-label="${i + 1}/${S.banners.length}">
      <img src="${src}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
      <div class="hero-copy"><h1>${esc(hs[i][0])}</h1><p>${esc(hs[i][1])}</p><button class="btn btn-lg" data-go-cat="${HERO_CTA[i].cat}" data-go-sub="${HERO_CTA[i].sub || 0}">${esc(hs[i][2])}</button></div></div>`).join('');
    $('#heroDots').innerHTML = S.banners.map((_, i) => `<button aria-label="${i + 1}" data-dot="${i}"></button>`).join('');
    showHero(heroIdx);
  }
  function showHero(i) {
    const n = S.banners.length; heroIdx = (i + n) % n;
    $('#heroTrack').style.transform = `translateX(${-heroIdx * 100}%)`;
    $$('#heroDots button').forEach((b, k) => b.setAttribute('aria-current', k === heroIdx));
  }
  function autoplay() {
    clearInterval(heroTimer);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    heroTimer = setInterval(() => showHero(heroIdx + 1), 6500);
  }

  /* ---------- featured rows & mosaic ---------- */
  const FEATURED = [81, 69, 51, 36];
  function renderRows() {
    const rtl = lang === 'ar';
    $('#rows').innerHTML = FEATURED.map(id => {
      const c = catById.get(id); if (!c || !c.items.length) return '';
      const items = c.items.map(i => byId.get(i)).filter(Boolean).slice(0, 12);
      return `<section class="wrap row-block" aria-label="${esc(cname(c))}">
        <header class="section-head"><h2>${esc(cname(c))}</h2><button class="btn btn-sm" data-go-cat="${id}">${t('viewAll')}</button></header>
        <div class="carousel"><button class="rail-arrow a-start" data-rail="-1" aria-label="${t('prev')}">${rtl ? '›' : '‹'}</button>
        <div class="rail">${items.map(cardHTML).join('')}</div>
        <button class="rail-arrow a-end" data-rail="1" aria-label="${t('next')}">${rtl ? '‹' : '›'}</button></div></section>`;
    }).join('');
  }
  // 6-column mosaic rhythm: 3+3 | 2+2+2 | 4+2 | 2+4
  const SPANS = [3, 3, 2, 2, 2, 4, 2, 2, 4];
  function renderMosaic() {
    const list = CATS.filter(c => c.img);
    const lastFull = list.length % 9 === 1 ? list.length - 1 : -1;
    $('#mosaic').innerHTML = list.map((c, i) => `<button class="tile" style="--span:${i === lastFull ? 6 : SPANS[i % 9]}" data-go-cat="${c.id}">
      <img src="${c.img}" alt="" loading="lazy"><span class="tile-copy"><strong>${esc(cname(c))}</strong><span>${t('products', c.n)}</span><em>${t('viewCol')} ${lang === 'ar' ? '←' : '→'}</em></span></button>`).join('');
  }

  /* ---------- catalog ---------- */
  function catalogList() {
    let list;
    if (filter.cat === 'all') list = PRODUCTS;
    else { const c = catById.get(filter.cat); list = c.items.map(i => byId.get(i)).filter(Boolean); if (filter.sub) list = list.filter(p => p.sub === filter.sub); }
    if (filter.q) { const q = norm(filter.q); list = list.filter(p => norm(p.ar).includes(q) || norm(p.en).includes(q)); }
    return list;
  }
  function renderChips() {
    $('#chips').innerHTML = [`<button class="chip" role="tab" data-chip="all" aria-selected="${filter.cat === 'all'}">${t('all')}</button>`]
      .concat(CATS.map(c => `<button class="chip" role="tab" data-chip="${c.id}" aria-selected="${filter.cat === c.id}">${esc(cname(c))}</button>`)).join('');
    const c = filter.cat === 'all' ? null : catById.get(filter.cat);
    const sub = $('#subChips');
    if (c && c.subs.length) {
      sub.hidden = false;
      sub.innerHTML = [`<button class="chip" data-sub="0" aria-selected="${!filter.sub}">${t('all')}</button>`]
        .concat(c.subs.map(s => `<button class="chip" data-sub="${s.id}" aria-selected="${filter.sub === s.id}">${esc(lang === 'ar' ? s.ar : s.en)}</button>`)).join('');
    } else { sub.hidden = true; sub.innerHTML = ''; }
  }
  function renderGrid() {
    const list = catalogList();
    $('#grid').innerHTML = list.slice(0, filter.limit).map(cardHTML).join('');
    $('#moreBtn').hidden = list.length <= filter.limit;
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = t('results', list.length);
  }
  function renderCatalog() { renderChips(); renderGrid(); }
  function goCatalog(cat, sub = 0, scroll = true) {
    Object.assign(filter, { cat, sub, q: '', limit: PAGE }); $('#searchInput').value = '';
    renderCatalog();
    if (scroll) $('#catalog').scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------- menu ---------- */
  function renderMenu() {
    $('#menuList').innerHTML = `<a href="#catalog" data-go-cat="all">${t('allProducts')}</a>` +
      CATS.map(c => `<a href="#catalog" data-go-cat="${c.id}">${esc(cname(c))} <small>${c.n}</small></a>`).join('') +
      `<a href="#about">${t('aboutTitle')}</a>`;
  }

  /* ---------- cart ---------- */
  const cartLines = () => Object.entries(cart.items).map(([key, l]) => { const p = byId.get(l.id); return { key, p, q: l.q, sel: l.v, unit: unitPrice(p, l.v) }; });
  function totals() {
    const sub = cartLines().reduce((s, l) => s + l.unit * l.q, 0);
    const v = S.voucher;
    const disc = cart.coupon && sub >= v.min ? Math.round(sub * v.pct * 10) / 1000 : 0; // pct of sub, rounded to fils
    return { sub, disc, total: sub - disc };
  }
  function renderCart() {
    const lines = cartLines(), n = lines.reduce((s, l) => s + l.q, 0);
    const badge = $('#cartCount'); badge.textContent = n; badge.hidden = n === 0;
    $('#checkout').hidden = lines.length === 0;
    const body = $('#cartBody');
    if (!lines.length) { body.innerHTML = `<div class="cart-empty"><span>${t('empty')}</span><button class="btn" data-close data-go-cat="all">${t('startShopping')}</button></div>`; return; }
    body.innerHTML = lines.map(({ key, p, q, sel, unit }) => `<div class="line">
      <img src="${p.img}" alt="">
      <div><b>${esc(pname(p))}</b>${p.opts ? `<small class="muted">${esc(selLabel(p, sel))}</small>` : ''}<div class="price">${money(unit)}</div><button class="rm" data-rm="${esc(key)}">${t('remove')}</button></div>
      <div class="qty"><button data-dec="${esc(key)}" aria-label="-">−</button><output>${q}</output><button data-inc="${esc(key)}" aria-label="+">+</button></div></div>`).join('');
    const tt = totals();
    $('#tSub').textContent = money(tt.sub);
    $('#tDiscRow').hidden = !tt.disc; $('#tDisc').textContent = '− ' + money(tt.disc);
    $('#tTotal').textContent = money(tt.total);
    $('#couponInput').value = cart.coupon ? S.voucher.code : $('#couponInput').value;
  }
  function addToCart(id, qty = 1, sel = []) {
    const key = [id, ...sel].join('|'), cur = cart.items[key];
    cart.items[key] = { id, v: sel, q: Math.min(99, (cur ? cur.q : 0) + qty) }; persist(); renderCart(); toast(t('added'));
  }
  function setQty(key, q) { if (!cart.items[key]) return; if (q <= 0) delete cart.items[key]; else cart.items[key].q = Math.min(99, q); persist(); renderCart(); }
  function applyCoupon(code) {
    if ((code || '').trim().toUpperCase() !== S.voucher.code.toUpperCase()) { cart.coupon = false; persist(); renderCart(); toast(t('couponBad')); return; }
    cart.coupon = true; persist(); renderCart();
    toast(totals().sub >= S.voucher.min ? t('couponOk') : t('couponMin', S.voucher.min));
  }
  function checkout(e) {
    e.preventDefault();
    const lines = cartLines(); if (!lines.length) return;
    const method = $('input[name=method]:checked').value, tt = totals();
    const out = [t('wa'), ''];
    lines.forEach(({ p, q, sel, unit }, i) => out.push(`${i + 1}. ${pname(p)}${p.opts ? ` (${selLabel(p, sel)})` : ''} × ${q} — ${fmtN(unit * q)} ${t('kwd')}`));
    out.push('', `${t('subtotal')}: ${money(tt.sub)}`);
    if (tt.disc) out.push(`${t('waCode')} ${S.voucher.code}: − ${money(tt.disc)}`);
    out.push(`${t('waTotal')}: ${money(tt.total)}`, '',
      `${t('waName')}: ${$('#custName').value.trim()}`, `${t('waPhone')}: ${$('#custPhone').value.trim()}`,
      `${t('waMethod')}: ${method === 'delivery' ? t('waDelivery') : t('waPickup')}`);
    if (method === 'delivery') out.push(`${t('waAddr')}: ${$('#custAddr').value.trim()}`);
    const note = $('#custNote').value.trim(); if (note) out.push(`${t('waNotes')}: ${note}`);
    window.open(`https://wa.me/${S.whatsapp}?text=${encodeURIComponent(out.join('\n'))}`, '_blank', 'noopener');
  }
  function syncMethod() {
    const del = $('input[name=method]:checked').value === 'delivery';
    $('#custAddr').hidden = !del; $('#custAddr').required = del;
  }

  /* ---------- drawers & modal ---------- */
  let openEl = null, lastFocus = null;
  function openLayer(el) {
    closeLayer(true);
    lastFocus = document.activeElement; openEl = el;
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false; document.body.style.overflow = 'hidden';
    el.focus({ preventScroll: true });
  }
  function closeLayer(silent) {
    if (!openEl) return;
    openEl.classList.remove('open'); openEl.setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true; document.body.style.overflow = '';
    openEl = null; if (!silent && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  let pm = { id: 0, qty: 1, sel: [] };
  function openProduct(id) {
    const p = byId.get(id); if (!p) return;
    pm = { id, qty: 1, sel: defaultSel(p) };
    $('#pmImg').src = p.img; $('#pmTitle').textContent = pname(p);
    $('#pmOpts').innerHTML = (p.opts || []).map((g, gi) => `<fieldset class="opt"><legend>${esc(optGroupName(g))}</legend><div class="opt-vals">${g.vals.map((v, vi) =>
      `<label><input type="radio" name="opt${gi}" value="${v.id}" data-g="${gi}" ${vi === 0 ? 'checked' : ''}><span>${esc(optValName(v))}${v.p && g.vals.length > 1 && g.en === 'Weight' ? `<small>${money(v.p)}</small>` : ''}</span></label>`).join('')}</div></fieldset>`).join('');
    updatePm();
    $('#pmDesc').textContent = (lang === 'ar' ? p.dar || p.den : p.den || p.dar) || '';
    $('#pmDesc').hidden = !$('#pmDesc').textContent;
    $('#pmQty').textContent = 1; $('#pmAdd').disabled = !p.stock;
    openLayer($('#productModal'));
  }

  function updatePm() {
    const p = byId.get(pm.id);
    $('#pmPrice').innerHTML = `<div class="price"><span>${money(unitPrice(p, pm.sel))}</span>${p.old && !p.opts ? `<s>${money(p.old)}</s>` : ''}</div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const g = id => e.target.closest(id);
    let el;
    if ((el = g('[data-go-cat]'))) {
      const v = el.dataset.goCat; closeLayer(true);
      goCatalog(v === 'all' ? 'all' : +v, +(el.dataset.goSub || 0));
      if (el.tagName === 'A') e.preventDefault();
      return;
    }
    if ((el = g('[data-add]'))) { addToCart(+el.dataset.add); return; }
    if ((el = g('[data-open]'))) { openProduct(+el.dataset.open); return; }
    if ((el = g('[data-chip]'))) { const v = el.dataset.chip; Object.assign(filter, { cat: v === 'all' ? 'all' : +v, sub: 0, limit: PAGE }); renderCatalog(); return; }
    if ((el = g('[data-sub]'))) { Object.assign(filter, { sub: +el.dataset.sub, limit: PAGE }); renderCatalog(); return; }
    if ((el = g('[data-rail]'))) {
      const rail = $('.rail', el.closest('.carousel')), sign = document.dir === 'rtl' || document.documentElement.dir === 'rtl' ? -1 : 1;
      rail.scrollBy({ left: +el.dataset.rail * sign * rail.clientWidth * .85, behavior: 'smooth' }); return;
    }
    if ((el = g('[data-dot]'))) { showHero(+el.dataset.dot); autoplay(); return; }
    if ((el = g('[data-inc]'))) { setQty(el.dataset.inc, cart.items[el.dataset.inc].q + 1); return; }
    if ((el = g('[data-dec]'))) { setQty(el.dataset.dec, cart.items[el.dataset.dec].q - 1); return; }
    if ((el = g('[data-rm]'))) { setQty(el.dataset.rm, 0); return; }
    if (g('[data-close]') || e.target.id === 'scrim' || e.target.id === 'productModal') closeLayer();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLayer(); $('#searchBar').hidden = true; } });

  $('#heroPrev').onclick = () => { showHero(heroIdx - 1); autoplay(); };
  $('#heroNext').onclick = () => { showHero(heroIdx + 1); autoplay(); };
  $('.hero').addEventListener('mouseenter', () => clearInterval(heroTimer));
  $('.hero').addEventListener('mouseleave', autoplay);

  $('#menuBtn').onclick = () => openLayer($('#menuDrawer'));
  $('#cartBtn').onclick = () => { renderCart(); openLayer($('#cartDrawer')); };
  $('#searchBtn').onclick = () => { const b = $('#searchBar'); b.hidden = !b.hidden; if (!b.hidden) $('#searchInput').focus(); };
  $('#searchClose').onclick = () => { $('#searchBar').hidden = true; };
  $('#searchBar').onsubmit = e => { e.preventDefault(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); };
  let searchT;
  $('#searchInput').oninput = e => {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      Object.assign(filter, { q: e.target.value, cat: 'all', sub: 0, limit: PAGE }); renderCatalog();
      if (filter.q) $('#catalog').scrollIntoView({ behavior: 'smooth' });
    }, 250);
  };
  $('#moreBtn').onclick = () => { filter.limit += PAGE; renderGrid(); };
  $('#langBtn').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('lang', lang); renderAll(); };
  $('#copyCode').onclick = async () => {
    try { await navigator.clipboard.writeText(S.voucher.code); } catch { /* clipboard blocked */ }
    cart.coupon = true; persist(); renderCart(); toast(t('copied'));
  };
  $('#applyCoupon').onclick = () => applyCoupon($('#couponInput').value);
  $('#checkout').onsubmit = checkout;
  $$('input[name=method]').forEach(r => r.onchange = syncMethod);
  $('#pmMinus').onclick = () => { pm.qty = Math.max(1, pm.qty - 1); $('#pmQty').textContent = pm.qty; };
  $('#pmPlus').onclick = () => { pm.qty = Math.min(99, pm.qty + 1); $('#pmQty').textContent = pm.qty; };
  $('#pmOpts').onchange = e => { const r = e.target.closest('input[data-g]'); if (r) { pm.sel[+r.dataset.g] = +r.value; updatePm(); } };
  $('#pmAdd').onclick = () => { addToCart(pm.id, pm.qty, pm.sel); closeLayer(); };

  /* ---------- boot ---------- */
  function renderAll() {
    applyI18n(); renderHero(); renderRows(); renderMosaic(); renderCatalog(); renderMenu(); renderCart(); syncMethod(); autoplay();
  }
  renderAll();
})();
