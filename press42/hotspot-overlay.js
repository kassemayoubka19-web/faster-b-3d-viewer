/*
 FASTER B PRESS42 — anchored, externally painted 3D part markers.
 The model-viewer slotted hotspots remain the geometry anchors. Their
 optional 2D canvasPosition is used first; an analytic orbit-camera
 projection is the fallback when the native slots are not painted.
 No marker is ever laid out at an arbitrary fixed screen position.
*/
export function createHotspotOverlay(viewer, area, parts, onOpen) {
  const layer=document.createElement('div');
  layer.id='press3d-hotspot-overlay';
  layer.setAttribute('aria-label','علامات معلومات أجزاء المكبس');
  layer.style.cssText='position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;';
  area.appendChild(layer);

  const markers=parts.map(part=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='press3d-overlay-marker';
    btn.textContent='+';
    btn.title=part.name;
    btn.setAttribute('aria-label','عرض معلومات '+part.name);
    btn.style.cssText='position:absolute;left:0;top:0;display:none;pointer-events:auto;transform:translate3d(-100px,-100px,0) translate(-50%,-50%);width:31px;height:31px;border-radius:50%;border:2px solid white;background:#ab832f;color:white;box-shadow:0 2px 9px #0009,0 0 0 2px #ab832f;font:700 23px/1 Arial,sans-serif;align-items:center;justify-content:center;padding:0;touch-action:manipulation;cursor:pointer;will-change:transform;';
    btn.addEventListener('pointerdown',e=>e.stopPropagation());
    btn.addEventListener('click',e=>{e.stopPropagation();onOpen(part)});
    layer.appendChild(btn);
    const pos=part.position.trim().split(/\s+/).map(parseFloat);
    const normal=part.normal.trim().split(/\s+/).map(parseFloat);
    return {part,btn,pos,normal,lastX:NaN,lastY:NaN,lastVisible:false};
  });

  let ready=false,running=true,lastTick=0,frame=0;
  const isValidVector=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
  function project(part, orbit, target, fov, width, height) {
    const [x,y,z]=part.pos,[nx,ny,nz]=part.normal;
    if(!Number.isFinite(x+y+z+nx+ny+nz))return null;
    const theta=orbit.theta,phi=orbit.phi,r=orbit.radius;
    const st=Math.sin(theta),ct=Math.cos(theta),sp=Math.sin(phi),cp=Math.cos(phi);
    const ux=sp*st,uy=cp,uz=sp*ct;
    const cx=target.x+r*ux,cy=target.y+r*uy,cz=target.z+r*uz;
    // The part is hidden when its 3D outward surface normal faces away.
    const side=nx*(cx-x)+ny*(cy-y)+nz*(cz-z);
    if(side < -0.015)return null;
    const dx=x-target.x,dy=y-target.y,dz=z-target.z;
    const depth=r-(dx*ux+dy*uy+dz*uz);
    if(depth<=0.02)return null;
    const horizontal=ct*dx-st*dz;
    const vertical=-cp*st*dx+sp*dy-cp*ct*dz;
    const focal=height/(2*Math.tan(fov*Math.PI/360));
    return {x:width/2+horizontal*focal/depth,y:height/2-vertical*focal/depth};
  }
  function tick(stamp) {
    if(!running)return;
    frame=requestAnimationFrame(tick);
    if(!ready||document.hidden||stamp-lastTick<28)return;
    lastTick=stamp;
    const w=viewer.clientWidth,h=viewer.clientHeight;
    if(w<30||h<30)return;
    const rawOrbit=viewer.getCameraOrbit?.();
    const rawTarget=viewer.getCameraTarget?.();
    const fov=viewer.getFieldOfView?.()||38;
    const orbit=rawOrbit&&Number.isFinite(rawOrbit.radius)?rawOrbit:null;
    const target=isValidVector(rawTarget)?rawTarget:null;
    for(const marker of markers) {
      // Native queryHotspot gives the exact projected glTF surface point.
      const native=viewer.queryHotspot?.('hotspot-'+marker.part.id);
      let coords;
      if(native?.canvasPosition&&Number.isFinite(native.canvasPosition.x)&&Number.isFinite(native.canvasPosition.y)) {
        coords={x:native.canvasPosition.x,y:native.canvasPosition.y};
      } else if(orbit&&target){
        coords=project(marker,orbit,target,fov,w,h);
      }
      let facing=true;
      if(orbit&&target){
        const [x,y,z]=marker.pos,[nx,ny,nz]=marker.normal;
        const ux=Math.sin(orbit.phi)*Math.sin(orbit.theta),uy=Math.cos(orbit.phi),uz=Math.sin(orbit.phi)*Math.cos(orbit.theta);
        const camera=[target.x+orbit.radius*ux,target.y+orbit.radius*uy,target.z+orbit.radius*uz];
        facing=(nx*(camera[0]-x)+ny*(camera[1]-y)+nz*(camera[2]-z))>=-0.015;
      }else if(typeof native?.facingCamera==='boolean')facing=native.facingCamera;
      const visible=!!coords&&facing&&coords.x>=5&&coords.y>=5&&coords.x<=w-5&&coords.y<=h-5;
      if(visible!==marker.lastVisible){
        marker.btn.style.display=visible?'flex':'none';
        marker.lastVisible=visible;
      }
      if(!visible)continue;
      if(Math.abs(coords.x-marker.lastX)>.3||Math.abs(coords.y-marker.lastY)>.3){
        marker.btn.style.transform='translate3d('+coords.x.toFixed(2)+'px,'+coords.y.toFixed(2)+'px,0) translate(-50%,-50%)';
        marker.lastX=coords.x; marker.lastY=coords.y;
      }
    }
  }
  viewer.addEventListener('load',()=>{
    ready=true;
    for(const marker of markers){marker.lastX=NaN;marker.lastY=NaN;}
  });
  frame=requestAnimationFrame(tick);
  return {
    markerCount:markers.length,
    getPositions:()=>markers.map(m=>({name:m.part.name,visible:m.lastVisible,x:m.lastX,y:m.lastY})),
    dispose:()=>{running=false;cancelAnimationFrame(frame);layer.remove()}
  };
}
