const relayInput = document.getElementById('relayUrl');
const saveBtn = document.getElementById('save');
const statusDiv = document.getElementById('status');

function refresh() {
    chrome.runtime.sendMessage({ type: 'get-status' }, (resp) => {
        if (!resp) return;
        relayInput.value = resp.relayUrl || '';
        if (resp.connected) {
            statusDiv.className = 'status ok';
            statusDiv.textContent = '\u2713 Connected to ' + resp.relayUrl;
        } else {
            statusDiv.className = 'status err';
            statusDiv.textContent = '\u2717 Not connected';
        }
    });
}

saveBtn.addEventListener('click', () => {
    const url = relayInput.value.trim();
    if (!url) return;
    chrome.runtime.sendMessage({ type: 'set-relay', url }, () => refresh());
});

refresh();
setInterval(refresh, 1000);
