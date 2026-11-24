# CrossPaste relay

Node.js WebSocket server + Firebase Cloud Messaging bridge. Runs locally **or** deployed on Render (free tier).

## Two ways to run

### Local mode (same Wi-Fi only)

For testing on your own LAN. Phone and laptop must share a network.

```powershell
cd C:\Users\prakh\crosspaste\relay
npm install
npm start
```

You'll see:
```
CrossPaste relay v0.3.1
========================
WebSocket URL:  ws://192.168.x.x:8080
                ws://localhost:8080
Health check:   http://localhost:8080/health
```

### Cloud mode (works from anywhere)

Deployed on Render. Phones anywhere in the world can connect. See [../docs/cloud-deploy.md](../docs/cloud-deploy.md) for the full walkthrough.

After deploying, your relay URL is something like:
```
wss://crosspaste-relay-xxxx.onrender.com
```

## How it works

```
Chrome extension ──ws/wss──> relay ──ws/wss──> phone (instant delivery)
                            relay ──FCM──> phone (push for offline phones)
```

When the phone connects to the relay via WebSocket, it sends its FCM token. The relay stores tokens in memory. When the Chrome extension sends clipboard text:

1. **WebSocket broadcast** — instant delivery to phones currently connected
2. **FCM push** — delivery to phones not currently connected (mobile data, different city, etc.)

Both happen in parallel. The phone may receive the message twice (once via WS, once via FCM), but writing to the clipboard twice with the same content is harmless.

## Firebase credentials

Two ways to provide them:

| Method | When to use |
|---|---|
| `relay/firebase-service-account.json` (file) | Local dev |
| `FIREBASE_SERVICE_ACCOUNT` env var (file contents as string) | Render / cloud |

The server checks the env var first, then falls back to the file. See [../docs/firebase-setup.md](../docs/firebase-setup.md) to generate the credentials.

## Health check

`GET /` or `GET /health` returns:
```json
{
  "ok": true,
  "service": "crosspaste-relay",
  "version": "0.3.1",
  "registeredPhones": 0,
  "uptimeSec": 12
}
```

Use this to verify the relay is alive (Render also uses it for health checks).

## What's new in v0.3.1 (cloud deploy)

- Server now listens on `process.env.PORT` (Render requirement)
- HTTP server wraps the WebSocket server (needed for Render's proxy + health checks)
- Firebase credentials can come from `FIREBASE_SERVICE_ACCOUNT` env var (so you don't commit the secret JSON to git)
- `/health` endpoint for Render's health checks
- Detects `RENDER_EXTERNAL_URL` env var and prints the correct public `wss://` URL

## Troubleshooting

**"firebase-service-account.json not found"**
You're running locally and haven't placed the file. See [../docs/firebase-setup.md](../docs/firebase-setup.md).

**"FIREBASE_SERVICE_ACCOUNT env var is set but not valid JSON"**
On Render, you set the env var but its value isn't valid JSON. Open the JSON file in a text editor, copy the **entire** contents (including all curly braces), and paste it into the env var value field. See [../docs/cloud-deploy.md](../docs/cloud-deploy.md) Step 7.

**`npm install` fails**
Network issue. Disconnect VPN if any. The `firebase-admin` package is ~10 MB.

**Relay runs but FCM push doesn't reach phone**
- Phone must connect to the relay at least once (to register its FCM token)
- Check the relay console — it should print `[+] Phone registered` when the phone connects
- Console prints `FCM-ok:1` when a push succeeds, `FCM-fail:1` when it fails
- `FCM-fail:1` with `registration-token-not-registered` means the phone needs to reconnect to re-register its token

**Render service sleeps after 15 min of inactivity**
Free tier limitation. The first request after sleep takes ~30 sec to wake the service. The Android app's foreground service pings every 15 sec, which keeps the relay awake while the phone is connected. If the phone disconnects, the relay may sleep — but the next time the phone reconnects (auto-reconnect every 2 sec), it wakes the relay again.
