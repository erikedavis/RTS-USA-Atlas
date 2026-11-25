import {displayPoint} from './geographic-display.mjs';
import {overlaps} from './city-layout.mjs';
import {isNorthUp} from './map-rotation.mjs';
import {badgeBox,compactBadgeBox,badgeFitsInState,badgeTouchesLand,fitStateLabel,prepareStateShapes,projectStateShapes} from './state-label-placement.mjs';

// Exterior anchors come from the marked reference views. They are geographic
// points, not offsets that change with scale. If a point is blocked, omit it.
const SMALL_STATES=new Map([
  ['RI',{inside:[[-71.62,41.65],[-71.68,41.56]],outside:[-71.52,41.17]}],
  ['DC',{inside:[[-76.954,38.885]]}],
  ['NJ',{inside:[[-74.61,39.99],[-74.50,39.82]],outside:[-73.78,39.81]}],
  ['DE',{inside:[[-75.54,39.00],[-75.55,38.74]],outside:[-74.80,38.57]}],
  ['MD',{inside:[[-77.24,39.54],[-77.10,39.47],[-76.72,39.56],[-76.22,38.92]],
    outside:[-75.27,37.54]}],
  ['CT',{inside:[[-72.81,41.62],[-72.27,41.68]]}],
  ['MA',{inside:[[-72.36,42.56],[-72.36,42.45]]}],
  ['VT',{inside:[[-72.60,44.51],[-72.61,44.02],[-72.78,44.78]]}],
  ['NH',{inside:[[-71.57,43.75],[-71.62,43.96],[-71.68,43.48]]}],
]);
// At overview scale there may be no room for a badge inside these islands.
const ISLAND_BADGES=new Map([
  ['HI',[-155.6,17.4]],
  ['PR',[-68.4,16.4]],
]);
const collection=features=>({type:'FeatureCollection',features});
const pointFeature=(item,coordinates)=>({type:'Feature',properties:{geoid:item.p.geoid},geometry:{type:'Point',coordinates}});

export function createStateLabels(map,labels,states,Marker,onSelect,isNational,protectedMarkerBoxes,wideStateLabels,stateLabelsFirst){
  map.addSource('state-label-anchors',{type:'geojson',data:collection([])});
  map.addImage('state-label-space',{width:29,height:21,data:new Uint8Array(29*21*4)});
  map.addLayer({id:'state-label-obstacles',type:'symbol',source:'state-label-anchors',layout:{'icon-image':'state-label-space','icon-allow-overlap':true}});
  const stateShapes=new Map(states.features.map(f=>[f.properties.geoid,prepareStateShapes(f.geometry)]));
  const allPolygons=[...stateShapes].flatMap(([geoid,polygons])=>polygons.map(p=>({...p,geoid})));
  const items=labels.map(p=>{
    const node=document.createElement('button'),text=document.createElement('span');
    node.type='button';node.className='state-label';text.className='state-label-text';text.textContent=p.abbr;node.append(text);
    node.title='Zoom to '+p.name;node.setAttribute('aria-label','Select '+p.name);node.dataset.geoid=p.geoid;
    node.addEventListener('click',event=>{event.stopPropagation();onSelect(p.geoid,event);});
    node.addEventListener('dblclick',event=>event.stopPropagation());
    const small=SMALL_STATES.get(p.abbr);
    if(small)node.classList.add('state-label-small');
    const original=small?.inside[0]||displayPoint(p.coordinates,p.abbr);
    node.style.display='none';
    const marker=new Marker({element:node,anchor:'center',rotationAlignment:'viewport'}).setLngLat(original);
    const outside=small?.outside||ISLAND_BADGES.get(p.abbr);
    const neighbors=outside?allPolygons.filter(polygon=>polygon.geoid!==p.geoid):[];
    return {p,node,marker,original,small,outside,neighbors,polygons:stateShapes.get(p.geoid)||[]};
  });

  let lastKey='',focusedState=null,selectedState=null;
  let anchorKey='';
  function layout(){
    const center=map.getCenter(),container=map.getContainer();
    const w=container.clientWidth,h=container.clientHeight,national=isNational(),zoom=map.getZoom();
    const bearing=map.getBearing(),rotated=!isNorthUp(bearing);
    const wide=wideStateLabels(),priority=stateLabelsFirst();
    const areaLabel=container.querySelector('.selected-area-label:not([hidden])');
    const key=[center.lng,center.lat,zoom,bearing,w,h,national,focusedState,wide,priority,areaLabel?.style.transform,areaLabel?.textContent].join('|');
    if(key===lastKey)return;
    lastKey=key;
    container.classList.toggle('state-label-priority',wide);
    const origin=container.getBoundingClientRect(),viewport={x0:5,y0:5,x1:w-5,y1:h-5};
    const bounds=map.getBounds();
    const viewBounds={west:bounds.getWest(),east:bounds.getEast(),south:bounds.getSouth(),north:bounds.getNorth()};
    const obstacles=[...container.parentElement.parentElement.querySelectorAll('.map-controls:not(.phone-dock .map-controls),#reset-view,#sidebar-toggle,.rotation-tools:not([inert]),.map-key-toggle,.dev-zoom,#appearance-toggle,#usa-label,.selected-area-label,.phone-grip,.phone-dock-row:not([inert]),.phone-home:not([hidden]),.phone-atlas-back:not([hidden]),.phone-history-back:not([hidden])')]
      .filter(node=>node.offsetWidth&&node.offsetHeight)
      .map(node=>{const b=node.getBoundingClientRect();return {x0:b.left-origin.left,y0:b.top-origin.top,x1:b.right-origin.left,y1:b.bottom-origin.top};});
    const uiObstacles=[...obstacles];
    const markers=wide?[]:protectedMarkerBoxes();
    if(!priority)obstacles.push(...markers);
    const anchors=[],outsideBadges=[],shown=new Set();
    const defaultSize=w<670?10.8:13.2;
    const roomFor=(point,size,plain=false,compact=false)=>{
      const box=compact?compactBadgeBox(point,size):badgeBox(point,size,plain);
      return box.x0>=viewport.x0&&box.y0>=viewport.y0&&box.x1<=viewport.x1&&box.y1<=viewport.y1&&
        !obstacles.some(other=>overlaps(box,other,compact?1:2));
    };
    function show(item,point,size){
      shown.add(item);
      item.node.style.fontSize=size+'px';
      const coordinates=map.unproject(point).toArray().map(value=>Number(value.toFixed(7)));
      if(!item.coordinates||coordinates.some((value,i)=>value!==item.coordinates[i])){
        item.marker.setLngLat(coordinates);item.coordinates=coordinates;
      }
      if(item.node.style.display==='none'){
        item.node.style.display='';item.marker.addTo(map);
      }
      anchors.push(pointFeature(item,coordinates));
      obstacles.push((wide||item.p.abbr==='PR')&&!item.small?compactBadgeBox(point,size):badgeBox(point,size,Boolean(item.small)));
    }
    const wideShapes=new Map();
    const ordered=items.slice();
    if(wide){
      const constraints=new Map();
      for(const item of ordered){
        const projected=projectStateShapes(map,item.polygons,viewBounds,viewport,rotated);
        wideShapes.set(item,projected);
        constraints.set(item,projected.reduce((max,{rect})=>Math.max(max,Math.min(rect.x1-rect.x0,rect.y1-rect.y0)),0));
      }
      // Place states with little room first. Roomier states can move their
      // lettering out of the way while keeping it within their borders.
      ordered.sort((a,b)=>constraints.get(a)-constraints.get(b));
    }
    if(selectedState)ordered.sort((a,b)=>Number(b.p.geoid===selectedState)-Number(a.p.geoid===selectedState));
    for(const item of ordered){
      if(focusedState&&item.p.geoid!==focusedState)continue;
      const anchor=map.project(item.original);
      if(item.small){
        const candidates=item.small.inside.map(coordinates=>map.project(coordinates));
        for(const size of [defaultSize,10.3,8.7,7.8]){
          const point=candidates.find(point=>roomFor(point,size,true)&&badgeFitsInState(map,item.polygons,point,size,rotated));
          if(point){show(item,point,size);break;}
        }
        if(!shown.has(item)&&item.outside)outsideBadges.push(item);
        continue;
      }
      const compact=wide||item.p.abbr==='PR';
      const sizes=compact?[defaultSize,9.7,8.7,7.8,7]:national?[defaultSize,10.3,8.7,7.8,7]:[defaultSize,10.3];
      const projected=wideShapes.get(item)||projectStateShapes(map,item.polygons,viewBounds,viewport,rotated);
      for(const size of sizes){
        const nudge=priority&&markers.length?fitStateLabel(map,projected,anchor,size,viewport,[...obstacles,...markers],{compact,rotated,nearOnly:true}):null;
        const point=nudge||fitStateLabel(map,projected,anchor,size,viewport,obstacles,{compact,rotated});
        if(point){show(item,point,size);break;}
      }
      if((priority||compact)&&!shown.has(item))for(const size of [8.7,7.8,7]){
        const point=fitStateLabel(map,projected,anchor,size,viewport,obstacles,{compact:true,centerOnly:true,rotated});
        if(point){show(item,point,size);break;}
      }
      if(national&&item.outside&&!shown.has(item))outsideBadges.push(item);
    }
    for(const item of outsideBadges){
      const point=map.project(item.outside);
      for(const size of [8.7,7.8]){
        if(roomFor(point,size,true)&&!badgeTouchesLand(map,item.neighbors,point,size,rotated)){
          show(item,point,size);break;
        }
      }
    }
    const selection=selectedState&&ordered.find(item=>item.p.geoid===selectedState);
    if(selection&&!shown.has(selection)&&(!focusedState||selectedState===focusedState)){
      const projected=wideShapes.get(selection)||projectStateShapes(map,selection.polygons,viewBounds,viewport,rotated);
      const anchor=map.project(selection.original);
      for(const size of [defaultSize,9.7,7.8,7]){
        const point=fitStateLabel(map,projected,anchor,size,viewport,uiObstacles,{compact:true,centerOnly:true,rotated});
        if(point){show(selection,point,size);break;}
      }
    }
    for(const item of items){
      if(!shown.has(item)&&item.node.style.display!=='none'){
        item.marker.remove();item.node.style.display='none';
      }
    }
    const nextAnchorKey=JSON.stringify(anchors);
    if(nextAnchorKey!==anchorKey){map.getSource('state-label-anchors').setData(collection(anchors));anchorKey=nextAnchorKey;}
  }

  function reservations(){
    const origin=map.getContainer().getBoundingClientRect();
    return items.filter(item=>item.node.style.display!=='none'&&(!focusedState||item.p.geoid===focusedState)).map(item=>{
      const box=item.node.firstElementChild.getBoundingClientRect();
      return {x0:box.left-origin.left-2,y0:box.top-origin.top-2,x1:box.right-origin.left+2,y1:box.bottom-origin.top+2,state:true};
    });
  }
  function setFocus(geoid){
    focusedState=geoid;
    for(const item of items)item.node.toggleAttribute('data-phone-focused',item.p.geoid===geoid);
  }
  function setSelected(geoid){
    if(selectedState===geoid)return;
    selectedState=geoid;
    for(const {p,node} of items){
      if(p.geoid===geoid)node.setAttribute('aria-current','true');
      else node.removeAttribute('aria-current');
    }
    lastKey='';
  }
  function refresh(){lastKey='';layout();}
  return {layout,items,reservations,setFocus,setSelected,refresh};
}
