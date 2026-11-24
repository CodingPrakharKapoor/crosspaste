# CrossPaste Chrome extension

Right-click any selected text on a webpage → "Send selection to phone".

The extension connects to the relay via WebSocket (local or cloud) and forwards the selected text. The relay then pushes it to the phone via WebSocket (instant) or FCM (push for offline phones).

## Install (one-time)

1. Open `chrome://extensions` in Chrome or Edge
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select this folder (`C:\Users\prakh\crosspaste\chrome-extension`)
5. The CrossPaste icon appears in your toolbar

## Configure

1. Click the CrossPaste icon in your toolbar
2. Enter the relay URL:
   - **Cloud (recommended):** `wss://crosspaste-relay-xxxx.onrender.com` (your Render URL)
   - **Local (same Wi-Fi only):** `ws://LAPTOP-IP:8080` (the IP printed by the relay on startup)
3. Click **Save & Connect**
4. The status should show: **✓ Connected to ...**

## Use

1. Select any text on any webpage
2. Right-click → "Send selection to phone"
3. The text appears on your phone's clipboard — works whether the phone is on Wi-Fi, mobile data, or in another city

## What's new in Phase 2B (cloud deploy)

- Popup hint updated to mention both cloud (`wss://...`) and local (`ws://...`) URLs
- The extension itself is unchanged — it just sends `{type:"clipboard", text:"..."}` over WebSocket to whatever URL you configure

Encryption (Phase 2B Step 2) will modify this extension to encrypt the text before sending.
