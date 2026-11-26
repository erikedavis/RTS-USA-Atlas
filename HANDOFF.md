# USAtlas development handoff

## Current release and work order

[Open USAtlas on GitHub Pages](https://erikedavis.github.io/RTS-USA-Atlas/) or use the matching [release package](https://github.com/erikedavis/RTS-USA-Atlas/releases/latest) for a local preview. The number beside Search identifies the running version. [Launcher guide](README.md)

Phase 00 is approved. Phase 01 records the accepted compass behavior and remaining checks. Phase 02 covers the light and dark appearances. The upper-left map control switches themes while preserving the camera, selection and open Atlas page. Follow the current work order for the data and Analysis sequence. [Master roadmap](https://chatgpt.com/space/page_6affb6a6cbe081918987b3c16f87814d) · [Phase 01](https://chatgpt.com/space/page_01483e9a9d0c8191a9b6bfc704df8790) · [Phase 02](https://chatgpt.com/space/page_255c787b41308191bcc27bf0ebd9d35a)

## Behavior to preserve

- A tap on state land, city, county or metro opens facts. A state abbreviation fits the state. Phone holds open Atlas. Desktop **Atlas** opens detailed facts and **Back** restores the prior camera.
- Preserve the linked geography, layer scope and C14 header. Dark mode uses gold active accents and light mode uses ultramarine. Light mode uses a gold lock, a grey locked rose, and an ultramarine-and-black unlocked rose.
- **Home** opens USA Stats. **CONUS** frames the lower 48 and D.C. **ALL** also fits Alaska across the Aleutians, Hawaii and Puerto Rico in their geographic positions. Major city names take priority over geography labels.
- Hiding the compass preserves the lock and bearing. The phone's edge chevron restores it. On desktop, **WASD** or arrow keys pan, **L** toggles the lock, **Q/E** rotate and **N** returns north while unlocked, and **R** returns north and locks.
- Dismissing Search suggestions keeps the query. Refocusing the field shows the matches again.

## Release discipline

Keep intermediate builds local. Push only approved major tags in the **V<number>.0A** format. The Pages workflow checks the tag against the application version and publishes the packaged site to the stable URL. Record the exact commit, deployment and verification. Retain at most seven separate numbered packages and preserve Git history. [Release policy](https://chatgpt.com/space/page_f96cf5ac6a4081918884f5e221fa135f)
