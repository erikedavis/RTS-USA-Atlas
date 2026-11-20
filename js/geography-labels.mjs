// The anchors and angles are fixed in map coordinates. Stable IDs leave room
// to attach geography records later. These layers are labels only for now.
const geography=[
  {id:'lake-superior',kind:'lake',name:'Lake Superior',point:[-88.55,47.66],angle:-5},
  {id:'lake-michigan',kind:'lake',name:'Lake Michigan',point:[-86.78,44.04],angle:-80},
  {id:'lake-huron',kind:'lake',name:'Lake Huron',point:[-82.66,44.60],angle:-50},
  {id:'lake-erie',kind:'lake',name:'Lake Erie',point:[-81.55,42.20],angle:-19},
  {id:'lake-ontario',kind:'lake',name:'Lake Ontario',point:[-77.98,43.66],angle:-8},
  {id:'michigan-upper-peninsula',kind:'peninsula',name:'Upper Peninsula',point:[-86.55,46.29],angle:-6},
  {id:'long-island',kind:'island',name:'Long Island',point:[-72.52,40.879],angle:-17}
];

export function addGeographyLabels(map){
  map.addSource('geographic-regions',{type:'geojson',data:{type:'FeatureCollection',features:geography.map(
    ({point,...properties})=>({type:'Feature',id:properties.id,properties,geometry:{type:'Point',coordinates:point}}))}});
  const layout={'text-field':['get','name'],'text-transform':'uppercase','text-font':['Noto Sans Regular'],
    'text-rotate':['get','angle'],'text-rotation-alignment':'map','text-pitch-alignment':'map',
    'text-letter-spacing':.16,'text-padding':7,'text-ignore-placement':true,'text-max-width':30};
  for(const region of [
    {kind:'lake',zoom:4.25,fadeIn:5.35,fadeOut:8.55,end:9.65,color:'#98bdd5',opacity:.55,size:11.3},
    {kind:'peninsula',zoom:5.05,fadeIn:5.75,fadeOut:7.8,end:9.35,color:'#a3b8c8',opacity:.49,size:9.6},
    {kind:'island',zoom:6.35,fadeIn:7.25,fadeOut:8.1,end:9.45,color:'#a3b8c8',opacity:.52,size:9.8},
  ]){
    map.addLayer({id:`geography-${region.kind}`,type:'symbol',source:'geographic-regions',
      minzoom:region.zoom,maxzoom:region.end,filter:['==',['get','kind'],region.kind],
      layout:{...layout,'text-size':region.size},paint:{'text-color':region.color,
        'text-halo-color':'#0b121a','text-halo-width':.7,
        'text-opacity':['interpolate',['linear'],['zoom'],region.zoom,0,region.fadeIn,region.opacity,region.fadeOut,region.opacity,region.end,0]}});
  }
}
