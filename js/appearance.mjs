const preferenceKey = 'usatlas-appearance';
const dark = {
  background:'#020307', contextLand:'#0a1119', lake:'#04070c', shoreline:'#648aa5',
  land:'#101923', inset:'#070d14', insetLine:'#30485b', stateLine:'#718da8',
  countyLine:'#3b5268', countyScoped:'#6685a0', placeLine:'#546b83',
  metroFill:'#506c90', metroLine:'#839bb9', linkedMetroFill:'#6f97ba', linkedMetroLine:'#b2d8f4',
  selectedState:'#b6def5', selectedCounty:'#c2e0f5', selectedPlace:'#a2d7fc', selectedMetro:'#c6daed',
  metroText:'#b4cae3', metroHalo:'#0a1321', countyText:'#a1b4c6', countyHalo:'#0a131e',
  citySymbol:'#d5e8f6', cityText:'#bbd1e0', cityHalo:'#0a111a', selectedCity:'#fff',
  selectedCityHalo:'rgba(135,185,225,.55)', cityHoverGlow:'#a9dfff', cityHoverText:'#ffffff',
  localPlace:'#98b5cd', localPlaceEdge:'#d5e7f3',
  tailIsland:'#9ab4c6', tailText:'#718da8',
  lakeText:'#98bdd5', lakeHalo:'#0b121a', peninsulaText:'#a3b8c8', islandText:'#aec4d5',
  geographyHalo:'#0b121a', geographyStrength:1,
  categories:['#8db5d1','#e6bf79','#a5b9a0','#ccaecb'],
  political:{red:'#e49086',blue:'#85aee3',independent:'#e6bf79',other:'#c5a3d3'},
};
const light = {
  background:'#9bbccf', contextLand:'#e4dcc9', lake:'#79a7c1', shoreline:'#527f99',
  land:'#e7d5ae', inset:'#a4c2d2', insetLine:'#738b91', stateLine:'#687369',
  countyLine:'#7d8b75', countyScoped:'#627458', placeLine:'#737466',
  metroFill:'#9870a1', metroLine:'#74527c', linkedMetroFill:'#a27696', linkedMetroLine:'#663e64',
  selectedState:'#754c31', selectedCounty:'#5e5031', selectedPlace:'#83412e', selectedMetro:'#683856',
  metroText:'#533d59', metroHalo:'#f0dfc4', countyText:'#394b3c', countyHalo:'#f0e2c4',
  citySymbol:'#344e56', cityText:'#273e47', cityHalo:'#eee1c4', selectedCity:'#6c301d',
  selectedCityHalo:'rgba(247,226,187,.97)', cityHoverGlow:'#f4ddb0', cityHoverText:'#693822',
  localPlace:'#51696a', localPlaceEdge:'#f0e2c4',
  tailIsland:'#566f69', tailText:'#354e55',
  lakeText:'#102638', lakeHalo:'#a6c5d5', peninsulaText:'#33473c', islandText:'#33473c',
  geographyHalo:'#e6ddc2', geographyStrength:1.75,
  categories:['#265f85','#885535','#4e724d','#754b79'],
  political:{red:'#aa413c',blue:'#275b9d',independent:'#81530f',other:'#734381'},
};

export const mode = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
export const mapPalette = () => mode() === 'light' ? light : dark;

export function setThemePaint(map, layer, property, value) {
  map.setPaintProperty(layer,property+'-transition',{duration:0,delay:0});
  map.setPaintProperty(layer,property,value);
}

export function setupAppearance(onChange) {
  const root = document.documentElement;
  const toggle = document.querySelector('#appearance-toggle');
  const hint = document.querySelector('#appearance-hint');
  const browserColor = document.querySelector('meta[name="theme-color"]');

  function showMode(value) {
    const next = value === 'light' ? 'dark' : 'light';
    root.dataset.theme = value;
    browserColor.content = value === 'light' ? getComputedStyle(root).getPropertyValue('--header-surface').trim() : dark.background;
    hint.textContent = `${value === 'dark' ? 'Dark' : 'Light'} mode · Switch to ${next}`;
    toggle.setAttribute('aria-label', `Switch to ${next} mode. Current mode: ${value}.`);
  }

  showMode(mode());
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const value = mode() === 'light' ? 'dark' : 'light';
    showMode(value);
    // The control still works if this browser blocks local storage.
    try { localStorage.setItem(preferenceKey, value); } catch {}
    onChange();
  });
}

// Keep paint in place so switching appearance preserves styles' data, filters and layout.
export function applyMapAppearance(map, countyScoped, stateFocused) {
  const palette = mapPalette();
  const layers = [
    ['background','background-color',palette.background],
    ['atlas-context-land','fill-color',palette.contextLand],
    ['great-lakes-fill','fill-color',palette.lake],
    ['great-lakes-shoreline','line-color',palette.shoreline],
    ['inset-surface','fill-color',palette.inset], ['inset-lines','line-color',palette.insetLine],
    ['state-surface','fill-color',palette.land], ['state-atlas-surface','fill-color',palette.land],
    ['state-lines','line-color',palette.stateLine],
    ['county-lines','line-color',countyScoped ? palette.countyScoped : palette.countyLine],
    ['place-area-lines','line-color',palette.placeLine],
    ['metro-surface','fill-color',palette.metroFill], ['metro-lines','line-color',palette.metroLine],
    ['atlas-metro-fill','fill-color',palette.linkedMetroFill], ['atlas-metro-outline','line-color',palette.linkedMetroLine],
    ['state-selected','line-color',palette.selectedState], ['county-selected','line-color',palette.selectedCounty],
    ['place-selected','line-color',palette.selectedPlace], ['metro-selected','line-color',palette.selectedMetro],
    ['metro-names','text-color',palette.metroText], ['metro-names','text-halo-color',palette.metroHalo],
    ['county-names','text-color',palette.countyText], ['county-names','text-halo-color',palette.countyHalo],
    ['places-hit','circle-color',palette.localPlace], ['places-hit','circle-stroke-color',palette.localPlaceEdge],
    ['hawaii-tail-islands','circle-color',palette.tailIsland], ['hawaii-tail-label','text-color',palette.tailText],
  ];
  for (const [id, property, value] of layers) {
    if (map.getLayer(id)) setThemePaint(map,id,property,value);
  }
  map.setLayoutProperty('great-lakes-fill','visibility',stateFocused ? 'none' : 'visible');
  return palette;
}
