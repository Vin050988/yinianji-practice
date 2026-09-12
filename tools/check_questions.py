#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一年级练习 App · 题库校验器（规范 v1.1）

独立校验 data/ 下的题库 JSON：字段完整性、id 唯一性、answer 合法性、
拼音音节数与汉字数一致、图片文件存在且非外链、口算模板范围合法。

用法：python3 tools/check_questions.py
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
DATA = os.path.join(BASE, 'data')
CJK = re.compile(r'[\u4e00-\u9fff]')
TOP_REQUIRED = ('schemaVersion', 'subject', 'subjectName', 'grade', 'term', 'updated', 'textbook', 'chapters')


def han(text):
    return len(CJK.findall(text or ''))


def check(path):
    doc = json.load(open(path, encoding='utf-8'))
    errs = []
    for k in TOP_REQUIRED:
        if k not in doc:
            errs.append('顶层缺字段 %s' % k)
    subject = doc.get('subject')
    ids = set()
    total = 0
    by_type, by_diff = {}, {}
    for ch in doc.get('chapters') or []:
        if not ch.get('id') or not ch.get('title'):
            errs.append('章节缺 id/title: %r' % ch.get('title'))
        for q in ch.get('questions') or []:
            total += 1
            qid = q.get('id')
            if not qid:
                errs.append('%s: 有题目缺 id' % ch.get('id'))
                continue
            if qid in ids:
                errs.append('重复 id: %s' % qid)
            ids.add(qid)
            t = q.get('type')
            by_type[t] = by_type.get(t, 0) + 1
            by_diff[q.get('difficulty')] = by_diff.get(q.get('difficulty'), 0) + 1
            if t not in ('choice', 'judge', 'match', 'arith', 'listen'):
                errs.append('%s: 未知 type=%r' % (qid, t))
            if t in ('choice', 'listen'):
                opts, a = q.get('options') or [], q.get('answer')
                if not isinstance(a, int) or not (0 <= a < len(opts)):
                    errs.append('%s: answer 越界 %r / %d 项' % (qid, a, len(opts)))
                if len(set(map(str, opts))) != len(opts):
                    errs.append('%s: 选项重复' % qid)
            if t == 'judge' and not isinstance(q.get('answer'), bool):
                errs.append('%s: judge 答案非布尔' % qid)
            if t == 'match':
                ps = q.get('pairs') or []
                if len(ps) < 3:
                    errs.append('%s: pairs 少于 3 组（配对模式体验差）' % qid)
                for pr in ps:
                    if 'left' not in pr or 'right' not in pr:
                        errs.append('%s: 配对项缺 left/right' % qid)
                        break
            if t == 'arith':
                r = q.get('range') or {}
                if 'a' not in r or 'b' not in r:
                    errs.append('%s: arith range 缺 a/b' % qid)
                else:
                    ops = r.get('ops') or []
                    if set(ops) - {'+', '-'}:
                        errs.append('%s: ops 只支持 + / -' % qid)
                    if '-' in ops and r['b'][0] > r['a'][1]:
                        errs.append('%s: 减法 b 下界(%d) 大于 a 上界(%d)，无法保证 a≥b' % (qid, r['b'][0], r['a'][1]))
                    if r.get('minResult', 0) < 0:
                        errs.append('%s: minResult 为负（一年级上册不允许负数）' % qid)
            if not q.get('modes'):
                errs.append('%s: 缺 modes' % qid)
            if not q.get('difficulty'):
                errs.append('%s: 缺 difficulty' % qid)
            if not q.get('explain'):
                errs.append('%s: 缺 explain' % qid)
            iu = q.get('imageUrl') or ''
            if iu:
                if iu.startswith('http') or iu.startswith('//'):
                    errs.append('%s: imageUrl 是外链' % qid)
                elif not os.path.exists(os.path.join(BASE, iu)):
                    errs.append('%s: 图片文件不存在 %s' % (qid, iu))
            if subject == 'yuwen':
                sp = q.get('stemPinyin')
                if sp is not None and len(sp.split()) != han(q.get('stem')):
                    errs.append('%s: stemPinyin 音节数(%d) != 汉字数(%d)' % (qid, len(sp.split()), han(q.get('stem'))))
                op = q.get('optionsPinyin')
                if op is not None:
                    for i, s in enumerate(op):
                        txt = (q.get('options') or [''])[i] if i < len(q.get('options') or []) else ''
                        if isinstance(txt, dict):
                            txt = txt.get('text') or ''
                        if len(s.split()) != han(txt):
                            errs.append('%s: optionsPinyin[%d] 音节数(%d) != 汉字数(%d)' % (qid, i, len(s.split()), han(txt)))
                for pr in q.get('pairs') or []:
                    for side in ('left', 'right'):
                        pv = pr.get(side + 'Pinyin')
                        if pv is not None and len(pv.split()) != han(pr.get(side)):
                            errs.append('%s: %sPinyin 音节数与汉字数不符' % (qid, side))
    return doc, total, by_type, by_diff, errs


def main():
    files = sorted(glob.glob(os.path.join(DATA, '*.json')))
    if not files:
        print('data/ 下没有题库文件')
        return 1
    bad = 0
    for f in files:
        doc, total, by_type, by_diff, errs = check(f)
        print('== %s ==' % os.path.basename(f))
        print('   %s（%s） 年级%d · %s · 章节 %d · 题目 %d' % (
            doc.get('subjectName'), doc.get('textbook', ''), doc.get('grade', 0),
            '上册' if doc.get('term') == 'up' else doc.get('term'), len(doc.get('chapters') or []), total))
        print('   题型:', by_type)
        print('   难度:', by_diff)
        if errs:
            bad += len(errs)
            print('   !! 发现 %d 个问题：' % len(errs))
            for e in errs[:25]:
                print('      -', e)
        else:
            print('   ✅ 校验通过')
    print()
    print('总计：%d 个文件，%s' % (len(files), '全部通过' if not bad else '%d 个问题' % bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
