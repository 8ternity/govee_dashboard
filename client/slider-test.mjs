import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://localhost:3001/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  ignoreHTTPSErrors: true,
});

const page = await browser.newPage();
const apiCalls = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/api/') && req.method() === 'POST') {
    apiCalls.push(`${req.method()} ${u.replace('https://localhost:3001', '')} :: ${req.postData()}`);
  }
});
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 3000));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const btn = btns.find((b) => b.textContent.includes('Sunrise'));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 3000));

const sliders = await page.$$('[data-slot="slider"]');
if (sliders.length > 0) {
  const box = await sliders[0].boundingBox();
  if (box) {
    const x0 = box.x + 5;
    const y = box.y + box.height / 2;
    const x1 = box.x + box.width - 5;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let x = x0; x <= x1; x += 15) {
      await page.mouse.move(x, y);
      await new Promise((r) => setTimeout(r, 20));
    }
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.log('--- POST /api calls (bodies) ---');
console.log(apiCalls.join('\n') || '(none)');

await browser.close();
