# USAtlas V0.7C development handoff

Updated November 20, 2026. Start from the current `main` checkout. V0.7C is the latest verified phone preview. V0.5C is the approved desktop rollback baseline.

- [V0.7C source commit](https://github.com/erikedavis/RTS-USA-Atlas/commit/28883f1ecf3b2ed5f3876c152477d3a0c197f2b0) and [downloadable source ZIP](https://github.com/erikedavis/RTS-USA-Atlas/archive/28883f1ecf3b2ed5f3876c152477d3a0c197f2b0.zip).
- [Passing GitHub Actions run](https://github.com/erikedavis/RTS-USA-Atlas/actions/runs/44787643182). The checked-in app, data, and launchers match the verified V0.7C package apart from line endings. GitHub's CI checks the source served over HTTP.
- Start the PC copy with `python tools/serve.py`. It opens `http://127.0.0.1:8015/`. For an iPhone on the same Wi-Fi, run `python tools/serve.py --phone` and open the address printed by the server. V0.7C uses port 8009 for the phone preview.

## Current behavior to preserve

- On phones, swipe up on the center chevron for CTY, MSA and LAYERS. With a selection, swipe the stats or tool bar to expand its atlas. LAYERS is reserved.
- Double-tap zooms two levels. Single-tap a state abbreviation to fit it, a city name to read facts in place, a city symbol to zoom and show facts, or a county to select it with CTY enabled. A 600 ms hold opens the full state or city atlas. If a city is already selected, tapping or holding another city's name opens its compact facts.
- From a state facts card, a city opens at the same level of detail. The white Back arrow restores the state, camera and originating facts or atlas. A tap outside a city metro clears the city and keeps the camera. A tap outside a state atlas returns immediately to the prior map and state facts.
- At wide phone scales, abbreviations have first choice of screen space. Major cities fit around them. The approved small-state anchors still apply. Keep eligibility for nearby places separate from the rules for competing labels.
- Rotation Pass 1 supports arbitrary bearings on desktop, two-finger twist on phones, lock in place, eight headings and R to return north. State abbreviation search ranks an exact match first and Enter fits the state.

## Code and QA

- `js/atlas.mjs` owns feature selection, facts, framing and layer state. `js/phone-ui.mjs`, `js/phone-gestures.mjs` and `assets/phone.css` own phone navigation and touch behavior.
- `js/state-labels.mjs` and `js/state-label-placement.mjs` place state abbreviations. `js/city-layout.mjs` and `js/city-display.mjs` place city names and markers and resolve city-name hits. `js/map-rotation.mjs` owns bearing controls. Keep expensive label placement after camera movement settles.
- Run `npm test` after installing the dependencies and Chromium. See [QA setup](QA_START_HERE.md). Local V0.7C desktop regressions, phone-sized Chromium/WebKit navigation, the Big Island and Boise local coverage checks, and the installed smoke check passed.

## Open work

A full physical iPhone Safari acceptance and performance pass on V0.7C has not been recorded. Recheck close city taps around Indiana, full-atlas exit and Back, wide state labels, and rotation with the atlas and stats open. Capture the phone model, iOS version, timings and any repro details.

Rotation Pass 2 is pending approval to start. The planned work covers the finished compass and lock, bearing-specific collision priorities and the optional Labels control. Preserve the current label admission behavior and verify arbitrary bearings, the Northeast, the national insets and dense metro views before closing the rotation phase.

For each newly numbered build, update the version and publish the verified source. Record the exact commit, QA and open checks. Keep at most seven separate numbered snapshots, preserve Git history and confirm a local backup before retiring any old package.
