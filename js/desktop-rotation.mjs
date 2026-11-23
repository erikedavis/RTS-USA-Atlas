const POINTER_DEGREES_PER_PIXEL=.32;
const KEY_DEGREES_PER_SECOND=18;
const KEY_DIRECTIONS={q:-1,e:1};

export function bindDesktopRotation(map,enabled,onChange){
  const canvas=map.getCanvas();
  let grab=null,skipClick=false,frame=0,lastTime;
  const keys=new Set();

  function stopKeys(){
    if(!keys.size)return;
    keys.clear();
    cancelAnimationFrame(frame);
    frame=0;
    onChange();
  }
  function turnWithKeys(time){
    if(!enabled()){stopKeys();return;}
    const direction=Number(keys.has('e'))-Number(keys.has('q'));
    const seconds=Math.max(0,Math.min(time-lastTime,50))/1000;
    lastTime=time;
    if(direction)map.setBearing(map.getBearing()+direction*KEY_DEGREES_PER_SECOND*seconds);
    frame=requestAnimationFrame(turnWithKeys);
  }
  document.addEventListener('keydown',event=>{
    const key=event.key.toLowerCase(),direction=KEY_DIRECTIONS[key];
    if(!direction||!enabled()||grab||event.defaultPrevented||event.isComposing||event.altKey||
      event.ctrlKey||event.metaKey||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
    event.preventDefault();
    if(keys.has(key))return;
    const start=!keys.size;
    keys.add(key);
    if(start){
      map.stop();
      map.setBearing(map.getBearing()+direction);
      lastTime=performance.now();
      frame=requestAnimationFrame(turnWithKeys);
    }
  });
  document.addEventListener('keyup',event=>{
    const key=event.key.toLowerCase();
    if(!keys.has(key))return;
    if(keys.size===1)stopKeys();
    else keys.delete(key);
  });
  document.addEventListener('focusin',event=>{
    if(event.target.closest?.('input,textarea,select,[contenteditable]'))stopKeys();
  });

  function finishGrab(){
    if(!grab)return;
    const {id,started}=grab;
    grab=null;
    if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    if(started)onChange();
  }
  function stop(){stopKeys();finishGrab();}
  window.addEventListener('blur',stop);

  function position(event){
    const {left,top}=canvas.getBoundingClientRect();
    return {x:event.clientX-left,y:event.clientY-top};
  }
  canvas.addEventListener('pointerdown',event=>{
    skipClick=false;
    if(!enabled()||!event.isPrimary||event.pointerType!=='mouse'||
      (event.button!==0&&event.button!==2)||(event.button===0&&event.shiftKey))return;
    const {x,y}=position(event);
    stopKeys();
    map.stop();
    grab={id:event.pointerId,anchor:map.unproject([x,y]),lastX:x,startY:y,started:false};
    canvas.setPointerCapture(event.pointerId);
  });
  // Keep MapLibre's mouse event bookkeeping for clicks while claiming drag.
  map.on('mousedown',event=>{if(grab)event.preventDefault();});
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==grab?.id)return;
    const {x,y}=position(event);
    if(!grab.started&&Math.hypot(x-grab.lastX,y-grab.startY)<4)return;
    grab.started=true;
    skipClick=true;
    const delta=(grab.lastX-x)*POINTER_DEGREES_PER_PIXEL;
    const radians=delta*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    const origin=map.project(map.getCenter()),anchor=map.project(grab.anchor);
    const dx=x-origin.x,dy=y-origin.y;
    // Express the desired pointer offset in the old camera's axes. Subtract
    // it from the grabbed point to keep that place under the cursor at the new bearing.
    const center=map.unproject([anchor.x-(dx*cos-dy*sin),anchor.y-(dx*sin+dy*cos)]);
    map.jumpTo({bearing:map.getBearing()+delta,center},{originalEvent:event});
    grab.lastX=x;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(type,event=>{if(event.pointerId===grab?.id)finishGrab();});
  }
  canvas.addEventListener('click',event=>{
    if(!skipClick||event.detail===0)return;
    skipClick=false;
    event.stopImmediatePropagation();
    event.preventDefault();
  },true);
  canvas.addEventListener('contextmenu',event=>{if(enabled())event.preventDefault();});

  return {stop,get active(){return Boolean(grab?.started||keys.size);}};
}
