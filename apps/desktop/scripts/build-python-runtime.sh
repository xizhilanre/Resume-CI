#!/bin/bash
# apps/desktop/scripts/build-python-runtime.sh
set -e

PYTHON_VERSION="${PYTHON_VERSION:-3.12.8}"
PYTHON_MAJOR_MINOR="$(echo "$PYTHON_VERSION" | cut -d. -f1-2 | tr -d .)"
RUNTIME_DIR="python-runtime"
EMBED_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"
PIP_URL="https://bootstrap.pypa.io/get-pip.py"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo "🔨 Building Python runtime v${PYTHON_VERSION}..."

rm -rf "$RUNTIME_DIR" python-embed.zip get-pip.py
mkdir -p "$RUNTIME_DIR"

# 1. Download + extract Python embeddable
echo "📥 Downloading Python embeddable..."
curl -sL "$EMBED_URL" -o python-embed.zip
unzip -q python-embed.zip -d "$RUNTIME_DIR"

# 2. Enable pip
PTH_FILE=$(ls "$RUNTIME_DIR"/python*._pth 2>/dev/null | head -1)
if [ -f "$PTH_FILE" ]; then
    echo "import site" >> "$PTH_FILE"
    echo "Lib/site-packages" >> "$PTH_FILE"
    echo "scripts" >> "$PTH_FILE"
fi

# 3. Install pip
echo "📦 Installing pip..."
curl -sL "$PIP_URL" -o get-pip.py
"$RUNTIME_DIR/python.exe" get-pip.py --no-wheels --quiet

# 4. Install dependencies
echo "📦 Installing Python dependencies..."
"$RUNTIME_DIR/python.exe" -m pip install --quiet --no-warn-script-location \
    fastapi uvicorn[standard] pydantic openai anthropic gitpython httpx aiosqlite

# 5. Install two Python CLIs (dev mode)
"$RUNTIME_DIR/python.exe" -m pip install --quiet --no-warn-script-location \
    -e "$REPO_ROOT/scripts/shushu-internship-tool" \
    -e "$REPO_ROOT/scripts/shushu-internship-resume-optimizer"

# 6. Copy FastAPI code + CLI source
mkdir -p "$RUNTIME_DIR/app"
cp -r "$REPO_ROOT/services/fastapi/app/"* "$RUNTIME_DIR/app/"
cp -r "$REPO_ROOT/scripts/shushu-internship-tool" "$RUNTIME_DIR/scripts/"
cp -r "$REPO_ROOT/scripts/shushu-internship-resume-optimizer" "$RUNTIME_DIR/scripts/"
cp -r "$REPO_ROOT/scripts/vibe-resume" "$RUNTIME_DIR/scripts/"

# 7. Install vibe-resume Node deps
echo "📦 Installing vibe-resume Node dependencies..."
cd "$RUNTIME_DIR/scripts/vibe-resume" && npm install --silent
cd "$REPO_ROOT"

# 8. Package
echo "📦 Packaging python-runtime.zip..."
zip -qr python-runtime.zip "$RUNTIME_DIR"

SIZE=$(du -sh python-runtime.zip | cut -f1)
echo "✅ python-runtime.zip built (${SIZE})"
