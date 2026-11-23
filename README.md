# CrossPaste

Copy on Windows laptop → paste on Android phone, in any app.

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
│   └── firebase-setup.md    ← step-by-step Firebase console walkthrough
├── phase1/                  ← frozen snapshot (Phase 1 POC)
└── phase2a/                 ← frozen snapshot (Phase 2A native APK)
```

## Current status — Phase 2B Step 1 (FCM push)

| Feature | Status |
|---|---|
| Foreground service keeps WebSocket alive in background | ✅ Phase 2A |
| FCM push delivery (works on mobile data, not just same Wi-Fi) | ✅ Phase 2B Step 1 |
| End-to-end encryption (libsodium) | ⏳ Phase 2B Step 2 |
| Auto-start on phone boot + Windows boot | ⏳ Phase 2B Step 4 |

## Quick start

See [docs/firebase-setup.md](docs/firebase-setup.md) for the one-time Firebase project setup (10 minutes).

After that, the daily workflow is:
1. Start the relay on your laptop: `relay\node server.js` (or run as a Windows service — Phase 2B Step 4)
2. Open CrossPaste on your phone → enter laptop IP → tap Start
3. On your laptop, select text → right-click → "Send selection to phone"
4. Paste in any app on your phone — works whether you're on Wi-Fi or mobile data

## Phases (history)

- **Phase 1** (`phase1/`) — Chrome extension + Expo Go app. Proved the basic flow but disconnected when Expo Go was backgrounded.
- **Phase 2A** (`phase2a/`) — Native Kotlin APK with foreground service. Solved the backgrounding problem. Same Wi-Fi only.
- **Phase 2B** — FCM push + end-to-end encryption + auto-start. Live code at root.

See [docs/phase-notes.md](docs/phase-notes.md) for what each phase proved and what's next.
