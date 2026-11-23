# CrossPaste Chrome extension

Right-click any selected text on a webpage → "Send selection to phone".

The extension connects to the relay via WebSocket and forwards the selected text. The relay then pushes it to the phone via WebSocket (LAN) or FCM (mobile data).

## Install (one-time)

1. Open `chrome://extensions` in Chrome or Edge
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select this folder (`C:\Users\prakh\crosspaste\chrome-extension`)
5. The CrossPaste icon appears in your toolbar

## Configure

1. Click the CrossPaste icon in your toolbar
2. Enter the relay URL — usually `ws://LAPTOP-IP:8080` (the IP printed by the relay when it starts)
3. Click **Save & Connect**
4. The status should show "✓ Connected"

## Use

1. Select any text on any webpage
2. Right-click → "Send selection to phone"
3. The text appears on your phone's clipboard

## What's new in Phase 2B Step 1

Nothing changed in the extension itself from Phase 1 — the relay handles the FCM push transparently. The extension still just sends `{type:"clipboard", text:"..."}` over WebSocket.

Encryption (Phase 2B Step 2) will modify this extension to encrypt the text before sending.
