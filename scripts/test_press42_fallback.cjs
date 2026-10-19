// Ensure embedded-app browsers with missing DecompressionStream can open FX42.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const exe=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert(exe,'Chrome missing');
 const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915}});
  const thirdParty=[];
  page.on('request',r=>{if(r.url().includes('ajax.googleapis.com/ajax/libs/model-viewer')||r.url().includes('cdn.jsdelivr.net/npm/@google/model-viewer'))thirdParty.push(r.url());});
  await page.addInitScript(()=>{
   Object.defineProperty(window,'DecompressionStream',{value:undefined,writable:true,configurable:true});
  });
  await page.goto('http://127.0.0.1:8795/press42/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.getElementById('loading').hidden||!document.getElementById('error').hidden,null,{timeout:150000});
  const result=await page.evaluate(()=>({
   opened:document.getElementById('loading').hidden,
   error:!document.getElementById('error').hidden?document.getElementById('errorText').textContent:'',
   decoderLoaded:!!window.fflate?.gunzipSync,
   modelReady:!!document.getElementById('viewer').src,
   fixedZoom:document.getElementById('viewer').hasAttribute('disable-zoom'),
   autoRotate:document.getElementById('viewer').dataset.rotationActive==='true',
   hotspots:document.querySelectorAll('[slot^="hotspot-"]').length
  }));
  console.log('IN_APP_FALLBACK_TEST',JSON.stringify({result,thirdParty}));
  assert(result.opened&&!result.error&&result.decoderLoaded&&result.modelReady,'In-app fallback failed');
  assert(result.fixedZoom&&result.autoRotate&&result.hotspots===0,'Approved viewer features changed');
  assert.equal(thirdParty.length,0,'External 3D runtime CDN must not be required');
  await page.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('IN_APP_FALLBACK_TEST_FAILED',e);process.exitCode=1});
