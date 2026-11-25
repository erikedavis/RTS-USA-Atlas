# RTS USA Atlas - GitHub browser QA quick start

This repository contains the **USAtlas** and its browser QA workflow. See the [README](README.md) for the PC and phone launchers.

## Run locally

With Node.js and Python 3 installed, run the following from the repository root.

```sh
npm install
npx playwright install chromium
npm test
```

GitHub Actions also runs the checks on pushes to `main` and on pull requests. Its **atlas-browser-qa** artifact contains screenshots, the test report, and failure traces.

## What the CI workflow actually verifies

- The test copy is served over HTTP on port 8001.
- MapLibre genuinely creates a WebGL graphics context. Without WebGL, the test FAILS and does not certify visual QA.
- The map loads real 2025 Census data, not a blank canvas or a partial-loading screen.
- Idaho's label selects Idaho, selected-border screenshot is saved, county selection works, reset clears selection.
- Chicago, Denver, Phoenix, and Houston searches produce city-specific screenshots.
- A 390 × 844 touch viewport renders the national state labels, opens the phone toolbar, taps the Minnesota abbreviation, clears that selection, and finds Indiana by abbreviation.
- Source syntax, Census record counts, and native island positions and Alaska’s dateline wrapping pass the original `qa_v02d.mjs` script.

**Limitation:** A passing test confirms the map and interactions render and run, not that the visual appearance is flawless. Review the captured screenshots for city-label drift, blobby borders, national map framing and obvious UI collisions. A desktop-sized Chromium viewport does not emulate every behavior of real iOS Safari. If WebGL fails even with software rendering enabled, the test will report a failure rather than call that a pass.

## Public repository safety

The repository uses public Census-derived geography and bundled MapLibre. Its tests run with local files and require no credentials or API keys.

## Future release discipline

- Each development chat starts by checking the repository's newest code, release tag, and last test result, rather than guessing from old ZIPs.
- Make one focused change, keep the baseline, run tests, and preserve screenshots and logs.
- If a GitHub connector cannot write to the repository, don't claim code was uploaded; use a PR where permitted or provide the user a ready-to-commit change package.
- Never claim that city positions or border appearance are visually fixed without rendered evidence from working WebGL.
