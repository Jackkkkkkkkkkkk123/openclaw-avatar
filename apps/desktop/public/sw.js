// OpenClaw Avatar Service Worker - 离线支持
const CACHE_NAME = 'openclaw-avatar-v1';
const STATIC_CACHE = 'openclaw-static-v1';
const DYNAMIC_CACHE = 'openclaw-dynamic-v1';

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Live2D 模型会在运行时缓存
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // 立即控制所有页面
  self.clients.claim();
});

// 网络请求策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 HTTP(S) 请求
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 跳过 WebSocket 请求
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // API 请求使用 Network First 策略
  if (url.pathname.startsWith('/api') || url.hostname === 'api.fish.audio') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Live2D 模型使用 Cache First 策略 (大文件)
  if (url.pathname.includes('/live2d/') || url.pathname.endsWith('.moc3') || 
      url.pathname.endsWith('.model3.json') || url.pathname.endsWith('.moc')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 静态资源使用 Stale While Revalidate 策略
  if (request.destination === 'script' || request.destination === 'style' ||
      request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // HTML 使用 Network First
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他请求使用 Network First
  event.respondWith(networkFirst(request));
});

// Cache First 策略 - 优先使用缓存
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Network First 策略 - 优先使用网络
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // 返回离线页面
    if (request.destination === 'document') {
      return caches.match('/');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Stale While Revalidate 策略 - 返回缓存同时更新
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// 后台同步 - 离线时排队的消息
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // 获取待发送的消息
  const db = await openDB();
  const messages = await db.getAll('pending-messages');
  
  for (const msg of messages) {
    try {
      // 尝试发送
      await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(msg)
      });
      await db.delete('pending-messages', msg.id);
    } catch (e) {
      console.log('[SW] Sync failed for message:', msg.id);
    }
  }
}

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || '初音有新消息！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    tag: 'miku-notification',
    renotify: true,
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'OpenClaw Avatar', options)
  );
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 如果已有窗口，聚焦
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data);
      }
    })
  );
});

console.log('[SW] Service Worker loaded');
