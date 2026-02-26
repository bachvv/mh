#!/usr/bin/env python3
"""Extract all P-number data from the Lab Bridal Diamond Selector PDF."""

import json
import re
import pdfplumber
from collections import defaultdict

PDF_PATH = "/home/bach/projects/mh/data/catalogs/rings-Gold-LAB._Diamond_Selector_-_Special_Order_Grid.pdf"
CUSTOM_STYLES_PATH = "/home/bach/projects/mh/data/custom-styles.json"
PNUMBERS_PATH = "/home/bach/projects/mh/data/rings-pnumbers.json"
CATEGORIES_PATH = "/home/bach/projects/mh/data/product-categories.json"

# Shape name -> ID mapping
SHAPE_IDS = {
    "ROUND BRILLIANT": "RoundBrilliant",
    "MARQUISE": "Marquise",
    "ASCCHER": "Asscher",  # PDF spells it ASCCHER
    "OVAL": "Oval",
    "PEAR": "Pear",
    "PRINCESS": "Princess",
    "EMERALD": "Emerald",
    "RADIANT": "Radiant",
    "CUSHION": "Cushion",
    "ELONGATED CUSHION": "ElongatedCushion",
    "HEART": "Heart",
}

# Shape display labels
SHAPE_LABELS = {
    "RoundBrilliant": "Round Brilliant",
    "Marquise": "Marquise",
    "Asscher": "Asscher",
    "Oval": "Oval",
    "Pear": "Pear",
    "Princess": "Princess",
    "Emerald": "Emerald",
    "Radiant": "Radiant",
    "Cushion": "Cushion",
    "ElongatedCushion": "Elongated Cushion",
    "Heart": "Heart",
}

# Shape abbreviations for style IDs
SHAPE_ABBREVS = {
    "RoundBrilliant": "RB",
    "Marquise": "MQ",
    "Asscher": "AS",
    "Oval": "OV",
    "Pear": "PE",
    "Princess": "PR",
    "Emerald": "EM",
    "Radiant": "RA",
    "Cushion": "CU",
    "ElongatedCushion": "EC",
    "Heart": "HE",
}

# Band category mapping
SOLITAIRE_BANDS = {
    "Lab Band", "Sig 101 Band", "MH Sol Band", "KIF Band", "Evermore Band"
}
ENGAGEMENT_BANDS = {"Tapered Band", "Side Accent Band", "Pave Accent Band"}

METALS = ["14KT", "18KT", "PLAT"]


def is_pnumber(val):
    """Check if a value is a valid P-number (8-digit numeric string)."""
    if not val:
        return False
    val = str(val).strip()
    return bool(re.match(r'^\d{7,8}$', val))


def parse_carat(val):
    """Parse carat string like '0.70ct' or '1.20/1.25ct' into a clean string."""
    if not val:
        return None
    val = str(val).strip()
    m = re.match(r'(\d+\.\d+)(?:/\d+\.\d+)?ct', val)
    if m:
        return m.group(1)
    return None


def get_band_base_name(band_name):
    """Get the base band name without CLW suffix for categorization."""
    m = re.match(r'(.+?)\s*\(\d+ CLW\)', band_name)
    if m:
        return m.group(1).strip()
    return band_name.strip()


def get_band_category(band_name):
    """Determine if a band is Solitaire or Engagement."""
    base = get_band_base_name(band_name)
    if base in ENGAGEMENT_BANDS:
        return "Engagement"
    return "Solitaire"


def extract_all_data():
    """Extract all P-number data from the PDF."""
    pdf = pdfplumber.open(PDF_PATH)

    # Result structures
    all_entries = []  # list of (shape_id, band_name, carat, metal, pnumber)

    for page_idx, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if not tables:
            continue

        main_table = tables[0]
        matching_wed_table = tables[1] if len(tables) > 1 else None

        # Row 1: shape name
        shape_raw = main_table[1][0].strip() if main_table[1][0] else ""
        shape_id = SHAPE_IDS.get(shape_raw)
        if not shape_id:
            print(f"WARNING: Unknown shape '{shape_raw}' on page {page_idx + 1}")
            continue

        # Row 4: band style names
        band_names_row = main_table[4]
        num_cols = len(band_names_row)

        # Band names are at even indices starting from 2 (col 2, 4, 6, ...)
        # Each band occupies 2 columns: (metal_col, pnumber_col)
        band_columns = []  # list of (band_name, metal_col_idx, pnum_col_idx)
        for col_idx in range(2, num_cols, 2):
            bname = band_names_row[col_idx]
            if bname and bname.strip():
                band_columns.append((bname.strip(), col_idx, col_idx + 1))

        # Data rows start at row 5, grouped in triplets (14KT, 18KT, PLAT)
        data_rows = main_table[5:]
        num_groups = len(data_rows) // 3

        for g in range(num_groups):
            group = data_rows[g * 3: g * 3 + 3]

            # Find carat label in any row of the group (col 0 or 1)
            carat = None
            for row in group:
                for check_col in [0, 1]:
                    if row[check_col]:
                        c = parse_carat(str(row[check_col]).strip())
                        if c:
                            carat = c
                            break
                if carat:
                    break

            if not carat:
                continue

            # Process each row in the group to get metal and P-numbers
            for row in group:
                # Determine metal from band columns
                metal_val = None
                for bname, mcol, pcol in band_columns:
                    if mcol < len(row) and row[mcol]:
                        v = str(row[mcol]).strip()
                        if v in METALS:
                            metal_val = v
                            break

                if not metal_val:
                    continue

                # Extract P-numbers for each band
                for bname, mcol, pcol in band_columns:
                    if pcol < len(row) and row[pcol]:
                        pnum = str(row[pcol]).strip()
                        if is_pnumber(pnum):
                            all_entries.append((shape_id, bname, carat, metal_val, pnum))

        # Matching wedding bands (same for all shapes)
        if matching_wed_table and page_idx == 0:
            # Side Accent Band matching wed and Pave Accent Band matching wed
            for row in matching_wed_table[1:]:
                if len(row) >= 4:
                    metal1 = str(row[0]).strip() if row[0] else ""
                    pnum1 = str(row[1]).strip() if row[1] else ""
                    metal2 = str(row[2]).strip() if row[2] else ""
                    pnum2 = str(row[3]).strip() if row[3] else ""
                    if metal1 in METALS and is_pnumber(pnum1):
                        all_entries.append(("_MATCHING", "Side Accent Matching Wed", "0.00", metal1, pnum1))
                    if metal2 in METALS and is_pnumber(pnum2):
                        all_entries.append(("_MATCHING", "Pave Accent Matching Wed", "0.00", metal2, pnum2))

    pdf.close()
    return all_entries


def build_outputs(all_entries):
    """Build the output JSON structures."""

    # ── P-numbers lookup ──
    pnumbers = {}
    for shape_id, band_name, carat, metal, pnum in all_entries:
        if shape_id == "_MATCHING":
            key = f"MATCH-{band_name}|{carat}|{metal}"
        else:
            abbrev = SHAPE_ABBREVS[shape_id]
            style_id = f"{abbrev}-{band_name}"
            key = f"{style_id}|{carat}|{metal}"
        pnumbers[key] = f"P{pnum}"

    # ── Collect unique styles per shape ──
    # style_key -> {carats: set, metals: set}
    style_data = defaultdict(lambda: {"carats": set(), "metals": set()})
    for shape_id, band_name, carat, metal, pnum in all_entries:
        if shape_id == "_MATCHING":
            continue
        abbrev = SHAPE_ABBREVS[shape_id]
        style_id = f"{abbrev}-{band_name}"
        style_data[(shape_id, band_name, style_id)]["carats"].add(carat)
        style_data[(shape_id, band_name, style_id)]["metals"].add(metal)

    # ── Build ring styles ──
    ring_styles = []
    for (shape_id, band_name, style_id), data in sorted(style_data.items()):
        category = get_band_category(band_name)
        # Sort carats numerically, metals in order
        carats_sorted = sorted(data["carats"], key=lambda x: float(x))
        metal_order = {"14KT": 0, "18KT": 1, "PLAT": 2}
        metals_sorted = sorted(data["metals"], key=lambda x: metal_order.get(x, 99))

        ring_styles.append({
            "id": style_id,
            "name": band_name,
            "category": category,
            "tier": shape_id,
            "image": f"/images/styles/rings/{style_id.lower().replace(' ', '-').replace('(', '').replace(')', '')}.png",
            "carats": carats_sorted,
            "metals": metals_sorted,
        })

    # ── Build categories ──
    # Collect which shape_ids actually have data
    shapes_seen = []
    seen_ids = set()
    for shape_id, band_name, carat, metal, pnum in all_entries:
        if shape_id == "_MATCHING":
            continue
        if shape_id not in seen_ids:
            seen_ids.add(shape_id)
            shapes_seen.append(shape_id)

    ring_categories = []
    for sid in shapes_seen:
        ring_categories.append({
            "id": sid,
            "label": SHAPE_LABELS[sid],
        })

    # Also add matching wedding bands
    # Add matching wed entries to pnumbers (already done above)

    return ring_styles, pnumbers, ring_categories


def main():
    print("Extracting P-number data from PDF...")
    all_entries = extract_all_data()
    print(f"  Raw entries extracted: {len(all_entries)}")

    # Filter out matching entries for stats
    real_entries = [e for e in all_entries if e[0] != "_MATCHING"]
    matching_entries = [e for e in all_entries if e[0] == "_MATCHING"]

    ring_styles, pnumbers, ring_categories = build_outputs(all_entries)

    # ── Summary ──
    shapes = set(e[0] for e in real_entries)
    print(f"\n=== SUMMARY ===")
    print(f"  Total shapes:    {len(shapes)}")
    print(f"  Total styles:    {len(ring_styles)}")
    print(f"  Total P-numbers: {len(pnumbers)}")
    print(f"  Matching Wed entries: {len(matching_entries)}")

    # Per-shape breakdown
    for sid in sorted(shapes):
        shape_entries = [e for e in real_entries if e[0] == sid]
        bands = set(e[1] for e in shape_entries)
        print(f"    {SHAPE_LABELS[sid]:22s}: {len(bands):2d} bands, {len(shape_entries):4d} P-numbers")

    # ── Write rings-pnumbers.json ──
    with open(PNUMBERS_PATH, 'w') as f:
        json.dump(pnumbers, f, indent=2)
    print(f"\nWrote {PNUMBERS_PATH} ({len(pnumbers)} entries)")

    # ── Update custom-styles.json (preserve wedders, chains) ──
    with open(CUSTOM_STYLES_PATH, 'r') as f:
        custom_styles = json.load(f)
    custom_styles['rings'] = ring_styles
    with open(CUSTOM_STYLES_PATH, 'w') as f:
        json.dump(custom_styles, f, indent=2)
    print(f"Wrote {CUSTOM_STYLES_PATH} (rings: {len(ring_styles)} styles)")

    # ── Update product-categories.json (preserve other keys) ──
    with open(CATEGORIES_PATH, 'r') as f:
        categories = json.load(f)
    categories['rings'] = ring_categories
    with open(CATEGORIES_PATH, 'w') as f:
        json.dump(categories, f, indent=2)
    print(f"Wrote {CATEGORIES_PATH} (rings: {len(ring_categories)} categories)")


if __name__ == "__main__":
    main()
