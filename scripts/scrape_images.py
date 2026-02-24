#!/usr/bin/env python3
"""
Scrape all product images from Michael Hill Canada jewellery catalog.
Uses the Constructor.io API to fetch product data, then downloads images
organized by category and named by SKU.

Output structure:
  images/
    Bracelets/
      19080727/
        19080727-25-21.jpg
        19080727-25-22.jpg
        ...
    Rings/
      ...
"""

import json
import os
import time
import sys
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Config ---
API_BASE = "https://ac.cnstrc.com/browse/group_id/jewellery_shop-all"
API_KEY = "key_96F2Jto3eRccQGKB"
IMAGE_BASE = "https://prod-sfcc-api.michaelhill.com/dw/image/v2/AANC_PRD"
PAGE_SIZE = 100  # max allowed by constructor.io
OUTPUT_DIR = Path(__file__).parent.parent / "images"
MANIFEST_FILE = Path(__file__).parent.parent / "images" / "manifest.json"
MAX_WORKERS = 8
IMAGE_WIDTH = 1000  # sw parameter for image quality


def fetch_page(offset: int, page_size: int = PAGE_SIZE) -> dict:
    """Fetch a page of products from Constructor.io API."""
    params = {
        "c": "ciojs-client-2.71.1",
        "key": API_KEY,
        "i": "scraper-mh",
        "s": "1",
        "offset": offset,
        "num_results_per_page": page_size,
    }
    resp = requests.get(API_BASE, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_product_info(result: dict) -> dict | None:
    """Extract SKU, category, name, and image URLs from a product result."""
    data = result.get("data", {})
    facets = {f["name"]: f["values"] for f in data.get("facets", [])}

    sku_values = facets.get("sku", [])
    if not sku_values:
        return None
    sku = str(sku_values[0])

    category = "Uncategorized"
    sub_cat = facets.get("mHJSubCategory", [])
    if sub_cat:
        category = sub_cat[0].replace("/", "-")

    name = result.get("value", "")

    # Collect all image URLs from main product + swatches
    image_urls = set()
    for key, url in data.get("image_urls", {}).items():
        if url:
            image_urls.add(url)

    for swatch in data.get("swatches", []):
        for key, url in swatch.get("image_urls", {}).items():
            if url:
                image_urls.add(url)

    return {
        "sku": sku,
        "category": category,
        "name": name,
        "image_urls": sorted(image_urls),
    }


def download_image(url: str, dest: Path) -> bool:
    """Download a single image. Returns True on success."""
    if dest.exists():
        return True
    full_url = f"{IMAGE_BASE}{url}?sw={IMAGE_WIDTH}&sm=fit&q=90"
    try:
        resp = requests.get(full_url, timeout=30)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.content)
        return True
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}", file=sys.stderr)
        return False


def main():
    print("=== Michael Hill Image Scraper ===\n")

    # Step 1: Fetch all products
    print("Fetching product catalog...")
    first_page = fetch_page(0, 1)
    total = first_page["response"]["result_sources"]["token_match"]["count"]
    print(f"Total products: {total}\n")

    all_products = []
    offset = 0
    while offset < total:
        data = fetch_page(offset)
        results = data["response"]["results"]
        if not results:
            break
        for r in results:
            info = extract_product_info(r)
            if info:
                all_products.append(info)
        offset += PAGE_SIZE
        print(f"  Fetched {min(offset, total)}/{total} products ({len(all_products)} with SKU)")
        time.sleep(0.3)

    # Deduplicate by SKU
    seen = {}
    for p in all_products:
        if p["sku"] not in seen:
            seen[p["sku"]] = p
        else:
            # Merge image URLs
            existing = set(seen[p["sku"]]["image_urls"])
            existing.update(p["image_urls"])
            seen[p["sku"]]["image_urls"] = sorted(existing)
    products = list(seen.values())

    print(f"\nUnique SKUs: {len(products)}")

    # Category summary
    categories = {}
    for p in products:
        categories[p["category"]] = categories.get(p["category"], 0) + 1
    print("\nCategories:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # Step 2: Download images
    total_images = sum(len(p["image_urls"]) for p in products)
    print(f"\nTotal images to download: {total_images}")
    print(f"Output directory: {OUTPUT_DIR}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    failed = 0

    tasks = []
    for p in products:
        cat_dir = OUTPUT_DIR / p["category"] / p["sku"]
        for url in p["image_urls"]:
            filename = url.split("/")[-1]
            dest = cat_dir / filename
            tasks.append((url, dest, p["sku"]))

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for url, dest, sku in tasks:
            if dest.exists():
                skipped += 1
                continue
            f = executor.submit(download_image, url, dest)
            futures[f] = (url, sku)

        done_count = 0
        total_to_download = len(futures)
        for f in as_completed(futures):
            done_count += 1
            if f.result():
                downloaded += 1
            else:
                failed += 1
            if done_count % 50 == 0 or done_count == total_to_download:
                print(f"  Progress: {done_count}/{total_to_download} "
                      f"(downloaded: {downloaded}, failed: {failed})")

    # Step 3: Save manifest
    manifest = {
        "total_skus": len(products),
        "total_images": total_images,
        "downloaded": downloaded,
        "skipped": skipped,
        "failed": failed,
        "categories": categories,
        "products": [
            {
                "sku": p["sku"],
                "category": p["category"],
                "name": p["name"],
                "images": [url.split("/")[-1] for url in p["image_urls"]],
            }
            for p in products
        ],
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))

    print(f"\n=== Done ===")
    print(f"SKUs: {len(products)}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (existing): {skipped}")
    print(f"Failed: {failed}")
    print(f"Manifest: {MANIFEST_FILE}")


if __name__ == "__main__":
    main()
