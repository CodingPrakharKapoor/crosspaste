// CrossPaste Phase 1 mock relay.
// Receives text from the Chrome extension via POST /send,
// and pushes it to all connected phone apps over WebSocket.

import express from 'express';
import { WebSocketServer } from 'ws';
import os from 'os';

const PORT = 8080;
const app = express();
app.use(express.json({ limit: '5mb' }));

let lastText = '';
let lastTs = 0;

// Compute LAN URLs so the user knows what IP to enter in the phone app.
function lanUrls() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) {
        out.push(`ws://${i.address}:${PORT}`);
      }
    }
  }
  return out;
}

const wss = new WebSocketServer({ noServer: true });

app.get('/', (req, res) => {
  res.type('text/html').send(`<!doctype html><html><body style="font-family:sans-serif;padding:20px;line-height:1.5">
    <h2>CrossPaste relay</h2>
    <p>Status: <b>${wss.clients.size > 0 ? 'phone connected' : 'no phone connected yet'}</b></p>
    <p>WebSocket clients: <b>${wss.clients.size}</b></p>
    <p>Last item: <code>${escapeHtml(lastText.slice(0, 80))}</code></p>
    <p>Phone app should connect to one of these URLs:</p>
    <ul>${lanUrls().map(u => `<li><code>${u}</code></li>`).join('')}</ul>
    <p style="color:#666;font-size:12px">Started at ${new Date().toLocaleString()}</p>
  </body></html>`);
});

app.post('/send', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'field "text" (string) required' });
  }
  lastText = text;
  lastTs = Date.now();
  const payload = JSON.stringify({ type: 'clipboard', text, ts: lastTs });

  let delivered = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
      delivered++;
    }
  }
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
  console.log(`[${new Date().toISOString()}] relayed ${text.length} chars to ${delivered} phone(s): "${preview}"`);
  res.json({ ok: true, delivered });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('CrossPaste relay listening on http://0.0.0.0:' + PORT);
  console.log('Open that URL in a browser to see status.');
  console.log('');
  console.log('Phone app should connect to one of:');
  for (const u of lanUrls()) console.log('  ' + u);
  console.log('');
  console.log('Waiting for the Chrome extension to send something...');
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  console.log(`[+] phone connected (total: ${wss.clients.size})`);
  ws.send(JSON.stringify({ type: 'hello', msg: 'Connected to CrossPaste relay' }));
  ws.on('close', () => console.log(`[-] phone disconnected (total: ${wss.clients.size})`));
  ws.on('error', (e) => console.error('phone ws error:', e.message));
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close();
  process.exit(0);
});
