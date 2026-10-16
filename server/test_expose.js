import puppeteer from 'puppeteer';

async function testExpose() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const wa = pages.find(p => p.url().includes('web.whatsapp.com'));

  try {
    await wa.exposeFunction('bridgeTestPing', (msg) => {
      console.log('Ping from page:', msg);
      return 'pong';
    });
    console.log('✅ exposeFunction succeeded!');
  } catch (e) {
    console.log('exposeFunction note:', e.message);
  }

  const res = await wa.evaluate(async () => {
    if (window.bridgeTestPing) {
      return await window.bridgeTestPing('hello from WhatsApp tab');
    }
    return 'not defined';
  });
  console.log('Result from page:', res);

  browser.disconnect();
}

testExpose().catch(console.error);
