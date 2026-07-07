# stores/data/

This directory is populated by running `scripts/fetch_store_locations.py`
locally (see the repo root). It's fine for it to be empty — the page works
fine with no data present (every chain just shows "no data" and its toggle
is disabled) so there's nothing fake checked in here.

Each chain gets its own `<slug>.json`: a flat array of
`{ id, name, lat, lon, address, city, state, sources }` records, cross-
referenced from two independent open sources:

- **OpenStreetMap**, via the public Overpass API - community-tagged points.
- **Overture Maps** (backed by Microsoft/Meta/Amazon/TomTom), via its public
  S3-hosted Parquet data queried with DuckDB - optional, needs
  `pip install duckdb`; the script falls back to OSM-only if it's missing.

Points from both sources within ~120m of each other are merged into one
record (`sources` lists which source(s) found it - `["osm","overture"]` means
both independently confirmed it). This also collapses cases like an in-store
"Walmart Pharmacy" counter that OSM tags as its own point right next to the
main "Walmart" store - those merge into a single marker.

The data still won't be perfectly complete or duplicate-free - it reflects
whatever both sources currently have mapped. If you know of a real location
that's missing, the most direct fix is adding it to OpenStreetMap yourself at
openstreetmap.org; it'll show up next time this script re-runs.
