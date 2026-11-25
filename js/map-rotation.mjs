import {HOLD_MS,HOLD_SLOP} from './phone-gestures.mjs?v=10a';
import {bindDesktopMapKeys} from './desktop-map-keys.mjs?v=09l';

export const isNorthUp=bearing=>Math.abs(((bearing%360+540)%360)-180)<1e-6;
const LOCK_NOTICE_MS=2000, LOCK_RELEASE_MS=940;

function bindLockedTwist(surface,enabled,onTwist){
  let start=null;
  const options={passive:true,capture:true};
  function span(touches){
    if(touches.length!==2)return null;
    const [a,b]=[touches[0],touches[1]].sort((first,second)=>first.identifier-second.identifier);
    const x=b.clientX-a.clientX,y=b.clientY-a.clientY;
    return {x,y,length:Math.hypot(x,y)};
  }
  surface.addEventListener('touchstart',event=>{
    const initial=enabled()?span(event.touches):null;
    start=initial?.length>=45?initial:null;
  },options);
  surface.addEventListener('touchmove',event=>{
    if(!start||!enabled())return;
    const next=span(event.touches);
    if(!next||next.length<32){start=null;return;}
    const turn=Math.abs(Math.atan2(start.x*next.y-start.y*next.x,start.x*next.x+start.y*next.y));
    const arc=turn*(start.length+next.length)/2;
    // Require a substantial twist whose arc outweighs the change in finger spacing.
    if(turn>=Math.PI/9&&arc>=Math.max(22,1.2*Math.abs(next.length-start.length))){
      start=null;
      onTwist();
    }
  },options);
  for(const type of ['touchend','touchcancel'])surface.addEventListener(type,()=>{start=null;},options);
}

export function screenBounds(map,[[west,south],[east,north]]){
  const points=[[west,south],[west,north],[east,south],[east,north]].map(point=>map.project(point));
  return {
    x0:Math.min(...points.map(point=>point.x)),y0:Math.min(...points.map(point=>point.y)),
    x1:Math.max(...points.map(point=>point.x)),y1:Math.max(...points.map(point=>point.y)),
  };
}

export function setupRotation(map,controls,onChange){
  const rose=controls.querySelector('#compass-home');
  const dial=controls.querySelector('.compass-dial');
  const roseArt=rose.querySelector('svg');
  const face=controls.querySelector('#compass-face');
  const returnZone=controls.querySelector('.compass-return-swipe');
  const toggle=controls.querySelector('#compass-toggle');
  const toggleText=toggle.querySelector('.compass-toggle-text');
  const lock=controls.querySelector('#rotation-lock');
  const lockGlyph=lock.querySelector('svg');
  const edgeLock=controls.querySelector('#compass-edge-lock');
  const lockNotice=controls.querySelector('#compass-lock-notice');
  const heading=controls.querySelector('#rotation-bearing');
  let locked=true,minimized=false;
  let drag=null,centerHold=null,returnTouch=null,skipClick=false;
  let lockFeedbackTimer=0,lockPulse;
  const isPhone=()=>Boolean(controls.closest('.phone-layout'));
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const desktop=bindDesktopMapKeys(map,{
    isDesktop:()=>!isPhone(),canTurn:()=>!locked&&!drag?.started,onCompassKey,onChange,
  });

  function clearLockFeedback(){
    clearTimeout(lockFeedbackTimer);
    lockPulse?.cancel();
    lockNotice.hidden=true;
    edgeLock.hidden=true;
    edgeLock.inert=false;
  }

  function reportLockedTurn(){
    if(!locked||controls.inert)return;
    clearLockFeedback();
    if(minimized){
      const feedback=isPhone()?edgeLock:lockNotice;
      feedback.hidden=false;
      lockFeedbackTimer=setTimeout(clearLockFeedback,LOCK_NOTICE_MS);
      return;
    }
    const bump=reducedMotion.matches?'none':'translateY(-2px) scale(1.16)';
    lockPulse=lockGlyph.animate([{opacity:1,transform:'none'},
      {opacity:.52,transform:bump},{opacity:1,transform:bump},{opacity:1,transform:'none'}],
      {duration:460,easing:'ease-in-out'});
  }

  function onCompassKey(key){
    if(key==='l')setLocked(!locked);
    else if(key==='r')northAndLock();
    else if(locked)reportLockedTurn();
    else if(key==='n')snap(0);
  }

  function showBearing(){
    const bearing=map.getBearing(),degrees=Math.round((bearing+360)%360)%360;
    const display=`Bearing ${degrees} degrees`;
    if(heading.textContent!==display)heading.textContent=display;
    controls.style.setProperty('--compass-angle',-bearing+'deg');
    controls.classList.toggle('rotation-north-locked',locked&&isNorthUp(bearing));
  }

  function setLocked(value){
    clearLockFeedback();
    if(value&&!locked&&map.isRotating())map.stop();
    locked=value;
    if(locked){
      desktop.stopTurning();
      map.touchZoomRotate.disableRotation();
    }else{
      map.touchZoomRotate.enableRotation();
    }
    const action=locked?'Unlock map rotation':'Lock map rotation in place';
    lock.setAttribute('aria-pressed',String(locked));
    lock.setAttribute('aria-label',action);
    rose.setAttribute('aria-label',action);
    rose.title=action;
    lock.dataset.hint=locked?'Map rotation is locked. Click to unlock.':'Click to lock rotation here.';
    controls.classList.toggle('rotation-unlocked',!locked);
    showBearing();
    onChange();
  }

  function setMinimized(value){
    if(minimized===value)return;
    clearLockFeedback();
    cancelCenterHold();
    drag=returnTouch=null;
    minimized=value;
    face.inert=minimized;
    controls.classList.toggle('compass-minimized',minimized);
    controls.classList.remove('compass-near');
    const action=minimized?'Return compass':'Hide compass';
    toggle.setAttribute('aria-label',action);
    toggle.setAttribute('aria-expanded',String(!minimized));
    toggleText.textContent=action;
    onChange();
  }

  const shell=controls.parentElement;
  shell.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||minimized||controls.inert)return;
    const a=face.getBoundingClientRect(),b=toggle.getBoundingClientRect();
    const {clientX:x,clientY:y}=event;
    controls.classList.toggle('compass-near',x>=Math.min(a.left,b.left)-7&&x<=a.right&&
      y>=a.top&&y<=a.bottom+5);
  },{passive:true});
  shell.addEventListener('pointerleave',()=>controls.classList.remove('compass-near'));
  face.addEventListener('transitionend',event=>{
    if(event.target===face&&event.propertyName==='transform')onChange();
  });
  toggle.addEventListener('click',event=>{
    if(!minimized&&isPhone()&&event.detail>0)return;
    setMinimized(!minimized);
  });
  edgeLock.addEventListener('click',()=>{
    if(!isPhone()||!minimized||!locked||edgeLock.hidden)return;
    setLocked(false);
    edgeLock.hidden=false;
    edgeLock.inert=true;
    lockFeedbackTimer=setTimeout(clearLockFeedback,LOCK_RELEASE_MS);
  });
  bindLockedTwist(map.getContainer(),()=>isPhone()&&locked&&!controls.inert,reportLockedTurn);

  function snap(bearing,duration=280){
    desktop.stopTurning();
    map.rotateTo(bearing,{duration});
  }
  function northAndLock(duration){
    setLocked(true);
    snap(0,duration);
  }

  function cancelCenterHold(){
    clearTimeout(centerHold?.timer);
    centerHold=null;
  }
  document.addEventListener('pointerdown',event=>{
    if(centerHold&&event.pointerId!==centerHold.id)cancelCenterHold();
    if(returnTouch&&event.pointerId!==returnTouch.id)returnTouch=null;
    if(drag?.canTap&&event.pointerId!==drag.id)drag.canTap=false;
  },true);
  lock.addEventListener('pointerleave',event=>{
    if(event.pointerType==='mouse'&&event.pointerId===centerHold?.id)cancelCenterHold();
  });
  lock.addEventListener('contextmenu',event=>{
    if(centerHold||skipClick||event.pointerType==='touch')event.preventDefault();
  });

  function onOuterSpoke(event){
    const local=new DOMPoint(event.clientX,event.clientY).matrixTransform(roseArt.getScreenCTM().inverse());
    const x=local.x-50,y=local.y-50;
    const direction=Math.round(Math.atan2(y,x)/(Math.PI/4));
    const tip=direction%2?Math.hypot(30,30):50;
    const radius=Math.hypot(x,y);
    return radius>=tip/2&&radius<=tip+8;
  }
  const canTurnFrom=(button,event)=>button?.matches('[data-bearing]')||(button===rose&&onOuterSpoke(event));
  const angleAt=(event,{x,y})=>Math.atan2(event.clientY-y,event.clientX-x)*180/Math.PI;
  const staysHorizontal=(distance,maxY)=>maxY<=Math.max(10,distance*.23);
  const reachedTurn=(gesture,dx,dy)=>gesture.canTurn&&Math.abs(gesture.turn)>=6&&Math.hypot(dx,dy)>=7;
  controls.addEventListener('pointerdown',event=>{
    const mouse=event.pointerType==='mouse';
    if(!event.isPrimary||(event.button!==0&&!(mouse&&!isPhone()&&event.button===2)))return;
    skipClick=false;
    const button=event.target.closest('button');
    const phoneTouch=isPhone()&&event.pointerType==='touch';
    if(minimized){
      if(phoneTouch&&(button===toggle||event.target===returnZone)){
        const target=button||returnZone;
        target.setPointerCapture(event.pointerId);
        returnTouch={id:event.pointerId,x:event.clientX,y:event.clientY,maxDistance:0,canTap:button===toggle};
      }
      return;
    }
    if(button===lock&&event.button===0){
      const {pointerId:id,clientX:x,clientY:y}=event;
      centerHold={id,x,y,timer:setTimeout(()=>{
        centerHold=null;
        if(drag?.id===id)drag=null;
        skipClick=true;
        northAndLock();
      },HOLD_MS)};
    }
    if(mouse&&isPhone())return;
    const canTurn=canTurnFrom(button,event);
    const canHide=phoneTouch&&(face.contains(event.target)||button===toggle);
    if(!canTurn&&!canHide)return;
    const bounds=dial.getBoundingClientRect();
    const center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
    drag={id:event.pointerId,center,angle:angleAt(event,center),turn:0,canTurn,canHide,
      canTap:phoneTouch&&button===toggle,maxY:0,
      swipeDistance:Math.max(34,face.offsetWidth*.29),
      startX:event.clientX,startY:event.clientY,bearing:map.getBearing(),started:false};
    if(mouse)button.setPointerCapture(event.pointerId);
  });
  controls.addEventListener('pointermove',event=>{
    if(event.pointerId===returnTouch?.id){
      const dx=event.clientX-returnTouch.x,dy=event.clientY-returnTouch.y;
      returnTouch.maxDistance=Math.max(returnTouch.maxDistance,Math.hypot(dx,dy));
      return;
    }
    if(event.pointerId===centerHold?.id&&
      Math.hypot(event.clientX-centerHold.x,event.clientY-centerHold.y)>HOLD_SLOP){
      cancelCenterHold();
      skipClick=true;
    }
    if(event.pointerId!==drag?.id)return;
    drag.maxY=Math.max(drag.maxY,Math.abs(event.clientY-drag.startY));
    if(drag.canTap&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>HOLD_SLOP)drag.canTap=false;
    if(!drag.canTurn)return;
    const angle=angleAt(event,drag.center);
    drag.turn+=((angle-drag.angle+540)%360)-180;
    drag.angle=angle;
    const dx=event.clientX-drag.startX;
    // A straight rightward swipe owns the gesture even when it starts on a direction.
    if(!drag.started&&drag.canHide&&dx>=-HOLD_SLOP&&staysHorizontal(Math.max(dx,drag.swipeDistance),drag.maxY))return;
    if(!drag.started&&reachedTurn(drag,dx,event.clientY-drag.startY)){
      drag.started=true;
      desktop.stopTurning();
      if(!locked)map.stop();
    }
    if(drag.started&&!locked)map.setBearing(drag.bearing-drag.turn);
  });
  controls.addEventListener('pointerup',event=>{
    if(event.pointerId===returnTouch?.id){
      const dx=returnTouch.x-event.clientX,dy=event.clientY-returnTouch.y;
      const tap=returnTouch.canTap&&Math.max(returnTouch.maxDistance,Math.hypot(dx,dy))<=HOLD_SLOP;
      const swipe=dx>=18&&dx>=Math.abs(dy)*1.2;
      returnTouch=null;
      skipClick=true;
      if(tap||swipe)setMinimized(false);
      return;
    }
    if(event.pointerId===centerHold?.id)cancelCenterHold();
    if(event.pointerId!==drag?.id)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    const hide=drag.canHide&&dx>=drag.swipeDistance&&staysHorizontal(dx,Math.max(drag.maxY,Math.abs(dy)));
    const gesture=drag;
    const tap=gesture.canTap&&Math.hypot(dx,dy)<=HOLD_SLOP;
    const turned=gesture.started||(!hide&&reachedTurn(gesture,dx,dy));
    skipClick=skipClick||tap||turned||Math.hypot(dx,dy)>=10;
    drag=null;
    if(hide||tap){
      if(gesture.started&&!locked)map.setBearing(gesture.bearing);
      setMinimized(true);
    }
    else if(turned&&locked)setLocked(false);
    else if(turned){
      if(!gesture.started)map.setBearing(gesture.bearing-gesture.turn);
      onChange();
    }
  });
  for(const type of ['pointercancel','lostpointercapture']){
    controls.addEventListener(type,event=>{
      if(event.pointerId===returnTouch?.id)returnTouch=null;
      if(event.pointerId===centerHold?.id)cancelCenterHold();
      if(event.pointerId!==drag?.id)return;
      const turned=drag.started;
      drag=null;
      if(turned)onChange();
    });
  }
  controls.addEventListener('contextmenu',event=>{
    if(!isPhone()&&event.button===2&&(skipClick||canTurnFrom(event.target.closest('button'),event)))event.preventDefault();
  });
  controls.addEventListener('click',event=>{
    if(!skipClick||event.detail===0)return;
    skipClick=false;
    event.stopImmediatePropagation();
    event.preventDefault();
  },true);

  // The Atlas handles keyboard rotation and panning explicitly.
  map.keyboard.disableRotation();
  setLocked(true);
  map.on('rotate',showBearing);
  map.on('moveend',showBearing);
  for(const button of [rose,lock])button.addEventListener('click',()=>{if(!minimized)setLocked(!locked);});
  controls.addEventListener('click',event=>{
    const button=event.target.closest('button[data-bearing]');
    if(!button||minimized)return;
    if(locked&&isPhone())reportLockedTurn();
    else snap(Number(button.dataset.bearing));
  });
  return {get dragging(){return Boolean(drag?.started||desktop.active);}};
}
