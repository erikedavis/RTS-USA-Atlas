// Run with Node.js: node tools/qa_v02d.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {INSETS,allNationalBounds,displayData,displayPoint,geographicPoint} from '../js/insets.mjs';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const states=read('data/states.geojson');
const transformed=displayData(states);
assert.equal(states.features.length,56);
for(const inset of INSETS){
  const f=transformed.features.find(f=>f.properties.abbr===inset.abbr);
  const points=[];
  const walk=c=>typeof c[0]==='number'?points.push(c):c.forEach(walk);
  walk(f.geometry.coordinates);
  for(const [lng,lat] of points){
    assert(lng>=inset.box[0][0] && lng<=inset.box[1][0],inset.abbr+' longitude outside frame');
    assert(lat>=inset.box[0][1] && lat<=inset.box[1][1],inset.abbr+' latitude outside frame');
  }
  const label=read('data/state_labels.json').find(p=>p.abbr===inset.abbr);
  const original=label.coordinates;
  const inverse=geographicPoint(displayPoint(original,inset.abbr)).point;
  assert(Math.abs(inverse[0]-original[0])<1e-8 && Math.abs(inverse[1]-original[1])<1e-8,'inset inverse');
}
for(const abbr of ['CA','MI','TX','VI','GU','AS','MP']){
  assert.deepEqual(transformed.features.find(f=>f.properties.abbr===abbr),states.features.find(f=>f.properties.abbr===abbr));
}
const alaska=states.features.find(f=>f.properties.abbr==='AK');
const alaskaPoints=alaska.geometry.coordinates.flat(2);
const alaskaDisplay=transformed.features.find(f=>f.properties.abbr==='AK').geometry.coordinates.flat(2);
assert.equal(alaskaPoints.length,alaskaDisplay.length);
alaskaPoints.forEach(([lng,lat],i)=>{
  assert.deepEqual(alaskaDisplay[i],[lng>0?lng-360:lng,lat]);
  const inverse=geographicPoint(alaskaDisplay[i]);
  assert.equal(inverse.abbr,'');
  assert(Math.abs(inverse.point[0]-lng)<1e-8&&inverse.point[1]===lat);
});
const alaskaBounds=[
  [Math.min(...alaskaDisplay.map(p=>p[0])),Math.min(...alaskaDisplay.map(p=>p[1]))],
  [Math.max(...alaskaDisplay.map(p=>p[0])),Math.max(...alaskaDisplay.map(p=>p[1]))],
];
assert(alaskaBounds[0][0]<-187 && alaskaBounds[1][1]>71);
assert.deepEqual(allNationalBounds(alaskaBounds),[[alaskaBounds[0][0],21.8],[-66.7,alaskaBounds[1][1]]]);
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
console.log('PASS Alaska keeps its geographic coordinates through the dateline; ALL includes its full extent and both insets.');
console.log('PASS inset boundaries fit their containers; display transforms invert correctly; other territories unchanged.');
console.log('PASS 56 states/equivalents, 3235 counties, 32629 places, 935 metros; all 43 major-city Census IDs resolve.');
console.log('PASS 1915 official county memberships across all 935 metro and micro areas.');
