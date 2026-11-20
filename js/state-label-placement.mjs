import {overlaps} from './city-layout.mjs';

function bounds(ring){
  return ring.reduce((b,[x,y])=>[
    Math.min(x,b[0]),Math.min(y,b[1]),Math.max(x,b[2]),Math.max(y,b[3])
  ],[Infinity,Infinity,-Infinity,-Infinity]);
}

export function prepareStateShapes(geometry){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  return polygons.map(rings=>({rings:rings.map(indexRing),bounds:bounds(rings[0])})).sort((a,b)=>area(b.bounds)-area(a.bounds));
}

const area=([w,s,e,n])=>(e-w)*(n-s);

function indexRing(ring){
  const [west,south,east,north]=bounds(ring);
  const bucketCount=Math.max(1,Math.min(96,Math.ceil(ring.length/65)));
  const buckets=Array.from({length:bucketCount},()=>[]);
  const horizontal=[];
  const bucket=y=>Math.min(bucketCount-1,Math.floor((y-south)/(north-south)*bucketCount));
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if(ay===by){horizontal.push({y:ay,left:Math.min(ax,bx),right:Math.max(ax,bx)});continue;}
    const lower=Math.min(ay,by),upper=Math.max(ay,by);
    const edge={ax,ay,lower,upper,slope:(bx-ax)/(by-ay)};
    for(let row=bucket(lower);row<=bucket(upper);row++)buckets[row].push(edge);
  }
  return {west,south,east,north,buckets,bucket,horizontal};
}

function containsPoint(ring,x,y){
  if(x<ring.west||x>ring.east||y<ring.south||y>=ring.north)return false;
  let inside=false;
  for(const edge of ring.buckets[ring.bucket(y)]){
    if(y>=edge.lower&&y<edge.upper&&x<edge.ax+(y-edge.ay)*edge.slope)inside=!inside;
  }
  return inside;
}

export const badgeBox=({x,y},size,plain=false)=>{
  // Retain the usual state spacing. Small states can fit just the letters,
  // with enough clearance for their 15% hover growth.
  const halfWidth=plain?1+size*1.86*.575:(size*1.52+8)*.575;
  const halfHeight=plain?1+size*1.1*.575:(size*1.2+6)*.575;
  return {x0:x-halfWidth,x1:x+halfWidth,y0:y-halfHeight,y1:y+halfHeight};
};

export function compactBadgeBox({x,y},size){
  const w=1+size*.84,h=1+size*.64;
  return {x0:x-w,y0:y-h,x1:x+w,y1:y+h};
}

function geographicBox(map,point,size,rotated=false,plain=true){
  const {x0,y0,x1,y1}=badgeBox(point,size,plain);
  if(rotated){
    // At a bearing, opposite screen corners no longer describe a geographic
    // rectangle. Enclose all four as a conservative fit test.
    const projected=[[x0,y0],[x0,y1],[x1,y0],[x1,y1]].map(corner=>map.unproject(corner));
    const w=Math.min(...projected.map(p=>p.lng)),e=Math.max(...projected.map(p=>p.lng));
    const s=Math.min(...projected.map(p=>p.lat)),n=Math.max(...projected.map(p=>p.lat));
    return {w,s,e,n,corners:[[w,s],[e,s],[w,n],[e,n]]};
  }
  const [w,s]=map.unproject([x0,y1]).toArray(),[e,n]=map.unproject([x1,y0]).toArray();
  return {w,s,e,n,corners:[[w,s],[e,s],[w,n],[e,n]]};
}

function ringTouchesBox(ring,{w,s,e,n}){
  if(e<ring.west||w>ring.east||n<ring.south||s>ring.north)return false;
  if(ring.horizontal.some(line=>line.y>=s&&line.y<=n&&line.right>=w&&line.left<=e))return true;
  if(ring.north===ring.south)return false;
  const start=ring.bucket(Math.max(s,ring.south)),end=ring.bucket(Math.min(n,ring.north));
  for(let row=start;row<=end;row++)for(const edge of ring.buckets[row]){
    const lower=Math.max(s,edge.lower),upper=Math.min(n,edge.upper);
    if(lower>upper)continue;
    const x0=edge.ax+(lower-edge.ay)*edge.slope,x1=edge.ax+(upper-edge.ay)*edge.slope;
    if(Math.max(x0,x1)>=w&&Math.min(x0,x1)<=e)return true;
  }
  return false;
}

function landContains({rings:[outer,...holes]},[x,y]){
  return containsPoint(outer,x,y)&&!holes.some(ring=>containsPoint(ring,x,y));
}

export function shapeContainsPoint(polygons,point){
  return polygons.some(polygon=>landContains(polygon,point));
}

export function badgeFitsInState(map,polygons,point,size,rotated=false,plain=true){
  const box=geographicBox(map,point,size,rotated,plain);
  return polygons.some(p=>box.corners.every(corner=>landContains(p,corner))&&
    !p.rings.some(ring=>ringTouchesBox(ring,box)));
}

export function badgeTouchesLand(map,polygons,point,size,rotated=false){
  const box=geographicBox(map,point,size,rotated);
  return polygons.some(p=>box.corners.some(corner=>landContains(p,corner))||
    p.rings.some(ring=>ringTouchesBox(ring,box)));
}

export function projectStateShapes(map,polygons,viewBounds,viewport){
  const visible=[];
  for(const polygon of polygons){
    const [w,s,e,n]=polygon.bounds;
    if(w>viewBounds.east||e<viewBounds.west||s>viewBounds.north||n<viewBounds.south)continue;
    const sw=map.project([w,s]),ne=map.project([e,n]);
    const rect={x0:Math.max(viewport.x0,sw.x),y0:Math.max(viewport.y0,ne.y),
      x1:Math.min(viewport.x1,ne.x),y1:Math.min(viewport.y1,sw.y)};
    visible.push({polygon,rect});
  }
  return visible;
}

export function fitStateLabel(map,projected,anchor,size,viewport,obstacles,{compact=false,centerOnly=false}={}){
  const boxFor=point=>compact?compactBadgeBox(point,size):badgeBox(point,size);
  const {x1:halfWidth,y1:halfHeight}=boxFor({x:0,y:0});
  const landHalfWidth=centerOnly?2:halfWidth;
  const landHalfHeight=centerOnly?2:halfHeight;
  const gap=compact?1:2;
  const visible=projected.filter(({rect})=>rect.x1-rect.x0>=2*landHalfWidth&&rect.y1-rect.y0>=2*landHalfHeight);
  if(!visible.length)return null;
  const fits=point=>{
    const box=boxFor(point);
    if(box.x0<viewport.x0||box.x1>viewport.x1||box.y0<viewport.y0||box.y1>viewport.y1||
      obstacles.some(other=>overlaps(box,other,gap)))return false;
    for(const {polygon,rect} of visible){
      if(centerOnly){
        if(point.x>=rect.x0&&point.x<=rect.x1&&point.y>=rect.y0&&point.y<=rect.y1&&
          landContains(polygon,map.unproject(point).toArray()))return true;
        continue;
      }
      if(box.x0<rect.x0||box.x1>rect.x1||box.y0<rect.y0||box.y1>rect.y1)continue;
      const [w,s]=map.unproject([box.x0,box.y1]).toArray();
      const [e,n]=map.unproject([box.x1,box.y0]).toArray();
      const [outer,...holes]=polygon.rings;
      const centerX=(w+e)/2,centerY=(s+n)/2;
      const samples=[[w,s],[e,s],[w,n],[e,n],[centerX,s],[centerX,n],[w,centerY],[e,centerY],[centerX,centerY]];
      if(samples.every(([x,y])=>containsPoint(outer,x,y)&&!holes.some(ring=>containsPoint(ring,x,y))))return true;
    }
    return false;
  };
  // Keep the usual anchor whenever possible. Only search the visible part of
  // the state if that anchor no longer has room on screen.
  const offsets=centerOnly?[[0,0],[0,-5],[0,5],[-5,0],[5,0],[0,-10],[0,10],[-10,0],[10,0],[-7,-7],[7,-7],[-7,7],[7,7]]:
    [[0,0],[0,-20],[0,20],[-22,0],[22,0],[-18,-18],[18,-18],[-18,18],[18,18],
      [0,-11],[0,11],[-12,0],[12,0],[-8,-8],[8,-8],[-8,8],[8,8]];
  for(const [x,y] of offsets){
    const point={x:anchor.x+x,y:anchor.y+y};if(fits(point))return point;
  }
  for(const {rect} of visible.slice(0,6)){
    const left=rect.x0+landHalfWidth,top=rect.y0+landHalfHeight,right=rect.x1-landHalfWidth,bottom=rect.y1-landHalfHeight;
    if(right<left||bottom<top)continue;
    const limit=(v,lo,hi)=>Math.max(lo,Math.min(v,hi));
    const clamped={x:limit(anchor.x,left,right),y:limit(anchor.y,top,bottom)};
    if(fits(clamped))return clamped;
    const grid=[];
    const steps=[.5,.3,.7,.14,.86,.4,.6,.02,.98];
    for(const v of steps)for(const u of steps)grid.push({x:left+(right-left)*u,y:top+(bottom-top)*v});
    // Prefer the part of the visible state closest to the usual anchor. A
    // blocked corner should not throw the badge over the town at map center.
    const distance=point=>(point.x-anchor.x)**2+(point.y-anchor.y)**2;
    const anchorOffscreen=anchor.x<viewport.x0||anchor.x>viewport.x1||anchor.y<viewport.y0||anchor.y>viewport.y1;
    if(anchorOffscreen||centerOnly)grid.sort((a,b)=>distance(a)-distance(b));
    const point=grid.find(fits);
    if(point)return point;
  }
  return null;
}
