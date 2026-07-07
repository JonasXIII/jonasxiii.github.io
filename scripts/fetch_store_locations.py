#!/usr/bin/env python3
"""fetch_store_locations.py - builds stores/data/<chain>.json from real,
freely-licensed OpenStreetMap data (via the public Overpass API), for the
chain-store map page.

Run this locally (not from any sandboxed/CI environment - some environments
block outbound calls to Overpass's /api/interpreter at the network level):

    python scripts/fetch_store_locations.py

Optional: fetch just one chain while testing:

    python scripts/fetch_store_locations.py --only walmart

This uses only the Python standard library (no pip install needed). It is
polite to the free public Overpass instance: one query per chain, a delay
between chains, and retries with backoff on timeout/rate-limit responses.
Data completeness depends on how thoroughly OpenStreetMap contributors have
tagged that brand - the per-chain counts printed at the end make gaps visible
rather than silent. Re-run any time to refresh the data.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "MySite-ChainStoreMap/1.0 (personal hobby project; static site data refresh)"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "stores", "data")

# slug -> { display, names } - "names" covers common tagging variants (brand
# tag AND plain name tag, since not every mapped location has the brand tag
# set even when it clearly is that chain).
CHAINS = {
    "target": {"display": "Target", "names": ["Target"]},
    "walmart": {"display": "Walmart", "names": ["Walmart", "Walmart Supercenter", "Walmart Neighborhood Market"]},
    "aldi": {"display": "Aldi", "names": ["Aldi", "ALDI"]},
    "trader-joes": {"display": "Trader Joe's", "names": ["Trader Joe's", "Trader Joes"]},
    "mcdonalds": {"display": "McDonald's", "names": ["McDonald's", "McDonalds"]},
    "jimmy-johns": {"display": "Jimmy John's", "names": ["Jimmy John's", "Jimmy Johns"]},
    "kroger": {"display": "Kroger", "names": ["Kroger"]},
    "safeway": {"display": "Safeway", "names": ["Safeway"]},
    "burger-king": {"display": "Burger King", "names": ["Burger King"]},
    "red-robin": {"display": "Red Robin", "names": ["Red Robin", "Red Robin Gourmet Burgers"]},
}

# Rough US bounding box (contiguous + AK/HI generous margin) to filter out
# any stray mis-tagged nodes that would otherwise render as wild outliers.
US_BOUNDS = {"lat_min": 17.5, "lat_max": 71.5, "lon_min": -179.5, "lon_max": -65.0}


def build_query(names):
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


def run_query(query, retries=3):
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


def extract_records(overpass_json, display_name):
    records = []
    seen_ids = set()
    for el in overpass_json.get("elements", []):
        if el.get("type") != "node":
            continue
        if el["id"] in seen_ids:
            continue
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None or lon is None:
            continue
        if not (US_BOUNDS["lat_min"] <= lat <= US_BOUNDS["lat_max"] and US_BOUNDS["lon_min"] <= lon <= US_BOUNDS["lon_max"]):
            continue
        seen_ids.add(el["id"])
        tags = el.get("tags", {})
        street_bits = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
        records.append(
            {
                "id": el["id"],
                "name": tags.get("name", display_name),
                "lat": lat,
                "lon": lon,
                "address": street_bits,
                "city": tags.get("addr:city", ""),
                "state": tags.get("addr:state", ""),
            }
        )
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="fetch just this one chain slug (see CHAINS in this file)")
    parser.add_argument("--delay", type=float, default=8.0, help="seconds to wait between chain queries")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    slugs = [args.only] if args.only else list(CHAINS.keys())
    unknown = [s for s in slugs if s not in CHAINS]
    if unknown:
        print(f"Unknown chain slug(s): {unknown}. Known: {list(CHAINS.keys())}")
        sys.exit(1)

    summary = {}
    for i, slug in enumerate(slugs):
        chain = CHAINS[slug]
        print(f"[{i + 1}/{len(slugs)}] Fetching {chain['display']}...")
        query = build_query(chain["names"])
        try:
            result = run_query(query)
        except Exception as e:
            print(f"  FAILED: {e}")
            summary[chain["display"]] = "FAILED"
            continue

        records = extract_records(result, chain["display"])
        out_path = os.path.join(DATA_DIR, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=1)
        print(f"  {len(records)} locations -> {os.path.relpath(out_path, os.path.join(SCRIPT_DIR, ''))}")
        summary[chain["display"]] = len(records)

        if i < len(slugs) - 1:
            time.sleep(args.delay)

    print("\n--- Summary ---")
    for name, count in summary.items():
        print(f"  {name}: {count}")
    print(
        "\nCounts reflect OpenStreetMap's current coverage for each brand - sanity-check "
        "against each chain's known approximate store count before trusting the map."
    )


if __name__ == "__main__":
    main()
