// Run with Node.js: node tools/qa_v02d.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {allNationalBounds,displayData,displayPoint,geographicPoint,hawaiiTailMarks} from '../js/geographic-display.mjs';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const states=read('data/states.geojson');
const transformed=displayData(states);
assert.equal(states.features.length,56);
for(const [index,feature] of states.features.entries()){
  if(feature.properties.abbr!=='AK')assert.deepEqual(transformed.features[index],feature);
}
const geometryFor=abbr=>transformed.features.find(f=>f.properties.abbr===abbr).geometry;
const pointsOf=geometry=>geometry.coordinates.flat(geometry.type==='MultiPolygon'?2:1);
const boundsOf=points=>[
  [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],
  [Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],
];
const alaskaPoints=pointsOf(states.features.find(f=>f.properties.abbr==='AK').geometry);
const alaskaDisplay=pointsOf(geometryFor('AK'));
assert.equal(alaskaPoints.length,alaskaDisplay.length);
alaskaPoints.forEach(([lng,lat],i)=>{
  assert.deepEqual(alaskaDisplay[i],[lng>0?lng-360:lng,lat]);
  const inverse=geographicPoint(alaskaDisplay[i]);
  assert(Math.abs(inverse[0]-lng)<1e-8&&inverse[1]===lat);
});
const alaskaBounds=boundsOf(alaskaDisplay);
const hawaiiBounds=boundsOf(pointsOf(geometryFor('HI')));
const puertoRicoBounds=boundsOf(pointsOf(geometryFor('PR')));
assert(alaskaBounds[0][0]<-187&&alaskaBounds[1][1]>71);
assert(hawaiiBounds[0][0]<-178&&hawaiiBounds[1][0]>-155);
assert(puertoRicoBounds[0][0]<-67&&puertoRicoBounds[1][0]>-66&&puertoRicoBounds[0][1]<18);
assert.deepEqual(allNationalBounds([alaskaBounds,hawaiiBounds,puertoRicoBounds]),[
  [alaskaBounds[0][0],puertoRicoBounds[0][1]],
  [puertoRicoBounds[1][0],alaskaBounds[1][1]],
]);
const islandPoints=new Set(pointsOf(geometryFor('HI')).map(String));
const tail=hawaiiTailMarks(geometryFor('HI')).features.filter(f=>f.properties.kind==='island');
assert(tail.length>0&&tail.every(f=>islandPoints.has(String(f.geometry.coordinates))));
for(const label of read('data/state_labels.json').filter(p=>['HI','PR'].includes(p.abbr))){
  assert.deepEqual(displayPoint(label.coordinates,label.abbr),label.coordinates);
}
for(const fips of ['15','72']){
  for(const path of ['data/counties/'+fips+'.geojson','data/places/'+fips+'_points.geojson']){
    const collection=read(path);
    assert.deepEqual(displayData(collection),collection);
  }
}
const count=(folder,suffix)=>fs.readdirSync(fileURLToPath(new URL(folder,root))).filter(p=>p.endsWith(suffix)).reduce((n,p)=>n+read(folder+p).features.length,0);
assert.equal(count('data/counties/','.geojson'),3235);
assert.equal(count('data/places/','_points.geojson'),32629);
assert.equal(read('data/metros.geojson').features.length,935);
const metroFacts=read('data/metro_facts.json').records;
const countyFacts=read('data/basic_facts.json').counties;
const memberships=Object.values(metroFacts).flatMap(metro=>{
  const ids=Object.keys(metro.counties);
  assert(ids.length>0,'Every metro and micro area has at least one county');
  return ids;
});
assert.equal(Object.keys(metroFacts).length,935);
assert.equal(memberships.length,1915);
assert.equal(new Set(memberships).size,memberships.length);
assert(memberships.every(id=>countyFacts[id]));
assert.equal(metroFacts['35620'].counties['36059'],'Nassau County');
for(const city of read('data/major_cities.geojson').features){
  assert(read('data/places/'+city.properties.state_fips+'_points.geojson').features.some(f=>f.properties.geoid===city.properties.geoid));
}
console.log('PASS ALL frames Alaska across the dateline, the full Hawaiian chain and Puerto Rico at their geographic coordinates.');
console.log('PASS Hawaii and Puerto Rico state, county and place coordinates are unchanged.');
console.log('PASS 56 states/equivalents, 3235 counties, 32629 places, 935 metros; all 43 major-city Census IDs resolve.');
console.log('PASS 1915 official county memberships across all 935 metro and micro areas.');
