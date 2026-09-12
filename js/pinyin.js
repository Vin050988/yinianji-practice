/* 一年级练习 App · 拼音注音渲染
 * 输入：汉字文本 + 空格分隔的拼音串（音节数与汉字数一一对应，见规范 5.5）
 * 输出：带 <ruby> 注音的 HTML
 * 说明：拼音个数不足时，后面没有拼音的汉字就不注音（不会错位）。
 */
window.Pinyin = (function () {
  var CJK = /[\u4e00-\u9fff]/;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** 文本 → HTML（汉字自动加注音） */
  function wrap(text, pinyin) {
    if (text == null) return '';
    var syl = (pinyin || '').trim() ? String(pinyin).trim().split(/\s+/) : [];
    var out = '', k = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (CJK.test(ch) && k < syl.length) {
        out += '<ruby>' + esc(ch) + '<rt>' + esc(syl[k++]) + '</rt></ruby>';
      } else {
        out += esc(ch);
      }
    }
    return out;
  }

  /** 纯文本 → HTML（不注音，用于数学题等） */
  function plain(text) { return esc(text); }

  /** 把 ruby 标记里的汉字取出来（给 TTS 朗读用） */
  function strip(html) { return String(html || '').replace(/<[^>]+>/g, ''); }

  return { wrap: wrap, plain: plain, esc: esc, strip: strip };
})();
