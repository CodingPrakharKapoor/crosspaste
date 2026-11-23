// CrossPaste background service worker
// Connects to the local relay over WebSocket and forwards selected text.

const DEFAULT_RELAY = 'ws://localhost:8080';
let ws = null;
let relayUrl = DEFAULT_RELAY;

// Load saved relay URL (user can change it from the popup)
chrome.storage.local.get(['relayUrl'], (result) => {
    if (result.relayUrl) relayUrl = result.relayUrl;
    connectRelay();
});

function connectRelay() {
    if (ws) {
        try { ws.close(); } catch (e) {}
        ws = null;
    }
    try {
        ws = new WebSocket(relayUrl);
        ws.onopen = () => console.log('CrossPaste: connected to', relayUrl);
        ws.onclose = () => {
            console.log('CrossPaste: disconnected, retrying in 3s');
            setTimeout(connectRelay, 3000);
        };
        ws.onerror = (err) => console.error('CrossPaste: WS error', err);
    } catch (e) {
        console.error('CrossPaste: failed to connect', e);
        setTimeout(connectRelay, 3000);
    }
}

// Right-click → "Send selection to phone"
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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectRelay();
        setTimeout(() => sendToPhone(text), 500);
        return;
    }
    const msg = JSON.stringify({ type: 'clipboard', text: text });
    ws.send(msg);
    console.log('CrossPaste: sent', text.length, 'chars');
}

// Popup messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'get-status') {
        sendResponse({ connected: ws && ws.readyState === WebSocket.OPEN, relayUrl });
        return true;
    }
    if (msg.type === 'set-relay' && msg.url) {
        relayUrl = msg.url;
        chrome.storage.local.set({ relayUrl });
        connectRelay();
        sendResponse({ ok: true });
        return true;
    }
});
