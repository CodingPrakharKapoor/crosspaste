// CrossPaste relay - bridges Chrome extension ↔ phone via WebSocket + FCM push.
//
// Runs both locally (ws://LAN-IP:8080) and on Render (wss://your-app.onrender.com).
//
// Flow:
//   Chrome extension ──ws/wss──> relay ──ws/wss──> phone (instant delivery)
//                                relay ──FCM──> phone (push for offline phones)
//
// Phone registers its FCM token with the relay on WebSocket connect. The relay
// stores tokens in memory. When a clipboard message arrives from the Chrome
// extension, the relay:
//   1. Broadcasts it to all WebSocket-connected phones (instant)
//   2. Pushes it via FCM to all registered tokens (works on mobile data)

const http = require('http');
const WebSocket = require('ws');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Render assigns PORT via env var. Default to 8080 for local dev.
const PORT = process.env.PORT || 8080;

// Load Firebase credentials. On Render, store the entire JSON contents in the
// FIREBASE_SERVICE_ACCOUNT env var. Locally, place the file in this folder.
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
        console.error('');
        console.error('To fix:');
        console.error('  Local:  place the file at relay/firebase-service-account.json');
        console.error('  Render: set FIREBASE_SERVICE_ACCOUNT env var to the JSON file contents');
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

const phoneTokens = new Set();

// HTTP server — needed for Render's health checks + WebSocket upgrade.
// Render proxies HTTPS → HTTP internally, so we listen on plain HTTP.
// WebSocket clients connect with wss:// and Render terminates TLS for us.
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            service: 'crosspaste-relay',
            version: '0.3.1',
            registeredPhones: phoneTokens.size,
            uptimeSec: Math.floor(process.uptime())
        }));
        return;
    }
    res.writeHead(404);
    res.end('Not found');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[+] New connection from ${ip}`);

    ws.on('message', async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            return;
        }

        // Phone registers its FCM token
        if (msg.type === 'register' && msg.fcmToken) {
            phoneTokens.add(msg.fcmToken);
            console.log(`[+] Phone registered (total: ${phoneTokens.size})`);
            return;
        }

        // Chrome extension sends clipboard text
        if (msg.type === 'clipboard' && msg.text) {
            // 1. Broadcast to all WebSocket-connected phones (instant)
            let wsDelivered = 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(raw.toString());
                    wsDelivered++;
                }
            });

            // 2. Push via FCM to all registered tokens (works on mobile data)
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
    console.log('CrossPaste relay v0.3.1');
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
    console.log(`Registered phones: ${phoneTokens.size}`);
    console.log('');
    console.log('Listening for connections...');
});
