#!/usr/bin/env bash
# 初回セットアップ（何度実行してもOK）: Node パッケージ・フォント・Python パッケージ
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d reel/node_modules ]; then
  (cd reel && npm ci --no-fund --no-audit)
fi
if [ ! -d reel/public/fonts/dela ]; then
  NODE_USE_ENV_PROXY=1 node reel/scripts/fetch-fonts.mjs
fi
python3 -c "import PIL, imageio_ffmpeg, pillow_heif" 2>/dev/null || python3 -m pip install -q -r requirements.txt
echo "セットアップ完了"
