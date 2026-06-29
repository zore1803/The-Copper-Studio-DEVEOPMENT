/**
 * HTML -> PDF using a headless browser.
 *
 * In production (e.g. Render's free Node runtime) the full `puppeteer` package's
 * bundled Chromium frequently fails to launch — the base image is missing shared
 * libraries Chromium needs (libnss3, libatk-bridge, etc.) and the download itself
 * is skipped via PUPPETEER_SKIP_DOWNLOAD to keep builds fast. So production uses
 * `puppeteer-core` + `@sparticuz/chromium`, a statically-linked Chromium build made
 * for exactly this kind of constrained environment. Local dev keeps using plain
 * `puppeteer`, which downloads its own Chromium and works without extra setup.
 *
 * The browser instance is reused across requests. If Chromium is unavailable,
 * htmlToPdfBuffer throws a PdfUnavailableError so callers can fall back to serving
 * the HTML invoice instead.
 */

export class PdfUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfUnavailableError";
    this.code = "PDF_UNAVAILABLE";
  }
}

let browserPromise = null;

async function launchProductionBrowser() {
  let puppeteer;
  let chromium;
  try {
    ({ default: puppeteer } = await import("puppeteer-core"));
    ({ default: chromium } = await import("@sparticuz/chromium"));
  } catch {
    throw new PdfUnavailableError("puppeteer-core / @sparticuz/chromium are not installed. Run `npm install` to enable PDF generation.");
  }
  return puppeteer.launch({
    // chromium.headless defaults to "shell" (chrome-headless-shell) — a stripped-down
    // binary built for fast text-only rendering that does NOT reliably rasterize full
    // CSS/backgrounds, producing blank PDFs from page.pdf(). Force the full "new"
    // headless mode, which the same statically-linked binary also supports.
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath()
  });
}

async function launchDevBrowser() {
  let puppeteer;
  try {
    ({ default: puppeteer } = await import("puppeteer"));
  } catch {
    throw new PdfUnavailableError("puppeteer is not installed. Run `npm install` to enable PDF generation.");
  }
  return puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

function withLaunchTimeout(promise, ms = 25000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Browser launch timed out after ${ms}ms`)), ms))
  ]);
}

async function getBrowser() {
  if (browserPromise) return browserPromise;

  browserPromise = withLaunchTimeout(
    process.env.NODE_ENV === "production" ? launchProductionBrowser() : launchDevBrowser()
  );

  try {
    const browser = await browserPromise;
    browser.on("disconnected", () => {
      browserPromise = null;
    });
    return browser;
  } catch (error) {
    browserPromise = null;
    if (error instanceof PdfUnavailableError) throw error;
    throw new PdfUnavailableError(`Unable to launch headless browser: ${error.message}`);
  }
}

export async function htmlToPdfBuffer(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // "load" (not "networkidle0") so a slow/blocked external font request can't
    // stall content loading and force a fallback; cap it so it never hangs.
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" }
    });
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    /* ignore */
  } finally {
    browserPromise = null;
  }
}

export default { htmlToPdfBuffer, closeBrowser, PdfUnavailableError };
