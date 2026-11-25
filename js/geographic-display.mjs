export const CONUS_BOUNDS = [[-125.4,22.5],[-66.7,49.4]];
export const MAIN_HAWAII_BOUNDS = [[-160.545,18.9104],[-154.8068,22.2326]];

export function allNationalBounds(islandBounds) {
  const boxes=[CONUS_BOUNDS,...islandBounds];
  return [
    [Math.min(...boxes.map(box=>box[0][0])),Math.min(...boxes.map(box=>box[0][1]))],
    [Math.max(...boxes.map(box=>box[1][0])),Math.max(...boxes.map(box=>box[1][1]))],
  ];
}

export function displayPoint(point,abbr) {
  // Keep the dateline islands adjacent to mainland Alaska in the Pacific view.
  return abbr==='AK'&&point[0]>0?[point[0]-360,point[1]]:point;
}

export function geographicPoint([lng,lat]) {
  return [lng<-180||lng>180?((lng%360+540)%360)-180:lng,lat];
}

export function hawaiiTailMarks(geometry) {
  // Keep tiny islands visible at overview scale using their actual positions.
  const features=geometry.coordinates.map(polygon=>polygon[0][0])
    .filter(([lng])=>lng<-161)
    .map(coordinates=>({type:'Feature',properties:{kind:'island'},geometry:{type:'Point',coordinates}}));
  features.push({type:'Feature',properties:{kind:'label',name:'NW ISLANDS'},geometry:{type:'Point',coordinates:[-171.3,26.8]}});
  return {type:'FeatureCollection',features};
}

export function displayData(data) {
  if(data.type!=='FeatureCollection')return data;
  function unwrap(coordinates) {
    return typeof coordinates[0]==='number'?displayPoint(coordinates,'AK'):coordinates.map(unwrap);
  }
  return {...data,features:data.features.map(feature=>{
    const p=feature.properties||{};
    const abbr=p.abbr||p.state_abbr||(p.state_fips==='02'?'AK':'');
    const alaska=abbr==='AK'||(!abbr&&p.kind==='metro'&&p.name?.endsWith(', AK'));
    if(!alaska||!feature.geometry)return feature;
    return {...feature,geometry:{...feature.geometry,coordinates:unwrap(feature.geometry.coordinates)}};
  })};
}
