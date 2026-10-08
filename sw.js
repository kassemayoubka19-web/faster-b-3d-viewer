const CACHE='fasterb-3d-github-v2';
const SCOPE=self.registration.scope;
const core=['index.html','style.css','viewer.js','products.json'].map(x=>new URL(x,SCOPE).href);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(core)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request);
    if(hit) return hit;
    const r=await fetch(e.request);
    if(r.ok) c.put(e.request,r.clone());
    return r;
  }));
});
