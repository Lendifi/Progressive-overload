/* Progressive Overload service worker (po-v11, build v18.1).
   - The page document is network-first (so new deploys always land).
   - Same-origin app files are cache-first; only successful (200) responses are stored.
   - Only the map library and fonts CDNs are cached (network-first, offline fallback).
   - Everything else cross-origin is NOT intercepted at all: map tiles, routing and
     place search always go straight to the network, so a bad tile can never be pinned. */
var CACHE_V = "po-v11";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
var CDN = /^(unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
var TILE_PATH = /\/\d+\/\d+\/\d+(@2x)?(\.(png|jpe?g|webp|pbf|mvt))?$/;

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
  var same = url.origin === location.origin;

  // Map tiles (any provider), routing, place search: never intercepted, never cached
  if(!same && (!CDN.test(url.host) || TILE_PATH.test(url.pathname))) return;

  var isDoc = e.request.mode === "navigate" || url.pathname === "/" || url.pathname.slice(-11) === "/index.html";

  if(same && isDoc){
    // NETWORK-FIRST for the page: fresh deploys win, cache is the offline fallback
    e.respondWith(fetch(e.request).then(function(res){
      if(res.ok){ var copy = res.clone(); caches.open(CACHE_V).then(function(c){ c.put("./index.html", copy); }); }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(h){ return h || caches.match("./index.html"); });
    }));
  } else if(same){
    e.respondWith(caches.match(e.request).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        if(res.ok){ var copy = res.clone(); caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); }); }
        return res;
      });
    }));
  } else {
    // CDN (fonts, map library): network-first with cached fallback for offline
    e.respondWith(fetch(e.request).then(function(res){
      if(res.ok || res.type === "opaque"){ var copy = res.clone(); caches.open(CACHE_V).then(function(c){ c.put(e.request, copy); }); }
      return res;
    }).catch(function(){ return caches.match(e.request); }));
  }
});
