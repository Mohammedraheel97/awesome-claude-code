/* Home page: hero slider, category circles, product rails and the explore tabs. */
(() => {
  'use strict';
  const { S, CATS, PRODUCTS, catById, $, $$, esc, t, dict, cname, asset, collectionUrl, itemsOf, cardHTML, railHTML, discountPct } = window.AR;

  Object.assign(dict.ar, {
    heroLabel: 'عروض الريان', catEyebrow: 'تشكيلة واسعة', shopByCat: 'تسوق حسب القسم', perks: 'مزايا', featured: 'مختارات',
    u1t: 'محمصة ومطحنة', u1d: 'قهوة ومكسرات محمصة طازجة', u2t: 'طبيعي 100%', u2d: 'مربيات ومخللات بلا إضافات',
    u3t: 'توصيل أو استلام', u3d: 'في جميع مناطق الكويت', u4t: 'دفع آمن', u4d: 'كي نت، فيزا وماستر',
    newEyebrow: 'وصل حديثًا', p1e: 'تشكيلة جديدة', p1t: 'دراجيه الفواكه والشوكولاتة', p2e: 'من مطحنتنا', p2t: 'بهارات وأعشاب مطحونة بعناية', shopNow: 'تسوق الآن',
    exploreEyebrow: 'من منتجاتنا', exploreTitle: 'اكتشف تشكيلة الريان',
    coffeeEyebrow: 'من محمصتنا', coffeeTitle: 'قهوة محمصة طازجة بنكهة أصيلة', coffeeText: 'قهوة عربية وتركية بأوزان تناسبك، مع خيار الهيل — اختيارك الأول لأجود أنواع القهوة المحمصة.', shopCoffee: 'تسوق القهوة',
    offersEyebrow: 'لفترة محدودة', offersTitle: 'العروض والخصومات',
    whyEyebrow: 'لماذا الريان', whyTitle: 'جودة تستحق ثقتك',
    v1t: 'تحميص وطحن يومي', v1d: 'نحمّص القهوة والمكسرات ونطحن البهارات في محلنا لتصلك بأفضل نكهة.',
    v2t: 'نكهات الريان الفريدة', v2d: 'مكسرات بنكهات مميزة: مدخن، حامض، جبنة، ترافل، باربيكيو وأكثر.',
    v3t: 'من الشجر إلى الحجر', v3d: 'زيت زيتون وزيتون فاخر، ومربيات ومخللات طبيعية 100%.',
    v4t: 'كل ما يلزمك في مكان واحد', v4d: 'فواكه مجففة، حبوب وبقوليات، حلويات ومتة — أكثر من 200 منتج.',
    aboutEyebrow: 'من نحن', aboutTitle: 'مطحنة ومحمصة الريان', addr: 'العنوان', hours: 'ساعات العمل', call: 'اتصل بنا',
    directions: 'الاتجاهات على الخريطة', chatWa: 'راسلنا على واتساب', mapTitle: 'خريطة موقع الريان',
    followTitle: 'تابعونا', followText: 'جديد المنتجات والعروض أولًا بأول على حساباتنا.',
    heroes: [
      { e: 'المونة البيتية', h: 'من الشجر إلى الحجر', p: 'زيت الزيتون والزيتون الفاخر، والمربيات والمخللات الطبيعية 100%', b: 'تسوق المونة' },
      { e: 'مكسرات طازجة', h: 'مكسرات فاخرة بنكهات الريان', p: 'أجود أنواع المكسرات النية والمحمصة، وخلطات مميزة لكل المناسبات', b: 'تسوق المكسرات' },
      { e: 'من محمصتنا', h: 'كاجو بنكهات لا تُقاوم', p: 'كاجو محمّص بنكهات الجبنة والترافل والمدخن والباربيكيو وأكثر', b: 'تسوق الكاجو' }
    ]
  });
  Object.assign(dict.en, {
    heroLabel: 'Alrayan highlights', catEyebrow: 'Wide selection', shopByCat: 'Shop by category', perks: 'Perks', featured: 'Featured',
    u1t: 'Roastery & mill', u1d: 'Freshly roasted coffee & nuts', u2t: '100% natural', u2d: 'Jams & pickles, no additives',
    u3t: 'Delivery or pickup', u3d: 'Across Kuwait', u4t: 'Secure payment', u4d: 'KNET, Visa & Master',
    newEyebrow: 'Just landed', p1e: 'New collection', p1t: 'Fruit & chocolate dragées', p2e: 'From our mill', p2t: 'Carefully ground spices & herbs', shopNow: 'Shop now',
    exploreEyebrow: 'Our products', exploreTitle: 'Explore the Alrayan range',
    coffeeEyebrow: 'From our roastery', coffeeTitle: 'Freshly roasted coffee, authentic taste', coffeeText: 'Arabic and Turkish coffee in the weight you need, with or without cardamom — your first choice for the finest roasted coffee.', shopCoffee: 'Shop coffee',
    offersEyebrow: 'Limited time', offersTitle: 'Offers & deals',
    whyEyebrow: 'Why Alrayan', whyTitle: 'Quality you can trust',
    v1t: 'Roasted & ground in store', v1d: 'We roast coffee and nuts and grind spices in our shop so they reach you at their best.',
    v2t: 'Signature Alrayan flavours', v2d: 'Nuts in distinctive flavours: smoked, sour, cheese, truffle, BBQ and more.',
    v3t: 'From tree to table', v3d: 'Olive oil, premium olives, and 100% natural jams and pickles.',
    v4t: 'Everything in one place', v4d: 'Dried fruits, grains & legumes, sweets and mate — over 200 products.',
    aboutEyebrow: 'About us', aboutTitle: 'Alrayan Mills & Roastery', addr: 'Address', hours: 'Opening hours', call: 'Call us',
    directions: 'Get directions', chatWa: 'Chat on WhatsApp', mapTitle: 'Map of the Alrayan store',
    followTitle: 'Follow us', followText: 'New products and offers, first, on our accounts.',
    heroes: [
      { e: 'Mouneh pantry', h: 'From Tree to Table', p: 'Olive oil, premium olives, and 100% natural jams and pickles', b: 'Shop mouneh' },
      { e: 'Fresh nuts', h: 'Premium Nuts, Alrayan Flavours', p: 'The finest raw and roasted nuts, plus signature mixes for every occasion', b: 'Shop nuts' },
      { e: 'From our roastery', h: 'Irresistible Cashew Flavours', p: 'Roasted cashews in cheese, truffle, smoked, BBQ and more', b: 'Shop cashews' }
    ]
  });

  const HERO_LINKS = [collectionUrl(catById.get(72)), collectionUrl(catById.get(48)), collectionUrl(catById.get(51)) + '?sub=13'];
  const EXPLORE = [51, 12, 3, 36, 42, 24].filter(id => catById.has(id));
  let heroIdx = 0, heroTimer, tab = EXPLORE[0];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderHero() {
    const hs = t('heroes');
    $('#heroTrack').innerHTML = S.banners.map((src, i) => `<div class="hero-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${S.banners.length}">
      <img src="${asset(src)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
      <div class="wrap hero-copy"><span class="eyebrow light">${esc(hs[i].e)}</span><h1>${esc(hs[i].h)}</h1><p>${esc(hs[i].p)}</p>
        <div class="btn-row"><a class="btn btn-lg" href="${HERO_LINKS[i]}">${esc(hs[i].b)}</a><a class="btn btn-lg btn-ghost-light" href="/collections/">${esc(t('allCollections'))}</a></div></div></div>`).join('');
    $('#heroDots').innerHTML = S.banners.map((_, i) => `<button type="button" aria-label="${i + 1}" data-dot="${i}"><span></span></button>`).join('');
    showHero(heroIdx);
  }
  function showHero(i) {
    const n = S.banners.length; heroIdx = (i + n) % n;
    $('#heroTrack').style.transform = `translateX(${-heroIdx * 100}%)`;
    $$('.hero-slide').forEach((s, k) => { s.classList.toggle('active', k === heroIdx); s.inert = k !== heroIdx; });
    $$('#heroDots button').forEach((b, k) => b.setAttribute('aria-current', k === heroIdx));
  }
  function autoplay() {
    clearInterval(heroTimer);
    if (!reduced) heroTimer = setInterval(() => showHero(heroIdx + 1), 6500);
  }

  function render() {
    renderHero();
    $('#catCircles').innerHTML = CATS.filter(c => c.img).map(c => `<a class="circle" href="${collectionUrl(c)}"><span class="circle-img"><img src="${asset(c.img)}" alt="" loading="lazy" width="120" height="120"></span><span class="circle-name">${esc(cname(c))}</span></a>`).join('');
    $('#newRail').innerHTML = railHTML(itemsOf(catById.get(81)).slice(0, 12));
    const offers = [...new Set([...itemsOf(catById.get(69)), ...PRODUCTS.filter(discountPct)])];
    $('#offersRail').innerHTML = railHTML(offers.slice(0, 12));
    renderTabs();
    $('#aboutText').textContent = t('about');
    const social = [['Instagram', S.instagram, '@alrayan_roastery'], ['TikTok', S.tiktok, '@alrayan_roastery.kw'], ['Facebook', S.facebook, 'Alrayan']].filter(s => s[1]);
    $('#socialButtons').innerHTML = social.map(([n, u, h]) => `<a class="social-btn" href="${esc(u)}" target="_blank" rel="noopener"><strong>${n}</strong><span dir="ltr">${esc(h)}</span></a>`).join('');
  }
  function renderTabs() {
    $('#exploreTabs').innerHTML = EXPLORE.map(id => `<button type="button" role="tab" class="tab" data-tab="${id}" aria-selected="${id === tab}">${esc(cname(catById.get(id)))}</button>`).join('');
    const c = catById.get(tab);
    $('#exploreGrid').innerHTML = itemsOf(c).slice(0, 8).map(cardHTML).join('');
    const more = $('#exploreMore'); more.href = collectionUrl(c); more.textContent = `${t('viewAll')} — ${cname(c)}`;
  }

  document.addEventListener('click', e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = +tb.dataset.tab; renderTabs(); return; }
    const d = e.target.closest('[data-dot]'); if (d) { showHero(+d.dataset.dot); autoplay(); }
  });
  $('#heroPrev').onclick = () => { showHero(heroIdx - 1); autoplay(); };
  $('#heroNext').onclick = () => { showHero(heroIdx + 1); autoplay(); };
  const hero = $('#hero');
  hero.addEventListener('mouseenter', () => clearInterval(heroTimer));
  hero.addEventListener('mouseleave', autoplay);
  hero.addEventListener('focusin', () => clearInterval(heroTimer));
  let x0 = null;
  hero.addEventListener('pointerdown', e => { x0 = e.clientX; });
  hero.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { showHero(heroIdx + (dx < 0 ? 1 : -1)); autoplay(); }
  });

  window.AR.page(render);
  autoplay();
})();
