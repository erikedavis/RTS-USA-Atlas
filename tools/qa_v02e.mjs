// Run from the extracted folder: node tools/qa_v02e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,base),'utf8'));
const facts=read('data/basic_facts.json');
const cities=read('data/major_cities.geojson').features;
const labels=read('data/state_labels.json');
const ids=new Set(cities.map(f=>f.properties.geoid));
assert.equal(ids.size,cities.length,'no duplicate city markers');
const states=Object.entries(facts.states).filter(([id])=>Number(id)<60 && id!=='11');
assert.equal(states.length,50);
for(const [id,state] of states){
  assert.equal(state.population_date,'2025-07-01');
  assert(Number.isInteger(state.population) && state.population>0);
  assert(state.land_sq_mi>0 && state.water_sq_mi>=0);
  for(const key of ['capital','largest_city']){
    const city=cities.find(f=>f.properties.geoid===state[key]);
    assert(city?.properties.national,`${state.abbr} ${key} missing from national markers`);
    const record=facts.places[state[key]];
    assert.equal(record.state_fips,id);
    assert.equal(record.population_date,'2025-07-01');
    assert(record.population>0 && record.land_sq_mi>0);
  }
  const maximum=Math.max(...Object.values(facts.places).filter(p=>p.state_fips===id && p.population_date==='2025-07-01').map(p=>p.population));
  assert.equal(facts.places[state.largest_city].population,maximum,`${state.abbr} largest-city ranking`);
}
assert.deepEqual(labels.find(p=>p.abbr==='MI').coordinates,[-85.5,44.1]);
assert.equal(facts.states['04'].capital,facts.states['04'].largest_city,'Phoenix single marker');
const coverage={};
for(const p of Object.values(facts.places)){
  const date=p.population_date||'unavailable';coverage[date]=(coverage[date]||0)+1;
  if(p.population!==undefined)assert(Number.isInteger(p.population) && p.population>=0);
  if(p.land_sq_mi!==undefined)assert(p.land_sq_mi>=0 && p.water_sq_mi>=0);
}
console.log('PASS all 50 states: population, capital and largest-city population, area and national markers; no duplicated cities.');
console.log('PASS Michigan mitten label; largest-city rankings verified against all bundled 2025 place estimates.');
console.log('Place population coverage:',coverage);
