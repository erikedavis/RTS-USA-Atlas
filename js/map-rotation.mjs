export const isNorthUp=bearing=>Math.abs(((bearing%360+540)%360)-180)<1e-6;

export function screenBounds(map,[[west,south],[east,north]]){
  const points=[[west,south],[west,north],[east,south],[east,north]].map(point=>map.project(point));
  return {
    x0:Math.min(...points.map(point=>point.x)),y0:Math.min(...points.map(point=>point.y)),
    x1:Math.max(...points.map(point=>point.x)),y1:Math.max(...points.map(point=>point.y)),
  };
}

export function setupRotation(map,controls){
  const rose=controls.querySelector('#compass-home');
  const lock=controls.querySelector('#rotation-lock');
  const directions=controls.querySelector('.rotation-directions');
  const heading=controls.querySelector('#rotation-bearing');
  let locked=true;

  function showBearing(){
    const bearing=map.getBearing(),degrees=Math.round((bearing+360)%360)%360;
    const north=isNorthUp(bearing);
    const display=north?'N':degrees+'°';
    if(heading.textContent!==display)heading.textContent=display;
    rose.style.setProperty('--compass-angle',-bearing+'deg');
    const action=locked&&north?'Unlock map rotation':'Return to north and lock rotation';
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
    lock.textContent=locked?'Unlock':'Lock';
    lock.setAttribute('aria-pressed',String(locked));
    lock.setAttribute('aria-label',locked?'Unlock map rotation':'Lock map rotation in place');
    lock.title=lock.getAttribute('aria-label');
    controls.classList.toggle('rotation-unlocked',!locked);
    showBearing();
  }

  function snap(bearing){
    directions.open=false;
    map.rotateTo(bearing,{duration:280});
  }

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
  directions.addEventListener('click',event=>{
    const button=event.target.closest('button[data-bearing]');
    if(!button)return;
    snap(Number(button.dataset.bearing));
    directions.querySelector('summary').focus();
  });
  document.addEventListener('click',event=>{
    if(!controls.contains(event.target))directions.open=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||
      event.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(event.key.toLowerCase()==='r'){
      event.preventDefault();
      snap(0);
    }
  });
}
