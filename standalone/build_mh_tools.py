"""Build the multi-tab MH Tools standalone HTML.

Reads mh_tools.html (template), inlines the trimmed product catalog into
the SKU Finder section, and emits two artifacts:
  - mh_tools.html              (Chart.js loaded from CDN, smaller file)
  - mh_tools_offline.html      (Chart.js inlined, fully self-contained)

Trims catalog.json to {s, n, p, category} so the file stays under ~250 KB.
The full catalog (with image filenames) would add another 300 KB for no
benefit since the user explicitly asked for the SKU Finder without images.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path('/home/bach/projects/mh')
SRC = ROOT / 'standalone' / 'mh_tools.template.html'
CATALOG = ROOT / 'src' / 'data' / 'catalog.json'
FINDERS_EXTRACTOR = ROOT / 'standalone' / 'extract_wedders.mjs'
FINDERS_JSON = ROOT / 'standalone' / 'finders.data.json'
CHARTJS = Path('/tmp/chartjs.min.js')

OUT_ONLINE = ROOT / 'standalone' / 'mh_tools.html'
OUT_OFFLINE = ROOT / 'standalone' / 'mh_tools_offline.html'

CATALOG_MARKER = '// __CATALOG_PLACEHOLDER__'
FINDERS_MARKER = '// __FINDERS_PLACEHOLDER__'
CDN_TAG = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'


def trimmed_catalog() -> dict:
    raw = json.loads(CATALOG.read_text())
    return {
        cat: [{'s': i['s'], 'n': i['n'], 'p': i.get('p', '')} for i in items]
        for cat, items in raw.items()
    }


def build():
    template = SRC.read_text()
    catalog = trimmed_catalog()
    catalog_js = 'const CATALOG = ' + json.dumps(catalog, separators=(',', ':')) + ';'

    # Run Node extractor to build finders.data.json from src/data/*.js modules.
    subprocess.run(['node', str(FINDERS_EXTRACTOR)], check=True)
    finders = json.loads(FINDERS_JSON.read_text())
    finders_js = 'const FINDERS = ' + json.dumps(finders, separators=(',', ':')) + ';'

    # Inject catalog + finders.
    if CATALOG_MARKER not in template:
        sys.exit(f'marker {CATALOG_MARKER!r} not found in template — refusing to build')
    if FINDERS_MARKER not in template:
        sys.exit(f'marker {FINDERS_MARKER!r} not found in template — refusing to build')
    online = template.replace(CATALOG_MARKER, catalog_js).replace(FINDERS_MARKER, finders_js)

    OUT_ONLINE.write_text(online)
    online_size = len(online.encode('utf-8'))

    # Offline version — also inline Chart.js
    if not CHARTJS.exists():
        sys.exit(f'{CHARTJS} not found; download Chart.js first:  curl -o {CHARTJS} https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')
    chartjs = CHARTJS.read_text()
    if CDN_TAG not in online:
        sys.exit(f'CDN script tag not found in built file — refusing to build offline variant')
    offline = online.replace(CDN_TAG, '<script>\n' + chartjs + '\n</script>')
    OUT_OFFLINE.write_text(offline)
    offline_size = len(offline.encode('utf-8'))

    print(f'Wrote {OUT_ONLINE} ({online_size:,} bytes)')
    print(f'Wrote {OUT_OFFLINE} ({offline_size:,} bytes)')


if __name__ == '__main__':
    build()
