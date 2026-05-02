# OpenFront Copilot Test Extension

Minimal Manifest V3 extension for visually testing the read-only Copilot HUD on the web client. It is intentionally independent from the TypeScript build.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/openfront-copilot-test`
5. Open `https://openfront.io/` or `http://localhost:9000/?openfront_copilot=1`

## What it does

- Sets `localStorage["openfront-copilot-enabled"] = "1"`
- Injects a small fixed overlay with:
  - `OpenFront Copilot Test`
  - `status: loaded`
  - `mode: read-only`
  - `no actions enabled`

## What it does not do

- Dispatch game actions
- Add hotkeys
- Click buttons
- Send network requests
- Modify game state
- Patch runtime hooks
- Touch baseline or eval paths
