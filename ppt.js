const puppeteer = require('puppeteer');

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
async function getBrowser(debug) {
  if (debug) {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:21222',
      defaultViewport: null,
    });

    const page = await browser.newPage();

    return { browser, page };
  } else {
    browser = await puppeteer.launch({
      // headless: false,
      defaultViewport: null,
      args: ['--start-maximized'],
    });

    const page = await browser.newPage();
    await page.setDefaultTimeout(120 * 1000);
    await page.setViewport({
      width: 1366,
      height: 768,
    });

    return { browser, page };
  }
}
exports.getBrowser = getBrowser;
