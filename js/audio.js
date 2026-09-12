/* 一年级练习 App · 声音（音效 + 语音朗读）
 * 音效：Web Audio 现场合成，不需要素材文件。
 * 语音：Web Speech API 中文朗读；不可用时静默降级（题目仍可正常作答）。
 * 注意：iOS 要求首次交互后才能播放，ensure() 在第一次点击时调用。
 *
 * 朗读前会把题目转成「口语文本」（见 toSpeech）：
 *   中文语音引擎会把算式里的 "-" 读成“至”、把 "（　）" 念成“括号”、
 *   把书名号引号也念出来，所以先把这些符号换成汉字/停顿再读，
 *   例如 "5 - 3 = ?" 会读成「5 减 3 等于 多少」。
 */
window.Sound = (function () {
  var ctx = null;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function beep(freq, delay, dur, vol, type) {
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.18));
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + (dur || 0.18) + 0.03);
  }

  return {
    ensure: ensure,
    tap: function (on) { if (on) beep(660, 0, 0.07, 0.08, 'triangle'); },
    correct: function (on) {
      if (!on) return;
      beep(660, 0, 0.12, 0.16, 'sine');
      beep(880, 0.10, 0.12, 0.16, 'sine');
      beep(1180, 0.20, 0.20, 0.15, 'sine');
    },
    wrong: function (on) {
      if (!on) return;
      beep(300, 0, 0.18, 0.14, 'sine');
      beep(220, 0.13, 0.24, 0.12, 'sine');
    },
    finish: function (on) {
      if (!on) return;
      beep(523, 0, 0.14, 0.15, 'sine');
      beep(659, 0.13, 0.14, 0.15, 'sine');
      beep(784, 0.26, 0.14, 0.15, 'sine');
      beep(1046, 0.39, 0.30, 0.16, 'sine');
    }
  };
})();

window.Speak = (function () {
  var ok = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var lastText = '', lastAt = 0;

  /** 题目文本 → 适合朗读的口语文本（修掉 TTS 念符号的毛病） */
  function toSpeech(text) {
    return String(text == null ? '' : text)
      // 书名号、引号：直接去掉，别念出来
      .replace(/[《》〈〉]/g, '')
      .replace(/[“”"'‘’]/g, '')
      // 填空用的空括号 → 读“多少”
      .replace(/[（(]\s*[）)]/g, '多少')
      // 其余括号 → 变成停顿
      .replace(/[（(]/g, '，').replace(/[）)]/g, '，')
      // 运算符：中文 TTS 会把 "-" 读成“至/杠”，必须换成汉字
      .replace(/[-−–—]/g, ' 减 ')
      .replace(/[+＋]/g, ' 加 ')
      // 口算题常见的 "= ?" 直接读成「等于多少」，比「等于，问号」自然
      .replace(/[=＝]\s*[?？]/g, '等于多少')
      .replace(/[=＝]/g, ' 等于 ')
      .replace(/[×✕]/g, ' 乘 ')
      .replace(/÷/g, ' 除以 ')
      // 问号：有些引擎会念“问号”，改成停顿
      .replace(/[?？]/g, '，')
      // 清理重复标点与多余空格
      .replace(/，{2,}/g, '，')
      .replace(/\s*，\s*/g, '，')
      .replace(/\s{2,}/g, ' ')
      .replace(/[，,]\s*$/, '')      // 去掉结尾多余的停顿
      .trim();
  }

  function say(text, enabled) {
    if (!enabled || !ok || !text) return false;
    var t = toSpeech(text);
    if (!t) return false;
    var now = Date.now();
    if (t === lastText && now - lastAt < 1200) return false;   // 防抖
    lastText = t; lastAt = now;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(t);
      u.lang = 'zh-CN';
      u.rate = 0.92;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function stop() { if (ok) { try { window.speechSynthesis.cancel(); } catch (e) {} } }

  return { say: say, stop: stop, available: ok, toSpeech: toSpeech };
})();
