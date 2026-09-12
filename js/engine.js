/* 一年级练习 App · 出题引擎
 * 负责：题库加载、章节抽题、口算实时生成（遵守规范 5.7 的 4 条硬约束）、统一题目渲染结构。
 */
window.Engine = (function () {
  var FILES = {
    yuwen: 'data/yuwen-1-up.json',
    shuxue: 'data/shuxue-1-up.json',
    yingyu: 'data/yingyu-1-up.json'
  };
  var cache = {};

  function load(subject) {
    if (cache[subject]) return Promise.resolve(cache[subject]);
    return fetch(FILES[subject], { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('题库加载失败：' + subject + '（' + r.status + '）');
        return r.json();
      })
      .then(function (doc) { cache[subject] = doc; return doc; });
  }

  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** 章节概览（含题数） */
  function chapters(subject) {
    var doc = cache[subject];
    if (!doc) return [];
    return (doc.chapters || []).map(function (c) {
      var types = {};
      (c.questions || []).forEach(function (q) { types[q.type] = (types[q.type] || 0) + 1; });
      return { id: c.id, title: c.title, order: c.order, count: (c.questions || []).length, types: types };
    });
  }

  /** 口算题生成：遵守 minResult/maxResult、减法 a≥b、会话内不重复、兼容 {op} 占位符 */
  function makeArith(q, used) {
    var r = q.range || {};
    var aRange = r.a || [1, 10], bRange = r.b || [1, 10];
    var tmpl = q.template || '{a} + {b} = ?';
    var useOpSlot = tmpl.indexOf('{op}') >= 0;
    var fixedOp = tmpl.indexOf('-') >= 0 ? '-' : '+';
    var ops = (r.ops && r.ops.length) ? r.ops : [fixedOp];
    var minR = (r.minResult === undefined ? 0 : r.minResult);
    var maxR = (r.maxResult === undefined ? Infinity : r.maxResult);
    for (var attempt = 0; attempt < 300; attempt++) {
      var op = useOpSlot ? ops[randInt(0, ops.length - 1)] : fixedOp;
      var a = randInt(aRange[0], aRange[1]);
      var b;
      if (op === '-') {
        // 硬约束 2：减法必须保证 a ≥ b（先定 a，再在 0..a 与 b 范围的交集里抽 b）
        var bHi = Math.min(bRange[1], a);
        var bLo = Math.min(bRange[0], bHi);
        if (bHi < bLo) continue;
        b = randInt(bLo, bHi);
      } else {
        b = randInt(bRange[0], bRange[1]);
      }
      var res = (op === '+') ? (a + b) : (a - b);
      if (res < minR || res > maxR) continue;              // 硬约束 1
      var key = a + op + b;
      if (used[key]) continue;                              // 硬约束 3
      used[key] = 1;
      var text = tmpl.replace('{a}', a).replace('{b}', b);
      if (useOpSlot) text = text.replace('{op}', op);
      // 干扰项：结果 ±1、±2（不出现负数）
      var cand = {}, opts = [];
      cand[res] = 1; opts.push(res);
      var deltas = shuffle([1, -1, 2, -2, 3]);
      for (var d = 0; d < deltas.length && opts.length < 4; d++) {
        var v = res + deltas[d];
        if (v < 0 || cand[v]) continue;
        cand[v] = 1; opts.push(v);
      }
      var correctIndex = opts.indexOf(res);
      shuffle(opts);
      return {
        id: q.id + '-gen',
        qid: q.id,
        type: 'arith',
        stem: text,
        options: opts.map(String),
        correctIndex: opts.indexOf(res),
        explain: q.explain || '数一数，算一算。',
        difficulty: q.difficulty,
        generated: { a: a, b: b, op: op, result: res, correctIndexOld: correctIndex }
      };
    }
    return null;   // 极端情况下放弃该题
  }

  /** 把题库里的一道题转成统一的渲染结构 */
  function toItem(q, chapterId, subject, used) {
    if (q.type === 'arith') return makeArith(q, used);
    if (q.type === 'match') {
      return {
        id: q.id, qid: q.id, chapterId: chapterId, type: 'match',
        stem: '把左右两边配成一对',
        pairs: q.pairs || [],
        explain: q.explain || '', difficulty: q.difficulty, subject: subject
      };
    }
    if (q.type === 'judge') {
      return {
        id: q.id, qid: q.id, chapterId: chapterId, type: 'judge',
        stem: q.stem, stemPinyin: q.stemPinyin, imageUrl: q.imageUrl,
        options: ['对', '错'],
        optionsPinyin: ['duì', 'cuò'],
        correctIndex: q.answer ? 0 : 1,
        explain: q.explain || '', difficulty: q.difficulty, subject: subject
      };
    }
    // choice / listen
    return {
      id: q.id, qid: q.id, chapterId: chapterId, type: q.type,
      stem: q.stem, stemPinyin: q.stemPinyin, imageUrl: q.imageUrl,
      options: q.options || [], optionsPinyin: q.optionsPinyin || [],
      correctIndex: q.answer,
      explain: q.explain || '', difficulty: q.difficulty, subject: subject
    };
  }

  /**
   * 组装一轮练习
   * opts: { subject, chapterIds (可空=全部), count, wrongIds (错题重练), preferMatch }
   */
  function buildSession(opts) {
    var subject = opts.subject;
    var doc = cache[subject];
    if (!doc) throw new Error('题库未加载');
    var pool = [];
    (doc.chapters || []).forEach(function (c) {
      if (opts.chapterIds && opts.chapterIds.length && opts.chapterIds.indexOf(c.id) < 0) return;
      (c.questions || []).forEach(function (q) { pool.push({ q: q, chapterId: c.id }); });
    });
    if (opts.wrongIds && opts.wrongIds.length) {
      var set = {};
      opts.wrongIds.forEach(function (id) { set[id] = 1; });
      pool = pool.filter(function (e) { return set[e.q.id]; });
    }
    if (!pool.length) return { items: [], total: 0 };
    var want = opts.count || 12;
    var items = [], used = {}, taken = {};
    var poolCopy = shuffle(pool.slice());
    for (var i = 0; i < poolCopy.length && items.length < want; i++) {
      var entry = poolCopy[i];
      if (taken[entry.q.id]) continue;
      var it = toItem(entry.q, entry.chapterId, subject, used);
      if (!it) continue;
      taken[entry.q.id] = 1;
      items.push(it);
    }
    // 固定题不够（如只选了一个小章节）：用口算模板补足
    if (items.length < want) {
      var arithPool = poolCopy.filter(function (e) { return e.q.type === 'arith'; });
      var guard = 0;
      while (items.length < want && arithPool.length && guard++ < want * 30) {
        var it2 = toItem(arithPool[guard % arithPool.length].q, arithPool[guard % arithPool.length].chapterId, subject, used);
        if (it2) items.push(it2);
      }
    }
    return { items: items.slice(0, want), total: Math.min(want, items.length) };
  }

  function containsArith(pool) {
    return pool.some(function (e) { return e.q.type === 'arith'; });
  }

  /** 按 id 列表取题（错题本重练用） */
  function findByIds(subject, ids) {
    var doc = cache[subject];
    if (!doc) return [];
    var want = {};
    ids.forEach(function (i) { want[i] = 1; });
    var out = [];
    (doc.chapters || []).forEach(function (c) {
      (c.questions || []).forEach(function (q) {
        if (want[q.id]) out.push({ q: q, chapterId: c.id });
      });
    });
    return out;
  }

  return {
    load: load, chapters: chapters, buildSession: buildSession,
    findByIds: findByIds, randInt: randInt, shuffle: shuffle, toItem: toItem
  };
})();
