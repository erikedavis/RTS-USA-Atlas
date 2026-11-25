import {appearance} from './city-layout.mjs';
import {displayPoint} from './insets.mjs';
import {isNorthUp} from './map-rotation.mjs';
import {fitStateLabel,prepareStateShapes,projectStateShapes} from './state-label-placement.mjs';

export const COUNTY_LABEL_ZOOM=7;
export const countyLabelSize=zoom=>1.2*appearance({population:50000},zoom).labelSize;

export function createCountyLabels(map){
  const drawings=document.createElement('canvas').getContext('2d');
  // The county objects come from the existing per-state geometry cache.
  const shapes=new WeakMap();
  let lastKey='';
  map.addSource('county-labels',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'county-names',type:'symbol',source:'county-labels',minzoom:COUNTY_LABEL_ZOOM,layout:{
    visibility:'none','text-field':['get','label'],'text-font':['Noto Sans Regular'],
    'text-size':['get','size'],'text-letter-spacing':.04,'text-allow-overlap':true,
    'text-ignore-placement':true,'text-max-width':40,
  },paint:{'text-halo-width':1.3}});

  function layout(counties,anchors,obstacles,selectedId){
    const features=[],zoom=map.getZoom(),size=countyLabelSize(zoom);
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    const viewport={x0:5,y0:5,x1:w-5,y1:h-5};
    const bounds=map.getBounds();
    const viewBounds={west:bounds.getWest(),east:bounds.getEast(),south:bounds.getSouth(),north:bounds.getNorth()};
    const rotated=!isNorthUp(map.getBearing());
    drawings.font=`${size}px Arial`;
    for(const county of counties){
      const p=county.properties,coordinates=anchors[p.geoid];
      if(!coordinates||p.geoid===selectedId)continue;
      if(!shapes.has(county))shapes.set(county,prepareStateShapes(county.geometry));
      const projected=projectStateShapes(map,shapes.get(county),viewBounds,viewport,rotated);
      if(!projected.length)continue;
      const label=p.name.toUpperCase();
      const width=drawings.measureText(label).width+label.length*size*.045+5;
      const height=size*1.24+4;
      const labelBox=({x,y})=>({x0:x-width/2,x1:x+width/2,y0:y-height/2,y1:y+height/2});
      const anchor=map.project(displayPoint(coordinates,p.state_abbr));
      const reservations=p.state_abbr==='PR'?obstacles.filter(box=>box.inset!=='PR'):obstacles;
      const point=fitStateLabel(map,projected,anchor,size,viewport,reservations,{rotated,labelBox});
      if(!point)continue;
      const placement=map.unproject(point).toArray().map(coordinate=>Number(coordinate.toFixed(7)));
      features.push({type:'Feature',properties:{geoid:p.geoid,state_fips:p.state_fips,label,size},
        geometry:{type:'Point',coordinates:placement}});
      obstacles.push(labelBox(point));
    }
    const key=JSON.stringify(features);
    if(key===lastKey)return;
    lastKey=key;
    map.getSource('county-labels').setData({type:'FeatureCollection',features});
  }
  return {layout,clear(){
    if(!lastKey)return;
    lastKey='';
    map.getSource('county-labels').setData({type:'FeatureCollection',features:[]});
  }};
}
