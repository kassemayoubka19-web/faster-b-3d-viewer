// FX42 quality gate: actual Chrome on mobile + desktop with original GitHub GLB and photos.
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const exe=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert(exe,'No installed Chrome / Chromium executable');
 const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  for(const spec of [{name:'mobile',width:412,height:915},{name:'desktop',width:1366,height:850}]){
   const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err)));
   page.on('requestfailed',req=>{if(req.url().includes('/press42/photos/'))errors.push(req.url()+': '+req.failure()?.errorText)});
   await page.goto('http://127.0.0.1:8795/press42/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>!!document.getElementById('loading')?.hidden||!document.getElementById('error')?.hidden,null,{timeout:150000});
   const state=await page.evaluate(()=>{
    const m=document.getElementById('viewer'),root=document.getElementById('workspace'),stage=document.getElementById('stage');
    return {
     loaded:document.getElementById('loading').hidden,
     failed:!document.getElementById('error').hidden,
     hasModel:!!m.src,
     autoRotate:m.hasAttribute('auto-rotate'),
     interactive:m.hasAttribute('camera-controls'),
     markerCount:document.querySelectorAll('.press-hotspot,.press3d-overlay-marker,[slot^="hotspot-"]').length,
     rows:document.querySelectorAll('.part-row').length,
     stageWidth:stage.getBoundingClientRect().width,
     stageRatio:stage.getBoundingClientRect().width/root.getBoundingClientRect().width,
     panelOpen:document.getElementById('partsPanel').classList.contains('is-open'),
     title:document.querySelector('h1')?.textContent
    };
   });
   console.log('VIEW_STATE',spec.name,JSON.stringify(state));
   assert(state.loaded&&!state.failed&&state.hasModel,'3D model failed');
   assert(state.autoRotate&&state.interactive,'Auto and manual rotate required');
   assert.equal(state.markerCount,0,'Hotspots must be completely absent');
   assert.equal(state.rows,12,'11 equipment entries and 1 heater');
   if(spec.name==='desktop'){
    assert(state.panelOpen,'Desktop catalog should start open');
    assert(state.stageRatio>.73,'Desktop machine viewer should dominate viewport');
   }else{
    assert(!state.panelOpen,'Mobile catalog must start collapsed');
    assert(state.stageRatio>.98,'Collapsed mobile catalog must not consume 3D viewport width');
    await page.locator('#partsToggle').click();
    assert(await page.locator('#partsPanel').evaluate(el=>el.classList.contains('is-open')),'Catalog did not open on mobile');
   }
   for(const id of ['pressureGauge','waterLevel','steamTrap','drainAndCable','heater','upperSurface']){
    const row=page.locator('.part-row[data-id="'+id+'"]');
    await row.click();
    const card=await page.evaluate(()=>({title:document.getElementById('detailTitle').textContent,description:document.getElementById('detailDescription').textContent,image:document.getElementById('detailPhoto').getAttribute('src')}));
    assert(card.title.length>=6&&card.description.length>=20&&card.image.includes('/photos/'),'Bad '+id+' description or photo');
    await page.waitForFunction(()=>document.getElementById('detailPhoto').naturalWidth>0,null,{timeout:18000});
    const photo=await page.locator('#detailPhoto').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
    console.log('PHOTO_OK',spec.name,id,photo.width+'x'+photo.height);
   }
   await page.locator('#detailPhoto').click();
   assert(!await page.locator('#photoModal').evaluate(el=>el.hidden),'Photo preview failed');
   await page.locator('#modalClose').click();
   assert(await page.locator('#photoModal').evaluate(el=>el.hidden),'Photo preview could not close');
   if(spec.name==='mobile'){
    await page.locator('#partsToggle').click();
    assert(!await page.locator('#partsPanel').evaluate(el=>el.classList.contains('is-open')),'Mobile catalog did not collapse');
   }
   await page.screenshot({path:'press42-'+spec.name+'-ui.png',fullPage:true});
   console.log('BROWSER_ERRORS',spec.name,JSON.stringify(errors));
   assert.equal(errors.length,0,'Browser page errors or image failures');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('UI_TEST_FAILED',e);process.exitCode=1});
