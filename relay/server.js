// CrossPaste relay - bridges Chrome extension ↔ phone via WebSocket + FCM push.
//
// Flow:
//   Chrome extension ──ws──> relay ──ws──> phone (instant LAN delivery)
//                            relay ──FCM──> phone (mobile data delivery)
//
// Phone registers its FCM token with the relay on WebSocket connect. The relay
// stores tokens in memory. When a clipboard message arrives from the Chrome
// extension, the relay:
//   1. Broadcasts it to all WebSocket-connected phones (instant on LAN)
//   2. Pushes it via FCM to all registered tokens (works on mobile data)

const WebSocket = require('ws');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;

// Load Firebase service account credentials
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('');
    console.error('ERROR: firebase-service-account.json not found in the relay folder.');
    console.error('');
    console.error('To fix:');
    console.error('  1. Open Firebase Console: https://console.firebase.google.com');
    console.error('  2. Pick your project → Project Settings (gear icon)');
    console.error('  3. Service Accounts tab → "Generate new private key"');
    console.error('  4. Save the file as: relay/firebase-service-account.json');
    console.error('');
    console.error('See docs/firebase-setup.md for the full walkthrough.');
    console.error('');
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const wss = new WebSocket.Server({ port: PORT });
const phoneTokens = new Set();

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

const localIP = getLocalIP();
console.log('');
console.log('CrossPaste relay v0.3.0');
console.log('========================');
console.log(`WebSocket URL:  ws://${localIP}:${PORT}`);
console.log(`(Chrome extension connects here; phone registers FCM token here)`);
console.log('');
console.log(`Registered phones: ${phoneTokens.size}`);
console.log('');

wss.on('connection', (ws) => {
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
            // 1. Broadcast to all WebSocket-connected phones (instant LAN)
            let lanDelivered = 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(raw.toString());
                    lanDelivered++;
                }
            });

            // 2. Push via FCM to all registered tokens (mobile data)
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

            console.log(`[>] Clipboard ${msg.text.length} chars | LAN:${lanDelivered} FCM-ok:${pushSent} FCM-fail:${pushFailed}`);
        }
    });
});

console.log('Listening for connections...');
