import {overlaps} from './city-layout.mjs';
import {isNorthUp} from './map-rotation.mjs';
import {fitStateLabel,prepareStateShapes,projectStateShapes} from './state-label-placement.mjs';

export function createSelectedAreaLabel(map,Marker){
  const label=document.createElement('span');
  label.className='selected-area-label';
  label.setAttribute('aria-hidden','true');
  label.hidden=true;
  const marker=new Marker({element:label,rotationAlignment:'viewport'}).setLngLat([0,0]).addTo(map);
  let current,shapes;

  function layout(feature,name,coordinates,obstacles){
    if(!feature){label.hidden=true;return;}
    if(feature!==current){
      current=feature;
      shapes=prepareStateShapes(feature.geometry);
    }
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    const viewport={x0:7,y0:7,x1:w-7,y1:h-7};
    const bounds=map.getBounds();
    const viewBounds={west:bounds.getWest(),east:bounds.getEast(),south:bounds.getSouth(),north:bounds.getNorth()};
    const rotated=!isNorthUp(map.getBearing());
    const projected=projectStateShapes(map,shapes,viewBounds,viewport,rotated)
      .filter(({rect})=>rect.x1>rect.x0&&rect.y1>rect.y0);
    if(!projected.length){label.hidden=true;return;}

    if(label.textContent!==name)label.textContent=name;
    label.style.maxWidth=Math.min(225,w-24)+'px';
    label.hidden=false;
    const halfWidth=label.offsetWidth/2+4,halfHeight=label.offsetHeight/2+3;
    const labelBox=({x,y})=>({x0:x-halfWidth,x1:x+halfWidth,y0:y-halfHeight,y1:y+halfHeight});
    const {rect}=projected[0];
    const visibleCenter={x:(rect.x0+rect.x1)/2,y:(rect.y0+rect.y1)/2};
    const preferred=coordinates?map.project(coordinates):visibleCenter;
    const fit={rotated,labelBox};
    let point=fitStateLabel(map,projected,preferred,13,viewport,obstacles,fit)
      ||fitStateLabel(map,projected,preferred,13,viewport,obstacles,{...fit,centerOnly:true});
    if(!point){
      // At overview zoom the lettering can be wider than the area itself.
      const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
      point=[[0,0],[0,-22],[0,22],[-30,0],[30,0]].map(([dx,dy])=>({
        x:clamp(visibleCenter.x+dx,viewport.x0+halfWidth,viewport.x1-halfWidth),
        y:clamp(visibleCenter.y+dy,viewport.y0+halfHeight,viewport.y1-halfHeight),
      })).find(candidate=>!obstacles.some(box=>overlaps(labelBox(candidate),box,2)));
    }
    label.hidden=!point;
    if(point)marker.setLngLat(map.unproject(point));
  }

  return {layout,clear(){label.hidden=true;}};
}
