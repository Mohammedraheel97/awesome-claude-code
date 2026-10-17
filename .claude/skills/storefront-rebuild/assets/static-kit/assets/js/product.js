/* Product page: options & live price, add to cart, WhatsApp order, image zoom, related & recently viewed. */
(() => {
  'use strict';
  const A = window.AR;
  const { $, esc, t, dict, pick, pname, cname, pdesc, asset, productUrl, collectionUrl, catOf, itemsOf, unitPrice, defaultSel, selLabel, discountPct, money, railHTML, store } = A;

  Object.assign(dict.ar, {
    inStock: 'متوفر', qtyLabel: 'الكمية', addTotal: m => `أضف إلى السلة · ${m}`, orderWa: 'اطلب مباشرة عبر واتساب',
    perkDelivery: 'توصيل لجميع مناطق الكويت أو استلام من فرع حولي', perkPay: 'دفع آمن: كي نت، فيزا / ماستر أو نقدًا', perkCode: 'خصم 15% للطلبات من 6 د.ك بالكود 15OFF',
    share: 'مشاركة', copyLink: 'نسخ الرابط', linkCopied: 'تم نسخ رابط المنتج', details: 'تفاصيل المنتج', deliveryPay: 'التوصيل والدفع',
    detCat: 'القسم', detSku: 'رمز المنتج', detSizes: 'الأوزان المتوفرة',
    deliveryText: 'نوصّل الطلبات داخل الكويت، ويمكنك أيضًا الاستلام من فرعنا في حولي، شارع موسى بن نصير. يتم تأكيد الطلب ووقت التوصيل عبر واتساب. الدفع نقدًا أو عبر كي نت وفيزا / ماستر.',
    youMayLike: 'قد يعجبك أيضًا', related: 'منتجات من نفس القسم', recent: 'شاهدتها مؤخرًا', save: n => `وفّر ${n}`
  });
  Object.assign(dict.en, {
    inStock: 'In stock', qtyLabel: 'Quantity', addTotal: m => `Add to cart · ${m}`, orderWa: 'Order directly on WhatsApp',
    perkDelivery: 'Delivery across Kuwait or pickup from our Hawally branch', perkPay: 'Secure payment: KNET, Visa / Master or cash', perkCode: '15% off orders of 6 KWD+ with code 15OFF',
    share: 'Share', copyLink: 'Copy link', linkCopied: 'Product link copied', details: 'Product details', deliveryPay: 'Delivery & payment',
    detCat: 'Category', detSku: 'Product code', detSizes: 'Available weights',
    deliveryText: 'We deliver across Kuwait, or you can pick up from our branch in Hawally, Musa Bin Nusair Street. Orders and delivery times are confirmed on WhatsApp. Pay cash, by KNET or Visa / Master.',
    youMayLike: 'You may also like', related: 'More from this collection', recent: 'Recently viewed', save: n => `Save ${n}`
  });

  const p = A.byId.get(+document.body.dataset.product);
  if (!p) return;
  const cat = catOf(p);
  const st = { sel: defaultSel(p), qty: 1 };
  const recent = store.get('recent', []).filter(id => id !== p.id && A.byId.has(id));
  store.set('recent', [p.id, ...recent].slice(0, 12));

  const unit = () => unitPrice(p, st.sel);
  function waText() {
    return `${t('waProduct')}\n${pname(p)}${p.opts ? ` (${selLabel(p, st.sel)})` : ''} × ${st.qty} — ${money(unit() * st.qty)}\n${location.origin}${productUrl(p)}`;
  }
  function updatePrice() {
    const pct = discountPct(p);
    $('#pdpPrice').innerHTML = `<span class="now">${money(unit())}</span>${pct ? `<s>${money(p.old)}</s><span class="badge">${t('save', money(p.old - p.price))}</span>` : ''}`;
    $('#qtyOut').textContent = st.qty;
    $('#addBtn').textContent = p.stock ? t('addTotal', money(unit() * st.qty)) : t('outOfStock');
    $('#waOrder').href = A.waLink(waText());
    $('#stickyPrice').textContent = money(unit() * st.qty);
  }

  function render() {
    document.title = `${pname(p)} | ${t('brandName')}`;
    const catLink = cat ? `<a href="${collectionUrl(cat)}">${esc(cname(cat))}</a>` : '';
    $('#crumbs').innerHTML = `<a href="/">${t('home')}</a><span aria-hidden="true">/</span>${catLink}<span aria-hidden="true">/</span><span aria-current="page">${esc(pname(p))}</span>`;
    $('#pdpImg').alt = pname(p);
    const desc = pdesc(p);
    const weights = (p.opts || []).find(g => g.en === 'Weight');
    $('#pdpInfo').innerHTML = `
      ${cat ? `<a class="eyebrow-link" href="${collectionUrl(cat)}">${esc(cname(cat))}</a>` : ''}
      <h1>${esc(pname(p))}</h1>
      <div class="pdp-price" id="pdpPrice"></div>
      <p class="stock ${p.stock ? 'in' : 'out'}">${p.stock ? t('inStock') : t('outOfStock')}</p>
      ${(p.opts || []).map((g, gi) => `<fieldset class="opt"><legend>${esc(pick(g))}</legend><div class="opt-vals">${g.vals.map(v =>
        `<label><input type="radio" name="opt${gi}" value="${v.id}" data-g="${gi}" ${st.sel[gi] === v.id ? 'checked' : ''}><span>${esc(pick(v))}${v.p && g.vals.length > 1 && g.en === 'Weight' ? `<small>${money(v.p)}</small>` : ''}</span></label>`).join('')}</div></fieldset>`).join('')}
      <div class="pdp-buy">
        <div class="qty big" role="group" aria-label="${t('qtyLabel')}"><button type="button" id="qtyMinus" aria-label="-">−</button><output id="qtyOut">1</output><button type="button" id="qtyPlus" aria-label="+">+</button></div>
        <button class="btn btn-lg" type="button" id="addBtn" ${p.stock ? '' : 'disabled'}></button>
      </div>
      <a class="btn btn-lg btn-wa block" id="waOrder" target="_blank" rel="noopener">${t('orderWa')}</a>
      <ul class="pdp-perks"><li>${t('perkDelivery')}</li><li>${t('perkPay')}</li><li>${t('perkCode')}</li></ul>
      <div class="pdp-share"><span>${t('share')}:</span><a href="https://wa.me/?text=${encodeURIComponent(pname(p) + ' ' + location.origin + productUrl(p))}" target="_blank" rel="noopener">WhatsApp</a><button type="button" id="copyLink">${t('copyLink')}</button></div>
      <details class="acc" open><summary>${t('details')}</summary>
        ${desc ? `<p>${esc(desc)}</p>` : ''}
        <dl class="specs">${cat ? `<div><dt>${t('detCat')}</dt><dd>${esc(cname(cat))}</dd></div>` : ''}${weights ? `<div><dt>${t('detSizes')}</dt><dd>${weights.vals.map(v => esc(pick(v))).join('، ')}</dd></div>` : ''}<div><dt>${t('detSku')}</dt><dd>#${p.id}</dd></div></dl>
      </details>
      <details class="acc"><summary>${t('deliveryPay')}</summary><p>${t('deliveryText')}</p></details>`;
    $('#stickyBuy').innerHTML = `<img src="${asset(p.img)}" alt="" width="44" height="44"><div><b>${esc(pname(p))}</b><span id="stickyPrice"></span></div><button class="btn" type="button" id="stickyAdd" ${p.stock ? '' : 'disabled'}>${t('addToCart')}</button>`;
    updatePrice();

    const rel = cat ? itemsOf(cat).filter(x => x.id !== p.id) : [];
    $('#relatedSec').hidden = !rel.length;
    if (rel.length) $('#relatedRail').innerHTML = railHTML(rel.slice(0, 12));
    const rec = recent.map(id => A.byId.get(id)).filter(Boolean).slice(0, 10);
    $('#recentSec').hidden = !rec.length;
    if (rec.length) $('#recentRail').innerHTML = railHTML(rec);
  }

  const add = () => A.addToCart(p.id, st.qty, st.sel);
  document.addEventListener('click', e => {
    if (e.target.closest('#addBtn, #stickyAdd')) { add(); return; }
    if (e.target.closest('#qtyMinus')) { st.qty = Math.max(1, st.qty - 1); updatePrice(); return; }
    if (e.target.closest('#qtyPlus')) { st.qty = Math.min(99, st.qty + 1); updatePrice(); return; }
    if (e.target.closest('#copyLink')) { navigator.clipboard?.writeText(location.origin + productUrl(p)).catch(() => {}); A.toast(t('linkCopied')); }
  });
  document.addEventListener('change', e => {
    const r = e.target.closest('input[data-g]');
    if (r) { st.sel[+r.dataset.g] = +r.value; updatePrice(); }
  });

  const zoom = $('#zoom');
  zoom.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const b = zoom.getBoundingClientRect();
    zoom.style.setProperty('--zx', `${((e.clientX - b.left) / b.width) * 100}%`);
    zoom.style.setProperty('--zy', `${((e.clientY - b.top) / b.height) * 100}%`);
    zoom.classList.add('on');
  });
  zoom.addEventListener('pointerleave', () => zoom.classList.remove('on'));

  const sticky = $('#stickyBuy');
  const io = new IntersectionObserver(([en]) => { sticky.hidden = en.isIntersecting || en.boundingClientRect.top > 0; });
  A.page(() => { render(); io.disconnect(); io.observe($('.pdp-buy')); });
})();
