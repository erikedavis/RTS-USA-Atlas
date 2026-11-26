# USAtlas QA

Install Node.js and Python 3. From the root of the build you are checking, run:

```sh
npm install
npx playwright install chromium
npm test
```

`npm run test:data` runs the Census checks separately. The browser suite serves the checkout over HTTP on port **8001** and requires a working WebGL context and rendered geography. GitHub Actions runs on pushes to `main`, on pull requests and by manual dispatch. Inspect the report, screenshots and traces for the exact commit tested. [Browser QA runs](https://github.com/erikedavis/RTS-USA-Atlas/actions/workflows/browser-qa.yml)

## Public release check

After a major tag deploys, open the public HTTPS site on desktop and a phone-sized browser. Verify the displayed version, map, Search, and theme switch. The /release.json file records the exact deployed commit. [Public atlas](https://erikedavis.github.io/RTS-USA-Atlas/) · [Deployment runs](https://github.com/erikedavis/RTS-USA-Atlas/actions/workflows/pages.yml)

## Regression checks

- Compare national, Northeast, Boise and dense city views. Check fixed small-state anchors, continuous outlines, population-symbol placement, the seven key tiers and capital marks. Use the relevant accepted build and matched camera settings.
- Check search, selection, Atlas framing and Back on the builds that support them. Verify that county picking requires the overlay and an eligible zoom, and that enabling the metro overlay keeps it visible at close zoom. Check Alaska, Hawaii and Puerto Rico framing and label placement.
- Test desktop and phone portrait and landscape. Exercise tap, hold, drag, pinch and compass gestures for the build under test. For rotation, check the accepted bearing matrix **0°, 37°, 90°, 133°, 180°, 270°, 359° and return to north**.
- For performance comparisons, record the device, browser, build, workload and settings. Measure startup time and bytes, layer latency, available memory and interaction responsiveness separately.

Record exact build identity, visible results, failures and open checks. Distinguish browser emulation, physical-device tests, owner acceptance and deployment. [Release QA foundation](https://chatgpt.com/space/page_75ff79f71f448191a105172bce0000e4) · [Rotation acceptance](https://chatgpt.com/space/page_01483e9a9d0c8191a9b6bfc704df8790) · [Earlier QA reports in Git history](https://github.com/erikedavis/RTS-USA-Atlas/tree/56b0d90f4e9109f556d065c2644147e81c0be8aa/documentation)
