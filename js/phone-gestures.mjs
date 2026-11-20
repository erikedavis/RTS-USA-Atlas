const HOLD_MS=600;
// Match the bundled MapLibre double-tap window before committing a single tap.
const MAP_DOUBLE_TAP_MS=500, DELIBERATE_TAP_MS=1040, TAP_SPACING=30;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const position=touch=>({x:touch.clientX,y:touch.clientY});

export function bindMapTouches(surface,{enabled,hit,preview,hold,deliberate,single,immediate,amplifyZoom,badgeTap,setBadgeGesture,hasState,switchState}){
  let finger=null,pending=null,lastCityTap=null,lastBadgeTap=null,timer=0;
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
    lastCityTap=lastBadgeTap=null;
    setBadgeGesture(false);
  }
  surface.addEventListener('touchstart',event=>{
    if(!enabled())return;
    if(event.touches.length!==1){cancel();return;}
    const at=position(event.touches[0]),now=event.timeStamp;
    const near=previous=>previous&&now-previous.time<=DELIBERATE_TAP_MS&&distance(previous.at,at)<TAP_SPACING;
    const first=near(pending)?pending:near(lastCityTap)?lastCityTap:null;
    const badge=event.target.closest?.('.state-label');
    const repeat=lastBadgeTap&&now-lastBadgeTap.time<MAP_DOUBLE_TAP_MS&&distance(lastBadgeTap.at,at)<TAP_SPACING;
    if(badge||repeat)setBadgeGesture(true);
    if(first&&!badge&&!repeat)clearTimeout(timer);else clearPending();
    const touch={at,first,target:event.target,badge,repeat,held:false,moved:false};
    finger=touch;
    touch.holdTimer=setTimeout(()=>{
      clearPending();
      touch.held=true;
      touch.feedback=(!touch.repeat||touch.badge)&&hold(hit(touch.at,touch.target));
    },HOLD_MS);
  },{passive:true,capture:true});
  surface.addEventListener('touchmove',event=>{
    if(!finger)return;
    if(event.touches.length!==1){cancel();return;}
    if(distance(finger.at,position(event.touches[0]))>9){
      finger.moved=true;clearTimeout(finger.holdTimer);clearPending();lastCityTap=null;
    }
  },{passive:true,capture:true});
  surface.addEventListener('touchend',event=>{
    const touch=finger;
    finger=null;
    if(!touch)return;
    clearTimeout(touch.holdTimer);
    if(touch.badge||touch.repeat)requestAnimationFrame(()=>{if(!finger?.badge&&!finger?.repeat)setBadgeGesture(false);});
    if(touch.held){
      if(event.cancelable)event.preventDefault();
      if(touch.feedback)navigator.vibrate?.(14);
      return;
    }
    const at=position(event.changedTouches[0]);
    if(touch.moved||distance(touch.at,at)>9)return;
    if(!touch.badge&&switchState(at)){
      clearPending();lastCityTap=lastBadgeTap=null;
      if(event.cancelable)event.preventDefault();
      return;
    }
    if(touch.badge||touch.repeat){
      if(event.cancelable)event.preventDefault();
      const result=touch.repeat?lastBadgeTap.result:hit(at,touch.badge);
      lastBadgeTap=touch.repeat?null:{at,time:event.timeStamp,result};
      // MapLibre stops the first camera ease on the next touchstart.
      badgeTap(result);
      return;
    }
    tapEvents.set(event,touch.at);
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
    const cityName=result?.layer.startsWith('city-name');
    if(gap<=DELIBERATE_TAP_MS&&((first.slowState&&result?.layer==='state-hit')||(cityName&&first.cityName))&&
      result.feature.properties.geoid===first.result.feature.properties.geoid){
      clearPending();lastCityTap=null;deliberate(result.feature);return;
    }
    clearPending();
    const bareState=result?.layer==='state-hit';
    const slowState=bareState&&!hasState();
    const tap={at:touch.at,result,time:event.timeStamp,preview:slowState,slowState,cityName};
    pending=tap;
    lastCityTap=cityName?tap:null;
    if(slowState)preview(result.feature);
    timer=setTimeout(()=>{clearPending();single(result,at,touch.target);},slowState?DELIBERATE_TAP_MS:MAP_DOUBLE_TAP_MS);
  },{passive:false,capture:true});
  surface.addEventListener('touchcancel',cancel,{passive:true,capture:true});
  surface.addEventListener('contextmenu',event=>{if(enabled())event.preventDefault();});
  return {cancel,onZoomStart(event){
    const at=tapEvents.get(event.originalEvent);
    if(!at||!enabled())return;
    tapEvents.delete(event.originalEvent);
    clearPending();
    lastCityTap=null;
    amplifyZoom(at);
  }};
}

export function bindStateAtlasPan(map,visibleArea,leaveAtlas){
  const surface=map.getContainer();
  let corners=null,gesture=null;

  surface.addEventListener('touchstart',event=>{
    gesture=corners&&event.touches.length===1?{area:visibleArea(),spring:null,released:false}:null;
  },{passive:true,capture:true});
  surface.addEventListener('touchcancel',()=>{gesture=null;},{passive:true,capture:true});

  function constrain(transform){
    const drag=gesture;
    if(!drag||drag.released||!map.dragPan.isActive())return {};
    const points=corners.map(corner=>transform.locationToScreenPoint(corner));
    const left=Math.min(...points.map(point=>point.x)),right=Math.max(...points.map(point=>point.x));
    const top=Math.min(...points.map(point=>point.y)),bottom=Math.max(...points.map(point=>point.y));
    const area=drag.area;

    // At closer zoom, allow travel within the state before adding resistance.
    const overflow=(distance,span,size)=>{
      const range=16+Math.max(0,(span-size)/2);
      return distance-Math.max(-range,Math.min(range,distance));
    };
    const x=overflow((left+right)/2-area.x,right-left,area.width);
    const y=overflow((top+bottom)/2-area.y,bottom-top,area.height);
    const excess=Math.hypot(x,y);
    const center=transform.centerPoint;
    const resisted=excess?{center:transform.screenPointToLocation(center.add({x:x*.68,y:y*.68}))}:{};
    if(excess>=62){
      drag.released=true;
      queueMicrotask(()=>{if(gesture===drag)leaveAtlas();});
    }else{
      drag.spring=excess?transform.screenPointToLocation(center.add({x,y})):null;
    }
    return resisted;
  }

  map.on('dragend',()=>{
    const drag=gesture;
    if(!drag||drag.released)return;
    gesture=null;
    // MapLibre schedules inertia after dragend. Replace it with the edge
    // rebound so a short flick cannot coast out of the focused state.
    queueMicrotask(()=>{
      if(!corners||gesture)return;
      map.stop();
      if(drag.spring)map.easeTo({center:drag.spring,duration:180});
    });
  });

  return bounds=>{
    corners=bounds;
    gesture=null;
    map.setTransformCameraUpdate(bounds?constrain:null);
  };
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
