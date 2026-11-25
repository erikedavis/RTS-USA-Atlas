import {populationRadius,populationTier} from './city-symbols.mjs';

// Screen-space decluttering: importance ranks candidates; available space admits them.
export const HOVER_GRACE_MS=500;
export const LANDMARK_IDS=new Set(['0644000','3240000','2507000','4260000','1245000','1150000']);
const HAWAII_ISLAND_HUBS=new Set(['1571550','1522700','1514650']); // Honolulu, Kahului, Hilo
export const isMetroScale=zoom=>zoom>=7.55&&zoom<9.15;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const mix=(a,b,t)=>a+(b-a)*t;
export function requiredCityLabel(p,{national,zoom,selectedId}){
  const majorAtScale=national?p.national_rank<=20:p.population>=500000;
  return p.geoid===selectedId||majorAtScale||LANDMARK_IDS.has(p.geoid)||
    (zoom>=5.8&&HAWAII_ISLAND_HUBS.has(p.geoid));
}

export function cityMarkerBox({x,y,style,feature}){
  const radius=style.radius+1;
  const asterisk=feature.properties.is_capital?7:0;
  return {x0:x-radius,x1:x+radius+asterisk,y0:y-radius,y1:y+radius,marker:feature.properties.geoid};
}

export function appearance(p,zoom,crowding=0){
  const population=Math.max(100,p.population||0);
  const major=p.national_rank<=20||LANDMARK_IDS.has(p.geoid);
  // Keep the national type near the V0.2F size.
  const normalSize=zoom<=6 ? mix(8.8,10.3,clamp((zoom-3.3)/2.7,0,1))
    : mix(10.3,11,clamp((zoom-6)/3,0,1));
  const cityScale=clamp((Math.log10(population)-5.45)/.6,0,1);
  const emphasis=crowding*clamp((zoom-4.8)/1.1,0,1);
  const zoomProgress=clamp((zoom-6.4)/3.6,0,1);
  // In crowded views both sizes ease down as the user zooms in, more slowly
  // for the hub. Sparse views use the ordinary size regardless of population.
  const crowdedSize=mix(10.55-1.35*zoomProgress,12.45-.65*zoomProgress,cityScale);
  const tier=populationTier(population);
  const regionalLeader=(p.is_capital||p.is_largest)&&population>=150000;
  const leaderEmphasis=regionalLeader?clamp((zoom-4.4)/1.25,0,1)*(1-clamp((zoom-7.2)/1.8,0,1)):0;
  const tierStep=.004+.046*clamp((zoom-4.2)/6,0,1);
  const baseSize=Math.max(mix(normalSize,crowdedSize,emphasis),normalSize+1.25*leaderEmphasis);
  const labelSize=Math.min(14.3,baseSize*(1+tier*tierStep));
  return {radius:populationRadius(tier,zoom),tier,labelSize,major,
    weight:(emphasis>=.4&&cityScale>=.45)||leaderEmphasis>=.65?'Noto Sans Bold':'Noto Sans Regular',
    opacity:zoom<=4.4?.95:mix(population>=100000?.93:.80,mix(.66,1,cityScale),emphasis)};
}

// Compare cities against nearby population centers in screen pixels. A crowded
// corner of the map should not change the type of a sparse place across the view.
function populationNeighbors(projected){
  const cellSize=140,cells=new Map();
  const key=(x,y)=>`${x},${y}`;
  for(const item of projected){
    if(item.feature.properties.population<50000)continue;
    const cell=key(Math.floor(item.x/cellSize),Math.floor(item.y/cellSize));
    if(!cells.has(cell))cells.set(cell,[]);
    cells.get(cell).push(item);
  }
  return (item,zoom)=>{
    let density=0,nearLargeCity=false;
    const x=Math.floor(item.x/cellSize),y=Math.floor(item.y/cellSize);
    const secondaryRadius=mix(140,0,clamp((zoom-6.3)/1.2,0,1));
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const neighbor of cells.get(key(x+dx,y+dy))||[]){
        if(neighbor===item)continue;
        const distance=Math.hypot(item.x-neighbor.x,item.y-neighbor.y);
        density+=clamp((125-distance)/50,0,1);
        if(distance<secondaryRadius&&neighbor.feature.properties.population>=100000)nearLargeCity=true;
      }
    }
    return {crowding:clamp((density-4)/6,0,1),nearLargeCity};
  };
}
export function importance(p,state,previous=false){
  return 10*Math.log10(Math.max(100,p.population||0))+(p.is_capital?7:0)+(p.is_important?4:0)+
    (p.is_largest?3:0)+(LANDMARK_IDS.has(p.geoid)?6:0)+
    (p.state_fips===state&&p.is_top8?3:0)+(previous ? .45 : 0);
}
export const overlaps=(a,b,pad=0)=>a.x0<b.x1+pad&&a.x1>b.x0-pad&&a.y0<b.y1+pad&&a.y1>b.y0-pad;
function anchorBox(x,y,width,height,anchor,dx,dy){
  const cx=x+dx,cy=y+dy;
  const x0=anchor.includes('left')?cx:anchor.includes('right')?cx-width:cx-width/2;
  const y0=anchor.includes('top')?cy:anchor.includes('bottom')?cy-height:cy-height/2;
  return {x0,y0,x1:x0+width,y1:y0+height};
}
export function placeLabel(item,{width,height,reserved,measure,previous,force=false,scale=1}){
  const {x,y,style}=item,size=style.labelSize*scale;
  const textWidth=measure(item.feature.properties.name,size,style.weight)*1.05+3,textHeight=size*1.19;
  const gap=style.radius+3.2;
  const rightGap=gap+(item.feature.properties.is_capital?7:0);
  const choices=[['left',rightGap,0],['right',-gap,0],['bottom',0,-gap],['top',0,gap],
    ['bottom-left',gap,-gap],['bottom-right',-gap,-gap],['top-left',gap,gap],['top-right',-gap,gap],
    ['left',rightGap,-5],['left',rightGap,5],['right',-gap,-5],['right',-gap,5]];
  // Slide the lettering parallel to its edge when the centered position is
  // crowded. The marker still sits directly below or above the word.
  for(const extra of [0,4,8]){
    for(const shift of [0,4,-4,8,-8,12,-12,16,-16,20,-20]){
      if(Math.abs(shift)>textWidth/2-5)continue;
      choices.push(['bottom',shift,-gap-extra],['top',shift,gap+extra]);
    }
  }
  // Only the side persists between camera positions. Every candidate stays
  // beside the marker, including protected and hovered names.
  if(previous){const sameSide=choices.find(c=>c[0]===previous.anchor);if(sameSide)choices.unshift(sameSide);}
  let fallback=null,bestConflict=Infinity;
  for(const [anchor,dx,dy]of choices){
    const box=anchorBox(x,y,textWidth,textHeight,anchor,dx,dy);
    if(box.x0<5||box.x1>width-5||box.y0<5||box.y1>height-5)continue;
    const collisions=reserved.filter(other=>overlaps(box,other,other.state?0:2));
    if(collisions.some(other=>!other.city))continue;
    if(!collisions.length)return {anchor,dx,dy,box,size};
    if(collisions.length<bestConflict){fallback={anchor,dx,dy,box,size};bestConflict=collisions.length;}
  }
  return force?fallback:null;
}
export function layoutCities(projected,{width,height,zoom,state,selectedId,national=zoom<4.6,metroOverview=false,phoneViewport=false,stateLabelsFirst=false,reserved=[],previous=new Map(),measure}){
  const nearby=zoom>4.4?populationNeighbors(projected):null;
  const items=projected.filter(i=>i.x>=3&&i.x<=width-3&&i.y>=3&&i.y<=height-3).map(item=>{
    const {crowding=0,nearLargeCity=false}=nearby?.(item,zoom)||{};
    return {...item,style:appearance(item.feature.properties,zoom,crowding),crowding,nearLargeCity};
  });
  const selected=items.find(i=>i.feature.properties.geoid===selectedId);
  if(selected)selected.style={...selected.style,weight:'Noto Sans Bold',opacity:1};
  const sparseMetro=metroOverview&&!items.some(i=>i.feature.properties.population>=100000);
  const metroNameFloor=sparseMetro?50000:100000;
  const priority={national,zoom,selectedId};
  const stateBoxes=stateLabelsFirst?reserved.filter(box=>box.state):[];
  const hitsState=item=>{
    if(!stateBoxes.length)return false;
    const marker=cityMarkerBox(item);
    return stateBoxes.some(box=>overlaps(marker,box));
  };
  for(const i of items){
    const p=i.feature.properties;
    i.required=requiredCityLabel(p,priority);
    i.metroName=metroOverview&&p.population>=metroNameFloor;
    const nationalLeader=national&&p.national_rank===1;
    i.score=importance(p,state,previous.has(p.geoid))+(i.required?1000:0)+(i.metroName||nationalLeader?100:0)+(p.geoid===selectedId?10000:0);
  }
  items.sort((a,b)=>b.score-a.score||a.feature.properties.geoid.localeCompare(b.feature.properties.geoid));
  const cellWidth=clamp(240-(zoom-3)*13,110,240),cellHeight=cellWidth*.7,localWinners=new Set(),cells=new Set();
  for(const i of items){const key=Math.floor(i.worldX/cellWidth)+','+Math.floor(i.worldY/cellHeight);if(!cells.has(key)){cells.add(key);localWinners.add(i.feature.properties.geoid);}}
  const townDetail=zoom>=9.15;
  const regionalFloor=mix(49000,20000,clamp((zoom-5)/2.55,0,1));
  const baseFloor=metroOverview?1800:townDetail?Math.max(0,4500-(zoom-9.15)*11000):regionalFloor;
  // A taller phone canvas shows more ground above and below a local view.
  // Keep population eligibility tied to its narrower geographic span.
  const detailHeight=phoneViewport?Math.min(height,width*1.2):height;
  const diagonal=Math.hypot(width,detailHeight);
  // A smaller viewport covers less ground at the same reported zoom. In a
  // focused view, or a close rural view without a large hub, try towns too.
  const detailZoom=zoom+Math.log2(900/diagonal);
  const localCoverage=!national&&zoom>=6.9&&(
    (diagonal<=900&&detailZoom>=7.35)||
    (zoom>=7.15&&!items.some(i=>i.feature.properties.population>=50000))
  );
  const localProgress=clamp((Math.max(zoom,detailZoom)-7.35)/.75,0,1);
  const threshold=localCoverage?Math.min(baseFloor,mix(8500,1800,localProgress)):baseFloor;
  const baseGap=metroOverview?35:clamp(68-(zoom-4)*5.1,16,65);
  const dotGap=localCoverage?Math.min(baseGap,mix(10,6,localProgress)):baseGap;
  const budget=Math.max(18,Math.floor(width*height/(metroOverview?13500:townDetail?8500:15500)));
  const admitted=[],occupied=[...reserved,...items.filter(i=>i.required&&!hitsState(i)).map(cityMarkerBox)],placements=new Map();
  const metroLabelBudget=sparseMetro?1:clamp(Math.floor(width*height/145000),1,8);
  const metroNameGap=clamp(Math.min(width,height)*.135,78,116);
  let visibleCount=0,metroLabels=0;
  const labelObstaclesFor=({feature:{properties:p}})=>
    occupied.filter(r=>r.marker!==p.geoid);
  function addLabel(item,labelObstacles){
    const id=item.feature.properties.geoid;
    const options={width,height,reserved:labelObstacles,measure,previous:previous.get(id)};
    let placement=placeLabel(item,options);
    if(!placement&&item.required)placement=placeLabel(item,{...options,scale:.9,force:id===selectedId});
    if(!placement)return;
    item.placement=placement;
    occupied.push({...placement.box,city:id});
    placements.set(id,placement);
    if(metroOverview)metroLabels++;
  }
  for(const i of items){
    const p=i.feature.properties,id=p.geoid;
    const stateLeader=p.state_fips===state&&(p.is_largest||p.is_capital);
    const localPlace=townDetail&&localWinners.has(id);
    if(!(i.required||p.population>=threshold||p.is_capital||stateLeader||localPlace))continue;
    if(hitsState(i))continue;
    if(!localCoverage&&!i.required&&!p.is_capital&&p.population<100000&&i.nearLargeCity)continue;
    const labelObstacles=labelObstaclesFor(i);
    if(!i.required){
      if(visibleCount>=budget)continue;
      const markerGap=i.metroName?Math.min(22,dotGap):dotGap;
      if(admitted.some(other=>Math.hypot(i.x-other.x,i.y-other.y)<markerGap+other.style.radius+i.style.radius))continue;
      if(!localCoverage&&occupied.some(r=>r.city&&overlaps({x0:i.x-4,x1:i.x+4,y0:i.y-4,y1:i.y+4},r,4)))continue;
      if(labelObstacles.some(r=>r.state&&overlaps({x0:i.x-3,x1:i.x+3,y0:i.y-3,y1:i.y+3},r)))continue;
    }
    i.placement=null;
    if(!localCoverage){
      // Leave space between names in crowded and wide metro views.
      const nameGap=mix(65,105,i.crowding);
      const crowdedMinor=!i.required&&p.population<100000&&i.crowding>.4&&
        admitted.some(other=>other.placement&&Math.hypot(i.x-other.x,i.y-other.y)<nameGap);
      const fitsMetroName=i.metroName&&metroLabels<metroLabelBudget&&
        !admitted.some(other=>other.placement&&Math.hypot(i.x-other.x,i.y-other.y)<metroNameGap);
      if(i.required||(!national&&!metroOverview&&!crowdedMinor)||fitsMetroName)addLabel(i,labelObstacles);
    }
    admitted.push(i);visibleCount++;
    if(!i.required)occupied.push(cityMarkerBox(i));
  }
  // In focused views, give every admitted place a marker before assigning names.
  if(localCoverage)for(const i of admitted)addLabel(i,labelObstaclesFor(i));
  // A lone town must never end up as an anonymous dot.
  if(!metroOverview&&admitted.length===1&&!admitted[0].placement){
    const place=admitted[0];
    place.placement=placeLabel(place,{width,height,reserved,measure,force:true});
    if(admitted[0].placement)placements.set(admitted[0].feature.properties.geoid,admitted[0].placement);
  }
  return {items:admitted,placements,metrics:{candidates:items.length,dots:admitted.length,labels:placements.size,threshold,dotGap,budget}};
}

