const $=id=>document.getElementById(id);
const viewer=$('viewer'),stage=$('stage'),loading=$('loading'),rotate=$('rotate'),modal=$('photoModal');
const START_THETA=-32,START_PHI=72;
let ready=false,wantsRotation=true,selected=null,parts=[],modelURL=null,controller=null,bootId=0,returnFocus=null;
function syncRotation(){
 const active=ready&&wantsRotation&&!document.hidden&&!modal.open;
 viewer.autoRotate=active;rotate.setAttribute('aria-pressed',String(active));
 $('rotateLabel').textContent=active?'إيقاف الدوران':'بدء الدوران';rotate.firstElementChild.textContent=active?'Ⅱ':'↻';
}
function fit(){
 if(!ready||!stage.clientHeight)return;
 const d=viewer.getDimensions(),c=viewer.getBoundingBoxCenter(),p=START_PHI*Math.PI/180;
 const tanV=Math.tan(38*Math.PI/360),tanH=tanV*stage.clientWidth/stage.clientHeight;
 let distance=0;
 // Fit all eight bounding-box corners throughout a full rotation, with a small margin.
 for(let angle=0;angle<360;angle+=5){const t=angle*Math.PI/180;
  for(const x of [-d.x/2,d.x/2])for(const y of [-d.y/2,d.y/2])for(const z of [-d.z/2,d.z/2]){
   const horizontal=Math.cos(t)*x-Math.sin(t)*z;
   const vertical=-Math.cos(p)*Math.sin(t)*x+Math.sin(p)*y-Math.cos(p)*Math.cos(t)*z;
   const depth=Math.sin(p)*Math.sin(t)*x+Math.cos(p)*y+Math.sin(p)*Math.cos(t)*z;
   distance=Math.max(distance,Math.abs(horizontal)/(tanH*.94)+depth,Math.abs(vertical)/(tanV*.94)+depth);
  }
 }
 viewer.cameraTarget=`${c.x}m ${c.y}m ${c.z}m`;viewer.cameraOrbit=`${START_THETA}deg ${START_PHI}deg ${distance}m`;
 viewer.minCameraOrbit=`auto 22deg ${distance*.35}m`;viewer.maxCameraOrbit=`auto 157deg ${distance*3}m`;viewer.jumpCameraToGoal();
}
rotate.onclick=()=>{wantsRotation=!wantsRotation;syncRotation()};
viewer.addEventListener('pointerdown',()=>{wantsRotation=false;syncRotation()},{passive:true});
$('reset').onclick=()=>{viewer.resetTurntableRotation(0);fit();wantsRotation=true;syncRotation()};
$('fullscreen').onclick=async()=>{const section=document.querySelector('.viewer-section');try{if(document.fullscreenElement)await document.exitFullscreen();else if(section.requestFullscreen)await section.requestFullscreen();else section.scrollIntoView({block:'start',behavior:'smooth'})}catch{section.scrollIntoView({block:'start'})}};
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fit,180)}).observe(stage);
document.addEventListener('visibilitychange',syncRotation);
function select(part){
 selected=part;$('detailPhoto').src=part.image;$('detailPhoto').alt=part.name;$('photoOpen').setAttribute('aria-label',`تكبير صورة البويلر ${parts.indexOf(part)+1}`);
 for(const b of $('partsList').children)b.setAttribute('aria-pressed',String(b.dataset.id===part.id));$('photoCount').textContent=`${parts.indexOf(part)+1} / ${parts.length}`;
}
async function gallery(){
 try{const r=await fetch('./parts.json?v=20261020-1',{cache:'no-cache'});if(!r.ok)throw Error('gallery');parts=await r.json();if(!Array.isArray(parts)||parts.length!==8)throw Error('gallery');
  for(const [i,part] of parts.entries()){
   const b=document.createElement('button');b.type='button';b.dataset.id=part.id;b.setAttribute('aria-label',`عرض الصورة ${i+1} من 8`);b.setAttribute('aria-pressed','false');
   const img=document.createElement('img');img.src=part.thumb;img.alt='';img.loading='lazy';img.decoding='async';b.append(img);b.onclick=()=>select(part);$('partsList').append(b);
  }select(parts[0]);
 }catch{$('galleryError').hidden=false}
}
$('detailPhoto').onerror=()=>{$('galleryError').hidden=false};
$('photoOpen').onclick=()=>{if(!selected||!$('detailPhoto').naturalWidth)return;returnFocus=document.activeElement;$('modalTitle').textContent=`صور البويلر · ${parts.indexOf(selected)+1} / 8`;$('modalPhoto').src=selected.image;$('modalPhoto').alt=selected.name;modal.showModal();document.body.style.overflow='hidden';syncRotation()};
$('modalClose').onclick=()=>modal.close();
modal.addEventListener('close',()=>{document.body.style.overflow='';$('modalPhoto').removeAttribute('src');syncRotation();returnFocus?.focus({preventScroll:true})});
function phase(message,percent=null){
 $('loadStep').textContent=message;const indeterminate=percent===null;$('loadTrack').classList.toggle('is-indeterminate',indeterminate);$('loadPercent').hidden=indeterminate;
 if(indeterminate){$('loadTrack').removeAttribute('aria-valuenow');return}const n=Math.min(100,Math.max(0,Math.floor(percent)));$('loadPercent').textContent=n+'%';$('progress').style.width=n+'%';$('loadTrack').setAttribute('aria-valuenow',n);
}
function fail(message){ready=false;syncRotation();loading.hidden=true;$('error').hidden=false;$('errorText').textContent=message;rotate.disabled=true;$('reset').disabled=true}
async function download(manifest,signal){
 if(!Number.isSafeInteger(manifest.bytes)||manifest.bytes<12||!/^[0-9a-f]{64}$/.test(manifest.sha256))throw Error('بيانات المجسم غير صالحة.');
 const u=new URL(manifest.model,document.baseURI);if(u.origin!==location.origin)throw Error('رابط المجسم غير صالح.');u.searchParams.set('v',manifest.sha256.slice(0,12));
 const response=await fetch(u,{signal});if(!response.ok)throw Error('تعذّر تنزيل المجسم. تحقق من الاتصال وأعد المحاولة.');let result;
 if(response.body?.getReader){const chunks=[],reader=response.body.getReader();let count=0;
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>manifest.bytes){await reader.cancel();throw Error('حجم المجسم لا يطابق بياناته.')}chunks.push(value);phase('جارٍ تنزيل مجسم البويلر…',count/manifest.bytes*100)}result=new Blob(chunks,{type:'model/gltf-binary'});
 }else result=await response.blob();
 if(result.size!==manifest.bytes)throw Error('لم يكتمل تنزيل المجسم. أعد المحاولة.');
 phase('جارٍ التحقق من الملف وتجهيز الخامات…');const buf=await result.arrayBuffer(),view=new DataView(buf);
 if(buf.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buf.byteLength)throw Error('صيغة المجسم غير صالحة.');
 if(!crypto.subtle)throw Error('افتح الرابط عبر اتصال HTTPS لإكمال التحقق.');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buf)),hash=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==manifest.sha256)throw Error('تعذّر التحقق من سلامة المجسم. أعد المحاولة.');return URL.createObjectURL(result);
}
viewer.addEventListener('load',()=>{ready=true;requestAnimationFrame(()=>{fit();loading.hidden=true;viewer.dataset.verified='true';rotate.disabled=false;$('reset').disabled=false;syncRotation()})});
viewer.addEventListener('error',()=>fail('تعذّر عرض المجسم. أعد المحاولة أو افتح الرابط في متصفح آخر.'));
async function boot(){
 const id=++bootId;controller?.abort();controller=new AbortController();ready=false;syncRotation();$('error').hidden=true;loading.hidden=false;phase('جارٍ تحميل بيانات العارض…',0);
 try{const mp=await fetch('./manifest.json',{cache:'no-cache',signal:controller.signal});if(!mp.ok)throw Error('تعذّر تحميل بيانات العارض.');const manifest=await mp.json();
  const [url]=await Promise.all([download(manifest,controller.signal),import(manifest.runtime)]);if(id!==bootId){URL.revokeObjectURL(url);return}
  await customElements.whenDefined('model-viewer');customElements.get('model-viewer').minimumRenderScale=.5;if(modelURL)URL.revokeObjectURL(modelURL);modelURL=url;phase('جارٍ فتح العرض ثلاثي الأبعاد…');viewer.src=url;
 }catch(e){if(id===bootId&&e.name!=='AbortError')fail(e.message||'تعذّر تحميل العارض.')}
}
$('retry').onclick=boot;
// Keep the verified model available when returning through the back/forward cache.
window.addEventListener('pagehide',()=>{viewer.autoRotate=false});window.addEventListener('pageshow',syncRotation);
gallery();boot();
