# v0.2E QA

Browser verification: headless Chrome, 1440 x 1000 and 390 x 844, software WebGL.
External requests were blocked. The app loaded with zero external requests and
zero browser errors, including the locally bundled Noto Sans glyphs.

Checked:
- Every one of the 50 states' capital and largest-city markers is rendered in the
  national camera view. Shared roles use one city feature, not duplicate markers.
- State abbreviation click zooms to that state. MI is at [-85.5, 44.1] in the mitten.
- Michigan panel: population 10,127,884; Lansing 113,884; Detroit 649,095; areas shown.
- Capital/city panel cards select and zoom to their cities. A Lansing selection
  shows 113,884 people, square miles and dated source links.
- Arizona has one combined capital/largest-city card for Phoenix.
- Honolulu search uses the Hawaii inset and displays local facts.
- AK/HI/PR controls, state selection, empty background deselection and Escape work.
- Puerto Rico county/metro search remains in the Gulf inset.
- Chicago, Detroit, Denver, Atlanta and Boston project onto their correct states.
- Michigan's selected border remains a thin continuous line with bevel joins.
- Phone layout has no horizontal overflow; controls and Escape work.

Data integrity checks verify 50 complete state records; all capital and largest-city
records have population and area; largest-city population equals the maximum
2025 place estimate in its state; city identifiers are unique. Population and area
coverage limitations are documented in README.md and reflected explicitly in UI.

National labels use native map collision placement. Every required city has a
visible point; names use available space, with hover identification and closer
zoom for crowded regions. Names do not obscure one another to force every word
onto a phone-sized national map. Physical phones and other GPU drivers were not tested.
