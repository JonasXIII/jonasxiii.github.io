"""geo_utils.py - distance calculation and proximity-based deduplication,
shared by the fetch scripts. Pure standard library, no dependencies.
"""
import math
from collections import defaultdict

from chain_config import SUBDEPARTMENT_KEYWORDS


def haversine_meters(lat1, lon1, lat2, lon2):
    r = 6371000  # Earth radius, meters
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_subdepartment(name):
    n = (name or "").lower()
    return any(k in n for k in SUBDEPARTMENT_KEYWORDS)


def _merge_group(records):
    """Collapse a cluster of nearby records (same physical location, seen via
    one or more sources / sub-department tags) into a single output record."""
    # Prefer a "main store" name over a sub-department one (e.g. skip past
    # "Walmart Pharmacy" in favor of plain "Walmart") if any exists.
    primary = next((r for r in records if not is_subdepartment(r.get("name"))), records[0])
    # Fill in address/city/state from whichever record has the most complete
    # info, in case the main-store point is missing fields another point has.
    best_addr = max(records, key=lambda r: sum(bool(r.get(k)) for k in ("address", "city", "state")))
    merged = dict(primary)
    for key in ("address", "city", "state"):
        if not merged.get(key) and best_addr.get(key):
            merged[key] = best_addr[key]
    merged["sources"] = sorted({s for r in records for s in r.get("sources", [])})
    return merged


def dedupe_nearby(records, threshold_m=120):
    """Collapses points within threshold_m of each other into one record -
    handles both same-source duplicates (e.g. a store mapped twice) and
    cross-source duplicates (the same store appearing in both OSM and
    Overture), plus the "Walmart" + "Walmart Pharmacy" sub-department case.

    Uses a spatial grid so this stays roughly O(n) instead of O(n^2) - matters
    once a chain's combined OSM+Overture points reach into the thousands.
    """
    if not records:
        return []

    cell_deg = threshold_m / 111000  # rough meters-per-degree latitude

    def cell_of(r):
        return (int(r["lat"] / cell_deg), int(r["lon"] / cell_deg))

    grid = defaultdict(list)
    for idx, r in enumerate(records):
        grid[cell_of(r)].append(idx)

    used = [False] * len(records)
    output = []
    for i, r in enumerate(records):
        if used[i]:
            continue
        used[i] = True
        cluster = [r]
        cy, cx = cell_of(r)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for j in grid.get((cy + dy, cx + dx), []):
                    if used[j]:
                        continue
                    if haversine_meters(r["lat"], r["lon"], records[j]["lat"], records[j]["lon"]) <= threshold_m:
                        cluster.append(records[j])
                        used[j] = True
        output.append(_merge_group(cluster))
    return output
