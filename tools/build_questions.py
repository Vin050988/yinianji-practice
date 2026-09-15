#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一年级练习 App · 题库生成器（对应规范 v1.1）

作用：把「原始题库（豆包交付版）」+「人工补丁（修正 / 新增题）」合并，
      自动补齐拼音、difficulty、modes、explain 等 v1.1 规范字段，
      输出 App 可直接使用的 data/*.json，并做字段校验。

用法：
    python3 tools/build_questions.py            # 生成全部学科
    python3 tools/build_questions.py yuwen      # 只生成语文
"""
import json
import os
import re
import sys
import datetime

from pypinyin import pinyin, Style

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
DATA = os.path.join(BASE, 'data')
SRC = '/Users/haichao/Ai/AIwenjian/文档/一年级题库素材'

SRC_FILES = {
    'yuwen': '语文题库 yuwen-1-up.json（115题）.json',
    'shuxue': '数学题库 shuxue-1-up.json（91题+口算模板）.json',
}
# 英语题库由豆包交付，已归档到工作区素材目录（不在原始素材包里）
ALT_SRC = {
    'yingyu': '/Users/haichao/Ai/AIwenjian/文档/一年级英语素材/yingyu-1-up.json（豆包原始交付）.json',
}
OUT_FILES = {'yuwen': 'yuwen-1-up.json', 'shuxue': 'shuxue-1-up.json', 'yingyu': 'yingyu-1-up.json'}

CJK = re.compile(r'[\u4e00-\u9fff]')
MARKS = {'a': 'āáǎà', 'o': 'ōóǒò', 'e': 'ēéěè', 'i': 'īíǐì', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}


def num2tone(s):
    """数字调转声调符号：'pian4' -> 'piàn'；轻声(5)与无调返回原形。"""
    m = re.match(r'^([A-Za-züÜ]+)([1-5])?$', s)
    if not m:
        return s
    base, tone = m.group(1), m.group(2)
    if not tone or tone == '5':
        return base
    t = int(tone)
    low = base.lower()
    idx = -1
    for v in 'aoe':
        if v in low:
            idx = low.index(v)
            break
    if idx < 0:
        if 'iu' in low:
            idx = low.index('iu') + 1
        elif 'ui' in low:
            idx = low.index('ui') + 1
        else:
            for v in 'iuü':
                if v in low:
                    idx = low.index(v)
                    break
    if idx < 0:
        return base
    ch = base[idx]
    mk = MARKS.get(ch.lower())
    if not mk:
        return base
    nc = mk[t - 1]
    return base[:idx] + (nc.upper() if ch.isupper() else nc) + base[idx + 1:]


def raw_syls(chars):
    """取汉字串的数字调音节（长度必然等于 chars 长度）。"""
    if not chars:
        return []
    return [x[0] for x in pinyin(''.join(chars), style=Style.TONE3, neutral_tone_with_five=True)]


def apply_sandhi(chars, syls):
    """'一' '不' 变调（按教材实际读音标注）。"""
    out = list(syls)
    n = len(out)
    for i, ch in enumerate(chars):
        nxt = out[i + 1] if i + 1 < n else ''
        t = nxt[-1] if nxt and nxt[-1:].isdigit() else ''
        if ch == '一' and out[i] == 'yi1':
            if t == '4':
                out[i] = 'yi2'
            elif t in ('1', '2', '3'):
                out[i] = 'yi4'
        elif ch == '不' and out[i] == 'bu4':
            if t == '4':
                out[i] = 'bu2'
    return out


def to_pinyin(text):
    """文本 -> 拼音串（音节空格分隔，标点/数字/字母不占位）。"""
    chars = CJK.findall(text or '')
    syls = apply_sandhi(chars, raw_syls(chars))
    return ' '.join(num2tone(s) for s in syls)


def han_count(text):
    return len(CJK.findall(text or ''))


# ---------- 字段补全 ----------

def guess_difficulty(q, chapter_id):
    """按题型与章节给一个可解释的默认难度。"""
    t = q.get('type')
    stem = q.get('stem') or ''
    if t == 'match':
        return 2
    if t == 'arith':
        rng = (q.get('range') or {}).get('a') or [0, 0]
        return 1 if (rng[1] if len(rng) > 1 else 0) <= 5 else 2
    if t == 'judge':
        return 1
    if '和其他三项不一样' in stem:
        return 2
    if chapter_id in ('yw-c3', 'yw-c4', 'yw-c5', 'yw-c7', 'yw-c8', 'sx-c4', 'sx-c7', 'sx-c8'):
        return 2
    if chapter_id.startswith('yy-'):
        return 2 if (t == 'listen' or '故事' in stem) else 1
    return 1


def guess_modes(q):
    return ['match'] if q.get('type') == 'match' else ['level', 'timer']


def shuffle_options(q, seed_key):
    """打乱 choice 的选项顺序（固定种子，结果可复现），同步修正 answer 与 optionsPinyin。
    目的：避免「正确答案总在第一个」被孩子记住位置。"""
    opts = list(q.get('options') or [])
    if q.get('type') != 'choice' or len(opts) < 2 or not isinstance(q.get('answer'), int):
        return q
    import hashlib
    import random
    seed = int(hashlib.md5(seed_key.encode('utf-8')).hexdigest()[:8], 16)
    idx = list(range(len(opts)))
    random.Random(seed).shuffle(idx)
    if [opts[i] for i in idx] == opts:          # 恰好没变则左移一位，保证一定有变化
        idx = idx[1:] + idx[:1]
    q['options'] = [opts[i] for i in idx]
    op = q.get('optionsPinyin')
    if isinstance(op, list) and len(op) == len(opts):
        q['optionsPinyin'] = [op[i] for i in idx]
    q['answer'] = idx.index(q['answer'])
    return q


def apply_rules(text, rules):
    """按补丁里的全局拼音替换规则修正自动标注（如 shéi -> shuí、ba zhǎng -> ba cháng）。"""
    for r in rules or []:
        frm = r.get('from') or ''
        if frm:
            text = text.replace(frm, r.get('to') or '')
    return text


def norm_options(q):
    """把 listen 题里 {text,imageUrl} 形式的选项统一成字符串数组，
    图片路径收进 optionImages（前端可选使用）。"""
    opts = q.get('options')
    if isinstance(opts, list) and opts and isinstance(opts[0], dict):
        q['options'] = [str(o.get('text') or '') for o in opts]
        imgs = [o.get('imageUrl') or '' for o in opts]
        if any(imgs):
            q['optionImages'] = imgs
    return q


def normalize(q, chapter_id, subject, force, rules=None):
    """补齐/纠正单题字段。force 为该题的强制拼音覆盖（可选）。"""
    q = norm_options(dict(q))
    force = force or {}
    rules = rules or []
    t = q.get('type')
    # 拼音（仅语文，且未强制覆盖时自动生成）
    if subject == 'yuwen':
        if 'stemPinyin' not in force and q.get('stem') and han_count(q['stem']):
            q['stemPinyin'] = apply_rules(to_pinyin(q['stem']), rules)
        if 'optionsPinyin' not in force and isinstance(q.get('options'), list):
            opts = [o if isinstance(o, str) else (o.get('text') or '') for o in q['options']]
            if any(han_count(o) for o in opts):
                q['optionsPinyin'] = [apply_rules(to_pinyin(o), rules) for o in opts]
        if 'pairs' in q and isinstance(q['pairs'], list):
            pairs = []
            for pr in q['pairs']:
                pr = dict(pr)
                if han_count(pr.get('left')):
                    pr['leftPinyin'] = apply_rules(to_pinyin(pr['left']), rules)
                if han_count(pr.get('right')):
                    pr['rightPinyin'] = apply_rules(to_pinyin(pr['right']), rules)
                pairs.append(pr)
            q['pairs'] = pairs
    for k, v in force.items():
        if k != '__delete':
            q[k] = v
    q.setdefault('difficulty', guess_difficulty(q, chapter_id))
    q.setdefault('modes', guess_modes(q))
    q.setdefault('explain', '再想一想，你一定可以的。')
    if t == 'arith':
        q.setdefault('explain', '数一数，算一算。')
    if q.get('type') == 'choice':
        q = shuffle_options(q, q.get('id') or q.get('stem') or '')
    # 字段顺序整理（便于人工 review）
    order = ['id', 'type', 'stem', 'stemPinyin', 'options', 'optionsPinyin', 'optionImages', 'answer',
             'pairs', 'template', 'range', 'imageUrl', 'tts', 'difficulty', 'modes', 'explain']
    return {k: q[k] for k in order if k in q}


# ---------- 校验 ----------

def validate(doc, subject):
    errs, ids = [], {}
    for ch in doc['chapters']:
        if 'id' not in ch or 'questions' not in ch:
            errs.append('章节缺字段: %r' % ch.get('title'))
        for q in ch['questions']:
            qid = q.get('id')
            if not qid:
                errs.append('%s 有题目缺 id' % ch['id'])
                continue
            if qid in ids:
                errs.append('重复 id: %s（另见 %s）' % (qid, ids[qid]))
            ids[qid] = ch['id']
            t = q.get('type')
            if t not in ('choice', 'judge', 'match', 'arith', 'listen'):
                errs.append('%s 未知 type=%r' % (qid, t))
            if t in ('choice', 'listen'):
                o = q.get('options') or []
                a = q.get('answer')
                if not isinstance(a, int) or not (0 <= a < len(o)):
                    errs.append('%s answer 越界: %r / %d 项' % (qid, a, len(o)))
                if len(set(map(str, o))) != len(o):
                    errs.append('%s 选项重复' % qid)
            if t == 'judge' and not isinstance(q.get('answer'), bool):
                errs.append('%s judge 答案非布尔: %r' % (qid, q.get('answer')))
            if t == 'match':
                ps = q.get('pairs') or []
                if len(ps) < 2:
                    errs.append('%s pairs 少于 2 组' % qid)
                for pr in ps:
                    if 'left' not in pr or 'right' not in pr:
                        errs.append('%s 配对项缺 left/right' % qid)
                        break
            if t == 'arith' and (not q.get('template') or not q.get('range')):
                errs.append('%s arith 缺 template/range' % qid)
            if 'difficulty' not in q:
                errs.append('%s 缺 difficulty' % qid)
            if 'modes' not in q:
                errs.append('%s 缺 modes' % qid)
            if 'explain' not in q:
                errs.append('%s 缺 explain' % qid)
            # 拼音音节数 == 汉字数
            if subject == 'yuwen':
                sp = q.get('stemPinyin')
                if sp is not None and len(sp.split()) != han_count(q.get('stem')):
                    errs.append('%s stemPinyin 音节数(%d) != 汉字数(%d)' % (qid, len(sp.split()), han_count(q.get('stem'))))
                op = q.get('optionsPinyin')
                if op:
                    for i, s in enumerate(op):
                        txt = q.get('options')[i] if i < len(q.get('options') or []) else ''
                        if isinstance(txt, dict):
                            txt = txt.get('text') or ''
                        if len(s.split()) != han_count(txt):
                            errs.append('%s optionsPinyin[%d] 音节数(%d) != 汉字数(%d)' % (qid, i, len(s.split()), han_count(txt)))
            # 禁外链
            if q.get('imageUrl', '').startswith('http'):
                errs.append('%s imageUrl 是外链' % qid)
    return errs, ids


# ---------- 主流程 ----------

def build(subject):
    src_path = ALT_SRC.get(subject) or os.path.join(SRC, SRC_FILES[subject])
    patch_path = os.path.join(HERE, 'patch_%s.json' % subject)
    with open(src_path, encoding='utf-8') as f:
        doc = json.load(f)
    patch = {'chapters_add': [], 'fixes': {}, 'add': {}, 'pinyin_force': {}, 'pinyin_rules': []}
    import glob as _glob
    for pf in sorted(_glob.glob(os.path.join(HERE, 'patch_%s*.json' % subject))):
        with open(pf, encoding='utf-8') as f:
            part = json.load(f)
        for k, v in part.items():
            if k == 'add':
                for cid, qs in (v or {}).items():
                    patch['add'].setdefault(cid, []).extend(qs)
            elif k in ('chapters_add', 'pinyin_rules'):
                patch[k].extend(v or [])
            elif k in ('fixes', 'pinyin_force'):
                patch[k].update(v or [])
            else:
                patch[k] = v
        sys.stderr.write('   [patch] 载入 %s\n' % os.path.basename(pf))

    chapters = doc['chapters']
    # 1) 应用字段修正 / 删除
    fixes = patch.get('fixes') or {}
    for ch in chapters:
        kept = []
        for q in ch['questions']:
            fx = fixes.get(q.get('id'))
            if fx and fx.get('__delete'):
                continue
            if fx:
                q = dict(q)
                q.update({k: v for k, v in fx.items() if k != '__delete'})
            kept.append(q)
        ch['questions'] = kept
    # 2) 新增章节
    for ch in patch.get('chapters_add') or []:
        chapters.append({'id': ch['id'], 'title': ch['title'], 'order': ch.get('order', 99), 'questions': []})
    for ch in chapters:
        ch['questions'] = [normalize(q, ch['id'], subject, (patch.get('pinyin_force') or {}).get(q.get('id')), patch.get('pinyin_rules'))
                           for q in ch['questions']]
    # 3) 追加新题
    by_id = {ch['id']: ch for ch in chapters}
    for cid, qs in (patch.get('add') or {}).items():
        if cid not in by_id:
            raise SystemExit('补丁里 add 的章节 %s 不存在' % cid)
        n = len(by_id[cid]['questions'])
        for i, q in enumerate(qs):
            q = dict(q)
            if not q.get('id'):
                q['id'] = '%s-%03d' % (cid, n + i + 1)
            q = normalize(q, cid, subject, (patch.get('pinyin_force') or {}).get(q['id']), patch.get('pinyin_rules'))
            by_id[cid]['questions'].append(q)
    # 4) 按 order 排序 + 顶层字段
    chapters.sort(key=lambda c: (c.get('order', 99), c.get('id', '')))
    doc['chapters'] = chapters
    doc['schemaVersion'] = '1.1'
    doc['updated'] = datetime.date.today().isoformat()
    if patch.get('textbook'):
        doc['textbook'] = patch['textbook']
    # 5) 校验 + 落盘
    errs, _ = validate(doc, subject)
    out = os.path.join(DATA, OUT_FILES[subject])
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    total = sum(len(c['questions']) for c in chapters)
    print('== %s == 章节 %d 个，题目 %d 道 -> %s' % (subject, len(chapters), total, out))
    for c in chapters:
        types = {}
        for q in c['questions']:
            types[q['type']] = types.get(q['type'], 0) + 1
        print('   [%2d] %-7s %-46s %2d 题 %s' % (c.get('order', 99), c['id'], c['title'][:46], len(c['questions']), types))
    if errs:
        print('   !! 校验发现 %d 个问题：' % len(errs))
        for e in errs[:40]:
            print('      -', e)
    else:
        print('   校验通过：字段完整、id 唯一、answer 合法、拼音音节与汉字数一致、无外链图片')
    return len(errs)


if __name__ == '__main__':
    targets = sys.argv[1:] or ['yuwen', 'shuxue', 'yingyu']
    bad = 0
    for t in targets:
        if t not in SRC_FILES and t not in ALT_SRC:
            print('未知学科:', t)
            bad += 1
            continue
        bad += build(t)
    sys.exit(1 if bad else 0)
