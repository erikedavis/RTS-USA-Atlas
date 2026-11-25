import {cityMarkerBox,overlaps,placeLabel} from './city-layout.mjs?v=10a2';
import {setThemePaint} from './appearance.mjs?v=10a3';

// Angles are map-relative. Long and narrow features can supply a label
// axis, which also limits how far lettering can slide from its center.
// Main island spellings come from the Hawaiʻi Board on Geographic Names.
const mainHawaiianIslands=[
  {id:'hawaii-island',name:'Hawaiʻi',point:[-155.47,19.59],axis:[[-155.87,19.59],[-155.04,19.58]]},
  {id:'maui',name:'Maui',point:[-156.25,20.76],axis:[[-156.39,20.72],[-156.11,20.70]]},
  {id:'oahu',name:'Oʻahu',point:[-157.99,21.49],axis:[[-158.16,21.55],[-157.80,21.38]]},
  {id:'kauai',name:'Kauaʻi',point:[-159.52,22.05],axis:[[-159.72,22.04],[-159.34,22.06]]},
  {id:'molokai',name:'Molokaʻi',point:[-157.01,21.14],axis:[[-157.28,21.13],[-156.77,21.15]]},
  {id:'lanai',name:'Lānaʻi',point:[-156.93,20.83],axis:[[-157.03,20.86],[-156.85,20.80]]},
  {id:'niihau',name:'Niʻihau',point:[-160.16,21.89],axis:[[-160.21,21.81],[-160.10,21.98]]},
  {id:'kahoolawe',name:'Kahoʻolawe',point:[-156.61,20.55],axis:[[-156.68,20.57],[-156.55,20.54]]},
  {id:'lehua',name:'Lehua',point:[-160.10,22.02],minzoom:7.25},
  {id:'kaula',name:'Kaʻula',point:[-160.53,21.67],minzoom:7.25},
  {id:'molokini',name:'Molokini',point:[-156.496,20.632],minzoom:7.25},
].map(feature=>({...feature,kind:'island',stateFips:'15'}));

// Northwestern names follow NOAA's Papahānaumokuākea maps.
const northwesternHawaiianIslands=[
  {id:'nihoa',name:'Nihoa',point:[-161.92,23.06]},
  {id:'mokumanamana',name:'Mokumanamana',point:[-164.70,23.58]},
  {id:'french-frigate-shoals',name:'French Frigate Shoals',point:[-166.25,23.75]},
  {id:'gardner-pinnacles',name:'Gardner Pinnacles',point:[-168.00,25.00]},
  {id:'maro-reef',name:'Maro Reef',point:[-170.58,25.42]},
  {id:'laysan',name:'Laysan Island',point:[-171.74,25.77]},
  {id:'lisianski',name:'Lisianski Island',point:[-173.97,26.07]},
  {id:'pearl-and-hermes',name:'Pearl and Hermes Atoll',point:[-175.83,27.83]},
  {id:'midway',name:'Midway Atoll',point:[-177.37,28.23]},
  {id:'kure',name:'Kure Atoll',point:[-178.33,28.41]},
].map(feature=>({...feature,kind:'island'}));

const geography=[
  {id:'lake-superior',kind:'lake',name:'Lake Superior',point:[-88.55,47.66],angle:-5},
  {id:'lake-michigan',kind:'lake',name:'Lake Michigan',point:[-86.78,44.04],angle:-80},
  {id:'lake-huron',kind:'lake',name:'Lake Huron',point:[-82.66,44.60],angle:-50},
  {id:'lake-erie',kind:'lake',name:'Lake Erie',point:[-81.55,42.20],angle:-19},
  {id:'lake-ontario',kind:'lake',name:'Lake Ontario',point:[-77.98,43.66],angle:-8},
  {id:'michigan-upper-peninsula',kind:'peninsula',name:'Upper Peninsula',point:[-86.55,46.29],angle:-6},
  {id:'long-island',kind:'island',name:'Long Island',axis:[[-73.92,40.635],[-71.87,41.084]]},
  ...mainHawaiianIslands,
  ...northwesternHawaiianIslands,
];

const styles={
  lake:{zoom:4.25,fadeIn:5.35,fadeOut:8.55,end:9.65,opacity:.55,size:11.3},
  peninsula:{zoom:5.05,fadeIn:5.75,fadeOut:7.8,end:9.35,opacity:.49,size:9.6},
  island:{zoom:4.95,fadeIn:5.35,fadeOut:8.1,end:9.45,opacity:.69,size:9.8}
};
const font='Noto Sans Regular',letterSpacing=.13;
const collection=features=>({type:'FeatureCollection',features});

function candidatesFor(map,feature,{width,height,measure}){
  const style=styles[feature.kind],bearing=map.getBearing();
  const textWidth=measure(feature.name,style.size,font)+(feature.name.length-1)*letterSpacing*style.size+5;
  const textHeight=style.size*1.25+2;
  const candidates=[];
  function add(center,angle,shift) {
    angle=((angle+270)%180+180)%180-90;
    const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    const halfWidth=(Math.abs(cos)*textWidth+Math.abs(sin)*textHeight)/2;
    const halfHeight=(Math.abs(sin)*textWidth+Math.abs(cos)*textHeight)/2;
    const offsets=shift?[0,shift/2,-shift/2,shift,-shift]:[0];
    for(const offset of offsets){
      const x=center.x+offset*cos,y=center.y+offset*sin;
      const box={x0:x-halfWidth,y0:y-halfHeight,x1:x+halfWidth,y1:y+halfHeight};
      if(box.x0>=5&&box.y0>=5&&box.x1<=width-5&&box.y1<=height-5)candidates.push({x,y,angle:angle+bearing,box});
    }
  }
  if(feature.axis){
    const [start,end]=feature.axis.map(point=>map.project(point));
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    if(textWidth<=length){
      const center={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      add(center,Math.atan2(dy,dx)*180/Math.PI,Math.min(35,(length-textWidth)/2));
    }
  }
  if(feature.point){
    const {x,y}=map.project(feature.point);
    if(feature.kind==='island'){
      // Small islands and atolls can use nearby water when their name won't fit on land.
      const dx=textWidth/2+5,dy=textHeight/2+5;
      for(const [offsetX,offsetY] of [
        [0,-dy],[0,dy],[dx,0],[-dx,0],
        [dx,-dy],[-dx,-dy],[dx,dy],[-dx,dy],[0,-2*dy],[0,2*dy],
      ]){
        add({x:x+offsetX,y:y+offsetY},0,0);
      }
    }else add({x,y},feature.angle-bearing,16);
  }
  return candidates;
}

function fitAlongsideCities(candidates,cities,obstacles,viewport){
  const clear=candidates.filter(({box})=>!obstacles.some(other=>overlaps(box,other,2)));
  const fits=clear.map(candidate=>({
    candidate,conflicts:cities.filter(city=>overlaps(candidate.box,city.placement.box,2))
  })).sort((a,b)=>a.conflicts.length-b.conflicts.length);
  for(const {candidate,conflicts} of fits){
    const reserved=[...obstacles,candidate.box,
      ...cities.filter(city=>!conflicts.includes(city)).map(city=>({...city.placement.box,city:true}))];
    const moved=[];
    for(const city of conflicts){
      const {geoid}=city.feature.properties;
      const placement=placeLabel(city,{...viewport,previous:city.placement,scale:city.placement.size/city.style.labelSize,
        reserved:reserved.filter(box=>box.marker!==geoid)});
      if(!placement)break;
      moved.push({city,placement});
      reserved.push({...placement.box,city:true});
    }
    // Keep all current city names at their current sizes. A geographic
    // label only earns space if every affected city still fits.
    if(moved.length===conflicts.length)return {candidate,moved};
  }
  return null;
}

export function createGeographyLabels(map){
  const source='geographic-regions';
  map.addSource(source,{type:'geojson',data:collection([])});
  const layout={'text-field':['get','name'],'text-transform':'uppercase','text-font':[font],
    'text-rotate':['get','angle'],'text-rotation-alignment':'map','text-pitch-alignment':'map',
    'text-letter-spacing':letterSpacing,'text-allow-overlap':true,'text-ignore-placement':true,'text-max-width':30};
  for(const [kind,region] of Object.entries(styles)){
    map.addLayer({id:`geography-${kind}`,type:'symbol',source,
      minzoom:region.zoom,maxzoom:region.end,filter:['==',['get','kind'],kind],
      layout:{...layout,'text-size':region.size},paint:{'text-halo-width':.7}});
  }
  let boxes=[],lastData='';
  return {
    setAppearance(palette){
      for(const [kind,region] of Object.entries(styles)){
        const id=`geography-${kind}`,opacity=Math.min(.94,region.opacity*palette.geographyStrength);
        setThemePaint(map,id,'text-color',palette[kind+'Text']);
        setThemePaint(map,id,'text-halo-color',kind==='lake'?palette.lakeHalo:palette.geographyHalo);
        setThemePaint(map,id,'text-opacity',[
          'interpolate',['linear'],['zoom'],region.zoom,0,region.fadeIn,opacity,region.fadeOut,opacity,region.end,0,
        ]);
      }
    },
    reservations:()=>boxes,
    layout(result,viewport,reserved,focusedState){
      const zoom=map.getZoom(),names=result.items.filter(city=>city.placement);
      const obstacles=[...reserved,...result.items.map(cityMarkerBox)];
      const features=[];
      boxes=[];
      for(const feature of geography){
        const {id,kind,name}=feature,{zoom:start,end}=styles[kind];
        if(zoom<=(feature.minzoom??start)||zoom>=end)continue;
        if(focusedState&&focusedState!==feature.stateFips)continue;
        const fit=fitAlongsideCities(candidatesFor(map,feature,viewport),names,obstacles,viewport);
        if(!fit)continue;
        for(const {city,placement} of fit.moved){
          city.placement=placement;
          result.placements.set(city.feature.properties.geoid,placement);
        }
        const {x,y,angle,box}=fit.candidate;
        boxes.push(box);
        obstacles.push(box);
        features.push({type:'Feature',id,properties:{id,kind,name,angle},
          geometry:{type:'Point',coordinates:map.unproject([x,y]).toArray()}});
      }
      const data=collection(features),key=JSON.stringify(data);
      if(key!==lastData){lastData=key;map.getSource(source).setData(data);}
    }
  };
}
