/* Keeps Selah working offline: every app file is saved on the phone at install.
   Bump VERSION whenever an app file changes so phones pick up the new files. */
const VERSION='selah-v1.0.1';
const FILES=['./','index.html','style.css','app.js','parse.js','icons.js','verses.js','manifest.webmanifest',
 'icon-180.png','icon-192.png','icon-512.png','fonts/fonts.css',
 'fonts/Manrope-normal-latin.woff2','fonts/Manrope-normal-latin-ext.woff2',
 'fonts/PlayfairDisplay-normal-latin.woff2','fonts/PlayfairDisplay-normal-latin-ext.woff2',
 'fonts/PlayfairDisplay-italic-latin.woff2','fonts/PlayfairDisplay-italic-latin-ext.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))) /* skip the browser's own cache so updates arrive whole */.then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!=VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!='GET')return;
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).catch(()=>caches.match('index.html'))));
});
