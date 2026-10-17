// FASTER B 3D Viewer — responsive whole-model framing and smooth auto-orbit.
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
const fullscreenBtn = document.getElementById('fullscreenBtn');
const progressBar = document.getElementById('progressBar');

const CAMERA_AZIMUTH_DEG = 35;
const CAMERA_POLAR_DEG = 72;
const CAMERA_FOV_DEG = 40;
const FIT_PADDING = 1.17;
let modelLoaded = false;
let lastStageWidth = 0;
let lastStageHeight = 0;
let currentItem = null;

function slugFromLocation() {
  const parts = location.pathname.split('/').filter(Boolean);
  const p = parts.indexOf('p');
  if (p >= 0 && parts[p + 1]) return decodeURIComponent(parts[p + 1]);
  return new URLSearchParams(location.search).get('id') || 'fasterb-electric-press-42-50l';
}

function goBackToQuote() {
  if (document.referrer && history.length > 1) {
    history.back();
  } else {
    window.close();
    setTimeout(() => {
      if (!document.hidden) {
        loading.classList.remove('hidden');
        loadingTitle.textContent = 'استخدم زر الرجوع في المتصفح للعودة إلى عرض السعر';
        loadingText.textContent = '';
      }
    }, 400);
  }
}
backBtn.addEventListener('click', goBackToQuote);

function fitWholeMachine() {
  if (!modelLoaded) return;
  // Use the actual GLB dimensions rather than a fixed radius (e.g. 2.10 m).
  // A fixed radius crops large models, especially on narrow phone screens.
  const dimensions = viewer.getDimensions?.();
  const center = viewer.getBoundingBoxCenter?.();
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!dimensions || !center || width < 10 || height < 10) return;
  const dx = Math.abs(dimensions.x), dy = Math.abs(dimensions.y), dz = Math.abs(dimensions.z);
  if (![dx,dy,dz,center.x,center.y,center.z].every(Number.isFinite)) return;

  const theta = CAMERA_AZIMUTH_DEG * Math.PI / 180;
  const phi = CAMERA_POLAR_DEG * Math.PI / 180;
  const verticalTan = Math.tan(CAMERA_FOV_DEG * Math.PI / 360);
  const horizontalTan = verticalTan * (width / height);

  // Project the model's bounding box into the chosen orbit camera axes.
  const halfHorizontal = (Math.abs(Math.cos(theta)) * dx + Math.abs(Math.sin(theta)) * dz) / 2;
  const halfVertical = (
    Math.abs(Math.cos(phi) * Math.sin(theta)) * dx +
    Math.abs(Math.sin(phi)) * dy +
    Math.abs(Math.cos(phi) * Math.cos(theta)) * dz
  ) / 2;
  const halfDepth = (
    Math.abs(Math.sin(phi) * Math.sin(theta)) * dx +
    Math.abs(Math.cos(phi)) * dy +
    Math.abs(Math.sin(phi) * Math.cos(theta)) * dz
  ) / 2;

  const radius = Math.max(
    0.1,
    (Math.max(halfHorizontal / horizontalTan, halfVertical / verticalTan) + halfDepth) * FIT_PADDING
  );
  if (!Number.isFinite(radius)) return;

  // Prevent model-viewer's implicit zoom bounds from clipping the calculated fit.
  viewer.minCameraOrbit = 'auto auto ' + Math.max(0.025, radius * 0.45) + 'm';
  viewer.maxCameraOrbit = 'auto auto ' + (radius * 5) + 'm';
  viewer.cameraTarget = center.x + 'm ' + center.y + 'm ' + center.z + 'm';
  viewer.cameraOrbit = CAMERA_AZIMUTH_DEG + 'deg ' + CAMERA_POLAR_DEG + 'deg ' + radius + 'm';
  viewer.jumpCameraToGoal?.();

  lastStageWidth = width;
  lastStageHeight = height;
}

function resumeSmoothRotation() {
  // model-viewer's native auto-rotation uses its animation clock; no JS timer
  // and no per-frame DOM writes, reducing jank on mobile.
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('auto-rotate-delay', '0');
  viewer.setAttribute('rotation-per-second', '8deg');
}

resetBtn.addEventListener('click', () => {
  fitWholeMachine();
  resumeSmoothRotation();
});

fullscreenBtn?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Fullscreen is not supported by this browser', error);
  }
});
document.addEventListener('fullscreenchange', () => {
  if (modelLoaded) requestAnimationFrame(() => requestAnimationFrame(fitWholeMachine));
});

viewer.addEventListener('progress', event => {
  const progress = Math.max(0, Math.min(1, event.detail?.totalProgress ?? 0));
  if (progressBar) progressBar.style.width = Math.round(progress * 100) + '%';
  loadingText.textContent = Math.round(progress * 100) + '%';
});

viewer.addEventListener('load', () => {
  modelLoaded = true;
  // Wait for mobile layout to settle before calculating the fit.
  requestAnimationFrame(() => {
    fitWholeMachine();
    resumeSmoothRotation();
    loading.classList.add('hidden');
    fallback.classList.add('hidden');
    if (progressBar) progressBar.style.width = '100%';
  });
});

viewer.addEventListener('error', event => {
  console.error('model-viewer error', event);
  modelLoaded = false;
  if (currentItem) showFallback(currentItem);
});

function showFallback(item) {
  viewer.removeAttribute('src');
  if (item.reference) {
    fallbackImg.src = new URL(item.reference, document.baseURI).href;
    fallbackImg.hidden = false;
  } else {
    fallbackImg.hidden = true;
  }
  fallback.classList.remove('hidden');
  loading.classList.add('hidden');
}

async function load() {
  const slug = slugFromLocation();
  try {
    const response = await fetch(new URL('products.json', document.baseURI), {cache:'no-cache'});
    if (!response.ok) throw new Error('تعذر قراءة قائمة المعدات');
    const catalog = await response.json();
    const item = catalog.find(x => x.slug === slug);
    if (!item) throw new Error('المعدة المطلوبة غير موجودة في الكتالوج');
    currentItem = item;
    modelLoaded = false;

    productName.textContent = item.name;
    if (productCategory) productCategory.textContent = item.category || '';
    document.title = item.name + ' | FASTER B 3D';
    loading.classList.remove('hidden');
    loadingTitle.textContent = 'جاري تحميل النموذج ثلاثي الأبعاد…';
    loadingText.textContent = '0%';

    viewer.exposure = typeof item.exposure === 'number' ? item.exposure : 0.82;
    // Built-in neutral reflections avoid downloading/decoding an HDR map on phones.
    viewer.setAttribute('environment-image', 'neutral');
    viewer.setAttribute('tone-mapping', 'neutral');
    viewer.setAttribute('shadow-intensity', '0.15');
    viewer.setAttribute('shadow-softness', '0.9');
    viewer.setAttribute('interaction-prompt', 'none');
    viewer.setAttribute('field-of-view', CAMERA_FOV_DEG + 'deg');
    viewer.setAttribute('camera-orbit', CAMERA_AZIMUTH_DEG + 'deg ' + CAMERA_POLAR_DEG + 'deg auto');

    // Let model-viewer lower resolution adaptively rather than stalling frames.
    if ('minimumRenderScale' in viewer) viewer.minimumRenderScale = 0.5;

    const modelUrl = new URL(item.model, document.baseURI);
    if (item.slug === 'fasterb-fx42-press') {
      modelUrl.searchParams.set('rev', 'fx42-pbr-d58f435c-20261013');
    }
    fallback.classList.add('hidden');
    viewer.alt = 'مجسم ثلاثي الأبعاد: ' + item.name;
    if (item.reference) viewer.poster = new URL(item.reference, document.baseURI).href;
    else viewer.removeAttribute('poster');
    viewer.src = modelUrl.href;
  } catch (error) {
    console.error(error);
    loading.classList.remove('hidden');
    loadingTitle.textContent = 'تعذر فتح المعاينة';
    loadingText.textContent = String(error?.message || error);
  }
}
load();

// Reframe on true orientation/layout changes, not on every browser toolbar twitch.
let resizeScheduled = false;
window.addEventListener('resize', () => {
  if (!modelLoaded || resizeScheduled) return;
  resizeScheduled = true;
  setTimeout(() => {
    resizeScheduled = false;
    const w = stage.clientWidth, h = stage.clientHeight;
    const oldRatio = lastStageWidth / Math.max(1, lastStageHeight);
    const newRatio = w / Math.max(1, h);
    if (Math.abs(oldRatio - newRatio) > 0.18 || Math.abs(w - lastStageWidth) > 80) {
      fitWholeMachine();
    }
  }, 220);
}, {passive:true});

// Cache only requested models; never precache all GLBs on mobile.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
