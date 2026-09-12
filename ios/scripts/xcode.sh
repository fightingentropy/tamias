#!/bin/bash
set -euo pipefail

# Respect a caller-selected toolchain; otherwise prefer the installed full Xcode.
if [[ -z "${DEVELOPER_DIR:-}" ]]; then
  for app in /Applications/Xcode.app /Applications/Xcode-beta.app; do
    if [[ -d "$app/Contents/Developer" ]]; then
      export DEVELOPER_DIR="$app/Contents/Developer"
      break
    fi
  done
fi

ios_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ios_dir"
command_name="${1:-build}"
if [[ $# -gt 0 ]]; then shift; fi

case "$command_name" in
  generate)
    exec xcodegen generate --spec project.yml "$@"
    ;;
  build)
    exec xcodebuild -project Tamias.xcodeproj -scheme Tamias \
      -configuration Debug -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build "$@"
    ;;
  test)
    # Supply SIMULATOR_ID to select an existing device. No hard-coded machine id.
    destination="platform=iOS Simulator,name=iPhone 17 Pro"
    if [[ -n "${SIMULATOR_ID:-}" ]]; then
      destination="platform=iOS Simulator,id=$SIMULATOR_ID"
    fi
    exec xcodebuild -project Tamias.xcodeproj -scheme Tamias \
      -configuration Debug -destination "$destination" \
      -derivedDataPath build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test "$@"
    ;;
  device-build)
    exec xcodebuild -project Tamias.xcodeproj -scheme Tamias \
      -configuration Release -destination 'generic/platform=iOS' \
      -derivedDataPath build/device -allowProvisioningUpdates build "$@"
    ;;
  *)
    printf 'Usage: %s {generate|build|test|device-build} [xcodebuild options]\n' "$0" >&2
    exit 2
    ;;
esac
