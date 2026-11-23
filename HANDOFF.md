# USAtlas V0.9E preview

The locked compass sits against the upper-right map edge and expands inward on unlock. Desktop hover shows Hide compass or Return compass. A straight rightward swipe hides the locked compass on phones, and the edge chevron brings it back.

## V0.9D preview

Metro Stats and Atlas show linked states, counties and largest place. County Stats show linked state and largest place. Metro membership comes from Vintage 2025 Census population estimates and their July 2023 OMB delineations. Long Island is labeled along its axis at regional zoom when space allows. Shared geography placement can move nearby city names while preserving their visibility and size.

## V0.9C preview

The USA badge uses map bearing and its displayed size to stay entirely north of the border. City panels stack state, metro and county links alongside the city facts, and the selected map label stays illuminated through movement.

## V0.9B preview

The mobile Tools dropdown aligns with the logo button and uses compact rows. City and State Atlas share the COUNTIES and METROS controls. Selected states and cities use bold white labels, while selected counties and metros get a priority map label below ordinary label zooms.

## V0.9A preview

City and State Atlas keep the CTY, MSA and LAYERS controls available on both layouts. Their Census footers stay hidden, and current population and area facts are separate sections for future expansion. The city-specific MSA outline continues to show while its wider overlay is off. The C14 header logo opens Tools on mobile and the desktop hammer opens the same menu. USA Stats is the national default and supports USA Atlas, the CONUS / ALL switch, and the USA map badge at zoom 3.5 and below.

## V0.8L preview

Enabled county and metro buttons use gold text and borders with their standard backgrounds on phone and PC.

## V0.8K preview

The locked compass, active CTY and MSA controls, their State Atlas buttons and the open map key use gold. City facts link to the state beside the city name. Selecting it uses the map's state-abbreviation fit on PC and phone. The regular map includes all five Great Lakes shorelines at national and regional scales. The data source and version are recorded in `data/manifest.json`.

## V0.8J preview

The compass padlock is centered over the rose. Its open icon holds for about three-quarters of a second and fades. The center remains the lock control and the spokes reset north and lock. State Atlas has a synchronized Show counties and Show metros row directly under the facts. Home and Key sit close to the map or dock edge on PC and phone.

## V0.8I preview

The standalone compass has eight directly selectable directions, an animated padlock below, and a subdued blue-gray state when locked at north. Direction letters move with their points and stay upright. On desktop, hovering or focusing a direction enlarges and brightens it. The faint open padlock is always reachable by touch. The existing lock, heading snaps, and north reset use the same map rotation controller.

## V0.8H preview

On phones, a single tap on bare state land opens compact facts at the current camera. Ordinary map taps still wait up to 500 ms to allow quick double-tap zoom. Slow double-tap selection has been removed. State abbreviations still fit the state, and holding geography still opens Atlas. The PC preview uses port 8020 and the phone preview uses port 8019.

## V0.8G preview

The phone header now has **View** to the right of Search. Search gains room while active, and opening View closes Search. Statistical is the active view. Geographic and Strategic show the same later-release notice as on desktop. The PC preview uses port 8020 and the phone preview uses port 8019.

## V0.8F preview

On phones, the desktop sidebar stays hidden during startup. Holding a state fits its outline above the Atlas facts on the first open. Home, the zoom readout, and the map key sit at the bottom of the map or directly above the tools and stats bar. Test all three on a physical iPhone. The PC preview uses port 8020 and the phone preview uses port 8019.

## V0.8E preview

On phones, a city-name hold opens City Atlas and frames the city above the facts. Missing boundaries use a close view of the city marker. Panning the city out of the center returns to compact stats while keeping the camera and drag. The PC preview uses port 8020 and the phone preview uses port 8019.

## V0.8D preview

Phone and desktop use the same CTY and MSA scope. When enabled with a state selected, each overlay shows the areas that belong to that state at any zoom or bearing. A cross-state metro appears in every state it covers. Clear the selection for nationwide coverage. The preview ports are 8020 for PC and 8019 for phone.

## V0.8C preview

V0.8C covers phone State Atlas only. Swiping down, using the exit chevron or tapping open water returns to compact stats at the current camera. A light drag beyond the state's frame meets resistance and springs back. A longer drag returns to stats while the map continues following the finger.

The PC preview uses port **8020**. The phone preview uses port **8019**. Test the two exit gestures and the drag release in iPhone Safari.

## V0.8B preview

V0.8B adds desktop Atlas panels for states, cities and metros. The right sidebar widens in Atlas and has a chevron to hide and restore it. Back restores the previous center, zoom and bearing, including when following a linked city from a state. Puerto Rico keeps its on-island abbreviation and bottom inset title. Wide desktop views give state abbreviations the same placement priority as the phone.

County outlines are independent of zoom. With a state or one of its counties selected, only that state's counties draw. Clear the selection for nationwide county mode. On a phone, tapping another state's land switches the state and its county scope immediately, including from State Atlas.

- Desktop preview: `Start_Atlas.cmd` on port **8018**. Phone preview: `Start_Phone_Preview.cmd` on port **8019**. The regular Windows shortcut still points to the approved V0.5C build.
- `npm test` checks Census data and browser behavior including the desktop panels, restoring a rotated view, immediate phone state switching and county scope below zoom 4.5. A physical iPhone Safari check of V0.8B is open.

## V0.8A baseline and design reference

Updated November 20, 2026. RTS Workchat 2 started at V0.3A.7 and finished at V0.8A. Start from the latest main checkout and use the next request to set scope. The V0.8A preview runs the same source on phone and PC. The regular Windows shortcut opens the approved V0.5C desktop build.

- Start the PC preview with `python tools/serve.py` at `http://127.0.0.1:8017/`. For an iPhone on the same Wi-Fi, run `python tools/serve.py --phone` and open the address printed by the server on port 8016.
- The exact V0.8A preview is pinned in the [source commit](https://github.com/erikedavis/RTS-USA-Atlas/commit/6fb8daee30888d007d0fe10f225ddd23a9890ac1) and [downloadable source ZIP](https://github.com/erikedavis/RTS-USA-Atlas/archive/6fb8daee30888d007d0fe10f225ddd23a9890ac1.zip). The runtime matches the installed preview.

## V0.8A phone baseline

- The single-row header holds search. Home and the map key sit in the lower corners. The chevrons reveal CTY, MSA and the reserved LAYERS button, then compact stats for the selection. Swipe up on the stats or tools to expand the state or city atlas. The full atlas hides map controls, gives the facts their own scroll area and provides a down chevron to exit. A full state atlas fits the state and fades neighboring geography. A full city atlas keeps its surroundings visible.
- Tap or double-tap a state abbreviation on the phone to fit the state and show its compact facts. Hold its abbreviation or land for 600 ms to open the full state atlas. When a state is selected, tap another state's land to switch in place or tap × beside the chevrons to clear it.
- A quick map double-tap zooms two levels within the normal 500 ms window. A slower second tap through 1,040 ms selects unselected state land or opens compact facts for the same city name. A city hold opens its full atlas at the current zoom and highlights its MSA.
- From a state facts card, a city opens at the same level of detail. Back restores the state, camera and originating facts or atlas. An outside-metro tap clears the city and preserves the camera. An outside-state tap closes the state atlas and restores its compact facts and prior camera.

## Shared map behavior in V0.8A

- Click a city name on desktop to read its facts in place, or click its symbol to zoom and open facts. Click a state abbreviation to fit the state, or state land to select in place. Keep mouse hover, the map key and the desktop inset shortcuts available.
- State abbreviations have priority at national and regional phone scales and in rotated views. The existing Northeast anchors continue to apply. Puerto Rico shows PR in the island when space permits and the full inset name at the bottom.
- From zoom 7, CTY places county names within their outlines where they fit. MSA allows metro selection and shows July 1, 2025 population and total area. When both layers are enabled, a metro name or outline selects the metro, and a county interior selects its county.
- Rotation controls support desktop drag, phone twist, locking at any heading, the eight bearings and R for north. Search ranks exact state abbreviations first and Enter fits the state.

## Phone to desktop

Use these as design options for a requested desktop adaptation. Start by comparing the phone and desktop widths in V0.8A so shared behavior stays in one place.

| Phone behavior | Desktop translation to consider |
| --- | --- |
| Compact state stats put population beside capital, largest city and total area. | Make the top of the sidebar easier to scan. Preserve dated figures, source links and the existing desktop land-area detail. |
| Compact facts expand into a scrollable atlas. State details frame the outline. City details retain zoom and highlight the MSA. | Add a visible, keyboard-operable expand action and Back when fuller detail is requested. Use the current state or city and preserve the originating camera. Keep the map usable beside the facts. |
| Tapping a city name reads it in place. Tapping the symbol zooms. Linked cities retain the level of detail and Back returns to the state. | Keep the working name/symbol click split. Reuse the linked navigation and return state if desktop gets an expanded view. Check that hover and click agree on the visible lettering. |
| Tap and hold, slow double-taps and chevrons make the small screen usable without a mouse. | Use immediate desktop clicks, keyboard-operable controls and the sidebar. Test clicks, hovering and drag/zoom independently. |
| Abbreviations get first choice when space is tight, and county and metro details are selectable. | Reuse the shared rules and data. If desktop label priorities change, compare national, CONUS, half-country and local views. Move competing names around their own markers before dropping them. Preserve eligible small towns and the approved Northeast anchors. |

For an expanded desktop atlas, the first useful comparison is Kansas or California → linked capital → Back. Verify the map angle, zoom, selected feature and originating facts view on return. From Rochester or an Indianapolis-area city, compare name click against marker click, then verify the metro highlight and outside dismissal if those interactions are added.

## Code and QA

- `js/atlas.mjs` owns selection, facts, framing and layer state. `js/phone-ui.mjs`, `js/phone-gestures.mjs` and `assets/phone.css` own phone navigation and touch behavior.
- `js/state-labels.mjs`, `js/state-label-placement.mjs` and `js/county-labels.mjs` place area labels. `js/city-layout.mjs` and `js/city-display.mjs` place cities and resolve city-name taps. `js/map-rotation.mjs` owns bearing controls. Keep expensive placement after the camera settles.
- `tools/build-region-facts.py` builds county representative points from the Atlas search index and joins official Census metro population and area using the Census area ID. The data file records source URLs and hashes.
- Run `npm test` after installing dependencies and Chromium. The V0.8A [browser QA run](https://github.com/erikedavis/RTS-USA-Atlas/actions/runs/44808435751) passed. Desktop spacing, rotation, Big Island and Boise coverage, and the installed desktop smoke test also passed.
- Phone-sized Chromium and WebKit passed the installed V0.8A gesture and label checks. State compact facts rendered 16–17 ms after tap release in those runs. The local workspace's `work/check-phone.cjs` with `--v08a` repeats that suite. See [QA setup](QA_START_HERE.md).

## Open work

A physical iPhone Safari pass and performance measurements are still open. In portrait and landscape, check actual tap targets, single-tap selection, quick double-tap zoom, hold, scroll versus swipe, facts and Back, CTY and MSA selection, keyboard search, and rotation with facts open. Record device, iOS version, view and timings. Also check the Northeast at several bearings and compare the same map view on the PC.

The compass and lock preview is ready for review. The full rotation matrix, scale-specific collision priorities and optional Labels control remain open. Preserve the current visibility of close-view places when adjusting collision rules.

Publish verified source for every numbered build and record the exact commit, QA and open checks. Keep at most seven separate numbered snapshots and preserve Git history.
