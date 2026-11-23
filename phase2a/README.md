# CrossPaste — Phase 2A (Windows + Android, foreground service)

Phase 1 proved the trick works while the Expo Go app is open.
Phase 2A graduates to a real installed APK with a **foreground service** so the
WebSocket stays alive when you switch apps, lock the phone, or open WhatsApp.

Phase 1's Chrome extension and mock relay stay **unchanged**. Only the phone app
changes.

---

## What's new in Phase 2A

- **Real APK** (no Expo Go, no QR code scanning)
- **Foreground service** holds the WebSocket open in the background
- **Persistent notification** ("CrossPaste — Connected")
- **Auto-reconnect** if the WebSocket drops
- **Works while you switch apps**, lock the phone, or use other apps

What's still missing (planned for Phase 2B and later):
- Push notifications via Firebase Cloud Messaging (so it works on mobile data)
- End-to-end encryption (libsodium)
- Image support
- iOS support

---

## Prerequisites (you already have these)

- Windows 11
- Java 21 (installed) — covers the JDK requirement
- ~500 MB free disk space (for SDK + Gradle cache)
- ~1.5 GB free RAM during the build (close Chrome if needed)
- Your Phase 1 chrome-extension and mock-relay folders (still in use)
- Phone and laptop on the **same Wi-Fi**

---

## One-time setup (~5 minutes, ~250 MB download)

1. Extract this folder somewhere, e.g. `C:\crosspaste-phase2`.
2. Open **PowerShell** in that folder.
3. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-android-sdk.ps1
   ```

This will:
- Download Android cmdline-tools (~80 MB)
- Set `ANDROID_HOME` permanently
- Accept SDK licenses
- Install platform-tools + android-34 + build-tools-34 (~120 MB)
- Download Gradle 8.10.2 (~128 MB)
- Add Gradle to PATH permanently
- Write `app-project\local.properties`

When it finishes, your environment is ready. You only ever run this once.

---

## Build the APK (~3-5 minutes the first time, ~30 sec after)

In the same folder:

```powershell
.\build-apk.ps1
```

Or manually (in a NEW PowerShell window so PATH is fresh):

```powershell
cd app-project
gradle assembleDebug --no-daemon --console=plain
```

The first build downloads AGP + Kotlin + AndroidX (~200 MB one-time cache).
Subsequent builds reuse the cache and finish in ~30 seconds.

The APK ends up at:

```
app-project\app\build\outputs\apk\debug\app-debug.apk
```

---

## Install on your phone

1. Copy `app-debug.apk` to your phone (USB / Google Drive / Telegram Saved Messages — whatever you used for Phase 1).
2. Open the APK on your phone, allow "install from unknown apps" if prompted.
3. Open **CrossPaste** from your app drawer.

---

## ColorOS 16 — important battery settings

ColorOS aggressively kills background apps. Even with a foreground service,
you need to do three things once:

1. **Settings → Apps → CrossPaste → Battery → Allow auto-start** → ON
2. **Settings → Apps → CrossPaste → Battery → Battery optimization** → "Don't optimize"
3. In the recent-apps overview, **long-press the CrossPaste card → Lock**

If you skip these, ColorOS may kill the service after a few minutes and paste
will silently stop working.

---

## Run the end-to-end test

1. **Relay** — in a terminal on your laptop:
   ```powershell
   cd ..\crosspaste-phase1\mock-relay
   npm start
   ```
   Note the `ws://X.X.X.X:8080` line — that's your laptop IP.

2. **Phone** — open CrossPaste, type the laptop IP, tap **Start**.
   Notification appears: "Connected — ready to paste".

3. **Chrome extension** — load it the same way as Phase 1 (chrome://extensions →
   Load unpacked → select `crosspaste-phase1\chrome-extension`). If you already
   loaded it in Phase 1, it's still there.

4. **Test the wall you hit before:**
   - Select text on any webpage, right-click → "Send selection to phone"
   - **Switch to WhatsApp** (or any app) immediately
   - Long-press a text field, tap Paste
   - The text should be there, even if you switched apps before pasting

5. **Test background persistence:**
   - Tap Start in CrossPaste
   - Press the home button (app goes to background)
   - Send text from your laptop
   - Paste in any app — it should still work

---

## Troubleshooting

**"sdk.dir not set" / "ANDROID_HOME not found"**
- You skipped setup-android-sdk.ps1. Run it.
- Or open a NEW PowerShell window — env vars from the setup script only apply to
  new sessions (plus the one that ran setup).

**Build fails with out-of-memory error**
- Close Chrome, Slack, etc. before building.
- You have 8 GB RAM. The build needs ~1.5 GB peak.
- If still failing, edit `app-project\gradle.properties` and lower
  `org.gradle.jvmargs` to `-Xmx768m`.

**Build fails with "Could not resolve com.android.tools.build:gradle"**
- Network issue. Check your proxy / VPN.
- The Sophos TAP adapter in your network config may block Maven Central.
- Try without VPN if you have one running.

**App says "Connecting..." forever, never says "Connected"**
- Phone and laptop not on the same Wi-Fi.
- Wrong IP entered. The IP is printed by the relay when it starts.
- Windows Firewall blocking Node.js — allow it on private networks.
- Router has "AP isolation" / "client isolation" on. Disable it on the router,
  or use your phone's hotspot and connect the laptop to it.

**App connected but paste shows old content**
- Tap Stop, then Start again.
- Android 13+ shows a "App pasted from clipboard" toast — that's expected.
- ColorOS may have killed the service. Check the three battery settings above.

**Service dies after a few minutes**
- ColorOS battery optimization. Re-check the three settings above.
- Pull down the notification shade — if the "CrossPaste" notification is gone,
  the service was killed.

---

## File layout

```
crosspaste-phase2/
├── README.md
├── setup-android-sdk.ps1     (one-time install: SDK + Gradle)
├── build-apk.ps1             (builds the APK)
└── app-project/
    ├── build.gradle          (project-level)
    ├── settings.gradle
    ├── gradle.properties
    ├── local.properties      (auto-generated by setup)
    └── app/
        ├── build.gradle      (app-level)
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/crosspaste/app/
            │   ├── MainActivity.kt
            │   └── ClipboardForegroundService.kt
            └── res/
                ├── layout/activity_main.xml
                ├── values/{strings,colors,themes}.xml
                └── drawable/ic_notification.xml
```

---

## What this proves (and what's next)

Proves:
- Foreground service keeps the WebSocket alive in the background.
- Paste works when you switch apps.
- The whole flow works without Expo Go — you have a real installed APK.

Does NOT prove yet (Phase 2B):
- Works on mobile data (not just same Wi-Fi).
- Encryption (relay currently sees plaintext).
- Push delivery when the service is killed.

When Phase 2A works reliably, we move to Phase 2B: add Firebase Cloud Messaging
for true push, and libsodium for end-to-end encryption.
