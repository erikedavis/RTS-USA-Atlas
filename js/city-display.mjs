import {layoutCities,placeLabel,appearance,requiredCityLabel,cityMarkerBox,HOVER_GRACE_MS} from './city-layout.mjs';
import {capitalMarkSize,cityIconName,registerCitySymbols} from './city-symbols.mjs';
const fc=features=>({type:'FeatureCollection',features});
export function createCityLayers(map,cities,{isNational,metroOverview,phoneViewport,stateLabelsFirst}){
 const byId=new Map(cities.features.map(f=>[f.properties.geoid,f]));
 const priorityFeatures=cities.features.filter(f=>requiredCityLabel(f.properties,{national:true,zoom:6})||
  requiredCityLabel(f.properties,{national:false,zoom:6}));
 const ctx=document.createElement('canvas').getContext('2d');
 const measure=(text,size,font)=>{ctx.font=`${font.includes('Bold')?600:400} ${size}px Arial`;return ctx.measureText(text.toUpperCase()).width;};
 let state,focusedState=null,selectedId='',hovered='',timer=0,scheduled=0,reservations=()=>[],previous=new Map(),result={items:[],metrics:{}};
 function pointFeature(item,pl=item.placement,hover=false){
  const capitalSize=capitalMarkSize(map.getZoom());
  return {type:'Feature',geometry:item.feature.geometry,properties:{
   ...item.feature.properties,radius:item.style.radius,labelSize:pl?.size||item.style.labelSize,
   opacity:item.style.opacity,symbol:cityIconName(item.style.tier),capitalSize,
   capitalOffset:[(item.style.radius*(hover?1.15:1)+2.7)/capitalSize,.09],
   iconOpacity:metroOverview()&&!pl&&!hover&&item.feature.properties.geoid!==selectedId?item.style.opacity*.45:item.style.opacity,
   font:[item.style.weight],anchor:pl?.anchor||'left',offset:pl?[pl.dx/pl.size,pl.dy/pl.size]:[1,0],showLabel:!!pl}};
 }
 for(const id of ['major-cities','hover-city'])map.addSource(id,{type:'geojson',data:fc([])});
 registerCitySymbols(map);
 const iconLayout={'icon-image':['get','symbol'],'icon-size':['/',['get','radius'],8],
  'icon-allow-overlap':true,'icon-ignore-placement':true};
 map.addLayer({id:'city-dot-0',type:'symbol',source:'major-cities',layout:iconLayout,paint:{'icon-opacity':['get','iconOpacity']}});
 const capitalLayout={'text-field':'*','text-font':['Noto Sans Bold'],'text-size':['get','capitalSize'],'text-anchor':'left',
  'text-offset':['get','capitalOffset'],'text-allow-overlap':true,'text-ignore-placement':true};
 const capitalFilter=['==',['get','is_capital'],true];
 map.addLayer({id:'city-capital-mark',type:'symbol',source:'major-cities',filter:capitalFilter,layout:capitalLayout,
  paint:{'text-color':'#d5e8f6','text-opacity':['get','iconOpacity']}});
 map.addLayer({id:'city-hit',type:'circle',source:'major-cities',paint:{
  'circle-radius':['max',5.5,['+',['get','radius'],1.5],['case',['get','is_capital'],['*',['get','radius'],1.85],0]],
  'circle-opacity':.001}});
 const names={type:'symbol',layout:{'text-field':['get','name'],'text-transform':'uppercase','text-font':['case',['==',['at',0,['get','font']],'Noto Sans Bold'],['literal',['Noto Sans Bold']],['literal',['Noto Sans Regular']]],'text-size':['get','labelSize'],'text-anchor':['get','anchor'],'text-offset':['get','offset'],'text-allow-overlap':true,'text-max-width':40,'text-padding':0},paint:{'text-color':'#bbd1e0','text-halo-color':'#0a111a','text-halo-width':1.4}};
 map.addLayer({...structuredClone(names),id:'city-name-0',source:'major-cities',filter:['==',['get','showLabel'],true]});
 map.addLayer({id:'city-hover-glow',type:'circle',source:'hover-city',paint:{'circle-radius':['+',['get','radius'],6],'circle-color':'#a9dfff','circle-opacity':.5,'circle-blur':.9}});
 map.addLayer({id:'city-hover-symbol',type:'symbol',source:'hover-city',layout:{...iconLayout,'icon-size':['/',['*',['get','radius'],1.15],8]}});
 map.addLayer({id:'city-hover-capital-mark',type:'symbol',source:'hover-city',filter:capitalFilter,layout:capitalLayout,paint:{'text-color':'#fff'}});
 map.addLayer({...structuredClone(names),id:'city-name-hover',source:'hover-city',paint:{...names.paint,'text-color':'#ffffff','text-halo-width':2.2}});
 map.setPaintProperty('city-name-0','text-opacity',['get','opacity']);
 function hideBaseHover(){
  const visible=['all',['!=',['get','geoid'],hovered]];
  if(focusedState)visible.push(['==',['get','state_fips'],focusedState]);
  map.setFilter('city-name-0',['all',['==',['get','showLabel'],true],visible]);
  map.setFilter('city-capital-mark',['all',capitalFilter,visible]);
 }
 function drawHover(){
  const feature=byId.get(hovered);if(!feature){map.getSource('hover-city').setData(fc([]));hideBaseHover();return;}
  const p=map.project(feature.geometry.coordinates),base=result.items.find(i=>i.feature.properties.geoid===hovered);
  const item={feature,x:p.x,y:p.y,style:{...(base?.style||appearance(feature.properties,map.getZoom())),weight:'Noto Sans Bold',opacity:1}};
  const obstacles=reservations().filter(r=>!r.inset||r.inset!==feature.properties.state_abbr);
  const pl=placeLabel(item,{width:map.getContainer().clientWidth,height:map.getContainer().clientHeight,reserved:obstacles,measure,force:true,scale:1.15,previous:base?.placement});
  map.getSource('hover-city').setData(fc([pointFeature(item,pl,true)]));hideBaseHover();
 }
 function clearHover(){clearTimeout(timer);timer=0;if(!hovered)return;hovered='';drawHover();}
 function hover(feature){const id=feature?.properties?.geoid;
  if(id&&byId.has(id)){clearTimeout(timer);timer=0;if(id!==hovered){hovered=id;drawHover();}}
  else if(hovered&&!timer)timer=setTimeout(clearHover,HOVER_GRACE_MS);
 }
 function layout(){
  cancelAnimationFrame(scheduled);scheduled=0;
  if(map.isMoving())return;
  const width=map.getContainer().clientWidth,height=map.getContainer().clientHeight,zoom=map.getZoom();
  const b=map.getBounds(),px=(b.getEast()-b.getWest())*.15,py=(b.getNorth()-b.getSouth())*.15,world=512*2**zoom,projected=[];
  for(const feature of cities.features){const [lng,lat]=feature.geometry.coordinates;
   if(focusedState&&feature.properties.state_fips!==focusedState)continue;
   if(lng<b.getWest()-px||lng>b.getEast()+px||lat<b.getSouth()-py||lat>b.getNorth()+py)continue;
   const p=map.project(feature.geometry.coordinates),sin=Math.sin(lat*Math.PI/180);
   projected.push({feature,x:p.x,y:p.y,worldX:(lng+180)/360*world,worldY:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*world});
  }
  result=layoutCities(projected,{width,height,zoom,state,selectedId,national:isNational(),metroOverview:metroOverview(),phoneViewport:phoneViewport(),stateLabelsFirst:stateLabelsFirst(),reserved:reservations(),previous,measure});previous=result.placements;
  map.getSource('major-cities').setData(fc(result.items.map(i=>pointFeature(i))));
  if(hovered)drawHover();
 }
 function protectedMarkerBoxes(){
  const zoom=map.getZoom(),priority={zoom,national:isNational(),selectedId};
  const selected=byId.get(selectedId);
  const features=selected&&!priorityFeatures.includes(selected)?[...priorityFeatures,selected]:priorityFeatures;
  return features.filter(f=>(!focusedState||f.properties.state_fips===focusedState)&&requiredCityLabel(f.properties,priority)).map(feature=>{
    const {x,y}=map.project(feature.geometry.coordinates);
    return cityMarkerBox({x,y,feature,style:appearance(feature.properties,zoom)});
  });
 }
 function schedule(){if(!scheduled&&!map.isMoving())scheduled=requestAnimationFrame(layout);}
 function labelReservations(){
  return result.items.flatMap(item=>item.placement?[cityMarkerBox(item),item.placement.box]:[cityMarkerBox(item)]);
 }
 function labelNear({x,y}){
  let best=null,bestGap=7,bestCenter=Infinity;
  for(const item of result.items){
   if(!item.placement||(focusedState&&item.feature.properties.state_fips!==focusedState))continue;
   const {x0,y0,x1,y1}=item.placement.box;
   const anchor=map.project(item.feature.geometry.coordinates);
   const dx=anchor.x-item.x,dy=anchor.y-item.y;
   const gap=Math.hypot(Math.max(x0+dx-x,0,x-x1-dx),Math.max(y0+dy-y,0,y-y1-dy));
   if(gap>bestGap)continue;
   const center=Math.hypot(x-(x0+x1)/2-dx,y-(y0+y1)/2-dy);
   if(gap<bestGap||center<bestCenter){bestGap=gap;bestCenter=center;best=item.feature;}
  }
  return best;
 }
 map.on('movestart',clearHover);map.getCanvas().addEventListener('mouseleave',()=>hover());
 return {hitLayers:['city-name-hover','city-name-0','city-hit'],hover,clearHover,labelNear,labelReservations,
  update(nextState,selected){
    const nextId=selected?.properties.kind==='place'?selected.properties.geoid:'';
    if(state===nextState&&selectedId===nextId)return;
    state=nextState;selectedId=nextId;schedule();
  },
  setFocus(geoid){
    focusedState=geoid;clearHover();
    const filter=geoid?['==',['get','state_fips'],geoid]:null;
    for(const id of ['city-dot-0','city-hit'])map.setFilter(id,filter);
    hideBaseHover();schedule();
  },
  setReservations(fn){reservations=fn;},layout,protectedMarkerBoxes,
  getLayoutState(){return {metrics:result.metrics,hovered,items:result.items.map(i=>({id:i.feature.properties.geoid,name:i.feature.properties.name,x:i.x,y:i.y,...i.style,placement:i.placement}))};}};
}

