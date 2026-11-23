// USA Atlas 0.3A - adaptive city hierarchy and display insets, official Census 2025 geography.
// Local renderer and geography; no external requests at runtime.
import * as maplibregl from '../assets/vendor/maplibre-gl.mjs';
import {createCityLayers} from './city-display.mjs';
import {isMetroScale} from './city-layout.mjs';
import {populateMapKey} from './city-symbols.mjs';
import {addGeographyLabels} from './geography-labels.mjs';
import {createStateLabels} from './state-labels.mjs';
import {prepareStateShapes,shapeContainsPoint} from './state-label-placement.mjs';
import {isNorthUp,screenBounds,setupRotation} from './map-rotation.mjs?v=08i';
import {setupPhoneUI} from './phone-ui.mjs?v=08h';
import {COUNTY_LABEL_ZOOM,createCountyLabels} from './county-labels.mjs';
import {INSETS, NATIONAL_BOUNDS, displayData, displayPoint, geographicPoint, hawaiiTailMarks, insetFrames} from './insets.mjs';

const BASE = './data/';
const $ = (selector) => document.querySelector(selector);
const app = $('.app');
const info = $('#panel-content');
const panel = $('#info-panel');
const emptyFC = {type:'FeatureCollection',features:[]};
const stateNames = new Map();
let map, manifest, states, stateLabels, cities, facts;
let selected = null;
let selectedState = null;
let selectionRevision = 0;
let detailState = '';
let detailPlaceState = '';
let detailPolygonState = '';
let countySet = emptyFC;
let countyNames,countyAnchors=null,countyAnchorLoad=null,countyViewKey='',countyViewRevision=0;
let renderedCountyScope;
let countiesById=new Map();
let metroSet = null;
let metroFacts = {};
let metroLoad = null;
let metroPreference = null;
let currentMetroMode;
let countySelectionOverride = false;
// County selection is always explicitly enabled by the CTY control.
let allSearch = null;
let searchLoading = null;
let toastTimer;
let stateLabelsController, cityLayers, mappedCityIds;
let phone, atlasFocus=null,cityAtlas=null,metroBounds;
let desktopAtlas=null,desktopStateReturn=null;
const insetMarkers = [];

const countyCache = new Map();
const pointCache = new Map();
const shapeCache = new Map();

const chooseCoords = (obj) => obj?.geometry?.coordinates ?? null;
const compactLayout = matchMedia('(max-width: 670px), (max-width: 950px) and (hover: none) and (orientation: landscape)');
const touchInput = matchMedia('(pointer: coarse)');
const hoverInput = matchMedia('(any-hover: hover)');
const nationalPadding = () => compactLayout.matches
  ? {top:23,bottom:40,left:10,right:10}
  : {top:25,bottom:35,left:25,right:85};
let homeSize='',homeZoom=3.3;
let settledFrame=0,nextHudUpdate=0;
function isNationalView(){
  const container=map.getContainer(),size=`${container.clientWidth}x${container.clientHeight}`;
  if(size!==homeSize){
    homeSize=size;
    homeZoom=map.cameraForBounds(NATIONAL_BOUNDS,{padding:nationalPadding(),maxZoom:4.4})?.zoom??3.3;
  }
  return map.getZoom()<=homeZoom+.2;
}
function wideStateLabels(){
  const span=map.getContainer().clientWidth*360/(512*2**map.getZoom());
  return !atlasFocus&&!desktopAtlas&&!phone?.focused&&span>=26;
}
const stateLabelsFirst=()=>!atlasFocus&&(wideStateLabels()||Boolean(phone?.active)||!isNorthUp(map.getBearing()));
const metroOverview=()=>!atlasFocus&&metroPreference!==false&&isMetroScale(map.getZoom());
const metroMode=()=>metroPreference===true?'manual':metroOverview()?'auto':'off';
function emptyPanel() {
  info.replaceChildren(
    element('div','selection-icon','◎'),
    element('div','empty-kicker','NO ACTIVE SELECTION'),
    element('h1','','UNITED STATES'),
    element('p','','Select a state, county, metropolitan area, or city to inspect its Census 2025 geographic record.')
  );
  $('#selection-status').textContent = 'AWAITING SELECTION';
  setPanelOpen(false);
}
function element(tag, className, content) {
  const el=document.createElement(tag);
  if(className) el.className=className;
  el.textContent=content??'';
  return el;
}
function row(label, value, parent=info) {
  const r=element('div','record-row','');
  r.append(element('div','record-label',label),element('div','record-value',value));
  parent.append(r);
}
function toast(s,duration=3200) {
  const n=$('#toast'); n.textContent=s;
  n.classList.add('show'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>n.classList.remove('show'),duration);
}
function fmtCoord(n,axis) {
  return `${Math.abs(n).toFixed(2)}°${axis==='lat'?(n>=0?'N':'S'):(n>=0?'E':'W')}`;
}
const number = value => new Intl.NumberFormat('en-US').format(value);
const squareMiles = value => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)+' sq mi';
function populationDate(date) {
  return date==='2025-07-01'?'July 1, 2025':date==='2020-04-01'?'April 1, 2020':date||'';
}
function basicFacts(f,overview) {
  const p=f.properties,record=p.kind==='state'?facts.states[p.geoid]:p.kind==='place'?facts.places[p.geoid]:
    p.kind==='county'?facts.counties[p.geoid]:p.kind==='metro'?metroFacts[p.geoid]:null;
  if(!record)return false;
  const section=element('section','basic-facts','');
  section.setAttribute('aria-label','Population and area');
  section.append(element('div','population-total',record.population===undefined?'Not available':number(record.population)),
    element('div','population-caption',record.population===undefined?'Population not published for this place in the bundled Census tables.':
      'POPULATION / '+populationDate(record.population_date)+(record.population_date==='2025-07-01'?' ESTIMATE':' CENSUS')));
  (overview?.identity||info).append(section);
  const factList=overview?.facts||info;
  if(p.kind==='state'||p.kind==='county'){
    function cityRecord(label,id){
      const city=facts.places[id];if(!city)return;
      const button=element('button','fact-city','');button.type='button';
      button.append(element('span','fact-city-role',label),element('strong','',city.name),
        element('span','fact-city-pop',city.population===undefined?'Population unavailable':
          number(city.population)+(overview?' residents':' residents / '+populationDate(city.population_date))));
      button.addEventListener('click',()=>{
        const feature=cities.features.find(f=>f.properties.geoid===id);
        if(!feature)return;
        if(p.kind!=='state')select(feature,{zoom:true});
        else if(phone?.active)phone.openCityFromState(feature);
        else openDesktopCityFromState(feature);
      });
      factList.append(button);
    }
    if(p.kind==='county'){
      cityRecord('LARGEST CITY / PLACE',record.largest_city);
      if(record.largest_city_population_in_county!==undefined)row('CITY RESIDENTS IN COUNTY',number(record.largest_city_population_in_county));
      info.append(element('div','facts-date',record.largest_city_method||'No Census place is recorded within this county.'));
    }
    else if(record.capital && record.capital===record.largest_city)cityRecord('CAPITAL / LARGEST CITY',record.capital);
    else {cityRecord('STATE CAPITAL',record.capital);cityRecord('LARGEST CITY',record.largest_city);}
  }
  if(record.land_sq_mi!==undefined){
    row('TOTAL AREA',squareMiles(record.land_sq_mi+record.water_sq_mi),factList);
    if(!phone?.active)row('LAND AREA',squareMiles(record.land_sq_mi));
    info.append(element('div','facts-date','AREA / CENSUS '+record.area_year+' / TOTAL INCLUDES WATER'));
  }else row('AREA','Not available',factList);
  const sources=element('div','fact-sources','');
  const popLink=element('a','','Population source');popLink.href=record.population_date==='2020-04-01'?
    'https://www.census.gov/programs-surveys/decennial-census/decade/2020/2020-census-results.html':
    p.kind==='county'?'https://www.census.gov/data/tables/time-series/demo/popest/2020s-counties-total.html':p.kind==='state'?'https://www.census.gov/data/datasets/time-series/demo/popest/2020s-state-total.html':
    p.kind==='metro'?'https://www.census.gov/data/datasets/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html':
    'https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-cities-and-towns.html';
  const areaLink=element('a','','Area source');areaLink.href=record.area_year===2020?
    'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/20':
    p.kind==='metro'?'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html':
    'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html';
  for(const link of [popLink,areaLink]){link.target='_blank';link.rel='noopener noreferrer';}
  sources.append(popLink,document.createTextNode(' / '),areaLink);info.append(sources);
  return true;
}
function display(f) {
  const p=f.properties||{};
  const title=p.kind==='place'?(facts.places[p.geoid]?.name||p.name):p.name;
  const heading=[element('div','section-kicker',p.kind==='state'?'STATE OVERVIEW':p.kind==='place'?'CITY / PLACE OVERVIEW':
    p.kind==='metro'?(p.class==='metro'?'METRO AREA OVERVIEW':'MICROPOLITAN AREA OVERVIEW'):
    'GEOGRAPHIC RECORD / '+(p.kind||'FEATURE').toUpperCase()),element('h1','',title||'UNNAMED')];
  let overview;
  if(phone?.active&&p.kind==='state'){
    const grid=element('div','phone-state-overview');
    overview={identity:element('div'),facts:element('div','phone-state-facts')};
    overview.identity.append(...heading);grid.append(overview.identity,overview.facts);
    info.replaceChildren(grid);
  }else info.replaceChildren(...heading);
  const hasFacts=basicFacts(f,overview);
  const record=element('details','census-record','');
  record.append(element('summary','','Census geographic record'));
  if(!hasFacts)record.open=true;
  const fields=[['TYPE',(p.kind||'unknown').toUpperCase()],['CENSUS GEOID',p.geoid],['STATE',p.abbr||p.state_abbr],
    ['OFFICIAL NAME',p.official_name],['AREA CLASS',p.class],['BOUNDARY VINTAGE',manifest?.vintage]];
  for(const [label,value] of fields)if(value){
    const r=element('div','record-row','');r.append(element('span','record-label',label),element('span','record-value',value));record.append(r);
  }
  info.append(record);
  if(p.kind==='state'){
    for(const [label,enable] of [['SHOW / SELECT COUNTIES',toggleCountySelection],['SHOW / SELECT METROS',toggleMetros]]){
      const button=element('button','panel-action',label);button.type='button';
      button.addEventListener('click',()=>enable(true));
      info.append(button);
    }
    if(!phone?.active)info.append(element('div','panel-help','Click a state abbreviation to zoom to that state. Select a city above to visit it.'));
  }
  $('#selection-status').textContent=(p.kind||'FEATURE').toUpperCase()+' SELECTED';
  info.scrollTop=0;
  setPanelOpen(true);
}

function setPanelOpen(open) {
  if(phone?.active){phone.selectionChanged(open?selected:null);return;}
  if(open)setSidebarHidden(false);
  updateDesktopAtlasButtons();
}

function setSidebarHidden(hidden){
  const changed=app.classList.contains('sidebar-hidden')!==hidden;
  app.classList.toggle('sidebar-hidden',hidden);
  const toggle=$('#sidebar-toggle');
  toggle.setAttribute('aria-expanded',String(!hidden));
  const label=hidden?'Show stats':'Hide stats';
  toggle.setAttribute('aria-label',label);
  toggle.title=label;
  if(changed){map.resize();scheduleSettledView();}
}

function updateDesktopAtlasButtons(){
  const kind=selected?.properties.kind;
  const toggle=$('#desktop-atlas-toggle');
  toggle.hidden=!['state','place','metro'].includes(kind);
  toggle.textContent=desktopAtlas?'Back':'Atlas';
  toggle.setAttribute('aria-expanded',String(Boolean(desktopAtlas)));
  $('#desktop-state-back').hidden=!desktopStateReturn||Boolean(desktopAtlas);
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
function fitAtCurrentBearing(bounds,options){
  const bearing=map.getBearing();
  let {padding}=options;
  if(!isNorthUp(bearing)){
    if(typeof padding==='number')padding={top:padding,right:padding,bottom:padding,left:padding};
    const hud=$('.rotation-tools').getBoundingClientRect();
    const cap=map.getContainer().clientHeight*.28;
    padding={...padding,top:Math.max(padding.top,Math.min(cap,hud.height+14))};
  }
  map.fitBounds(bounds,{...options,padding,bearing});
}
function zoomTo(f,maxZoom=8,duration=750) {
  const g=f.geometry;
  if(!g)return;
  if(g.type==='Point'){
    const options={center:g.coordinates,zoom:Math.max(map.getZoom(),8.8),duration:Math.min(700,duration)};
    if(phone?.active)options.offset=[0,-phoneDockHeight()/2];
    map.flyTo(options);return;
  }
  const compactPadding=compactLayout.matches
    ? Math.min(24,map.getContainer().clientHeight/8)
    : null;
  const inset=f.properties.kind==='state'&&INSETS.find(i=>i.abbr===f.properties.abbr);
  if(inset?.focusBounds){
    const box=inset.focusBounds.map(point=>displayPoint(point,inset.abbr));
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    const padding={top:h*.145,bottom:phone?.active?Math.max(h*.185,phoneDockHeight()):h*.185,left:w*.09,right:w*.13};
    fitAtCurrentBearing(box,{padding,maxZoom,duration});
    return;
  }
  const box=boundsOf(g);
  if(!box)return;
  const padding=phone?.active?{top:compactPadding,bottom:phoneDockHeight(),left:12,right:12}:
    compactPadding??(f.properties.kind==='state'?{top:24,bottom:27,left:23,right:56}:Math.min(130,window.innerWidth/5));
  fitAtCurrentBearing(box,{padding,maxZoom,duration});
}
function phoneDockHeight(){
  const shell=$('.map-shell');
  const dock=$('#phone-dock');
  // The sheet row is still opening when a search selection starts its fit.
  const height=dock.querySelector('.phone-grip').offsetHeight+$('.map-controls').offsetHeight+panel.offsetHeight;
  return Math.min(shell.clientHeight*.64,height+12);
}
function stateAtlasBounds(feature){
  const inset=INSETS.find(i=>i.abbr===feature.properties.abbr);
  return inset?.focusBounds?.map(point=>displayPoint(point,inset.abbr))||boundsOf(feature.geometry);
}
function fitStateAtlas(feature,headerHeight,sheetHeight,duration){
  const bounds=stateAtlasBounds(feature);
  if(!bounds)return;
  const height=map.getContainer().clientHeight,bearing=map.getBearing();
  const padding={top:headerHeight+8,bottom:sheetHeight+12,left:15,right:15};
  const camera=map.cameraForBounds(bounds,{bearing,padding,maxZoom:13});
  if(!camera)return;
  const box=screenBounds(map,bounds);
  const stateHeight=(box.y1-box.y0)*2**(camera.zoom-map.getZoom());
  const topOffset=-Math.max(0,(height-padding.top-padding.bottom-stateHeight)/2);
  const panelHeight=panel.offsetHeight;
  const remaining=height-padding.top-stateHeight-(sheetHeight-panelHeight)-12;
  if(remaining>panelHeight)$('#phone-dock').style.setProperty('--phone-atlas-facts-height',`${remaining}px`);
  map.easeTo({...camera,bearing,offset:[0,topOffset],duration});
}
function fitPhoneAtlas(feature,headerHeight,sheetHeight,duration){
  if(feature.properties.kind==='state'){fitStateAtlas(feature,headerHeight,sheetHeight,duration);return;}
  const bottom=Math.min(sheetHeight,map.getContainer().clientHeight*.52);
  map.easeTo({center:cityAtlas?.point||map.getCenter(),offset:[0,(headerHeight-bottom)/2],duration});
}
function fitPhoneCityAtlas(bounds,area,duration){
  const height=map.getContainer().clientHeight;
  const bearing=map.getBearing();
  if(bounds){
    const margin=Math.min(12,area.height/4);
    const padding={top:area.y-area.height/2+margin,bottom:height-area.y-area.height/2+margin,left:12,right:12};
    const fitted=map.cameraForBounds(bounds,{bearing,padding,maxZoom:13});
    if(fitted){map.easeTo({...fitted,bearing,duration});return;}
  }
  map.easeTo({center:cityAtlas?.point||map.getCenter(),zoom:Math.max(map.getZoom(),8.8),
    offset:[0,area.y-height/2],bearing,duration});
}
const cityMetroLayers=['atlas-metro-fill','atlas-metro-outline'];
function setAtlasFocus(feature,{fast=false}={}){
  if(cityAtlas){
    cityAtlas.fact.remove();
    cityAtlas=null;
  }
  const metroId=feature?.properties.kind==='metro'?feature.properties.geoid:'__none__';
  for(const id of cityMetroLayers)map.setFilter(id,['==',['get','geoid'],metroId]);
  const isState=feature?.properties.kind==='state';
  focusStateAtlas(isState?feature.properties.geoid:null,fast);
  if(feature?.properties.kind!=='place')return;

  const fact=element('div','record-row');
  const value=element('div','record-value','Loading…');
  fact.append(element('div','record-label','METROPOLITAN AREA'),value);
  info.querySelector('.census-record').before(fact);
  const point=feature.geometry?.type==='Point'?feature.geometry.coordinates:
    cities.features.find(city=>city.properties.geoid===feature.properties.geoid)?.geometry.coordinates;
  const view={fact,point,metro:null,ready:false};
  cityAtlas=view;
  if(!point){view.ready=true;value.textContent='Unavailable';return;}
  loadMetros().then(({features})=>{
    if(cityAtlas!==view)return;
    metroBounds??=features.filter(area=>area.properties.class==='metro').map(area=>({area,bounds:boundsOf(area.geometry)}));
    const [lng,lat]=point;
    const match=metroBounds.find(entry=>{
      const [[west,south],[east,north]]=entry.bounds;
      return lng>=west&&lng<=east&&lat>=south&&lat<=north&&
        shapeContainsPoint(entry.shape??=prepareStateShapes(entry.area.geometry),point);
    });
    view.ready=true;
    if(!match){value.textContent='Outside an MSA';return;}
    view.metro=match;
    for(const id of cityMetroLayers)map.setFilter(id,['==',['get','geoid'],match.area.properties.geoid]);
    value.textContent=match.area.properties.name+' MSA';
  }).catch(error=>{
    if(cityAtlas===view){view.ready=true;value.textContent='Unavailable';}
    console.warn('City atlas metro:',error);
  });
}
const mapCamera=()=>({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing()});
const atlasDuration=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?0:360;

function openDesktopAtlas({frame=true,returnCamera}={}){
  const kind=selected?.properties.kind;
  if(desktopAtlas||!['state','place','metro'].includes(kind))return;
  map.stop();
  desktopAtlas={returnCamera:returnCamera||mapCamera()};
  app.dataset.desktopAtlas=kind;
  setSidebarHidden(false);
  updateDesktopAtlasButtons();
  map.resize();
  info.scrollTop=0;
  setAtlasFocus(selected);
  if(kind==='metro')showMetroPlaces(selected);
  if(frame&&kind!=='place'){
    const bounds=kind==='state'?stateAtlasBounds(selected):boundsOf(selected.geometry);
    if(bounds)fitAtCurrentBearing(bounds,{padding:{top:22,bottom:26,left:22,right:34},maxZoom:13,duration:atlasDuration()});
  }
}

function leaveDesktopAtlas({restore=true}={}){
  if(!desktopAtlas)return;
  const {returnCamera}=desktopAtlas;
  desktopAtlas=null;
  map.stop();
  delete app.dataset.desktopAtlas;
  info.querySelector('.metro-atlas-places')?.remove();
  setAtlasFocus(null);
  updateDesktopAtlasButtons();
  map.resize();
  if(restore)map.easeTo({...returnCamera,duration:atlasDuration()});
  scheduleSettledView();
}

function openDesktopCityFromState(feature){
  desktopStateReturn={state:selected,camera:mapCamera(),scroll:info.scrollTop,atlas:desktopAtlas};
  select(feature,{zoom:!desktopStateReturn.atlas,preserveStateReturn:true});
  if(desktopStateReturn.atlas){
    openDesktopAtlas();
    if(cityAtlas?.point)map.easeTo({center:cityAtlas.point,duration:atlasDuration()});
  }
}

function backFromDesktopAtlas(){
  if(!desktopStateReturn){leaveDesktopAtlas();return;}
  const origin=desktopStateReturn;
  leaveDesktopAtlas({restore:false});
  select(origin.state);
  if(origin.atlas)openDesktopAtlas({frame:false,returnCamera:origin.atlas.returnCamera});
  map.jumpTo(origin.camera);
  info.scrollTop=origin.scroll;
  const toggle=$('#desktop-atlas-toggle');
  if(!toggle.hidden)toggle.focus();
}

function showMetroPlaces(metro){
  const details=element('details','census-record metro-atlas-places');
  details.append(element('summary','','Cities and places'));
  info.querySelector('.census-record').before(details);
  details.addEventListener('toggle',()=>{
    if(!details.open||details.children.length>1)return;
    const shape=prepareStateShapes(metro.geometry);
    const [[west,south],[east,north]]=boundsOf(metro.geometry);
    const places=cities.features.filter(city=>{
      const [lng,lat]=city.geometry.coordinates;
      return lng>=west&&lng<=east&&lat>=south&&lat<=north&&shapeContainsPoint(shape,[lng,lat]);
    }).sort((a,b)=>b.properties.population-a.properties.population||a.properties.name.localeCompare(b.properties.name));
    if(!places.length){details.append(element('p','','No bundled Census places have a mapped point within this area.'));return;}
    details.append(element('p','','Census places with a mapped point inside the metro boundary.'));
    const list=element('ul','metro-place-list');
    for(const {properties:p} of places){
      const item=element('li');
      item.append(element('span','',p.name+', '+p.state_abbr));
      if(p.population_known)item.append(element('span','',number(p.population)));
      list.append(item);
    }
    details.append(list);
  });
}
function focusStateAtlas(fips,fast){
  if(atlasFocus===fips)return;
  atlasFocus=fips;
  const transition={duration:fast?65:300};
  map.setPaintProperty('state-atlas-surface','fill-opacity-transition',transition);
  map.setPaintProperty('state-surface','fill-opacity-transition',transition);
  map.setPaintProperty('state-lines','line-opacity-transition',transition);
  map.setFilter('state-atlas-surface',['==',['get','geoid'],fips||'__none__']);
  map.setPaintProperty('state-atlas-surface','fill-opacity',fips ? .98 : 0);
  map.setPaintProperty('state-surface','fill-opacity',fips?0:.98);
  map.setPaintProperty('state-lines','line-opacity',fips?0:.9);
  for(const id of ['inset-surface','inset-lines','geography-lake','geography-peninsula','geography-island']){
    map.setLayoutProperty(id,'visibility',fips?'none':'visible');
  }
  for(const id of ['hawaii-tail-islands','hawaii-tail-label']){
    if(map.getLayer(id))map.setLayoutProperty(id,'visibility',!fips||fips==='15'?'visible':'none');
  }
  for(const id of ['places-hit','place-area-hit','place-area-lines']){
    map.setFilter(id,fips?['==',['get','state_fips'],fips]:null);
  }
  stateLabelsController.setFocus(fips);
  cityLayers.setFocus(fips);
  updateCountyView();
  updateMetroMode();
  scheduleSettledView();
}
function applySelection() {
  if(!map?.getLayer('state-selected'))return;
  map.setFilter('state-selected',['==',['get','geoid'],selectedState||'__none__']);
  map.setPaintProperty('state-selected','line-opacity',selected?.properties?.kind==='state'?1:.28);
  cityLayers?.update(selectedState,selected);
  map.setFilter('county-selected',['==',['get','geoid'],selected?.properties?.kind==='county'?selected.properties.geoid:'__none__']);
  map.setFilter('place-selected',['==',['get','geoid'],selected?.properties?.kind==='place'?selected.properties.geoid:'__none__']);
  map.setFilter('metro-selected',['==',['get','geoid'],selected?.properties?.kind==='metro'?selected.properties.geoid:'__none__']);
}
function select(f,{zoom=false,duration,preserveStateReturn=false}={}) {
  if(!preserveStateReturn)desktopStateReturn=null;
  leaveDesktopAtlas({restore:false});
  selectionRevision++;
  selected=f;
  const p=f.properties||{};
  if(p.kind==='state')selectedState=p.geoid;
  else if(p.state_fips)selectedState=p.state_fips;
  else selectedState=null;
  applySelection();display(f);
  updateCountyView();
  updateMetroMode();

  if(zoom)zoomTo(f,p.kind==='state'?13:p.kind==='metro'?9.5:10.5,duration);
  if(selectedState)loadStateDetail(selectedState);
}
function deselect() {
  desktopStateReturn=null;
  leaveDesktopAtlas({restore:false});
  cityLayers?.clearHover();
  selectionRevision++;
  selected=null;selectedState=null;
  applySelection();emptyPanel();
  updateCountyView();
  updateMetroMode();
  $('#search').value='';$('#search-results').hidden=true;
}
function reset() {
  deselect();
  fitAtCurrentBearing(NATIONAL_BOUNDS,{padding:nationalPadding(),maxZoom:4.4,duration:800});
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
  detailPlaceState=fips;
  try {
    const data=await cacheFetch(pointCache,fips,`${BASE}places/${fips}_points.geojson`);
    if(detailPlaceState===fips)map.getSource('local-places').setData({...data,features:data.features.filter(f=>!mappedCityIds.has(f.properties.geoid))});
  }catch(error){console.warn('Place points:',error);}
  if(detailPlaceState===fips&&map.getZoom()>=8.3)loadPlacePolygons(fips);
}
function updateCountyNames(){
  if(!countySelectionOverride||map.getZoom()<COUNTY_LABEL_ZOOM||map.isMoving()||!countyAnchors)return;
  countyNames.layout(countySet.features,countyAnchors,[...mapReservations(),...cityLayers.labelReservations()]);
}
function stateOverlayScope(){
  const kind=selected?.properties.kind;
  return atlasFocus||((kind==='state'||kind==='county')?selectedState:null);
}
function updateCountyView(){
  if(!countySelectionOverride)return;
  const scope=stateOverlayScope();
  if(scope!==renderedCountyScope){
    renderedCountyScope=scope;
    const filter=scope?['==',['get','state_fips'],scope]:null;
    for(const id of ['county-hit','county-lines','county-names'])map.setFilter(id,filter);
    map.setPaintProperty('county-lines','line-color',scope?'#6685a0':'#3b5268');
    map.setPaintProperty('county-lines','line-opacity',scope ? .86 : .58);
    countyNames.clear();
  }
  const showNames=map.getZoom()>=COUNTY_LABEL_ZOOM;
  const loadFips=new Set(scope?[scope]:[]);
  if(!scope){
    const bounds=map.getBounds();
    const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
    for(const {p,polygons} of stateLabelsController.items){
      if(polygons.some(({bounds:[w,s,e,n]})=>w<=east&&e>=west&&s<=north&&n>=south))loadFips.add(p.geoid);
    }
  }
  const statesInView=[...loadFips].sort(),key=`${showNames}:${statesInView.join(',')}`;
  if(key===countyViewKey){updateCountyNames();return;}
  countyViewKey=key;
  const revision=++countyViewRevision;
  if(showNames&&!countyAnchorLoad)countyAnchorLoad=loadJSON(BASE+'county_anchors.json').then(anchors=>{countyAnchors=anchors;})
    .catch(error=>{countyAnchorLoad=null;throw error;});
  Promise.all([Promise.all(statesInView.map(fips=>cacheFetch(countyCache,fips,`${BASE}counties/${fips}.geojson`))),
    showNames?countyAnchorLoad:null]).then(([data])=>{
    if(revision!==countyViewRevision)return;
    countySet={type:'FeatureCollection',features:data.flatMap(region=>region.features)};
    countiesById=new Map(countySet.features.map(feature=>[feature.properties.geoid,feature]));
    map.getSource('counties').setData(countySet);
    applySelection();updateCountyNames();
  }).catch(error=>{
    if(revision===countyViewRevision)countyViewKey='';
    console.warn('County layer:',error);
  });
}
const placePolygons=fips=>cacheFetch(shapeCache,fips,`${BASE}places/${fips}_shapes.geojson`);
async function cityAtlasBounds(feature){
  const {state_fips:fips,geoid}=feature.properties;
  if(!fips)return null;
  try{
    const data=await placePolygons(fips);
    return boundsOf(data.features.find(place=>place.properties.geoid===geoid)?.geometry);
  }catch{
    return null;
  }
}
async function loadPlacePolygons(fips) {
  if(!fips||detailPolygonState===fips)return;
  detailPolygonState=fips;
  try {
    const data=await placePolygons(fips);
    if(detailPolygonState===fips){map.getSource('place-areas').setData(data);applySelection();}
  }catch(error){console.warn('Place boundaries:',error);}
}
function autoLoadRegion() {
  if(map.getZoom()<4.5)return;
  // The selected state remains active when navigating within its boundary.
  const centerPoint=map.project(map.getCenter());
  const matches=map.queryRenderedFeatures(centerPoint,{layers:['state-hit']});
  const fips=atlasFocus||matches[0]?.properties?.geoid||selectedState;
  if(fips&&fips!==detailState)loadStateDetail(fips);
  if(fips&&map.getZoom()>=8.3)loadPlacePolygons(fips);
}
function loadMetros(){
  if(!metroLoad)metroLoad=Promise.all([loadJSON(BASE+'metros.geojson'),loadJSON(BASE+'metro-labels.geojson'),loadJSON(BASE+'metro_facts.json')]).then(([areas,names,records])=>{
    // Census CBSA names end in the abbreviations of all states they cover.
    // Use delimited strings so MapLibre can match exact codes in both sources.
    for(const {properties:p} of [...areas.features,...names.features]){
      const codes=p.name.match(/, ([A-Z]{2}(?:-[A-Z]{2})*)$/)?.[1]||'';
      p.state_codes='|'+codes.replaceAll('-','|')+'|';
    }
    metroSet=areas;
    metroFacts=records.records;
    map.getSource('metros').setData(areas);
    map.getSource('metro-labels').setData(names);
    return areas;
  }).catch(error=>{metroLoad=null;throw error;});
  return metroLoad;
}
function updateMetroMode(){
  const mode=metroMode(),overview=metroOverview();
  const scope=mode==='off'?null:stateOverlayScope();
  const modeKey=`${mode}:${overview}:${scope}`;
  if(modeKey===currentMetroMode)return;
  currentMetroMode=modeKey;
  const visible=mode!=='off',btn=$('#toggle-metros');
  btn.classList.toggle('active',visible);
  btn.setAttribute('aria-pressed',String(visible));
  btn.title=visible?'Hide metro areas':'Show metro areas';
  for(const id of ['metro-surface','metro-lines','metro-hit','metro-outline-hit','metro-selected','metro-names']){
    map.setLayoutProperty(id,'visibility',visible?'visible':'none');
  }
  const abbr=scope&&findStateByGeoid(scope)?.properties.abbr;
  const inState=abbr?['in','|'+abbr+'|',['get','state_codes']]:null;
  const autoFilter=['==',['get','class'],'metro'];
  const filter=mode==='auto'?(inState?['all',autoFilter,inState]:autoFilter):inState;
  for(const id of ['metro-surface','metro-lines','metro-hit','metro-outline-hit'])map.setFilter(id,filter);
  map.setFilter('metro-names',inState);
  map.setPaintProperty('metro-lines','line-opacity',scope ? .87 : .58);
  for(const id of ['place-area-lines','place-area-hit'])map.setLayoutProperty(id,'visibility',overview?'none':'visible');
  if(visible)loadMetros().catch(error=>{console.warn('Metro areas:',error);toast('Could not load metro areas.');});
}
function toggleMetros(force){
  metroPreference=typeof force==='boolean'?force:metroMode()==='off';
  if(!metroPreference&&selected?.properties.kind==='metro')deselect();
  updateMetroMode();
  scheduleSettledView();
}
function findStateByGeoid(geoid){
  return states.features.find(feature=>feature.properties.geoid===geoid);
}
function countySelectable(){return countySelectionOverride;}
function updateCountyButton(){
  const button=$('#toggle-counties');
  button.classList.toggle('active',countySelectionOverride);
  button.setAttribute('aria-pressed',String(countySelectionOverride));
  button.title=countySelectionOverride?'Hide counties and turn off county selection':'Show counties and enable county selection (off by default)';
}
function toggleCountySelection(force){
  countySelectionOverride=typeof force==='boolean'?force:!countySelectionOverride;
  updateCountyButton();
  for(const id of ['county-hit','county-lines','county-selected','county-names'])map.setLayoutProperty(id,'visibility',countySelectionOverride?'visible':'none');
  if(!countySelectionOverride && selected?.properties?.kind==='county')deselect();
  if(countySelectionOverride){
    updateCountyView();
  }else{
    countyViewKey='';
    countyViewRevision++;
  }
  scheduleSettledView();
}
function mapReservations(){
  const r=map.getContainer().getBoundingClientRect();
  const controls=[...document.querySelectorAll('.map-controls:not(.phone-dock .map-controls),#reset-view,#sidebar-toggle,.rotation-tools:not([inert]),.map-hud,.inset-label,.map-key-toggle,.map-key:not([hidden]),.phone-grip,.phone-dock-row:not([inert]),.phone-home:not([hidden]),.phone-atlas-back:not([hidden]),.phone-history-back:not([hidden])')]
    .filter(n=>n.offsetWidth&&n.offsetHeight).map(n=>{const b=n.getBoundingClientRect();return {x0:b.left-r.left,y0:b.top-r.top,x1:b.right-r.left,y1:b.bottom-r.top};});
  const pr=INSETS.find(inset=>inset.abbr==='PR');
  const prFrame={...screenBounds(map,pr.box),inset:pr.abbr};
  return [...stateLabelsController.reservations(),...controls,...(atlasFocus?[]:[prFrame])];
}
function makeLabels() {
  cityLayers=createCityLayers(map,cities,{isNational:isNationalView,metroOverview,phoneViewport:()=>Boolean(phone?.active),stateLabelsFirst});
  stateLabelsController=createStateLabels(map,stateLabels,states,maplibregl.Marker,(geoid,event)=>{
    const state=findStateByGeoid(geoid);
    if(state&&(!phone?.active||event.detail===0))select(state,{zoom:true});
  },isNationalView,cityLayers.protectedMarkerBoxes,wideStateLabels,stateLabelsFirst);
  cityLayers.setReservations(mapReservations);
  countyNames=createCountyLabels(map);
  for(const inset of INSETS){
    const n=element('div','inset-label',inset.name+' / INSET');
    const marker=new maplibregl.Marker({element:n,anchor:inset.abbr==='PR'?'bottom':'top-left',rotationAlignment:'viewport'})
      .setLngLat([inset.box[0][0]+.5,inset.box[1][1]-.35]).addTo(map);
    insetMarkers.push({node:n,inset,marker});
  }
}

function updateMapHud() {
  const z=map.getZoom();
  const center=map.getCenter();
  const {point:[lng,lat],abbr}=geographicPoint([center.lng,center.lat]);
  const coordinates=`${abbr?abbr+' / ':''}${fmtCoord(lat,'lat')} ${fmtCoord(lng,'lng')}`;
  const zoomText=`ZOOM ${z.toFixed(2)}`;
  if($('#coordinate-text').textContent!==coordinates)$('#coordinate-text').textContent=coordinates;
  if($('#zoom-text').textContent!==zoomText)$('#zoom-text').textContent=zoomText;
}

function updateHudWhileMoving(){
  const now=performance.now();
  if(now<nextHudUpdate)return;
  nextHudUpdate=now+85;
  updateMapHud();
}

function scheduleSettledView(){
  if(settledFrame)return;
  settledFrame=requestAnimationFrame(()=>{
    settledFrame=0;
    if(map.isMoving())return;
    updateMapHud();
    updateMetroMode();
    updateInsetTitles();
    stateLabelsController.layout();
    cityLayers.layout();
    autoLoadRegion();
    updateCountyView();
  });
}

function updateInsetTitles(){
  for(const {node,inset,marker} of insetMarkers){
    const bounds=screenBounds(map,inset.box),width=bounds.x1-bounds.x0;
    if(inset.abbr==='PR'){
      const [[west,south],[east]]=inset.box;
      node.textContent=inset.name;
      node.style.fontSize=Math.max(5.5,Math.min(9,width/8))+'px';
      marker.setLngLat([(west+east)/2,south+.24]);
      continue;
    }
    node.textContent=width<55?inset.abbr:width<100?inset.abbr+' / INSET':inset.name+' / INSET';
    node.style.fontSize=width<100?'7px':'9px';
    const position=isNorthUp(map.getBearing())?[inset.box[0][0]+.5,inset.box[1][1]-.35]
      :map.unproject([(bounds.x0+bounds.x1)/2-node.offsetWidth/2,bounds.y0+5]);
    marker.setLngLat(position);
  }
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
  map.addSource('metro-labels',{type:'geojson',data:emptyFC});

  map.addLayer({id:'state-surface',type:'fill',source:'states',paint:{'fill-color':'#101923','fill-opacity':.98}});
  map.addLayer({id:'state-atlas-surface',type:'fill',source:'states',filter:['==',['get','geoid'],'__none__'],paint:{'fill-color':'#101923','fill-opacity':0}});
  map.addLayer({id:'state-hit',type:'fill',source:'states',paint:{'fill-color':'#182637','fill-opacity':.01}});
  map.addLayer({id:'county-hit',type:'fill',source:'counties',minzoom:4.5,layout:{visibility:'none'},paint:{'fill-color':'#3d5977','fill-opacity':.01}});
  map.addLayer({id:'county-lines',type:'line',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},source:'counties',paint:{'line-color':'#3b5268','line-width':['interpolate',['linear'],['zoom'],2,.45,4.5,.7,8,1.15],'line-opacity':.58}});
  map.addLayer({id:'place-area-hit',type:'fill',source:'place-areas',minzoom:8.3,paint:{'fill-color':'#40597a','fill-opacity':.01}});
  map.addLayer({id:'place-area-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',minzoom:8.3,paint:{'line-color':'#546b83','line-opacity':.38,'line-width':.6}});
  map.addLayer({id:'metro-hit',type:'fill',source:'metros',minzoom:4.4,layout:{visibility:'none'},paint:{'fill-color':'#a7bbcc','fill-opacity':.01}});
  map.addLayer({id:'metro-surface',type:'fill',source:'metros',layout:{visibility:'none'},paint:{'fill-color':'#506c90','fill-opacity':.095}});
  map.addLayer({id:'metro-lines',type:'line',source:'metros',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-color':'#839bb9','line-width':['interpolate',['linear'],['zoom'],2,.5,5,1.15],'line-opacity':.58,'line-dasharray':[2,3]}});
  map.addLayer({id:'metro-outline-hit',type:'line',source:'metros',minzoom:4.4,layout:{visibility:'none'},
    paint:{'line-width':7,'line-opacity':.01}});
  map.addLayer({id:cityMetroLayers[0],type:'fill',source:'metros',filter:['==',['get','geoid'],'__none__'],
    paint:{'fill-color':'#6f97ba','fill-opacity':.17}});
  map.addLayer({id:cityMetroLayers[1],type:'line',source:'metros',filter:['==',['get','geoid'],'__none__'],layout:{'line-join':'round'},
    paint:{'line-color':'#b2d8f4','line-width':1.7,'line-opacity':.92}});
  map.addLayer({id:'state-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',paint:{'line-color':'#718da8','line-width':['interpolate',['linear'],['zoom'],3,.8,9,1.7],'line-opacity':.9}});
  const hawaii=states.features.find(f=>f.properties.abbr==='HI');
  if(hawaii){
    map.addSource('hawaii-tail',{type:'geojson',data:hawaiiTailMarks(hawaii.geometry)});
    map.addLayer({id:'hawaii-tail-islands',type:'circle',source:'hawaii-tail',maxzoom:8.5,filter:['==',['get','kind'],'island'],
      paint:{'circle-color':'#9ab4c6','circle-radius':.9,'circle-opacity':['interpolate',['linear'],['zoom'],4,.85,8.5,0]}});
    map.addLayer({id:'hawaii-tail-label',type:'symbol',source:'hawaii-tail',minzoom:2.8,maxzoom:5.5,filter:['==',['get','kind'],'label'],
      layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':8,'text-letter-spacing':.12},paint:{'text-color':'#718da8'}});
  }
  map.addLayer({id:'state-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#b6def5','line-width':1.8,'line-opacity':1}});
  map.addLayer({id:'county-selected',type:'line',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},source:'counties',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#c2e0f5','line-width':2.6,'line-opacity':1}});
  map.addLayer({id:'place-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',filter:['==',['get','geoid'],'__none__'],paint:{'line-color':'#a2d7fc','line-width':2.2,'line-opacity':1}});
  map.addLayer({id:'metro-selected',type:'line',source:'metros',filter:['==',['get','geoid'],'__none__'],layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-color':'#c6daed','line-width':2.3}});
  addGeographyLabels(map);
  map.addLayer({id:'metro-names',type:'symbol',source:'metro-labels',minzoom:7.55,layout:{visibility:'none',
    'text-field':['get','label'],'text-font':['Noto Sans Bold'],'text-size':12,'text-letter-spacing':.055,
    'text-max-width':12,'text-padding':9,'text-variable-anchor':['center','top','bottom','left','right'],'text-radial-offset':.5},
    paint:{'text-color':'#b4cae3','text-halo-color':'#0a1321','text-halo-width':1.6}});
  map.addLayer({id:'places-hit',type:'circle',source:'local-places',minzoom:9.1,paint:{'circle-radius':['interpolate',['linear'],['zoom'],9.1,2,12,3.5],'circle-color':'#98b5cd','circle-stroke-width':.8,'circle-stroke-color':'#d5e7f3','circle-opacity':.44}});
  map.on('mousemove',event=>{
    if(map.isMoving()||!hoverInput.matches||event.originalEvent.sourceCapabilities?.firesTouchEvents)return;
    const hits=map.queryRenderedFeatures(event.point,{layers:hitLayers()});
    map.getCanvas().style.cursor=hits.length?'pointer':'';
    cityLayers.hover(hits.find(f=>f.layer.id.startsWith('city-')||f.layer.id==='places-hit'));
  });
  map.on('click',event=>{
    if(phone?.active)return;
    const isTouch=event.originalEvent.pointerType==='touch'||
      event.originalEvent.sourceCapabilities?.firesTouchEvents||touchInput.matches;
    const result=mapFeatureAt(event.point,isTouch);
    if(!result){deselect();return;}
    if(desktopAtlas&&result.feature?.properties.geoid===selected?.properties.geoid){setSidebarHidden(false);return;}
    if(result.feature)select(result.feature,{zoom:result.layer==='city-hit'||result.layer==='places-hit'});
  });
}
function hitLayers(onPhone=false){
  const metroSelectable=metroMode()!=='off';
  return [...cityLayers.hitLayers,'places-hit',...(onPhone?[]:['place-area-hit']),
    ...(countySelectable()?['county-names']:[]),...(metroSelectable?['metro-names','metro-outline-hit']:[]),
    ...(countySelectable()?['county-hit']:[]),...(metroSelectable?['metro-hit']:[]),'state-hit'];
}
function mapFeatureAt(point,isTouch,onPhone=false){
  const layerOrder=hitLayers(onPhone), hits=map.queryRenderedFeatures(point,{layers:layerOrder});
  let best=layerOrder.map(id=>hits.find(f=>f.layer.id===id)).find(Boolean);
  const hitCity=best?.layer.id.startsWith('city-')||best?.layer.id==='places-hit';
  if(onPhone&&!best?.layer.id.startsWith('city-name')){
    // Use the lettering's actual placement, plus a small touch margin. A
    // direct hit on the dot still keeps the symbol's separate zoom action.
    const onSymbol=hitCity&&map.project(best.geometry.coordinates).dist(point)<=Math.max(4,best.properties.radius||0)+1;
    const label=onSymbol?null:cityLayers.labelNear(point);
    if(label)return {feature:label,layer:'city-name-0'};
  }
  const hitLayer=best?.layer.id;
  if(isTouch&&!hitCity&&!(onPhone&&hitLayer&&hitLayer!=='state-hit')){
    const {x,y}=point,radius=12;
    const nearby=map.queryRenderedFeatures([[x-radius,y-radius],[x+radius,y+radius]],{layers:['city-hit','places-hit']});
    let closest=radius;
    for(const city of nearby){
      const location=map.project(city.geometry.coordinates),distance=Math.hypot(location.x-x,location.y-y);
      if(distance<closest){best=city;closest=distance;}
    }
  }
  if(!best)return null;
  const layer=best.layer.id;
  const feature=layer==='state-hit'?findStateByGeoid(best.properties.geoid)
    :layer==='county-names'?countiesById.get(best.properties.geoid)
    :layer.startsWith('metro-')?metroSet?.features.find(f=>f.properties.geoid===best.properties.geoid):best;
  return {feature,layer};
}
function phoneMapPoint({x,y}){
  const {left,top}=map.getContainer().getBoundingClientRect();
  return {x:x-left,y:y-top};
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
    toggleCountySelection(true);
    try{
      const data=await cacheFetch(countyCache,s.f,`${BASE}counties/${s.f}.geojson`);
      if(revision!==selectionRevision)return;
      const f=data.features.find(v=>v.properties.geoid===s.id);
      if(f){select(f,{zoom:true});return;}
    }catch(error){console.warn(error);}
  }
  if(s.k==='metro'){
    try{
      const areas=await loadMetros();
      if(revision!==selectionRevision)return;
      metroPreference=true;updateMetroMode();
      const f=areas.features.find(v=>v.properties.geoid===s.id);
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
  const stateAbbreviations=new Map(states.features.map(({properties:p})=>
    [p.abbr.toLowerCase(),{k:'state',n:p.name,id:p.geoid}]));
  const query=()=>box.value.trim().toLowerCase();
  let sequence=0;
  function choose(item){
    sequence++;
    results.hidden=true;box.value='';box.blur();
    selectSearchItem(item);
  }
  function render(hits){
    results.replaceChildren();
    for(const item of hits){
      const title=item.n+(item.s?`, ${item.s}`:'');
      const btn=element('button','search-item',title);
      btn.type='button';
      btn.append(element('span','search-type',item.k.toUpperCase()));
      btn.addEventListener('click',()=>choose(item));
      results.append(btn);
    }
    results.hidden=!hits.length;
  }
  box.addEventListener('input',async()=>{
    const q=query(),exact=stateAbbreviations.get(q);
    const ticket=++sequence;
    render(exact?[exact]:[]);
    if(q.length<2)return;
    try{
      const index=await getSearch();
      if(ticket!==sequence||query()!==q)return;
      const hits=index.filter(r=>r.n.toLowerCase().includes(q)&&!(r.k==='state'&&r.id===exact?.id)).sort((a,b)=>
        rankSearch(q,a)-rankSearch(q,b)||
        ({state:0,place:1,county:2,metro:3}[a.k]-{state:0,place:1,county:2,metro:3}[b.k])||a.n.localeCompare(b.n)).slice(0,exact?11:12);
      render(exact?[exact,...hits]:hits);
    }catch(error){console.warn('Search unavailable',error);toast('Search index unavailable.');}
  });
  box.addEventListener('keydown',event=>{
    if(event.key==='Escape'){sequence++;results.hidden=true;box.blur();}
    if(event.key!=='Enter'||event.isComposing)return;
    const exact=stateAbbreviations.get(query());
    if(exact){event.preventDefault();choose(exact);}
    else if(!results.hidden)results.querySelector('button')?.click();
  });
  document.addEventListener('click',event=>{
    if(!event.target.closest('.search-wrap')){sequence++;results.hidden=true;}
  });
}
function setupUI() {
  setupRotation(map,$('.rotation-tools'));
  $('#home').addEventListener('click',reset);
  $('#home').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reset();}});
  $('#reset-view').addEventListener('click',reset);
  $('#zoom-in').addEventListener('click',()=>map.zoomIn());
  $('#zoom-out').addEventListener('click',()=>map.zoomOut());
  const keyToggle=$('#map-key-toggle'),key=$('#map-key');
  populateMapKey($('#map-key-symbols'));
  function setKey(open){key.hidden=!open;keyToggle.setAttribute('aria-expanded',String(open));cityLayers.layout();}
  keyToggle.addEventListener('click',()=>setKey(key.hidden));
  document.addEventListener('click',event=>{
    if(!key.hidden&&!key.contains(event.target)&&!keyToggle.contains(event.target))setKey(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(phone?.focused){phone.leaveAtlas();return;}
    if(desktopAtlas){backFromDesktopAtlas();return;}
    if(key.hidden)deselect();else{setKey(false);keyToggle.focus();}
  });
  $('#toggle-counties').addEventListener('click',()=>toggleCountySelection());
  $('#toggle-metros').addEventListener('click',toggleMetros);
  $('#sidebar-toggle').addEventListener('click',()=>{
    setSidebarHidden(!app.classList.contains('sidebar-hidden'));
  });
  $('#desktop-atlas-toggle').addEventListener('click',()=>{
    if(desktopAtlas)backFromDesktopAtlas();
    else{setKey(false);openDesktopAtlas();}
  });
  $('#desktop-state-back').addEventListener('click',backFromDesktopAtlas);
  phone=setupPhoneUI(map,{
    getSelected:()=>selected,select,deselect,reset,refreshLabels(){
      if(!map.isMoving())stateLabelsController.refresh();
      scheduleSettledView();
    },
    hit(at,target){
      const badge=target.closest?.('.state-label');
      if(badge)return {feature:findStateByGeoid(badge.dataset.geoid),layer:'state-label'};
      const {x,y}=phoneMapPoint(at);
      return mapFeatureAt(new maplibregl.Point(x,y),true,true);
    },
    stateAt(at){
      const {x,y}=phoneMapPoint(at);
      const state=map.queryRenderedFeatures([x,y],{layers:['state-hit']})[0];
      return state&&findStateByGeoid(state.properties.geoid);
    },
    insideState(at,target,geoid){
      const {x,y}=phoneMapPoint(at);
      return target.closest?.('.state-label')?.dataset.geoid===geoid||
        map.queryRenderedFeatures([x,y],{layers:['state-hit']}).some(f=>f.properties.geoid===geoid);
    },
    insideMetro(at){
      if(!cityAtlas?.ready)return true;
      if(!cityAtlas.metro)return false;
      const {x,y}=phoneMapPoint(at);
      return shapeContainsPoint(cityAtlas.metro.shape,map.unproject([x,y]).toArray());
    },
    preview(feature){
      if(phone?.focused)return;
      if(feature?.properties.kind!=='state'){
        if(feature===null)applySelection();
        return;
      }
      map.setFilter('state-selected',['==',['get','geoid'],feature.properties.geoid]);
      map.setPaintProperty('state-selected','line-opacity',.68);
    },
    renderSelection(){if(selected)display(selected);},
    beforeModeChange(){
      desktopStateReturn=null;
      leaveDesktopAtlas();
      setSidebarHidden(false);
    },
    stateCorners(feature){
      const bounds=stateAtlasBounds(feature);
      if(!bounds)return null;
      const box=new maplibregl.LngLatBounds(bounds);
      return [box.getNorthWest(),box.getNorthEast(),box.getSouthEast(),box.getSouthWest()];
    },
    setFocus:setAtlasFocus,fitFeature:fitPhoneAtlas,cityBounds:cityAtlasBounds,fitCity:fitPhoneCityAtlas,
    closeKey:()=>{if(!key.hidden)setKey(false);},
  });
  const viewMenu=$('#view-menu'),searchBox=$('#search');
  searchBox.addEventListener('focus',()=>{viewMenu.open=false;});
  viewMenu.addEventListener('toggle',()=>{if(viewMenu.open)searchBox.blur();});
  document.addEventListener('click',event=>{
    if(viewMenu.open&&!viewMenu.contains(event.target))viewMenu.open=false;
  });
  viewMenu.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&viewMenu.open){
      event.stopPropagation();
      viewMenu.open=false;
      viewMenu.querySelector('summary').focus();
    }
  });
  for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>{
      viewMenu.open=false;
      viewMenu.querySelector('summary').focus();
      toast(`${button.dataset.view.toUpperCase()} view is reserved for a later release.`);
    });
  }
  setupSearch();
}

async function initialize() {
  try {
    [manifest,states,stateLabels,cities,facts]=await Promise.all([
      loadJSON(BASE+'manifest.json'), loadJSON(BASE+'states.geojson'),
      loadJSON(BASE+'state_labels.json'),loadJSON(BASE+'cities.geojson'),loadJSON(BASE+'basic_facts.json')
    ]);
    mappedCityIds=new Set(cities.features.map(f=>f.properties.geoid));
    for(const state of states.features)stateNames.set(state.properties.geoid,state.properties.name);
    map=new maplibregl.Map({
      container:'map',center:[-98.4,38.5],zoom:3.3,minZoom:1.1,maxZoom:16,
      attributionControl:false,pitchWithRotate:false,dragRotate:false,touchPitch:false,maxPitch:0,bearingSnap:0,renderWorldCopies:false,
      pixelRatio:touchInput.matches?Math.min(window.devicePixelRatio,2):undefined,
      style:{version:8,name:'USA Atlas Statistical',glyphs:new URL('../assets/fonts/',import.meta.url).href+'{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#020307'}}]}
    });
    map.touchZoomRotate.disableRotation();
    map.on('load',()=>{
      addSourcesAndLayers();makeLabels();setupUI();
      map.on('move',updateHudWhileMoving);
      map.on('moveend',scheduleSettledView);
      map.on('resize',scheduleSettledView);
      emptyPanel();
      map.fitBounds(NATIONAL_BOUNDS,{padding:nationalPadding(),duration:0,maxZoom:4.4});
      scheduleSettledView();
      $('#map-loading').classList.add('done');
      setTimeout(()=>{$('#map-loading').style.display='none';},470);
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
