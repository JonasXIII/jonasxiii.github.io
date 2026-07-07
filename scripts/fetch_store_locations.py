#!/usr/bin/env python3
"""fetch_store_locations.py - builds stores/data/<chain>.json from two real,
freely-licensed sources: OpenStreetMap (via the public Overpass API) and
Overture Maps (via its public S3-hosted Parquet places data, queried with
DuckDB) - then merges and deduplicates them, for the chain-store map page.

Two sources instead of one because either alone has real gaps: a location
you know about might not be mapped in OSM yet, and OSM sometimes tags an
in-store pharmacy/vision-center counter as its own point right next to the
main store, which would otherwise show as two separate markers for one
physical location.

Run this locally (not from any sandboxed/CI environment - some environments
block outbound calls to Overpass's /api/interpreter, and cloud storage
access, at the network level):

    python scripts/fetch_store_locations.py

Requires the standard library for the OSM half. The Overture half needs:

    pip install duckdb

...and is skipped gracefully (with a clear message) if duckdb isn't
installed - the script still produces useful OSM-only data either way. Force
OSM-only explicitly with --osm-only.

Optional: fetch just one chain while testing:

    python scripts/fetch_store_locations.py --only walmart
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

from chain_config import CHAINS, US_BOUNDS
from geo_utils import dedupe_nearby

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "MySite-ChainStoreMap/1.0 (personal hobby project; static site data refresh)"

# Overture publishes a new dated release roughly monthly - if this one 404s,
# check https://docs.overturemaps.org/release/latest/ for the current one.
OVERTURE_RELEASE = "2026-06-17.0"
OVERTURE_MIN_CONFIDENCE = 0.6

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "stores", "data")


# ---------------------------------------------------------------------------
# Source 1: OpenStreetMap via Overpass
# ---------------------------------------------------------------------------
def build_overpass_query(names):
    clauses = []
    for n in names:
        esc = n.replace('"', '\\"')
        clauses.append(f'  node["brand"="{esc}"](area.usa);')
        clauses.append(f'  node["name"="{esc}"](area.usa);')
    body = "\n".join(clauses)
    return (
        "[out:json][timeout:180];\n"
        'area["ISO3166-1"="US"][admin_level=2]->.usa;\n'
        "(\n" + body + "\n);\n"
        "out body;\n"
    )


def run_overpass_query(query, retries=3):
    data = query.encode("utf-8")
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            OVERPASS_URL,
            data=data,
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=200) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 504) and attempt < retries:
                wait = 15 * attempt
                print(f"    HTTP {e.code}, retrying in {wait}s ({attempt}/{retries})...")
                time.sleep(wait)
                continue
            raise
        except urllib.error.URLError as e:
            if attempt < retries:
                wait = 10 * attempt
                print(f"    Network error ({e.reason}), retrying in {wait}s ({attempt}/{retries})...")
                time.sleep(wait)
                continue
            raise
    return None


def in_us_bounds(lat, lon):
    return US_BOUNDS["lat_min"] <= lat <= US_BOUNDS["lat_max"] and US_BOUNDS["lon_min"] <= lon <= US_BOUNDS["lon_max"]


def extract_osm_records(overpass_json, display_name):
    records = []
    seen_ids = set()
    for el in overpass_json.get("elements", []):
        if el.get("type") != "node":
            continue
        if el["id"] in seen_ids:
            continue
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None or lon is None or not in_us_bounds(lat, lon):
            continue
        seen_ids.add(el["id"])
        tags = el.get("tags", {})
        street_bits = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
        records.append(
            {
                "name": tags.get("name", display_name),
                "lat": lat,
                "lon": lon,
                "address": street_bits,
                "city": tags.get("addr:city", ""),
                "state": tags.get("addr:state", ""),
                "sources": ["osm"],
            }
        )
    return records


def fetch_osm_chain(chain):
    query = build_overpass_query(chain["osm_names"])
    result = run_overpass_query(query)
    return extract_osm_records(result, chain["display"])


# ---------------------------------------------------------------------------
# Source 2: Overture Maps via DuckDB (optional - needs `pip install duckdb`)
# ---------------------------------------------------------------------------
_duckdb_con = None


def get_duckdb_connection():
    global _duckdb_con
    if _duckdb_con is None:
        import duckdb

        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_region='us-west-2';")
        _duckdb_con = con
    return _duckdb_con


def fetch_overture_chain(chain):
    con = get_duckdb_connection()
    brand = chain["overture_brand"].replace("'", "''")
    query = f"""
        SELECT
            names.primary AS name,
            ST_X(geometry) AS lon,
            ST_Y(geometry) AS lat,
            addresses[1].freeform AS address,
            addresses[1].locality AS city,
            addresses[1].region AS state
        FROM read_parquet(
            's3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=places/type=place/*',
            filename=true, hive_partitioning=1
        )
        WHERE brand.names.primary ILIKE '{brand}'
          AND confidence >= {OVERTURE_MIN_CONFIDENCE}
          AND (operating_status IS NULL OR operating_status = 'open')
          AND bbox.xmin BETWEEN {US_BOUNDS['lon_min']} AND {US_BOUNDS['lon_max']}
          AND bbox.ymin BETWEEN {US_BOUNDS['lat_min']} AND {US_BOUNDS['lat_max']}
    """
    rows = con.execute(query).fetchall()
    columns = [d[0] for d in con.description]
    records = []
    for row in rows:
        rec = dict(zip(columns, row))
        if rec["lat"] is None or rec["lon"] is None or not in_us_bounds(rec["lat"], rec["lon"]):
            continue
        records.append(
            {
                "name": rec["name"] or chain["display"],
                "lat": rec["lat"],
                "lon": rec["lon"],
                "address": rec.get("address") or "",
                "city": rec.get("city") or "",
                "state": rec.get("state") or "",
                "sources": ["overture"],
            }
        )
    return records


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="fetch just this one chain slug (see CHAINS in chain_config.py)")
    parser.add_argument("--delay", type=float, default=8.0, help="seconds to wait between OSM chain queries")
    parser.add_argument("--osm-only", action="store_true", help="skip Overture even if duckdb is installed")
    parser.add_argument("--dedup-threshold", type=float, default=120.0, help="merge distance in meters (default 120)")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    slugs = [args.only] if args.only else list(CHAINS.keys())
    unknown = [s for s in slugs if s not in CHAINS]
    if unknown:
        print(f"Unknown chain slug(s): {unknown}. Known: {list(CHAINS.keys())}")
        sys.exit(1)

    use_overture = not args.osm_only
    if use_overture:
        try:
            get_duckdb_connection()
        except ImportError:
            print("duckdb not installed - skipping Overture Maps (OSM-only run). Install with: pip install duckdb\n")
            use_overture = False
        except Exception as e:
            print(f"Could not initialize Overture/DuckDB access ({e}) - continuing OSM-only.\n")
            use_overture = False

    summary = []
    for i, slug in enumerate(slugs):
        chain = CHAINS[slug]
        print(f"[{i + 1}/{len(slugs)}] {chain['display']}")

        print("  Fetching OpenStreetMap...")
        try:
            osm_records = fetch_osm_chain(chain)
        except Exception as e:
            print(f"    OSM FAILED: {e}")
            osm_records = []
        print(f"    {len(osm_records)} OSM locations")

        overture_records = []
        if use_overture:
            print("  Fetching Overture Maps...")
            try:
                overture_records = fetch_overture_chain(chain)
                print(f"    {len(overture_records)} Overture locations")
            except Exception as e:
                print(f"    Overture FAILED: {e}")

        combined = osm_records + overture_records
        merged = dedupe_nearby(combined, threshold_m=args.dedup_threshold)
        both_sources = sum(1 for r in merged if len(r["sources"]) > 1)

        out_path = os.path.join(DATA_DIR, f"{slug}.json")
        # id is assigned fresh here (post-merge) rather than carried from either
        # source, since a merged record may not correspond to a single source id.
        for idx, r in enumerate(merged):
            r["id"] = idx
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=1)

        print(
            f"  -> {len(merged)} final locations "
            f"({len(osm_records)} OSM + {len(overture_records)} Overture -> "
            f"{len(combined) - len(merged)} duplicates merged, {both_sources} confirmed by both sources)"
        )
        summary.append((chain["display"], len(osm_records), len(overture_records), len(merged)))

        if i < len(slugs) - 1:
            time.sleep(args.delay)

    print("\n--- Summary ---")
    print(f"{'Chain':<16}{'OSM':>8}{'Overture':>10}{'Final':>8}")
    for name, osm_n, ov_n, final_n in summary:
        print(f"{name:<16}{osm_n:>8}{ov_n:>10}{final_n:>8}")
    print(
        "\nCounts reflect each source's current coverage for that brand - sanity-check "
        "against each chain's known approximate store count before trusting the map. "
        "Missing a location you know about? It likely isn't in either source yet - "
        "the most direct fix is adding it to OpenStreetMap yourself at openstreetmap.org, "
        "which will show up next time you re-run this script."
    )


if __name__ == "__main__":
    main()
