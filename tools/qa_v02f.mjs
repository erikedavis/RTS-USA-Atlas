import fs from 'node:fs';
import assert from 'node:assert/strict';
import {CITY_BANDS} from '../js/city-layers.mjs';
const base=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,base),'utf8'));
const facts=read('data/basic_facts.json'),features=read('data/cities.geojson').features;
const byId=new Map(features.map(f=>[f.properties.geoid,f]));
assert.equal(byId.size,features.length);
const required=Object.entries(facts.places).filter(([id,p])=>p.population>=10000);
for(const [id,p] of required){
 const f=byId.get(id);assert(f,'Missing city over 10k: '+p.name);
 assert.equal(f.properties.population,p.population);
 assert.equal(f.properties.min_zoom,CITY_BANDS[f.properties.band]);
 assert(f.properties.min_zoom<=6.5,p.name+' never becomes visible');
 if(p.population>=100000)assert.equal(f.properties.band,0,p.name+' not visible nationally');
}
for(const [id,s] of Object.entries(facts.states).filter(([id])=>Number(id)<60&&id!=='11')){
 const top=features.filter(f=>f.properties.state_fips===id&&f.properties.is_top8);
 assert.equal(top.length,8,s.abbr+' top eight');
 assert(byId.has(s.capital)&&byId.has(s.largest_city));
 assert.equal(byId.get(s.capital).properties.min_zoom,1.1);
}
assert.equal(byId.get('5531000').properties.population,106675);
assert.equal(byId.get('5531000').properties.min_zoom,1.1);
const labels=read('data/state_labels.json'),point=labels.find(s=>s.abbr==='IN').coordinates;
assert.deepEqual(point,[-86.173694,40.07]);
const hamilton=read('data/counties/18.geojson').features.find(f=>f.properties.name==='Hamilton');
function ringContains(ring,[x,y]){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}
const polygons=hamilton.geometry.type==='Polygon'?[hamilton.geometry.coordinates]:hamilton.geometry.coordinates;
assert(polygons.some(p=>ringContains(p[0],point)&&!p.slice(1).some(r=>ringContains(r,point))),'IN label is not inside Hamilton County');
console.log('PASS',required.length,'places >=10k all represented and reveal by zoom 6.5;',features.length,'total city points.');
console.log('PASS every state has its top eight, capital, and largest city; all >=100k visible nationally.');
console.log('PASS Green Bay nationally eligible; IN label lies inside Hamilton County at its original longitude.');
