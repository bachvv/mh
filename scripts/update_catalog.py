#!/usr/bin/env python3
"""
Scrape michaelhill.ca catalog via Constructor.io API and update catalog.json.
Detects new items (not in existing catalog) and adds them.

Run weekly via cron:
  0 6 * * 0 cd /home/bach/projects/mh && /usr/bin/python3 scripts/update_catalog.py >> /tmp/mh-catalog-update.log 2>&1

Category mapping from API subcategory to catalog.json keys.
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

API_BASE = "https://ac.cnstrc.com/browse/group_id/jewellery_shop-all"
API_KEY = "key_96F2Jto3eRccQGKB"
PAGE_SIZE = 100
CATALOG_FILE = Path(__file__).parent.parent / "src" / "data" / "catalog.json"

# Map Constructor.io mHJSubCategory values to catalog.json category keys
CATEGORY_MAP = {
    "Bracelets": "Bracelets-Bangles",
    "Bangles": "Bracelets-Bangles",
    "Pendants": "Pendants",
    "Necklaces": "Pendants",
    "Earrings": "Earrings",
    "Rings": "Rings",
    "Chains": "Chains",
    "Accessories": "Accessories",
    "Wedding Bands": "Wedders",
    "Wedding": "Wedders",
    "Engagement Rings": "Engagement",
    "Engagement": "Engagement",
    "Box Sets": "Box Sets",
    "Solitaires": "Solitaires",
}


def fetch_page(offset: int) -> dict:
    params = {
        "c": "ciojs-client-2.71.1",
        "key": API_KEY,
        "i": "scraper-mh",
        "s": "1",
        "offset": offset,
        "num_results_per_page": PAGE_SIZE,
    }
    resp = requests.get(API_BASE, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_product(result: dict) -> dict | None:
    data = result.get("data", {})
    facets = {f["name"]: f["values"] for f in data.get("facets", [])}

    sku_values = facets.get("sku", [])
    if not sku_values:
        return None
    sku = str(sku_values[0])

    name = result.get("value", "")

    # Determine category
    sub_cat = facets.get("mHJSubCategory", [])
    category = None
    if sub_cat:
        raw = sub_cat[0]
        category = CATEGORY_MAP.get(raw)
        if not category:
            # Try partial match
            for key, val in CATEGORY_MAP.items():
                if key.lower() in raw.lower():
                    category = val
                    break
    if not category:
        category = "Uncategorized"

    # Extract images
    image_urls = []
    for key, url in sorted(data.get("image_urls", {}).items()):
        if url:
            image_urls.append(url)
    for swatch in data.get("swatches", []):
        for key, url in sorted(swatch.get("image_urls", {}).items()):
            if url:
                image_urls.append(url)

    # Remove duplicates preserving order
    seen = set()
    unique_images = []
    for u in image_urls:
        if u not in seen:
            seen.add(u)
            unique_images.append(u)

    # Build catalog entry format: extract filename from URL path
    # URL format: /on/demandware.static/-/Sites-MHJ_Master/default/images/P{sku}/{filename}
    image_filenames = []
    for u in unique_images:
        parts = u.rstrip("/").split("/")
        if parts:
            image_filenames.append(parts[-1])

    main_image = image_filenames[0] if image_filenames else None

    return {
        "s": sku,
        "n": name,
        "p": f"P{sku}",
        "m": main_image,
        "i": image_filenames,
        "category": category,
    }


def main():
    print(f"[{datetime.now().isoformat()}] Starting catalog update...")

    # Load existing catalog
    try:
        catalog = json.loads(CATALOG_FILE.read_text())
    except Exception as e:
        print(f"ERROR: Could not load catalog: {e}")
        sys.exit(1)

    # Build set of existing SKUs
    existing_skus = set()
    for cat, items in catalog.items():
        for item in items:
            existing_skus.add(item["s"])

    print(f"Existing catalog: {len(existing_skus)} SKUs across {len(catalog)} categories")

    # Fetch all products from API
    first_page = fetch_page(0)
    total = first_page["response"]["result_sources"]["token_match"]["count"]
    print(f"API reports {total} total products")

    all_products = []
    offset = 0
    while offset < total:
        data = fetch_page(offset)
        results = data["response"]["results"]
        if not results:
            break
        for r in results:
            info = extract_product(r)
            if info:
                all_products.append(info)
        offset += PAGE_SIZE
        time.sleep(0.3)

    # Deduplicate by SKU
    seen = {}
    for p in all_products:
        if p["s"] not in seen:
            seen[p["s"]] = p

    print(f"Fetched {len(seen)} unique SKUs from API")

    # Find new items
    new_items = []
    for sku, product in seen.items():
        if sku not in existing_skus:
            new_items.append(product)

    if not new_items:
        print("No new items found. Catalog is up to date.")
        return

    print(f"Found {len(new_items)} new items!")

    # Add new items to catalog by category
    added_by_cat = {}
    for item in new_items:
        cat = item.pop("category")
        if cat not in catalog:
            catalog[cat] = []
        catalog[cat].append(item)
        added_by_cat[cat] = added_by_cat.get(cat, 0) + 1

    for cat, count in sorted(added_by_cat.items()):
        print(f"  {cat}: +{count}")

    # Save updated catalog
    CATALOG_FILE.write_text(json.dumps(catalog, indent=None, separators=(",", ":")))
    total_items = sum(len(items) for items in catalog.values())
    print(f"Saved catalog: {total_items} total items ({len(new_items)} new)")
    print("NOTE: Rebuild frontend with 'npm run build' for changes to take effect")


if __name__ == "__main__":
    main()
