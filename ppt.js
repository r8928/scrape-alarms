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
module.exports.getBrowser = async debug => {
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
};

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
