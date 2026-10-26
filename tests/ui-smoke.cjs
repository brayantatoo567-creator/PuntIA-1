const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '4173', OPENAI_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(baseURL + '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('PuntIA no arrancó en el puerto 4173. ' + serverOutput);
}

(async () => {
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);

    // Stub API responses to test the interface deterministically without using paid AI credits.
    await page.route('**/api/health', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, ai: false, model: 'test-model', vision: 'test-vision' })
    }));
    let chatIntercepted = false;
    await page.route('**/api/puntia/chat**', route => {
      chatIntercepted = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Respuesta de prueba del asistente.' }) });
    });
    await page.route('**/api/puntia/generate-pattern', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ pattern: 'Patrón de prueba: 6 pb en anillo mágico.' })
    }));
    await page.route('**/api/puntia/diagnose', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ analysis: 'Diagnóstico visual simulado para prueba.' })
    }));

    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.locator('#puntiaMascot').waitFor({ state: 'visible' });
    await page.locator('.reference-mascot').evaluate(img => img.decode());
    await page.waitForFunction(() => document.querySelector('.reference-mascot')?.src.startsWith('blob:'));
    if (!(await page.locator('.reference-mascot').evaluate(img => img.naturalWidth > 0))) {
      throw new Error('La ilustración original de la mascota no se decodificó.');
    }

    for (const category of ['ASISTENTE', 'PATRONES', 'APRENDIZAJE', 'MIS PROYECTOS', 'HERRAMIENTAS']) {
      if (!(await page.locator('#desktopNav').getByText(category, { exact: true }).count())) {
        throw new Error('Falta categoría de navegación: ' + category);
      }
    }

    // Chat: send a message and ensure the deterministic response appears.
    await page.locator('#chatInput').fill('¿Cómo hago un punto bajo?');
    await page.locator('#chatSend').click();
    try {
      await page.getByText('Respuesta de prueba del asistente.').waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      throw new Error('Prueba de chat falló. Interceptada=' + chatIntercepted + '; chatLog=' + await page.locator('#chatLog').innerText() + '; errores JS=' + errors.join(' | '));
    }

    // Pattern generation: verify form -> API -> result modal.
    await page.locator('#patternName').fill('Conejito de prueba');
    await page.locator('#generateBtn').click();
    await page.getByText(/Patrón de prueba: 6 pb en anillo mágico/).waitFor({ state: 'visible' });
    await page.locator('#modalClose').click();

    // Photo diagnosis: upload a tiny valid PNG and verify the mocked analysis is rendered.
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ3sAAAAASUVORK5CYII=', 'base64');
    await page.locator('#photoInput').setInputFiles({ name: 'crochet-test.png', mimeType: 'image/png', buffer: tinyPng });
    await page.getByText('Diagnóstico visual simulado para prueba.').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#modalClose').click();

    // Responsive desktop screenshot.
    fs.mkdirSync(path.join(process.cwd(), 'test-artifacts'), { recursive: true });
    await page.screenshot({ path: 'test-artifacts/puntia-desktop.png', fullPage: true });

    // Mobile: verify layout does not overflow horizontally and drawer keeps grouped nav.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.reference-mascot').evaluate(img => img.decode());
    await page.waitForFunction(() => document.querySelector('.reference-mascot')?.src.startsWith('blob:'));
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    if (dimensions.content > dimensions.viewport + 2) {
      throw new Error('Desbordamiento horizontal móvil: ' + JSON.stringify(dimensions));
    }
    await page.locator('#menuBtn').click();
    await page.locator('#drawer').waitFor({ state: 'visible' });
    for (const category of ['ASISTENTE', 'PATRONES', 'APRENDIZAJE', 'MIS PROYECTOS', 'HERRAMIENTAS']) {
      if (!(await page.locator('#drawerNav').getByText(category, { exact: true }).count())) {
        throw new Error('El menú móvil perdió la categoría: ' + category);
      }
    }
    await page.locator('#drawerNav').getByRole('button', { name: /Crear patrón/ }).click();
    await page.locator('#drawer').evaluate(el => {
      if (el.classList.contains('open')) throw new Error('El menú móvil no se cerró tras navegar.');
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-artifacts/puntia-mobile.png' });

    if (errors.length) throw new Error('Errores JavaScript en navegador: ' + errors.join(' | '));
    console.log('E2E PASS: mascota original, cinco categorías, chat, generación de patrón, menú móvil y desbordamiento horizontal.');
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
})();
