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

## Phase 2B — FCM push + encryption + auto-start

**Goal:** make it usable daily without manual setup.

### Step 2B.1 — FCM push integration (this step)

**Architecture changes:**
- Phone registers its FCM token with the relay on WebSocket connect
- Relay stores tokens in memory
- When Chrome extension sends clipboard text:
  - Relay broadcasts via WebSocket to LAN-connected phones (instant)
  - Relay pushes via FCM to all registered tokens (works on mobile data)
- New `CrossPasteFirebaseMessagingService` on phone receives FCM push, writes to clipboard

**What this proves:** Paste works on mobile data, not just same Wi-Fi.

**Limitations still:**
- Relay sees plaintext (encryption is Step 2B.2)
- Relay must be running on laptop (auto-start is Step 2B.4)
- Phone must register token once via LAN before FCM works

**Files:** `app-android/`, `chrome-extension/`, `relay/`, `docs/` (live at repo root)

### Step 2B.2 — End-to-end encryption (planned)

Add libsodium to Android app and Chrome extension. Shared key established via QR-code pairing.

### Step 2B.3 — Relay updates for encrypted payloads (planned)

Relay becomes a "dumb pipe" — can't read clipboard contents.

### Step 2B.4 — Auto-start on boot (planned)

- Android: `BOOT_COMPLETED` receiver starts the foreground service
- Windows: relay runs as a scheduled task / NSSM service
- IP persisted in SharedPreferences (no manual entry on relaunch)
