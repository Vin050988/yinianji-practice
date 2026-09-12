/* 一年级练习 App · 会话状态机
 * 关键约束（规范 3.4）：倒计时必须用「时间戳差值」计算，不能用 setInterval 累加，
 * 否则 iOS 切到后台再回来会白送时间。
 */
window.Session = (function () {

  function create(opts) {
    var items = opts.items || [];
    var s = {
      mode: opts.mode || 'level',           // level=闯关（本轮实现）；match/timer 预留
      items: items,
      total: items.length,
      index: 0,
      right: 0,
      wrong: 0,
      lives: opts.lives === undefined ? 3 : opts.lives,
      maxLives: opts.lives === undefined ? 3 : opts.lives,
      combo: 0,
      bestCombo: 0,
      answers: [],                          // {item, pickedIndex, isRight}
      durationSec: (opts.durationMin || 10) * 60,
      startAt: Date.now(),
      elapsedMsAtPause: 0,
      pausedAt: 0,
      finished: false
    };

    /** 剩余秒数：时间戳差值（切后台也准确） */
    s.remaining = function () {
      var now = s.pausedAt || Date.now();
      var past = (now - s.startAt) - s.elapsedMsAtPause;
      return Math.max(0, s.durationSec - Math.floor(past / 1000));
    };
    s.elapsed = function () {
      var now = s.pausedAt || Date.now();
      return Math.max(0, Math.floor(((now - s.startAt) - s.elapsedMsAtPause) / 1000));
    };
    s.timeUp = function () { return s.remaining() <= 0; };
    s.pause = function () { if (!s.pausedAt) s.pausedAt = Date.now(); };
    s.resume = function () {
      if (s.pausedAt) { s.elapsedMsAtPause += Date.now() - s.pausedAt; s.pausedAt = 0; }
    };

    s.current = function () { return s.items[s.index] || null; };
    s.isLast = function () { return s.index >= s.items.length - 1; };

    /** 记录一题的结果；返回 {isRight, gameOver} */
    s.answer = function (pickedIndex) {
      var item = s.current();
      if (!item || item.answered) return null;
      item.answered = true;
      var isRight = (pickedIndex === item.correctIndex);
      item.pickedIndex = pickedIndex;
      s.answers.push({ item: item, pickedIndex: pickedIndex, isRight: isRight });
      if (isRight) {
        s.right++;
        s.combo++;
        if (s.combo > s.bestCombo) s.bestCombo = s.combo;
      } else {
        s.wrong++;
        s.combo = 0;
        if (s.mode === 'level') s.lives = Math.max(0, s.lives - 1);
      }
      return { isRight: isRight, gameOver: (s.mode === 'level' && s.lives <= 0) };
    };

    s.next = function () { s.index++; return s.index < s.items.length; };
    s.finish = function () { s.finished = true; return s.summary(); };

    s.summary = function () {
      var total = s.answers.length || 0;
      var rate = total ? s.right / total : 0;
      var stars = rate >= 0.9 ? 3 : (rate >= 0.7 ? 2 : (rate >= 0.5 ? 1 : 0));
      var score = Math.max(0, 100 - s.wrong * 10);
      if (s.mode === 'timer') score += Math.max(0, Math.floor(s.bestCombo / 3)) * 5;   // 计时模式连击加分
      return {
        subject: opts.subject,
        date: opts.date,
        right: s.right, wrong: s.wrong, total: s.items.length,
        answered: total, rate: rate, stars: stars, score: score,
        seconds: s.elapsed(), bestCombo: s.bestCombo,
        wrongItems: s.answers.filter(function (a) { return !a.isRight; }).map(function (a) { return a.item; })
      };
    };

    return s;
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  return { create: create, fmtTime: fmtTime };
})();
