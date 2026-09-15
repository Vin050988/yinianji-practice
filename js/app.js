/* 一年级练习 App · 主控制器
 * 负责：页面流转、答题交互（含配对玩法）、成绩与错题、家长设置、PWA 注册。
 */
(function () {
  var SUBJECT_NAME = { yuwen: '语文', shuxue: '数学', yingyu: '英语' };
  var QUIZ_COUNT = 12;          // 每轮题数（规范 5.8）

  var st = {
    subject: null,
    chapters: [],
    selected: [],
    session: null,
    timerId: null,
    locked: false,
    lastWrongIds: [],
    matchPicked: null
  };

  function $(id) { return document.getElementById(id); }

  function show(screenId) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    $(screenId).classList.add('is-active');
    window.scrollTo(0, 0);
  }

  // ══════════ 首页 ══════════
  /** 剩余可练次数；家长设置为 0 表示不限制（返回 Infinity） */
  function sessionsLeft(sub) {
    var limit = Store.getSettings().timesPerDay;
    if (!limit) return Infinity;
    return limit - Store.sessionsToday(sub);
  }

  function renderHome() {
    var settings = Store.getSettings();
    $('home-star-count').textContent = Store.starsTotal();
    var done = [];
    ['yuwen', 'shuxue', 'yingyu'].forEach(function (sub) {
      var left = sessionsLeft(sub);
      var enabled = settings.subjects[sub] !== false;
      var card = document.querySelector('.subject-card[data-subject="' + sub + '"]');
      var todayEl = $('today-' + sub);
      var starEl = $('stars-' + sub);
      var times = Store.sessionsToday(sub);
      starEl.textContent = '⭐ ' + Store.starsTotal(sub);
      if (!enabled) { todayEl.textContent = '已关闭'; card.classList.add('is-locked'); card.disabled = true; return; }
      card.classList.remove('is-locked');
      card.disabled = false;
      if (left === Infinity) {                                  // 不限制：只显示今天练了几次
        card.classList.remove('done-today');
        todayEl.textContent = times > 0 ? ('今天已经练了 ' + times + ' 次 👍') : '今天还没练，来一局吧';
      } else if (left > 0) {
        card.classList.remove('done-today');
        todayEl.textContent = '今天还能练 ' + left + ' 次';
      } else {
        card.classList.add('done-today');
        todayEl.textContent = '明天见 👋';
      }
    });
    var streak = Store.streak();
    $('checkin-text').textContent = streak > 0 ? ('连续打卡 ' + streak + ' 天') : '今天开始打卡吧';
  }

  // ══════════ 章节页 ══════════
  function openChapters(subject) {
    st.subject = subject;
    st.selected = [];
    Engine.load(subject).then(function () {
      st.chapters = Engine.chapters(subject);
      $('chap-subject').textContent = SUBJECT_NAME[subject];
      renderChapters();
      show('screen-chapters');
    }).catch(function (e) {
      alert('题库没加载出来：' + e.message + '\n请检查网络后重试。');
    });
  }

  /** 本地是否放了真人朗读音频（公网版没有 audio/ 目录 → 自动不显示音频按钮） */
  var hasAudio = false;

  /** 章节 → 音频文件映射（与老师提供的 mp3 命名保持一致） */
  function chapterAudio(chId) {
    var m = /^yy-u([1-6])$/.exec(chId);
    if (m) return { words: 'audio/u' + m[1] + '-words.mp3', story: 'audio/u' + m[1] + '-story.mp3' };
    if (chId === 'yy-p1') return { story: 'audio/project1.mp3' };
    if (chId === 'yy-p2') return { story: 'audio/project2.mp3' };
    if (chId === 'yy-dx') return { story: 'audio/daily-expressions.mp3' };
    return null;
  }

  var audioEl = null, audioBtnNow = null;
  function stopAudio() {
    if (audioEl) { try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {} }
    if (audioBtnNow) audioBtnNow.classList.remove('is-playing');
    audioBtnNow = null;
  }
  function playChapterAudio(src, btn) {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.addEventListener('ended', stopAudio);
      audioEl.addEventListener('error', function () {
        stopAudio();
        alert('这段音频没找到或无法播放（本地版需要 audio/ 文件夹里有对应的 mp3）。');
      });
    }
    var playing = audioEl.getAttribute('src') === src && !audioEl.paused && !audioEl.ended;
    stopAudio();
    if (playing) return;                       // 再点一次 = 停止
    audioEl.src = src;
    var pr = audioEl.play();
    if (pr && pr.then) {
      pr.then(function () { btn.classList.add('is-playing'); audioBtnNow = btn; })
        .catch(function () { alert('音频播放失败，请确认 audio/ 里有这个文件。'); });
    } else {
      btn.classList.add('is-playing'); audioBtnNow = btn;
    }
  }

  function renderChapters() {
    var list = $('chapter-list');
    list.innerHTML = '';
    stopAudio();
    st.chapters.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'chapter-row';
      var b = document.createElement('button');
      b.className = 'chapter-item';
      b.type = 'button';
      b.dataset.id = c.id;
      var name = document.createElement('span');
      name.className = 'ch-name';
      name.textContent = c.title;
      var cnt = document.createElement('span');
      cnt.className = 'ch-count';
      cnt.textContent = c.count + ' 题';
      b.appendChild(name); b.appendChild(cnt);
      b.addEventListener('click', function () {
        var i = st.selected.indexOf(c.id);
        if (i >= 0) st.selected.splice(i, 1); else st.selected.push(c.id);
        b.classList.toggle('is-selected', st.selected.indexOf(c.id) >= 0);
        Sound.tap(Store.getSettings().sound);
      });
      row.appendChild(b);

      // 本地版才有：真人朗读按钮（单词表 / 课文）
      if (hasAudio) {
        var au = chapterAudio(c.id);
        if (au) {
          if (au.words) row.appendChild(makeAudioBtn('🎧词', au.words, '听单词表'));
          if (au.story) row.appendChild(makeAudioBtn('🎧文', au.story, '听课文朗读'));
        }
      }
      list.appendChild(row);
    });
  }

  function makeAudioBtn(label, src, title) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chap-audio';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      playChapterAudio(src, btn);
    });
    return btn;
  }

  function startFromChapters() {
    var subject = st.subject;
    if (sessionsLeft(subject) <= 0) { alert('今天这一科已经练完啦，明天再来吧！\n（可以在「家长设置」里把次数改成「不限制」）'); return; }
    var built = Engine.buildSession({ subject: subject, chapterIds: st.selected, count: QUIZ_COUNT });
    if (!built.items.length) { alert('这一章还没有题目，换一章试试？'); return; }
    startSession(built.items);
  }

  // ══════════ 答题 ══════════
  function startSession(items) {
    var settings = Store.getSettings();
    st.session = Session.create({
      items: items,
      subject: st.subject,
      date: Store.today(),
      mode: 'level',
      durationMin: settings.duration
    });
    st.locked = false;
    st.matchPicked = null;
    st.renderSkips = 0;
    show('screen-quiz');
    Sound.ensure();                                  // iOS：首次交互解锁音频
    clearInterval(st.timerId);
    st.timerId = setInterval(tick, 250);             // 只负责渲染，时间由时间戳算
    renderQuestion();
    tick();
  }

  function tick() {
    var s = st.session;
    if (!s || s.finished) return;
    var left = s.remaining();
    $('quiz-timer').textContent = Session.fmtTime(left);
    $('quiz-timer').classList.toggle('is-low', left <= 60);
    if (left <= 0) endSession('timeup');
  }

  function renderLives() {
    var s = st.session;
    var out = '';
    for (var i = 0; i < s.maxLives; i++) out += (i < s.lives ? '❤️' : '🤍');
    $('quiz-lives').textContent = out;
  }

  function renderQuestion() {
    // 兜底：任何渲染异常都不该让孩子看到白屏，出错就跳过这道题继续（最多跳 3 道）
    try {
      renderQuestionInner();
    } catch (e) {
      if (window.console && console.error) console.error('题目渲染出错：', e);
      var s0 = st.session;
      if (!s0 || s0.finished) return;
      st.renderSkips = (st.renderSkips || 0) + 1;
      if (st.renderSkips > 3 || s0.index + 1 >= s0.total) { endSession('done'); return; }
      s0.next();
      renderQuestion();
    }
  }

  function renderQuestionInner() {
    var s = st.session, item = s.current();
    st.locked = false;
    st.matchPicked = null;
    $('quiz-feedback').hidden = true;
    if (!item) { endSession('done'); return; }

    $('quiz-index').textContent = '第 ' + (s.index + 1) + ' / ' + s.total + ' 题';
    $('quiz-progress').style.width = Math.round((s.index / s.total) * 100) + '%';
    renderLives();

    // 题干（语文带拼音注音）+ 朗读按钮
    var stemEl = $('quiz-stem');
    var stemHtml = (item.subject === 'yuwen' && item.stemPinyin)
      ? Pinyin.wrap(item.stem, item.stemPinyin)
      : Pinyin.plain(item.stem);
    stemEl.innerHTML = '<div class="stem-text">' + stemHtml + '</div>' +
      '<button type="button" class="speak-btn speak-stem" aria-label="朗读题目">🔈</button>';
    stemEl.querySelector('.speak-stem').addEventListener('click', function (e) {
      e.stopPropagation();
      speak(item.stem);
    });
    // 配图
    var img = $('quiz-image');
    if (item.imageUrl) { img.src = item.imageUrl; img.hidden = false; }
    else { img.hidden = true; img.removeAttribute('src'); }

    var optionsEl = $('quiz-options');
    var matchEl = $('quiz-match');
    optionsEl.innerHTML = '';        // 清空上一题的选项
    // 注意：#quiz-match 是容器，里面的 #match-left / #match-right 是两个子容器，
    // 只能清空它们的卡片，绝不能清空 #quiz-match 本身（否则子容器被删，配对题会渲染失败）
    var ml = $('match-left'), mr = $('match-right');
    if (ml) ml.innerHTML = '';
    if (mr) mr.innerHTML = '';
    if (item.type === 'match') {
      optionsEl.hidden = true;
      matchEl.hidden = false;
      renderMatch(item);
    } else {
      optionsEl.hidden = false;
      matchEl.hidden = true;
      item.options.forEach(function (optText, i) {
        // 选项外层用 div[role=button]：因为里面要放「朗读」按钮，HTML 不允许按钮嵌套
        var row = document.createElement('div');
        row.className = 'option';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        var key = document.createElement('span');
        key.className = 'opt-key';
        key.textContent = String.fromCharCode(65 + i);      // A B C D
        var label = document.createElement('span');
        label.className = 'opt-label';
        if (item.subject === 'yuwen' && item.optionsPinyin && item.optionsPinyin[i]) {
          label.innerHTML = Pinyin.wrap(optText, item.optionsPinyin[i]);
        } else {
          label.innerHTML = Pinyin.plain(optText);
        }
        var spk = document.createElement('button');
        spk.type = 'button';
        spk.className = 'speak-btn';
        spk.setAttribute('aria-label', '朗读这个选项');
        spk.textContent = '🔈';
        spk.addEventListener('click', function (e) {
          e.stopPropagation();                              // 点喇叭不要选中该项
          speak(optText);
        });
        row.appendChild(key); row.appendChild(label); row.appendChild(spk);
        row.addEventListener('click', function () { pickOption(i); });
        optionsEl.appendChild(row);
      });
    }
    // 朗读题干（可关闭；失败自动降级）
    var settings = Store.getSettings();
    if (settings.tts) speak(item.stem);
  }

  /** 纯英文文本用英文语音，含中文的（如“grandma 的中文意思是？”）用中文语音 */
  function pickLang(text) {
    var t = String(text || '');
    var hasEn = /[A-Za-z]/.test(t), hasZh = /[\u4e00-\u9fff]/.test(t);
    return (hasEn && !hasZh) ? 'en-US' : 'zh-CN';
  }

  /** 英语比中文再慢一档（一年级听英文单词/短句需要更清楚） */
  function pickRate(lang, base) {
    var r = base || 0.8;
    return (lang === 'en-US') ? Math.max(0.5, Math.round(r * 0.8 * 100) / 100) : r;
  }

  /** 朗读一段文本（遵守家长设置里的开关与语速） */
  function speak(text) {
    if (!text) return;
    var st2 = Store.getSettings();
    if (!st2.tts) return;
    var lang = pickLang(text);
    Speak.say(text, true, lang, pickRate(lang, st2.rate));
  }

  function pickOption(idx) {
    var s = st.session;
    if (st.locked || !s) return;
    var item = s.current();
    if (!item || item.answered) return;
    st.locked = true;
    var res = s.answer(idx);
    var buttons = $('quiz-options').querySelectorAll('.option');
    buttons.forEach(function (b, i) {
      b.classList.add('is-locked');       // div 没有 disabled，用类名锁视觉；逻辑锁在 pickOption 里
      if (i === item.correctIndex) b.classList.add('is-right');
      else if (i === idx) b.classList.add('is-wrong');
    });
    afterAnswer(res, item);
  }

  function afterAnswer(res, item) {
    var settings = Store.getSettings();
    Sound.correct(res.isRight && settings.sound);
    if (!res.isRight) Sound.wrong(settings.sound);
    // 错题本
    if (!res.isRight) Store.addWrong(st.session.subject, item.chapterId, item.qid);
    else Store.markRight(item.qid);

    $('fb-emoji').textContent = res.isRight ? '🎉' : '💪';
    var title = $('fb-title');
    title.textContent = res.isRight ? (st.session.combo >= 3 ? ('太厉害了！连对 ' + st.session.combo + ' 题！') : '答对啦！') : '再试一次';
    title.className = 'fb-title ' + (res.isRight ? 'ok' : 'no');
    $('fb-explain').textContent = item.explain || '';
    $('btn-next').textContent = (res.gameOver || st.session.isLast()) ? '看看成绩 →' : '下一题 →';
    $('quiz-feedback').hidden = false;
    renderLives();
  }

  function nextQuestion() {
    var s = st.session;
    if (!s || s.finished) return;
    if (s.lives <= 0) { endSession('gameover'); return; }
    if (s.isLast() || s.index + 1 >= s.total) { endSession('done'); return; }
    s.next();
    renderQuestion();
  }

  // ── 配对玩法 ──
  function renderMatch(item) {
    item.correctIndex = 0;                              // 配对题：全部配对完成即算答对
    item.pairs.forEach(function (p) { p._done = false; });
    var left = $('match-left'), right = $('match-right');
    if (!left || !right) {          // 防御：万一容器被破坏，就地重建，保证配对题永远能渲染
      $('quiz-match').innerHTML = '<div class="match-col" id="match-left"></div>' +
                                  '<div class="match-col" id="match-right"></div>';
      left = $('match-left'); right = $('match-right');
    }
    left.innerHTML = ''; right.innerHTML = '';
    var rightOrder = Engine.shuffle(item.pairs.map(function (p, i) { return i; }));
    item.pairs.forEach(function (p, i) {
      left.appendChild(matchCard(p.left, p.leftPinyin, 'left', i, item));
    });
    rightOrder.forEach(function (i) {
      var p = item.pairs[i];
      right.appendChild(matchCard(p.right, p.rightPinyin, 'right', i, item));
    });
  }

  function matchCard(text, py, side, pairIndex, item) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'match-card';
    b.dataset.side = side;
    b.dataset.pair = pairIndex;
    b.innerHTML = (item.subject === 'yuwen' && py) ? Pinyin.wrap(text, py) : Pinyin.plain(text);
    b.addEventListener('click', function () { pickMatchCard(b, item); });
    return b;
  }

  function pickMatchCard(card, item) {
    if (st.locked || card.classList.contains('is-done')) return;
    Sound.tap(Store.getSettings().sound);
    if (!st.matchPicked) {
      st.matchPicked = card;
      card.classList.add('is-picked');
      return;
    }
    var first = st.matchPicked;
    if (first === card) { card.classList.remove('is-picked'); st.matchPicked = null; return; }
    if (first.dataset.side === card.dataset.side) {      // 同侧：换一张
      first.classList.remove('is-picked');
      st.matchPicked = card;
      card.classList.add('is-picked');
      return;
    }
    var a = first.dataset.side === 'left' ? first : card;
    var b = first.dataset.side === 'left' ? card : first;
    st.matchPicked = null;
    first.classList.remove('is-picked');
    if (a.dataset.pair === b.dataset.pair) {
      a.classList.add('is-done'); b.classList.add('is-done');
      item.pairs[Number(a.dataset.pair)]._done = true;
      if (item.pairs.every(function (p) { return p._done; })) {   // 全部配对成功
        st.locked = true;
        var res = st.session.answer(0);
        afterAnswer(res, item);
      }
    } else {
      a.classList.add('is-bad'); b.classList.add('is-bad');
      Sound.wrong(Store.getSettings().sound);
      setTimeout(function () { a.classList.remove('is-bad'); b.classList.remove('is-bad'); }, 320);
    }
  }

  // ══════════ 结算 ══════════
  function endSession(reason) {
    var s = st.session;
    if (!s || s.finished) return;
    clearInterval(st.timerId);
    st.timerId = null;
    var summary = s.finish();
    summary.reason = reason;
    if (summary.answered > 0) {
      Store.addRecord({
        date: Store.today(), subject: summary.subject,
        right: summary.right, wrong: summary.wrong, total: summary.answered,
        seconds: summary.seconds, stars: summary.stars, score: summary.score
      });
      Store.markDone(summary.subject);
    }
    st.lastWrongIds = summary.wrongItems.map(function (it) { return it.qid; });
    renderResult(summary);
    show('screen-result');
    Sound.finish(Store.getSettings().sound);
    if (summary.stars >= 2) confetti();
    Speak.say(summary.stars >= 2 ? '太棒了！' : '今天的学习完成啦', Store.getSettings().tts);
  }

  function renderResult(sum) {
    var starText = '';
    for (var i = 0; i < 3; i++) starText += (i < sum.stars ? '⭐' : '☆');
    $('res-stars').textContent = starText;
    $('res-emoji').textContent = sum.reason === 'timeup' ? '⏰' : (sum.stars >= 2 ? '🎉' : '💪');
    $('res-title').textContent = sum.reason === 'timeup'
      ? '时间到啦，今天先到这里'
      : (sum.stars >= 3 ? '太棒了！全对高手！' : (sum.stars >= 2 ? '做得很好！' : '继续加油！'));
    var rate = sum.answered ? Math.round(sum.right / sum.answered * 100) : 0;
    var mm = Math.floor(sum.seconds / 60), ss = sum.seconds % 60;
    var rows = [
      ['得分', sum.score + ' 分'],
      ['正确率', rate + '%'],
      ['答对 / 总数', sum.right + ' / ' + sum.answered],
      ['用时', mm + ' 分 ' + (ss < 10 ? '0' : '') + ss + ' 秒'],
      ['最高连对', sum.bestCombo + ' 题']
    ];
    var ul = $('res-stats');
    ul.innerHTML = '';
    rows.forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + r[0] + '</span><b>' + r[1] + '</b>';
      ul.appendChild(li);
    });
    var box = $('res-wrong-box'), list = $('res-wrong');
    list.innerHTML = '';
    if (sum.wrongItems.length) {
      box.hidden = false;
      sum.wrongItems.forEach(function (it) {
        var d = document.createElement('div');
        d.className = 'wrong-item';
        var right = (it.type === 'match') ? '全部配对' : (it.options ? it.options[it.correctIndex] : '');
        d.innerHTML = '<div>' + (it.subject === 'yuwen' && it.stemPinyin ? Pinyin.wrap(it.stem, it.stemPinyin) : Pinyin.plain(it.stem)) +
          '</div><div class="w-ans">正确答案：' + Pinyin.plain(right) + '</div>';
        list.appendChild(d);
      });
    } else {
      box.hidden = true;
    }
    $('btn-retry-wrong').hidden = !sum.wrongItems.length;
  }

  function confetti() {
    var box = document.createElement('div');
    box.className = 'confetti';
    var colors = ['#43a047', '#1e88e5', '#ef6c00', '#ec407a', '#fdd835'];
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3600);
  }

  // ══════════ 家长设置 ══════════
  function openParent() {
    var s = Store.getSettings();
    $('set-duration').value = String(s.duration);
    $('set-times').value = String(s.timesPerDay);
    $('set-tts').checked = !!s.tts;
    $('set-rate').value = String(s.rate || 0.8);
    $('set-sound').checked = !!s.sound;
    $('set-yuwen').checked = s.subjects.yuwen !== false;
    $('set-shuxue').checked = s.subjects.shuxue !== false;
    $('set-yingyu').checked = s.subjects.yingyu !== false;
    renderChart();
    show('screen-parent');
  }

  function renderChart() {
    var data = Store.weekly();
    var box = $('parent-chart');
    box.innerHTML = '';
    data.forEach(function (d) {
      var wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = Math.max(4, d.rate) + '%';
      bar.title = d.date + '：' + d.rate + '%';
      var lab = document.createElement('div');
      lab.className = 'bar-label';
      lab.textContent = d.label;
      wrap.appendChild(bar); wrap.appendChild(lab);
      box.appendChild(wrap);
    });
  }

  function bindParent() {
    $('set-duration').addEventListener('change', function () { Store.saveSettings({ duration: Number(this.value) }); });
    $('set-times').addEventListener('change', function () { Store.saveSettings({ timesPerDay: Number(this.value) }); });
    $('set-tts').addEventListener('change', function () { Store.saveSettings({ tts: this.checked }); });
    $('set-rate').addEventListener('change', function () { Store.saveSettings({ rate: Number(this.value) }); });
    $('btn-test-speak').addEventListener('click', function () {
      var st4 = Store.getSettings();
      Speak.say('Hello! This is my mum. I can sing.', true, 'en-US', pickRate('en-US', st4.rate));
      $('voice-info').textContent = '当前英文语音：' + (Speak.voiceInfo ? Speak.voiceInfo('en-US') : '不可用')
        + '　（若发音含混，建议在 iPad「设置 → 辅助功能 → 朗读内容 → 声音 → 英语」里下载增强音质）';
    });
    $('set-sound').addEventListener('change', function () { Store.saveSettings({ sound: this.checked }); });
    $('set-yuwen').addEventListener('change', function () {
      var s = Store.getSettings(); s.subjects.yuwen = this.checked; Store.saveSettings({ subjects: s.subjects });
    });
    $('set-shuxue').addEventListener('change', function () {
      var s = Store.getSettings(); s.subjects.shuxue = this.checked; Store.saveSettings({ subjects: s.subjects });
    });
    $('set-yingyu').addEventListener('change', function () {
      var s = Store.getSettings(); s.subjects.yingyu = this.checked; Store.saveSettings({ subjects: s.subjects });
    });
    $('btn-clear').addEventListener('click', function () {
      if (confirm('确定要清空所有成绩、错题和星星吗？这个操作不能撤销。')) {
        Store.clearAll();
        renderChart();
        alert('已经清空啦。');
      }
    });
  }

  // ══════════ 事件绑定 ══════════
  function bind() {
    document.querySelectorAll('.subject-card[data-subject]').forEach(function (card) {
      card.addEventListener('click', function () {
        var sub = card.dataset.subject;
        Sound.ensure();
        Sound.tap(Store.getSettings().sound);
        if (sessionsLeft(sub) <= 0) { alert('今天这一科已经练完啦，明天再来吧！\n（可以在「家长设置」里把次数改成「不限制」）'); return; }
        openChapters(sub);
      });
    });

    $('btn-start').addEventListener('click', startFromChapters);
    $('btn-next').addEventListener('click', nextQuestion);
    $('btn-to-home').addEventListener('click', function () { renderHome(); show('screen-home'); });
    $('btn-retry-wrong').addEventListener('click', function () {
      if (!st.lastWrongIds.length) return;
      var built = Engine.buildSession({ subject: st.subject, wrongIds: st.lastWrongIds, count: st.lastWrongIds.length });
      if (!built.items.length) { alert('错题暂时找不到了。'); return; }
      startSession(built.items);
    });

    document.querySelectorAll('[data-back]').forEach(function (b) {
      b.addEventListener('click', function () {
        renderHome();
        show(b.closest('#screen-parent') ? 'screen-home' : 'screen-home');
      });
    });

    // 家长入口：点一下直接进入（里面的危险操作——清空数据——有二次确认，不会点一下就毁数据）
    $('btn-parent').addEventListener('click', function (e) {
      e.preventDefault();
      openParent();
    });

    // 切回前台立即重算剩余时间（时间戳差值，不白送时间）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
    window.addEventListener('orientationchange', function () { tick(); });
  }

  function probeAudio() {
    // 公网版没有 audio/ 目录，HEAD 会 404 → 自动不显示音频按钮
    return fetch('audio/u1-words.mp3', { method: 'HEAD' })
      .then(function (r) {
        hasAudio = !!r.ok;
        if (hasAudio && $('screen-chapters').classList.contains('is-active')) renderChapters();
      })
      .catch(function () { hasAudio = false; });
  }

  function init() {
    bind();
    bindParent();
    renderHome();
    probeAudio();
    // 预加载题库，进章节更快
    Engine.load('yuwen').catch(function () {});
    Engine.load('shuxue').catch(function () {});
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
