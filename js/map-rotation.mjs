import {HOLD_MS,HOLD_SLOP} from './phone-gestures.mjs?v=09e';
import {bindDesktopMapKeys} from './desktop-map-keys.mjs?v=09g';

export const isNorthUp=bearing=>Math.abs(((bearing%360+540)%360)-180)<1e-6;

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
  const toggle=controls.querySelector('#compass-toggle');
  const toggleText=toggle.querySelector('.compass-toggle-text');
  const lock=controls.querySelector('#rotation-lock');
  const heading=controls.querySelector('#rotation-bearing');
  let locked=true,minimized=false;
  let drag=null,centerHold=null,returnTouch=null,skipClick=false;
  const isPhone=()=>Boolean(controls.closest('.phone-layout'));
  const desktop=bindDesktopMapKeys(map,{isDesktop:()=>!isPhone(),canTurn:()=>!locked&&!drag?.started,onChange});

  function showBearing(){
    const bearing=map.getBearing(),degrees=Math.round((bearing+360)%360)%360;
    const display=`Bearing ${degrees} degrees`;
    if(heading.textContent!==display)heading.textContent=display;
    controls.style.setProperty('--compass-angle',-bearing+'deg');
    controls.classList.toggle('rotation-north-locked',locked&&isNorthUp(bearing));
  }

  function setLocked(value){
    if(minimized&&!value)return;
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
    toggle.hidden=!locked;
    if(!locked)controls.classList.remove('compass-near');
    showBearing();
    onChange();
  }

  function setMinimized(value){
    if(minimized===value)return;
    if(isPhone())northAndLock(0);
    else if(!locked)return;
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
    if(event.pointerType!=='mouse'||!locked||minimized||controls.inert)return;
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
      if(phoneTouch&&button===toggle){
        returnTouch={id:event.pointerId,x:event.clientX,y:event.clientY,maxY:0,maxDistance:0};
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
    const canHide=phoneTouch&&face.contains(event.target);
    if(!canTurn&&!canHide)return;
    const bounds=dial.getBoundingClientRect();
    const center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
    drag={id:event.pointerId,center,angle:angleAt(event,center),turn:0,canTurn,canHide,maxY:0,
      swipeDistance:Math.max(34,face.offsetWidth*.29),
      startX:event.clientX,startY:event.clientY,bearing:map.getBearing(),started:false};
    if(mouse)button.setPointerCapture(event.pointerId);
  });
  controls.addEventListener('pointermove',event=>{
    if(event.pointerId===returnTouch?.id){
      const dx=event.clientX-returnTouch.x,dy=event.clientY-returnTouch.y;
      returnTouch.maxY=Math.max(returnTouch.maxY,Math.abs(dy));
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
    if(!drag.canTurn)return;
    const angle=angleAt(event,drag.center);
    drag.turn+=((angle-drag.angle+540)%360)-180;
    drag.angle=angle;
    const dx=event.clientX-drag.startX;
    // A straight rightward swipe owns the gesture even when it starts on a direction.
    if(!drag.started&&drag.canHide&&dx>=-HOLD_SLOP&&staysHorizontal(dx,drag.maxY))return;
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
      const tap=Math.max(returnTouch.maxDistance,Math.hypot(dx,dy))<=HOLD_SLOP;
      const swipe=dx>=28&&staysHorizontal(dx,Math.max(returnTouch.maxY,Math.abs(dy)));
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
    const turned=gesture.started||(!hide&&reachedTurn(gesture,dx,dy));
    skipClick=skipClick||turned||Math.hypot(dx,dy)>=10;
    drag=null;
    if(hide)setMinimized(true);
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
  for(const button of [rose,lock])button.addEventListener('click',()=>setLocked(!locked));
  controls.addEventListener('click',event=>{
    const button=event.target.closest('button[data-bearing]');
    if(button&&!minimized)snap(Number(button.dataset.bearing));
  });
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||
      event.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(event.key.toLowerCase()==='r'){
      event.preventDefault();
      snap(0);
    }
  });
  return {get dragging(){return Boolean(drag?.started||desktop.active);}};
}
