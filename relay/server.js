// CrossPaste relay v0.3.3 — rate limiting + real client IP + active-connection tracking
//
// v0.3.3 changes:
//   - Log and rate-limit by the REAL client IP (first value of the
//     x-forwarded-for header), not req.socket.remoteAddress. On Render the
//     socket address is the platform's internal reverse proxy (::1), so
//     every client - phone, extension, health checker - looked identical
//     in the logs, and per-IP rate limiting was useless (all clients
//     shared the proxy's single 5-conn bucket, so a stormy phone blocked
//     the extension too). With the real IP, the log shows who is actually
//     reconnecting and each client gets its own rate-limit bucket.
//
// v0.3.2 changes:
//   - Per-IP connection rate limiting: max 5 new WebSocket connections per
//     10 sec per IP, then a 30-sec cooldown. Stops the log flooding and CPU
//     spikes we saw when a buggy client reconnects in a tight loop. The
//     Android app's exponential backoff means a rate-limited client just
//     waits longer before the next attempt.
//   - Tracks active WebSocket connections separately from registered FCM
//     tokens, so /health shows both:
//       registeredPhones   — phones we can push to via FCM (may be 0 active)
//       activeConnections  — phones currently connected over WebSocket
//   - Logs a phone registration once per new token. Re-registrations of an
//     already-known token no longer spam the log.
//
// Flow:
//   Chrome extension ──ws/wss──> relay ──ws/wss──> phone (instant delivery)
//                                relay ──FCM──> phone (push for offline phones)

const http = require('http');
const WebSocket = require('ws');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const VERSION = '0.3.3';

// ---- Firebase credentials --------------------------------------------------
let serviceAccount;
const envVarContents = process.env.FIREBASE_SERVICE_ACCOUNT;
if (envVarContents) {
    try {
        serviceAccount = JSON.parse(envVarContents);
        console.log('Loaded Firebase credentials from FIREBASE_SERVICE_ACCOUNT env var');
    } catch (e) {
        console.error('FIREBASE_SERVICE_ACCOUNT env var is set but not valid JSON.');
        process.exit(1);
    }
} else {
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('');
        console.error('ERROR: No Firebase credentials found.');
        console.error('  Local:  place the file at relay/firebase-service-account.json');
        console.error('  Cloud:  set FIREBASE_SERVICE_ACCOUNT env var to the JSON file contents');
        console.error('');
        console.error('See docs/cloud-deploy.md for the full walkthrough.');
        console.error('');
        process.exit(1);
    }
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// ---- State -----------------------------------------------------------------
const phoneTokens = new Set();          // FCM tokens of phones we can push to
const ipConnectLog = new Map();         // ip -> [connection timestamps in ms]
const ipCooldownUntil = new Map();      // ip -> ms timestamp; reject until then

const RATE_WINDOW_MS = 10_000;          // 10 sec sliding window
const RATE_MAX_CONNS = 5;               // max 5 connections per 10s per IP
const RATE_COOLDOWN_MS = 30_000;        // 30 sec cooldown after exceeding

function checkRateLimit(ip) {
    const now = Date.now();
    const cooldownUntil = ipCooldownUntil.get(ip) || 0;
    if (now < cooldownUntil) {
        return { allowed: false, reason: 'cooldown' };
    }
    const log = ipConnectLog.get(ip) || [];
    const recent = log.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_CONNS) {
        ipCooldownUntil.set(ip, now + RATE_COOLDOWN_MS);
        ipConnectLog.set(ip, []);       // reset window after cooldown trigger
        console.log(`[!] Rate limit triggered for ${ip} - cooldown ${RATE_COOLDOWN_MS / 1000}s`);
        return { allowed: false, reason: 'rate_limited' };
    }
    recent.push(now);
    ipConnectLog.set(ip, recent);
    return { allowed: true };
}

// ---- HTTP server -----------------------------------------------------------
// Render proxies HTTPS → HTTP internally. WebSocket clients connect with
// wss:// and the platform terminates TLS for us.
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            service: 'crosspaste-relay',
            version: VERSION,
            registeredPhones: phoneTokens.size,
            activeConnections: getActiveConnectionCount(),
            uptimeSec: Math.floor(process.uptime())
        }));
        return;
    }
    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocket.Server({ server });

function getActiveConnectionCount() {
    let count = 0;
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) count++; });
    return count;
}

wss.on('connection', (ws, req) => {
    // Render (and most reverse proxies) put the real client IP in
    // x-forwarded-for. req.socket.remoteAddress is the proxy itself (::1
    // on Render), which makes every client look identical in the logs and
    // collapses all per-IP rate limiting into one shared bucket. Take the
    // leftmost IP (the originating client); fall back to the socket
    // address only if the header is absent (e.g. local dev).
    const xff = req.headers['x-forwarded-for'];
    const ip = (xff && String(xff).split(',')[0].trim()) || req.socket.remoteAddress;

    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
        // 1008 = policy violation. The client treats this as a hard close
        // and (with exponential backoff) waits before retrying.
        try { ws.close(1008, rl.reason); } catch (e) {}
        return;
    }

    console.log(`[+] New connection from ${ip} (active: ${getActiveConnectionCount()})`);

    ws.on('message', async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            return;
        }

        // Phone registers its FCM token so the relay can push to it when the
        // WebSocket isn't connected (mobile data, different city, app closed).
        if (msg.type === 'register' && msg.fcmToken) {
            if (!phoneTokens.has(msg.fcmToken)) {
                phoneTokens.add(msg.fcmToken);
                console.log(`[+] Phone registered (total: ${phoneTokens.size})`);
            }
            // Ack so the client knows registration landed (lets us add
            // re-registration-on-reconnect logic without log spam).
            try { ws.send(JSON.stringify({ type: 'register-ack', ok: true })); } catch (e) {}
            return;
        }

        // Chrome extension sends clipboard text. The relay:
        //   1. Broadcasts to all currently-connected phones (instant)
        //   2. Pushes via FCM to all registered tokens (works on mobile data)
        if (msg.type === 'clipboard' && msg.text) {
            let wsDelivered = 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(raw.toString());
                    wsDelivered++;
                }
            });

            // FCM data payload limit is 4 KB; truncate to be safe.
            const truncated = msg.text.length > 4000
                ? msg.text.substring(0, 4000)
                : msg.text;

            let pushSent = 0;
            let pushFailed = 0;

            for (const token of Array.from(phoneTokens)) {
                try {
                    await admin.messaging().send({
                        token: token,
                        data: {
                            type: 'clipboard',
                            text: truncated
                        }
                    });
                    pushSent++;
                } catch (err) {
                    pushFailed++;
                    if (err.code === 'messaging/registration-token-not-registered' ||
                        err.code === 'messaging/invalid-registration-token') {
                        phoneTokens.delete(token);
                        console.log(`[-] Removed stale FCM token`);
                    } else {
                        console.error(`[!] FCM push error:`, err.message);
                    }
                }
            }

            console.log(`[>] Clipboard ${msg.text.length} chars | WS:${wsDelivered} FCM-ok:${pushSent} FCM-fail:${pushFailed}`);
        }
    });

    ws.on('close', () => {
        const remaining = getActiveConnectionCount();
        if (remaining === 0) {
            console.log(`[-] Last connection closed (active: 0)`);
        }
    });
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

server.listen(PORT, () => {
    console.log('');
    console.log(`CrossPaste relay v${VERSION}`);
    console.log('========================');

    if (process.env.RENDER_EXTERNAL_URL) {
        // Cloud (Render) mode
        const url = process.env.RENDER_EXTERNAL_URL;
        console.log(`Health check: ${url}/health`);
        console.log(`WebSocket URL: ${url.replace('https://', 'wss://')}`);
        console.log(`(Phones + Chrome extension connect here from anywhere)`);
    } else {
        // Local mode
        const localIP = getLocalIP();
        console.log(`WebSocket URL:  ws://${localIP}:${PORT}`);
        console.log(`                ws://localhost:${PORT}`);
        console.log(`Health check:   http://localhost:${PORT}/health`);
        console.log(`(Use the LAN IP for same-Wi-Fi devices)`);
    }
    console.log('');
    console.log(`Rate limit: ${RATE_MAX_CONNS} conns / ${RATE_WINDOW_MS / 1000}s per IP, ${RATE_COOLDOWN_MS / 1000}s cooldown`);
    console.log('');
    console.log('Listening for connections...');
});
