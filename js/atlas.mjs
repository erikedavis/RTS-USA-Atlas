// USA Atlas - adaptive city hierarchy and official Census 2025 geography.
// Local renderer and geography; no external requests at runtime.
import * as maplibregl from '../assets/vendor/maplibre-gl.mjs';
import {createCityLayers} from './city-display.mjs?v=10a2';
import {isMetroScale} from './city-layout.mjs';
import {populateMapKey} from './city-symbols.mjs?v=09p';
import {createGeographyLabels} from './geography-labels.mjs?v=10a2';
import {createStateLabels} from './state-labels.mjs?v=10a2';
import {prepareStateShapes,shapeContainsPoint} from './state-label-placement.mjs';
import {isNorthUp,screenBounds,setupRotation} from './map-rotation.mjs?v=10a';
import {setupPhoneUI} from './phone-ui.mjs?v=10a';
import {COUNTY_LABEL_ZOOM,createCountyLabels} from './county-labels.mjs?v=10a2';
import {applyMapAppearance,mapPalette,setupAppearance} from './appearance.mjs?v=10a3';
import {createSelectedAreaLabel} from './selected-area-label.mjs';
import {CONUS_BOUNDS, MAIN_HAWAII_BOUNDS, allNationalBounds, displayData, displayPoint, geographicPoint, hawaiiTailMarks} from './geographic-display.mjs';

const BASE = './data/';
const $ = (selector) => document.querySelector(selector);
$('#build-version').textContent=$('meta[name="atlas-version"]').content.split(' ').pop();
const app = $('.app');
const info = $('#panel-content');
const panel = $('#info-panel');
const emptyFC = {type:'FeatureCollection',features:[]};
const stateNames = new Map();
let map, manifest, states, stateLabels, cities, facts, usaFacts, usaBadge, usaMarker;
const USA={type:'Feature',properties:{kind:'nation',name:'United States',geoid:'US'},geometry:null};
let nationalScope='conus';
let allBounds=CONUS_BOUNDS;
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
let metroLabelPoints=new Map();
let metroFacts = {};
let metroLoad = null;
let metroPreference = null;
let currentMetroMode;
let countySelectionOverride = false;
// County selection is always explicitly enabled by the CTY control.
let allSearch = null;
let searchLoading = null;
let toastTimer;
let stateLabelsController, cityLayers, citiesById, selectedAreaLabel, geographyLabels;
let phone,rotation,atlasFocus=null,cityAtlas=null,metroBounds,placeContext;
let desktopAtlas=null,desktopStateReturn=null;

const countyCache = new Map();
const countyShapes = new WeakMap();
const pointCache = new Map();
const shapeCache = new Map();

const chooseCoords = (obj) => obj?.geometry?.coordinates ?? null;
const compactLayout = matchMedia('(max-width: 670px), (max-width: 950px) and (hover: none) and (orientation: landscape)');
const touchInput = matchMedia('(pointer: coarse)');
const hoverInput = matchMedia('(any-hover: hover)');
const nationalPadding = () => compactLayout.matches
  ? {top:46,bottom:phone?.active?phoneDockHeight():40,left:10,right:10}
  : {top:55,bottom:35,left:25,right:85};
const nationalBounds=()=>nationalScope==='all'?allBounds:CONUS_BOUNDS;
let homeSize='',homeZoom=3.3;
let settledFrame=0,nextHudUpdate=0;
function isNationalView(){
  const container=map.getContainer(),padding=nationalPadding();
  const size=`${container.clientWidth}x${container.clientHeight}:${padding.bottom}:${nationalScope}`;
  if(size!==homeSize){
    homeSize=size;
    homeZoom=map.cameraForBounds(nationalBounds(),{padding,maxZoom:3.5})?.zoom??3.3;
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
function emptyPanel({reveal=true}={}) {
  placeContext=null;
  const scope=element('div','national-scope');
  scope.setAttribute('role','group');
  scope.setAttribute('aria-label','USA map extent');
  for(const [value,label] of [['conus','CONUS'],['all','ALL']]){
    const button=element('button','national-scope-button',label);
    button.type='button';
    button.dataset.nationalScope=value;
    button.setAttribute('aria-pressed',String(value===nationalScope));
    button.addEventListener('click',()=>changeNationalScope(value));
    scope.append(button);
  }
  const area=element('section','area-facts national-area');
  area.setAttribute('aria-label','Area');
  row('LAND AREA / '+usaFacts.area_year,squareMiles(usaFacts.land_sq_mi),area);
  const facts=element('div','national-facts');
  facts.append(populationFacts(usaFacts),area);
  info.replaceChildren(
    element('div','section-kicker','USA STATS'),
    element('h1','','United States'),scope,facts
  );
  info.scrollTop=0;
  $('#selection-status').textContent='UNITED STATES';
  if(reveal)setPanelOpen(true);
  else updateDesktopAtlasButtons();
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
function populationFacts(record){
  const section=element('section','basic-facts');
  section.setAttribute('aria-label','Population');
  section.append(element('div','population-total',record.population===undefined?'Not available':number(record.population)),
    element('div','population-caption',record.population===undefined?'Population not published for this place in the bundled Census tables.':
      'POPULATION / '+populationDate(record.population_date)+(record.population_date==='2025-07-01'?' ESTIMATE':' CENSUS')));
  return section;
}
function areaFacts(record,factList){
  const section=element('section','area-facts');
  section.setAttribute('aria-label','Area');
  if(record.land_sq_mi!==undefined){
    row('TOTAL AREA',squareMiles(record.land_sq_mi+record.water_sq_mi),section);
    if(!phone?.active)row('LAND AREA',squareMiles(record.land_sq_mi),section);
  }else row('AREA','Not available',section);
  factList.append(section);
}
function basicFacts(f,overview) {
  const p=f.properties,record=p.kind==='state'?facts.states[p.geoid]:p.kind==='place'?facts.places[p.geoid]:
    p.kind==='county'?facts.counties[p.geoid]:p.kind==='metro'?metroFacts[p.geoid]:null;
  if(!record)return false;
  (overview?.identity||info).append(populationFacts(record));
  const factList=overview?.facts||info;
  if(p.kind==='state'){
    function cityRecord(label,id){
      const city=facts.places[id];if(!city)return;
      const button=element('button','fact-city','');button.type='button';
      button.append(element('span','fact-city-role',label),element('strong','',city.name),
        element('span','fact-city-pop',city.population===undefined?'Population unavailable':
          number(city.population)+(overview?' residents':' residents / '+populationDate(city.population_date))));
      button.addEventListener('click',()=>{
        const feature=citiesById.get(id);
        if(!feature)return;
        if(phone?.active)phone.openCityFromState(feature);
        else openDesktopCityFromState(feature);
      });
      factList.append(button);
    }
    if(record.capital && record.capital===record.largest_city)cityRecord('CAPITAL / LARGEST CITY',record.capital);
    else {cityRecord('STATE CAPITAL',record.capital);cityRecord('LARGEST CITY',record.largest_city);}
  }
  if(p.kind==='county'){
    if(record.largest_city_population_in_county!==undefined)row('CITY RESIDENTS IN COUNTY',number(record.largest_city_population_in_county));
    if(record.largest_city_method)info.append(element('div','facts-date',record.largest_city_method));
  }
  areaFacts(record,factList);
  if(record.land_sq_mi!==undefined)info.append(element('div','facts-date','AREA / CENSUS '+record.area_year+' / TOTAL INCLUDES WATER'));
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
  placeContext=null;
  if(['place','county','metro'].includes(p.kind)){
    const grid=element('div',p.kind==='metro'?'place-heading metro-heading':'place-heading');
    const identity=element('div','place-identity');
    identity.append(...heading);
    if(p.kind==='place')placeContext=placeLinks(f);
    grid.append(identity,placeContext?.links||areaLinks(f));
    info.replaceChildren(grid);
    overview={identity};
  }else if(phone?.active&&p.kind==='state'){
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
  if(p.kind==='state'&&!phone?.active)info.append(element('div','panel-help','Click a state abbreviation to zoom to that state. Select a city above to visit it.'));
  $('#selection-status').textContent=(p.kind||'FEATURE').toUpperCase()+' SELECTED';
  info.scrollTop=0;
  setPanelOpen(true);
}

const placePoint=feature=>feature.geometry?.type==='Point'?feature.geometry.coordinates:
  citiesById.get(feature.properties.geoid)?.geometry.coordinates;

function locationButton(name,activate){
  const button=element('button','place-location-link',name);
  button.type='button';
  button.addEventListener('click',activate);
  return button;
}

function locationRow(links,label,state=false){
  const row=element('div',state?'place-location place-state':'place-location');
  row.append(element('span','record-label',label));
  links.append(row);
  return row;
}

function placeLinks(feature){
  const links=element('div','place-locations');
  links.setAttribute('aria-label','City geography');
  const {state_fips:fips}=feature.properties;
  const point=placePoint(feature);
  const state=findStateByGeoid(fips);
  const metro=point?metroAtPlace(point):Promise.resolve(null);
  const county=point&&fips?countyAtPlace(fips,point):Promise.resolve(null);

  function addLocation(label,result,activate,empty,stateRow=false){
    const row=locationRow(links,label,stateRow);
    const text=element('span','place-location-value','Loading…');
    row.append(text);
    function apply(area){
      if(!area){text.textContent=empty;return;}
      const properties=area.properties;
      const name=properties.kind==='county'?(properties.official_name||properties.name):properties.name;
      text.replaceWith(locationButton(name,()=>activate(area)));
    }
    if(result instanceof Promise)result.then(apply).catch(()=>{text.textContent='Unavailable';});
    else apply(result);
  }

  addLocation('State',state,selectAndFitState,'Unavailable',true);
  addLocation('Metro',metro.then(match=>match?.area),selectMetro,'Outside an MSA');
  addLocation('County',county,selectCounty,'Unavailable');
  return {links,point,metro};
}

function areaLinks(feature){
  const p=feature.properties,isMetro=p.kind==='metro';
  const links=element('div','place-locations');
  links.setAttribute('aria-label',isMetro?'Metro geography':'County geography');
  const members=Object.entries(isMetro?metroFacts[p.geoid]?.counties||{}:{})
    .sort(([idA,nameA],[idB,nameB])=>idA.slice(0,2).localeCompare(idB.slice(0,2))||nameA.localeCompare(nameB));
  const stateIds=isMetro?[...new Set(members.map(([id])=>id.slice(0,2)))]:[p.state_fips];
  const states=stateIds.map(findStateByGeoid).filter(Boolean);
  const stateRow=locationRow(links,states.length>1?'States':'State',true);
  for(const state of states)stateRow.append(locationButton(state.properties.name,()=>selectAndFitState(state)));
  const city=isMetro?placesInMetro(feature).find(f=>f.properties.population_known):
    citiesById.get(facts.counties[p.geoid]?.largest_city);
  const cityRow=locationRow(links,city?.properties.official_name?.endsWith(' CDP')?'Largest place':'Largest city');
  if(city)cityRow.append(locationButton(city.properties.name,()=>select(city,{zoom:true})));
  else cityRow.append(element('span','place-location-value','Unavailable'));
  if(members.length===1){
    const [[id,name]]=members;
    locationRow(links,'County').append(locationButton(name,()=>selectSearchItem({k:'county',id,f:id.slice(0,2)})));
  }else if(members.length>1){
    const counties=element('details','region-counties');
    counties.append(element('summary','record-label',`Counties (${members.length})`));
    const list=element('div','place-location');
    for(const [id,name] of members){
      const fips=id.slice(0,2),state=states.find(f=>f.properties.geoid===fips);
      const title=states.length>1&&state?`${name}, ${state.properties.abbr}`:name;
      list.append(locationButton(title,()=>selectSearchItem({k:'county',id,f:fips})));
    }
    counties.append(list);
    links.append(counties);
  }
  return links;
}

async function metroAtPlace(point){
  const {features}=await loadMetros();
  metroBounds??=features.filter(area=>area.properties.class==='metro').map(area=>({area,bounds:boundsOf(area.geometry)}));
  const [lng,lat]=point;
  return metroBounds.find(entry=>{
    const [[west,south],[east,north]]=entry.bounds;
    return lng>=west&&lng<=east&&lat>=south&&lat<=north&&
      shapeContainsPoint(entry.shape??=prepareStateShapes(entry.area.geometry),point);
  });
}

async function countyAtPlace(fips,point){
  const {features}=await cacheFetch(countyCache,fips,`${BASE}counties/${fips}.geojson`);
  const [lng,lat]=point;
  return features.find(county=>{
    let geometry=countyShapes.get(county);
    if(!geometry){
      geometry={bounds:boundsOf(county.geometry)};
      countyShapes.set(county,geometry);
    }
    const [[west,south],[east,north]]=geometry.bounds;
    return lng>=west&&lng<=east&&lat>=south&&lat<=north&&
      shapeContainsPoint(geometry.shape??=prepareStateShapes(county.geometry),point);
  });
}

function setPanelOpen(open) {
  if(phone?.active){phone.selectionChanged(open?(selected||USA):null);return;}
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
  const kind=(selected||USA).properties.kind;
  const toggle=$('#desktop-atlas-toggle');
  toggle.hidden=!['state','place','metro','nation'].includes(kind);
  toggle.textContent=desktopAtlas?'Back':'Atlas';
  toggle.setAttribute('aria-expanded',String(Boolean(desktopAtlas)));
  $('#desktop-state-back').hidden=!desktopStateReturn||Boolean(desktopAtlas);
  $('#desktop-dismiss').hidden=!selected&&!desktopAtlas;
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
  const compass=$('.rotation-tools:not([inert]) .compass-face:not([inert])');
  if(!isNorthUp(bearing)&&compass){
    if(typeof padding==='number')padding={top:padding,right:padding,bottom:padding,left:padding};
    const container=map.getContainer();
    const hudBottom=compass.getBoundingClientRect().bottom-container.getBoundingClientRect().top;
    const cap=container.clientHeight*.28;
    padding={...padding,top:Math.max(padding.top,Math.min(cap,hudBottom+14))};
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
  if(f.properties.kind==='state'&&f.properties.abbr==='HI'){
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    const padding={top:h*.145,bottom:phone?.active?Math.max(h*.185,phoneDockHeight()):h*.185,left:w*.09,right:w*.13};
    fitAtCurrentBearing(MAIN_HAWAII_BOUNDS,{padding,maxZoom,duration});
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
  return feature.properties.abbr==='HI'?MAIN_HAWAII_BOUNDS:boundsOf(feature.geometry);
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
  if(feature===USA){
    fitAtCurrentBearing(nationalBounds(),{padding:{top:headerHeight+29,bottom:sheetHeight+12,left:12,right:12},maxZoom:3.5,duration});
    return;
  }
  if(feature.properties.kind==='metro'){
    fitAtCurrentBearing(boundsOf(feature.geometry),{padding:{top:headerHeight+12,bottom:sheetHeight+12,left:15,right:15},maxZoom:13,duration});
    return;
  }
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
  cityAtlas=null;
  const metroId=feature?.properties.kind==='metro'?feature.properties.geoid:'__none__';
  for(const id of cityMetroLayers)map.setFilter(id,['==',['get','geoid'],metroId]);
  const isState=feature?.properties.kind==='state';
  focusStateAtlas(isState?feature.properties.geoid:null,fast);
  if(feature?.properties.kind!=='place')return;

  const {point,metro}=placeContext;
  const view={point,metro:null,ready:!point};
  cityAtlas=view;
  if(!point)return;
  metro.then(match=>{
    if(cityAtlas!==view)return;
    view.ready=true;
    if(!match)return;
    view.metro=match;
    for(const id of cityMetroLayers)map.setFilter(id,['==',['get','geoid'],match.area.properties.geoid]);
  }).catch(error=>{
    if(cityAtlas===view)view.ready=true;
    console.warn('City atlas metro:',error);
  });
}
const mapCamera=()=>({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing()});
const atlasDuration=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?0:360;

function openDesktopAtlas({frame=true,returnCamera}={}){
  const feature=selected||USA,kind=feature.properties.kind;
  if(desktopAtlas||!['state','place','metro','nation'].includes(kind))return;
  map.stop();
  desktopAtlas={kind,returnCamera:returnCamera||mapCamera()};
  app.dataset.desktopAtlas=kind;
  setSidebarHidden(false);
  updateDesktopAtlasButtons();
  map.resize();
  info.scrollTop=0;
  setAtlasFocus(feature);
  if(feature===USA){
    nationalPanelMode(true);
    if(frame)fitNation(atlasDuration());
    return;
  }
  if(kind==='metro')showMetroPlaces(selected);
  if(frame&&kind!=='place'){
    const bounds=kind==='state'?stateAtlasBounds(selected):boundsOf(selected.geometry);
    if(bounds)fitAtCurrentBearing(bounds,{padding:{top:22,bottom:26,left:22,right:34},maxZoom:13,duration:atlasDuration()});
  }
}

function leaveDesktopAtlas({restore=true}={}){
  if(!desktopAtlas)return;
  const {returnCamera,kind}=desktopAtlas;
  desktopAtlas=null;
  map.stop();
  delete app.dataset.desktopAtlas;
  info.querySelector('.metro-atlas-places')?.remove();
  setAtlasFocus(null);
  updateDesktopAtlasButtons();
  map.resize();
  if(kind==='nation')nationalPanelMode(false);
  if(restore){
    if(returnCamera)map.easeTo({...returnCamera,duration:atlasDuration()});
    else fitNation(atlasDuration());
  }
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

const metroPlaces=new WeakMap();
function placesInMetro(metro){
  if(!metroPlaces.has(metro)){
    const shape=prepareStateShapes(metro.geometry);
    const [[west,south],[east,north]]=boundsOf(metro.geometry);
    const places=cities.features.filter(city=>{
      const [lng,lat]=city.geometry.coordinates;
      return lng>=west&&lng<=east&&lat>=south&&lat<=north&&shapeContainsPoint(shape,[lng,lat]);
    }).sort((a,b)=>b.properties.population-a.properties.population||a.properties.name.localeCompare(b.properties.name));
    metroPlaces.set(metro,places);
  }
  return metroPlaces.get(metro);
}

function showMetroPlaces(metro){
  const details=element('details','census-record metro-atlas-places');
  details.append(element('summary','','Cities and places'));
  info.querySelector('.census-record').before(details);
  details.addEventListener('toggle',()=>{
    if(!details.open||details.children.length>1)return;
    const places=placesInMetro(metro);
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
  for(const id of ['great-lakes-shoreline','geography-lake','geography-peninsula','geography-island']){
    map.setLayoutProperty(id,'visibility',fips?'none':'visible');
  }
  map.setLayoutProperty('great-lakes-fill','visibility',fips?'none':'visible');
  for(const id of ['hawaii-tail-islands','hawaii-tail-label']){
    if(map.getLayer(id))map.setLayoutProperty(id,'visibility',!fips||fips==='15'?'visible':'none');
  }
  updatePlaceVisibility();
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
  stateLabelsController?.setSelected(selected?.properties.kind==='state'?selectedState:null);
  cityLayers?.update(selectedState,selected);
  map.setFilter('county-selected',['==',['get','geoid'],selected?.properties?.kind==='county'?selected.properties.geoid:'__none__']);
  map.setFilter('place-selected',['==',['get','geoid'],selected?.properties?.kind==='place'?selected.properties.geoid:'__none__']);
  map.setFilter('metro-selected',['==',['get','geoid'],selected?.properties?.kind==='metro'?selected.properties.geoid:'__none__']);
}
function select(f,{zoom=false,duration,preserveStateReturn=false}={}) {
  if(f===USA){if(zoom)reset();else deselect();return;}
  if(!preserveStateReturn)desktopStateReturn=null;
  leaveDesktopAtlas({restore:false});
  selectionRevision++;
  if(selected!==f)selectedAreaLabel.clear();
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
  scheduleSettledView();
}
function deselect({hideSidebar=false}={}) {
  if(hideSidebar)setSidebarHidden(true);
  desktopStateReturn=null;
  leaveDesktopAtlas({restore:false});
  cityLayers?.clearHover();
  selectionRevision++;
  selected=null;selectedState=null;
  selectedAreaLabel.clear();
  applySelection();emptyPanel({reveal:!hideSidebar});
  updateCountyView();
  updateMetroMode();
  scheduleSettledView();
}
function reset() {
  deselect();
  fitNation(800);
}
function fitNation(duration){
  fitAtCurrentBearing(nationalBounds(),{padding:nationalPadding(),maxZoom:3.5,duration});
}
function nationalPanelMode(open){
  const heading=info.querySelector('.national-scope')&&info.querySelector('.section-kicker');
  if(heading)heading.textContent=open?'USA ATLAS':'USA STATS';
}
function updatePlaceVisibility(){
  const filter=atlasFocus?['==',['get','state_fips'],atlasFocus]:null;
  for(const id of ['places-hit','place-area-hit','place-area-lines'])map.setFilter(id,filter);
}
function changeNationalScope(value){
  if(value===nationalScope)return;
  nationalScope=value;
  for(const button of info.querySelectorAll('[data-national-scope]')){
    button.setAttribute('aria-pressed',String(button.dataset.nationalScope===value));
  }
  if(desktopAtlas?.kind==='nation')desktopAtlas.returnCamera=null;
  if(phone?.focused)phone.refitAtlas();
  else fitNation(atlasDuration());
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
    if(detailPlaceState===fips)map.getSource('local-places').setData({...data,features:data.features.filter(f=>!citiesById.has(f.properties.geoid))});
  }catch(error){console.warn('Place points:',error);}
  if(detailPlaceState===fips&&map.getZoom()>=8.3)loadPlacePolygons(fips);
}
function updateCountyNames(){
  if(!countySelectionOverride||map.getZoom()<COUNTY_LABEL_ZOOM||map.isMoving()||!countyAnchors)return;
  countyNames.layout(countySet.features,countyAnchors,[...mapReservations(),...cityLayers.labelReservations()],
    selected?.properties.kind==='county'?selected.properties.geoid:null);
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
    const palette=mapPalette();
    map.setPaintProperty('county-lines','line-color',scope?palette.countyScoped:palette.countyLine);
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
    metroLabelPoints=new Map(names.features.map(feature=>[feature.properties.geoid,feature]));
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
  const selectedId=selected?.properties.kind==='metro'?selected.properties.geoid:null;
  const modeKey=`${mode}:${overview}:${scope}:${selectedId}`;
  if(modeKey===currentMetroMode)return;
  currentMetroMode=modeKey;
  const visible=mode!=='off';
  updateLayerButtons();
  for(const id of ['metro-surface','metro-lines','metro-hit','metro-outline-hit','metro-selected','metro-names']){
    map.setLayoutProperty(id,'visibility',visible?'visible':'none');
  }
  const abbr=scope&&findStateByGeoid(scope)?.properties.abbr;
  const inState=abbr?['in','|'+abbr+'|',['get','state_codes']]:null;
  const autoFilter=['==',['get','class'],'metro'];
  const filter=mode==='auto'?(inState?['all',autoFilter,inState]:autoFilter):inState;
  for(const id of ['metro-surface','metro-lines','metro-hit','metro-outline-hit'])map.setFilter(id,filter);
  const unselected=selectedId?['!=',['get','geoid'],selectedId]:null;
  map.setFilter('metro-names',inState&&unselected?['all',inState,unselected]:inState||unselected);
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
function selectAndFitState(state){
  if(phone?.active)phone.selectAndFitState(state);
  else select(state,{zoom:true});
}
function countySelectable(){return countySelectionOverride;}
function updateLayerButtons(){
  const metroVisible=metroMode()!=='off';
  for(const [layer,visible,title] of [
    ['counties',countySelectionOverride,countySelectionOverride?'Hide counties and turn off county selection':'Show counties and enable county selection'],
    ['metros',metroVisible,metroVisible?'Hide metro areas':'Show metro areas'],
  ]){
    const button=$(`#toggle-${layer}`);
    button.setAttribute('aria-pressed',String(visible));
    button.title=title;
  }
}
function toggleCountySelection(force){
  countySelectionOverride=typeof force==='boolean'?force:!countySelectionOverride;
  updateLayerButtons();
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
function mapControlReservations(includeSelected=false){
  const r=map.getContainer().getBoundingClientRect();
  const controls=[...document.querySelectorAll('.map-controls:not(.phone-dock .map-controls),#appearance-toggle,#reset-view,#sidebar-toggle,.rotation-tools:not([inert]) :is(.compass-face:not([inert]),#compass-toggle:not([hidden])),.map-hud,#usa-label,.map-key-toggle,.map-key:not([hidden]),.phone-grip,.phone-dock-row:not([inert]),.phone-home:not([hidden]),.phone-atlas-back:not([hidden]),.phone-history-back:not([hidden])')];
  if(includeSelected)controls.push($('.selected-area-label'));
  return controls.filter(n=>n?.offsetWidth&&n.offsetHeight)
    .map(n=>{const b=n.getBoundingClientRect();return {x0:b.left-r.left,y0:b.top-r.top,x1:b.right-r.left,y1:b.bottom-r.top};});
}
function mapReservations(){
  return [...stateLabelsController.reservations(),...mapControlReservations(true)];
}
function makeLabels() {
  cityLayers=createCityLayers(map,cities,{isNational:isNationalView,metroOverview,phoneViewport:()=>Boolean(phone?.active),stateLabelsFirst,geographyLabels});
  stateLabelsController=createStateLabels(map,stateLabels,states,maplibregl.Marker,(geoid,event)=>{
    const state=findStateByGeoid(geoid);
    if(state&&(!phone?.active||event.detail===0))selectAndFitState(state);
  },isNationalView,cityLayers.protectedMarkerBoxes,wideStateLabels,stateLabelsFirst);
  cityLayers.setReservations(mapReservations);
  countyNames=createCountyLabels(map);
  selectedAreaLabel=createSelectedAreaLabel(map,maplibregl.Marker);
  usaBadge=element('button','state-label usa-label');
  usaBadge.id='usa-label';
  usaBadge.type='button';
  usaBadge.setAttribute('aria-label','Select United States');
  usaBadge.append(element('span','state-label-text','USA'));
  usaMarker=new maplibregl.Marker({element:usaBadge,rotationAlignment:'viewport'}).setLngLat([-97.16,49.5]).addTo(map);
  let holdTimer,held=false,press;
  usaBadge.addEventListener('pointerdown',event=>{
    if(phone?.active||event.button!==0)return;
    held=false;
    press={x:event.clientX,y:event.clientY};
    holdTimer=setTimeout(()=>{held=true;},600);
  });
  const endPress=()=>{clearTimeout(holdTimer);press=null;};
  for(const type of ['pointerup','pointercancel','pointerleave'])usaBadge.addEventListener(type,endPress);
  usaBadge.addEventListener('pointermove',event=>{
    if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>9)endPress();
  });
  usaBadge.addEventListener('click',event=>{
    event.stopPropagation();
    if(held&&event.detail!==0){
      held=false;
      select(USA);
      openDesktopAtlas();
      return;
    }
    if(!phone?.active||event.detail===0)selectAndFitState(USA);
  });
  map.on('zoom',updateUSALabel);
  map.on('rotate',updateUSALabel);
}
function updateUSALabel(){
  usaBadge.hidden=map.getZoom()>3.5||Boolean(atlasFocus||cityAtlas);
  if(usaBadge.hidden)return;
  // Leave room for the whole upright badge north of the northernmost mainland border at any bearing.
  const border=map.project([-97.16,49.5]);
  const north=map.project([-97.16,50.5]).sub(border).unit();
  const extent=(Math.abs(north.x)*usaBadge.offsetWidth+Math.abs(north.y)*usaBadge.offsetHeight)*.575+7;
  usaMarker.setLngLat(map.unproject(border.add(north.mult(extent))));
}

function updateMapHud() {
  const z=map.getZoom();
  const center=map.getCenter();
  const [lng,lat]=geographicPoint([center.lng,center.lat]);
  const coordinates=`${fmtCoord(lat,'lat')} ${fmtCoord(lng,'lng')}`;
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
    if(map.isMoving()||rotation?.dragging)return;
    updateMapHud();
    updateMetroMode();
    updateUSALabel();
    updateSelectedAreaLabel();
    stateLabelsController.layout();
    cityLayers.layout();
    autoLoadRegion();
    updateCountyView();
  });
}
function updateSelectedAreaLabel(){
  const p=selected?.properties;
  if(p?.kind!=='county'&&p?.kind!=='metro'){selectedAreaLabel.clear();return;}
  const metro=metroLabelPoints.get(p.kind==='metro'?p.geoid:null);
  const countyAnchor=p.kind==='county'?countyAnchors?.[p.geoid]:null;
  const coordinates=countyAnchor?displayPoint(countyAnchor,p.state_abbr):metro?.geometry.coordinates;
  selectedAreaLabel.layout(selected,metro?.properties.label||p.official_name||p.name,coordinates,mapControlReservations());
}

function addSourcesAndLayers() {
  map.addSource('context-land',{type:'geojson',data:new URL('../data/context-land.geojson',import.meta.url).href});
  map.addLayer({id:'atlas-context-land',type:'fill',source:'context-land',paint:{'fill-antialias':false}});
  map.addSource('states',{type:'geojson',data:states});
  map.addSource('great-lakes',{type:'geojson',data:new URL('../data/great-lakes.geojson',import.meta.url).href});
  map.addSource('counties',{type:'geojson',data:emptyFC});
  map.addSource('local-places',{type:'geojson',data:emptyFC});
  map.addSource('place-areas',{type:'geojson',data:emptyFC});
  map.addSource('metros',{type:'geojson',data:emptyFC});
  map.addSource('metro-labels',{type:'geojson',data:emptyFC});

  map.addLayer({id:'state-surface',type:'fill',source:'states',paint:{'fill-opacity':.98}});
  map.addLayer({id:'state-atlas-surface',type:'fill',source:'states',filter:['==',['get','geoid'],'__none__'],paint:{'fill-opacity':0}});
  map.addLayer({id:'great-lakes-fill',type:'fill',source:'great-lakes',layout:{visibility:'none'}});
  map.addLayer({id:'state-hit',type:'fill',source:'states',paint:{'fill-color':'#182637','fill-opacity':.01}});
  map.addLayer({id:'county-hit',type:'fill',source:'counties',minzoom:4.5,layout:{visibility:'none'},paint:{'fill-color':'#3d5977','fill-opacity':.01}});
  map.addLayer({id:'county-lines',type:'line',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},source:'counties',paint:{'line-width':['interpolate',['linear'],['zoom'],2,.45,4.5,.7,8,1.15],'line-opacity':.58}});
  map.addLayer({id:'place-area-hit',type:'fill',source:'place-areas',minzoom:8.3,paint:{'fill-color':'#40597a','fill-opacity':.01}});
  map.addLayer({id:'place-area-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',minzoom:8.3,paint:{'line-opacity':.38,'line-width':.6}});
  map.addLayer({id:'metro-hit',type:'fill',source:'metros',minzoom:4.4,layout:{visibility:'none'},paint:{'fill-color':'#a7bbcc','fill-opacity':.01}});
  map.addLayer({id:'metro-surface',type:'fill',source:'metros',layout:{visibility:'none'},paint:{'fill-opacity':.095}});
  map.addLayer({id:'metro-lines',type:'line',source:'metros',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-width':['interpolate',['linear'],['zoom'],2,.5,5,1.15],'line-opacity':.58,'line-dasharray':[2,3]}});
  map.addLayer({id:'metro-outline-hit',type:'line',source:'metros',minzoom:4.4,layout:{visibility:'none'},
    paint:{'line-width':7,'line-opacity':.01}});
  map.addLayer({id:cityMetroLayers[0],type:'fill',source:'metros',filter:['==',['get','geoid'],'__none__'],
    paint:{'fill-opacity':.17}});
  map.addLayer({id:cityMetroLayers[1],type:'line',source:'metros',filter:['==',['get','geoid'],'__none__'],layout:{'line-join':'round'},
    paint:{'line-width':1.7,'line-opacity':.92}});
  map.addLayer({id:'state-lines',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',paint:{'line-width':['interpolate',['linear'],['zoom'],3,.8,9,1.7],'line-opacity':.9}});
  map.addLayer({id:'great-lakes-shoreline',type:'line',source:'great-lakes',layout:{'line-join':'round'},
    paint:{'line-width':['interpolate',['linear'],['zoom'],2,.8,6,1.1],
      'line-opacity':['interpolate',['linear'],['zoom'],2,.7,7,.7,9.5,0]}});
  const hawaii=states.features.find(f=>f.properties.abbr==='HI');
  if(hawaii){
    map.addSource('hawaii-tail',{type:'geojson',data:hawaiiTailMarks(hawaii.geometry)});
    map.addLayer({id:'hawaii-tail-islands',type:'circle',source:'hawaii-tail',maxzoom:8.5,filter:['==',['get','kind'],'island'],
      paint:{'circle-radius':.9,'circle-opacity':['interpolate',['linear'],['zoom'],4,.85,8.5,0]}});
    map.addLayer({id:'hawaii-tail-label',type:'symbol',source:'hawaii-tail',minzoom:2.8,maxzoom:5.5,filter:['==',['get','kind'],'label'],
      layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':8,'text-letter-spacing':.12}});
  }
  map.addLayer({id:'state-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'states',filter:['==',['get','geoid'],'__none__'],paint:{'line-width':1.8,'line-opacity':1}});
  map.addLayer({id:'county-selected',type:'line',layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},source:'counties',filter:['==',['get','geoid'],'__none__'],paint:{'line-width':2.6,'line-opacity':1}});
  map.addLayer({id:'place-selected',type:'line',layout:{'line-join':'bevel','line-cap':'butt'},source:'place-areas',filter:['==',['get','geoid'],'__none__'],paint:{'line-width':2.2,'line-opacity':1}});
  map.addLayer({id:'metro-selected',type:'line',source:'metros',filter:['==',['get','geoid'],'__none__'],layout:{visibility:'none','line-join':'bevel','line-cap':'butt'},paint:{'line-width':2.3}});
  geographyLabels=createGeographyLabels(map);
  map.addLayer({id:'metro-names',type:'symbol',source:'metro-labels',minzoom:7.55,layout:{visibility:'none',
    'text-field':['get','label'],'text-font':['Noto Sans Bold'],'text-size':12,'text-letter-spacing':.055,
    'text-max-width':12,'text-padding':9,'text-variable-anchor':['center','top','bottom','left','right'],'text-radial-offset':.5},
    paint:{'text-halo-width':1.6}});
  map.addLayer({id:'places-hit',type:'circle',source:'local-places',minzoom:9.1,paint:{'circle-radius':['interpolate',['linear'],['zoom'],9.1,2,12,3.5],'circle-stroke-width':.8,'circle-opacity':.44}});
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
    :layer==='county-names'||layer==='county-hit'?(countiesById.get(best.properties.geoid)||best)
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
function selectMetro(feature){
  metroPreference=true;
  select(feature,{zoom:true});
}
function selectCounty(feature){
  toggleCountySelection(true);
  select(feature,{zoom:true});
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
      if(f){selectCounty(f);return;}
    }catch(error){console.warn(error);}
  }
  if(s.k==='metro'){
    try{
      const areas=await loadMetros();
      if(revision!==selectionRevision)return;
      const f=areas.features.find(v=>v.properties.geoid===s.id);
      if(f){selectMetro(f);return;}
    }catch(error){console.warn(error);}
  }
  if(s.k==='place'){
    const f={type:'Feature',properties:{kind:'place',name:s.n,geoid:s.id,state_fips:s.f,state_abbr:s.s,official_name:s.d},geometry:{type:'Point',coordinates:displayPoint(s.p,s.s)}};
    select(f,{zoom:true});return;
  }
  toast('Unable to load selected geographic record.');
}
function setupSearch() {
  const box=$('#search'),results=$('#search-results'),wrap=box.closest('.search-wrap');
  const stateAbbreviations=new Map(states.features.map(({properties:p})=>
    [p.abbr.toLowerCase(),{k:'state',n:p.name,id:p.geoid}]));
  const query=()=>box.value.trim().toLowerCase();
  let sequence=0;
  function dismiss(){
    sequence++;
    results.hidden=true;
  }
  function choose(item){
    dismiss();
    box.value='';box.blur();
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
  async function suggest(){
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
    }catch(error){
      if(ticket!==sequence)return;
      console.warn('Search unavailable',error);toast('Search index unavailable.');
    }
  }
  box.addEventListener('input',suggest);
  box.addEventListener('focus',suggest);
  box.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.stopPropagation();
      dismiss();box.blur();return;
    }
    if(event.key!=='Enter'||event.isComposing)return;
    const exact=stateAbbreviations.get(query());
    if(exact){event.preventDefault();choose(exact);}
    else if(!results.hidden)results.querySelector('button')?.click();
  });
  document.addEventListener('pointerdown',event=>{
    if(wrap.contains(event.target))return;
    dismiss();
    if(document.activeElement===box)box.blur();
  },true);
  document.addEventListener('focusin',event=>{
    if(!wrap.contains(event.target))dismiss();
  });
}
function setupUI() {
  rotation=setupRotation(map,$('.rotation-tools'),scheduleSettledView);
  $('#home').addEventListener('click',reset);
  $('#reset-view').addEventListener('click',reset);
  $('#zoom-in').addEventListener('click',()=>map.zoomIn());
  $('#zoom-out').addEventListener('click',()=>map.zoomOut());
  const keyToggle=$('#map-key-toggle'),key=$('#map-key');
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
  $('#desktop-dismiss').addEventListener('click',()=>{
    deselect({hideSidebar:true});
    $('#sidebar-toggle').focus({preventScroll:true});
  });
  $('#desktop-atlas-toggle').addEventListener('click',()=>{
    if(desktopAtlas)backFromDesktopAtlas();
    else{setKey(false);openDesktopAtlas();}
  });
  $('#desktop-state-back').addEventListener('click',backFromDesktopAtlas);
  phone=setupPhoneUI(map,{
    getSelected:()=>selected||USA,select,deselect,reset,nationalPanelMode,refreshLabels(){
      if(!map.isMoving())stateLabelsController.refresh();
      scheduleSettledView();
    },
    hit(at,target){
      const badge=target.closest?.('.state-label');
      if(badge)return {feature:badge===usaBadge?USA:findStateByGeoid(badge.dataset.geoid),layer:'state-label'};
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
    renderSelection(){if(selected)display(selected);else emptyPanel();},
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
  const toolsMenu=$('#tools-menu'),toolsTrigger=toolsMenu.querySelector('summary');
  const sections=toolsMenu.querySelectorAll('.tools-section'),searchBox=$('#search');
  function closeToolSections(){
    for(const section of sections)section.open=false;
  }
  function closeTools(){
    toolsMenu.open=false;
    closeToolSections();
  }
  searchBox.addEventListener('focus',closeTools);
  toolsMenu.addEventListener('toggle',()=>{
    if(toolsMenu.open)searchBox.blur();
    else closeToolSections();
  });
  document.addEventListener('click',event=>{
    if(toolsMenu.open&&!toolsMenu.contains(event.target))closeTools();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&toolsMenu.open){
      event.stopPropagation();
      closeTools();
      toolsTrigger.focus();
    }
  },true);
  for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>{
      closeTools();
      toolsTrigger.focus();
      toast(`${button.dataset.view.toUpperCase()} view is reserved for a later release.`);
    });
  }
  setupSearch();
}

function refreshAppearance(){
  if(!cityLayers)return;
  const palette=applyMapAppearance(map,Boolean(renderedCountyScope),Boolean(atlasFocus));
  cityLayers.setAppearance(palette);
  geographyLabels.setAppearance(palette);
  populateMapKey($('#map-key-symbols'),palette.citySymbol);
}

async function initialize() {
  try {
    [manifest,states,stateLabels,cities,facts,usaFacts]=await Promise.all([
      loadJSON(BASE+'manifest.json'), loadJSON(BASE+'states.geojson'),
      loadJSON(BASE+'state_labels.json'),loadJSON(BASE+'cities.geojson'),loadJSON(BASE+'basic_facts.json'),loadJSON(BASE+'usa_facts.json')
    ]);
    citiesById=new Map(cities.features.map(f=>[f.properties.geoid,f]));
    const islandBounds=states.features.filter(f=>['AK','HI','PR'].includes(f.properties.abbr))
      .map(f=>boundsOf(f.geometry));
    allBounds=allNationalBounds(islandBounds);
    for(const state of states.features)stateNames.set(state.properties.geoid,state.properties.name);
    map=new maplibregl.Map({
      container:'map',center:[-98.4,38.5],zoom:3.3,minZoom:0,maxZoom:16,
      attributionControl:false,pitchWithRotate:false,dragRotate:false,touchPitch:false,maxPitch:0,bearingSnap:0,renderWorldCopies:true,
      pixelRatio:touchInput.matches?Math.min(window.devicePixelRatio,2):undefined,
      style:{version:8,name:'USA Atlas Statistical',glyphs:new URL('../assets/fonts/',import.meta.url).href+'{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':mapPalette().background}}]}
    });
    map.touchZoomRotate.disableRotation();
    map.on('load',()=>{
      addSourcesAndLayers();makeLabels();refreshAppearance();setupUI();
      map.on('move',updateHudWhileMoving);
      map.on('moveend',scheduleSettledView);
      map.on('resize',scheduleSettledView);
      emptyPanel();
      fitNation(0);
      scheduleSettledView();
      map.once('idle',()=>{
        const loading=$('#map-loading');
        loading.classList.add('done');
        setTimeout(()=>{loading.style.display='none';},470);
      });
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
setupAppearance(refreshAppearance);
initialize();
