#!/usr/bin/env python3
"""Download images listed in a manifest and store them as resized WebP files.

    python3 -I fetch_images.py manifest.json --root <site-dir> [--workers 12] [--quality 82]

manifest.json: [{"url": "https://…/x.jpg", "path": "assets/img/products/p66", "max_width": 640}, …]
"path" is relative to --root and gets a .webp extension. Existing files are skipped, so re-runs are cheap.
Prints a JSON summary: {"ok": [...paths], "failed": [{"url", "error"}]}. Needs Pillow.
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
import urllib.request

from PIL import Image

UA = {'User-Agent': 'Mozilla/5.0 (image-fetcher)'}


def one(item, root, quality):
    out = os.path.join(root, item['path'] + '.webp')
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return item['path'] + '.webp', None
    try:
        req = urllib.request.Request(item['url'], headers=UA)
        data = urllib.request.urlopen(req, timeout=60).read()
        im = Image.open(io.BytesIO(data))
        im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') else im.convert('RGB')
        mw = int(item.get('max_width') or 1600)
        if im.width > mw:
            im = im.resize((mw, round(im.height * mw / im.width)), Image.LANCZOS)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, 'WEBP', quality=quality, method=6)
        return item['path'] + '.webp', None
    except Exception as e:  # report and continue
        return None, {'url': item['url'], 'error': str(e)}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('manifest')
    ap.add_argument('--root', required=True)
    ap.add_argument('--workers', type=int, default=12)
    ap.add_argument('--quality', type=int, default=82)
    a = ap.parse_args()
    items = json.load(open(a.manifest))
    ok, failed = [], []
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for path, err in ex.map(lambda it: one(it, a.root, a.quality), items):
            (ok.append(path) if path else failed.append(err))
    print(json.dumps({'ok': len(ok), 'failed': failed}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
