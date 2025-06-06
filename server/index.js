import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Zalo, ThreadType } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

let api;
const messages = [];

async function init() {
  const credPath = path.join(__dirname, 'credentials.json');
  if (!fs.existsSync(credPath)) {
    console.error('Missing credentials.json in server folder');
    console.error('Create one based on credentials.example.json');
    process.exit(1);
  }
  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const zalo = new Zalo();
  api = await zalo.login(credentials);
  const { listener } = api;
  listener.on('message', msg => {
    messages.push(msg);
  });
  listener.start();
}

app.post('/send', async (req, res) => {
  if (!api) return res.status(503).json({ error: 'API not ready' });
  const { threadId, message, type } = req.body;
  if (!threadId || !message) {
    return res.status(400).json({ error: 'threadId and message required' });
  }
  try {
    const result = await api.sendMessage(message, threadId, type ?? ThreadType.User);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to send message' });
  }
});

// generic proxy to any available API method
app.post('/api/:method', async (req, res) => {
  if (!api) return res.status(503).json({ error: 'API not ready' });
  const { method } = req.params;
  const params = Array.isArray(req.body) ? req.body : [req.body];
  if (typeof api[method] !== 'function') {
    return res.status(404).json({ error: 'Unknown API method' });
  }
  try {
    const result = await api[method](...params);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'API call failed' });
  }
});

app.get('/messages', (req, res) => {
  res.json(messages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  init().catch(err => {
    console.error('Failed to initialize Zalo API', err);
    process.exit(1);
  });
});
