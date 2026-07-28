/* Workout site service worker — app shell cached for offline use.
   Bump CACHE_V whenever index.html changes so users get the update. */
var CACHE_V = "po-v2";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE_V).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE_V; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  // Never cache map tiles or routing/search calls — always live
  if(/tile\.openstreetmap\.org|router\.project-osrm\.org|nominatim/.test(url.host)) return;
  if(url.origin === location.origin){
    // App shell: cache-first, network fallback
    e.respondWith(caches.match(e.request).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); });
        return res;
      });
    }));
  } else {
    // CDN (fonts, leaflet): network-first, cached fallback for offline
    e.respondWith(fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){ return caches.match(e.request); }));
  }
});
