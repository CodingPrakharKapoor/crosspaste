# Phase notes

## Phase 1 — POC (Chrome extension + Expo Go)

**Goal:** prove the basic flow works end-to-end.

**Architecture:**
- Chrome extension captures selected text on right-click
- Mock relay (Node.js + `ws`) just echoes messages to all WebSocket clients
- Expo Go app on phone connects to relay, writes incoming text to clipboard

**What it proved:** The trick works. Text selected on laptop appears on phone's clipboard.

**Wall hit:** Expo Go is just a regular foreground app. Android kills its WebSocket when it's backgrounded. Paste only worked while Expo Go was open.

**Files:** `phase1/` (frozen)

---

## Phase 2A — Native Kotlin APK with foreground service

**Goal:** solve the backgrounding wall.

**Architecture:**
- Replaced Expo Go with a real installed APK
- Added a foreground service (`ClipboardForegroundService`) that holds the WebSocket open
- Persistent notification ("CrossPaste — Connected") keeps Android from killing the service
- Auto-reconnect every 2 seconds on disconnect

**What it proved:** Paste works while switching apps, locking the phone, or using other apps.

**Walls remaining:**
- Same Wi-Fi only (no mobile data support)
- Relay sees plaintext (no encryption)
- Manual IP entry every time
- Relay must be started manually

**Files:** `phase2a/` (frozen)

---

## Phase 2B — FCM push + cloud relay + encryption + auto-start

**Goal:** make it usable daily, from anywhere, without manual setup.

### Step 2B.1 — FCM push integration

**Architecture changes:**
- Phone registers its FCM token with the relay on WebSocket connect
- Relay stores tokens in memory
- When Chrome extension sends clipboard text:
  - Relay broadcasts via WebSocket to connected phones (instant)
  - Relay pushes via FCM to all registered tokens (works on mobile data)
- New `CrossPasteFirebaseMessagingService` on phone receives FCM push, writes to clipboard

**What this proved:** Paste works on mobile data, not just same Wi-Fi — but only if the phone already registered its FCM token with the relay (which still required being on the same network initially).

**Files:** `app-android/`, `chrome-extension/`, `relay/`, `docs/` (live at repo root)

### Step 2B.1.5 — Cloud relay deploy (this step)

**Architecture changes:**
- Relay runs on Render (free tier) instead of on the laptop
- Relay listens on `process.env.PORT`, uses HTTP server + WebSocket.Server
- Firebase credentials read from `FIREBASE_SERVICE_ACCOUNT` env var (no secret file in git)
- `/health` endpoint for Render health checks
- Android app accepts full `wss://...` URLs (not just IPs) — backward compatible with bare IPs
- Chrome extension popup updated to suggest cloud URLs

**What this proved:** Cross-network clipboard sync. A phone in another city can connect to the cloud relay, register its FCM token, and receive pastes from your laptop anywhere in the world.

**Files changed (cloud-deploy):**
- `relay/server.js` — uses `process.env.PORT`, HTTP server wraps WebSocket, env-var credentials
- `relay/package.json` — added `engines.node`
- `relay/render.yaml` — Render blueprint
- `relay/README.md` — local + cloud deploy instructions
- `app-android/app/src/main/java/com/crosspaste/app/MainActivity.kt` — accepts full URLs, has `normalizeRelayUrl()` helper
- `app-android/app/src/main/java/com/crosspaste/app/ClipboardForegroundService.kt` — uses full URL instead of host
- `app-android/app/src/main/res/layout/activity_main.xml` — updated hint to mention cloud URL
- `chrome-extension/popup.html` — updated hint
- `chrome-extension/README.md` — updated
- `docs/cloud-deploy.md` — full Render walkthrough
- `docs/phase-notes.md` — this file

### Step 2B.2 — End-to-end encryption (planned)

Add libsodium to Android app and Chrome extension. Shared key established via manual base64 pairing (simplest) or QR code (more polished).

### Step 2B.3 — Relay updates for encrypted payloads (planned)

Relay becomes a "dumb pipe" — can't read clipboard contents, just forwards opaque ciphertext.

### Step 2B.4 — Auto-start on boot (planned)

- Android: `BOOT_COMPLETED` receiver starts the foreground service
- Windows: relay runs as a scheduled task / NSSM service
- URL persisted in SharedPreferences (no manual entry on relaunch)
