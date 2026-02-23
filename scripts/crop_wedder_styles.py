"""
crop_wedder_styles.py
─────────────────────
Crops ring profile images from the 5 MH gold wedder catalog pages
and saves them as individual style images.

USAGE
─────
1. Save the 5 catalog images into this project as:
     public/images/catalog/catalog1.png   (Flat)
     public/images/catalog/catalog2.png   (High Dome + Round High Dome)
     public/images/catalog/catalog3.png   (Lite Half Round + Half Round)
     public/images/catalog/catalog4.png   (Patterned: Bevel Two Tone + Flat Groove + Vertical Side Bevel)
     public/images/catalog/catalog5.png   (Flat Bevel + Reverse Bevel)

2. Install Pillow:
     pip install Pillow

3. Run from the project root:
     python scripts/crop_wedder_styles.py

   Cropped images will be saved to public/images/styles/<style-name>.png
   and the wedderStyles image paths in wedders.js will auto-update.

ADJUSTING CROP REGIONS
──────────────────────
Each entry below has (left, top, right, bottom) in PIXELS.
Open the catalog image in any viewer, hover over the ring photo corner
to read coordinates, then update the values below.
"""

from pathlib import Path
from PIL import Image

# ── Project paths ───────────────────────────────────────────────
PROJECT   = Path(__file__).parent.parent
CATALOG   = PROJECT / 'public' / 'images' / 'catalog'
STYLES    = PROJECT / 'public' / 'images' / 'styles'
STYLES.mkdir(parents=True, exist_ok=True)

# ── Crop definitions ─────────────────────────────────────────────
# Format: { 'output-filename': ('catalog-file', (left, top, right, bottom)) }
# The Profile column in each catalog image is the leftmost column.
# Adjust these pixel coordinates to match your actual image dimensions.

CROPS = {
    # catalog1.png — Flat (single style, ring images span full profile column)
    'flat': ('catalog1.png', (0, 60, 200, 400)),

    # catalog2.png — High Dome (top) + Round High Dome (bottom)
    'high-dome':       ('catalog2.png', (0,  60, 200, 380)),
    'round-high-dome': ('catalog2.png', (0, 390, 200, 680)),

    # catalog3.png — Lite Half Round (top) + Half Round (bottom)
    'lite-half-round': ('catalog3.png', (0,  60, 200, 470)),
    'half-round':      ('catalog3.png', (0, 480, 200, 890)),

    # catalog4.png — Patterned styles (3 rows)
    'bevel-two-tone':                    ('catalog4.png', (0,  80, 200, 220)),
    'flat-groove-dome-edge-two-tone':    ('catalog4.png', (0, 230, 200, 370)),
    'vertical-side-bevel-cut':           ('catalog4.png', (0, 380, 200, 500)),

    # catalog5.png — Flat Bevel (top) + Reverse Bevel (bottom)
    'flat-bevel':    ('catalog5.png', (0,  60, 200, 460)),
    'reverse-bevel': ('catalog5.png', (0, 470, 200, 870)),
}

def main():
    for name, (src_file, box) in CROPS.items():
        src_path = CATALOG / src_file
        if not src_path.exists():
            print(f'  SKIP  {src_file} not found → {name}')
            continue

        img  = Image.open(src_path)
        crop = img.crop(box)

        # Resize to a clean 200×200 thumbnail
        crop = crop.resize((200, 200), Image.LANCZOS)

        out = STYLES / f'{name}.png'
        crop.save(out, 'PNG')
        print(f'  OK    {src_file} {box} → {out.name}')

    # After cropping, update wedders.js image paths to .png
    js_path = PROJECT / 'src' / 'data' / 'wedders.js'
    text    = js_path.read_text()
    text    = text.replace(".svg'", ".png'")
    js_path.write_text(text)
    print('\nUpdated wedders.js image paths → .png')
    print('Done! Review the cropped images and adjust CROPS coordinates if needed.')

if __name__ == '__main__':
    main()
