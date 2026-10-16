import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const OUTBOUND_PORT = 5058;

// Clean and normalize phone numbers (e.g. "+91 98765-43210" -> "919876543210")
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d]/g, '');
  // If 10 digits without country code (e.g. Indian mobile starting with 6,7,8,9), default to +91
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Connect to the active Chrome session
async function getChromeWhatsAppPage() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });
    const pages = await browser.pages();
    let waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!waPage) {
      console.log('WhatsApp tab not found in active browser. Creating tab...');
      waPage = await browser.newPage();
      await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    }
    return { browser, page: waPage };
  } catch (err) {
    console.error('❌ Could not connect to Chrome on port 9222:', err.message);
    throw new Error('Chrome is not reachable on port 9222. Ensure Chrome is running with --remote-debugging-port=9222.');
  }
}

// Send a single message to a phone number via WhatsApp Web
async function sendWhatsAppMessage(phone, message) {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    throw new Error(`Invalid phone number provided: "${phone}"`);
  }
  if (!message || !message.trim()) {
    throw new Error('Message content cannot be blank.');
  }

  console.log(`\n📤 [Outbound Dispatch] Preparing message to: +${cleanPhone}`);
  const { browser, page } = await getChromeWhatsAppPage();

  const targetUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message.trim())}`;
  console.log(`🌐 Navigating WhatsApp tab to target recipient...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for the message input box or send button to appear
  console.log('⏳ Waiting for WhatsApp message input box...');
  const inputSelector = 'div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="Type a message"], div[contenteditable="true"][role="textbox"]';
  
  try {
    await page.waitForSelector(inputSelector, { timeout: 25000 });
  } catch (err) {
    // Check if WhatsApp showed an invalid phone number alert
    const isInvalidNumber = await page.evaluate(() => {
      const body = document.body.innerText || '';
      return body.includes('Phone number shared via url is invalid') || body.includes('invalid phone number') || body.includes('url is invalid');
    });
    if (isInvalidNumber) {
      throw new Error(`Phone number +${cleanPhone} is not registered on WhatsApp or is invalid.`);
    }
    throw new Error(`Timed out waiting for WhatsApp message input box: ${err.message}`);
  }

  // Brief human-like pause
  await new Promise(r => setTimeout(r, 1200));

  // Focus and trigger send
  console.log('🚀 Triggering send...');
  let sent = false;

  // Try finding the send button
  try {
    const sendBtn = await page.$('span[data-icon="send"], button[aria-label="Send"], span[data-icon="round-send"]');
    if (sendBtn) {
      await sendBtn.click();
      sent = true;
    }
  } catch (e) {}

  // If send button click didn't fire, simulate pressing Enter in the textbox
  if (!sent) {
    await page.focus(inputSelector);
    await page.keyboard.press('Enter');
    sent = true;
  }

  // Wait for transmission
  await new Promise(r => setTimeout(r, 2000));
  console.log(`✅ [Delivered] Message successfully sent to +${cleanPhone}!`);
  return { success: true, phone: cleanPhone, timestamp: new Date().toISOString() };
}

// Start HTTP bridge server on port 5058 for web frontend integration
function startOutboundHttpServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for frontend Vite & local dashboard
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://localhost:${OUTBOUND_PORT}`);
    const pathname = parsedUrl.pathname;

    // Health check
    if (req.method === 'GET' && pathname === '/health') {
      try {
        const { page } = await getChromeWhatsAppPage();
        const url = page.url();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', chromeConnected: true, activeUrl: url }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'warning', chromeConnected: false, error: err.message }));
      }
    }

    // Send single message
    if (req.method === 'POST' && pathname === '/api/outbound/send') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { phone, message } = payload;
          if (!phone || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing phone or message parameter' }));
          }

          const result = await sendWhatsAppMessage(phone, message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Send batch of messages with rate limiting
    if (req.method === 'POST' && pathname === '/api/outbound/batch') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const items = payload.items || [];
          const delayMs = payload.delayMs || 6000;

          if (!Array.isArray(items) || items.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Payload must include an items array' }));
          }

          console.log(`\n📢 [Batch Campaign Started] Processing ${items.length} contacts with ${delayMs}ms safe spacing...`);
          const results = [];

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`\n[${i + 1}/${items.length}] Contact: ${item.name || 'Customer'} (${item.phone})`);
            try {
              const res = await sendWhatsAppMessage(item.phone, item.message);
              results.push({ id: item.id || i, phone: item.phone, name: item.name, status: 'Sent', timestamp: res.timestamp });
            } catch (err) {
              console.error(`❌ Failed to send to ${item.phone}:`, err.message);
              results.push({ id: item.id || i, phone: item.phone, name: item.name, status: 'Failed', error: err.message });
            }

            if (i < items.length - 1) {
              console.log(`⏳ Waiting safe anti-spam pause of ${delayMs / 1000}s before next contact...`);
              await new Promise(r => setTimeout(r, delayMs));
            }
          }

          console.log(`\n🎉 [Batch Campaign Complete] Sent: ${results.filter(r => r.status === 'Sent').length} / ${items.length}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, total: items.length, results }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  server.listen(OUTBOUND_PORT, '127.0.0.1', () => {
    console.log(`\n================================================================`);
    console.log(` 🚀 Inspirus Voice AI — WhatsApp Outbound Campaign Gateway`);
    console.log(` Server listening on: http://127.0.0.1:${OUTBOUND_PORT}`);
    console.log(` Connects via Chrome session on port 9222`);
    console.log(` Endpoints:`);
    console.log(`   • GET  /health              - Check Chrome connection status`);
    console.log(`   • POST /api/outbound/send   - Send single message`);
    console.log(`   • POST /api/outbound/batch  - Send batch with anti-spam rate limiting`);
    console.log(`================================================================\n`);
  });

  return server;
}

// Parse CSV string into array of objects
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV line splitter respecting quotes
    const values = [];
    let inQuotes = false;
    let curr = '';
    const line = lines[i];

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' && (c === 0 || line[c - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(curr.trim().replace(/^"|"$/g, ''));
        curr = '';
      } else {
        curr += char;
      }
    }
    values.push(curr.trim().replace(/^"|"$/g, ''));

    if (values.length >= headers.length) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      rows.push(obj);
    }
  }

  return rows;
}

// If invoked from CLI directly: node server/whatsapp_outbound.js [optional_csv]
const cliArg = process.argv[2];

if (cliArg && fs.existsSync(cliArg)) {
  console.log(`📁 Loading CSV file from CLI argument: ${cliArg}`);
  const content = fs.readFileSync(cliArg, 'utf8');
  const rows = parseCsv(content);
  console.log(`Loaded ${rows.length} rows from CSV.`);

  startOutboundHttpServer();

  (async () => {
    console.log('\nReady to dispatch. Send requests via HTTP or integrate with Inspirus Studio.');
  })();
} else {
  // Start daemon server
  startOutboundHttpServer();
}
