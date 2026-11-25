import {cityMarkerBox,overlaps,placeLabel} from './city-layout.mjs?v=10a2';
import {setThemePaint} from './appearance.mjs?v=10a3';

// Angles are map-relative. Long and narrow features can supply a label
// axis, which also limits how far lettering can slide from its center.
const geography=[
  {id:'lake-superior',kind:'lake',name:'Lake Superior',point:[-88.55,47.66],angle:-5},
  {id:'lake-michigan',kind:'lake',name:'Lake Michigan',point:[-86.78,44.04],angle:-80},
  {id:'lake-huron',kind:'lake',name:'Lake Huron',point:[-82.66,44.60],angle:-50},
  {id:'lake-erie',kind:'lake',name:'Lake Erie',point:[-81.55,42.20],angle:-19},
  {id:'lake-ontario',kind:'lake',name:'Lake Ontario',point:[-77.98,43.66],angle:-8},
  {id:'michigan-upper-peninsula',kind:'peninsula',name:'Upper Peninsula',point:[-86.55,46.29],angle:-6},
  {id:'long-island',kind:'island',name:'Long Island',axis:[[-73.92,40.635],[-71.87,41.084]]}
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
  let center,angle,shift;
  if(feature.axis){
    const [start,end]=feature.axis.map(point=>map.project(point));
    const dx=end.x-start.x,dy=end.y-start.y;
    const length=Math.hypot(dx,dy);
    if(textWidth>length)return [];
    center={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
    angle=Math.atan2(dy,dx)*180/Math.PI;
    shift=Math.min(35,(length-textWidth)/2);
  }else{
    center=map.project(feature.point);
    angle=feature.angle-bearing;
    shift=16;
  }
  angle=((angle+270)%180+180)%180-90;
  const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  const halfWidth=(Math.abs(cos)*textWidth+Math.abs(sin)*textHeight)/2;
  const halfHeight=(Math.abs(sin)*textWidth+Math.abs(cos)*textHeight)/2;
  return [0,shift/2,-shift/2,shift,-shift].map(offset=>{
    const x=center.x+offset*cos,y=center.y+offset*sin;
    return {x,y,angle:angle+bearing,box:{x0:x-halfWidth,y0:y-halfHeight,x1:x+halfWidth,y1:y+halfHeight}};
  }).filter(({box})=>box.x0>=5&&box.y0>=5&&box.x1<=width-5&&box.y1<=height-5);
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
    layout(result,viewport,reserved){
      const zoom=map.getZoom(),names=result.items.filter(city=>city.placement);
      const obstacles=[...reserved,...result.items.map(cityMarkerBox)];
      const features=[];
      boxes=[];
      for(const feature of geography){
        const {id,kind,name}=feature,{zoom:start,end}=styles[kind];
        if(zoom<=start||zoom>=end)continue;
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
