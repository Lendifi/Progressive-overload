/* Progressive Overload service worker.
   The page document is network-first (so new deploys always land);
   other same-origin assets are cache-first; tiles/routing are never touched. */
var CACHE_V = "po-v5";
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
  // Never intercept map tiles, routing, or place search — always live
  if(/tile\.openstreetmap\.org|cartocdn\.com|arcgisonline\.com|router\.project-osrm\.org|nominatim/.test(url.host)) return;

  var isDoc = e.request.mode === "navigate" || url.pathname === "/" || url.pathname.slice(-11) === "/index.html";

  if(url.origin === location.origin && isDoc){
    // NETWORK-FIRST for the page: fresh deploys win, cache is the offline fallback
    e.respondWith(fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_V).then(function(c){ c.put("./index.html", copy); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(h){ return h || caches.match("./index.html"); });
    }));
  } else if(url.origin === location.origin){
    e.respondWith(caches.match(e.request).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); });
        return res;
      });
    }));
  } else {
    // CDN (fonts, map library): network-first with cached fallback for offline
    e.respondWith(fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); });
      return res;
    }).catch(function(){ return caches.match(e.request); }));
  }
});
