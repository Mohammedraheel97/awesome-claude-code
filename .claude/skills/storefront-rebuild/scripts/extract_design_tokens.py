#!/usr/bin/env python3
"""Summarise a reference site's design tokens: CSS custom properties, most used colours, fonts and radii.

    python3 -I extract_design_tokens.py <url-or-html-file> [--max-css 12] [--json out.json]

Only parses text; nothing downloaded is executed. Looks at inline <style>, style="" attributes and up to
--max-css linked stylesheets. Output is a readable report (and optionally JSON) to pick a palette and type scale from.
"""
import argparse
import collections
import json
import re
import sys
import urllib.parse
import urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (design-token-extractor)'}


def fetch(url, limit=3_000_000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read(limit).decode('utf-8', 'replace')


def norm_color(c):
    c = c.strip().lower()
    m = re.fullmatch(r'#([0-9a-f]{3})', c)
    if m:
        return '#' + ''.join(ch * 2 for ch in m.group(1))
    m = re.fullmatch(r'rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)', c)
    if m:
        r, g, b = (int(x) for x in m.groups()[:3])
        return '#%02x%02x%02x' % (r, g, b)
    return c


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('source')
    ap.add_argument('--max-css', type=int, default=12)
    ap.add_argument('--json')
    a = ap.parse_args()

    is_url = a.source.startswith(('http://', 'https://'))
    html = fetch(a.source) if is_url else open(a.source, encoding='utf-8', errors='replace').read()
    css_chunks = re.findall(r'<style[^>]*>(.*?)</style>', html, re.S | re.I)
    css_chunks += re.findall(r'style="([^"]+)"', html)
    links = re.findall(r'<link[^>]+rel=["\']?stylesheet[^>]*>', html, re.I)
    hrefs = []
    for tag in links:
        m = re.search(r'href=["\']([^"\']+)', tag)
        if m:
            hrefs.append(m.group(1))
    hrefs += re.findall(r'<link[^>]+href=["\']([^"\']+\.css[^"\']*)["\'][^>]*as=["\']style', html, re.I)
    font_links = [h for h in re.findall(r'href=["\']([^"\']+)', html) if 'fonts.googleapis' in h or '/fonts/' in h]
    if is_url:
        for href in list(dict.fromkeys(hrefs))[: a.max_css]:
            full = urllib.parse.urljoin(a.source, href)
            if 'fonts.googleapis' in full:
                continue
            try:
                css_chunks.append(fetch(full))
            except Exception as e:  # keep going on a bad stylesheet
                print(f'  ! could not fetch {full}: {e}', file=sys.stderr)
    css = '\n'.join(css_chunks)

    variables = collections.OrderedDict()
    for name, value in re.findall(r'(--[\w-]+)\s*:\s*([^;}{]+)', css):
        value = value.strip()
        if any(k in name for k in ('color', 'colour', 'font', 'radius', 'button', 'background', 'foreground', 'accent', 'primary', 'border', 'page-width', 'spacing')):
            variables.setdefault(name, collections.Counter())[value] += 1
    colors = collections.Counter(norm_color(c) for c in re.findall(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)', css))
    families = collections.Counter(f.strip().strip('"\'') for decl in re.findall(r'font-family\s*:\s*([^;}{]+)', css) for f in decl.split(',')[:1])
    radii = collections.Counter(v.strip() for v in re.findall(r'border-radius\s*:\s*([^;}{]+)', css))

    report = {
        'source': a.source,
        'stylesheets': hrefs[: a.max_css],
        'font_links': font_links,
        'variables': {k: v.most_common(3) for k, v in variables.items()},
        'top_colors': colors.most_common(25),
        'font_families': families.most_common(12),
        'border_radii': radii.most_common(10),
        'meta': {
            'lang': (re.search(r'<html[^>]*lang=["\']?([\w-]+)', html, re.I) or [None, None])[1],
            'dir': (re.search(r'<html[^>]*dir=["\']?(\w+)', html, re.I) or [None, None])[1],
            'title': (re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I) or [None, ''])[1].strip(),
        },
    }
    print(f"# Design tokens for {a.source}\n")
    print('lang/dir/title:', report['meta'])
    print('\n## CSS variables (colour, font, radius, spacing)')
    for k, v in report['variables'].items():
        print(f'  {k}: ' + ' | '.join(f'{val} (x{n})' for val, n in v))
    print('\n## Most used colours')
    print('  ' + ', '.join(f'{c} x{n}' for c, n in report['top_colors']))
    print('\n## Fonts')
    print('  ' + ', '.join(f'{f} x{n}' for f, n in report['font_families']))
    for f in font_links:
        print('  link:', f)
    print('\n## Border radii')
    print('  ' + ', '.join(f'{r} x{n}' for r, n in report['border_radii']))
    if a.json:
        json.dump(report, open(a.json, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
