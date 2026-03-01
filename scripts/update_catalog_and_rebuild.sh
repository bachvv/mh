#!/bin/bash
# Weekly catalog update + rebuild
# Cron: 0 6 * * 0 /home/bach/projects/mh/scripts/update_catalog_and_rebuild.sh >> /tmp/mh-catalog-update.log 2>&1

cd /home/bach/projects/mh

echo "=== Catalog Update $(date) ==="

# Run the scraper
/usr/bin/python3 scripts/update_catalog.py
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: Scraper failed with exit code $EXIT_CODE"
    exit 1
fi

# Check if catalog.json changed
if git diff --quiet src/data/catalog.json 2>/dev/null; then
    echo "No changes to catalog.json, skipping rebuild."
    exit 0
fi

echo "Catalog changed, rebuilding..."
npm run build 2>&1 | tail -5

# Copy style images
cp -r public/images/styles/ dist/images/styles/ 2>/dev/null

# Restart server
SERVER_PID=$(lsof -t -i :4400 2>/dev/null)
if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID"
    sleep 1
fi
nohup node server.js > /tmp/mh-server.log 2>&1 &
echo "Server restarted with PID $!"

echo "=== Done ==="
