#!/usr/bin/env bash
# Build a release APK on EAS and publish it as a GitHub Release.
#
#   ./scripts/release.sh 1.0.1
#
# Before running:
#   1. Bump "version" in app.json to the same version.
#   2. Add a "## v1.0.1" section to CHANGELOG.md (it becomes the release
#      notes and the in-app "What's new").
#   3. Commit everything.
# Needs: eas-cli (logged in), gh (logged in), a clean git tree.
set -euo pipefail

VERSION="${1:?usage: scripts/release.sh <version>  e.g. 1.0.1}"
TAG="v${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_VERSION="$(node -p "require('./app.json').expo.version")"
if [[ "$APP_VERSION" != "$VERSION" ]]; then
  echo "app.json version is $APP_VERSION, expected $VERSION — bump it first." >&2; exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean — commit first." >&2; exit 1
fi
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists." >&2; exit 1
fi

# Release notes = the "## vX.Y.Z" section of CHANGELOG.md
NOTES="$(mktemp)"
awk -v tag="## ${TAG}" '
  $0 == tag { found = 1; next }
  found && /^## v/ { exit }
  found { print }
' CHANGELOG.md > "$NOTES"
if [[ ! -s "$NOTES" ]]; then
  echo "No '## ${TAG}' section in CHANGELOG.md." >&2; exit 1
fi

echo "▶ Building ${TAG} on EAS (profile: release)…"
BUILD_JSON="$(eas build --profile release --platform android --non-interactive --wait --json)"
APK_URL="$(node -e 'const b=JSON.parse(process.argv[1]);const x=Array.isArray(b)?b[0]:b;console.log(x.artifacts.buildUrl||x.artifacts.applicationArchiveUrl)' "$BUILD_JSON")"

mkdir -p dist
APK="dist/runestone-${TAG}.apk"
echo "▶ Downloading APK…"
curl -fL "$APK_URL" -o "$APK"
echo "  $(du -h "$APK" | cut -f1)  $APK"

echo "▶ Publishing GitHub release ${TAG}…"
git tag -a "$TAG" -m "Runestone ${TAG}"
git push origin "$TAG"
gh release create "$TAG" "$APK" --title "Runestone ${TAG}" --notes-file "$NOTES" --latest

echo "✔ Released ${TAG}"
