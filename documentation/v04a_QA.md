# USAtlas V0.4A verification — November 19, 2026

Internal project: RTS America. Editable source remains work/USA_Atlas_v0_3a.

- Largest city tier: regular ten-sided polygon, shared by map and key.
- Map icon raster: 128 x 128 at pixel ratio 4, preserving logical dimensions. Key canvases: 104 x 104 in the existing 26-pixel display box. Hover glow unchanged.
- Counties: off by default; boundary and hit layers start at zoom 4.5, with subtle visible outlines. Region loading starts at 4.5 as well.
- Manual MSA visibility already supported zoom 8.8 and closer; verified at 8.8 and 10 without changing the existing automatic 7.55–9.15 band or collision rules.
- Full desktop regression passed: tight city labels, fixed coastal badges during pans, national and regional views, Boise, small towns, metro views, state framing, Great Lakes, interactions and hover.
- Focused browser checks passed for selected Minnesota and Texas at 4.5, and Illinois/Cook County and California/Los Angeles at 8.8. Manual MSA boundaries also passed at zoom 10. Key, Minnesota, Cook County, and Los Angeles screenshots were visually reviewed.
- Installed build passed local renderer, version header, map key, Zumbrota search/population, and counties-off smoke checks. No browser errors.
- Installed files and ZIP contents verified byte-for-byte against working source; ZIP integrity passed.

Repeat from workspace root:

    node work/check-v04a.cjs --spacing --full
    node work/check-v04a-style.cjs --style
    node work/smoke-installed-v04a.cjs

Delivery: Desktop/RTS/Versions/V0.4A/USAtlas_v0_4a and matching USAtlas_v0_4a.zip. Existing Start USA Atlas.lnk points to this build. Phone compatibility remains the next phase.
