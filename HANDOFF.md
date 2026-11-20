# USAtlas V0.8A development handoff

Updated November 20, 2026. Start from the current main checkout. V0.8A is the phone and PC preview. V0.5C is the approved desktop rollback baseline.

- Start the PC preview with `python tools/serve.py` at `http://127.0.0.1:8017/`. For an iPhone on the same Wi-Fi, run `python tools/serve.py --phone` and open the address printed by the server on port 8016.
- See [QA setup](QA_START_HERE.md) and the [browser workflow](https://github.com/erikedavis/RTS-USA-Atlas/actions/workflows/browser-qa.yml) for repeatable checks.

## Current behavior

- Tap or double-tap a state abbreviation on the phone to fit the state and show its compact facts. Hold its abbreviation or land for 600 ms to open the full state atlas. When a state is selected, tap another state's land to switch in place or tap × beside the chevrons to clear it.
- A quick map double-tap zooms two levels within the normal 500 ms window. A slower second tap through 1,040 ms selects unselected state land or opens compact facts for the same city name. A city hold opens its full atlas at the current zoom and highlights its MSA.
- From a state facts card, a city opens at the same level of detail. Back restores the state, camera and originating facts or atlas. An outside-metro tap clears the city and preserves the camera. An outside-state tap closes the state atlas and restores its compact facts and prior camera.
- State abbreviations have priority at national and regional phone scales and in rotated views. The existing Northeast anchors continue to apply. Puerto Rico shows PR in the island when space permits and the full inset name at the bottom.
- From zoom 7, CTY places county names within their outlines where they fit. MSA allows metro selection and shows July 1, 2025 population and total area. When both layers are enabled, a metro name or outline selects the metro, and a county interior selects its county.
- Rotation controls support desktop drag, phone twist, locking at any heading, the eight bearings and R for north. Search ranks exact state abbreviations first and Enter fits the state.

## Code and QA

- `js/atlas.mjs` owns selection, facts, framing and layer state. `js/phone-ui.mjs`, `js/phone-gestures.mjs` and `assets/phone.css` own phone navigation and touch behavior.
- `js/state-labels.mjs`, `js/state-label-placement.mjs` and `js/county-labels.mjs` place area labels. `js/city-layout.mjs` and `js/city-display.mjs` place cities and resolve city-name taps. `js/map-rotation.mjs` owns bearing controls. Keep expensive placement after the camera settles.
- `tools/build-region-facts.py` builds county representative points from the Atlas search index and joins official Census metro population and area using the Census area ID. The data file records source URLs and hashes.
- Run `npm test` after installing dependencies and Chromium. The local project workspace also has desktop spacing, rotation, and local place coverage checks, plus the V0.8A phone checks described in the preview's phone QA notes.

## Open work

A physical iPhone Safari pass and performance measurements are still open. Check state and city gestures, county and metro selection, the Northeast at multiple bearings, and rotation with facts open. Record device, iOS version, timings and reproducible views.

Rotation Pass 2 is pending approval. It covers the finished compass and lock, scale-specific collision priorities and the optional Labels control. Preserve the current visibility of close-view places when adjusting collision rules.

Publish verified source for every numbered build and record the exact commit, QA and open checks. Keep at most seven separate numbered snapshots and preserve Git history.
