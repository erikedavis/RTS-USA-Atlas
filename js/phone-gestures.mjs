const HOLD_MS=600;
// Match the bundled MapLibre double-tap window before committing a single tap.
const MAP_DOUBLE_TAP_MS=500, DELIBERATE_TAP_MS=800, TAP_SPACING=30;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const position=touch=>({x:touch.clientX,y:touch.clientY});

export function bindMapTouches(surface,{enabled,hit,preview,hold,deliberate,single,immediate,amplifyZoom}){
  let finger=null, pending=null, timer=0;
  const tapEvents=new WeakMap();
  function clearPending(){
    clearTimeout(timer);
    if(pending?.preview)preview(null);
    pending=null;
  }
  function cancel(){
    clearTimeout(finger?.holdTimer);
    finger=null;
    clearPending();
  }
  surface.addEventListener('touchstart',event=>{
    if(!enabled())return;
    if(event.touches.length!==1){cancel();return;}
    const at=position(event.touches[0]),now=event.timeStamp;
    const first=pending&&now-pending.time<=DELIBERATE_TAP_MS&&distance(pending.at,at)<TAP_SPACING?pending:null;
    if(first)clearTimeout(timer);else clearPending();
    const touch={at,first,target:event.target,held:false,moved:false};
    finger=touch;
    touch.holdTimer=setTimeout(()=>{
      clearPending();
      touch.held=true;
      touch.feedback=hold(hit(touch.at,touch.target));
    },HOLD_MS);
  },{passive:true,capture:true});
  surface.addEventListener('touchmove',event=>{
    if(!finger)return;
    if(event.touches.length!==1){cancel();return;}
    if(distance(finger.at,position(event.touches[0]))>9){
      finger.moved=true;clearTimeout(finger.holdTimer);clearPending();
    }
  },{passive:true,capture:true});
  surface.addEventListener('touchend',event=>{
    const touch=finger;
    finger=null;
    if(!touch)return;
    clearTimeout(touch.holdTimer);
    if(touch.held){
      if(event.cancelable)event.preventDefault();
      if(touch.feedback)navigator.vibrate?.(14);
      return;
    }
    const at=position(event.changedTouches[0]);
    tapEvents.set(event,touch.at);
    if(touch.moved||distance(touch.at,at)>9)return;
    const first=touch.first;
    const gap=first?event.timeStamp-first.time:Infinity;
    if(gap<MAP_DOUBLE_TAP_MS){
      clearPending();return;
    }
    const result=hit(at,touch.target);
    if(immediate(result,at,touch.target)){
      clearPending();tapEvents.delete(event);
      if(event.cancelable)event.preventDefault();
      return;
    }
    if(gap<=DELIBERATE_TAP_MS&&first.preview&&result?.layer==='state-hit'&&
      result.feature.properties.geoid===first.result.feature.properties.geoid){
      clearPending();deliberate(result.feature);return;
    }
    clearPending();
    const bareState=result?.layer==='state-hit';
    const tap={at:touch.at,result,time:event.timeStamp,preview:bareState};
    pending=tap;
    if(bareState)preview(result.feature);
    timer=setTimeout(()=>{clearPending();single(result,at,touch.target);},bareState?DELIBERATE_TAP_MS:MAP_DOUBLE_TAP_MS);
  },{passive:false,capture:true});
  surface.addEventListener('touchcancel',cancel,{passive:true,capture:true});
  surface.addEventListener('contextmenu',event=>{if(enabled())event.preventDefault();});
  return {cancel,onZoomStart(event){
    const at=tapEvents.get(event.originalEvent);
    if(!at||!enabled())return;
    tapEvents.delete(event.originalEvent);
    clearPending();
    amplifyZoom(at);
  }};
}

export function bindDockSwipe(surface,{enabled=()=>true,onSwipe,follow=()=>{}}){
  let start, swipedAt=-Infinity;
  surface.addEventListener('pointerdown',event=>{
    if(!enabled()||!event.isPrimary||event.button!==0)return;
    start={x:event.clientX,y:event.clientY,id:event.pointerId};
  });
  surface.addEventListener('pointermove',event=>{
    if(event.pointerId!==start?.id)return;
    const x=event.clientX-start.x,y=event.clientY-start.y;
    if(Math.abs(y)>6&&Math.abs(y)>Math.abs(x)*1.2){
      if(!surface.hasPointerCapture(event.pointerId))surface.setPointerCapture(event.pointerId);
      follow(Math.max(-14,Math.min(38,y*.5)));
    }
  });
  surface.addEventListener('pointerup',event=>{
    if(event.pointerId!==start?.id)return;
    const x=event.clientX-start.x,y=event.clientY-start.y;
    start=null;follow(0);
    if(Math.abs(y)<24||Math.abs(y)<Math.abs(x)*1.2)return;
    swipedAt=performance.now();
    onSwipe(y<0?1:-1);
  });
  surface.addEventListener('pointercancel',()=>{start=null;follow(0);});
  surface.addEventListener('click',event=>{
    if(performance.now()-swipedAt<380){event.preventDefault();event.stopImmediatePropagation();}
  },true);
}
