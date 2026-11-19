// Display-only Mercator transforms. Source Census files and identifiers stay intact.
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
const latitude = y => (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI;
export const INSETS = [
  {abbr:'AK', name:'ALASKA', from:[-154,64], to:[-138,38], scale:.36, box:[[-151,30],[-127,45.5]]},
  {abbr:'HI', name:'HAWAII', from:[-157.5,20.8], to:[-131,24.4], scale:.65, box:[[-147,21.8],[-127,29.8]]},
  {abbr:'PR', name:'PUERTO RICO', from:[-66.5,18.2], to:[-88.5,25.5], scale:1.6, box:[[-93,23],[-84,28]]}
];
export const NATIONAL_BOUNDS = [[-152,20],[-66,51]];
function region([lng,lat]) {
  if(lat>50 && (lng < -129 || lng>170))return INSETS[0];
  if(lat>18 && lat<30 && lng<-154)return INSETS[1];
  if(lat>17 && lat<19.5 && lng>-68.5 && lng<-65.2)return INSETS[2];
  return null;
}
export function displayPoint(point,abbr) {
  const inset=abbr===undefined?region(point):INSETS.find(i=>i.abbr===abbr);
  if(!inset)return point;
  let [lng,lat]=point;
  if(inset.abbr==='AK' && lng>0)lng-=360;
  return [inset.to[0]+(lng-inset.from[0])*inset.scale,
    latitude(mercY(inset.to[1])+(mercY(lat)-mercY(inset.from[1]))*inset.scale)];
}
export function geographicPoint(point) {
  const inset=INSETS.find(({box})=>point[0]>=box[0][0] && point[0]<=box[1][0] && point[1]>=box[0][1] && point[1]<=box[1][1]);
  if(!inset)return {point,abbr:''};
  let lng=inset.from[0]+(point[0]-inset.to[0])/inset.scale;
  if(lng < -180)lng+=360;
  return {point:[lng,latitude(mercY(inset.from[1])+(mercY(point[1])-mercY(inset.to[1]))/inset.scale)],abbr:inset.abbr};
}
export function displayData(data) {
  if(data.type!=='FeatureCollection')return data;
  return {...data,features:data.features.map(f=>{
    const p=f.properties||{};
    // Choose the transform once per feature, never separately for each vertex.
    // Puerto Rico's neighboring Virgin Islands must retain their own geometry.
    const abbr=p.abbr||p.state_abbr||({ '02':'AK','15':'HI','72':'PR' }[p.state_fips])||
      (p.kind==='metro' ? (p.name.match(/, (AK|HI|PR)$/)?.[1]||'') : '');
    function coordinates(c) {return typeof c[0]==='number'?displayPoint(c,abbr):c.map(coordinates);}
    return {...f,geometry:f.geometry?{...f.geometry,coordinates:coordinates(f.geometry.coordinates)}:null};
  })};
}
export const insetFrames = {type:'FeatureCollection',features:INSETS.map(i=>{
  const [[w,s],[e,n]]=i.box;
  return {type:'Feature',properties:{abbr:i.abbr},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}};
})};
