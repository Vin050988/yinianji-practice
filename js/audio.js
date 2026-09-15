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
      .replace(/[“”‘’"]/g, '')      // 只去中文引号和双引号，保留英文单引号（I'm）
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

  var voiceCache = {};

  /** 给语音质量打分：优先「本地 + 增强/高级音质」，避开合成感很重的压缩音 */
  function scoreVoice(v) {
    var s = 0;
    if (v.localService) s += 2;
    if (/enhanced|premium|natural|siri/i.test(v.name || '')) s += 3;
    if (/compact|eloquence|albert|zarvox/i.test(v.name || '')) s -= 3;
    return s;
  }

  /** 按语言挑一个可用且质量最好的语音；语音列表还没加载好时返回 null（下次再试） */
  function pickVoice(lang) {
    if (!ok) return null;
    var key = String(lang || 'zh-CN').slice(0, 2).toLowerCase();
    if (voiceCache[key] !== undefined) return voiceCache[key];
    var vs = [];
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    if (!vs.length) return null;
    var cands = vs.filter(function (v) {
      return String(v.lang || '').toLowerCase().replace('_', '-').indexOf(key) === 0;
    });
    var pick = null;
    if (cands.length) {
      cands.sort(function (a, b) { return scoreVoice(b) - scoreVoice(a); });
      pick = cands[0];
    }
    voiceCache[key] = pick;
    return pick;
  }

  /** 供家长自检显示：当前用的是哪个语音 */
  function voiceInfo(lang) {
    var v = pickVoice(lang);
    if (!v) {
      var vs = [];
      try { vs = window.speechSynthesis.getVoices() || []; } catch (e) {}
      return vs.length ? ('未找到 ' + lang + ' 语音（系统里只有 ' + vs.length + ' 个语音）')
                       : '语音列表尚未加载（请再点一次）';
    }
    return v.name + '（' + v.lang + (v.localService ? ' · 本机' : ' · 云端') + '）';
  }

  function say(text, enabled, lang, rate) {
    if (!enabled || !ok || !text) return false;
    var t = toSpeech(text);
    if (!t) return false;
    var now = Date.now();
    if (t === lastText && now - lastAt < 1200) return false;   // 防抖
    lastText = t; lastAt = now;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(t);
      u.lang = lang || 'zh-CN';    // 英语题干传 'en-US'，否则用中文语音
      var v = pickVoice(u.lang);
      if (v) u.voice = v;          // 显式指定语音，避免系统挑到最差的那个
      u.volume = 1;                // 音量拉满（最终仍受系统音量控制）
      u.rate = rate || 0.8;        // 一年级放慢一点
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function stop() { if (ok) { try { window.speechSynthesis.cancel(); } catch (e) {} } }

  return { say: say, stop: stop, available: ok, toSpeech: toSpeech,
           voiceInfo: voiceInfo, pickVoice: pickVoice };
})();
