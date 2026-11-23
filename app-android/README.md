# CrossPaste Android app

Native Kotlin app with a foreground service + Firebase Cloud Messaging.

## Prerequisites

- Android SDK + Gradle installed (run `setup-android-sdk.ps1` once)
- `google-services.json` placed at `app/google-services.json` (see `../docs/firebase-setup.md`)

## Build the APK

```powershell
cd C:\Users\prakh\crosspaste\app-android
.\build-apk.ps1
```

The APK lands at:
```
app\build\outputs\apk\debug\app-debug.apk
```

## Install on your phone

1. Copy `app-debug.apk` to your phone
2. Install it (allow "unknown apps" if prompted)
3. Open **CrossPaste** from your app drawer

## ColorOS battery settings (one-time, important)

ColorOS kills background apps aggressively. Do these three things once:

1. **Settings → Apps → CrossPaste → Battery → Allow auto-start** → ON
2. **Settings → Apps → CrossPaste → Battery optimization** → "Don't optimize"
3. In the recent-apps overview, **long-press the CrossPaste card → Lock**

## Use

1. Start the relay on your laptop (see `../relay/README.md`)
2. Open CrossPaste on your phone
3. Type the laptop IP (printed by the relay on startup)
4. Tap **Start**
5. The notification appears: "Connected - ready to paste"
6. The FCM token is shown on the main screen (for debugging — you don't need to do anything with it)

Now paste works whether you're on the same Wi-Fi as your laptop or on mobile data.

## What's new in Phase 2B Step 1

- `CrossPasteFirebaseMessagingService.kt` — receives FCM pushes, writes to clipboard
- `MainActivity` fetches the FCM token on launch
- `ClipboardForegroundService` sends the FCM token to the relay on WebSocket connect
- `app/build.gradle` includes `firebase-bom` and `firebase-messaging`
- Project-level `build.gradle` includes the `google-services` plugin

## Troubleshooting

**Build fails with "File google-services.json is missing"**
→ Place it at `app/google-services.json` (see `../docs/firebase-setup.md`).

**App crashes on launch with "Default FirebaseApp is not initialized"**
→ Your `google-services.json` is for a different package name. Re-download it after registering the Android app with package `com.crosspaste.app`.

**App connects but no FCM push when on mobile data**
→ Make sure the phone connected to the relay at least once on the same Wi-Fi (to register the FCM token). After that, FCM push works from anywhere.

**Paste stops working after a few minutes**
→ ColorOS killed the service. Re-check the three battery settings above.
