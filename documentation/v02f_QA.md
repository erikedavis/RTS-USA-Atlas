# v0.2F verification

Browser: headless Google Chrome, software WebGL, 1600 x 1050 and 390 x 844.
All external requests were blocked. Local app, renderer, worker and font requests
completed without browser errors.

Checks:
- All 50 states, DC and PR have visible national-view abbreviation buttons.
- Nine small-state callouts have leaders; RI click zooms to the state.
- State hover changes the text's measured width by 15%.
- Wisconsin's eight largest cities and all its 100k cities have points. Green Bay's
  native name is visible in state view. Hover grows its native text by 15%.
- Clicking both Green Bay's hover name and its native map name zooms to Green Bay
  and displays population 106,675 with population date and area.
- Counties remain unselectable at zooms 7, 10 and 14. A land click cannot pick a
  county while CTY is off. CTY enables picking; turning it off clears the county.
- Indiana's moved anchor is inside Hamilton County at its previous longitude.
  No city label obscures its abbreviation button in state view.
- Wyoming shows its eight largest places despite several being below 10k.
- LA regional view retains hundreds of dots while allowing fewer names, and a
  dot without a visible name reveals a clickable name on hover. Los Angeles's name
  has priority over small suburbs.
- Phone layout has no horizontal overflow; RI callouts and Escape work.
- Dots and names still use native map projection, not a separate city canvas.

Data coverage:
- 4,281 labeled/hoverable city features with unique Census place identifiers.
- Every one of the 4,244 bundled places >=10k is present and eligible by zoom 6.5.
- Every one of the 3,224 >=10k incorporated places in the full Vintage 2025 city
  estimate file is present (independent audit against the Census download).
- Every state has eight ranked places and national capital/largest-city eligibility.
- State/county/place boundary geometry is not modified.

Names may be suppressed in crowded regions; the dots and hover names are retained.
Population dates and previous release's missing-data limitations remain visible.
Physical phones and other GPU drivers were not tested. Zoom thresholds are an
initial visual tuning pass, deliberately centralized in js/city-layers.mjs and
stored per city in data/cities.geojson.
