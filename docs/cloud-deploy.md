# Cloud deploy — Render free tier (~15 minutes)

This walks you through deploying the CrossPaste relay to Render so it works from anywhere (not just same Wi-Fi).

## Why deploy to the cloud?

Right now your relay runs on your laptop. Phones can only reach it if they're on the same network. Deploying to Render means:

- Phones anywhere in the world can connect
- Your laptop doesn't need to be on
- The relay URL is stable (`wss://crosspaste-relay.onrender.com`)
- Free tier is enough for personal use

## Prerequisites

- A GitHub account (you already have this — your repo is at https://github.com/CodingPrakharKapoor/crosspaste)
- A Render account (free signup at https://render.com with your email or GitHub)
- Firebase project already set up (see `firebase-setup.md`)
- Phase 2B Step 1 committed and pushed to GitHub

## Step 1 — Commit and push the cloud-deploy changes

First apply the cloud-deploy zip I sent you, then commit:

```powershell
cd C:\Users\prakh\crosspaste
git add .
git status
git commit -m "Phase 2B Step 1.5: cloud-deploy-ready relay"
git push
```

Your GitHub repo must have these files at `relay/`:
- `relay/server.js` (v0.3.1 — uses `process.env.PORT`)
- `relay/package.json` (v0.3.1 — has `engines.node`)
- `relay/render.yaml`

## Step 2 — Sign in to Render

1. Open https://render.com
2. Click **Sign Up** → choose **GitHub** (fastest)
3. Authorize Render to access your GitHub account
4. You'll land on the Render dashboard

## Step 3 — Create a new Web Service

1. Click **New +** → **Blueprint**
2. Select your `crosspaste` repo
3. Render detects `relay/render.yaml` and shows the blueprint
4. Click **Apply**
5. Render starts building the service (~2 minutes for first build)

## Step 4 — Wait for the build to finish

Render's build log will show:
- `=> Building from GitHub repo`
- `=> Running buildCommand: npm install`
- `=> Deploying...`

When done, you'll see **Live** in green at the top of the service page.

## Step 5 — Get your Render URL

At the top of the service page, you'll see a URL like:
```
https://crosspaste-relay-xxxx.onrender.com
```

Click it. You should see JSON:
```json
{"ok":true,"service":"crosspaste-relay","version":"0.3.1","registeredPhones":0,"uptimeSec":12}
```

That's your relay's health endpoint. Your WebSocket URL is the same host with `wss://`:
```
wss://crosspaste-relay-xxxx.onrender.com
```

## Step 6 — Set the FIREBASE_SERVICE_ACCOUNT env var

The relay needs your Firebase credentials. Since you can't commit the JSON file to git, you pass it as an env var.

1. Open your `firebase-service-account.json` file in a text editor (Notepad works)
2. Select all (`Ctrl+A`) → copy (`Ctrl+C`)
3. Back in Render: click your **crosspaste-relay** service → **Environment** in the left sidebar
4. Click **Add Environment Variable**
5. **Key:** `FIREBASE_SERVICE_ACCOUNT`
6. **Value:** paste the entire JSON contents (the editor may complain about newlines — that's fine, paste it all)
7. Click **Save Changes**

Render automatically redeploys with the new env var (~1 minute).

## Step 7 — Verify the relay is healthy

After redeploy finishes:

1. Visit `https://crosspaste-relay-xxxx.onrender.com/health`
2. You should see the JSON response with `"ok":true`

If you see `"Firebase App Options is not initialized"` or the service crashes:
- The `FIREBASE_SERVICE_ACCOUNT` env var is malformed
- Re-copy the JSON file contents and paste them again — make sure you copied the **entire** file (starts with `{`, ends with `}`)

## Step 8 — Update the Chrome extension

1. Click the CrossPaste icon in your toolbar
2. In the popup, enter your Render URL:
   ```
   wss://crosspaste-relay-xxxx.onrender.com
   ```
3. Click **Save & Connect**
4. Status should show: **✓ Connected to wss://crosspaste-relay-xxxx.onrender.com**

## Step 9 — Build and install the new APK

The Android app now accepts full URLs.

```powershell
cd C:\Users\prakh\crosspaste\app-android
.\build-apk.ps1
```

Copy the new APK to your phone, install it (replaces the old version).

## Step 10 — Configure the phone app

1. Open CrossPaste on your phone
2. In the URL field, enter:
   ```
   wss://crosspaste-relay-xxxx.onrender.com
   ```
3. Tap **Start**
4. Notification appears: "Connected - ready to paste"
5. Relay console (Render dashboard → Logs) should show:
   ```
   [+] New connection from <ip>
   [+] Phone registered (total: 1)
   ```

## Step 11 — The cross-city test

This is the moment of truth.

1. Select text on your laptop → right-click → "Send selection to phone"
2. Relay logs show: `[>] Clipboard N chars | WS:0 FCM-ok:1 FCM-fail:0`
3. Paste in any app on your phone — text is there

Now try with your friend's phone in another city:
1. Install the APK on their phone
2. Have them enter the same Render URL: `wss://crosspaste-relay-xxxx.onrender.com`
3. They tap Start
4. You select text on your laptop → right-click → send
5. **Their phone gets the paste** — even though they're in another city on a different network

If this works, you have a fully cross-network clipboard sync. 🎉

## Troubleshooting

**Build fails on Render ("Cannot find module 'ws'")**
Your `package.json` is missing dependencies. Verify `relay/package.json` has `ws` and `firebase-admin` in `dependencies`. Commit and push, Render will redeploy.

**Service crashes immediately after deploy**
Check Render logs. Most likely `FIREBASE_SERVICE_ACCOUNT` is missing or malformed. See Step 6.

**Phone says "FCM token: not available yet"**
Wait 30 seconds — Firebase token generation can take a moment on first launch. Check your phone's internet connection.

**Phone connects but no push arrives**
- Check Render logs for `[+] Phone registered` — if missing, the phone didn't connect
- Check Render logs for `FCM-ok:1` vs `FCM-fail:1` when you send
- `FCM-fail:1` with `registration-token-not-registered` means the phone needs to reconnect to re-register

**Render service sleeps after 15 min**
Free tier limitation. The Android foreground service pings every 15 sec, which keeps the relay awake while the phone is connected. If disconnected, the relay sleeps — but the phone auto-reconnects every 2 sec, which wakes the relay.

**Render URL has a random suffix (`-xxxx`)**
That's normal — Render generates a unique hostname. If you want a custom name, upgrade to a paid plan or use a custom domain.

## Cost

Render free tier:
- 750 hours/month of web service runtime (enough for always-on)
- Sleeps after 15 min of inactivity (but our foreground service keeps it awake)
- No credit card required for signup

For heavier use (multiple users, no sleep), Render's paid tier starts at $7/month.

## What's next

Once cloud deploy is verified working:
- **Phase 2B Step 2:** end-to-end encryption (libsodium + manual key pairing)
- **Phase 2B Step 3:** relay stays as a dumb pipe (can't read clipboard contents)
- **Phase 2B Step 4:** auto-start on phone boot

The cloud relay is now your production infrastructure. Future phases build on top of it.
