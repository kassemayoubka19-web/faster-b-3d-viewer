// Validate live-source FX42 model and the approved large photo/parts catalog in real Chrome.
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {PNG}=require('pngjs');
function verifyCenteredModel(buffer,label){
 const png=PNG.sync.read(buffer),w=png.width,h=png.height;
 let count=0,all=0,centerX=0;
 for(let y=Math.round(h*.2);y<Math.round(h*.82);y+=3){
  for(let x=Math.round(w*.15);x<Math.round(w*.85);x+=3){
   const i=(y*w+x)*4;all++;
   if(png.data[i]<185&&png.data[i+1]<185&&png.data[i+2]<180){count++;centerX+=x;}
  }
 }
 const ratio=count/Math.max(all,1),meanX=count?centerX/count:0;
 console.log('MODEL_PIXEL_CHECK',label,JSON.stringify({count,ratio,meanX,w,h}));
 assert(count>75&&ratio>.005,'3D press is invisible or outside central viewport: '+label);
 assert(meanX>w*.24&&meanX<w*.76,'3D press is no longer centered: '+label);
}

// Re-run after approved reference photograph is published.
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
    return {loaded:document.getElementById('loading').hidden,failed:!document.getElementById('error').hidden,model:!!m.src,rotation:m.dataset.rotationActive==='true',manual:m.hasAttribute('camera-controls'),markers:document.querySelectorAll('.press-hotspot,.press3d-overlay-marker,[slot^="hotspot-"]').length,catalogHidden:document.getElementById('catalogOverlay').hidden,cta:box('catalogOpen'),stage:box('stage'),navItems:document.querySelectorAll('#partsList button').length,brandLoaded:document.querySelector('.brand img')?.naturalWidth>0,firstCatalogItem:document.querySelector('#partsList button')?.dataset.id};
   });
   console.log('VIEW_STATE',spec.name,JSON.stringify(init));
   assert(init.loaded&&!init.failed&&init.model,'Model failed to load');
   assert(init.rotation&&init.manual,'3D model must rotate automatically and allow touch rotation');
   assert.equal(init.markers,0,'No plus markers should be present anywhere on the 3D press');
   assert.equal(init.navItems,14,'14 items expected including overview, valve, cable and heaters');
   assert(init.brandLoaded,'Official FASTER B branding image must load in viewer');
   assert.equal(await page.locator('[slot^="hotspot-"]').count(),0,'All 3D hotspots must be removed');
   assert.equal(init.firstCatalogItem,'machineOverview','Complete machine must be first option');
   assert(init.catalogHidden&&init.cta.width>=160&&init.cta.height>=55,'Parts CTA must be prominent at load');
   assert(init.stage.width>=spec.width-2,'Model should fill entire available width');
   await page.waitForTimeout(500);
   verifyCenteredModel(await page.locator('#viewer').screenshot(),spec.name+'-initial');
   await page.waitForTimeout(1200);
   console.log('AUTO_CAMERA',spec.name,JSON.stringify(await page.locator('#viewer').evaluate(e=>{
    const o=e.getCameraOrbit(),t=e.getCameraTarget();
    return {theta:o.theta,radius:o.radius,target:[t.x,t.y,t.z],auto:e.dataset.rotationActive==='true',contextLost:e.shadowRoot?.querySelector('canvas')?.getContext('webgl2')?.isContextLost?.()};
   })));
   verifyCenteredModel(await page.locator('#viewer').screenshot(),spec.name+'-autospin');
   // Regression: model must remain fully framed and centered while rotating.
   // The previous calculation used tan(full FOV) rather than tan(half FOV),
   // resulting in an oversized model clipped to the left on narrow phones.
   const framing=await page.evaluate(()=>{
    const v=document.getElementById('viewer'),area=document.getElementById('stage');
    const orbit=v.getCameraOrbit(),target=v.getCameraTarget(),center=v.getBoundingBoxCenter(),d=v.getDimensions();
    const fov=v.getFieldOfView()*Math.PI/180;
    const span=Math.hypot(d.x,d.z),angle=74*Math.PI/180;
    const halfDepth=(Math.sin(angle)*span+Math.cos(angle)*d.y)/2;
    const fitRadius=Math.max(span/2/(Math.tan(fov/2)*area.clientWidth/area.clientHeight),
       (Math.sin(angle)*d.y+Math.cos(angle)*span)/2/Math.tan(fov/2))+halfDepth;
    return {radius:orbit.radius,theta:orbit.theta,phi:orbit.phi,target:[target.x,target.y,target.z],
      center:[center.x,center.y,center.z],fitRadius};
   });
   console.log('CAMERA_FRAMING',spec.name,JSON.stringify(framing));
   assert(Number.isFinite(framing.radius)&&framing.radius>=framing.fitRadius*.96,
    'Rotating press must fit entirely inside the screen on every viewport');
   assert(framing.target.every((v,i)=>Math.abs(v-framing.center[i])<0.05),
    'Camera must always orbit around the machine center');
   const orbitStart=await page.locator('#viewer').evaluate(e=>e.getCameraOrbit());
   await page.waitForTimeout(800);
   const orbitEnd=await page.locator('#viewer').evaluate(e=>e.getCameraOrbit());
   // Fixed zoom must remain at the intentionally closer product-display distance.
   assert(Math.abs(orbitStart.radius-4.4)<.05,'Press camera should use the new close framing');
   assert(Math.abs(orbitEnd.radius-orbitStart.radius)<.03,
    'Auto-rotation must maintain a fixed zoom radius');
   await page.locator('#catalogOpen').click();
   const opened=await page.evaluate(()=>{
    const modal=document.querySelector('.catalog-window').getBoundingClientRect();
    const image=document.querySelector('.detail-img-box').getBoundingClientRect();
    const desc=document.querySelector('.detail-desc').getBoundingClientRect();
    const nav=document.getElementById('partsList').getBoundingClientRect();
    return {visible:!document.getElementById('catalogOverlay').hidden,modalWidth:modal.width,modalHeight:modal.height,imgWidth:image.width,imgHeight:image.height,descHeight:desc.height,navWidth:nav.width,navHeight:nav.height,closeButton:document.getElementById('catalogClose').getBoundingClientRect().width};
   });
   console.log('CATALOG_OPEN',spec.name,JSON.stringify(opened));
   assert(!await page.locator('#viewer').evaluate(e=>e.dataset.rotationActive==='true'),'Rotation should pause while viewing the parts catalog');
   assert(opened.visible&&opened.modalWidth>=Math.min(spec.width*.88,900),'Catalog is too small');
   assert(opened.imgHeight>=Math.min(spec.height*.24,200),'Photo is not displayed clearly');
   assert(opened.descHeight>=75,'Description must be readable');
   assert(opened.closeButton>=40,'Close control should be touch-friendly');
   await page.waitForFunction(()=>document.getElementById('detailPhoto').naturalWidth>0,null,{timeout:15000});
   for(const id of ['machineOverview','footPedals','pressureGauge','controlPanel','waterLevel','steamTrap','safetyValve','waterPump','suctionBlower','pressureControl','drainValve','powerCable','heater','upperSurface']){
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
   assert(await page.locator('#viewer').evaluate(e=>e.dataset.rotationActive==='true'),'3D should retain auto-rotation after closing');
   await page.locator('#rotate').click();
   assert(!await page.locator('#viewer').evaluate(e=>e.dataset.rotationActive==='true'),'Pause button should stop automatic rotation');
   await page.locator('#rotate').click();
   assert(await page.locator('#viewer').evaluate(e=>e.dataset.rotationActive==='true'),'Play button should restart rotation');
   const finalScreenshot=await page.screenshot({path:'press42-'+spec.name+'-viewer.png',fullPage:true});
   console.log('AFTER_CATALOG_CAMERA',spec.name,JSON.stringify(await page.locator('#viewer').evaluate(e=>{
    const o=e.getCameraOrbit(),t=e.getCameraTarget(),c=e.getBoundingBoxCenter();
    return {theta:o.theta,phi:o.phi,radius:o.radius,target:[t.x,t.y,t.z],center:[c.x,c.y,c.z],
      auto:e.dataset.rotationActive==='true',contextLost:e.shadowRoot?.querySelector('canvas')?.getContext('webgl2')?.isContextLost?.()};
   })));
   // Check the same captured frame as the saved screenshot. On headless SwiftShader,
   // taking another screenshot of the WebGL element immediately afterward can
   // return a black/empty buffer even when the full-page screenshot is correct.
   verifyCenteredModel(finalScreenshot,spec.name+'-after-catalog');
   console.log('BROWSER_ERRORS',spec.name,JSON.stringify(errors));
   assert.equal(errors.length,0,'Browser script error or missing approved image');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('UI_TEST_FAILED',e);process.exitCode=1});
