import os
import json
import requests

BASE = "https://dominionrandomizer.com/img/cards"
OUT_DIR = "dominion_randomizer\data\dominion_card_imgs"

# always resolve relative to script dir
script_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(script_dir, "dominion_randomizer\data\dominion_cards.json"), "r", encoding="utf-8") as f:
    all_cards = json.load(f)

with open(os.path.join(script_dir, "dominion_randomizer\data\mysets.json"), "r", encoding="utf-8") as f:
    expansions = json.load(f)

os.makedirs(OUT_DIR, exist_ok=True)

def download_file(url, path):
    if os.path.exists(path):
        return
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        print("Downloaded:", path)
    except Exception as e:
        print("Failed:", url, e)

# recursively collect all "id" values from a nested dict/list
def collect_ids(obj, ids):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "id" and isinstance(v, str):
                ids.add(v)
            else:
                collect_ids(v, ids)
    elif isinstance(obj, list):
        for item in obj:
            collect_ids(item, ids)

for set_id, enabled in expansions.items():
    if not enabled:
        continue
    if set_id not in all_cards:
        print(f"Warning: {set_id} not found in cards.json")
        continue

    set_data = all_cards[set_id]
    set_name = set_data.get("name", set_id)
    print(f"Processing expansion: {set_name} ({set_id})")

    ids = set()
    collect_ids(set_data, ids)

    save_dir = os.path.join(OUT_DIR, set_id)
    os.makedirs(save_dir, exist_ok=True)

    for item_id in ids:
        filename = f"{item_id}.jpg"
        url = f"{BASE}/{set_id}/{filename}"
        save_path = os.path.join(save_dir, filename)
        download_file(url, save_path)

print("All done!")
