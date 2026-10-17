# Choosing the look

The user usually names either a **reference site** ("use the theme of X") or a **brand source** ("use the colours
of our logo"). Often both: layout from the reference, colours from the logo. Ask which applies if unclear.

## From a reference site

1. Screenshot it full-page (`capture_network.js` writes `full.png`) and view it in 1400px slices — note section order,
   header layout, hero style, card style, button shape, footer.
2. Extract tokens: `python3 -I scripts/extract_design_tokens.py <url> --json tokens.json`
   Shopify themes expose `--color-*`, `--font-*--family`, `--style-border-radius-*` variables; their
   `color-scheme-N` blocks give background / foreground / button colours per section.
3. Map to the kit's variables in `assets/css/styles.css` (`:root`): `--bg`, `--bg-alt`, `--fg`, `--muted`, `--border`,
   `--line`, `--primary`, `--primary-hover`, `--dark`, `--dark-2`, `--r-btn`, `--r-md`, `--font-head`, `--font-body`.

Almoallem Mill example → `--bg #F5EDD6` (cream), `--fg #3B2314` (brown), `--primary #C0392B`, hover `#A02D23`,
Barlow Condensed headings + Inter body, 5px buttons, centred logo, full-bleed hero, white cards with full-width red
"add to cart", mosaic collection tiles, dark-brown footer with payment icons.

## From a logo

Sample the actual pixels rather than guessing:

```python
from PIL import Image; from collections import Counter
im = Image.open('logo.webp').convert('RGB')
print(Counter((r//4*4, g//4*4, b//4*4) for r, g, b in im.getdata()).most_common(8))
```

Ignore white/black/transparent. The store's own settings often carry the brand colour too (Alrayan's
`primary_color: #bd2932` matched the logo's `#BC2830`). Derive the rest from that one hue:

| Token | Rule | Alrayan |
| --- | --- | --- |
| primary | logo colour | `#BD2932` |
| primary-hover | ~15% darker | `#9A1F27` |
| bg | white tinted 3–4% with the hue | `#FFF6F5` |
| bg-alt / soft band | 10–12% tint | `#FBE4E3` |
| fg (text) | very dark shade of the hue (not pure black) | `#2B1012` |
| dark (footer) / dark-2 | deep shade / deeper | `#4A0F15` / `#36090E` |

Check contrast: white on primary and fg on bg should both pass WCAG AA (4.5:1 for body text).

## Arabic & RTL

- `<html lang="ar" dir="rtl">` by default for Arabic stores; English toggle switches to `ltr`. Use CSS logical
  properties (`inset-inline-start`, `margin-inline`, `padding-inline`) so one stylesheet serves both directions.
- Fonts: Cairo (headings) + Noto Sans Arabic (body) pair well with Barlow Condensed / Inter for Latin.
- Arrow glyphs (`‹ ›`, `←`) mirror in RTL — set `direction: ltr` on arrow buttons or flip SVGs with `scaleX(-1)` and
  decide per direction which way "next" points.
- A short English label in RTL renders "Need help?" as "?Need help" — prefer translated labels.
