/* 一年级练习 App · 本地存储
 * 统一 key 前缀 ypApp.v1.*（见规范第 6 节）
 * 保存：设置 / 成绩记录 / 错题本 / 打卡
 */
window.Store = (function () {
  var KEY = {
    settings: 'ypApp.v1.settings',
    records: 'ypApp.v1.records',
    wrong: 'ypApp.v1.wrong',
    checkin: 'ypApp.v1.checkin'
  };
  var DEFAULT_SETTINGS = {
    duration: 10,                                  // 每次会话分钟数
    timesPerDay: 0,                                // 每天每科次数上限；0 = 不限制
    tts: true,                                     // 语音朗读题干
    sound: true,                                   // 音效
    subjects: { yuwen: true, shuxue: true, yingyu: true }   // 各科开关
  };

  function read(key, def) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式等 */ }
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayBefore(dateStr, n) {
    var p = dateStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function getSettings() {
    var s = read(KEY.settings, null) || {};
    var out = {};
    for (var k in DEFAULT_SETTINGS) out[k] = (s[k] === undefined ? DEFAULT_SETTINGS[k] : s[k]);
    out.subjects = s.subjects || { yuwen: true, shuxue: true, yingyu: true };
    return out;
  }
  function saveSettings(patch) {
    var s = getSettings();
    for (var k in patch) s[k] = patch[k];
    write(KEY.settings, s);
    return s;
  }

  function getRecords() { return read(KEY.records, []); }
  function addRecord(rec) {
    var list = getRecords();
    list.push(rec);
    if (list.length > 400) list = list.slice(-400);
    write(KEY.records, list);
  }
  /** 今天某科已完成的会话次数 */
  function sessionsToday(subject) {
    var t = today();
    return getRecords().filter(function (r) { return r.date === t && r.subject === subject; }).length;
  }
  function starsTotal(subject) {
    return getRecords().reduce(function (a, r) {
      if (subject && r.subject !== subject) return a;
      return a + (r.stars || 0);
    }, 0);
  }
  /** 最近 7 天每日正确率（用于家长页柱状图） */
  function weekly() {
    var t = today(), out = [];
    for (var i = 6; i >= 0; i--) {
      var day = dayBefore(t, i);
      var rs = getRecords().filter(function (r) { return r.date === day; });
      var total = rs.reduce(function (a, r) { return a + (r.total || 0); }, 0);
      var right = rs.reduce(function (a, r) { return a + (r.correct || 0); }, 0);
      out.push({ date: day, label: day.slice(5), rate: total ? Math.round(right / total * 100) : 0, total: total });
    }
    return out;
  }

  // ── 错题本：{ qid: {subject, chapterId, wrong, fixed} } ──
  function getWrong() { return read(KEY.wrong, {}); }
  function addWrong(subject, chapterId, qid) {
    var w = getWrong();
    var e = w[qid] || { subject: subject, chapterId: chapterId, wrong: 0, fixed: 0 };
    e.wrong = (e.wrong || 0) + 1;
    e.fixed = 0;                       // 又错了就重新计数
    w[qid] = e;
    write(KEY.wrong, w);
  }
  function markRight(qid) {
    var w = getWrong();
    if (!w[qid]) return;
    w[qid].fixed = (w[qid].fixed || 0) + 1;
    if (w[qid].fixed >= 2) delete w[qid];   // 连续答对 2 次移出错题本
    write(KEY.wrong, w);
  }
  function wrongIds(subject) {
    var w = getWrong(), out = [];
    for (var q in w) if (!subject || w[q].subject === subject) out.push(q);
    return out;
  }

  // ── 打卡：{ date: [subject,...] } ──
  function getCheckin() { return read(KEY.checkin, {}); }
  function markDone(subject) {
    var c = getCheckin();
    var t = today();
    var arr = c[t] || [];
    if (arr.indexOf(subject) < 0) arr.push(subject);
    c[t] = arr;
    write(KEY.checkin, c);
  }
  /** 连续打卡天数（从今天或昨天往前数） */
  function streak() {
    var c = getCheckin(), t = today(), n = 0;
    if (!c[t]) t = dayBefore(t, 1);          // 今天还没做，从昨天数
    while (c[t] && c[t].length) { n++; t = dayBefore(t, 1); }
    return n;
  }

  function clearAll() {
    write(KEY.records, []); write(KEY.wrong, {}); write(KEY.checkin, {});
  }

  return {
    today: today,
    getSettings: getSettings, saveSettings: saveSettings,
    getRecords: getRecords, addRecord: addRecord, sessionsToday: sessionsToday,
    starsTotal: starsTotal, weekly: weekly,
    addWrong: addWrong, markRight: markRight, wrongIds: wrongIds,
    markDone: markDone, streak: streak, clearAll: clearAll
  };
})();
