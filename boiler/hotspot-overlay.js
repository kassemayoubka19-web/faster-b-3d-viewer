/*
 FASTER B PRESS42 — stable, 3D-anchored part hotspots.
 Native model-viewer queryHotspot coordinates take priority;
 accurate analytic 3D camera projection is the fallback.
 Markers follow the physical 3D position and disappear only when the
 outward-facing part is turned away; no expensive ray casting on Android.
*/
export function createHotspotOverlay(viewer, area, parts, onOpen) {
  const layer=document.createElement('div');
  layer.id='press3d-hotspot-overlay';
  layer.setAttribute('aria-label','نقاط المعلومات التفاعلية على أجزاء البويلر');
  layer.style.cssText='position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;';
  area.appendChild(layer);
  const markers=parts.map(part=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='press3d-overlay-marker';
    btn.textContent='+';
    btn.title=part.name;
    btn.setAttribute('aria-label','تفاصيل '+part.name);
    btn.style.cssText='position:absolute;left:0;top:0;display:none;pointer-events:auto;transform:translate3d(-100px,-100px,0) translate(-50%,-50%);width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:#9e792c;color:#fff;box-shadow:0 2px 8px #0008,0 0 0 1px #9e792c;font:700 14px/1 Arial,sans-serif;align-items:center;justify-content:center;padding:0;touch-action:manipulation;cursor:pointer;will-change:transform;';
    btn.addEventListener('pointerdown',e=>e.stopPropagation());
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onOpen(part)});
    layer.appendChild(btn);
    return {
      part,btn,
      pos:part.position.trim().split(/\s+/).map(parseFloat),
      normal:part.normal.trim().split(/\s+/).map(parseFloat),
      lastX:NaN,lastY:NaN,visible:false
    };
  });
  const validVector=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
  let loaded=false,running=true,frame=0,lastTick=0;
  const radians=180/Math.PI;
  function analyticProject(m, orbit,target,fieldOfView,w,h) {
    const [x,y,z]=m.pos, theta=orbit.theta,phi=orbit.phi,r=orbit.radius;
    const st=Math.sin(theta),ct=Math.cos(theta),sp=Math.sin(phi),cp=Math.cos(phi);
    const ux=sp*st,uy=cp,uz=sp*ct;
    const dx=x-target.x,dy=y-target.y,dz=z-target.z;
    const depth=r-(dx*ux+dy*uy+dz*uz);
    if(depth<=.01)return null;
    const horizontal=ct*dx-st*dz;
    const vertical=-cp*st*dx+sp*dy-cp*ct*dz;
    const focal=h/(2*Math.tan(fieldOfView*Math.PI/360));
    return {x:w/2+horizontal*focal/depth,y:h/2-vertical*focal/depth};
  }
  function cameraPosition(orbit,target) {
    const sn=Math.sin(orbit.phi);
    return [
      target.x+orbit.radius*sn*Math.sin(orbit.theta),
      target.y+orbit.radius*Math.cos(orbit.phi),
      target.z+orbit.radius*sn*Math.cos(orbit.theta)
    ];
  }
  function tick(time){
    if(!running)return;
    frame=requestAnimationFrame(tick);
    if(!loaded||document.hidden||time-lastTick<16)return;
    lastTick=time;
    const w=viewer.clientWidth,h=viewer.clientHeight;
    const orbit=viewer.getCameraOrbit?.(),target=viewer.getCameraTarget?.();
    if(w<40||h<40||!orbit||!Number.isFinite(orbit.radius)||!validVector(target))return;
    const camera=cameraPosition(orbit,target);
    const fov=viewer.getFieldOfView?.()||38;
    for(let i=0;i<markers.length;i++){
      const m=markers[i];
      // Always project directly from the model's 3D anchor and the live orbit.
      // Native queryHotspot canvas coordinates can be stale during rapid rotation.
      const coords=analyticProject(m,orbit,target,fov,w,h);
      const [x,y,z]=m.pos,[nx,ny,nz]=m.normal;
      const side=nx*(camera[0]-x)+ny*(camera[1]-y)+nz*(camera[2]-z);
      const frontFacing=side>=-0.007;
      const onScreen=!!coords&&coords.x>8&&coords.y>8&&coords.x<w-8&&coords.y<h-8;
      // Reject far-side anchors immediately; do not rely on arbitrary 2D pins.
        const visible=frontFacing&&onScreen;
      if(m.visible!==visible){m.btn.style.display=visible?'flex':'none';m.visible=visible}
      if(visible && (Math.abs(coords.x-m.lastX)>.18||Math.abs(coords.y-m.lastY)>.18||!Number.isFinite(m.lastX))){
        m.btn.style.transform='translate3d('+coords.x.toFixed(1)+'px,'+coords.y.toFixed(1)+'px,0) translate(-50%,-50%)';
        m.lastX=coords.x;m.lastY=coords.y;
      }
      m.projection=coords;
      m.facing=frontFacing;
    }

  }
  viewer.addEventListener('load',()=>{
    loaded=true;
    markers.forEach(m=>{m.lastX=NaN;m.lastY=NaN;});
  });
  frame=requestAnimationFrame(tick);
  return {
    markerCount:markers.length,
    getPositions:()=>markers.map(m=>({id:m.part.id,name:m.part.name,visible:m.visible,x:m.lastX,y:m.lastY})),
    dispose:()=>{running=false;cancelAnimationFrame(frame);layer.remove()}
  };
}
