# USAtlas V0.7C phone preview

Requires Python 3. Clone the repository or extract its source ZIP, then run **Start_Atlas.cmd** from that folder. The launcher opens **http://127.0.0.1:8015/**.

[Development handoff](HANDOFF.md) covers the working baseline, checks, and open work.

## Phone controls

- Map view starts with a compact header, Home and the map key in the bottom corners, and a chevron in the center. Swipe the chevron up to reveal **CTY**, **MSA**, and **LAYERS**. The chevrons can also be tapped. **LAYERS** is reserved for a future update.
- A standard double-tap zooms two levels around the tap. Tap a state abbreviation to frame the state and show its compact facts. Tap a city name to read its facts in place, or tap its symbol to zoom to the city. When CTY is on, tap inside a county to select it.
- Hold on a state or city for about 0.6 seconds to open its full atlas. From compact facts, swipe up on the facts or tool bar. In a city view, tap or hold another city's name to open its compact facts. Tap outside the highlighted metro to clear the city and keep your current map position.
- Tap a capital or largest city in state facts to visit the corresponding city view. **BACK** returns to the state facts or atlas you came from. In the state atlas, tapping outside the outline returns immediately to the prior view.
- At wide phone scales the state abbreviations get the available space first. Major city names appear where they fit.
- Population, capital, largest city and total area fit into the compact state facts. When capital and largest city are the same, they share one entry.
- A hold gives visual feedback. Sites in iPhone Safari do not have a general-purpose vibration API for map gestures. Browsers exposing the vibration API can give a short pulse on release.

## Rotation and search

Use the top-right arrow or **Unlock** to enable rotation. Right-drag on a PC or twist with two fingers on a phone. **Lock** holds the current angle. Click the arrow again to return north and lock. Open the current-bearing menu to choose any of the eight compass directions. **R** returns north while retaining the current lock setting.

Type a state abbreviation such as **MN** in Search. It appears first, and Enter opens its facts and fits the state. The angle is preserved.

Pass 2 covers the finished compass artwork, label priorities by scale, and the optional more-labels control.

## What's new in V0.5C

- Rhode Island, New Jersey, Delaware, and Maryland use the fixed exterior coordinates from Erik's marked screenshots. If the letters cannot fit there, the label waits for space at the anchor or inside the state.
- Massachusetts uses the suggested inland area and takes priority if its letters compete with Boston's name.
- State abbreviations display as plain capital letters. The tap and click areas are still available.

## Try it on an iPhone

1. Connect the PC and iPhone to the same trusted Wi-Fi network.
2. On the PC, open this extracted folder and run **Start_Phone_Preview.cmd**. Keep the window open.
3. Enter the address shown in that window into Safari on the iPhone. This preview uses port **8009**. The mobile header reserves its space for search.
4. Drag and pinch, try both kinds of double-tap, search for California, and swipe into and out of the state atlas. Press Ctrl+C in the PC window when finished.

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
insets; Puerto Rico stays in its Gulf inset. AK, HI and PR zoom buttons are available on desktop.

## Data and limitations

Boundaries are unchanged Census 2025 cartographic geometry. Census places include
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
