# USAtlas V0.9B preview

Requires Python 3. Clone the repository or extract its source ZIP, then run **Start_Atlas.cmd** from that folder. The launcher opens **http://127.0.0.1:8020/**.
[Development handoff](HANDOFF.md) covers the current preview, repeatable checks, and open work.

## USA overview

Startup and Home open USA Stats. CONUS frames the lower 48, D.C. and the Puerto Rico inset. ALL adds Alaska and Hawaii. Both show the same national population and land area from [Census QuickFacts](https://www.census.gov/quickfacts/fact/table/US/PST045222).

Tap or click the USA map label for USA Stats. Hold it to open USA Atlas. The label disappears above zoom 3.5. On a phone, swipe up from the USA Stats sheet or its top handle to open USA Atlas.

## Desktop controls

- Select a state, city or metro, then choose **Atlas** in the right sidebar. The sidebar widens. State Atlas frames the outline and fades out surrounding states. City Atlas keeps the zoom and highlights its metro when one exists. Metro Atlas frames the metro and includes a list of Census places with points inside its boundary.
- **Back** restores the previous map position, zoom and bearing. A linked city opened from a state returns to that state's atlas or stats.
- The state link beside a city's name selects and fits the state the same way its map abbreviation does. It works in compact facts and City Atlas on PC and phone.
- The chevron midway down the sidebar hides it. Click the remaining chevron to reopen it, or make a new selection. Home sits at the lower-left edge of the map and Key sits at the lower-right edge. The hammer in the header opens Tools, including View.

## Phone controls

- Tap the C14 logo and blue chevron to open Tools. View shows the current Statistical mode. Geographic and Strategic are reserved for later releases.
- Home, the zoom readout, and the map key sit along the bottom and move with the tools and stats bar. **COUNTIES**, **METROS**, and **LAYERS** stay available in City and State Atlas. **LAYERS** is reserved for a future update.
- One tap on state land opens compact facts at the current map position. A quick double-tap on the map zooms two levels around the tap. Tap or double-tap a state abbreviation to fit the state and show its compact facts. With a state selected, tap another state's land to switch, or use the **×** by the chevrons to clear it.
- Hold on a state or its abbreviation for about 0.6 seconds to open State Atlas. Hold a city name to fit the city above its Atlas facts. A city-symbol hold opens City Atlas at the current zoom. Drag the map far enough to move the city out of the center and City Atlas returns to compact stats while the map follows your finger. Tap a city name to read facts in place or tap its symbol to zoom. Tap outside the highlighted metro to clear the city at the current map position.
- Tap a capital or largest city in state facts to visit the corresponding city view. **BACK** returns to the state facts or atlas you came from. One tap on another state's land switches the selection. In State Atlas, swipe down on the stats or tap open water to return to compact stats at the current camera position. A light pull beyond the state's frame springs back. A deliberate drag away returns to stats and continues panning with your finger.
- State abbreviations have priority at wide scales and in rotated views. Puerto Rico is labeled **PR** inside the island when it fits, with the inset name along the bottom.
- Population, capital, largest city and total area fit into the compact state facts. When capital and largest city are the same, they share one entry.
- A hold gives visual feedback. Browsers exposing the vibration API can also give a short pulse on release.

## Counties and metros

Use **COUNTIES** and **METROS** in the map controls, including from State Atlas. The text and border turn gold when the layer is on. With a state selected, county and metro outlines stay scoped to that state while you zoom, pan, or rotate. A metro spanning several states appears for any state it covers. Clear the state selection for nationwide coverage. County selection is available from zoom 4.5. An intentionally selected county or metro receives a bold white map label, including at zooms below the ordinary labels. Selected state abbreviations and city names also use bold white lettering.

## Rotation and search

Click or tap the compass center to unlock rotation or lock the current angle. A gold padlock marks the locked state. The shackle opens and the icon fades shortly after unlocking. Right-drag on a PC or twist with two fingers on a phone. The rose and the positions of its letters follow the map bearing, with each letter upright. Click or tap any direction to snap to that heading. Click or tap a spoke outside the center to return to north and lock rotation. **R** returns north while retaining the current lock setting.

Use one finger to drag around the center from a direction label or the outer half of a compass spoke. A locked circular gesture holds the bearing until release, then unlocks. An unlocked circular gesture turns the map as the rose follows your finger.

Type a state abbreviation such as **MN** in Search. It appears first, and Enter opens its facts and fits the state. The angle is preserved.

The remaining rotation work covers the full bearing matrix, label priorities by scale, and the optional more-labels control.

The regular map shows the shorelines of all five Great Lakes at national and regional scales. The bundled geometry comes from [Natural Earth 1:10m Lakes + Reservoirs](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/).

## What's new in V0.5C

- Rhode Island, New Jersey, Delaware, and Maryland use the fixed exterior coordinates from Erik's marked screenshots. If the letters cannot fit there, the label waits for space at the anchor or inside the state.
- Massachusetts uses the suggested inland area and takes priority if its letters compete with Boston's name.
- State abbreviations display as plain capital letters. The tap and click areas are still available.

## Try it on an iPhone

1. Connect the PC and iPhone to the same trusted Wi-Fi network.
2. On the PC, open this extracted folder and run **Start_Phone_Preview.cmd**. Keep the window open.
3. Enter the address shown in that window into Safari on the iPhone. This preview uses port **8019**.
4. Drag and pinch, tap state land, try quick double-tap zoom, search for California, and swipe into and out of State Atlas. Press Ctrl+C in the PC window when finished.

If Safari can't reach the address, check that both devices are on the same trusted Wi-Fi. Guest Wi-Fi and Windows firewall rules can block connections between devices.

## What's new in V0.4A

- The largest population tier (2,000,000+) uses a decagon on the map and in the key.
- City artwork has twice the raster resolution per axis, keeping display sizes and hover glow unchanged.
- CTY boundaries and selection begin at zoom 4.5, with subdued but visible outlines. Counties remain off by default.
- Manually enabled MSA areas remain visible at zoom 8.8 and closer; existing automatic metro behavior and collision spacing are retained.

## Existing behavior

- Hawaii’s main islands are centered in their inset. The northwestern chain appears at a reduced scale in the same inset. Search for HI to frame the main islands.
- The national view uses smaller city symbols and restrained city label sizes. Text size varies more by population tier at state and local zooms. Small towns wait until a closer view.
- Between zoom 7.55 and 9.15 the map automatically shows metropolitan statistical areas and a spaced set of city names. Cities over 100,000 have priority. If none are in view, one city over 50,000 can appear. Faint city symbols reveal more names on hover. The MSA button controls the overlay manually.
- The lower-right map key explains seven population tiers, ordered largest to smallest. A developer zoom readout sits beside it. Capitals have a separate asterisk beside their symbol.
- On desktop, click a city name to read its facts in place. Click its map symbol to jump to the city. Hover names enlarge and linger for half a second.
- Small-state abbreviations use fixed geographic positions. A nearby badge can move inside its state when there is room. The exterior badge is shown only when it clears neighboring land. Michigan’s default anchor is just north of St. Johns. Hawaii and Puerto Rico have badges in their national insets.
- On desktop, clicking a state’s land opens its facts at the current view. Its abbreviation fits the full outline to the map.
- Labels for the Great Lakes, Upper Peninsula and Long Island sit in the background. Long Island fades from close views.
- City and state label placement refreshes after zooming or panning, so it stays off the camera's animation frames.
- Counties have population, area and largest place facts. Enable them with CTY, county search, or the state's county button.

National view prioritizes the 20 largest cities plus Boston, Philadelphia, Miami,
Washington and Las Vegas. The map places names immediately beside their symbols and leaves the name off if it cannot fit there. Search remains available for every Census place.
City populations refer to municipal/place boundaries, not metro areas.

## Preserved controls

Clicking empty ocean clears selection and hover. State and city panels
retain population, dated sources, and square miles. State panels include capital
and largest city with their populations. Alaska and Hawaii remain in western
insets and Puerto Rico stays in its Gulf inset. Select their abbreviations or find them in Search.

## Data and limitations

Boundaries are unchanged [Census 2025 cartographic geometry](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html). Metro areas use the [Census Vintage 2025 population estimates](https://www.census.gov/data/datasets/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html) and official land and water areas. Census places include
incorporated cities/towns and census-designated places; they do not include every
informal settlement name. Populations use 2025 estimates where published and dated
2020 Census counts otherwise. Missing values are shown as unavailable, never invented.

County largest-city ranking uses county-part populations when available. The card
shows the city's whole population; county-part residents are separately labeled.
For counties without that table coverage, the largest Census place whose
representative point is inside the county is used, with the method stated.

The map, data, renderer and font glyphs are bundled and require no internet requests
while running. External source links open only when selected.

Research, source links and the display policy are in
`documentation/V0.3A-design-and-sources.md`. Validation is in
`documentation/v03a_QA.md`.
