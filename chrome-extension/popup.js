// CrossPaste popup - Phase 2B.2
//
// Adds:
//   - Free-text textarea + "Send text" button (send anything, not just
//     webpage selections)
//   - "Stop connection" / "Start connection" toggle (fully disconnects)
//   - "Show QR code" button (renders the relay URL as a scannable QR)
//   - Status line that reflects the new shouldConnect / isConnecting /
//     backoff states coming from background.js

const relayInput = document.getElementById('relayUrl');
const saveBtn = document.getElementById('save');
const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggleConn');
const freeText = document.getElementById('freeText');
const sendTextBtn = document.getElementById('sendText');
const qrBtn = document.getElementById('qrBtn');
const qrWrap = document.getElementById('qrWrap');
const qrImg = document.getElementById('qrImg');

function refresh() {
    chrome.runtime.sendMessage({ type: 'get-status' }, (resp) => {
        if (!resp) return;
        // Don't clobber the field while the user is typing in it.
        if (document.activeElement !== relayInput) {
            relayInput.value = resp.relayUrl || '';
        }
        updateStatus(resp);
        updateToggleButton(resp.shouldConnect);
    });
}

function updateStatus(resp) {
    if (!resp.shouldConnect) {
        statusDiv.className = 'status warn';
        statusDiv.textContent = 'Disconnected — connection stopped by you. Click "Start connection" to resume.';
    } else if (resp.connected) {
        statusDiv.className = 'status ok';
        statusDiv.textContent = '✓ Connected to ' + resp.relayUrl;
    } else if (resp.isConnecting) {
        statusDiv.className = 'status warn';
        statusDiv.textContent = 'Connecting to ' + resp.relayUrl + '...';
    } else {
        statusDiv.className = 'status err';
        const secs = Math.max(1, Math.round(resp.backoffMs / 1000));
        statusDiv.textContent = '✗ Not connected — retrying in ' + secs + 's';
    }
}

function updateToggleButton(shouldConnect) {
    if (shouldConnect) {
        toggleBtn.textContent = 'Stop connection';
        toggleBtn.className = 'danger';
    } else {
        toggleBtn.textContent = 'Start connection';
        toggleBtn.className = 'success';
    }
}

saveBtn.addEventListener('click', () => {
    const url = relayInput.value.trim();
    if (!url) return;
    chrome.runtime.sendMessage({ type: 'set-relay', url }, () => refresh());
});

toggleBtn.addEventListener('click', () => {
    // Toggle based on the current shouldConnect state. We re-query rather
    // than trusting the button label so a stale UI can't get out of sync.
    chrome.runtime.sendMessage({ type: 'get-status' }, (resp) => {
        const next = resp && resp.shouldConnect ? 'stop-connection' : 'start-connection';
        chrome.runtime.sendMessage({ type: next }, () => refresh());
    });
});

sendTextBtn.addEventListener('click', () => {
    const text = freeText.value;
    if (!text) return;
    chrome.runtime.sendMessage({ type: 'send-text', text }, (resp) => {
        if (resp && resp.ok) {
            freeText.value = '';
            statusDiv.className = 'status ok';
            statusDiv.textContent = '✓ Sent ' + text.length + ' chars';
            setTimeout(refresh, 1500);
        } else {
            statusDiv.className = 'status err';
            statusDiv.textContent = '✗ Not connected — cannot send. Click "Start connection" first.';
            setTimeout(refresh, 2000);
        }
    });
});

qrBtn.addEventListener('click', () => {
    const url = relayInput.value.trim();
    if (!url) return;
    // Render the URL as a QR via api.qrserver.com (free, no key, no CC). The
    // URL itself is just the relay address - not sensitive. Loaded as a
    // plain <img> so no extra host_permissions are needed. Requires
    // internet, which the extension already needs to reach the relay.
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(url);
    qrWrap.style.display = qrWrap.style.display === 'block' ? 'none' : 'block';
});

// Ctrl+Enter (or Cmd+Enter on Mac) sends the textarea contents.
freeText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendTextBtn.click();
    }
});

refresh();
setInterval(refresh, 1000);
