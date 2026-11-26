// CrossPaste background service worker (MV3) - Phase 2B.2
//
// What changed:
//   1. chrome.alarms every 30 sec keeps the service worker alive. MV3
//      evicts idle workers after 30 sec, and a held-open WebSocket does
//      NOT count as activity - so without this alarm, Chrome kills the
//      worker, the socket dies, the popup wakes the worker on next use,
//      a new socket opens, dies again -> the "reconnect storm" you saw.
//
//   2. shouldConnect + isConnecting flags. shouldConnect lets the user
//      fully stop the connection from the popup. isConnecting prevents
//      concurrent connectRelay calls (which previously created two
//      sockets, each failing, each scheduling two more).
//
//   3. Exponential backoff: 2s -> 4s -> 8s -> 16s -> 30s (capped), reset on
//      successful open. The relay's per-IP rate limiter is the backstop.
//
//   4. New popup messages:
//        send-text        - send arbitrary text typed in the popup
//        stop-connection  - fully disconnect (user asked for this)
//        start-connection - reconnect after a stop-connection

const DEFAULT_RELAY = 'ws://localhost:8080';
const ALARM_NAME = 'crosspaste-keepalive';
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

let ws = null;
let relayUrl = DEFAULT_RELAY;
let shouldConnect = true;
let isConnecting = false;
let backoffMs = INITIAL_BACKOFF_MS;
let reconnectTimer = null;

// Load saved relay URL + shouldConnect preference, then set up the
// keepalive alarm and (if appropriate) open the WebSocket.
chrome.storage.local.get(['relayUrl', 'shouldConnect'], (result) => {
    if (result.relayUrl) relayUrl = result.relayUrl;
    if (typeof result.shouldConnect === 'boolean') shouldConnect = result.shouldConnect;
    // 0.5 minutes = 30 sec. This is the minimum periodInMinutes in MV3.
    // Each alarm fires onAlarm, which pokes the worker back to life.
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    if (shouldConnect) connectRelay();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    // Worker just woke up. If we should be connected but aren't (and
    // aren't already trying), kick off a connect. Otherwise no-op.
    if (shouldConnect && !wsConnected() && !isConnecting) {
        console.log('CrossPaste: keepalive check - reconnecting');
        connectRelay();
    }
});

function wsConnected() {
    return !!(ws && ws.readyState === WebSocket.OPEN);
}

function connectRelay() {
    if (!shouldConnect) {
        console.log('CrossPaste: skip connect - shouldConnect=false');
        return;
    }
    if (isConnecting) {
        console.log('CrossPaste: skip connect - already connecting');
        return;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    // Tear down any stale socket. Null its handlers first so its
    // onclose doesn't fire scheduleReconnect against the new state.
    if (ws) {
        try { ws.onclose = null; ws.onerror = null; ws.onopen = null; ws.onmessage = null; ws.close(); } catch (e) {}
        ws = null;
    }
    isConnecting = true;
    try {
        ws = new WebSocket(relayUrl);
        ws.onopen = () => {
            isConnecting = false;
            backoffMs = INITIAL_BACKOFF_MS;
            console.log('CrossPaste: connected to', relayUrl);
        };
        ws.onclose = () => {
            isConnecting = false;
            if (!shouldConnect) {
                console.log('CrossPaste: closed (intentional)');
                return;
            }
            console.log(`CrossPaste: disconnected, retrying in ${backoffMs / 1000}s`);
            scheduleReconnect();
        };
        ws.onerror = (err) => {
            // onclose will fire next and schedule the reconnect.
            console.error('CrossPaste: WS error', err);
        };
    } catch (e) {
        isConnecting = false;
        console.error('CrossPaste: failed to connect', e);
        if (shouldConnect) scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (!shouldConnect) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectRelay();
    }, backoffMs);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

// Right-click -> "Send selection to phone"
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'send-selection',
        title: 'Send selection to phone',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'send-selection' && info.selectionText) {
        sendToPhone(info.selectionText);
    }
});

function sendToPhone(text) {
    if (!wsConnected()) {
        if (shouldConnect) connectRelay();
        // Give the connect a half-second head start; if it doesn't land,
        // the user will see "not connected" in the popup status.
        setTimeout(() => {
            if (wsConnected()) doSend(text);
            else console.log('CrossPaste: send skipped - not connected');
        }, 500);
        return;
    }
    doSend(text);
}

function doSend(text) {
    const msg = JSON.stringify({ type: 'clipboard', text: text });
    ws.send(msg);
    console.log('CrossPaste: sent', text.length, 'chars');
}

// Popup -> background messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'get-status') {
        sendResponse({
            connected: wsConnected(),
            isConnecting,
            shouldConnect,
            relayUrl,
            backoffMs
        });
        return true;
    }
    if (msg.type === 'set-relay' && msg.url) {
        relayUrl = msg.url;
        chrome.storage.local.set({ relayUrl });
        if (shouldConnect) connectRelay();
        sendResponse({ ok: true });
        return true;
    }
    if (msg.type === 'send-text' && typeof msg.text === 'string') {
        sendToPhone(msg.text);
        sendResponse({ ok: wsConnected() });
        return true;
    }
    if (msg.type === 'stop-connection') {
        shouldConnect = false;
        chrome.storage.local.set({ shouldConnect: false });
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (ws) {
            try { ws.onclose = null; ws.onerror = null; ws.onopen = null; ws.onmessage = null; ws.close(); } catch (e) {}
            ws = null;
        }
        isConnecting = false;
        sendResponse({ ok: true });
        return true;
    }
    if (msg.type === 'start-connection') {
        shouldConnect = true;
        chrome.storage.local.set({ shouldConnect: true });
        backoffMs = INITIAL_BACKOFF_MS;
        connectRelay();
        sendResponse({ ok: true });
        return true;
    }
});
