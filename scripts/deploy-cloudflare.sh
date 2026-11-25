#!/usr/bin/env bash
# Deploy the built website to Cloudflare Pages on the Hamish Personal account.
#
# Usage (from the repository root, after `make site` or an equivalent build):
#   scripts/deploy-cloudflare.sh
#
# Cloudflare Pages rejects files larger than 25 MiB, so the Yomitan dictionary
# zips are left out of the upload. Download links in the staged homepage are
# rewritten to the upstream copies on bee-san.github.io. Other content is
# unchanged. The staging directory (deploy-site/) is gitignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Always target Hamish Personal. Never Buffer or Sherwood Shelving.
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-89370b17100354f9a9d4dd0abb8c054a}"

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-bees-grammar}"
SOURCE="${SITE_DIR:-build/site}"
STAGE="${DEPLOY_DIR:-deploy-site}"
BRANCH="${PAGES_BRANCH:-main}"
UPSTREAM="https://bee-san.github.io/bees-ultimate-grammar-dictionary"

if [[ ! -d "$SOURCE" ]]; then
  echo "error: $SOURCE does not exist. Build the site first (make site)." >&2
  exit 1
fi

rsync -a --delete \
  --exclude 'bees-ultimate-grammar-dictionary.zip' \
  --exclude 'bees-ultimate-grammar-dictionary-en.zip' \
  "$SOURCE/" "$STAGE/"

python3 - "$STAGE" "$UPSTREAM" << 'PY'
import re
import sys
from pathlib import Path

stage = Path(sys.argv[1])
upstream = sys.argv[2]
pattern = re.compile(
    r'href="(?:\.\./)?downloads/(bees-ultimate-grammar-dictionary(?:-en)?\.zip)"'
)
replacement = rf'href="{upstream}/downloads/\1"'
for path in (stage / "index.html", stage / "en" / "index.html"):
    text = path.read_text(encoding="utf-8")
    new, n = pattern.subn(replacement, text)
    if n:
        path.write_text(new, encoding="utf-8")
PY

oversized="$(find "$STAGE" -type f -size +25M -print)"
if [[ -n "$oversized" ]]; then
  echo "error: files over Cloudflare Pages' 25 MiB limit remain:" >&2
  echo "$oversized" >&2
  exit 1
fi

echo "Staging $STAGE for $PROJECT_NAME (account $CLOUDFLARE_ACCOUNT_ID)"
exec npx --yes wrangler pages deploy "$STAGE" \
  --project-name "$PROJECT_NAME" \
  --branch "$BRANCH" \
  --commit-dirty=true
