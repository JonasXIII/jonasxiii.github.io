# stores/data/

This directory is populated by running `scripts/fetch_store_locations.py`
locally (see the repo root). It's intentionally empty in git except for this
file — the page works fine with no data present (every chain just shows
"no data" and its toggle is disabled) so there's nothing fake checked in here.

Each chain gets its own `<slug>.json`: a flat array of
`{ id, name, lat, lon, address, city, state }` records sourced from
OpenStreetMap via the Overpass API.
