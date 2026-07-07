"""chain_config.py - the single list of chains, shared by every fetch script
so the OSM and Overture fetchers can never drift out of sync with each other.

slug: used for the output filename and as the map's layer id.
display: shown in the UI.
osm_names: name/brand tag variants to match in OpenStreetMap (some locations
  are tagged with the brand tag, some only have a plain name tag, some have
  minor spelling/apostrophe variants).
overture_brand: the brand name to match in Overture's `brand.names.primary`
  field (ILIKE, case-insensitive) - usually just the display name.
"""

CHAINS = {
    "target": {"display": "Target", "osm_names": ["Target"], "overture_brand": "Target"},
    "walmart": {
        "display": "Walmart",
        "osm_names": ["Walmart", "Walmart Supercenter", "Walmart Neighborhood Market"],
        "overture_brand": "Walmart",
    },
    "aldi": {"display": "Aldi", "osm_names": ["Aldi", "ALDI"], "overture_brand": "Aldi"},
    "trader-joes": {
        "display": "Trader Joe's",
        "osm_names": ["Trader Joe's", "Trader Joes"],
        "overture_brand": "Trader Joe's",
    },
    "mcdonalds": {
        "display": "McDonald's",
        "osm_names": ["McDonald's", "McDonalds"],
        "overture_brand": "McDonald's",
    },
    "jimmy-johns": {
        "display": "Jimmy John's",
        "osm_names": ["Jimmy John's", "Jimmy Johns"],
        "overture_brand": "Jimmy John's",
    },
    "kroger": {"display": "Kroger", "osm_names": ["Kroger"], "overture_brand": "Kroger"},
    "safeway": {"display": "Safeway", "osm_names": ["Safeway"], "overture_brand": "Safeway"},
    "burger-king": {"display": "Burger King", "osm_names": ["Burger King"], "overture_brand": "Burger King"},
    "red-robin": {
        "display": "Red Robin",
        "osm_names": ["Red Robin", "Red Robin Gourmet Burgers"],
        "overture_brand": "Red Robin",
    },
}

# Rough US bounding box (contiguous + AK/HI generous margin) - used by both
# fetchers to filter out stray mis-tagged/mis-geocoded points.
US_BOUNDS = {"lat_min": 17.5, "lat_max": 71.5, "lon_min": -179.5, "lon_max": -65.0}

# Sub-department / in-store-counter name fragments. When two points from
# either source land within the dedup distance of each other, the one whose
# name does NOT match one of these is preferred as the "main store" point -
# this is what collapses "Walmart" + "Walmart Pharmacy" at the same address
# into a single marker instead of two.
SUBDEPARTMENT_KEYWORDS = [
    "pharmacy",
    "vision",
    "optical",
    "fuel",
    "gas station",
    "gas",
    "auto care",
    "tire",
    "garden center",
    "photo",
    "portrait",
    "starbucks",
    "subway",
    "money center",
    "wireless",
]
