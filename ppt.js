const puppeteer = require('puppeteer');
const { env } = require('./env');

/*
|-----------------------------------------------------------------------
|
| PUPPET HELPERS
|
|-----------------------------------------------------------------------
| */

/**
 * @param {Boolean} debug
 * @return {{page:puppeteer.Page,browser:puppeteer.Browser}}
 */
module.exports.getBrowser = async debug => {
  /** @var {puppeteer.Page} page */
  let page;
  let browser;

  if (debug) {
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:21222',
      defaultViewport: null,
    });

    page = await browser.newPage();
  } else {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS ? process.env.HEADLESS == 'true' : true,
      defaultViewport: null,
      args: ['--start-maximized'],
      executablePath: env.chromePath,
    });

    page = await browser.newPage();
    await page.setDefaultTimeout(120 * 1000);
    await page.setViewport({
      width: 1366,
      height: 768,
    });
  }

  await fasterRequests(page);
  await page.setCacheEnabled(true);

  return { browser, page };
};

/** @param {puppeteer.Page} page */
async function fasterRequests(page) {
  const cache = {};
  const cacheExtension = ['.js', '.css'];

  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (
      ['png', 'image', 'x-icon', 'other', 'woff', 'font'].includes(
        request.resourceType(),
      ) ||
      [
        '/ga.js',
        '/analytics.js',
        'google-analytics.com',
        'pixel.mathtag.com',
        'sentry.io',
        'facebook.com',
        'facebook.net',
        'tvsquared.com',
        'linkedin.com',
        'nextdoor.com',
        'licdn.com',
        'googleadservices.com',
        'gstatic.com',
        'googleapis.com',
        'bootstrap.min.js?',
      ].some(r => request.url().includes(r))
    ) {
      request.abort();
    } else if (cache[url]) {
      request.respond(cache[url]);
      return;
    } else {
      request.continue();
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (!cache[url] && cacheExtension.some(ext => url.endsWith(ext))) {
      try {
        const buffer = await response.buffer();

        cache[url] = {
          status: response.status(),
          headers: response.headers(),
          body: buffer,
        };
      } catch (error) {
        // some responses do not contain buffer and do not need to be catched
        return;
      }
    }
  });
}

/** @param {puppeteer.Page} page */
module.exports.getIframe = async (page, frameSrc) => {
  const elementHandle = await page.$('[src="' + frameSrc + '"]');
  const frame = await elementHandle.contentFrame();
  return frame;
};

/** @param {puppeteer.Page} page */
module.exports.screenshot = async (page, filename = 'example.png') => {
  await page.screenshot({ path: filename });
};

/** @param {puppeteer.Page} page */
module.exports.setValue = async (page, selector_name, value_name) => {
  await page.waitForSelector(selector_name);

  const params = { selector_name, value_name };

  await page.evaluate(p => {
    document.querySelector(p.selector_name).value = p.value_name;
  }, params);
};

/** @param {puppeteer.Page} page */
module.exports.type = async (page, selector_name, value_name) => {
  await page.waitForSelector(selector_name);

  await page.focus(selector_name);
  await click(page, selector_name);
  await page.keyboard.type(value_name, { delay: 1 });
  // await page.type(selector_name, value_name, { delay: 1 });
};

/** @param {puppeteer.Page} page */
module.exports.getText = async (
  page,
  parentEl,
  selector,
  attr = 'innerText',
) => {
  await page.waitForSelector(selector);

  let element = await parentEl.$(selector);
  const text = await page.evaluate(
    (element, attr) => element[attr],
    element,
    attr,
  );
  return text.trim();
};

module.exports.click = async (page, selector_name) => {
  await page.waitForSelector(selector_name);
  await page.click(selector_name);
};

/** @param {puppeteer.Page} page */
module.exports.goto = async (page, url) => {
  await page.goto(url, {
    waitUntil: 'networkidle0',
  });
};
