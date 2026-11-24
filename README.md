# CrossPaste

Copy on Windows laptop → paste on Android phone, in any app, from anywhere.

## Repository structure

Starting Phase 2B, the live code lives at the **root level** (not in phase-named folders). Earlier phases are kept frozen for history.

```
crosspaste/
├── README.md                ← you are here
├── .gitignore
├── app-android/             ← live Android app (Phase 2B onwards)
├── chrome-extension/        ← live Chrome extension (Phase 2B onwards)
├── relay/                   ← live Node.js relay (Phase 2B onwards)
├── docs/
│   ├── phase-notes.md       ← brief notes per phase
│   ├── firebase-setup.md    ← one-time Firebase project setup
│   └── cloud-deploy.md      ← Render deployment walkthrough
├── phase1/                  ← frozen snapshot (Phase 1 POC)
└── phase2a/                 ← frozen snapshot (Phase 2A native APK)
```

## Current status — Phase 2B Step 1.5 (cloud relay deploy)

| Feature | Status |
|---|---|
| Foreground service keeps WebSocket alive in background | ✅ Phase 2A |
| FCM push delivery (works on mobile data) | ✅ Phase 2B Step 1 |
| **Cloud relay on Render (works from anywhere)** | ✅ **Phase 2B Step 1.5** |
| End-to-end encryption (libsodium) | ⏳ Phase 2B Step 2 |
| Auto-start on phone boot + Windows boot | ⏳ Phase 2B Step 4 |

## Quick start

### One-time setup (do these once)

1. **Firebase project** — see [docs/firebase-setup.md](docs/firebase-setup.md) (~10 min)
2. **Cloud relay on Render** — see [docs/cloud-deploy.md](docs/cloud-deploy.md) (~15 min)
3. **Build the Android APK** — `cd app-android && .\build-apk.ps1`
4. **Install APK on your phone** — allow "unknown apps"
5. **Load the Chrome extension** — `chrome://extensions` → Load unpacked → select `chrome-extension/`

### Daily workflow (after setup)

1. Open CrossPaste on your phone
2. Enter your Render URL: `wss://crosspaste-relay-xxxx.onrender.com`
3. Tap **Start**
4. On your laptop, select text → right-click → "Send selection to phone"
5. Paste in any app on your phone — works on Wi-Fi, mobile data, or anywhere in the world

## Phases (history)

- **Phase 1** (`phase1/`) — Chrome extension + Expo Go app. Proved the basic flow but disconnected when Expo Go was backgrounded.
- **Phase 2A** (`phase2a/`) — Native Kotlin APK with foreground service. Solved the backgrounding problem. Same Wi-Fi only.
- **Phase 2B** — FCM push + cloud relay on Render + (planned) encryption + auto-start. Live code at root.

See [docs/phase-notes.md](docs/phase-notes.md) for what each phase proved and what's next.
