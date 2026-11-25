# USAtlas

USAtlas is an interactive atlas of U.S. Census geography and facts. It runs from a local HTTP server with bundled data and MapLibre.

## Choose a build

| Build | Where to open it |
| --- | --- |
| Default GitHub checkout, V0.8A | Clone or download `main`. |
| Latest published numbered preview, V0.9G | [Download the verified source ZIP](https://github.com/erikedavis/RTS-USA-Atlas/archive/72973519ca21c499a8ab998a2dc20b3a9b1050ea.zip). |
| Current local development preview | On the configured Windows PC, open **Start USA Atlas** and check the build in the browser. The owner's local start guide records the matching build and QA. |

## Run on Windows

Install Python 3. Clone or extract the complete build, then run **Start_Atlas.cmd** from that folder to open the PC preview. The standalone desktop default is port **8017** on V0.8A and **8020** on V0.9G. The shared **Start USA Atlas** shortcut on the configured PC starts the installed build and can choose another local port.

For iPhone, connect the PC and phone to the same trusted Wi-Fi. On the PC, run **Start_Phone_Preview.cmd** from the extracted build. Keep the launcher window open and enter the address it prints in Safari. The default is port **8016** on V0.8A and **8019** on V0.9G.

## Reference

Use the [development handoff](HANDOFF.md) for accepted behavior and the next phase, the [QA guide](QA_START_HERE.md) for checks, and the [source notes](documentation/DATA_QA.md) for provenance.
