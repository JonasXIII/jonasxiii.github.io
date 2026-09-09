#!/usr/bin/env python3
"""build_pack_data.py - builds packs/data/packs.json for the Pack EV page.

Source: taw/magic-sealed-data (sealed_basic_data.json on GitHub), the same
dataset that powers mtg.wtf/pack/*. It gives, per sealed product, the
weighted "variants" (physical pack configurations) and the "sheets" each
variant draws from (weighted card lists). Release dates + set icons come
from the public Scryfall /sets API, used only to sort packs chronologically
and show a "not yet released" badge - not for card prices (those are
fetched live, client-side, on page load).

Output shape (compact, one entry per pack in PACKS below):
    {
      "code": "fdn-play", "name": "Foundations Play Booster",
      "set_code": "fdn", "set_name": "Foundations", "released_at": "2024-11-15",
      "icon": "https://svgs.scryfall.io/sets/fdn.svg",
      "variants": [ { "weight": N, "slots": { sheet_name: count, ... } }, ... ],
      "sheets": {
        sheet_name: { "foil": bool, "total": N, "cards": [ [set, number, weight], ... ] }
      }
    }

Cards carry their own `set` (not just the sheet) because some sheets mix
sets - e.g. "the_list" pulls from `spg`+`plst`, and some wildcard/foil
sheets span a set and its bonus-sheet companion (`eoe`+`eos`, `mh3`+`m3c`).
Verified: every sheet's card weights sum exactly to its total_weight, and
every card's finish (foil/nonfoil) is uniform within its sheet, across all
18 packs below (checked by hand before writing this script).

Run:
    python scripts/build_pack_data.py
"""
import json
import urllib.request
from pathlib import Path

SEALED_DATA_URL = "https://raw.githubusercontent.com/taw/magic-sealed-data/master/sealed_basic_data.json"
SCRYFALL_SETS_URL = "https://api.scryfall.com/sets"
OUT_PATH = Path(__file__).resolve().parent.parent / "packs" / "data" / "packs.json"

# The 18 current-era "Play Booster" products (the standard modern pack type,
# one per Standard-legal set since Foundations). Add a new "<code>-play"
# entry here and rerun this script when a new set releases.
PACK_CODES = [
    "mkm-play", "otj-play", "mh3-play", "blb-play", "dsk-play", "fdn-play",
    "inr-play", "dft-play", "tdm-play", "fin-play", "eoe-play", "spm-play",
    "tla-play", "ecl-play", "tmt-play", "sos-play", "msh-play", "hob-play",
]


def fetch_json(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "jonasloeser.com pack-ev builder",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def to_compact_sheet(sheet):
    cards = []
    foils = set()
    for key, weight in sheet["cards"].items():
        parts = key.split(":")
        set_code, number = parts[0], parts[1]
        finish = parts[2] if len(parts) > 2 else "nonfoil"
        foils.add(finish)
        cards.append([set_code, number, weight])
    if len(foils) != 1:
        raise ValueError(f"sheet mixes finishes: {foils}")
    return {
        "foil": foils.pop() == "foil",
        "total": sheet["total_weight"],
        "cards": cards,
    }


def build_pack(raw, set_meta):
    variants = [{"weight": b["weight"], "slots": b["sheets"]} for b in raw["boosters"]]
    sheets = {name: to_compact_sheet(sheet) for name, sheet in raw["sheets"].items()}
    meta = set_meta.get(raw["set_code"], {})
    return {
        "code": raw["code"],
        "name": raw["name"],
        "set_code": raw["set_code"],
        "set_name": raw["set_name"],
        "released_at": meta.get("released_at"),
        "icon": meta.get("icon_svg_uri"),
        "variants": variants,
        "sheets": sheets,
    }


def main():
    print("Fetching sealed pack collation data...")
    sealed_data = fetch_json(SEALED_DATA_URL)
    by_code = {d["code"]: d for d in sealed_data}

    print("Fetching Scryfall set metadata...")
    sets_data = fetch_json(SCRYFALL_SETS_URL)
    set_meta = {
        s["code"]: {"released_at": s.get("released_at"), "icon_svg_uri": s.get("icon_svg_uri")}
        for s in sets_data["data"]
    }

    packs = []
    for code in PACK_CODES:
        raw = by_code.get(code)
        if raw is None:
            print(f"  ! skipping {code}: not found in sealed_basic_data.json")
            continue
        packs.append(build_pack(raw, set_meta))
        print(f"  + {code}: {raw['name']}")

    packs.sort(key=lambda p: p["released_at"] or "9999")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(packs, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(packs)} packs to {OUT_PATH} ({OUT_PATH.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
