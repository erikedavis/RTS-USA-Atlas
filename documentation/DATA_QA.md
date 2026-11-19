# Source / QA notes

**Input:** Four 2025 Census 1:500,000 cartographic boundary ZIPs uploaded by the owner.

This release uses no legacy preview basemap polygons. The raw source archives are retained under `source/census_2025/`. Derived geometries are generated for rendering, with identifiers and boundary vintage preserved. No geometry was fabricated for any state, county, municipality or metro.

Known gaps: source data itself contains no population or historical data; no river/road/terrain layers; no complete country-level basemap outside the 56 US state-level entities. Coastal water colors are visual styling, not hydrography. Public production hosting and live cross-device QA not yet performed.
