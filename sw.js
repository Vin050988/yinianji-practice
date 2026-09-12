/* 一年级练习 App · Service Worker
 * 策略：核心资源预缓存 + 运行时懒缓存（cache-first，网络兜底）。
 * 断网时仍可进入并答题（题目数据在 data/*.json，首次加载后即被缓存）。
 */
const VERSION = 'ypApp-v1.1.2';
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
      // 单个资源失败不影响整体安装（例如图片缺失）
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
    caches.match(req).then((hit) => {
      if (hit) {
        // 后台更新，下次生效
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        }).catch(() => null);
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
