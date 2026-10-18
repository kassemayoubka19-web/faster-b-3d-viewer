// Browser-level smoke test, runs against repository files, not a mock.
const fs=require('node:fs');
const {chromium}=require('playwright-core');
(async()=>{
  const exe=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
  if(!exe)throw new Error('No installed Chrome / Chromium executable');
  const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
  const browserErrors=[];
  page.on('pageerror',e=>browserErrors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error')browserErrors.push(msg.text())});
  try{
    await page.goto('http://127.0.0.1:8795/press42/',{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>!!document.getElementById('loading')?.hidden||getComputedStyle(document.getElementById('error')).display!=='none',{timeout:150000});
    const status=await page.evaluate(()=>{
      const model=document.getElementById('viewer'),heater=document.querySelector('.heaterPanel img');
      return {
        modelSrc:!!model?.src,failed:document.getElementById('error').style.display==='block',
        error:document.getElementById('errorText').textContent,
        heaterLoaded:!!heater?.naturalWidth,heaterPixels:heater?.naturalWidth,
        markerCount:document.querySelectorAll('.press3d-overlay-marker').length,
        nativeAnchorCount:document.querySelectorAll('model-viewer .press-hotspot').length
      };
    });
    console.log('MODEL_LOAD_STATUS',JSON.stringify(status));
    if(status.failed)throw new Error('Model load: '+status.error);
    if(status.markerCount!==13||status.nativeAnchorCount!==13)throw new Error('Expected exactly 13 anchored markers');
    if(!status.heaterLoaded)throw new Error('Heater reference image not loaded');
    const visible=new Set();
    for(const polar of [65,95]){
      for(let az=-180;az<180;az+=30){
        await page.evaluate(({az,polar})=>{
          const v=document.getElementById('viewer');
          const r=v.getCameraOrbit().radius;
          v.cameraOrbit=az+'deg '+polar+'deg '+r+'m';
          v.jumpCameraToGoal?.();
        },{az,polar});
        await page.waitForTimeout(155);
        const list=await page.evaluate(()=>{
          const nodes=[...document.querySelectorAll('.press3d-overlay-marker')];
          return nodes.filter(x=>x.style.display!=='none').map(x=>x.getAttribute('aria-label'));
        });
        for(const x of list)visible.add(x);
      }
    }
    const coverage=[...visible];console.log('VIRTUAL_ROTATION_COVERAGE',JSON.stringify({count:coverage.length,coverage}));
    if(coverage.length<7)throw new Error('Too few visible parts during 360-degree rotation: '+coverage.length);
    await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll('.press3d-overlay-marker')];
      const marker=buttons.find(b=>b.style.display!=='none');
      marker?.click();
    });
    const card=await page.evaluate(async()=>{
      const img=document.getElementById('partPhoto');
      if(!img.complete)await new Promise(done=>{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(done,2500)});
      return {opened:!document.getElementById('partBackdrop').hidden,imageOK:img.naturalWidth>0,width:img.naturalWidth,title:document.getElementById('partTitle').textContent}
    });
    console.log('PART_CARD',JSON.stringify(card));
    if(!card.opened||!card.imageOK)throw new Error('Part card/photo failed');
    await page.screenshot({path:'press42-mobile-ui.png',fullPage:true});
    console.log('BROWSER_ERRORS',JSON.stringify(browserErrors.slice(0,8)));
  }finally{await browser.close()}
})().catch(e=>{console.error('UI_TEST_FAILED',e);process.exitCode=1});
