# USAtlas development handoff

## Build and work order

As verified November 25, 2026, **V0.9K** at `90d7c1f97899f15de99036ff5baf3d0f86877c3f` is the installed PC and iPhone preview on the owner's Windows machine. GitHub's newest numbered branch build is **V0.9G**. The default branch checkout is **V0.8A**. Use the local **Start USA Atlas** shortcut or the launchers for the build you intend to inspect. [Launcher guide](README.md)

Phases **00** and **01** are user approved. **Phase 02** is next and its light palette needs owner approval. Theme work must preserve bearing, zoom, camera position, selection, layer state and Atlas navigation. Follow the current work order for the later data and Analysis sequence. [Master roadmap](https://chatgpt.com/space/page_6affb6a6cbe081918987b3c16f87814d) · [Current work order](https://chatgpt.com/space/page_b277448c73088191b7d1392b6c84d587)

## Preserve in the current preview

- A tap on state land or a city name opens facts in place. The state abbreviation or city symbol fits or zooms to the selection. On a phone, a hold opens Atlas, and leaving State Atlas keeps the current camera. On desktop, the sidebar **Atlas** opens the detailed view and **Back** restores the prior camera. Back from a linked city returns to the originating state.
- Preserve nested geography links, county and metro scope, and the compact C14 header. Active controls use gold lettering and borders with dark faces. The phone's bottom **Layers** and header **Tools → Layers** share the gold **Standard** setting. The desktop hide chevron sits inside the sidebar's map-side edge.
- **Home** frames USA Stats. **CONUS** and **ALL** change framing, and Alaska and Hawaii remain reachable in either. Preserve Puerto Rico, the Great Lakes, the approved Northeast anchors and upright labels at rotated bearings.
- On desktop, drag the unlocked compass to turn, and use **WASD** or arrow keys to pan. On a phone, tap the rose to unlock before tapping a heading. A swipe right resets north, locks, and hides the compass. Tap its edge chevron or swipe left near it to restore the locked rose.

The historical acceptance records and checks remain available. [Phase 00](https://chatgpt.com/space/page_75ff79f71f448191a105172bce0000e4) · [Phase 01](https://chatgpt.com/space/page_01483e9a9d0c8191a9b6bfc704df8790) · [V0.8L compass and label acceptance source](https://github.com/erikedavis/RTS-USA-Atlas/commit/6b7ea7bdd1f918860eb19694255685abc4151456)

## Release discipline

For every build, record its exact commit, verification and open checks. Keep interim builds local. The next GitHub application releases are **1.0A**, then **2.0A**, unless Erik directs otherwise. Retain at most seven separate numbered packages and keep Git history intact. [Release policy](https://chatgpt.com/space/page_f96cf5ac6a4081918884f5e221fa135f)
