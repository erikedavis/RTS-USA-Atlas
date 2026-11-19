#!/usr/bin/env python3
"""Build USA Atlas v0.1B data from four user-provided 2025 Census 500k shapefile archives.
Preserve the archive originals separately. Rendering GeoJSON coordinates are rounded to
6 decimal places; raw precision remains in the original Census ZIP files.

Requires pyshp and shapely for preprocessing; neither is needed to run the website.
"""
from __future__ import annotations
import io, json, zipfile, shutil, hashlib, collections
from pathlib import Path
import shapefile
from shapely.geometry import shape as shapely_shape

ROOT=Path(__file__).resolve().parents[1]
DAT=ROOT/'data'
SRC=ROOT/'source'/'census_2025'
UPLOAD=SRC
INPUT={'state':'cb_2025_us_state_500k.zip','county':'cb_2025_us_county_500k.zip',
       'place':'cb_2025_us_place_500k.zip','cbsa':'cb_2025_us_cbsa_500k.zip'}
STATE_ABBR={}
STATE_NAME={}


def read_zip(kind):
    file=UPLOAD/INPUT[kind]
    z=zipfile.ZipFile(file)
    names=z.namelist()
    def by_ext(ext):
        return io.BytesIO(z.read(next(n for n in names if n.endswith(ext))))
    r=shapefile.Reader(shp=by_ext('.shp'),shx=by_ext('.shx'),dbf=by_ext('.dbf'),encoding='utf-8')
    for item in r.iterShapeRecords():
        attrs=item.record.as_dict()
        geo=item.shape.__geo_interface__
        yield attrs,geo
    z.close()


def limited(obj):
    if isinstance(obj,float):return round(obj,6)
    if isinstance(obj,(tuple,list)):return [limited(x) for x in obj]
    if isinstance(obj,dict):return {k:limited(v) for k,v in obj.items()}
    return obj


def file_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8') as f:json.dump(obj,f,separators=(',',':'),ensure_ascii=False)

def features_json(path,fs):
    file_json(path,{'type':'FeatureCollection','features':fs})
    print('generated',str(path.relative_to(ROOT)),len(fs),round(path.stat().st_size/1024/1024,2),'MiB')


def get_point(geo):
    """Point guaranteed inside polygon when feasible; bbox fallback only on failure."""
    try:
        pt=shapely_shape(geo).representative_point()
        return [round(pt.x,6),round(pt.y,6)]
    except Exception:
        coords=[]
        def walk(obj):
            if isinstance(obj,(list,tuple)) and len(obj)>=2 and isinstance(obj[0],(int,float)):
                coords.append(obj[:2]);return
            for x in obj:walk(x)
        walk(geo['coordinates'])
        if coords:
            return [round(sum(c[0] for c in coords)/len(coords),6),round(sum(c[1] for c in coords)/len(coords),6)]
        return [0,0]


def props(attrs,kind):
    data={'kind':kind,'name':attrs.get('NAME',''),'geoid':attrs.get('GEOID','')}
    if attrs.get('NAMELSAD'):
        data['official_name']=attrs['NAMELSAD']
    if kind=='state':
        data['abbr']=attrs.get('STUSPS','')
    if kind in ('county','place'):
        data['state_fips']=attrs.get('STATEFP','')
        data['state_abbr']=attrs.get('STUSPS','')
    if kind=='metro':
        data['class']='metro' if attrs.get('LSAD')=='M1' else 'micro'
    return data


def makefeat(attrs,geo,kind):
    return {'type':'Feature','properties':props(attrs,kind),'geometry':limited(geo)}


def main():
    DAT.mkdir(parents=True,exist_ok=True)
    SRC.mkdir(parents=True,exist_ok=True)
    fingerprints={}
    for kind,filename in INPUT.items():
        original=UPLOAD/filename
        if not original.exists():raise SystemExit('Missing '+filename)
        with zipfile.ZipFile(original) as z:
            assert all(z.testzip() is None for _ in [0]),filename
            assert all(any(s.endswith(x) for s in z.namelist()) for x in ['.shp','.shx','.dbf','.prj']),filename
        # Source ZIP is already stored in this local archive. Never modify originals.
        sha=hashlib.sha256(original.read_bytes()).hexdigest()
        fingerprints[kind]={'filename':filename,'bytes':original.stat().st_size,'sha256':sha,
                            'url':'https://www2.census.gov/geo/tiger/GENZ2025/shp/'+filename}
    labels=[];states=[];state_search=[]
    for attr,geo in read_zip('state'):
        f=makefeat(attr,geo,'state');states.append(f)
        fid=attr['GEOID']
        STATE_ABBR[fid]=attr['STUSPS'];STATE_NAME[fid]=attr['NAME']
        point=get_point(geo)
        labels.append({'name':attr['NAME'],'abbr':attr['STUSPS'],'geoid':fid,'coordinates':point})
        state_search.append({'k':'state','n':attr['NAME'],'id':fid,'a':attr['STUSPS'],'p':point})
    features_json(DAT/'states.geojson',states)
    file_json(DAT/'state_labels.json',labels)

    counties=collections.defaultdict(list); county_search=[]
    for attr,geo in read_zip('county'):
        f=makefeat(attr,geo,'county')
        fips=f['properties']['state_fips']
        counties[fips].append(f)
        county_search.append({'k':'county','n':attr['NAME'],'id':attr['GEOID'],
                              's':STATE_ABBR.get(fips,''),'f':fips,'p':get_point(geo)})
    for fips,items in sorted(counties.items()):
        features_json(DAT/'counties'/f'{fips}.geojson',items)

    places=collections.defaultdict(list);points=collections.defaultdict(list);place_search=[]
    for attr,geo in read_zip('place'):
        f=makefeat(attr,geo,'place')
        fips=f['properties']['state_fips']
        places[fips].append(f)
        pt=get_point(geo)
        pts={'type':'Feature','properties':f['properties'],'geometry':{'type':'Point','coordinates':pt}}
        points[fips].append(pts)
        place_search.append({'k':'place','n':attr['NAME'],'id':attr['GEOID'],
                             's':STATE_ABBR.get(fips,''),'f':fips,'p':pt,
                             'd':attr.get('NAMELSAD','')})
    for fips,items in sorted(places.items()):
        features_json(DAT/'places'/f'{fips}_shapes.geojson',items)
        features_json(DAT/'places'/f'{fips}_points.geojson',points[fips])

    metros=[]; metro_search=[]
    for attr,geo in read_zip('cbsa'):
        f=makefeat(attr,geo,'metro');metros.append(f)
        metro_search.append({'k':'metro','n':attr['NAME'],'id':attr['GEOID'],
                             'p':get_point(geo),'c':f['properties']['class']})
    features_json(DAT/'metros.geojson',metros)
    # Link the curated national city symbols to official place GEOIDs, not just names.
    # Keep the display anchor/label, since it often represents the city center better
    # than the representative point for its municipal boundary.
    major_file=DAT/'major_cities.geojson'
    if major_file.exists():
        curated=json.loads(major_file.read_text(encoding='utf-8'))
        for city in curated.get('features',[]):
            lng,lat=city['geometry']['coordinates']
            record=min(place_search,key=lambda v:(v['p'][0]-lng)**2+(v['p'][1]-lat)**2)
            if (record['p'][0]-lng)**2+(record['p'][1]-lat)**2 < 1.1**2:
                city['properties'].update({'kind':'place','geoid':record['id'],
                    'state_abbr':record['s'],'state_fips':record['f'],
                    'official_name':record.get('d',record['n'])})
        file_json(major_file,curated)
    search=state_search+county_search+place_search+metro_search
    file_json(DAT/'search_index.json',search)
    print('generated search_index.json',len(search),round((DAT/'search_index.json').stat().st_size/1024/1024,2),'MiB')

    counts={'states_equivalents':len(states),'counties_equivalents':len(county_search),
            'places_including_cdps':len(place_search),'metro_micro_areas':len(metros)}
    summary={'project':'USA Atlas','version':'0.1B','source':'United States Census Bureau',
             'dataset':'2025 Cartographic Boundary Files, 1:500,000',
             'vintage':'2025','status':'official-source',
             'format_note':'Rendering GeoJSON has rounded coordinates (6 decimal places); exact supplied source archives retained in source/census_2025.',
             'datum':'NAD83 / geographic degrees; browser mapping uses lon/lat coordinates',
             'counts':counts,'source_archives':fingerprints,
             'processing':'Rendering geometry is produced directly from Census shapefiles; no projection shifting or decorative edits. Representative interior points are calculated for labels/search.',
             'coverage':'All supplied Census geographies, including territories, DC, CDPs and micro areas.',
             'display_note':'Initial map camera targets contiguous US. Alaska/Hawaii require navigation buttons; territories are present in data.'}
    file_json(DAT/'manifest.json',summary)
    print('COUNTS',counts)
    print('data size MB',round(sum(p.stat().st_size for p in DAT.rglob('*') if p.is_file())/1e6,2))
    return counts

if __name__=='__main__':main()
