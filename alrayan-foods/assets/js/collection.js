/* Collection page (/collections/<slug>/ and /collections/all/): sub-category chips, search, sort, paging.
   Filter state lives in the query string (?sub=&q=&sort=) so filtered views can be shared. */
(() => {
  'use strict';
  const { S, CATS, PRODUCTS, catBySlug, $, esc, t, dict, cname, pick, asset, collectionUrl, itemsOf, matches, cardHTML } = window.AR;

  Object.assign(dict.ar, {
    categories: 'الأقسام', filterPh: 'ابحث في هذا القسم', sortBy: 'ترتيب حسب', sortDefault: 'المميز', sortPriceAsc: 'السعر: من الأقل',
    sortPriceDesc: 'السعر: من الأعلى', sortName: 'الاسم', showMore: 'عرض المزيد', noResults: 'لا توجد منتجات مطابقة.',
    showing: (a, b) => `عرض ${a} من ${b}`, searchFor: q => `نتائج البحث عن «${q}»`
  });
  Object.assign(dict.en, {
    categories: 'Categories', filterPh: 'Search this collection', sortBy: 'Sort by', sortDefault: 'Featured', sortPriceAsc: 'Price: low to high',
    sortPriceDesc: 'Price: high to low', sortName: 'Name', showMore: 'Show more', noResults: 'No matching products.',
    showing: (a, b) => `Showing ${a} of ${b}`, searchFor: q => `Search results for “${q}”`
  });

  const PAGE = 24;
  const slug = document.body.dataset.collection;
  const cat = slug === 'all' ? null : catBySlug.get(slug);
  const params = new URLSearchParams(location.search);
  const state = { sub: +params.get('sub') || 0, q: params.get('q') || '', sort: params.get('sort') || 'default', limit: PAGE };
  if (cat && !cat.subs.some(s => s.id === state.sub)) state.sub = 0;
  $('#filterQ').value = state.q;
  $('#sortSel').value = ['default', 'price-asc', 'price-desc', 'name'].includes(state.sort) ? state.sort : 'default';

  function list() {
    let items = cat ? itemsOf(cat) : PRODUCTS.slice();
    if (state.sub) items = items.filter(p => p.sub === state.sub);
    if (state.q.trim()) items = items.filter(p => matches(p, state.q));
    const by = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => window.AR.pname(a).localeCompare(window.AR.pname(b), window.AR.lang) }[state.sort];
    return by ? items.sort(by) : items;
  }
  function syncUrl() {
    const p = new URLSearchParams();
    if (state.sub) p.set('sub', state.sub);
    if (state.q.trim()) p.set('q', state.q.trim());
    if (state.sort !== 'default') p.set('sort', state.sort);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }
  function renderGrid() {
    const items = list();
    $('#grid').innerHTML = items.slice(0, state.limit).map(cardHTML).join('');
    $('#moreBtn').hidden = items.length <= state.limit;
    $('#empty').hidden = items.length > 0;
    $('#resultCount').textContent = items.length ? t('showing', Math.min(state.limit, items.length), items.length) : '';
    syncUrl();
  }
  function render() {
    const title = cat ? cname(cat) : t('allProducts');
    const total = cat ? itemsOf(cat).length : PRODUCTS.length;
    document.title = `${title} | ${t('brandName')}`;
    $('#collTitle').textContent = !cat && state.q.trim() ? t('searchFor', state.q.trim()) : title;
    $('#collCount').textContent = t('products', total);
    $('#crumbs').innerHTML = `<a href="/">${t('home')}</a><span aria-hidden="true">/</span><a href="/collections/">${t('allCollections')}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(title)}</span>`;
    $('#pageHero').style.setProperty('--hero-img', `url('${asset(cat && cat.img ? cat.img : S.banners[2])}')`);
    $('#sideNav').innerHTML = `<a href="/collections/all/"${cat ? '' : ' aria-current="page"'}><span>${t('allProducts')}</span><small>${PRODUCTS.length}</small></a>` +
      CATS.filter(c => c.n).map(c => `<a href="${collectionUrl(c)}"${c === cat ? ' aria-current="page"' : ''}><span class="side-cat"><img src="${asset(c.img)}" alt="" width="28" height="28" loading="lazy">${esc(cname(c))}</span><small>${c.n}</small></a>`).join('');
    const chips = $('#subChips');
    chips.hidden = !(cat && cat.subs.length);
    if (!chips.hidden) {
      chips.innerHTML = [`<button type="button" class="chip" data-sub="0" aria-pressed="${!state.sub}">${t('all')}</button>`]
        .concat(cat.subs.map(s => `<button type="button" class="chip" data-sub="${s.id}" aria-pressed="${state.sub === s.id}">${esc(pick(s))}</button>`)).join('');
    }
    renderGrid();
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-sub]');
    if (c) { state.sub = +c.dataset.sub; state.limit = PAGE; render(); }
  });
  let qTimer;
  $('#filterQ').oninput = e => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value; state.limit = PAGE; render(); }, 180); };
  $('#sortSel').onchange = e => { state.sort = e.target.value; renderGrid(); };
  $('#moreBtn').onclick = () => { state.limit += PAGE; renderGrid(); };

  window.AR.page(render);
})();
