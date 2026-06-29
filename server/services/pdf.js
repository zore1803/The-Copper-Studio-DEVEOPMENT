/**
 * HTML -> PDF using a headless browser (puppeteer).
 *
 * puppeteer is loaded lazily and the browser instance is reused across requests.
 * If puppeteer / Chromium is unavailable, htmlToPdfBuffer throws a PdfUnavailable
 * error so callers can fall back to serving the HTML invoice instead.
 */

export class PdfUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfUnavailableError";
    this.code = "PDF_UNAVAILABLE";
  }
}

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    let puppeteer;
    try {
      ({ default: puppeteer } = await import("puppeteer"));
    } catch {
      throw new PdfUnavailableError("puppeteer is not installed. Run `npm install` to enable PDF generation.");
    }
    
    const launchPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Puppeteer browser launch timed out after 10s")), 10000)
    );

    return Promise.race([launchPromise, timeoutPromise]);
  })();

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
    await page.setContent(html, { waitUntil: "networkidle0" });
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
