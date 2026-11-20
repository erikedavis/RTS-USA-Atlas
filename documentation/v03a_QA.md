# USA Atlas testing

## V0.3A.7

City names use a compact set of placements beside their symbols. The browser check repeats the reported views and measures the space between plotted markers and label rectangles. The most populous city gets first choice of a national label position. State badge placement reserves space for major city symbols. Neither city nor state label placement uses a leader line.

New Jersey and Rhode Island use stable geographic anchors, verified across changes in pan and zoom. The exterior badge's footprint is checked against neighboring state polygons before it is drawn. The interior anchor takes over once the badge fits within its own state. Connecticut, New Hampshire, and DC can wait for more zoom in the widest views.

## V0.3A.6

The Hawaii inset centers the main island group and retains all 15 Northwestern Hawaiian Islands polygon pieces at a reduced scale inside the same frame. The browser check verifies geographic coordinate inversion and compares the close view from both HI controls against the screenshot framing. The raw Census boundary files are unchanged.

## V0.3A.5

The zoom 9.00 screenshot view over Long Island displays New York, Yonkers, Stamford, Bridgeport, Newark, and Paterson. Rochester’s city label and MSA label both appear in southern Minnesota. At a smaller metro centered on Dubuque, the strongest city between 50,000 and 100,000 can appear by itself. Smaller places in the metro overview use hover labels.

The browser check also verifies the upward and downward triangle sizes and the numeric zoom display beside the horizontal key.

## V0.3A.4

National markers and capital asterisks are smaller. The same markers return to the previous scale at state and local zooms, with a pentagon at 95% of the former second-tier symbol width. City names show a restrained population size difference nationally and a clearer difference at state and local zooms.

The browser check compares a centered and panned national view. All nine small-state abbreviations stay near their geographic anchors, with no state leader layer. The test also verifies Michigan’s new anchor, city click behavior, the tight state fit, and the existing metro and geography views.

## V0.3A.3

In the same local Chrome camera replay with five pan and zoom transitions, the 95th-percentile frame interval dropped from about 28 ms to 7 ms. City and state label source updates during those gestures went from 664 to zero. This comparison measures the test machine's browser run.

Browser checks cover the seven-tier key order, Boise's population symbol and separate asterisk, the Great Lakes and Long Island display, and unchanged camera position when selecting Minnesota beside Eyota. The Minnesota abbreviation still fits the full state. Existing national, MSA, city click and state fit checks also run against this build.

## V0.3A.2

The desktop browser check covers national typography and state badges, the map key, Boise's population diamond and asterisk, and city map name versus symbol clicks. It verifies southern Minnesota at regional and metro zoom, Owatonna hover, the MSA toggle, and the Northeast without state leader lines. California, Alaska, Rhode Island and Puerto Rico retain their full boundaries while using over 90% of the map along the limiting dimension. Close views retain Seward and Zumbrota labels. The browser check uses the bundled files with outside requests blocked.

## V0.3A.1 validation — 2026-11-19

Tested in headless Google Chrome with the bundled MapLibre renderer. Browser tests serve local files, block external requests, and capture JavaScript/rendering errors. Screenshots were visually reviewed for national, Los Angeles, Las Vegas, Kenai/Seward, Zumbrota and county information views.

## Coverage

- All 32,629 Census place points loaded, without a population floor.
- At 1600 × 1050, all 50 states, DC and Puerto Rico have visible state buttons and 24 city names use the V0.2F 8.8 px regular type.
- Los Angeles and New York get measured emphasis in crowded views, capped at 12.45 px. Los Angeles smoothly eases from 12.45 px at zoom 6.4 to about 12.09 px at zoom 8.4. Smaller city type decreases faster under comparable crowding.
- Idaho shows Boise and leaves out Caldwell at the statewide scale. Juneau, Anchorage and Rochester use regular regional type.
- The Puerto Rico outline fills more of the inset. At national zoom, neither its title nor its separate abbreviation covers the outline. The abbreviation opens Puerto Rico and shows the expected state facts.
- Unselected Seward, Kasson, Coral Gables, Culver, Laurel, Connersville and Zumbrota have visible names in their tested local/regional views. Seward is tested at zoom 9.4, matching the user's sparse-region example.
- A real pointer hover reveals native geographic text, with no popup box. The name survives 300 ms after departure and disappears after the 500 ms grace period.
- Clicking actual rendered Zumbrota text selects and zooms; its panel shows 4,072 residents. Selecting its boundary also keeps the map name visible.
- Empty-ocean click clears selection. Counties remain disabled while zooming and selecting cities.
- Rhode Island's callout selects and zooms to RI. Its text grows by approximately 15% on hover. California's button remains visible at the LA regional view even though its usual anchor is off screen.
- Green Bay has a visible label after selecting Wisconsin.
- County search explicitly enables counties. Panel checks: Los Angeles County 9,694,934 / Los Angeles; Clark County 2,407,226 / Las Vegas; Kenai Peninsula 61,951 / Kenai; Goodhue County 48,195 / Red Wing.
- No JavaScript or MapLibre errors and no external runtime requests in the automated scenarios.

## Data integrity

113 state, county and place-boundary files are byte-identical to V0.2F. The map-display work does not alter their geography. Every one of the 3,235 county equivalents has a population with an explicit date: 3,222 use 2025 estimates and 13 use 2020 counts. Largest-place records are available for 3,231; the other four do not receive invented values.

`v03a-integrity.json` records data/font SHA-256 hashes and the boundary comparison count. `V0.3A-design-and-sources.md` records the sources, display policy and county ranking limitations.
