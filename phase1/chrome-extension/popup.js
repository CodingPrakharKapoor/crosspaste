// CrossPaste popup script - reads the textarea and sends to the service worker.

document.getElementById('send').addEventListener('click', () => {
  const text = document.getElementById('text').value.trim();
  if (!text) return;
  chrome.runtime.sendMessage({ type: 'send-text', text }, (resp) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (resp && resp.ok) {
      document.getElementById('text').value = '';
    }
  });
});
