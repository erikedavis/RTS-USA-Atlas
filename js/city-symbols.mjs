const tiers=[
  {min:0, label:'Under 50,000', path:'M -8 -8 H 8 V 8 H -8 Z', diameter:4.4},
  {min:50000, label:'50,000–99,999', path:'M -8 -7 H 8 L 0 8.5 Z', diameter:8.4},
  {min:100000, label:'100,000–249,999', path:'M -2.7 -8 H 2.7 V -2.7 H 8 V 2.7 H 2.7 V 8 H -2.7 V 2.7 H -8 V -2.7 H -2.7 Z', diameter:9.1},
  {min:250000, label:'250,000–499,999', path:'M 0 -8.5 L 8 7 H -8 Z', diameter:9.9},
  {min:500000, label:'500,000–999,999', path:'M 0 -8 L 8 0 0 8 -8 0 Z', diameter:10},
  {min:1000000, label:'1,000,000–1,999,999', path:'M 0 -8.4 L 8 -2.6 4.94 6.8 -4.94 6.8 -8 -2.6 Z', diameter:9.975},
  {min:2000000, label:'2,000,000 and up', path:'M 0.0000 -8.0000 L 4.7023 -6.4721 L 7.6085 -2.4721 L 7.6085 2.4721 L 4.7023 6.4721 L 0.0000 8.0000 L -4.7023 6.4721 L -7.6085 2.4721 L -7.6085 -2.4721 L -4.7023 -6.4721 Z', diameter:12.5}
];

export function populationTier(population){
  for(let i=tiers.length-1;i>0;i--){
    if(population>=tiers[i].min)return i;
  }
  return 0;
}

const zoomProgress=(zoom,start,end)=>Math.max(0,Math.min(1,(zoom-start)/(end-start)));
const overviewFade=zoom=>zoomProgress(zoom,4.15,5.0);

export function populationRadius(tier,zoom){
  const regional=zoomProgress(zoom,4.1,5.9);
  const overviewScale=.68+.32*overviewFade(zoom);
  return tiers[tier].diameter/2*(.66+.34*regional)*overviewScale;
}

export const capitalMarkSize=zoom=>7.8+3.2*overviewFade(zoom);

export const cityIconName=tier=>`population-${tier}`;

function paintSymbol(canvas,tier,color,scale=1){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.translate(canvas.width/2,canvas.height/2);
  ctx.scale(canvas.width/32*scale,canvas.height/32*scale);
  ctx.fillStyle=color;
  ctx.fill(new Path2D(tiers[tier].path));
  return ctx;
}

export function registerCitySymbols(map,color){
  const canvas=document.createElement('canvas');
  for(let tier=0;tier<tiers.length;tier++){
    canvas.width=canvas.height=128;
    const ctx=paintSymbol(canvas,tier,color);
    const name=cityIconName(tier),image=ctx.getImageData(0,0,128,128);
    if(map.hasImage(name))map.updateImage(name,image);
    else map.addImage(name,image,{pixelRatio:4});
  }
}

export function populateMapKey(list,color){
  const items=document.createDocumentFragment();
  for(const [index,tier] of [...tiers.entries()].reverse()){
    const item=document.createElement('li');
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=104;
    canvas.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=tier.label;
    paintSymbol(canvas,index,color,tier.diameter/11);
    item.append(canvas,label);items.append(item);
  }
  const capital=document.createElement('li');
  const asterisk=document.createElement('span');asterisk.className='map-key-asterisk';asterisk.textContent='*';asterisk.setAttribute('aria-hidden','true');
  const description=document.createElement('span');description.textContent='Capital (asterisk)';
  capital.append(asterisk,description);items.append(capital);
  list.replaceChildren(items);
}
