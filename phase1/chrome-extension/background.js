// CrossPaste Phase 1 - extension service worker
// Captures selected text and POSTs it to the local relay.

const RELAY_URL = 'http://localhost:8080/send';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-phone',
    title: 'Send selection to phone',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'send-to-phone' && info.selectionText) {
    await sendToPhone(info.selectionText);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'send-text' && typeof msg.text === 'string') {
    sendToPhone(msg.text).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true; // keep the message channel open for async response
  }
});

async function sendToPhone(text) {
  try {
    const res = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      throw new Error('relay responded ' + res.status);
    }
    const data = await res.json();
    flashBadge(data.delivered > 0 ? 'OK' : 'NOP');
  } catch (e) {
    console.error('CrossPaste send failed:', e);
    flashBadge('ERR');
  }
}

function flashBadge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: text === 'ERR' ? '#dc2626' : '#16a34a' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}
