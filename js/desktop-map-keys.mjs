const PAN_PIXELS_PER_SECOND=420;
const TURN_DEGREES_PER_SECOND=34;
const PAN_KEYS=new Set(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d']);
const TURN_KEYS=['q','e'];
const editable=target=>target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');

export function bindDesktopMapKeys(map,{isDesktop,canTurn,onChange}){
  const keys=new Set();
  const held=(first,second)=>Number(keys.has(first)||keys.has(second));
  let frame=0,lastTime=0;

  function move(seconds){
    const x=held('arrowright','d')-held('arrowleft','a');
    const y=held('arrowdown','s')-held('arrowup','w');
    const turn=canTurn()?Number(keys.has('e'))-Number(keys.has('q')):0;
    if(!x&&!y&&!turn)return;
    const camera={bearing:map.getBearing()+turn*TURN_DEGREES_PER_SECOND*seconds};
    if(x||y){
      const origin=map.project(map.getCenter());
      const distance=PAN_PIXELS_PER_SECOND*seconds/Math.hypot(x,y);
      camera.center=map.unproject([origin.x+x*distance,origin.y+y*distance]);
    }
    map.jumpTo(camera);
  }

  function stop(){
    keys.clear();
    if(!frame)return;
    cancelAnimationFrame(frame);
    frame=0;
    onChange();
  }

  function stopTurning(){
    for(const key of TURN_KEYS)keys.delete(key);
    if(!keys.size)stop();
  }

  function advance(time){
    if(!isDesktop()){stop();return;}
    move(Math.max(0,Math.min(time-lastTime,50))/1000);
    lastTime=time;
    frame=requestAnimationFrame(advance);
  }

  // Handle camera pan before MapLibre's native key-repeat handler.
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||
      event.metaKey||editable(event.target)||!isDesktop())return;
    const key=event.key.toLowerCase();
    if(!PAN_KEYS.has(key)&&!(TURN_KEYS.includes(key)&&canTurn()))return;
    event.preventDefault();
    event.stopPropagation();
    if(event.repeat||keys.has(key))return;
    keys.add(key);
    if(frame)return;
    map.stop();
    move(1/60);
    lastTime=performance.now();
    frame=requestAnimationFrame(advance);
  },true);
  document.addEventListener('keyup',event=>{
    if(keys.delete(event.key.toLowerCase())&&!keys.size)stop();
  });
  document.addEventListener('focusin',event=>{
    if(editable(event.target))stop();
  });
  window.addEventListener('blur',stop);

  return {stopTurning,get active(){return Boolean(keys.size);}};
}
