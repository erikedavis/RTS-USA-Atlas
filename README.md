# USA Atlas v0.2D

## Start

1. Extract this ZIP into its own folder.
2. Double-click **Start_Atlas.cmd**. Python 3 must be installed.
3. The browser opens **http://localhost:8001/**. Confirm **ALPHA 0.2D** at the top right.
4. Keep the server window open while using the atlas. Close it with Ctrl+C when finished.

You can also run `python tools/serve.py` or `py -3 tools/serve.py` from this folder.
Port 8001 separates this build from earlier copies commonly served on port 8000.
Do not open index.html directly. If port 8001 is already occupied, stop the older
server using that port before starting this copy.

## Changes

- City dots and city labels now render as native map layers, using the exact same
  projection and camera frame as the land. No separate city overlay can lag behind.
- State boundaries use thin lines with bevel joins. Removed the blurred state glow
  and selected-border blur to keep detailed coastlines clean.
- Clicking empty background, including empty space inside an inset, clears every
  selection highlight and the information panel without moving the camera.
  Escape also clears selection.
- Alaska and Hawaii are in labeled containers west of California. Puerto Rico is
  in a labeled Gulf container between Texas and Florida. The AK / HI / PR zoom
  buttons remain and target these insets. Search and detail layers use the same
  display transforms, so they remain aligned inside their containers.
- MapLibre 6.18.0, its worker, stylesheet and license are bundled locally. No
  internet connection or map tile service is needed to run this build.

The insets are display layouts, not real geographic positions. Census coordinates
and GEOIDs in the data files are unchanged. The coordinate readout reverses the
inset transform when the camera is over a container. The whole Hawaii chain is
retained; use HI or search Honolulu for a closer look.

## Data and verification

Official Census 2025 cartographic boundaries at 1:500,000: 56 state/equivalent
records, 3,235 counties, 32,629 places, 935 metro/micro areas, and 43 curated major
city labels. The lightweight package includes derived geography and source
provenance in data/manifest.json; original Census shapefile archives are not bundled.

State, county, place and optional MSA selection and search are preserved. County
and place details load locally as needed. Geography and Strategic visual modes
remain placeholders from the supplied build.

See documentation/v02d_QA.md for browser checks and limitations. Node.js users can
run `node tools/qa_v02d.mjs` for data and inset transform checks. Older documentation
and qa_v02b.py are retained as historical notes and are not the current validation.

## GitHub browser QA

The repository adds automated Playwright browser tests under `tests/` and `.github/workflows/browser-qa.yml`. See [QA_START_HERE.md](QA_START_HERE.md) for setup and evidence standards. The corrected v0.2D runtime source and Census data remain unchanged.
