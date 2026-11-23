# CrossPaste — Phase 1 (Windows + Android)

A minimal test build to prove the core trick on your hardware:
**copy text on your Windows laptop → paste in any Android app, within ~2 seconds.**

This phase does NOT include encryption, push notifications, or background service.
It only proves:

- The Chrome extension can capture selected text.
- A small local relay can pass the text to your phone.
- The Expo app on your phone can write that text into the Android clipboard.
- You can paste it in any app (WhatsApp, Notes, Gmail…).

---

## Prerequisites (you already have these)

- Windows 11
- Node.js v24 (installed)
- A phone with Android 16 / ColorOS 16
- Phone and laptop on the **same Wi-Fi** (important)

---

## Setup (one time, ~10 minutes)

### Option A — automated via PowerShell

1. Extract this whole folder somewhere, e.g. `C:\crosspaste-phase1`.
2. Open **PowerShell** in that folder.
3. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup.ps1
   ```

   This will:
   - `npm install` the mock relay
   - scaffold an Expo app named `crosspaste-app`
   - install `expo-clipboard`
   - copy `App.tsx` into the scaffolded project

### Option B — manual (if the script fails)

Open three terminals in the extracted folder.

**Terminal 1 — relay:**
```powershell
cd mock-relay
npm install
npm start
```

**Terminal 2 — Expo app:**
```powershell
npx --yes create-expo-app@latest crosspaste-app --template blank
cd crosspaste-app
npx expo install expo-clipboard
# Copy App.tsx from ..\expo-app\App.tsx over the generated one
copy ..\expo-app\App.tsx .\App.tsx
npx expo start
```

> If `--template blank` is not available in your Expo SDK, use the default
> template and just drop `App.tsx` into the project root, replacing the
> generated entry file.

---

## Run the test (every time)

1. **Relay running** — Terminal 1 shows:
   ```
   CrossPaste relay listening on http://0.0.0.0:8080
   Phone app should connect to one of:
     ws://172.23.24.223:8080
   ```
   Note the `ws://...` address — that is your laptop's LAN IP.

2. **Expo app running** — Terminal 2 shows a QR code.

3. **On your phone:**
   - Install **Expo Go** from the Play Store (one-time).
   - Open Expo Go, scan the QR code from Terminal 2.
   - The CrossPaste test app opens.
   - Type your laptop's IP (e.g. `172.23.24.223`) into the box, tap **Connect**.
   - You should see `Connected ✓` in the log.

4. **Load the Chrome extension:**
   - Open `chrome://extensions` in Chrome or Edge.
   - Turn on **Developer mode** (top-right toggle).
   - Click **Load unpacked**, select the `chrome-extension` folder.
   - The CrossPaste icon appears in your toolbar.

5. **Send something:**
   - Go to any webpage, select some text.
   - Right-click → **Send selection to phone**.
   - Within ~1 second, your phone's log says `Pasted N chars to clipboard`.
   - Open WhatsApp / Notes / any app, long-press a text field, tap **Paste**.
   - The text you selected on the laptop appears.

---

## Troubleshooting

**"WebSocket error" or stuck on Connecting**
- Confirm phone and laptop are on the same Wi-Fi (not mobile data).
- Confirm the IP in the app matches the `ws://...` line the relay printed.
- Windows Firewall may prompt the first time — click **Allow access** for Node.js on private networks.
- Some routers isolate Wi-Fi clients (AP isolation). If so, use your phone's hotspot and connect the laptop to it instead.

**Extension button shows "ERR" badge**
- The relay is not running. Start it in Terminal 1 first.

**Expo Go can't scan the QR**
- Press `c` in Terminal 2 to print the URL, then type it into Expo Go manually.
- Or press `s` to switch to Tunnel mode (slower, but bypasses local network issues).

**Phone shows "Pasted N chars" but paste gives old content**
- Android 13+ shows a "App pasted from clipboard" toast — that is expected.
- Some ColorOS versions aggressively clear clipboard. If paste fails, tap the **Test clipboard** button in the app first, then paste.

---

## What this proves (and what it doesn't)

Proves:
- End-to-end flow works on your actual hardware.
- Latency is acceptable for the MVP promise.
- The clipboard write actually lands in a usable state for other apps.

Does NOT prove yet (Phase 2+):
- Push notifications when the app is closed.
- Foreground service for always-on clipboard sync.
- End-to-end encryption.
- Image / link support.
- iOS support.

When this works, move to Phase 2: real FCM push, native build (graduating out of Expo Go), and libsodium encryption.

---

## File layout

```
crosspaste-phase1/
├── README.md            (this file)
├── setup.ps1            (one-shot setup for Windows)
├── chrome-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   └── popup.js
├── mock-relay/
│   ├── package.json
│   └── server.js        (Express + WebSocket, ~50 lines)
└── expo-app/
    └── App.tsx          (the only file you copy into the scaffolded Expo project)
```
