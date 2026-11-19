# RTS USA Atlas - GitHub browser QA quick start

This folder is the **user-uploaded corrected v0.2D application** plus QA scaffolding. The original atlas files (index.html, js/, assets/, data/, tools/, documentation/) are preserved; these new additions are limited to .github/, tests/, package.json, playwright.config.mjs, .gitignore, and this document.

## First upload (on Windows using GitHub Desktop)

1. Download this ZIP and extract it in Windows Explorer. Open the folder **RTS-USA-Atlas_GitHub_Ready** inside the extracted ZIP.
2. Download and install GitHub Desktop from https://desktop.github.com/ if you do not have it already. Sign in to the same account that owns the RTS-USA-Atlas repository.
3. Select **File > Clone repository** in GitHub Desktop, choose **RTS-USA-Atlas**, and click **Clone**. This gives you a new local repo folder on your laptop.
4. Open that new local repository folder via GitHub Desktop (**Repository > Show in Explorer**).
5. Copy the **contents** of RTS-USA-Atlas_GitHub_Ready into the repository folder. The new repo's top level must contain `index.html`, `data`, `js`, `assets`, `tools`, `tests`, `package.json`, and `.github`. Do not copy a wrapper folder inside it. Allow the README.md replacement only after reading it; alternatively retain GitHub's existing README.
6. Return to GitHub Desktop. Write a summary: `Import corrected v0.2D and automated QA`. Click **Commit to main**, then **Push origin**.
7. Open the RTS-USA-Atlas repo on GitHub, click **Actions**, and look for the **RTS Atlas browser QA** run. If prompted to enable workflows, approve them for this trusted repo.
8. Open the run's details. After it finishes, download the **atlas-browser-qa-...** artifact. It includes screenshots, the HTML test report, and any failure traces. **Review screenshots visually**.

## What the CI workflow actually verifies

- The site is served over HTTP from its own versioned folder (port 8001), not stale localhost:8000.
- MapLibre genuinely creates a WebGL graphics context. Without WebGL, the test FAILS and does not certify visual QA.
- The map loads real 2025 Census data, not a blank canvas or a partial-loading screen.
- Idaho's label selects Idaho, selected-border screenshot is saved, county selection works, reset clears selection.
- Chicago, Denver, Phoenix, and Houston searches produce city-specific screenshots.
- A 390x844 mobile-style viewport renders and keeps basic map controls visible.
- Source syntax, Census record counts, and inset geographic transformations pass the original `qa_v02d.mjs` script.

**Limitation:** A passing test confirms the map and interactions render and run, not that the visual appearance is flawless. Review the captured screenshots for city-label drift, blobby borders, inset layout and obvious UI collisions. A desktop-sized Chromium viewport does not emulate every behavior of real iOS Safari. If WebGL fails even with software rendering enabled, the test will report a failure rather than call that a pass.

## Public repository safety

This ZIP contains public Census-derived geography, application code, a third-party renderer and its license, and tests; no secrets should be required. Do NOT add credentials, login cookies, private user data, or API keys. Preserve the original corrected v0.2D ZIP separately as your rollback reference.

## Future release discipline

- Each development chat starts by checking the repository's newest code, release tag, and last test result, rather than guessing from old ZIPs.
- Make one focused change, keep the baseline, run tests, and preserve screenshots and logs.
- If a GitHub connector cannot write to the repository, don't claim code was uploaded; use a PR where permitted or provide the user a ready-to-commit change package.
- Never claim that city positions or border appearance are visually fixed without rendered evidence from working WebGL.
