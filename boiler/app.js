import {createHotspotOverlay} from './hotspot-overlay.js';
const $=id=>document.getElementById(id);
const viewer=$('viewer'),stage=$('stage'),loading=$('loading'),error=$('error');
const overlay=$('catalogOverlay'),modal=$('photoModal'),list=$('partsList'),photo=$('detailPhoto');
const rotate=$('rotate'),header=document.querySelector('header');
let parts=[],ready=false,rotating=false,frame=0,lastTick=0,theta=-32,phi=72,radius=3,fitRadius=3;
let selected=null,returnFocus=null,returnRotation=false,visibilityRotation=false,modelURL=null;
const START_THETA=-32,START_PHI=72;
function setRotation(value){
 rotating=!!value&&ready&&!document.hidden;
 cancelAnimationFrame(frame);frame=0;lastTick=0;
 rotate.setAttribute('aria-pressed',String(rotating));rotate.textContent=rotating?'Ⅱ':'↻';
 rotate.setAttribute('aria-label',rotating?'إيقاف الدوران التلقائي':'تشغيل الدوران التلقائي');
 if(rotating){const o=viewer.getCameraOrbit();theta=o.theta*180/Math.PI;phi=o.phi*180/Math.PI;radius=o.radius;frame=requestAnimationFrame(tick)}
}
function tick(time){
 if(!rotating)return;
 if(lastTick){theta=(theta+Math.min((time-lastTick)/1000,.05)*8)%360;viewer.cameraOrbit=`${theta}deg ${phi}deg ${radius}m`;viewer.jumpCameraToGoal?.()}
 lastTick=time;frame=requestAnimationFrame(tick);
}
function fit(){
 if(!ready)return;
 const d=viewer.getDimensions(),c=viewer.getBoundingBoxCenter();
 const t=START_THETA*Math.PI/180,p=START_PHI*Math.PI/180;
 const tanV=Math.tan(38*Math.PI/360),tanH=tanV*stage.clientWidth/Math.max(1,stage.clientHeight);
 const hx=(Math.abs(Math.cos(t))*d.x+Math.abs(Math.sin(t))*d.z)/2;
 const hy=(Math.abs(Math.cos(p)*Math.sin(t))*d.x+Math.sin(p)*d.y+Math.abs(Math.cos(p)*Math.cos(t))*d.z)/2;
 const hd=(Math.abs(Math.sin(p)*Math.sin(t))*d.x+Math.abs(Math.cos(p))*d.y+Math.abs(Math.sin(p)*Math.cos(t))*d.z)/2;
 fitRadius=(Math.max(hx/tanH,hy/(tanV*.86))+hd)*1.08;
 viewer.cameraTarget=`${c.x}m ${c.y}m ${c.z}m`;viewer.cameraOrbit=`${START_THETA}deg ${START_PHI}deg ${fitRadius}m`;
 viewer.minCameraOrbit=`auto 22deg ${fitRadius*.35}m`;viewer.maxCameraOrbit=`auto 157deg ${fitRadius*3}m`;viewer.jumpCameraToGoal?.();
}
rotate.onclick=()=>setRotation(!rotating);
viewer.addEventListener('pointerdown',()=>setRotation(false));
$('reset').onclick=()=>{setRotation(false);fit()};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch{}}
document.addEventListener('fullscreenchange',()=>{setRotation(false);requestAnimationFrame(fit)});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{setRotation(false);fit()},180)},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){visibilityRotation=rotating;setRotation(false)}else if(visibilityRotation&&overlay.hidden){setRotation(true);visibilityRotation=false}});
function select(part){
 selected=part;$('detailTitle').textContent=part.name;$('detailDescription').textContent=part.description;
 photo.alt=`الصورة الأصلية للبويلر: ${part.name}`;photo.src=part.image;
 $('catalogDetail').scrollTop=0;document.querySelector('.detail-desc').scrollTop=0;
 for(const b of list.children)b.setAttribute('aria-selected',String(b.dataset.id===part.id));
}
function openCatalog(part=selected){
 returnFocus=document.activeElement;returnRotation=rotating;setRotation(false);
 if(part)select(part);overlay.hidden=false;stage.inert=true;header.inert=true;
 $('catalogClose').focus({preventScroll:true});
 list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function closeCatalog(){
 overlay.hidden=true;stage.inert=false;header.inert=false;
 if(returnRotation)setRotation(true);returnRotation=false;
 (returnFocus?.isConnected?returnFocus:$('catalogOpen')).focus({preventScroll:true});
}
$('catalogOpen').onclick=()=>openCatalog();$('catalogClose').onclick=closeCatalog;
overlay.addEventListener('click',e=>{if(e.target===overlay)closeCatalog()});
function openPhoto(){if(!photo.complete||!photo.naturalWidth)return;$('modalTitle').textContent=selected.name;$('modalPhoto').src=selected.image;$('modalPhoto').alt=photo.alt;modal.hidden=false;overlay.inert=true;$('modalClose').focus({preventScroll:true})}
function closePhoto(){modal.hidden=true;overlay.inert=false;$('modalPhoto').removeAttribute('src');photo.focus({preventScroll:true})}
photo.onclick=openPhoto;photo.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPhoto()}};
$('modalClose').onclick=closePhoto;modal.onclick=e=>{if(e.target===modal)closePhoto()};
document.addEventListener('keydown',e=>{
 const active=!modal.hidden?modal:!overlay.hidden?overlay:null;
 if(e.key==='Escape'&&active){e.preventDefault();if(active===modal)closePhoto();else closeCatalog();return}
 if(e.key==='Tab'&&active){const focusable=[...active.querySelectorAll('button,[tabindex="0"]')].filter(n=>n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
});
$('back').onclick=()=>{if(!modal.hidden)closePhoto();else if(!overlay.hidden)closeCatalog();else if(history.length>1)history.back();else if(window.opener)window.close()};
function renderParts(){
 for(const part of parts){
  const b=document.createElement('button');b.type='button';b.dataset.id=part.id;b.setAttribute('aria-selected','false');b.setAttribute('aria-label',part.name);
  const img=document.createElement('img');img.src=part.thumb;img.alt='';img.loading='lazy';img.decoding='async';
  const name=document.createElement('span');name.textContent=part.name;b.append(img,name);b.onclick=()=>select(part);list.append(b);

 }
 createHotspotOverlay(viewer,stage,parts.filter(p=>p.position),part=>openCatalog(part));
 select(parts[0]);
}
photo.onerror=()=>{$('detailDescription').textContent=selected.description+'\nتعذّر تحميل الصورة. أعد فتحها بعد التحقق من الاتصال.'};
function phase(message,percent=null){
 $('loadStep').textContent=message;const indeterminate=percent===null;$('loadTrack').classList.toggle('is-indeterminate',indeterminate);$('loadPercent').hidden=indeterminate;
 if(!indeterminate){const n=Math.min(100,Math.max(0,Math.floor(percent)));$('loadPercent').textContent=n+'%';$('progress').style.width=n+'%';$('loadTrack').setAttribute('aria-valuenow',n)}else $('loadTrack').removeAttribute('aria-valuenow');
}
function fail(message){loading.hidden=true;error.hidden=false;$('errorText').textContent=message;}
async function download(manifest){
 const u=new URL(manifest.model,location.href);u.searchParams.set('v',manifest.sha256.slice(0,12));
 const response=await fetch(u);if(!response.ok)throw Error('تعذّر تنزيل المجسم. أعد تحميل الصفحة.');
 let result;
 if(response.body?.getReader){const chunks=[],reader=response.body.getReader();let count=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);count+=value.length;phase('جارٍ تنزيل نموذج البويلر…',count/manifest.bytes*100)}
  result=new Blob(chunks,{type:'model/gltf-binary'});
 }else{result=await response.blob();phase('اكتمل تنزيل النموذج',100)}
 if(result.size!==manifest.bytes)throw Error('ملف المجسم لم يكتمل. أعد تحميل الصفحة.');
 phase('جارٍ التحقق من الملف وتجهيز الخامات…');const buf=await result.arrayBuffer(),view=new DataView(buf);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buf.byteLength)throw Error('صيغة المجسم غير صالحة.');
 if(crypto.subtle){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buf));const hash=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==manifest.sha256)throw Error('تعذّر التحقق من سلامة الملف. أعد تحميل الصفحة.')}
 return URL.createObjectURL(result);
}
viewer.addEventListener('load',()=>{ready=true;setRotation(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{fit();loading.hidden=true;viewer.dataset.verified='true'}))});
viewer.addEventListener('error',()=>fail('تعذّر عرض المجسم. جرّب إعادة التحميل أو فتح الرابط في Chrome أو Edge.'));
async function boot(){
 try{
  const [mp,pp]=await Promise.all([fetch('./manifest.json'),fetch('./parts.json')]);if(!mp.ok||!pp.ok)throw Error('تعذّر تحميل بيانات العارض.');
  const manifest=await mp.json();parts=await pp.json();renderParts();
  phase('جارٍ تنزيل نموذج البويلر…',0);
  const [url]=await Promise.all([download(manifest),import(manifest.runtime)]);
  await customElements.whenDefined('model-viewer');
  customElements.get('model-viewer').minimumRenderScale=.5;modelURL=url;phase('جارٍ فتح العرض ثلاثي الأبعاد…');viewer.src=url;
 }catch(e){console.error(e);fail(e.message||'تعذّر تحميل العارض.')}
}
window.addEventListener('pagehide',()=>{setRotation(false);if(modelURL)URL.revokeObjectURL(modelURL)},{once:true});
boot();
