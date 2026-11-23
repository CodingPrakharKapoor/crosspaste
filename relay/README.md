# CrossPaste relay

Node.js WebSocket server + Firebase Cloud Messaging bridge.

## Prerequisites

- Node.js installed (you already have this from Phase 1)
- `firebase-service-account.json` placed in this folder (see `../docs/firebase-setup.md`)

## Install (one-time)

```powershell
cd C:\Users\prakh\crosspaste\relay
npm install
```

This downloads `ws` (WebSocket library) and `firebase-admin` (FCM SDK). Takes ~30 seconds.

## Run

```powershell
npm start
```

You should see:

```
CrossPaste relay v0.3.0
========================
WebSocket URL:  ws://192.168.x.x:8080
(Chrome extension connects here; phone registers FCM token here)

Registered phones: 0

Listening for connections...
```

Note the `ws://X.X.X.X:8080` line — that's the URL/IP you enter in:
- The Chrome extension popup (as `ws://LAPTOP-IP:8080`)
- The CrossPaste Android app (just the IP part, e.g. `192.168.x.x`)

## How it works

```
Chrome extension ──ws──> relay ──ws──> phone (instant LAN delivery)
                     relay ──FCM──> phone (mobile data delivery)
```

When the phone connects to the relay via WebSocket (same Wi-Fi), it sends its FCM token. The relay stores tokens in memory. When the Chrome extension sends clipboard text:

1. **WebSocket broadcast** — instant delivery to phones on the same Wi-Fi
2. **FCM push** — delivery to phones on mobile data (or anywhere with internet)

Both happen in parallel. The phone receives the message twice in the worst case (once via WS, once via FCM), but writing to the clipboard twice with the same content is harmless.

## What's new in Phase 2B Step 1

- Added `firebase-admin` dependency
- Loads `firebase-service-account.json` on startup (fails loudly if missing)
- Stores phone FCM tokens in memory
- On clipboard message: broadcasts via WebSocket AND pushes via FCM
- Removes stale FCM tokens automatically (when FCM says the token is no longer registered)

## Troubleshooting

**"firebase-service-account.json not found"**
You haven't placed the service account key yet. See `../docs/firebase-setup.md` Step 4-5.

**"Firebase App Options is not initialized"**
The service account JSON is malformed. Re-download it from Firebase Console.

**`npm install` fails**
Check your network. The `firebase-admin` package is large (~10 MB). Disconnect VPN if you have one.

**Relay runs but FCM push doesn't reach phone**
- Make sure the phone connected to the relay at least once on the same Wi-Fi (to register its FCM token)
- Check the relay's console — it should print `[+] Phone registered` when the phone connects
- The console prints `FCM-ok:1` when a push succeeds

## What's next (Phase 2B Step 2)

Encryption. The relay currently sees plaintext clipboard contents. Step 2B.2 adds libsodium encryption so the relay is just a dumb pipe.
