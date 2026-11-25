#!/usr/bin/env python3
"""Generates the starter plants (info.txt + 16x16 SVG sprites) and img/kochu.svg.
Run from anywhere: python3 tools/gen_sprites.py"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOIL, SOIL2 = '#6b4423', '#4e3118'


def p(c, x, y, col):
    if 0 <= x < 16 and 0 <= y < 16:
        c[(x, y)] = col


def line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        p(c, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)


def disc(c, cx, cy, r, col):
    for y in range(16):
        for x in range(16):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5:
                p(c, x, y, col)


def svg(c):
    out = []
    for y in range(16):
        x = 0
        while x < 16:
            col = c.get((x, y))
            if col is None:
                x += 1
                continue
            x2 = x
            while x2 + 1 < 16 and c.get((x2 + 1, y)) == col:
                x2 += 1
            out.append(f'<rect x="{x}" y="{y}" width="{x2 - x + 1}" height="1" fill="{col}"/>')
            x = x2 + 1
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" '
            'shape-rendering="crispEdges">' + ''.join(out) + '</svg>')


def mound(c):
    for x in range(5, 11): p(c, x, 14, SOIL)
    for x in range(6, 10): p(c, x, 13, SOIL)
    for x in range(4, 12): p(c, x, 15, SOIL2)


def seed_stage(i):
    c = {}
    mound(c)
    if i == 0:
        for x in (7, 8): p(c, x, 12, '#e8d9a0')
        p(c, 8, 13, '#c9b878')
    else:
        h = 2 + i * 2
        line(c, 8, 13, 8, 13 - h, '#5aa13a')
        for s in (-1, 1):
            p(c, 8 + s, 13 - h, '#7fd05a')
            p(c, 8 + 2 * s, 13 - h - 1, '#7fd05a')
        if i == 2: p(c, 8, 13 - h - 1, '#a5e67a')
    return c


def root(c, t, pr):
    mound(c)
    L = 2 + round(t * 7)
    sp = 1 + round(t * 3)
    tips = [(8 - sp, 12 - L + 1), (8 - sp // 2, 12 - L), (8 + sp // 2, 12 - L), (8 + sp, 12 - L + 1)]
    for k, (x, y) in enumerate(tips):
        line(c, 8, 12, x, y, pr['leaf'] if k % 2 else pr['leaf2'])
    if t >= 1:
        for x in range(6, 11): p(c, x, 13, pr['root'])
        for x in range(7, 10): p(c, x, 14, pr['root'])
        p(c, 8, 15, pr['tip'])
        p(c, 7, 13, pr['tip']) if pr.get('shine') else None


def head(c, t, pr):
    r = 1 + round(t * 5)
    cy = 15 - r
    disc(c, 8, cy, r, pr['dark'])
    if r > 1: disc(c, 8, cy, r - 1, pr['main'])
    if r > 2: disc(c, 7, cy - 1, max(1, r - 3), pr['light'])
    if r > 3: line(c, 8, cy + r - 1, 8, cy + 1, pr['dark'])


def vine(c, t, pr):
    for x in range(2, 14): p(c, x, 14, '#3f7d2a')
    r2 = 1 + round(t * 1.5)
    disc(c, 4, 13, r2, pr['leaf']); disc(c, 12, 13, r2, pr['leaf'])
    p(c, 4, 13, pr['leaf2']); p(c, 12, 13, pr['leaf2'])
    if t >= 0.5:
        r = 1 + round((t - 0.25) * 5.3)
        cy = 15 - r
        col, dk = (pr['main'], pr['dark']) if t >= 1 else (pr['unripe'], '#6f8f2f')
        disc(c, 8, cy, r, dk)
        disc(c, 8, cy, r - 1, col)
        if r > 2: line(c, 8, cy - r + 1, 8, cy + r - 1, dk)
        p(c, 8, cy - r - 1, '#4a7c2c'); p(c, 8, cy - r, '#4a7c2c')


def bush(c, t, pr):
    h = 2 + round(t * (pr['h'] - 2))
    line(c, 8, 14, 8, 14 - h, '#4a7c2c')
    for k in range(2, h + 1, 2):
        for s in (-1, 1):
            p(c, 8 + s, 14 - k, pr['leaf'])
            p(c, 8 + 2 * s, 14 - k - 1, pr['leaf2'])
    p(c, 7, 14 - h, pr['leaf']); p(c, 9, 14 - h, pr['leaf']); p(c, 8, 14 - h - 1, pr['leaf2'])
    for x in range(5, 11): p(c, x, 15, SOIL2)
    if t >= 0.6:
        col = pr['ripe'] if t >= 1 else pr['unripe']
        for k in range(pr['n']):
            x = 4 if k % 2 == 0 else 10
            y = min(12, 14 - h + 2 + (k // 2) * 2)
            if pr['shape'] == 'round':
                for dx in (0, 1):
                    for dy in (0, 1): p(c, x + dx, y + dy, col)
                if t >= 1: p(c, x, y, '#ffffff55'.replace('55', '')) if False else None
                p(c, x, y - 1, '#3f7d2a')
            elif pr['shape'] == 'long':
                for dy in (0, 1, 2): p(c, x + 1, y + dy, col)
                p(c, x + 1, y - 1, '#3f7d2a')
            else:
                p(c, x, y, col); p(c, x + 1, y, col)


def tall(c, t, pr):
    h = 3 + round(t * 10)
    line(c, 8, 14, 8, 14 - h, '#6aa84f')
    for k in range(3, h, 3):
        line(c, 8, 14 - k, 4, 14 - k - 2, pr['leaf'])
        line(c, 8, 14 - k - 1, 12, 14 - k - 3, pr['leaf2'])
    for x in range(5, 12): p(c, x, 15, SOIL2)
    if t >= 1:
        for y in range(7, 11):
            p(c, 10, y, '#ffd23f'); p(c, 11, y, '#f2b705')
        p(c, 10, 11, pr['leaf']); p(c, 11, 11, pr['leaf']); p(c, 11, 6, pr['leaf2']); p(c, 10, 6, pr['leaf2'])
        for y in range(5, 9):
            p(c, 5, y, '#ffd23f'); p(c, 6, y, '#f2b705')
        p(c, 5, 9, pr['leaf']); p(c, 6, 9, pr['leaf'])
        line(c, 8, 14 - h, 6, 14 - h - 1, '#d9c27a'); line(c, 8, 14 - h, 10, 14 - h - 1, '#d9c27a')


KINDS = dict(root=root, head=head, vine=vine, bush=bush, tall=tall)

# name: (type, kind, art params, np, info)
PLANTS = {
    'Carrot': ('sh', 'root', dict(leaf='#4caf50', leaf2='#2e8b3a', root='#f28c1f', tip='#d9720f'), 4,
               dict(seedprice=4, stock=95, avgstock=12, price=14, mweight=0.2, maweight=0.6, sgrowth=8, pgrowth=16,
                    description='**Carrot** - a crunchy orange root. Quick, cheap and a perfect first crop for any *downtown* gardener.')),
    'Radish': ('sh', 'root', dict(leaf='#58b858', leaf2='#2f8f4a', root='#e0344f', tip='#f5f0f0'), 4,
               dict(seedprice=3, stock=90, avgstock=12, price=16, mweight=0.1, maweight=0.35, sgrowth=6, pgrowth=12,
                    description='**Radish** - peppery, round and *very* fast. Ready before the watering can dries.')),
    'Lettuce': ('sh', 'head', dict(main='#8fdc5a', dark='#4fa83a', light='#c4f28f'), 4,
                dict(seedprice=8, stock=80, avgstock=10, price=18, mweight=0.3, maweight=0.8, sgrowth=12, pgrowth=25,
                     description='**Lettuce** - a soft, leafy head that loves cool, damp soil.')),
    'Cabbage': ('sh', 'head', dict(main='#6fbf73', dark='#2f7d4a', light='#b8e6b0'), 4,
                dict(seedprice=20, stock=60, avgstock=8, price=14, mweight=1.0, maweight=2.5, sgrowth=20, pgrowth=45,
                     description='**Cabbage** - a heavy, tightly wrapped head. Slow, but it pays by the kilo.')),
    'Pumpkin': ('sh', 'vine', dict(main='#f08a24', dark='#c9661a', unripe='#9bbf4a', leaf='#3f9a36', leaf2='#2c7a2a'), 5,
                dict(seedprice=60, stock=35, avgstock=5, price=20, mweight=4, maweight=9, sgrowth=40, pgrowth=90,
                     description='**Pumpkin** - the giant of the garden. Needs lots of water and patience, rewards you with a *huge* harvest.')),
    'Tomato': ('mh', 'bush', dict(h=12, n=4, shape='round', ripe='#e8321f', unripe='#8bc34a', leaf='#4caf50', leaf2='#2e8b3a'), 4,
               dict(seedprice=30, stock=70, avgstock=8, price=12, mweight=0.4, maweight=1.2, sgrowth=25, pgrowth=30,
                    description='**Tomato** - a vine that keeps giving. Harvest it and it starts fruiting again.')),
    'Strawberry': ('mh', 'bush', dict(h=6, n=4, shape='round', ripe='#ff3b5c', unripe='#a5d46a', leaf='#58b858', leaf2='#2f8f4a'), 4,
                   dict(seedprice=45, stock=55, avgstock=7, price=40, mweight=0.1, maweight=0.3, sgrowth=25, pgrowth=25,
                        description='**Strawberry** - tiny, sweet, and pricey per kilo. A low bush that fruits again and again.')),
    'Pepper': ('mh', 'bush', dict(h=10, n=4, shape='long', ripe='#ffc531', unripe='#8bc34a', leaf='#43a047', leaf2='#2e7d32'), 4,
               dict(seedprice=70, stock=45, avgstock=6, price=25, mweight=0.3, maweight=0.9, sgrowth=35, pgrowth=40,
                    description='**Bell Pepper** - glossy golden peppers on a sturdy plant. Multi-harvest.')),
    'Blueberry': ('mh', 'bush', dict(h=9, n=6, shape='dot', ripe='#3f51d9', unripe='#9bbf4a', leaf='#3e9b5a', leaf2='#2a7a44'), 4,
                  dict(seedprice=120, stock=30, avgstock=4, price=55, mweight=0.2, maweight=0.6, sgrowth=60, pgrowth=50,
                       description='**Blueberry** - a rare shrub covered in deep blue berries. Slow to start, rich forever after.')),
    'Corn': ('mh', 'tall', dict(leaf='#6bbf4a', leaf2='#3f9a36'), 5,
             dict(seedprice=200, stock=18, avgstock=3, price=15, mweight=1.5, maweight=4, sgrowth=60, pgrowth=70,
                  description='**Corn** - a tall golden stalk. Pick the cobs and it grows more. *Very* rare in the shop.')),
}

ORDER = ['seedprice', 'stock', 'avgstock', 'price', 'description', 'mweight', 'maweight', 'sgrowth', 'pgrowth']


def main():
    for name, (typ, kind, pr, npl, info) in PLANTS.items():
        d = os.path.join(ROOT, typ, name)
        os.makedirs(d, exist_ok=True)
        for i in range(3):
            open(os.path.join(d, f'ssprite{i + 1}.svg'), 'w').write(svg(seed_stage(i)))
        for i in range(npl):
            c = {}
            KINDS[kind](c, i / (npl - 1), pr)
            open(os.path.join(d, f'psprite{i + 1}.svg'), 'w').write(svg(c))
        with open(os.path.join(d, 'info.txt'), 'w') as f:
            for k in ORDER:
                f.write(f'{k} = {info[k]}\n')
    # Kochu coin
    c = {}
    disc(c, 7.5, 7.5, 7, '#b8860b')
    disc(c, 7.5, 7.5, 6, '#ffd23f')
    disc(c, 6.5, 6.5, 3, '#ffe784')
    line(c, 8, 12, 8, 4, '#3f9a36')
    for s in (-1, 1):
        line(c, 8, 9, 8 + 3 * s, 6, '#4caf50')
        line(c, 8, 7, 8 + 2 * s, 5, '#2e8b3a')
    os.makedirs(os.path.join(ROOT, 'img'), exist_ok=True)
    open(os.path.join(ROOT, 'img', 'kochu.svg'), 'w').write(svg(c))
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build_manifest.py')], check=True)


if __name__ == '__main__':
    main()
