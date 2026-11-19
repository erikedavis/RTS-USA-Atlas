# USA Atlas v0.2b test checklist

This is an issue-fixing standalone **reconstruction** based on v0.1B geography, NOT a direct patch of inaccessible v0.2.

## Test across national, state, local zooms

- [ ] National: city dots for Chicago, Denver, Atlanta, Phoenix, Houston, Los Angeles and Portland anchor to correct geography; compare several zoom levels.
- [ ] Chicago remains by southwestern Lake Michigan at all zooms; Boston and NYC do not drift.
- [ ] No bright rows of circle vertices along Idaho, Illinois, or other state borders.
- [ ] Search for a state, county, major city, and metropolitan area and verify camera location and right panel.
- [ ] Click NY/PA/TX state abbreviations: correct state selected even if county polygons are shown.
- [ ] National/regional polygon click selects the state, not a county; zoom closer and county selection becomes available.
- [ ] CTY button permits county selection earlier when county data is loaded; state panel offers enable county selection.
- [ ] Clicking a major city name or diamond selects the city regardless of surrounding state.
- [ ] Click states along boundaries (Vermont/New Hampshire, NY/PA): check selection logic and edge cases.
- [ ] Select a county: parent state border is subtle, county border prominent; no misleading double highlighting.
- [ ] County, place and metro geometry appear only at appropriate zooms and are click-targetable.
- [ ] MSA button shows metro polygons and a metro can be selected.
- [ ] Home resets to contiguous US; Alaska and Hawaii are reachable via buttons; PR camera works.
- [ ] Zoom/pan; confirm labels don't overlap excessively and no coordinate drift.
- [ ] Try desktop and iPhone screen sizes; controls/panel remain usable.
- [ ] Test browser refresh, server restart and search repeat visits.

## Source data checks

- [ ] IDs for New York = 3651000 (not Hoboken), Phoenix = 0455000, Chicago = 1714000.
- [ ] Original Census ZIP archives and manifest are unchanged.
- [ ] No state boundary vertex debugging symbols in the map layers.

## Known limitations

- This reconstruction may omit features unique to the inaccessible v0.2 ZIP.
- Detailed geographic data loads one state at a time; the map does not fully support simultaneous cross-state county detail yet.
- No map terrain, historical layer, statistics or live feeds yet.
- Needs internet for third-party MapLibre JS/CSS until vendored locally.
