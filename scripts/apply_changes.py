#!/usr/bin/env python3
"""
apply_changes.py - Apply changes.json to MTG collection data files.

Usage:
    python scripts/apply_changes.py [changes.json] [--data-dir ./mtg/data]

Reads a changes.json file exported from the MTG Collection Manager web UI
and applies the described modifications to collection.json, decks.json,
and binders.json. Validates allocations and writes clean, sorted output.
"""

import json
import sys
import os
from datetime import datetime


def load_json(filepath):
    """Load a JSON file, return empty structure if not found."""
    if not os.path.exists(filepath):
        # Return appropriate empty structure based on filename
        if 'collection' in filepath:
            return {}
        return []
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(filepath, data, sort_keys=True):
    """Write JSON with consistent formatting."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=sort_keys)
        f.write('\n')


def apply_collection_changes(collection, changes):
    """Apply collection_changes to the collection dict."""
    for change in changes:
        action = change.get('action')
        sid = change.get('scryfall_id')

        if action == 'add':
            if sid in collection:
                # Card already exists, increase quantity
                collection[sid]['quantity'] += change.get('quantity', 1)
                print(f"  + Updated quantity of {change.get('name', sid)}: "
                      f"now {collection[sid]['quantity']}")
            else:
                collection[sid] = {
                    'quantity': change.get('quantity', 1),
                    'oracle_id': change.get('oracle_id', ''),
                    'name': change.get('name', ''),
                    'set': change.get('set', ''),
                    'collector_number': change.get('collector_number', '')
                }
                print(f"  + Added {change.get('name', sid)} "
                      f"({change.get('set', '').upper()}) x{change.get('quantity', 1)}")

        elif action == 'update_quantity':
            new_qty = change.get('new_quantity', 0)
            if sid in collection:
                old_qty = collection[sid]['quantity']
                collection[sid]['quantity'] = new_qty
                print(f"  ~ Updated {collection[sid].get('name', sid)}: "
                      f"{old_qty} -> {new_qty}")
            else:
                print(f"  ! Warning: Cannot update quantity for {sid} "
                      f"(not in collection)")

        elif action == 'remove':
            if sid in collection:
                name = collection[sid].get('name', sid)
                del collection[sid]
                print(f"  - Removed {name}")
            else:
                print(f"  ! Warning: Cannot remove {sid} (not in collection)")

        else:
            print(f"  ! Unknown collection action: {action}")


def apply_deck_changes(decks, changes):
    """Apply deck_changes to the decks list."""
    deck_map = {d['id']: i for i, d in enumerate(decks)}

    for change in changes:
        action = change.get('action')

        if action == 'create':
            deck = change.get('deck', {})
            if deck.get('id') in deck_map:
                print(f"  ! Warning: Deck {deck.get('id')} already exists, skipping create")
            else:
                decks.append(deck)
                deck_map[deck['id']] = len(decks) - 1
                print(f"  + Created deck: {deck.get('name', deck.get('id'))}")

        elif action == 'update':
            deck_id = change.get('deck_id')
            if deck_id in deck_map:
                idx = deck_map[deck_id]
                decks[idx] = change.get('deck', decks[idx])
                print(f"  ~ Updated deck: {decks[idx].get('name', deck_id)}")
            else:
                print(f"  ! Warning: Deck {deck_id} not found for update")

        elif action == 'delete':
            deck_id = change.get('deck_id')
            if deck_id in deck_map:
                idx = deck_map[deck_id]
                name = decks[idx].get('name', deck_id)
                decks.pop(idx)
                # Rebuild map since indices shifted
                deck_map = {d['id']: i for i, d in enumerate(decks)}
                print(f"  - Deleted deck: {name}")
            else:
                print(f"  ! Warning: Deck {deck_id} not found for delete")

        else:
            print(f"  ! Unknown deck action: {action}")


def apply_binder_changes(binders, changes):
    """Apply binder_changes to the binders list."""
    binder_map = {b['id']: i for i, b in enumerate(binders)}

    for change in changes:
        action = change.get('action')

        if action == 'create':
            binder = change.get('binder', {})
            if binder.get('id') in binder_map:
                print(f"  ! Warning: Binder {binder.get('id')} already exists, skipping")
            else:
                binders.append(binder)
                binder_map[binder['id']] = len(binders) - 1
                print(f"  + Created binder: {binder.get('name', binder.get('id'))}")

        elif action == 'update':
            binder_id = change.get('binder_id')
            if binder_id in binder_map:
                idx = binder_map[binder_id]
                binders[idx] = change.get('binder', binders[idx])
                print(f"  ~ Updated binder: {binders[idx].get('name', binder_id)}")
            else:
                print(f"  ! Warning: Binder {binder_id} not found for update")

        elif action == 'delete':
            binder_id = change.get('binder_id')
            if binder_id in binder_map:
                idx = binder_map[binder_id]
                name = binders[idx].get('name', binder_id)
                binders.pop(idx)
                binder_map = {b['id']: i for i, b in enumerate(binders)}
                print(f"  - Deleted binder: {name}")
            else:
                print(f"  ! Warning: Binder {binder_id} not found for delete")

        else:
            print(f"  ! Unknown binder action: {action}")


def validate_allocations(collection, decks, binders):
    """Check that allocations don't exceed owned quantities."""
    allocations = {}

    for deck in decks:
        for card in deck.get('cards', []):
            sid = card['scryfall_id']
            allocations.setdefault(sid, 0)
            allocations[sid] += card.get('quantity', 1)

    for binder in binders:
        for card in binder.get('cards', []):
            sid = card['scryfall_id']
            allocations.setdefault(sid, 0)
            allocations[sid] += card.get('quantity', 1)

    warnings = 0
    for sid, allocated in allocations.items():
        owned = collection.get(sid, {}).get('quantity', 0)
        if allocated > owned:
            name = collection.get(sid, {}).get('name', sid)
            print(f"  ! Over-allocated: {name} - own {owned}, assigned {allocated}")
            warnings += 1

    if warnings == 0:
        print("  All allocations valid.")
    else:
        print(f"  {warnings} over-allocation warning(s).")


def sort_collection(collection):
    """Sort collection by card name then set."""
    return dict(sorted(
        collection.items(),
        key=lambda x: (x[1].get('name', '').lower(), x[1].get('set', ''))
    ))


def main():
    # Parse arguments
    changes_path = 'changes.json'
    data_dir = './mtg/data'

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--data-dir' and i + 1 < len(args):
            data_dir = args[i + 1]
            i += 2
        elif not args[i].startswith('--'):
            changes_path = args[i]
            i += 1
        else:
            i += 1

    # Check changes file exists
    if not os.path.exists(changes_path):
        print(f"Error: {changes_path} not found.")
        print(f"Usage: python scripts/apply_changes.py [changes.json] [--data-dir ./mtg/data]")
        sys.exit(1)

    print(f"Loading changes from: {changes_path}")
    print(f"Data directory: {data_dir}")
    print()

    # Load all files
    changes = load_json(changes_path)
    collection = load_json(os.path.join(data_dir, 'collection.json'))
    decks = load_json(os.path.join(data_dir, 'decks.json'))
    binders = load_json(os.path.join(data_dir, 'binders.json'))

    print(f"Changes timestamp: {changes.get('timestamp', 'unknown')}")
    print()

    # Apply collection changes
    cc = changes.get('collection_changes', [])
    if cc:
        print(f"Applying {len(cc)} collection change(s):")
        apply_collection_changes(collection, cc)
        print()

    # Apply deck changes
    dc = changes.get('deck_changes', [])
    if dc:
        print(f"Applying {len(dc)} deck change(s):")
        apply_deck_changes(decks, dc)
        print()

    # Apply binder changes
    bc = changes.get('binder_changes', [])
    if bc:
        print(f"Applying {len(bc)} binder change(s):")
        apply_binder_changes(binders, bc)
        print()

    # Validate allocations
    print("Validating allocations:")
    validate_allocations(collection, decks, binders)
    print()

    # Sort and save
    collection = sort_collection(collection)
    save_json(os.path.join(data_dir, 'collection.json'), collection)
    save_json(os.path.join(data_dir, 'decks.json'), decks, sort_keys=False)
    save_json(os.path.join(data_dir, 'binders.json'), binders, sort_keys=False)

    print("Data files updated successfully.")

    # Rename changes file as backup
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.dirname(changes_path) or '.'
    backup_name = f"changes_{timestamp}.json"
    backup_path = os.path.join(backup_dir, backup_name)
    os.rename(changes_path, backup_path)
    print(f"Changes file backed up to: {backup_path}")
    print()
    print("Done! Commit the updated data files to git.")


if __name__ == '__main__':
    main()
