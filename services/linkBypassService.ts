import puppeteer, { Browser } from 'puppeteer';

interface Metadata {
  title?: string;
  description?: string;
}

interface BypassResult {
  finalUrl: string;
  metadata?: Metadata;
  warnings?: string[];
}

async function detectCaptcha(page: puppeteer.Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="captcha"]',
    'input[name="captcha"]',
    '#recaptcha',
    '.g-recaptcha',
    '[aria-label*="captcha"]',
    'div[class*="captcha"]',
  ];
  for (const selector of captchaSelectors) {
    const el = await page.$(selector);
    if (el) return true;
  }
  return false;
}

async function heuristicExtractFinalUrl(page: puppeteer.Page): Promise<string | null> {
  const anchors = await page.$$eval('a[href]', (els) => els.map((a) => a.href));

  // Filter out common ad domains; adjust as per needs
  for (const href of anchors) {
    if (href && /^https?:\/\//.test(href)) {
      if (!href.match(/(linkvertise|adf\.ly|bit\.ly|shorte\.st|ads)/i)) {
        return href;
      }
    }
  }

  const content = await page.content();
  const urlRegex = /(https?:\/\/[^\s"']{5,})/g;
  const matches = Array.from(content.matchAll(urlRegex)).map((m) => m[1]);

  for (const candidate of matches) {
    if (!candidate.match(/(linkvertise|adf\.ly|bit\.ly|shorte\.st|ads)/i)) {
      return candidate;
    }
  }

  return null;
}

export async function bypassAdLink(adUrl: string): Promise<BypassResult> {
  let browser: Browser | null = null;
  const warnings: string[] = [];
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );

    await page.setDefaultNavigationTimeout(30000);

    page.on('response', (resp) => {
      const status = resp.status();
      if (status === 429) warnings.push('Rate limit detected from target site.');
      if (status >= 400 && status < 500 && status !== 404) warnings.push(`Client error: HTTP ${status}`);
    });

    await page.goto(adUrl, { waitUntil: 'networkidle2' });

    if (await detectCaptcha(page)) throw new Error('CAPTCHA_DETECTED');

    let finalUrl = page.url();

    if (
      finalUrl === adUrl ||
      /linkvertise|adf\.ly|bit\.ly|shorte\.st|ads/i.test(finalUrl)
    ) {
      const heuristicUrl = await heuristicExtractFinalUrl(page);
      if (heuristicUrl) {
        finalUrl = heuristicUrl;
      } else {
        warnings.push('Could not heuristically extract final URL, returning current URL.');
      }
    }

    const metadata = await page.evaluate(() => {
      return {
        title: document.title || undefined,
        description:
          document.querySelector('meta[name="description"]')?.getAttribute('content') || undefined,
      };
    });

    return { finalUrl, metadata, warnings };
  } finally {
    if (browser) await browser.close();
  }
}
