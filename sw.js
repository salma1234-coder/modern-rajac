// Service Worker for Nursing Study Platform
const CACHE_NAME = 'nursing-platform-v2.0.0';
const STATIC_CACHE = 'static-v2.0.0';
const DYNAMIC_CACHE = 'dynamic-v2.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/server.js',
  '/alarm.mp3',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip external requests except Google Fonts
  if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          // For dynamic content, try network first
          if (request.url.includes('/api/') || request.url.includes('users.json')) {
            return fetch(request)
              .then((networkResponse) => {
                // Cache successful network responses
                if (networkResponse.ok) {
                  const responseClone = networkResponse.clone();
                  caches.open(DYNAMIC_CACHE)
                    .then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
              })
              .catch(() => response); // Fallback to cache if network fails
          }
          return response;
        }
        
        // Try network first for dynamic content
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              const cacheToUse = request.url.includes('/api/') || request.url.includes('users.json') 
                ? DYNAMIC_CACHE 
                : STATIC_CACHE;
              
              caches.open(cacheToUse)
                .then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback for HTML pages - serve cached index.html
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            // Return offline page for other requests
            return new Response('غير متصل بالإنترنت', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: {
                'Content-Type': 'text/plain; charset=utf-8'
              }
            });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgressData());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'لديك إشعار جديد من منصة الدراسة',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'فتح التطبيق',
        icon: '/manifest.json'
      },
      {
        action: 'close',
        title: 'إغلاق',
        icon: '/manifest.json'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('منصة دراسة التمريض', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Sync progress data when online
async function syncProgressData() {
  try {
    const offlineData = await getOfflineData();
    if (offlineData && offlineData.length > 0) {
      // Sync with server
      for (const data of offlineData) {
        await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
      }
      // Clear synced data
      await clearOfflineData();
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Helper functions for offline storage
async function getOfflineData() {
  // Implementation would depend on your storage strategy
  return [];
}

async function clearOfflineData() {
  // Implementation would depend on your storage strategy
}

// Message handling from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
