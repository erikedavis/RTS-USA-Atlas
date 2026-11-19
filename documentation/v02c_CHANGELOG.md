# v0.2C changes - 2026-11-18

- City display: removed `new maplibregl.Marker` for cities and removed CSS-dependent city positioning; instead, paint the precise map-projected coordinates each render frame into a transparent overlay canvas.
- City click priority: click tests projected city hitboxes before county/state polygons.
- City longitude/latitude: validated all 43 against 2025 Census state polygons.
- Geographic source archives: unchanged from v0.2b.
- Cache protection: new version URLs and no-store headers.
- Browser QA: pending actual browser run on user's machine because CDN unavailable here.
