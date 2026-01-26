#!/usr/bin/env python3
"""
import_csv.py - Convert Archidekt CSV export to collection.json

Usage:
    python import_csv.py [csv_file] [--output ./mtg/data/collection.json]

Reads an Archidekt CSV export and produces a collection.json compatible
with the MTG Collection Manager. Foil/Etched cards that share a Scryfall ID
with a Normal version get a composite key (e.g. "id:foil").
"""

import csv
import json
import sys
import os


def main():
    csv_path = None
    output_path = os.path.join('.', 'mtg', 'data', 'collection.json')

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--output' and i + 1 < len(args):
            output_path = args[i + 1]
            i += 2
        elif not args[i].startswith('--'):
            csv_path = args[i]
            i += 1
        else:
            i += 1

    # Auto-detect CSV if not specified
    if not csv_path:
        data_dir = os.path.join('.', 'mtg', 'data')
        csvs = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
        if len(csvs) == 1:
            csv_path = os.path.join(data_dir, csvs[0])
        elif len(csvs) > 1:
            print(f"Multiple CSV files found in {data_dir}. Specify which one:")
            for c in csvs:
                print(f"  {c}")
            sys.exit(1)
        else:
            print(f"No CSV files found in {data_dir}.")
            sys.exit(1)

    print(f"Reading: {csv_path}")
    print(f"Output:  {output_path}")
    print()

    # First pass: collect all entries, detect conflicts
    entries = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append({
                'quantity': int(row['Quantity']),
                'name': row['Name'],
                'finish': row['Finish'],
                'set': row['Edition Code'].lower(),
                'scryfall_id': row['Scryfall ID'],
                'collector_number': row['Collector Number']
            })

    # Detect scryfall_id conflicts (same ID, different finish)
    id_finishes = {}
    for entry in entries:
        sid = entry['scryfall_id']
        id_finishes.setdefault(sid, set()).add(entry['finish'])

    conflicts = {sid for sid, finishes in id_finishes.items() if len(finishes) > 1}
    if conflicts:
        print(f"Found {len(conflicts)} card(s) with multiple finishes for same ID:")
        for sid in conflicts:
            names = [e['name'] for e in entries if e['scryfall_id'] == sid]
            print(f"  {names[0]} ({sid}): {id_finishes[sid]}")
        print()

    # Build collection dict
    collection = {}
    for entry in entries:
        sid = entry['scryfall_id']
        finish = entry['finish']

        # Determine key
        if sid in conflicts and finish != 'Normal':
            key = f"{sid}:{finish.lower()}"
        else:
            key = sid

        if key in collection:
            # Same key already exists, add quantities
            collection[key]['quantity'] += entry['quantity']
            print(f"  Merged duplicate: {entry['name']} ({key})")
        else:
            collection[key] = {
                'quantity': entry['quantity'],
                'oracle_id': '',
                'name': entry['name'],
                'set': entry['set'],
                'collector_number': entry['collector_number'],
                'finish': finish.lower()
            }

    # Sort by name then set
    collection = dict(sorted(
        collection.items(),
        key=lambda x: (x[1]['name'].lower(), x[1]['set'])
    ))

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # Stats
    total_cards = sum(e['quantity'] for e in collection.values())
    finishes = {}
    for e in collection.values():
        finishes[e['finish']] = finishes.get(e['finish'], 0) + e['quantity']

    print(f"Imported {len(collection)} unique entries ({total_cards} total cards)")
    for finish, count in sorted(finishes.items()):
        print(f"  {finish}: {count}")
    print(f"\nWritten to {output_path}")


if __name__ == '__main__':
    main()
