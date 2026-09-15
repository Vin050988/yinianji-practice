/* 一年级练习 App · Service Worker
 *
 * 缓存策略：network-first（网络优先）
 *   - 联网时总是取最新文件 → 在 Mac 上改完并 push 后，iPad 刷新一次即可拿到新版
 *   - 断网时回退到缓存 → 仍能进入并答题（前提：联网打开过一次）
 */
const VERSION = 'ypApp-v1.1.5';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/pinyin.js',
  './js/storage.js',
  './js/audio.js',
  './js/engine.js',
  './js/modes.js',
  './js/app.js',
  './data/yuwen-1-up.json',
  './data/shuxue-1-up.json',
  './data/yingyu-1-up.json',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // 单个资源失败不影响整体安装（例如某张图片缺失）
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => {
        // 断网兜底：先用缓存；打开页面这一请求找不到就回到首页
        return caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
