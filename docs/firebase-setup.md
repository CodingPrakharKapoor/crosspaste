# Firebase setup — one-time, ~10 minutes

CrossPaste uses Firebase Cloud Messaging (FCM) for push notifications. This lets the relay wake up your phone even when it's on mobile data (not just same Wi-Fi).

FCM is **free** with no quotas for your use case. You stay on the Spark (free) plan — no credit card needed.

## What you'll create

Two files you'll download from Firebase Console:
1. `app-android/app/google-services.json` — for the Android app
2. `relay/firebase-service-account.json` — for the relay (Node.js server)

Both are specific to your Firebase project. **Never commit them to git** — they're already in `.gitignore`.

---

## Step 1 — Create the Firebase project

1. Open https://console.firebase.google.com
2. Click **Add project** (or "Create a project")
3. Name it `crosspaste` (or whatever you want)
4. **Disable Google Analytics** (toggle off — we don't need it)
5. Click **Create project**
6. Wait ~30 seconds for provisioning
7. Click **Continue** when ready

## Step 2 — Add an Android app to the project

1. On the project overview page, click the **Android icon** (or "+" → Android)
2. **Android package name:** `com.crosspaste.app` (must match exactly — case sensitive)
3. **App nickname:** `CrossPaste` (optional)
4. **Debug signing certificate SHA-1:** leave blank (we'll use a debug build)
5. Click **Register app**
6. **Download `google-services.json`** when prompted
7. Click **Next** through the "Add Firebase SDK" steps — you can skip them, our Gradle file already has the SDK
8. Click **Continue to console**

## Step 3 — Place `google-services.json` in the Android project

1. Move the downloaded `google-services.json` to:
   ```
   C:\Users\prakh\crosspaste\app-android\app\google-services.json
   ```
2. Verify: the file exists at that exact path.

If you skip this step, the build will fail with `File google-services.json is missing`.

## Step 4 — Generate the service account key (for the relay)

1. In Firebase Console, click the **gear icon** (Project Settings) next to "Project Overview"
2. Go to the **Service Accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** in the confirmation dialog
5. A JSON file downloads (named something like `crosspaste-firebase-adminsdk-xxxxx.json`)

## Step 5 — Place the service account key in the relay folder

1. Rename the downloaded file to `firebase-service-account.json`
2. Move it to:
   ```
   C:\Users\prakh\crosspaste\relay\firebase-service-account.json
   ```
3. Verify: the file exists at that exact path.

If you skip this step, the relay will print an error and exit immediately when you run `npm start`.

## Step 6 — Verify both files are git-ignored

Open PowerShell in your repo folder:

```powershell
cd C:\Users\prakh\crosspaste
git check-ignore -v app-android/app/google-services.json
git check-ignore -v relay/firebase-service-account.json
```

Both should print a line showing they're matched by `.gitignore`. If either prints nothing, your `.gitignore` is wrong — tell me.

## Step 7 — Done

You're ready to build the APK and start the relay. See `app-android/README.md` and `relay/README.md`.

---

## Troubleshooting

### "File google-services.json is missing"
You skipped Step 3. Download it from Firebase Console → Project Settings → General → Your apps → Android app → `google-services.json`.

### "Default FirebaseApp is not initialized"
The `google-services.json` is malformed or for a different package name. Re-download it and make sure you registered the Android app with package name `com.crosspaste.app`.

### Relay says "firebase-service-account.json not found"
You skipped Step 5. Generate the key from Firebase Console → Project Settings → Service Accounts → Generate new private key.

### Relay says "Firebase App Options is not initialized"
The service account JSON is malformed. Re-download it.

### Phone says "FCM token: not available yet"
Wait 30 seconds — Firebase token generation can take a moment on first launch. If still no token after a minute, check your phone's internet connection.
