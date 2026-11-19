# v0.2D validation

Interactive verification used headless Google Chrome at 1440 x 1000 and 390 x 844.
All external requests were blocked. The atlas loaded with zero external requests,
zero browser errors, and its bundled MapLibre 6.18.0 renderer and worker.

Verified:
- Chicago, Detroit, Denver, Atlanta, and Boston project onto their correct state surfaces.
- City dots and text use native MapLibre layers, sharing the camera with the boundaries.
- Selected Michigan has a continuous, thin, unblurred outline with bevel joins.
- Blank map clicks clear state, city, county, metro, and parent-state highlights,
  empty the selection panel, and leave the camera in place.
- Alaska, Hawaii, and Puerto Rico zoom buttons show the display insets.
- Insets are selectable; deselection works inside empty container space too.
- Honolulu search navigates to the Hawaii inset. PR county and metro searches stay
  in the Gulf inset and retain their Census IDs.
- Mobile controls work without horizontal page overflow; Escape clears selection.
- Every AK/HI/PR boundary vertex fits its container. Inverse coordinate transforms
  reproduce the source coordinates. California, Michigan, Texas and other US
  territories are untouched by the display transforms.
- Counts: 56 state/equivalent records, 3,235 counties, 32,629 places, 935 metros,
  43 major cities with valid Census place IDs.
- SHA-256 comparisons confirmed all 174 packaged data files exactly match the
  supplied v0.2C ZIP.

The source ZIP did not reproduce the screenshots' city offsets or large border
circles in this Chrome run. The revised rendering removes the separate city
overlay and blurred state outlines, and uses a distinct release label/local port
to reduce confusion with older running copies. Verification covers Chrome's
software WebGL renderer; physical mobile devices and other GPU drivers were not tested.

Hawaii's complete island chain is retained, so its main islands are small in the
national view. Use HI or search Honolulu to zoom closer. Containers change display
locations only; source Census geography files are unchanged.

Run the included data and transform checks with `node tools/qa_v02d.mjs`.
The earlier v02b QA and release notes describe historical builds.
