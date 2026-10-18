// Validate live-source FX42 model and the approved large photo/parts catalog in real Chrome.
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const exe=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 assert(exe,'No Chrome or Chromium available');
 const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try{
  for(const spec of [{name:'mobile',width:412,height:915},{name:'small-mobile',width:360,height:780},{name:'desktop',width:1366,height:850}]){
   const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('requestfailed',req=>{if(req.url().includes('/press42/photos/'))errors.push(req.url()+': '+req.failure()?.errorText)});
   await page.goto('http://127.0.0.1:8795/press42/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>document.getElementById('loading').hidden||!document.getElementById('error').hidden,null,{timeout:150000});
   const init=await page.evaluate(()=>{
    const box=id=>{const b=document.getElementById(id).getBoundingClientRect();return {width:b.width,height:b.height,left:b.left,top:b.top,right:b.right}};
    const m=document.getElementById('viewer');
    return {loaded:document.getElementById('loading').hidden,failed:!document.getElementById('error').hidden,model:!!m.src,rotation:m.hasAttribute('auto-rotate'),manual:m.hasAttribute('camera-controls'),markers:document.querySelectorAll('.press-hotspot,.press3d-overlay-marker,[slot^="hotspot-"]').length,catalogHidden:document.getElementById('catalogOverlay').hidden,cta:box('catalogOpen'),stage:box('stage'),navItems:document.querySelectorAll('#partsList button').length};
   });
   console.log('VIEW_STATE',spec.name,JSON.stringify(init));
   assert(init.loaded&&!init.failed&&init.model,'Model failed to load');
   assert(init.rotation&&init.manual,'3D model must rotate automatically and allow touch rotation');
   assert.equal(init.markers,0,'Hotspot marks must remain removed');
   assert.equal(init.navItems,12,'12 approved parts/heater expected');
   assert(init.catalogHidden&&init.cta.width>=160&&init.cta.height>=55,'Parts CTA must be prominent at load');
   assert(init.stage.width>=spec.width-2,'Model should fill entire available width');
   await page.locator('#catalogOpen').click();
   const opened=await page.evaluate(()=>{
    const modal=document.querySelector('.catalog-window').getBoundingClientRect();
    const image=document.querySelector('.detail-img-box').getBoundingClientRect();
    const desc=document.querySelector('.detail-desc').getBoundingClientRect();
    const nav=document.getElementById('partsList').getBoundingClientRect();
    return {visible:!document.getElementById('catalogOverlay').hidden,modalWidth:modal.width,modalHeight:modal.height,imgWidth:image.width,imgHeight:image.height,descHeight:desc.height,navWidth:nav.width,navHeight:nav.height,closeButton:document.getElementById('catalogClose').getBoundingClientRect().width};
   });
   console.log('CATALOG_OPEN',spec.name,JSON.stringify(opened));
   assert(opened.visible&&opened.modalWidth>=Math.min(spec.width*.88,900),'Catalog is too small');
   assert(opened.imgHeight>=Math.min(spec.height*.24,200),'Photo is not displayed clearly');
   assert(opened.descHeight>=75,'Description must be readable');
   assert(opened.closeButton>=40,'Close control should be touch-friendly');
   await page.waitForFunction(()=>document.getElementById('detailPhoto').naturalWidth>0,null,{timeout:15000});
   for(const id of ['footPedals','pressureGauge','controlPanel','waterLevel','steamTrap','safetyValve','waterPump','suctionBlower','pressureControl','drainAndCable','heater','upperSurface']){
    await page.locator('#partsList button[data-id="'+id+'"]').click();
    await page.waitForFunction((part)=>{
     const img=document.getElementById('detailPhoto');
     return img.complete&&img.naturalWidth>0&&img.currentSrc.includes('/photos/')&&document.querySelector('#partsList button[data-id="'+part+'"]')?.getAttribute('aria-selected')==='true';
    },id,{timeout:20000});
    const data=await page.evaluate(()=>({title:document.getElementById('detailTitle').textContent,description:document.getElementById('detailDescription').textContent,imgWidth:document.getElementById('detailPhoto').naturalWidth}));
    assert(data.title.length>=5&&data.description.length>=20&&data.imgWidth>100,'Bad photo/detail for '+id);
    console.log('PART_OK',spec.name,id,data.imgWidth);
   }
   await page.screenshot({path:'press42-'+spec.name+'-catalog.png',fullPage:true});
   await page.locator('#detailPhoto').click();
   assert(!await page.locator('#photoModal').evaluate(e=>e.hidden),'Full-size photo zoom should open');
   await page.locator('#modalClose').click();
   assert(await page.locator('#photoModal').evaluate(e=>e.hidden),'Photo zoom should close');
   await page.locator('#catalogClose').click();
   assert(await page.locator('#catalogOverlay').evaluate(e=>e.hidden),'Catalog should close');
   assert(await page.locator('#viewer').evaluate(e=>e.hasAttribute('auto-rotate')),'3D should retain auto-rotation after closing');
   await page.screenshot({path:'press42-'+spec.name+'-viewer.png',fullPage:true});
   console.log('BROWSER_ERRORS',spec.name,JSON.stringify(errors));
   assert.equal(errors.length,0,'Browser script error or missing approved image');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('UI_TEST_FAILED',e);process.exitCode=1});
