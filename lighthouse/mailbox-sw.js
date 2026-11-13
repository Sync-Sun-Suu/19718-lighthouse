// 灯台の郵便受けの呼び鈴：届いた通知を見せて、触ったら郵便受けを開く。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || '灯台の郵便受け', {
    body: d.body || '灯台から、一通。',
    icon: './mailbox-icon-192.png',
    badge: './mailbox-icon-192.png',
    tag: 'lighthouse-letter',
    renotify: true,
    data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('fetch', () => {});
