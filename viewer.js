const viewer = document.getElementById('viewer');
const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const loadingTitle = document.getElementById('loadingTitle');
const loadingText = document.getElementById('loadingText');
const fallback = document.getElementById('fallback');
const fallbackImg = document.getElementById('fallbackImg');
const productName = document.getElementById('productName');
const productCategory = document.getElementById('productCategory');
const backBtn = document.getElementById('backBtn');

const resetBtn = document.getElementById('resetBtn');
const fitBtn = document.getElementById('fitBtn');
const progressBar = document.getElementById('progressBar');
let defaultOrbit = null;
let defaultTarget = null;

function slugFromLocation(){
  const parts=location.pathname.split('/').filter(Boolean);
  const p=parts.indexOf('p');
  if(p>=0&&parts[p+1]) return decodeURIComponent(parts[p+1]);
  return new URLSearchParams(location.search).get('id')||'fasterb-electric-press-42-50l';
}

function goBackToQuote(){
  // The PDF reader may have opened a new browser tab without usable history.
  if (document.referrer && history.length > 1) {
    history.back();
  } else {
    window.close();
    // Browser security may prevent a website from closing a user-opened tab.
    setTimeout(() => { if (!document.hidden) loadingTitle.textContent = 'ارجع إلى عرض السعر باستخدام زر الرجوع في المتصفح'; }, 400);
  }
}
backBtn.addEventListener('click',goBackToQuote);
resetBtn.addEventListener('click',()=>{
  if(defaultOrbit) viewer.cameraOrbit=defaultOrbit;
  if(defaultTarget) viewer.cameraTarget=defaultTarget;
  viewer.jumpCameraToGoal?.();
});
fitBtn.addEventListener('click',()=>{
  viewer.cameraTarget='auto auto auto';
  viewer.cameraOrbit='auto auto auto';
  viewer.jumpCameraToGoal?.();
});
viewer.addEventListener('progress',(e)=>{
  const p=Math.max(0,Math.min(1,e.detail?.totalProgress??0));
  progressBar.style.width=`${Math.round(p*100)}%`;
  loadingText.textContent=`${Math.round(p*100)}%`;
});
viewer.addEventListener('load',()=>{
  defaultOrbit=viewer.getCameraOrbit ? `${viewer.getCameraOrbit().theta}rad ${viewer.getCameraOrbit().phi}rad ${viewer.getCameraOrbit().radius}m` : null;
  defaultTarget=viewer.getCameraTarget ? (()=>{const t=viewer.getCameraTarget();return `${t.x}m ${t.y}m ${t.z}m`;})() : null;
  loading.classList.add('hidden');
  fallback.classList.add('hidden');
  progressBar.style.width='100%';
});
viewer.addEventListener('error',(e)=>{
  console.error('model-viewer error',e);
  if(window.__currentItem) showFallback(window.__currentItem);
});

async function showFallback(item){
  viewer.removeAttribute('src');
  fallbackImg.src=new URL(item.reference, document.baseURI).href;
  fallback.classList.remove('hidden');
  loading.classList.add('hidden');
}

async function load(){
  const slug=slugFromLocation();
  try{
    const r=await fetch(new URL('products.json', document.baseURI),{cache:'no-cache'});
    if(!r.ok) throw new Error('تعذر قراءة قائمة المعدات');
    const catalog=await r.json();
    const item=catalog.find(x=>x.slug===slug);
    if(!item) throw new Error('المعدة المطلوبة غير موجودة في الكتالوج');
    productName.textContent=item.name;
    if (productCategory) productCategory.textContent=item.category||'';
    // Restore a balanced light setup only for the detailed ROTONDI model.
    viewer.exposure = item.slug === 'rotondi-spotting-table' ? 0.62 : 0.82;
    document.title=`${item.name} | Faster B 3D`;
    loadingTitle.textContent='جاري تحميل النموذج ثلاثي الأبعاد…';
    loadingText.textContent='0%';
    const url=new URL(item.model, document.baseURI).href;
    window.__currentItem=item;
    fallback.classList.add('hidden');
    viewer.alt=`3D model - ${item.name}`;
    if (item.reference) viewer.poster = new URL(item.reference, document.baseURI).href;
    else viewer.removeAttribute('poster');
    viewer.src=url;
  }catch(err){
    console.error(err);
    loading.classList.remove('hidden');
    loadingTitle.textContent='تعذر فتح المعاينة';
    loadingText.textContent=String(err?.message||err);
  }
}
load();


// Cache only the files the visitor actually opens. This keeps repeat previews fast
// without downloading every 3D model on first visit.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
