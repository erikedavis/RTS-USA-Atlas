// USA Atlas 0.2d - native city rendering and display insets, official Census 2025 geography.
// Local renderer and geography; no external requests at runtime.
import * as maplibregl from '../assets/vendor/maplibre-gl.mjs';
import {INSETS, NATIONAL_BOUNDS, displayData, displayPoint, geographicPoint, insetFrames} from './insets.mjs';

const BASE = './data/';
const $ = (selector) => document.querySelector(selector);
const info = $('#panel-content');
const panel = $('#info-panel');
const emptyFC = {type:'FeatureCollection',features:[]};
const stateNames = new Map();
let map, manifest, states, stateLabels, cities;
let selected = null;
let selectedState = null;
let selectionRevision = 0;
let detailState = '';
let detailPlaceState = '';
let detailPolygonState = '';
let countySet = emptyFC;
let metroSet = null;
let metrosVisible = false;
let countySelectionOverride = false;
// County selection only becomes automatic at this zoom; user can opt in earlier.
const COUNTY_SELECT_ZOOM = 7;
let allSearch = null;
let searchLoading = null;
let toastTimer;
let stateMarkers = [];
const insetMarkers = [];

const countyCache = new Map();
const pointCache = new Map();
const shapeCache = new Map();

const chooseCoords = (obj) => obj?.geometry?.coordinates ?? null;
function emptyPanel() {
  info.replaceChildren(
    element('div','selection-icon','◎'),
    element('div','empty-kicker','NO ACTIVE SELECTION'),
    element('h1','','UNITED STATES'),
    element('p','','Select a state, county, metropolitan area, or city to inspect its Census 2025 geographic record.')
  );
  $('#selection-status').textContent = 'AWAITING SELECTION';
  panel.classList.add('collapsed');
  $('#panel-close').textContent='+';
}
function element(tag, className, content) {
  const el=document.createElement(tag);
  if(className) el.className=className;
  el.textContent=content??'';
  return el;
}
function row(label, value) {
  const r=element('div','record-row','');
  r.append(element('div','record-label',label),element('div','record-value',value));
  info.append(r);
}
function toast(s) {
  const n=$('#toast'); n.textContent=s;
  n.classList.add('show'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>n.classList.remove('show'),3200);
}
function fmtCoord(n,axis) {
  return `${Math.abs(n).toFixed(2)}°${axis==='lat'?(n>=0?'N':'S'):(n>=0?'E':'W')}`;
}
function display(f) {
  const p=f.properties||{};
  info.replaceChildren(element('div','section-kicker',`GEOGRAPHIC RECORD / ${(p.kind||'FEATURE').toUpperCase()}`),element('h1','',p.name||'UNNAMED'));
  row('TYPE',(p.kind||'unknown').toUpperCase());
  if(p.geoid) row('CENSUS GEOID',p.geoid);
  if(p.abbr||p.state_abbr) row('STATE',p.abbr||p.state_abbr);
  if(p.state_fips) row('STATE FIPS',p.state_fips);
  if(p.official_name && p.official_name!==p.name)row('OFFICIAL NAME',p.official_name);
  if(p.class) row('AREA CLASS',p.class.toUpperCase());
  if(manifest)row('GEOGRAPHIC VINTAGE',manifest.vintage);
  info.append(element('div','info-note','Official Census 2025 boundary geometry. Numerical statistics, historical boundaries, and live news will be linked in later versions. The Census cartographic files are simplified for map display.'));
  if(p.kind==='state'){
    const button=element('button','panel-action','ENABLE COUNTY SELECTION');
    button.type='button';
    button.addEventListener('click',()=>{toggleCountySelection(true);zoomTo(f,7.4);});
    info.append(button,element('div','panel-help','County boundaries appear as you zoom closer. State labels remain selectable at every zoom.'));
  }
  $('#selection-status').textContent=`${(p.kind||'FEATURE').toUpperCase()} SELECTED`;
  panel.classList.remove('collapsed');
  $('#panel-close').textContent='−';
}
function boundsOf(geom) {
  if(!geom?.coordinates) return null;
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  function walk(n) {
    if(typeof n?.[0]==='number' && typeof n[1]==='number'){
      b[0]=Math.min(b[0],n[0]);b[1]=Math.min(b[1],n[1]);
      b[2]=Math.max(b[2],n[0]);b[3]=Math.max(b[3],n[1]);return;
    }
    for(const child of n)walk(child);
  }
  walk(geom.coordinates);
  return b.every(Number.isFinite)?[[b[0],b[1]],[b[2],b[3]]]:null;
}
function zoomTo(f,maxZoom=8) {
  const inset=INSETS.find(i=>f.properties?.kind==='state' && i.abbr===f.properties.abbr);
  if(inset){map.fitBounds(inset.box,{padding:60,maxZoom:8,duration:800});return;}
  const g=f.geometry;
  if(!g)return;
  if(g.type==='Point'){
    map.flyTo({center:g.coordinates,zoom:Math.max(map.getZoom(),8.8),duration:700});return;
  }
  const box=boundsOf(g);
  if(box)map.fitBounds(box,{padding:Math.min(130,window.innerWidth/5),maxZoom,duration:750});
}
function applySelection() {
  if(!map?.getLayer('state-selected'))return;
  map.setFilter('state-selected',['==',['get','geoid'],selectedState||'__none__']);
  map.setPaintProperty('state-selected','line-opacity',selected?.properties?.kind==='state'?1:.28);
  if(map.getLayer('city-selected'))map.setFilter('city-selected',['==',['get','geoid'],selected?.properties?.kind==='place'?selected.properties.geoid:'__none__']);
  map.setFilter('county-selected',['==',['get','geoid'],selected?.properties?.kind==='county'?selected.properties.geoid:'__none__']);
  map.setFilter('place-selected',['==',['get','geoid'],selected?.properties?.kind==='place'?selected.properties.geoid:'__none__']);
  map.setFilter('metro-selected',['==',['get','geoid'],selected?.properties?.kind==='metro'?selected.properties.geoid:'__none__']);
}
function select(f,{zoom=false}={}) {
  selectionRevision++;
  selected=f;
  const p=f.properties||{};
  if(p.kind==='state')selectedState=p.geoid;
  else if(p.state_fips)selectedState=p.state_fips;
  else selectedState=null;
  applySelection();display(f);

  if(zoom)zoomTo(f,p.kind==='state'?6.8:p.kind==='metro'?9.5:10.5);
  if(selectedState)loadStateDetail(selectedState);
}
function deselect() {
  selectionRevision++;
  selected=null;selectedState=null;
  applySelection();emptyPanel();
  $('#search').value='';$('#search-results').hidden=true;
}
function reset() {
  deselect();
  map.fitBounds(NATIONAL_BOUNDS,{padding:window.innerWidth<670?9:25,maxZoom:4.4,duration:800});
}
async function loadJSON(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
  const data=await r.json();
  return url.endsWith('.geojson')?displayData(data):data;
}
async function cacheFetch(cache, key, path) {
  if(!cache.has(key)) cache.set(key,loadJSON(path).catch(error=>{cache.delete(key);throw error;}));
  return cache.get(key);
}
async function loadStateDetail(fips) {
  if(!fips)return;
  detailState=fips;
  try {
    const data=await cacheFetch(countyCache,fips,`${BASE}counties/${fips}.geojson`);
    if(detailState===fips){countySet=data;map.getSource('counties').setData(data);applySelection();}
  }catch(error){console.warn('County layer:',error);}
  detailPlaceState=fips;
  try {
    const data=await cacheFetch(pointCache,fips,`${BASE}places/${fips}_points.geojson`);
    if(detailPlaceState===fips)map.getSource('local-places').setData(data);
  }catch(error){console.warn('Place points:',error);}
  if(map.getZoom()>=8.3)loadPlacePolygons(fips);
}
async function loadPlacePolygons(fips) {
  if(!fips||detailPolygonState===fips)return;
  detailPolygonState=fips;
  try {
    const data=await cacheFetch(shapeCache,fips,`${BASE}places/${fips}_shapes.geojson`);
    if(detailPolygonState===fips){map.getSource('place-areas').setData(data);applySelection();}
  }catch(error){console.warn('Place boundaries:',error);}
}
function autoLoadRegion() {
  if(map.getZoom()<4.8)return;
  // The selected state remains active when navigating within its boundary.
  const centerPoint=map.project(map.getCenter());
  const matches=map.queryRenderedFeatures(centerPoint,{layers:['state-hit']});
  const fips=matches[0]?.properties?.geoid||selectedState;
  if(fips&&fips!==detailState)loadStateDetail(fips);
  if(fips&&map.getZoom()>=8.3)loadPlacePolygons(fips);
}
async function toggleMetros() {
  metrosVisible=!metrosVisible;
  const btn=$('#toggle-metros');
  btn.classList.toggle('active',metrosVisible);
  btn.setAttribute('aria-pressed',String(metrosVisible));
  for(const id of ['metro-lines','metro-hit','metro-selected'])map.setLayoutProperty(id,'visibility',metrosVisible?'visible':'none');
  if(metrosVisible && !metroSet){
    btn.textContent='...';
    try{metroSet=await loadJSON(BASE+'metros.geojson');map.getSource('metros').setData(metroSet);}
    catch(error){console.warn(error);toast('Could not load metropolitan boundaries.');}
    btn.textContent='MSA';
  }
  if(metrosVisible)toast('METROPOLITAN / MICROPOLITAN BOUNDARIES ON');
}
function findStateByGeoid(geoid){
  return states.features.find(feature=>feature.properties.geoid===geoid);
}
function countySelectable(){return countySelectionOverride || map.getZoom()>=COUNTY_SELECT_ZOOM;}
function updateCountyButton(){
  const button=$('#toggle-counties');
  button.classList.toggle('active',countySelectionOverride);
  button.setAttribute('aria-pressed',String(countySelectionOverride));
  button.title=countySelectionOverride?'County selection enabled':'Select counties at close zoom only';
}
function toggleCountySelection(force){
  countySelectionOverride=typeof force==='boolean'?force:!countySelectionOverride;
  updateCountyButton();
  if(countySelectionOverride){
    toast('COUNTY SELECTION ENABLED - ZOOM INTO A STATE FOR DETAILS');
    if(selectedState)loadStateDetail(selectedState);
  }else{
    toast('COUNTIES SELECTABLE AT CLOSE ZOOM ONLY');
  }
}
function makeLabels() {
  const tiny=new Set(['RI','DC','DE','MD','NJ','CT','MA']);
  for(const p of stateLabels){
    const n=element('button','state-label',p.abbr);
    n.type='button';
    n.title=`Select ${p.name}`; n.setAttribute('aria-label',`Select ${p.name}`);
    n.addEventListener('click',event=>{event.stopPropagation();const state=findStateByGeoid(p.geoid);if(state)select(state);});
    const marker=new maplibregl.Marker({element:n,anchor:'center'}).setLngLat(displayPoint(p.coordinates,p.abbr)).addTo(map);
    stateMarkers.push({node:n,marker,small:tiny.has(p.abbr)});
  }
  makeCityLayers();
  for(const inset of INSETS){
    const n=element('div','inset-label',inset.name+' / INSET');
    new maplibregl.Marker({element:n,anchor:'top-left'})
      .setLngLat([inset.box[0][0]+.5,inset.box[1][1]-.35]).addTo(map);
    insetMarkers.push({node:n,inset});
  }
}
function cityImage(text) {
  const ratio=2, canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  ctx.font='600 10px Segoe UI, Arial, sans-serif';
  const width=Math.ceil(ctx.measureText(text).width)+8;
  canvas.width=width*ratio;canvas.height=20*ratio;
  ctx.scale(ratio,ratio);ctx.font='600 10px Segoe UI, Arial, sans-serif';
  ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3;
  ctx.strokeStyle='#080e15';ctx.strokeText(text,4,10);
  ctx.fillStyle='#bbd1e0';ctx.fillText(text,4,10);
  return ctx.getImageData(0,0,canvas.width,canvas.height);
}
function makeCityLayers() {
  map.addSource('major-cities',{type:'geojson',data:cities});
  for(const f of cities.features)map.addImage('city-'+f.properties.geoid,cityImage(f.properties.name.toUpperCase()),{pixelRatio:2});
  // Native layers share exactly the same camera, projection and render frame as the land.
  for(const [tier,minzoom] of [[1,3],[2,4],[3,6.4]]){
    const filter=['==',['get','tier'],tier];
    map.addLayer({id:'city-dot-'+tier,type:'circle',source:'major-cities',minzoom,filter,
      paint:{'circle-radius':2.6,'circle-color':'#a9cada','circle-stroke-color':'#d2e7f3','circle-stroke-width':.7}});
    map.addLayer({id:'city-name-'+tier,type:'symbol',source:'major-cities',minzoom,filter,
      layout:{'icon-image':['concat','city-',['get','geoid']],'icon-anchor':'left','icon-offset':[7,0],'icon-padding':3}});
  }
  map.addLayer({id:'city-selected',type:'circle',source:'major-cities',filter:['==',['get','geoid'],'__none__'],
    paint:{'circle-radius':4,'circle-color':'#e1f4ff','circle-stroke-width':1,'circle-stroke-color':'#ffffff'}});
}

function labelsOnMove() {
  const z=map.getZoom();
  for(const s of stateMarkers)s.node.style.display=z<2.8||(s.small&&z<5.5)?'none':'';
  for(const {node,inset} of insetMarkers){
    const width=map.project(inset.box[1]).x-map.project(inset.box[0]).x;
    node.textContent=width<55?inset.abbr:width<100?inset.abbr+' / INSET':inset.name+' / INSET';
    node.style.fontSize=width<100?'7px':'9px';
  }

  const center=map.getCenter();
  const {point:[lng,lat],abbr}=geographicPoint([center.lng,center.lat]);
  $('#coordinate-text').textContent=`${abbr?abbr+' / ':''}${fmtCoord(lat,'lat')} ${fmtCoord(lng,'lng')}`;
  $('#zoom-text').textContent=`ZOOM ${z.toFixed(1)}`;
}
function addSourcesAndLayers() {
  map.addSource('inset-frames',{type:'geojson',data:insetFrames});
  map.addLayer({id:'inset-surface',type:'fill',source:'inset-frames',paint:{'fill-color':'#070d14','fill-opacity':.9}});
  map.addLayer({id:'inset-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'inset-frames',paint:{'line-color':'#30485b','line-width':1}});
  map.addSource('states',{type:'geojson',data:states});
  map.addSource('counties',{type:'geojson',data:emptyFC});
  map.addSource('local-places',{type:'geojson',data:emptyFC});
  map.addSource('place-areas',{type:'geojson',data:emptyFC});
  map.addSource('metros',{type:'geojson',data:emptyFC});

  map.addLayer({id:'state-surface',type:'fill',source:'states',paint:{'fill-color':'#101923','fill-opacity':.98}});
  map.addLayer({id:'state-hit',type:'fill',source:'states',paint:{'fill-color':'#182637','fill-opacity':.01}});
  map.addLayer({id:'county-hit',type:'fill',source:'counties',minzoom:4.8,paint:{'fill-color':'#3d5977','fill-opacity':.01}});
  map.addLayer({id:'county-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'counties',minzoom:4.8,paint:{'line-color':'#34475d','line-width':['interpolate',['linear'],['zoom'],4.8,.24,8,1.0],'line-opacity':['interpolate',['linear'],['zoom'],4.8,.16,7,.55,10,.8]}});
  map.addLayer({id:'place-area-hit',type:'fill',source:'place-areas',minzoom:8.3,paint:{'fill-color':'#40597a','fill-opacity':.01}});
  map.addLayer({id:'place-area-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',minzoom:8.3,paint:{'line-color':'#546b83','line-opacity':.38,'line-width':.6}});
  map.addLayer({id:'metro-hit',type:'fill',source:'metros',minzoom:4.4,layout:{visibility:'none'},paint:{'fill-color':'#a7bbcc','fill-opacity':.01}});
  map.addLayer({id:'metro-lines',type:'line',source:'metros',minzoom:4.4,layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-color':'#8295b3','line-width':1.15,'line-opacity':.58,'line-dasharray':[2,3]}});
  map.addLayer({id:'state-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',paint:{'line-color':'#718da8','line-width':['interpolate',['linear'],['zoom'],3,.8,9,1.7],'line-opacity':.9}});
  map.addLayer({id:'state-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#b6def5','line-width':1.8,'line-opacity':1}});
  map.addLayer({id:'county-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'counties',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#c2e0f5','line-width':2.6,'line-opacity':1}});
  map.addLayer({id:'place-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#a2d7fc','line-width':2.2,'line-opacity':1}});
  map.addLayer({id:'metro-selected',type:'line',source:'metros',filter:['==',['get','geoid'],'__none__'],layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-color':'#c6daed','line-width':2.3}});
  map.addLayer({id:'places-hit',type:'circle',source:'local-places',minzoom:9.1,paint:{'circle-radius':['interpolate',['linear'],['zoom'],9.1,2,12,3.5],'circle-color':'#98b5cd','circle-stroke-width':.8,'circle-stroke-color':'#d5e7f3','circle-opacity':.44}});
  const hitLayers=['city-name-1','city-name-2','city-name-3','city-dot-1','city-dot-2','city-dot-3','places-hit','place-area-hit','county-hit','metro-hit','state-hit'];
  map.on('mousemove',event=>{
    map.getCanvas().style.cursor=map.queryRenderedFeatures(event.point,{layers:hitLayers}).length?'pointer':'';
  });
  map.on('click',event=>{
    const hits=map.queryRenderedFeatures(event.point,{layers:hitLayers});
    const order=['city-name-1','city-name-2','city-name-3','city-dot-1','city-dot-2','city-dot-3','places-hit','place-area-hit',...(countySelectable()?['county-hit']:[]),...(metrosVisible?['metro-hit']:[]),'state-hit'];
    const best=order.map(id=>hits.find(f=>f.layer.id===id)).find(Boolean);
    if(best)select({properties:best.properties,geometry:best.geometry},{zoom:best.layer.id.startsWith('city-')});
    else deselect();
  });
}
async function getSearch() {
  if(allSearch)return allSearch;
  if(!searchLoading)searchLoading=loadJSON(BASE+'search_index.json').then(v=>allSearch=v).catch(e=>{searchLoading=null;throw e;});
  return searchLoading;
}
function rankSearch(q,record){
  const n=record.n.toLowerCase();
  if(n===q)return 0;
  if(n.startsWith(q))return 1;
  if(n.split(/[ -]/).some(t=>t.startsWith(q)))return 2;
  return 3;
}
async function selectSearchItem(s) {
  const revision=selectionRevision;
  if(s.k==='state'){
    const f=states.features.find(v=>v.properties.geoid===s.id);
    if(f)select(f,{zoom:true});return;
  }
  if(s.k==='county'){
    try{
      const data=await cacheFetch(countyCache,s.f,`${BASE}counties/${s.f}.geojson`);
      if(revision!==selectionRevision)return;
      const f=data.features.find(v=>v.properties.geoid===s.id);
      if(f){select(f,{zoom:true});return;}
    }catch(error){console.warn(error);}
  }
  if(s.k==='metro'){
    try{
      if(!metroSet)metroSet=await loadJSON(BASE+'metros.geojson');
      if(revision!==selectionRevision)return;
      map.getSource('metros').setData(metroSet);
      if(!metrosVisible)await toggleMetros();
      if(revision!==selectionRevision)return;
      const f=metroSet.features.find(v=>v.properties.geoid===s.id);
      if(f){select(f,{zoom:true});return;}
    }catch(error){console.warn(error);}
  }
  if(s.k==='place'){
    const f={type:'Feature',properties:{kind:'place',name:s.n,geoid:s.id,state_fips:s.f,state_abbr:s.s,official_name:s.d},geometry:{type:'Point',coordinates:displayPoint(s.p,s.s)}};
    select(f,{zoom:true});return;
  }
  toast('Unable to load selected geographic record.');
}
function setupSearch() {
  const box=$('#search'),results=$('#search-results');
  let sequence=0;
  box.addEventListener('input',async()=>{
    const q=box.value.trim().toLowerCase();
    const ticket=++sequence;
    results.replaceChildren();
    if(q.length<2){results.hidden=true;return;}
    try{
      const index=await getSearch();
      if(ticket!==sequence || box.value.trim().toLowerCase()!==q)return;
      const hits=index.filter(r=>r.n.toLowerCase().includes(q)).sort((a,b)=>
        rankSearch(q,a)-rankSearch(q,b)||
        ({state:0,place:1,county:2,metro:3}[a.k]-{state:0,place:1,county:2,metro:3}[b.k])||a.n.localeCompare(b.n)).slice(0,12);
      for(const item of hits){
        const title=item.n+(item.s?`, ${item.s}`:'');
        const btn=element('button','search-item',title);
        btn.append(element('span','search-type',item.k.toUpperCase()));
        btn.addEventListener('click',()=>{
          results.hidden=true;box.value='';box.blur();
          selectSearchItem(item);
        });
        results.append(btn);
      }
      results.hidden=!hits.length;
    }catch(error){console.warn('Search unavailable',error);toast('Search index unavailable.');}
  });
  box.addEventListener('keydown',event=>{
    if(event.key==='Escape'){results.hidden=true;box.blur();}
    if(event.key==='Enter')results.querySelector('button')?.click();
  });
  document.addEventListener('click',event=>{if(!event.target.closest('.search-wrap'))results.hidden=true;});
}
function setupUI() {
  $('#home').addEventListener('click',reset);
  $('#home').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reset();}});
  $('#reset-view').addEventListener('click',reset);
  $('#zoom-in').addEventListener('click',()=>map.zoomIn());
  $('#zoom-out').addEventListener('click',()=>map.zoomOut());
  for(const inset of INSETS)$('#go-'+inset.abbr.toLowerCase()).addEventListener('click',()=>map.fitBounds(inset.box,{padding:60,maxZoom:8,duration:800}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')deselect();});
  $('#toggle-counties').addEventListener('click',()=>toggleCountySelection());
  $('#toggle-metros').addEventListener('click',toggleMetros);
  $('#panel-close').addEventListener('click',()=>{
    panel.classList.toggle('collapsed');
    $('#panel-close').textContent=panel.classList.contains('collapsed')?'+':'−';
  });
  for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>{
      if(button.dataset.view==='statistical')return;
      toast(`${button.dataset.view.toUpperCase()} view is reserved for a later release; same Census geographic engine.`);
    });
  }
  setupSearch();
}
async function initialize() {
  try {
    [manifest,states,stateLabels,cities]=await Promise.all([
      loadJSON(BASE+'manifest.json'), loadJSON(BASE+'states.geojson'),
      loadJSON(BASE+'state_labels.json'),loadJSON(BASE+'major_cities.geojson')
    ]);
    for(const state of states.features)stateNames.set(state.properties.geoid,state.properties.name);
    $('#source-tag').textContent='CENSUS 2025 / VERIFIED SOURCE';
    $('#data-caption').textContent='BOUNDARIES / US CENSUS 2025 / 1:500K';
    map=new maplibregl.Map({
      container:'map',center:[-98.4,38.5],zoom:3.3,minZoom:1.7,maxZoom:16,
      attributionControl:false,pitchWithRotate:false,dragRotate:false,renderWorldCopies:false,
      style:{version:8,name:'USA Atlas Statistical',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#020307'}}]}
    });
    map.on('load',()=>{
      addSourcesAndLayers();makeLabels();setupUI();
      map.on('zoom',labelsOnMove);
      map.on('move',labelsOnMove);
      map.on('moveend',autoLoadRegion);
      map.fitBounds(NATIONAL_BOUNDS,{padding:window.innerWidth<670?9:25,duration:0,maxZoom:4.4});
      labelsOnMove();emptyPanel();
      $('#map-loading').classList.add('done');
      setTimeout(()=>{$('#map-loading').style.display='none';},470);
      toast('CENSUS 2025 GEOGRAPHY LOADED - SELECT A REGION');
    });
    map.on('error',event=>console.warn('MapLibre:',event.error||event));
  }catch(error){
    console.error(error);
    const n=$('#map-loading');n.classList.add('failed');n.replaceChildren(
      element('strong','','MAP FAILED TO INITIALIZE'),
      element('small','',String(error.message||error)),
      element('small','','Serve this folder over HTTP, not file://. Read README.md.')
    );
  }
}
initialize();
