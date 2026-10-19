const CACHE = 'hishab-shell-v11';
const ASSETS = ['/static/app.css','/static/app.js','/static/extensions.js','/static/web-sync.js','/static/finance.js','/static/finance.css','/static/regulars.js','/static/navigation.js','/static/i18n.js','/static/wallet-branding.js','/static/back-navigation.js','/static/NotoSansBengali-400.ttf','/static/NotoSansBengali-600.ttf','/static/wallet-logos/primenow.png','/static/wallet-logos/primebank.png','/static/wallet-logos/bkash.png','/static/wallet-logos/city.png','/static/wallet-logos/sonali.png','/static/wallet-logos/janata.png','/static/icon.svg','/static/hishab-logo-v2.png','/static/hishab-icon-v2-192.png','/static/hishab-icon-v2-512.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hishab-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache account sessions, API responses, exports, or financial data.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
