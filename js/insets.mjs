// Display-only Mercator transforms. Source Census files and identifiers stay intact.
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
const latitude = y => (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI;
const middle = ([[west,south],[east,north]])=>[(west+east)/2,latitude((mercY(south)+mercY(north))/2)];
const hawaiiBox=[[-147,21.8],[-127,29.8]];
const mainHawaiiBounds=[[-160.545,18.9104],[-154.8068,22.2326]];
const northwesternHawaii={from:[-170.125,25.75],to:[-144,27.65],scale:.28};
const northwesternLongitude=-161;
const northwesternDisplayLongitude=-141.25;
export const INSETS = [
  {abbr:'AK', name:'ALASKA', from:[-154,64], to:[-138,38], scale:.36, box:[[-151,30],[-127,45.5]]},
  {abbr:'HI', name:'HAWAII', from:middle(mainHawaiiBounds), to:middle(hawaiiBox), scale:1.36,
    box:hawaiiBox, labelPosition:[-137,22.7], focusBounds:mainHawaiiBounds},
  {abbr:'PR', name:'PUERTO RICO', from:[-66.583,18.2], to:[-88.5,25.5], scale:2.75,
    box:[[-93,23],[-84,28]]}
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
  // Compress the distant chain separately so it doesn't push the main
  // islands out of the middle of their frame.
  const {from,to,scale}=inset.abbr==='HI'&&lng<northwesternLongitude?northwesternHawaii:inset;
  return [to[0]+(lng-from[0])*scale,
    latitude(mercY(to[1])+(mercY(lat)-mercY(from[1]))*scale)];
}
export function geographicPoint(point) {
  const inset=INSETS.find(({box})=>point[0]>=box[0][0] && point[0]<=box[1][0] && point[1]>=box[0][1] && point[1]<=box[1][1]);
  if(!inset)return {point,abbr:''};
  const {from,to,scale}=inset.abbr==='HI'&&point[0]<northwesternDisplayLongitude?northwesternHawaii:inset;
  let lng=from[0]+(point[0]-to[0])/scale;
  if(lng < -180)lng+=360;
  return {point:[lng,latitude(mercY(from[1])+(mercY(point[1])-mercY(to[1]))/scale)],abbr:inset.abbr};
}

export function hawaiiTailMarks(geometry){
  // Use actual island boundary positions. Tiny polygons disappear below a
  // pixel at overview scale, so the map gives them a subtle minimum mark.
  const features=geometry.coordinates.map(polygon=>polygon[0][0])
    .filter(([lng])=>lng<northwesternDisplayLongitude)
    .map(coordinates=>({type:'Feature',properties:{kind:'island'},geometry:{type:'Point',coordinates}}));
  features.push({type:'Feature',properties:{kind:'label',name:'NW ISLANDS'},geometry:{type:'Point',coordinates:[-144,26.43]}});
  return {type:'FeatureCollection',features};
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
