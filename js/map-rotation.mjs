export const isNorthUp=bearing=>Math.abs(((bearing%360+540)%360)-180)<1e-6;

export function screenBounds(map,[[west,south],[east,north]]){
  const points=[[west,south],[west,north],[east,south],[east,north]].map(point=>map.project(point));
  return {
    x0:Math.min(...points.map(point=>point.x)),y0:Math.min(...points.map(point=>point.y)),
    x1:Math.max(...points.map(point=>point.x)),y1:Math.max(...points.map(point=>point.y)),
  };
}

export function setupRotation(map,controls,onDragEnd){
  const rose=controls.querySelector('#compass-home');
  const dial=controls.querySelector('.compass-dial');
  const roseArt=rose.querySelector('svg');
  const lock=controls.querySelector('#rotation-lock');
  const heading=controls.querySelector('#rotation-bearing');
  let locked=true;
  let drag=null,skipClick=false;

  function showBearing(){
    const bearing=map.getBearing(),degrees=Math.round((bearing+360)%360)%360;
    const northLocked=locked&&isNorthUp(bearing);
    const display=`Bearing ${degrees} degrees`;
    if(heading.textContent!==display)heading.textContent=display;
    controls.style.setProperty('--compass-angle',-bearing+'deg');
    controls.classList.toggle('rotation-north-locked',northLocked);
    const action=northLocked?'Unlock map rotation':'Return to north and lock rotation';
    if(rose.title!==action){
      rose.title=action;
      rose.setAttribute('aria-label',action);
    }
  }

  function setLocked(value){
    if(value&&!locked&&map.isRotating())map.stop();
    locked=value;
    if(locked){
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
    }else{
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    }
    lock.setAttribute('aria-pressed',String(locked));
    lock.setAttribute('aria-label',locked?'Unlock map rotation':'Lock map rotation in place');
    lock.dataset.hint=locked?'Map rotation is locked. Click to unlock.':'Click to lock rotation here.';
    controls.classList.toggle('rotation-unlocked',!locked);
    showBearing();
  }

  function snap(bearing){
    map.rotateTo(bearing,{duration:280});
  }

  function onOuterSpoke(event){
    const local=new DOMPoint(event.clientX,event.clientY).matrixTransform(roseArt.getScreenCTM().inverse());
    const x=local.x-50,y=local.y-50;
    const direction=Math.round(Math.atan2(y,x)/(Math.PI/4));
    const tip=direction%2?Math.hypot(30,30):50;
    const radius=Math.hypot(x,y);
    return radius>=tip/2&&radius<=tip+8;
  }
  const angleAt=(event,{x,y})=>Math.atan2(event.clientY-y,event.clientX-x)*180/Math.PI;
  controls.addEventListener('pointerdown',event=>{
    if(event.isPrimary)skipClick=false;
    if(!event.isPrimary||event.pointerType==='mouse')return;
    const button=event.target.closest('button');
    if(!button?.matches('[data-bearing]')&&(button!==rose||!onOuterSpoke(event)))return;
    const bounds=dial.getBoundingClientRect();
    const center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
    drag={id:event.pointerId,center,angle:angleAt(event,center),turn:0,
      startX:event.clientX,startY:event.clientY,bearing:map.getBearing(),started:false};
  });
  controls.addEventListener('pointermove',event=>{
    if(event.pointerId!==drag?.id)return;
    const angle=angleAt(event,drag.center);
    drag.turn+=((angle-drag.angle+540)%360)-180;
    drag.angle=angle;
    if(!drag.started&&Math.abs(drag.turn)>=6&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>=7){
      drag.started=true;
      if(!locked)map.stop();
    }
    if(drag.started&&!locked)map.setBearing(drag.bearing-drag.turn);
  });
  controls.addEventListener('pointerup',event=>{
    if(event.pointerId!==drag?.id)return;
    skipClick=drag.started||Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>=10;
    if(drag.started&&locked)setLocked(false);
    const turned=drag.started;
    drag=null;
    if(turned)onDragEnd();
  });
  for(const type of ['pointercancel','lostpointercapture']){
    controls.addEventListener(type,event=>{
      if(event.pointerId!==drag?.id)return;
      const turned=drag.started;
      drag=null;
      if(turned)onDragEnd();
    });
  }
  controls.addEventListener('click',event=>{
    if(!skipClick||event.detail===0)return;
    skipClick=false;
    event.stopImmediatePropagation();
    event.preventDefault();
  },true);

  // R and the compass are the explicit keyboard rotation controls.
  map.keyboard.disableRotation();
  setLocked(true);
  map.on('rotate',showBearing);
  map.on('moveend',showBearing);
  rose.addEventListener('click',()=>{
    if(locked&&isNorthUp(map.getBearing()))setLocked(false);
    else{
      setLocked(true);
      snap(0);
    }
  });
  lock.addEventListener('click',()=>setLocked(!locked));
  controls.addEventListener('click',event=>{
    const button=event.target.closest('button[data-bearing]');
    if(button)snap(Number(button.dataset.bearing));
  });
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||
      event.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(event.key.toLowerCase()==='r'){
      event.preventDefault();
      snap(0);
    }
  });
  return {get dragging(){return Boolean(drag?.started);}};
}
