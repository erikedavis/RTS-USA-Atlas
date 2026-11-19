#!/usr/bin/env python3
"""Static data/architecture checks; not a substitute for interactive browser QA."""
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
loads=lambda path:json.loads((root/path).read_text())
states=loads('data/states.geojson')['features']
county_count=sum(len(json.loads(p.read_text())['features']) for p in (root/'data/counties').glob('*.geojson'))
place_count=sum(len(json.loads(p.read_text())['features']) for p in (root/'data/places').glob('*_points.geojson'))
metros=loads('data/metros.geojson')['features']
assert len(states)==56,(len(states),'states')
assert county_count==3235,(county_count,'counties')
assert place_count==32629,(place_count,'places')
assert len(metros)==935,(len(metros),'metro/micro')
cs=loads('data/major_cities.geojson')['features']
for f in cs:
 p=f['properties']
 ids={x['properties']['geoid'] for x in loads(f"data/places/{p['state_fips']}_points.geojson")['features']}
 assert p['geoid'] in ids,(p['name'],p['geoid'])
assert next(x for x in cs if x['properties']['name']=='New York')['properties']['geoid']=='3651000'
css=(root/'assets/atlas.css').read_text()
js=(root/'js/atlas.mjs').read_text()
html=(root/'index.html').read_text()
assert 'position:absolute !important' in css
assert '.maplibregl-marker.city-marker' in css
assert 'COUNTY_SELECT_ZOOM = 7' in js
assert "id:'places-hit',type:'circle',source:'local-places',minzoom:9.1" in js
assert "id:'state-lines',type:'line',source:'states'" in js
assert "id:'state-selected',type:'line',source:'states'" in js
assert not re.search(r"id:'[^']*(?:vertex|vertices|border-dot)[^']*'",js,re.I)
for element in ('go-pr','toggle-counties','toggle-metros','go-ak','go-hi'):
 assert f'id="{element}"' in html,element
print(f"PASS: {len(states)} state-level entities, {county_count} counties, {place_count} places, {len(metros)} metro/micro areas, {len(cs)} major cities. IDs and CSS anchoring verified.")
print('PASS: state boundary layers line-only; local place circles start at zoom 9.1; county policy and buttons present.')
