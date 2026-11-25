# Geographic data and provenance

The bundled boundaries are derived from the U.S. Census Bureau's 2025 1:500,000 cartographic boundary files. The manifest records the source archive URLs, checksums, vintage, coverage and processing. Facts carry their Census sources and dates. Inset transforms affect display placement while preserving source geography and identifiers. [Boundary manifest](../data/manifest.json) · [Facts sources](../data/facts_sources.json)

Run `npm run test:data` to verify state and territory, county, place and metro counts, major-city identifiers, and inset transforms. Keep authoritative inputs and their provenance when updating display-optimized geography. [QA guide](../QA_START_HERE.md) · [Historical design and source notes](V0.3A-design-and-sources.md) · [Historical visual validation](v03a_QA.md)
