#!/usr/bin/env python3
"""Generate the static pages of the Alrayan Foods site from assets/data.js.

    python3 tools/build.py [--site-url https://alrayan-foods.vercel.app]

Writes index.html, 404.html, collections/**/index.html, products/**/index.html,
sitemap.xml and robots.txt. Page content is rendered in the browser by
assets/js/*.js; the generated HTML carries the layout, per-page SEO tags and
structured data. Slugs are added to data.js once and then kept stable.
"""
import argparse
import html
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / 'tools' / 'templates'
DATA = ROOT / 'assets' / 'data.js'
NAV_CATS = [81, 69, 51, 12, 3, 36]          # shown in the header navigation
FOOTER_CATS = [51, 48, 12, 3, 36, 42, 72]   # shown in the footer "Shop" column
BRAND = 'مطحنة ومحمصة الريان'
GLOBALS = ('SITE', 'CATS', 'PRODUCTS')


def load_data():
    text = DATA.read_text(encoding='utf-8')
    return [json.loads(re.search(r'window\.%s=(.*?);\n' % name, text, re.S).group(1)) for name in GLOBALS]


def save_data(*values):
    DATA.write_text(''.join('window.%s=%s;\n' % (n, json.dumps(v, ensure_ascii=False)) for n, v in zip(GLOBALS, values)), encoding='utf-8')


def slugify(text):
    text = text.lower().replace('é', 'e').replace('&', ' ')
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def assign_slugs(items, reserved=()):
    used = set(reserved) | {i['slug'] for i in items if i.get('slug')}
    for item in items:
        if item.get('slug'):
            continue
        base = slugify(item['en']) or 'item-%d' % item['id']
        slug, n = base, 2
        while slug in used:
            slug, n = '%s-%d' % (base, n), n + 1
        item['slug'] = slug
        used.add(slug)


def esc(value):
    return html.escape(str(value), quote=True)


def render(template, ctx):
    return re.sub(r'{{\s*(\w+)\s*}}', lambda m: ctx[m.group(1)], template)


def ld_json(obj):
    return '<script type="application/ld+json">%s</script>' % json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')


def clip(text, n=155):
    text = re.sub(r'\s+', ' ', text).strip()
    return text if len(text) <= n else text[:n - 1].rsplit(' ', 1)[0] + '…'


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--site-url', default='https://alrayan-foods.vercel.app')
    site_url = ap.parse_args().site_url.rstrip('/')

    site, cats, products = load_data()
    assign_slugs(cats, reserved={'all'})
    assign_slugs(products)
    save_data(site, cats, products)

    cat_by_id = {c['id']: c for c in cats}
    layout = (TEMPLATES / 'layout.html').read_text(encoding='utf-8')
    tpl = {n: (TEMPLATES / ('%s.html' % n)).read_text(encoding='utf-8') for n in ('home', 'collections', 'collection', 'product', '404')}

    def cat_url(c):
        return '/collections/%s/' % c['slug']

    def cat_link(cid):
        c = cat_by_id[cid]
        return '<a href="%s" data-cat-name="%d">%s</a>' % (cat_url(c), cid, esc(c['ar']))

    shared = {
        'nav': '\n        '.join(cat_link(i) for i in NAV_CATS),
        'footer_collections': '\n        '.join(cat_link(i) for i in FOOTER_CATS),
    }
    urls = []

    def write(rel_dir, page, body, *, title, description, og_image, og_type='website', head_extra='', body_attrs='',
              filename='index.html', script=True, index=True):
        path = ROOT / rel_dir / filename
        canonical = '%s/%s' % (site_url, rel_dir + '/' if rel_dir else '')
        doc = render(layout, dict(
            shared, title=esc(title), description=esc(description), canonical=esc(canonical),
            og_image=esc('%s/%s' % (site_url, og_image)), og_type=og_type, page=page, body=body,
            head_extra=head_extra, body_attrs=body_attrs,
            page_script='<script src="/assets/js/%s.js"></script>' % page if script else ''))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(doc, encoding='utf-8')
        if index:
            urls.append(canonical)

    for generated in ('collections', 'products'):
        shutil.rmtree(ROOT / generated, ignore_errors=True)

    # Home
    store_ld = {
        '@context': 'https://schema.org', '@type': 'GroceryStore', 'name': BRAND, 'alternateName': site['name_en'],
        'url': site_url + '/', 'logo': '%s/%s' % (site_url, site['logo']), 'image': '%s/%s' % (site_url, site['banners'][0]),
        'telephone': '+965' + site['phone'], 'priceRange': 'KWD',
        'address': {'@type': 'PostalAddress', 'streetAddress': site['address_en'], 'addressLocality': 'Hawally', 'addressCountry': 'KW'},
        'geo': {'@type': 'GeoCoordinates', 'latitude': site['lat'], 'longitude': site['lng']},
        'openingHoursSpecification': [
            {'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], 'opens': '10:30', 'closes': '23:59'},
            {'@type': 'OpeningHoursSpecification', 'dayOfWeek': 'Friday', 'opens': '13:30', 'closes': '23:59'}],
        'sameAs': [u for u in (site['instagram'], site['tiktok'], site['facebook']) if u],
    }
    write('', 'home', tpl['home'], title='%s | قهوة، مكسرات وبهارات في الكويت' % BRAND,
          description=clip(site['description']), og_image=site['banners'][1], head_extra=ld_json(store_ld))

    # All collections + "all products"
    write('collections', 'collections', tpl['collections'], title='جميع الأقسام | %s' % BRAND,
          description='تصفح جميع أقسام مطحنة ومحمصة الريان: القهوة، المكسرات المحمصة والنية، البهارات، الحلويات، المونة، الفواكه المجففة والمزيد.',
          og_image=site['banners'][1])
    write('collections/all', 'collection', render(tpl['collection'], {'name': 'جميع المنتجات', 'hero_img': '/' + site['banners'][2]}),
          title='جميع المنتجات | %s' % BRAND, description='تسوق جميع منتجات الريان (%d منتج) مع التوصيل في الكويت.' % len(products),
          og_image=site['banners'][2], body_attrs=' data-collection="all"')

    for c in cats:
        write('collections/' + c['slug'], 'collection', render(tpl['collection'], {'name': esc(c['ar']), 'hero_img': esc('/' + (c['img'] or site['banners'][2]))}),
              title='%s | %s' % (c['ar'], BRAND), description='تسوق %s من مطحنة ومحمصة الريان — %d منتج مع التوصيل أو الاستلام في الكويت.' % (c['ar'], c['n']),
              og_image=c['img'] or site['banners'][2], body_attrs=' data-collection="%s"' % esc(c['slug']))

    # Products
    for p in products:
        c = cat_by_id.get(p['cat']) or next(x for x in cats if p['id'] in x['items'])
        prices = sorted({round(p['price'] - sum(min(v['p'] for v in g['vals']) for g in p.get('opts', [])) + sum(v['p'] for v in combo), 3)
                         for combo in _combos(p.get('opts', []))}) if p.get('opts') else [p['price']]
        offer = {'@type': 'AggregateOffer', 'lowPrice': prices[0], 'highPrice': prices[-1], 'offerCount': len(prices)} if len(prices) > 1 else {'@type': 'Offer', 'price': prices[0]}
        offer.update(priceCurrency='KWD', availability='https://schema.org/%s' % ('InStock' if p['stock'] else 'OutOfStock'),
                     url='%s/products/%s/' % (site_url, p['slug']))
        product_ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['ar'], 'alternateName': p['en'], 'sku': str(p['id']),
                      'image': '%s/%s' % (site_url, p['img']), 'brand': {'@type': 'Brand', 'name': BRAND}, 'category': c['ar'], 'offers': offer}
        desc = p['dar'] or p['den']
        if desc:
            product_ld['description'] = clip(desc, 500)
        crumbs_ld = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'الرئيسية', 'item': site_url + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': c['ar'], 'item': site_url + cat_url(c)},
            {'@type': 'ListItem', 'position': 3, 'name': p['ar']}]}
        price_text = ('من %.3f' % prices[0] if len(prices) > 1 else '%.3f' % prices[0]) + ' د.ك'
        write('products/' + p['slug'], 'product',
              render(tpl['product'], {'name': esc(p['ar']), 'img': esc(p['img']), 'cat_url': cat_url(c), 'cat_name': esc(c['ar'])}),
              title='%s | %s' % (p['ar'], BRAND), og_type='product', og_image=p['img'],
              description=clip(desc) if desc else '%s — %s. %s، توصيل أو استلام في الكويت.' % (p['ar'], price_text, c['ar']),
              head_extra=ld_json(product_ld) + '\n  ' + ld_json(crumbs_ld), body_attrs=' data-product="%d"' % p['id'])

    write('', '404', tpl['404'], title='الصفحة غير موجودة | %s' % BRAND, description='الصفحة غير موجودة.',
          og_image=site['banners'][1], filename='404.html', script=False, index=False)

    (ROOT / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n'
        % ''.join('  <url><loc>%s</loc></url>\n' % esc(u) for u in urls), encoding='utf-8')
    (ROOT / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n' % site_url, encoding='utf-8')
    print('built %d pages (%d collections, %d products)' % (len(urls) + 1, len(cats) + 2, len(products)))


def _combos(groups):
    if not groups:
        yield []
        return
    for v in groups[0]['vals']:
        for rest in _combos(groups[1:]):
            yield [v] + rest


if __name__ == '__main__':
    main()
