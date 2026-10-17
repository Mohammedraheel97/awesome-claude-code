/* Alrayan theme scripts: drawers, AJAX cart, product form & variants, slideshow, carousels, tabs,
   predictive search, filters, recommendations and recently viewed. No dependencies. */
(() => {
  'use strict';
  const T = window.theme || { routes: { root: '/', cartAdd: '/cart/add', cartChange: '/cart/change', cartUpdate: '/cart/update', cart: '/cart', predictiveSearch: '/search/suggest' }, strings: {} };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isRTL = () => document.documentElement.dir === 'rtl';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(message, action) {
    const el = $('[data-toast]'); if (!el) return;
    el.textContent = message;
    if (action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => { el.hidden = true; action.run(); });
      el.append(' ', b);
    }
    el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  /* ---------- drawers ---------- */
  let openDrawer = null, lastFocus = null;
  function open(id) {
    const d = document.getElementById(id); if (!d) return false;
    close(true);
    lastFocus = document.activeElement; openDrawer = d;
    d.classList.add('is-open'); d.setAttribute('aria-hidden', 'false');
    const scrim = $('[data-scrim]'); if (scrim) scrim.hidden = false;
    document.body.classList.add('is-locked');
    d.focus({ preventScroll: true });
    return true;
  }
  function close(silent) {
    if (!openDrawer) return;
    openDrawer.classList.remove('is-open'); openDrawer.setAttribute('aria-hidden', 'true');
    const scrim = $('[data-scrim]'); if (scrim) scrim.hidden = true;
    document.body.classList.remove('is-locked');
    openDrawer = null;
    if (!silent && lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- cart ---------- */
  const cartDrawer = () => document.getElementById('CartDrawer');
  function setCount(n) {
    $$('[data-cart-count]').forEach(el => { el.textContent = n; el.hidden = n === 0; });
    const btn = $('.cart-btn'); if (btn) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }
  }
  function renderDrawer(html) {
    const drawer = cartDrawer(); if (!drawer || !html) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fresh = doc.querySelector('[data-cart-content]'), current = drawer.querySelector('[data-cart-content]');
    if (fresh && current) { current.replaceWith(fresh); setCount(+fresh.dataset.count || 0); }
  }
  async function refreshDrawer() {
    const res = await fetch(`${T.routes.root}?sections=cart-drawer`);
    const data = await res.json(); renderDrawer(data['cart-drawer']);
  }
  async function addToCart(form, button) {
    const body = new FormData(form);
    body.append('sections', 'cart-drawer');
    body.append('sections_url', location.pathname);
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    const errorEl = form.closest('[data-buy]')?.querySelector('[data-form-error]');
    if (errorEl) errorEl.hidden = true;
    try {
      const res = await fetch(`${T.routes.cartAdd}.js`, { method: 'POST', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || T.strings.error);
      if (T.cartType === 'page') { location.href = T.routes.cart; return; }
      if (data.sections) renderDrawer(data.sections['cart-drawer']); else await refreshDrawer();
      if (!open('CartDrawer')) toast(T.strings.added, { label: T.strings.viewCart, run: () => { location.href = T.routes.cart; } });
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.hidden = false; } else toast(err.message);
    } finally {
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }
  async function changeLine(line, quantity) {
    const drawer = cartDrawer(); drawer?.classList.add('is-busy');
    try {
      const res = await fetch(`${T.routes.cartChange}.js`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line, quantity, sections: ['cart-drawer'], sections_url: location.pathname })
      });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || T.strings.error);
      renderDrawer(data.sections?.['cart-drawer']);
      if (document.body.classList.contains('template-cart')) location.reload();
    } catch (err) { toast(err.message); } finally { drawer?.classList.remove('is-busy'); }
  }
  const saveNote = debounce(note => {
    fetch(`${T.routes.cartUpdate}.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
  }, 400);
  async function whatsappCart() {
    const res = await fetch(`${T.routes.cart}.js`); const cart = await res.json();
    const fmt = cents => (cents / 100).toFixed(cart.currency === 'KWD' || cart.currency === 'BHD' || cart.currency === 'OMR' ? 3 : 2) + ' ' + cart.currency;
    const lines = cart.items.map((it, i) => `${i + 1}. ${it.product_title}${it.variant_title ? ` (${it.variant_title})` : ''} × ${it.quantity} — ${fmt(it.final_line_price)}`);
    const note = cart.note ? `\n\n${cart.note}` : '';
    const text = `${T.strings.waIntro}\n\n${lines.join('\n')}\n\n${T.strings.waTotal}: ${fmt(cart.total_price)}${note}`;
    window.open(`https://wa.me/${T.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* ---------- product page ---------- */
  function initProduct(section) {
    const picker = $('[data-variant-picker]', section);
    const variants = picker ? JSON.parse($('[data-variants]', picker).textContent) : [];
    const idInput = $('[data-variant-id]', section);
    const addButtons = $$('[data-add-button]', section);
    const wa = $('[data-whatsapp-product]', section);
    const qtyInput = $('input[name="quantity"]', section);

    const selected = () => {
      const out = [];
      $$('[data-option-index]', picker).forEach(el => {
        if (el.tagName === 'SELECT' || el.checked) out[+el.dataset.optionIndex] = el.value;
      });
      return out;
    };
    function updateWhatsApp(variant) {
      if (!wa) return;
      const qty = qtyInput ? Math.max(1, +qtyInput.value || 1) : 1;
      const v = variant && variant.title !== 'Default Title' ? ` (${variant.title})` : '';
      const text = `${wa.dataset.message} ${wa.dataset.title}${v} × ${qty}\n${location.origin}${section.dataset.url}${variant ? `?variant=${variant.id}` : ''}`;
      wa.href = `https://wa.me/${wa.dataset.number}?text=${encodeURIComponent(text)}`;
    }
    function showMedia(id) {
      if (!id) return;
      $$('.pdp-slide', section).forEach(s => s.classList.toggle('is-active', s.dataset.mediaId === String(id)));
      $$('.pdp-thumb', section).forEach(t => t.classList.toggle('is-active', t.dataset.thumb === String(id)));
    }
    function update() {
      const opts = selected();
      const variant = variants.find(v => v.options.every((o, i) => o === opts[i]));
      // mark option values that have no available combination with the other current choices
      $$('input[data-option-index]', picker).forEach(input => {
        const i = +input.dataset.optionIndex;
        const ok = variants.some(v => v.available && v.options[i] === input.value && v.options.every((o, j) => j === i || o === opts[j]));
        input.classList.toggle('is-unavailable', !ok);
      });
      addButtons.forEach(b => {
        b.disabled = !variant || !variant.available;
        b.textContent = !variant ? T.strings.unavailable : variant.available ? T.strings.addToCart : T.strings.soldOut;
      });
      if (!variant) { updateWhatsApp(null); return; }
      if (idInput) idInput.value = variant.id;
      const priceWrap = $('[data-price-wrap] [data-price]', section);
      if (priceWrap) {
        priceWrap.innerHTML = '';
        const now = document.createElement('span'); now.className = 'price-now'; now.textContent = variant.price; priceWrap.append(now);
        if (variant.compare) { const was = document.createElement('s'); was.className = 'price-was'; was.textContent = variant.compare; priceWrap.append(was); }
      }
      const sticky = $('[data-sticky-price]', section); if (sticky) sticky.textContent = variant.price;
      const stock = $('[data-stock]', section);
      if (stock) { stock.textContent = variant.available ? stock.dataset.in : stock.dataset.out; stock.classList.toggle('is-in', variant.available); stock.classList.toggle('is-out', !variant.available); }
      const sku = $('[data-sku]', section); if (sku) { sku.hidden = !variant.sku; $('span', sku).textContent = variant.sku || ''; }
      showMedia(variant.media);
      history.replaceState(null, '', `${section.dataset.url}?variant=${variant.id}`);
      updateWhatsApp(variant);
    }
    if (picker) picker.addEventListener('change', update);
    if (qtyInput) qtyInput.addEventListener('change', () => updateWhatsApp(variants.find(v => String(v.id) === idInput?.value)));
    if (picker) update(); else updateWhatsApp(null);

    $$('.pdp-thumb', section).forEach(t => t.addEventListener('click', () => showMedia(t.dataset.thumb)));
    const zoom = $('.zoom[data-zoom]', section);
    if (zoom) {
      zoom.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const b = zoom.getBoundingClientRect();
        zoom.style.setProperty('--zx', `${((e.clientX - b.left) / b.width) * 100}%`);
        zoom.style.setProperty('--zy', `${((e.clientY - b.top) / b.height) * 100}%`);
        zoom.classList.add('is-zoomed');
      });
      zoom.addEventListener('pointerleave', () => zoom.classList.remove('is-zoomed'));
    }
    const sticky = $('[data-sticky-buy]', section), buy = $('[data-buy]', section);
    if (sticky && buy && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { sticky.hidden = e.isIntersecting || e.boundingClientRect.top > 0; }).observe(buy);
    }
    // remember for "Recently viewed"
    const handle = section.dataset.handle;
    store.set('recent', [handle, ...store.get('recent', []).filter(h => h !== handle)].slice(0, 16));
  }

  /* ---------- slideshow ---------- */
  function initSlideshow(root) {
    const track = $('[data-track]', root), slides = $$('.hero-slide', root), dots = $$('[data-dot]', root);
    if (slides.length < 2) return;
    let i = 0, timer;
    const speed = +root.dataset.speed || 6000, auto = root.dataset.autoplay === 'true' && !reducedMotion;
    const show = n => {
      i = (n + slides.length) % slides.length;
      track.style.transform = `translateX(${-i * 100}%)`;
      slides.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.inert = k !== i; });
      dots.forEach((d, k) => d.setAttribute('aria-current', k === i));
    };
    const play = () => { clearInterval(timer); if (auto) timer = setInterval(() => show(i + 1), speed); };
    $('[data-prev]', root)?.addEventListener('click', () => { show(i - 1); play(); });
    $('[data-next]', root)?.addEventListener('click', () => { show(i + 1); play(); });
    dots.forEach(d => d.addEventListener('click', () => { show(+d.dataset.dot); play(); }));
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', () => clearInterval(timer));
    let x0 = null;
    root.addEventListener('pointerdown', e => { x0 = e.clientX; });
    root.addEventListener('pointerup', e => {
      if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { show(i + (dx < 0 ? 1 : -1)); play(); }
    });
    show(0); play();
  }

  /* ---------- announcement rotation ---------- */
  function initAnnouncement(root) {
    const slides = $$('.announce-slide', root); if (slides.length < 2 || reducedMotion) return;
    let i = 0;
    setInterval(() => { slides[i].classList.remove('is-active'); i = (i + 1) % slides.length; slides[i].classList.add('is-active'); }, +root.dataset.interval || 5000);
  }

  /* ---------- predictive search ---------- */
  function initSearch() {
    const panel = document.getElementById('SearchPanel'); if (!panel) return;
    const input = $('[data-predictive-input]', panel), results = $('[data-predictive-results]', panel);
    const toggle = show => {
      panel.hidden = !show;
      $$('[data-search-toggle][aria-controls]').forEach(b => b.setAttribute('aria-expanded', show));
      if (show) input?.focus();
    };
    document.addEventListener('click', e => {
      if (e.target.closest('[data-search-toggle]')) { toggle(panel.hidden); return; }
      if (!panel.hidden && !e.target.closest('#SearchPanel')) toggle(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
    if (!input || !input.hasAttribute('data-predictive')) return;
    let controller;
    input.addEventListener('input', debounce(async () => {
      const q = input.value.trim();
      if (!q) { results.innerHTML = ''; return; }
      controller?.abort(); controller = new AbortController();
      try {
        const url = `${T.routes.predictiveSearch}?q=${encodeURIComponent(q)}&resources[type]=product,collection&resources[limit]=6&section_id=predictive-search`;
        const html = await (await fetch(url, { signal: controller.signal })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        results.innerHTML = doc.querySelector('.shopify-section, [id^="shopify-section"]')?.innerHTML || html;
      } catch (err) { if (err.name !== 'AbortError') results.innerHTML = ''; }
    }, 200));
  }

  /* ---------- filters & sorting ---------- */
  function initFacets() {
    const go = form => {
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) if (v !== '') params.append(k, v);
      const sort = document.querySelector(`[data-sort][form="${form.id}"]`);
      if (sort && !params.has('sort_by')) params.set('sort_by', sort.value);
      location.search = params.toString();
    };
    $$('[data-facets-form]').forEach(form => {
      form.addEventListener('change', debounce(() => go(form), 500));
      form.addEventListener('submit', e => { e.preventDefault(); go(form); });
    });
    $$('[data-sort]').forEach(sel => sel.addEventListener('change', () => {
      const form = sel.form || (sel.getAttribute('form') && document.getElementById(sel.getAttribute('form')));
      if (form && form.matches('[data-facets-form]')) return go(form);
      const params = new URLSearchParams(location.search); params.set('sort_by', sel.value); params.delete('page');
      location.search = params.toString();
    }));
  }

  /* ---------- recommendations & recently viewed ---------- */
  async function initRecommendations(root) {
    if (root.querySelector('[data-recommendations-inner]')) return;
    try {
      const html = await (await fetch(root.dataset.url)).text();
      const inner = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-recommendations-inner]');
      if (inner) root.append(inner);
    } catch { /* recommendations are optional */ }
  }
  async function initRecent(root) {
    const current = root.dataset.current, limit = +root.dataset.limit || 8;
    const handles = store.get('recent', []).filter(h => h && h !== current).slice(0, limit);
    if (!handles.length) return;
    const track = $('[data-recent-track]', root);
    const cards = await Promise.all(handles.map(async h => {
      try {
        const res = await fetch(`${T.routes.root}products/${encodeURIComponent(h)}?section_id=product-card-render`);
        if (!res.ok) return '';
        return new DOMParser().parseFromString(await res.text(), 'text/html').querySelector('.card')?.outerHTML || '';
      } catch { return ''; }
    }));
    track.innerHTML = cards.join('');
    root.hidden = !track.children.length;
  }

  /* ---------- customer addresses ---------- */
  function initAddresses() {
    if (!document.querySelector('[data-country-select]') || initAddresses.done) return;
    if (!window.Shopify || !Shopify.CountryProvinceSelector) { window.addEventListener('load', initAddresses, { once: true }); return; }
    initAddresses.done = true;
    $$('[data-country-select]').forEach(sel => {
      const key = sel.dataset.countrySelect;
      new Shopify.CountryProvinceSelector(`AddressCountry_${key}`, `AddressProvince_${key}`, { hideElement: `AddressProvinceContainer_${key}` });
    });
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', e => {
    const g = s => e.target.closest(s);
    let el;
    if ((el = g('[data-open]'))) { if (open(el.dataset.open)) { e.preventDefault(); if (el.dataset.open === 'CartDrawer') refreshDrawer(); } return; }
    if (g('[data-close]') || e.target.matches('[data-scrim]')) { close(); return; }
    if ((el = g('[data-cart-drawer] [data-line]'))) { changeLine(+el.dataset.line, +el.dataset.qty); return; }
    if (g('[data-whatsapp-cart]')) { whatsappCart(); return; }
    if ((el = g('[data-copy]'))) {
      navigator.clipboard?.writeText(el.dataset.copy).catch(() => {});
      toast(el.dataset.copyMessage || T.strings.copied); return;
    }
    if ((el = g('[data-qty-step]'))) {
      const input = $('input', el.closest('[data-qty]')); if (!input) return;
      const min = input.min === '' ? 1 : +input.min;
      input.value = Math.max(min, (+input.value || 0) + +el.dataset.qtyStep);
      input.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if ((el = g('[data-rail]'))) {
      const rail = $('[data-rail-track]', el.closest('[data-carousel]')); if (!rail) return;
      rail.scrollBy({ left: +el.dataset.rail * (isRTL() ? -1 : 1) * rail.clientWidth * .85, behavior: reducedMotion ? 'auto' : 'smooth' }); return;
    }
    if ((el = g('[data-tab]'))) {
      const root = el.closest('[data-tabs]');
      $$('[data-tab]', root).forEach(t => t.setAttribute('aria-selected', t === el));
      $$('.tab-panel', root).forEach(p => { p.hidden = p.id !== el.getAttribute('aria-controls'); });
    }
  });
  document.addEventListener('submit', e => {
    const form = e.target;
    if (form.matches('[data-product-form]')) { e.preventDefault(); addToCart(form, e.submitter || $('[type="submit"]', form)); return; }
    if (form.dataset.confirm && !confirm(form.dataset.confirm)) e.preventDefault();
  });
  document.addEventListener('input', e => { if (e.target.matches('[data-cart-note]')) saveNote(e.target.value); });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-autosubmit]')) { const f = e.target.form; clearTimeout(f._t); f._t = setTimeout(() => f.submit(), 500); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // keep the drawer in sync when the theme editor re-renders it
  document.addEventListener('shopify:section:load', e => {
    if (e.target.querySelector('[data-slideshow]')) initSlideshow(e.target.querySelector('[data-slideshow]'));
    if (e.target.querySelector('[data-announce]')) initAnnouncement(e.target.querySelector('[data-announce]'));
    if (e.target.querySelector('[data-product]')) initProduct(e.target.querySelector('[data-product]'));
  });

  function init() {
    $$('[data-slideshow]').forEach(initSlideshow);
    $$('[data-announce]').forEach(initAnnouncement);
    $$('[data-product]').forEach(initProduct);
    $$('[data-recommendations]').forEach(initRecommendations);
    $$('[data-recently-viewed]').forEach(initRecent);
    initSearch(); initFacets(); initAddresses();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
