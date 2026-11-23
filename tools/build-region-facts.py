#!/usr/bin/env python3
"""Build map label anchors and Vintage 2025 CBSA facts from Census inputs."""
import argparse
import csv
import hashlib
import json
import struct
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


def cbsa_area(archive):
    with ZipFile(archive) as source:
        dbf = source.read(next(name for name in source.namelist() if name.endswith('.dbf')))
    count, header_size, row_size = struct.unpack_from('<IHH', dbf, 4)
    offset = 1
    fields = {}
    for start in range(32, header_size - 1, 32):
        name = dbf[start:start + 11].split(b'\0', 1)[0].decode('ascii')
        length = dbf[start + 16]
        fields[name] = slice(offset, offset + length)
        offset += length
    for index in range(count):
        start = header_size + index * row_size
        row = dbf[start:start + row_size]
        if row.startswith(b'*'):
            continue
        geoid = row[fields['GEOID']].decode('ascii').strip()
        yield geoid, int(row[fields['ALAND']]), int(row[fields['AWATER']])


def metro_estimates(path, encoding, totals, counties):
    with path.open(encoding=encoding, newline='') as source:
        for row in csv.DictReader(source):
            geoid = row['CBSA'].zfill(5)
            if row['LSAD'] in ('Metropolitan Statistical Area', 'Micropolitan Statistical Area'):
                totals[geoid] = int(row['POPESTIMATE2025'])
            elif row['LSAD'] == 'County or equivalent':
                name, state = row['NAME'].rsplit(', ', 1)
                counties[geoid][row['STCOU'].zfill(5)] = (name, state)


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def fingerprint(path, url):
    data = path.read_bytes()
    return {'file': path.name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cbsa_archive', type=Path)
    parser.add_argument('us_population', type=Path)
    parser.add_argument('pr_population', type=Path)
    args = parser.parse_args()
    data = Path(__file__).resolve().parents[1] / 'data'
    manifest = json.loads((data / 'manifest.json').read_text(encoding='utf-8'))
    geometry_source = manifest['source_archives']['cbsa']
    boundary = fingerprint(args.cbsa_archive, geometry_source['url'])
    if boundary['sha256'] != geometry_source['sha256']:
        raise ValueError('CBSA areas must come from the archive used for the Atlas boundaries.')
    totals, counties = {}, defaultdict(dict)
    metro_estimates(args.us_population, 'cp1252', totals, counties)
    metro_estimates(args.pr_population, 'utf-8-sig', totals, counties)
    areas = {geoid: (land, water) for geoid, land, water in cbsa_area(args.cbsa_archive)}
    geometry = json.loads((data / 'metros.geojson').read_text(encoding='utf-8'))
    geoids = sorted(feature['properties']['geoid'] for feature in geometry['features'])
    county_facts = json.loads((data / 'basic_facts.json').read_text(encoding='utf-8'))['counties']
    if set(geoids) != counties.keys() or {county for members in counties.values() for county in members} - county_facts.keys():
        raise ValueError('County membership must match the bundled CBSAs and county records.')
    square_meters_per_square_mile = 1609.344 ** 2
    records = {key: {
        'population': totals[key],
        'population_date': '2025-07-01',
        'land_sq_mi': round(areas[key][0] / square_meters_per_square_mile, 6),
        'water_sq_mi': round(areas[key][1] / square_meters_per_square_mile, 6),
        'area_year': 2025,
        'counties': {county: name for county, (name, state) in
                     sorted(counties[key].items(), key=lambda item: (item[1][1], item[1][0]))},
    } for key in geoids}
    population_base = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/metro/totals/'
    write_json(data / 'metro_facts.json', {
        'sources': [boundary,
                    fingerprint(args.us_population, population_base + 'cbsa-est2025-alldata.csv'),
                    fingerprint(args.pr_population, population_base + 'prc-cbsa-est2025.csv')],
        'records': records,
    })
    search = json.loads((data / 'search_index.json').read_text(encoding='utf-8'))
    anchors = {item['id']: item['p'] for item in search if item['k'] == 'county'}
    if len(anchors) != manifest['counts']['counties_equivalents']:
        raise ValueError('County anchors must cover all bundled counties.')
    write_json(data / 'county_anchors.json', anchors)
    print(f'Wrote {len(records)} CBSA facts and {len(anchors)} county anchors.')


if __name__ == '__main__':
    main()
