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


def _shadow():
    return '<ellipse cx="120" cy="212" rx="70" ry="10" fill="#e0e6e9"/>'


def dog():
    """小狗（正面头像）"""
    p = [_shadow(),
         '<ellipse cx="74" cy="96" rx="20" ry="42" fill="#a9743f" transform="rotate(-18 74 96)"/>',
         '<ellipse cx="166" cy="96" rx="20" ry="42" fill="#a9743f" transform="rotate(18 166 96)"/>',
         '<circle cx="120" cy="118" r="62" fill="#d7a86e"/>',
         '<ellipse cx="120" cy="146" rx="30" ry="24" fill="#f3ddc4"/>',
         '<circle cx="98" cy="104" r="8" fill="%s"/>' % INK,
         '<circle cx="142" cy="104" r="8" fill="%s"/>' % INK,
         '<ellipse cx="120" cy="136" rx="13" ry="10" fill="%s"/>' % INK,
         '<path d="M120 146 v10 M120 156 q-12 10 -22 0 M120 156 q12 10 22 0" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % INK]
    return wrap(''.join(p))


def cat():
    """小猫（正面头像）"""
    p = [_shadow(),
         '<polygon points="70,78 84,30 118,62" fill="#e0a43a"/>',
         '<polygon points="170,78 156,30 122,62" fill="#e0a43a"/>',
         '<circle cx="120" cy="120" r="62" fill="#f2c14e"/>',
         '<ellipse cx="120" cy="148" rx="28" ry="20" fill="#fdf0d0"/>',
         '<circle cx="98" cy="108" r="8" fill="%s"/>' % INK,
         '<circle cx="142" cy="108" r="8" fill="%s"/>' % INK,
         '<polygon points="120,132 112,126 128,126" fill="#ef9a9a"/>',
         '<path d="M120 132 v8" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % INK,
         '<path d="M60 132 h26 M60 144 h26 M154 132 h26 M154 144 h26" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % SOFT]
    return wrap(''.join(p))


def pencil():
    """铅笔"""
    p = ['<polygon points="120,26 146,72 94,72" fill="#ffe0b2"/>',
         '<polygon points="120,26 128,40 112,40" fill="#4e342e"/>',
         '<rect x="94" y="70" width="52" height="118" fill="#fdd835"/>',
         '<rect x="94" y="70" width="16" height="118" fill="#fbc02d"/>',
         '<rect x="94" y="188" width="52" height="22" fill="#ef9a9a"/>',
         '<rect x="94" y="204" width="52" height="12" rx="6" fill="#b0bec5"/>',
         '<circle cx="120" cy="150" r="7" fill="#f9a825"/>']
    return wrap(''.join(p))


def bag():
    """书包"""
    p = ['<path d="M78 96 q42 -34 84 0" fill="none" stroke="#3f51b5" stroke-width="10" stroke-linecap="round"/>',
         '<rect x="52" y="92" width="136" height="112" rx="18" fill="#5c6bc0"/>',
         '<rect x="52" y="92" width="136" height="38" rx="18" fill="#3f51b5"/>',
         '<rect x="76" y="146" width="88" height="46" rx="12" fill="#7986cb"/>',
         '<circle cx="120" cy="132" r="8" fill="#ffca28"/>',
         '<rect x="112" y="146" width="16" height="10" rx="4" fill="#ffca28"/>']
    return wrap(''.join(p))


def apple():
    """红苹果"""
    p = ['<path d="M120 74 q-10 -22 6 -34" fill="none" stroke="#6d4c41" stroke-width="7" stroke-linecap="round"/>',
         '<ellipse cx="140" cy="52" rx="22" ry="12" fill="#66bb6a" transform="rotate(-20 140 52)"/>',
         '<path d="M120 84 q-58 -14 -58 48 q0 62 58 78 q58 -16 58 -78 q0 -62 -58 -48 z" fill="#e53935"/>',
         '<path d="M92 116 q-12 20 -4 44" fill="none" stroke="#ef9a9a" stroke-width="8" stroke-linecap="round" opacity="0.7"/>']
    return wrap(''.join(p))


def ball():
    """蓝色球"""
    p = ['<circle cx="120" cy="132" r="74" fill="#1e88e5"/>',
         '<path d="M120 58 q-46 74 0 148" fill="none" stroke="#1565c0" stroke-width="6"/>',
         '<path d="M120 58 q46 74 0 148" fill="none" stroke="#1565c0" stroke-width="6"/>',
         '<ellipse cx="120" cy="132" rx="74" ry="26" fill="none" stroke="#1565c0" stroke-width="6"/>',
         '<ellipse cx="94" cy="98" rx="20" ry="13" fill="#bbdefb" opacity="0.85" transform="rotate(-25 94 98)"/>']
    return wrap(''.join(p))


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
    for name, fn in (('en-dog', dog), ('en-cat', cat), ('en-pencil', pencil),
                     ('en-bag', bag), ('en-red', apple), ('en-blue', ball)):
        f = '%s.svg' % name
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(fn())
        made.append(f)
    for k in ('p1', 'p2', 'p3'):
        f = 'pattern-%s.svg' % k
        open(os.path.join(OUT, f), 'w', encoding='utf-8').write(pattern(k))
        made.append(f)
    print('生成 %d 个 SVG 到 %s' % (len(made), OUT))
    print('  ' + ', '.join(made))


if __name__ == '__main__':
    main()
