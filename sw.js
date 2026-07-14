// Stable network-first service worker for PUZZ-LE on GitHub Pages.
// Normal releases may replace index.html/assets without renaming this file.
const CACHE_PREFIX='puzzle-le-pwa-';
const CACHE_NAME='puzzle-le-pwa-runtime-v1';
const APP_SHELL=[
  './index.html','./manifest.json','./icon.svg','./icons/icon-192.png','./icons/icon-512.png',
  './vendor/peerjs.min.js','./vendor/peerjs.LICENSE.txt',
  './assets/bomb1.mp3','./assets/bomb2.mp3','./assets/cleanup1.mp3','./assets/crystal.mp3',
  './assets/land1.mp3','./assets/line_clear.mp3','./assets/ui_confirm.mp3'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{ await refreshShell(); await self.skipWaiting(); })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  const type=typeof event.data==='string'?event.data:event.data?.type;
  if(type==='skip-waiting') event.waitUntil(self.skipWaiting());
  if(type==='refresh-shell') event.waitUntil(refreshShell().then(()=>event.ports?.[0]?.postMessage({ok:true})).catch(()=>event.ports?.[0]?.postMessage({ok:false})));
});

self.addEventListener('fetch',event=>{
  const request=event.request; if(request.method!=='GET') return;
  const url=new URL(request.url); if(url.origin!==self.location.origin) return;
  if(url.searchParams.has('__pwa_probe')) { event.respondWith(fetch(request,{cache:'no-store'})); return; }
  if(request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')) { event.respondWith(freshNavigation(request)); return; }
  event.respondWith(networkFirst(request));
});

async function refreshShell(){
  const cache=await caches.open(CACHE_NAME), stamp=Date.now();
  await Promise.all(APP_SHELL.map(async path=>{
    const canonical=new Request(path), freshUrl=new URL(path,self.location.href); freshUrl.searchParams.set('__pwa_shell',stamp);
    const response=await fetch(freshUrl,{cache:'no-store'}); if(!response.ok) throw new Error(`shell ${response.status}: ${path}`);
    await cache.put(canonical,response.clone());
  }));
}

async function freshNavigation(request){
  const cache=await caches.open(CACHE_NAME), canonical=new Request('./index.html');
  try {
    const freshUrl=new URL(request.url); freshUrl.searchParams.set('__pwa_fresh',Date.now());
    const fresh=await fetch(freshUrl,{cache:'no-store',credentials:'same-origin'});
    if(!fresh.ok) throw new Error(`navigation ${fresh.status}`);
    await cache.put(canonical,fresh.clone()); return fresh;
  } catch(_) {
    const cached=await cache.match(canonical); if(cached) return cached;
    return new Response('PUZZ-LEを一度オンラインで起動してください。',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
}

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try {
    const fresh=await fetch(new Request(request,{cache:'reload'}));
    if(fresh&&fresh.ok) await cache.put(request,fresh.clone());
    return fresh;
  } catch(error) {
    const cached=await cache.match(request,{ignoreSearch:false}); if(cached) return cached;
    throw error;
  }
}
