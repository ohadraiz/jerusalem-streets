# Hat: Street Data and OSM

Use for street lists, identifiers, neighborhood assignment, coordinates, geometry, or data-generation pipelines.

- Treat stable street `id` values and exact neighborhood (`area`) names as data contracts. Never silently rename, merge, or remove records; retired records need a reversible archive and reason.
- OSM/ODbL is the only approved tile/data source. Preserve attribution and provenance. Do not use frozen municipal/GIS sources without written approval.
- Validate geometry in WGS84 (`lat`/`lng`), paths, bounds, duplicates, and data/geo ID consistency. Check for same-name streets outside Jerusalem, extreme lengths, and center-to-path outliers before accepting geometry.
- Neighborhood membership and family names must follow current project data; do not normalize punctuation or infer membership from name similarity alone.
- Keep data generation reproducible. Run the existing validation pipeline; inspect counts and representative changed records. Keep hand-curated facts/candidates distinct from generated data.
- Preserve provenance and reversible exclusions. Do not modify generated/bulk data when a focused script or reviewed source change is sufficient.
