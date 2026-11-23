import {bindDockSwipe,bindMapTouches,bindStateAtlasPan} from './phone-gestures.mjs?v=09e';

const phoneMedia='(max-width: 670px) and (pointer: coarse), (max-width: 950px) and (pointer: coarse) and (orientation: landscape)';
const STAGES=['closed','tools','summary','atlas'];
const atlasKind=feature=>{
  const kind=feature?.properties.kind;
  return kind==='state'||kind==='place'||kind==='nation'||kind==='metro'?kind:null;
};
const atlasName=feature=>({state:'state',place:'city',nation:'USA',metro:'metro'})[atlasKind(feature)];

export function setupPhoneUI(map,{getSelected,hit,stateAt,insideState,insideMetro,preview,select,deselect,reset,
  renderSelection,setFocus,fitFeature,stateCorners,cityBounds,fitCity,refreshLabels,closeKey,beforeModeChange,nationalPanelMode}){
  const $=selector=>document.querySelector(selector);
  const media=matchMedia(phoneMedia), reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const app=$('.app'),content=$('.content'),shell=$('.map-shell'),header=$('.topbar');
  const rotation=$('.rotation-tools'),toolsMenu=$('#tools-menu');
  const panel=$('#info-panel'),info=$('#panel-content'),controls=$('.map-controls');
  const dock=$('#phone-dock'),tray=$('#phone-tray'),sheet=$('.phone-sheet');
  const dockBody=$('#phone-dock-body'),mapHud=[$('#zoom-text'),$('#map-key-toggle'),$('#map-key')];
  const up=$('#phone-up'),down=$('#phone-down'),grip=$('#phone-grip');
  const clear=$('#phone-clear');
  const atlasBack=$('#phone-atlas-back'),factsGrip=$('#phone-facts-grip'),home=$('#phone-home');
  const historyBack=$('#phone-history-back');
  shell.append(dock,atlasBack);
  let active=false,stage='closed',savedCamera=null,stateReturn=null,labelTimer=0,resizeFrame=0,fastFrame=0;
  let cityView=null;
  let badgeGesture=false;
  const duration=()=>reducedMotion.matches?0:360;
  const camera=()=>({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing()});
  // The sheet's grid row can still be opening when the camera fit starts.
  const atlasSheetHeight=()=>controls.offsetHeight+panel.offsetHeight+factsGrip.offsetHeight+sheet.firstElementChild.clientTop;
  function visibleAtlasArea(){
    const rect=map.getContainer().getBoundingClientRect();
    const top=atlasBack.offsetHeight;
    // Use the final city sheet height while the dock animates open.
    const bottom=cityView?rect.height-atlasSheetHeight():
      Math.min(rect.height,sheet.getBoundingClientRect().top-rect.top);
    const height=Math.max(1,bottom-top);
    return {x:rect.width/2,y:top+height/2,width:rect.width,height};
  }
  const constrainPan=bindStateAtlasPan(map,visibleAtlasArea,()=>leaveAtlas({fast:true,keepPanning:true}));
  function skipTransition(){
    app.classList.add('phone-atlas-fast');
    cancelAnimationFrame(fastFrame);
    fastFrame=requestAnimationFrame(()=>{
      fastFrame=requestAnimationFrame(()=>app.classList.remove('phone-atlas-fast'));
    });
  }

  function show(next){
    stage=next;
    const full=stage==='atlas';
    app.dataset.phoneStage=stage;
    grip.hidden=full;
    tray.inert=stage==='closed';
    sheet.inert=stage==='closed'||stage==='tools';
    const feature=getSelected();
    up.hidden=full||stage==='summary'&&!atlasKind(feature)||stage==='tools'&&!feature;
    down.hidden=full||stage==='closed';
    clear.hidden=full||feature?.properties.kind!=='state';
    up.setAttribute('aria-label',{
      closed:'Show map tools',tools:'Show selection details',summary:`Open ${atlasName(feature)||'state'} atlas`,
    }[stage]||'Open atlas');
    down.setAttribute('aria-label',stage==='summary'?'Collapse selection details':'Hide map tools');
    atlasBack.hidden=factsGrip.hidden=!full;
    header.inert=rotation.inert=full;
    historyBack.hidden=!stateReturn||feature?.properties.kind!=='place';
    if(stateReturn)historyBack.setAttribute('aria-label',`Back to ${stateReturn.state.properties.name}`);
    clearTimeout(labelTimer);
    labelTimer=setTimeout(refreshLabels,reducedMotion.matches?0:250);
  }

  function openAtlas({fit=true,frameCity=false}={}){
    const feature=getSelected();
    const kind=atlasKind(feature);
    if(stage==='atlas'||!kind)return false;
    map.stop();
    savedCamera=kind==='place'||kind==='metro'?camera():null;
    cityView=kind==='place'?{frameCity,bounds:undefined,anchor:null,panning:false,adjusted:false}:null;
    closeKey();
    toolsMenu.open=false;
    document.activeElement?.blur();
    app.dataset.phoneAtlasKind=kind;
    for(const handle of [atlasBack,factsGrip])handle.setAttribute('aria-label',`Leave ${atlasName(feature)} atlas`);
    show('atlas');
    if(kind==='nation')nationalPanelMode(true);
    info.scrollTop=0;
    setFocus(feature);
    if(kind==='state')constrainPan(stateCorners(feature));
    if(fit)fitAtlas(feature,duration());else map.resize();
    if(frameCity){
      const view=cityView;
      cityBounds(feature).then(bounds=>{
        if(cityView!==view||view.adjusted)return;
        view.bounds=bounds;
        fitAtlas(feature,duration());
      });
    }
    return true;
  }

  function fitAtlas(feature,time){
    dock.style.removeProperty('--phone-atlas-facts-height');
    map.resize();
    if(cityView?.adjusted)return;
    if(cityView)cityView.anchor=null;
    if(cityView?.frameCity){
      if(cityView.bounds!==undefined)fitCity(cityView.bounds,visibleAtlasArea(),time);
    }else fitFeature(feature,atlasBack.offsetHeight,atlasSheetHeight(),time);
  }

  function leaveAtlas({restore=true,fast=false,keepPanning=false}={}){
    if(stage!=='atlas')return;
    const target=savedCamera;
    savedCamera=null;
    cityView=null;
    constrainPan(null);
    if(keepPanning){
      // Resizing MapLibre during a drag stops its native touch handler.
      // Show the stats now and restore the header inset after the map settles.
      app.classList.add('phone-atlas-panning');
      map.once('moveend',()=>{
        app.classList.remove('phone-atlas-panning');
        map.resize();
      });
    }else map.stop();
    if(fast)skipTransition();
    delete app.dataset.phoneAtlasKind;
    show(getSelected()?'summary':'tools');
    nationalPanelMode(false);
    setFocus(null,{fast});
    if(!keepPanning)map.resize();
    if(restore&&target){
      if(fast)map.jumpTo(target);
      else map.easeTo({...target,duration:duration()});
    }
  }

  function selectAndFitState(feature){
    leaveAtlas({restore:false,fast:true});
    select(feature,{zoom:true,duration:reducedMotion.matches?0:400});
  }

  function openCityFromState(feature){
    map.stop();
    const full=stage==='atlas';
    stateReturn={state:getSelected(),full,camera:camera(),scroll:info.scrollTop,
      sheetHeight:dock.style.getPropertyValue('--phone-atlas-facts-height')};
    if(full)leaveAtlas({restore:false,fast:true});
    select(feature,{zoom:!full});
    if(full)openAtlas();
  }

  function backToState(){
    if(!stateReturn)return;
    const origin=stateReturn;
    stateReturn=null;
    skipTransition();
    leaveAtlas({restore:false,fast:true});
    select(origin.state);
    if(origin.full){
      dock.style.setProperty('--phone-atlas-facts-height',origin.sheetHeight);
      openAtlas({fit:false});
    }
    map.jumpTo(origin.camera);
    info.scrollTop=origin.scroll;
  }

  function step(direction){
    if(direction<0&&stage==='atlas'){leaveAtlas();return;}
    const next=STAGES[STAGES.indexOf(stage)+direction];
    if(next==='atlas'){openAtlas();return;}
    if(next&&(next!=='summary'||getSelected()))show(next);
  }

  function selectionChanged(feature){
    if(!active)return;
    if(feature?.properties.kind!=='place')stateReturn=null;
    if(stage==='atlas')leaveAtlas();
    if(feature){closeKey();show('summary');}
    else show(stage==='closed'?'closed':'tools');
  }

  const mapTouches=bindMapTouches(map.getContainer(),{
    enabled:()=>active,hit,preview,
    hasState:()=>getSelected()?.properties.kind==='state',
    switchState(at){
      const current=getSelected();
      if(current?.properties.kind!=='state')return false;
      const next=stateAt(at);
      if(!next||next.properties.geoid===current.properties.geoid)return false;
      leaveAtlas({restore:false,fast:true});
      select(next);
      return true;
    },
    setBadgeGesture(blocked){
      if(blocked===badgeGesture)return;
      badgeGesture=blocked;
      if(blocked)map.doubleClickZoom.disable();else map.doubleClickZoom.enable();
    },
    badgeTap(result){
      if(!result?.feature)return;
      requestAnimationFrame(()=>{
        if(active)selectAndFitState(result.feature);
      });
    },
    hold(result){
      if(!result?.feature)return false;
      const {feature}=result;
      const current=getSelected();
      if(stage==='atlas'){
        if(current.properties.geoid===feature.properties.geoid||!atlasKind(feature))return false;
        leaveAtlas({restore:false,fast:true});
      }
      select(feature);
      if(atlasKind(feature))openAtlas({frameCity:feature.properties.kind==='place'&&result.layer?.startsWith('city-name')});
      return true;
    },
    immediate(result,at,target){
      if(stage!=='atlas')return false;
      const feature=getSelected();
      if(atlasKind(feature)==='nation'||atlasKind(feature)==='metro')return false;
      if(atlasKind(feature)==='state'){
        if(insideState(at,target,feature.properties.geoid))return false;
        leaveAtlas({fast:true});
        return true;
      }
      if(result?.feature?.properties.kind==='place'||insideMetro(at))return false;
      leaveAtlas({restore:false,fast:true});
      deselect();
      return true;
    },
    single(result){
      const layer=result?.layer;
      if(stage==='atlas'){
        const current=getSelected();
        const next=result?.feature;
        if(current.properties.kind==='nation'){
          if(next)select(next,{zoom:layer==='city-hit'||layer==='places-hit'});
          else deselect();
          return;
        }
        if((current.properties.kind==='place'||current.properties.kind==='metro')&&
          next?.properties.kind==='place'&&current.properties.geoid!==next.properties.geoid){
          leaveAtlas({restore:false,fast:true});
          select(next,{zoom:layer==='city-hit'||layer==='places-hit'});
        }
        return;
      }
      const zoom=layer==='city-hit'||layer==='places-hit';
      if(layer==='state-hit'){
        if(getSelected()?.properties.kind!=='state')select(result.feature);
        return;
      }
      if(zoom||layer?.startsWith('city-name')||layer==='county-hit'||layer==='county-names'||layer?.startsWith('metro-'))select(result.feature,{zoom});
      else if(getSelected())deselect();
    },
    amplifyZoom(at){
      const {left,top}=map.getContainer().getBoundingClientRect();
      const around=map.unproject([at.x-left,at.y-top]);
      const zoom=Math.min(map.getMaxZoom(),map.getZoom()+2);
      // Let MapLibre recognize the tap pair, then replace its one-level ease.
      queueMicrotask(()=>map.easeTo({around,zoom,duration:duration()}));
    },
  });
  map.on('zoomstart',mapTouches.onZoomStart);
  function rememberCityCenter(view){
    if(view.anchor)return;
    const {x,y}=visibleAtlasArea();
    view.anchor=map.unproject([x,y]);
  }
  map.getContainer().addEventListener('touchstart',event=>{
    const view=cityView;
    if(!view)return;
    if(event.touches.length>1){
      view.panning=false;
      view.adjusted=true;
    }else rememberCityCenter(view);
  },{passive:true,capture:true});
  map.on('dragstart',event=>{
    if(!active||event.originalEvent?.touches?.length!==1)return;
    mapTouches.cancel();
    const view=cityView;
    if(!view)return;
    rememberCityCenter(view);
    view.adjusted=true;
    view.panning=true;
  });
  map.on('move',()=>{
    const view=cityView;
    if(!view?.panning)return;
    const area=visibleAtlasArea(),point=map.project(view.anchor);
    if(Math.abs(point.x-area.x)<=area.width/4&&Math.abs(point.y-area.y)<=area.height/4)return;
    view.panning=false;
    queueMicrotask(()=>{
      if(cityView===view)leaveAtlas({restore:false,fast:true,keepPanning:map.isMoving()});
    });
  });
  map.on('moveend',()=>{if(cityView)cityView.panning=false;});

  bindDockSwipe(grip,{enabled:()=>active,onSwipe:step,follow:y=>dock.style.setProperty('--phone-drag',`${y}px`)});
  bindDockSwipe(tray,{enabled:()=>active,onSwipe:step,follow:y=>dock.style.setProperty('--phone-drag',`${y}px`)});
  for(const handle of [atlasBack,factsGrip]){
    bindDockSwipe(handle,{enabled:()=>stage==='atlas',onSwipe:direction=>{if(direction<0)leaveAtlas();}});
    handle.addEventListener('click',()=>leaveAtlas());
  }
  up.addEventListener('click',()=>step(1));
  down.addEventListener('click',()=>step(-1));
  clear.addEventListener('click',()=>{mapTouches.cancel();deselect();});
  home.addEventListener('click',()=>{mapTouches.cancel();reset();});
  historyBack.addEventListener('click',backToState);
  document.addEventListener('pointerdown',event=>{
    if(active&&!map.getContainer().contains(event.target))mapTouches.cancel();
  },true);

  // Pull up from the summary to open the atlas, and pull down from the top
  // of the atlas to close it. Scrolling within the full facts stays native.
  let scrollStart=null;
  info.addEventListener('touchstart',event=>{
    if(stage==='summary'&&info.querySelector('.region-counties[open]')){
      scrollStart=null;
      return;
    }
    const touch=event.touches[0];
    const direction=stage==='atlas'?1:stage==='summary'&&atlasKind(getSelected())?-1:0;
    const usaStats=stage==='summary'&&atlasKind(getSelected())==='nation';
    scrollStart=direction&&event.touches.length===1&&(usaStats||info.scrollTop<2)?
      {x:touch.clientX,y:touch.clientY,direction}:null;
  },{passive:true});
  info.addEventListener('touchmove',event=>{
    if(!scrollStart)return;
    const touch=event.touches[0],dx=Math.abs(touch.clientX-scrollStart.x),dy=(touch.clientY-scrollStart.y)*scrollStart.direction;
    if(event.touches.length!==1||dy< -6||dx>Math.max(12,dy))scrollStart=null;
    else if(dy>8&&event.cancelable)event.preventDefault();
  },{passive:false});
  info.addEventListener('touchend',event=>{
    if(!scrollStart)return;
    const {x,y,direction}=scrollStart;
    const touch=event.changedTouches[0],dx=Math.abs(touch.clientX-x),dy=(touch.clientY-y)*direction;
    scrollStart=null;
    if(dy>=28&&dy>dx*1.25){
      if(event.cancelable)event.preventDefault();
      if(direction>0)leaveAtlas();else openAtlas();
    }
  },{passive:false});
  info.addEventListener('touchcancel',()=>{scrollStart=null;});

  function updateMode(){
    if(active===media.matches)return;
    if(stage==='atlas')leaveAtlas();
    mapTouches.cancel();
    beforeModeChange();
    active=media.matches;
    app.classList.toggle('phone-layout',active);
    dock.hidden=!active;
    if(active){
      dockBody.append(...mapHud);
      $('#phone-tray-inner').append(controls);
      $('#phone-sheet-inner').append(panel);
      show(getSelected()?'summary':'closed');
    }else{
      shell.append(...mapHud);
      shell.insertBefore(controls,rotation);content.append(panel);
      delete app.dataset.phoneStage;
      historyBack.hidden=true;
    }
    renderSelection();
    map.resize();refreshLabels();
  }
  media.addEventListener('change',updateMode);
  window.addEventListener('resize',()=>{
    if(stage!=='atlas'||!active)return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{if(stage==='atlas')fitAtlas(getSelected(),0);});
  });
  updateMode();
  return {get active(){return active;},get focused(){return stage==='atlas'&&active;},selectionChanged,leaveAtlas,openCityFromState,selectAndFitState,
    refitAtlas(){if(stage==='atlas')fitAtlas(getSelected(),duration());}};
}
