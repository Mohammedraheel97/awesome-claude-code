/* All-collections page: one card per category with its sub-categories. */
(() => {
  'use strict';
  const { CATS, PRODUCTS, $, esc, t, dict, cname, pick, asset, collectionUrl } = window.AR;

  Object.assign(dict.ar, { collectionsLead: 'تصفح أقسام الريان: القهوة، المكسرات، البهارات، الحلويات، المونة وأكثر.', shopCollection: 'تسوق القسم' });
  Object.assign(dict.en, { collectionsLead: 'Browse Alrayan’s collections: coffee, nuts, spices, sweets, mouneh and more.', shopCollection: 'Shop collection' });

  function render() {
    document.title = `${t('allCollections')} | ${t('brandName')}`;
    const card = c => `<a class="coll-card" href="${collectionUrl(c)}">
        <span class="coll-media"><img src="${asset(c.img)}" alt="" loading="lazy" width="400" height="300"></span>
        <span class="coll-body"><strong>${esc(cname(c))}</strong><small>${t('products', c.n)}</small>
        ${c.subs.length ? `<span class="coll-subs">${c.subs.map(s => `<span>${esc(pick(s))}</span>`).join('')}</span>` : ''}
        <span class="coll-cta">${t('shopCollection')} ${document.documentElement.dir === 'rtl' ? '←' : '→'}</span></span></a>`;
    $('#collGrid').innerHTML = `<a class="coll-card coll-all" href="/collections/all/"><span class="coll-body"><strong>${t('allProducts')}</strong><small>${t('products', PRODUCTS.length)}</small><span class="coll-cta">${t('viewAll')} ${document.documentElement.dir === 'rtl' ? '←' : '→'}</span></span></a>`
      + CATS.filter(c => c.n).map(card).join('');
  }
  window.AR.page(render);
})();
