#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一年级练习 App · 自制 SVG 配图生成器

用途：程序化生成看图题所需的素材（钟面 / 立体图形 / 数数点阵 / 图形规律）。
      全部为本地生成的矢量图，不含任何教材扫描件，无版权风险。

用法：python3 tools/make_svg.py
输出：assets/svg/*.svg
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'svg')

INK = '#37474f'      # 主线条
SOFT = '#90a4ae'     # 辅助线
ACCENT = '#ef6c00'   # 强调（时针/重点）
FILL_L = '#e3f2fd'   # 浅蓝填充
FILL_Y = '#fff8e1'   # 浅黄填充
FILL_G = '#e8f5e9'   # 浅绿填充


def wrap(inner, w=240, h=240):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
            'role="img">%s</svg>\n' % (w, h, w, h, inner))


def clock(hour):
    """钟面：分针指 12，时针指 hour（整时）。"""
    cx = cy = 120
    r = 108
    p = ['<circle cx="%d" cy="%d" r="%d" fill="#ffffff" stroke="%s" stroke-width="7"/>' % (cx, cy, r, INK)]
    for h in range(1, 13):
        a = math.radians(h * 30)
        p.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>'
                 % (cx + (r - 14) * math.sin(a), cy - (r - 14) * math.cos(a), SOFT))
        p.append('<text x="%.1f" y="%.1f" font-size="21" font-family="Helvetica,Arial,sans-serif" '
                 'font-weight="bold" fill="%s" text-anchor="middle" dominant-baseline="central">%d</text>'
                 % (cx + (r - 38) * math.sin(a), cy - (r - 38) * math.cos(a), INK, h))
    # 分针（固定指 12）
    p.append('<line x1="%d" y1="%d" x2="%d" y2="%.1f" stroke="%s" stroke-width="6" stroke-linecap="round"/>'
             % (cx, cy, cx, cy - (r - 26), INK))
    # 时针
    a = math.radians(hour % 12 * 30)
    p.append('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="11" stroke-linecap="round"/>'
             % (cx, cy, cx + (r - 62) * math.sin(a), cy - (r - 62) * math.cos(a), ACCENT))
    p.append('<circle cx="%d" cy="%d" r="7" fill="%s"/>' % (cx, cy, INK))
    return wrap(''.join(p))


def solid(kind):
    """立体图形：等轴测投影。kind in cube/cuboid/cylinder/sphere/prism。"""
    s = []
    if kind == 'cube':
        s.append('<polygon points="72,104 100,76 180,76 152,104" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_L, INK))
        s.append('<polygon points="152,104 180,76 180,156 152,184" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_Y, INK))
        s.append('<rect x="72" y="104" width="80" height="80" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_G, INK))
    elif kind == 'cuboid':
        s.append('<polygon points="52,110 86,78 206,78 172,110" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_L, INK))
        s.append('<polygon points="172,110 206,78 206,142 172,174" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_Y, INK))
        s.append('<rect x="52" y="110" width="120" height="64" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_G, INK))
    elif kind == 'cylinder':
        s.append('<path d="M62 76 L62 164 A58 20 0 0 0 178 164 L178 76 Z" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_G, INK))
        s.append('<ellipse cx="120" cy="76" rx="58" ry="20" fill="%s" stroke="%s" stroke-width="5"/>' % (FILL_L, INK))
    elif kind == 'sphere':
        s.append('<circle cx="120" cy="120" r="62" fill="%s" stroke="%s" stroke-width="5"/>' % (FILL_L, INK))
        s.append('<path d="M86 92 A40 40 0 0 1 118 76" fill="none" stroke="%s" stroke-width="7" stroke-linecap="round" opacity="0.75"/>' % SOFT)
    elif kind == 'prism':
        s.append('<polygon points="120,62 62,150 178,150" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (FILL_Y, INK))
        s.append('<polygon points="120,62 96,150 178,150 178,150" fill="none" stroke="%s" stroke-width="0"/>' % INK)
    return wrap(''.join(s))


def count(n):
    """数数点阵：n 个圆点（每行 5 个），用于「数一数有几个」。"""
    per, r, gap = 5, 17, 42
    rows = (n + per - 1) // per
    top = 120 - (rows - 1) * gap / 2
    s = []
    for i in range(n):
        col = i % per
        row = i // per
        in_row = min(per, n - row * per)
        x = 120 - (in_row - 1) * gap / 2 + col * gap
        y = top + row * gap
        s.append('<circle cx="%.1f" cy="%.1f" r="%d" fill="%s" stroke="%s" stroke-width="4"/>' % (x, y, r, FILL_L, INK))
    return wrap(''.join(s))


def pattern(kind):
    """图形规律：用于「接下来应该是什么」。末位留空问号。"""
    tri = lambda x, y: '<polygon points="%.0f,%.0f %.0f,%.0f %.0f,%.0f" fill="%s" stroke="%s" stroke-width="4" stroke-linejoin="round"/>' % (x, y - 18, x - 19, y + 15, x + 19, y + 15, FILL_Y, INK)
    cir = lambda x, y: '<circle cx="%.0f" cy="%.0f" r="18" fill="%s" stroke="%s" stroke-width="4"/>' % (x, y, FILL_L, INK)
    sqr = lambda x, y: '<rect x="%.0f" y="%.0f" width="34" height="34" rx="4" fill="%s" stroke="%s" stroke-width="4"/>' % (x - 17, y - 17, FILL_G, INK)
    q = lambda x, y: ('<circle cx="%.0f" cy="%.0f" r="22" fill="none" stroke="%s" stroke-width="4" stroke-dasharray="6 5"/>'
                      '<text x="%.0f" y="%.0f" font-size="26" font-weight="bold" fill="%s" text-anchor="middle" '
                      'dominant-baseline="central" font-family="Helvetica,Arial,sans-serif">?</text>') % (x, y, SOFT, x, y, SOFT)
    y = 120
    xs = [34, 94, 154, 214]
    s = []
    seq = {'p1': [tri, cir, tri, q], 'p2': [sqr, sqr, tri, q], 'p3': [cir, sqr, cir, q]}[kind]
    for f, x in zip(seq, xs):
        s.append(f(x, y))
    return wrap(''.join(s), 248, 240)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for h in range(1, 13):
        f = 'clock-%d.svg' % h
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(clock(h))
        made.append(f)
    for k in ('cube', 'cuboid', 'cylinder', 'sphere', 'prism'):
        f = 'solid-%s.svg' % k
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(solid(k))
        made.append(f)
    for n in range(1, 11):
        f = 'count-%d.svg' % n
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(count(n))
        made.append(f)
    for k in ('p1', 'p2', 'p3'):
        f = 'pattern-%s.svg' % k
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(pattern(k))
        made.append(f)
    print('生成 %d 个 SVG 到 %s' % (len(made), OUT))
    print('  ' + ', '.join(made))


if __name__ == '__main__':
    main()
