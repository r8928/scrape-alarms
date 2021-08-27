const _ = require('lodash');
const { env } = require('./env');
const { appendJson } = require('./jsonfile');
const { stepMessage, substepMessage, errorMsg, errorDie } = require('./msgs');
const { getBrowser } = require('./ppt');

const selectors = {
  username: '[id="ctl00_ContentPlaceHolder1_loginform_txtUserName"]',
  password: '[name="txtPassword"]',
  loginSubmit: '[name="ctl00$ContentPlaceHolder1$loginform$signInButton"]',
  twoFactorConfirm: '.two-factor-intro',
  twoFactorSkip: '.action-buttons button[aria-live="polite"]',
  sap_dropdown: '.system-select .dropdown-toggle',
  dropdown_saps_list: '.popper-container .content ul li a',
};

const navigationIds = {
  Settings: 1169,
  Settings_Monitoring: 22,
  Users: 'users',
};

async function run() {
  if (![2, 3].includes(process.argv.length)) {
    return errorDie('INVALID NUMBER OF ARGUMENTS');
  }
  const debug = false;

  const { page } = await getBrowser(debug);

  if (debug) {
    await openAlarm(page);
  } else {
    await loginAlram(page);
  }

  if (process.argv.length === 2) {
    await doAllSaps(page);
    // await doStore({page, sap_index: 10});
    // await doStore({page, sap_index: 28});
    // await doStore({page, sap_index: 20});
  } else if (process.argv.length === 3) {
    await doStore({ page, sap_name: process.argv.pop(2) });
  }

  await page.close();
  // await browser.close();
  return process.exit();
}

/** @param {puppeteer.Page} page */
async function doAllSaps(page) {
  const sap_count = await getAllSaps(page);

  for (let sap_index = 0; sap_index < sap_count; sap_index++) {
    await doStore({ page, sap_index });
  }
}

async function doStore({ page, sap_index, sap_name }) {
  await selectSap({ page, sap_index, sap_name });
  await getUsers(page);
  await getNotifications(page);
  await getSettings(page);
}

/*
|-----------------------------------------------------------------------
|
| SETTINGS MODULE
|
|-----------------------------------------------------------------------
| */

/** @param {puppeteer.Page} page */
async function getSettings(page) {
  await openNavigationLink(page, navigationIds.Settings);

  try {
    await openNavigationLink(page, navigationIds.Settings_Monitoring, 5000);
  } catch (error) {
    errorMsg('MONITORING NOT FOUND - PROTECTION 1?');
    return;
  }

  const frame = await getIframe(
    page,
    '/web/Profile/MonitoringStation/MonitoringStation.aspx',
  );

  let ContactRows = await getContactRows();

  const Contacts = [];
  if (ContactRows && ContactRows.length) {
    for (const row of ContactRows) {
      const data = {
        FirstName: await getText(frame, row, '#txtFirstName', 'value'),
        LastName: await getText(frame, row, '#txtLastName', 'value'),
        PinCode: await getText(frame, row, '#txtPinCode', 'value'),
        Contact: await getText(frame, row, '.phone-number'),
        Order: await getText(frame, row, '[name="ddlOrder"]', 'value'),
      };
      Contacts.push(data);
      console.log('getSettings -> FirstName', data.FirstName);
    }
  }

  appendJson('Monitoring', Contacts);
  stepMessage('SETTINGS MODULE DONE');

  async function getContactRows() {
    try {
      await frame.waitForSelector(
        '.emergency-contact-rows>.emergency-contact-row',
        { timeout: 10000 },
      );
      let ContactRows = await frame.$$(
        '.emergency-contact-rows>.emergency-contact-row',
      );
      substepMessage('getContactRows -> ContactRows ' + ContactRows.length);
      return ContactRows;
    } catch (error) {
      errorMsg('No users found in Settings->Monitoring --- Brinks???');
      return null;
    }
  }
}

/*
|-----------------------------------------------------------------------
|
| USERS MODULE
|
|-----------------------------------------------------------------------
| */

/** @param {puppeteer.Page} page */
async function getUsers(page) {
  await openNavigationLink(page, navigationIds.Users);

  let users = await getUserRows();

  for (let index = 0; index < users.length; index++) {
    let users = await getUserRows();
    substepMessage('getUsers ' + (index + 1) + '/' + users.length);

    await selectPage(users, index);

    if (await userDetailsExists()) {
      await saveThisPage(index);
    }

    await page.goBack();
  }
  stepMessage('USERS MODULE DONE');

  async function userDetailsExists() {
    return (await page.$('.user-information .display-name')) !== null;
  }

  async function selectPage(users, r) {
    users[r].click();
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.user-information');
  }

  async function saveThisPage(index) {
    const { UserName, UserPinBadge } = await getUserInfo();

    if (UserName) {
      let Contacts = [];

      let contactRows = await countContactRows();
      if (contactRows.length) {
        await page.waitForSelector('.sub-description');

        Contacts = await page.evaluate(() => {
          const ad = [];
          document.querySelectorAll('.sub-description').forEach(element => {
            ad.push(element.textContent.trim());
          });

          return ad;
        });
        console.log('saveThisPage -> address', Contacts);

        // for (let index = 0; index < contactRows.length; index++) {
        //   const element = contactRows[index];

        //   await page.waitForSelector(
        //     '.sub-description:nth-child(' + (index + 1) + ')',
        //   );
        //   console.log('saveThisPage -> nth-child', index);

        //   const address = await getText(page, element, '.sub-description');
        //   if (!address) throw 'NO ADDRESS';

        //   Contacts.push(address);
        // }

        // for (const r of contactRows) {
        //   await page.waitForSelector('.sub-description');
        //   // const address = await page.evaluate(
        //   //   element =>
        //   //     element.querySelector('.sub-description').textContent.trim(),
        //   //   r,
        //   // );
        //   const address = await getText(page, r, '.sub-description');
        //   console.log('saveThisPage -> address', address);

        //   if (!address) throw 'NO ADDRESS';

        //   Contacts.push(address);
        // }
      }

      const json = { UserName, Contacts, Pin: UserPinBadge };
      appendJson('Users.' + index, json);
    }
  }

  async function countContactRows() {
    let ContactRows = await page.$$('.contact-address');
    console.log('countContactRows -> ContactRows', ContactRows.length);

    return ContactRows;
  }

  async function getUserInfo() {
    const UserName = await getText(page, page, '.display-name');
    console.log('getUsers -> UserName', UserName);

    let UserPinBadge = '';
    const UserPinBadgeSelector = await page.$('.user-pin-badge span');
    if (UserPinBadgeSelector) {
      UserPinBadge = await getText(page, page, '.user-pin-badge span');
      console.log('getUsers -> UserPinBadge', UserPinBadge);
    } else {
      console.error('no UserPinBadge');
    }
    return { UserName, UserPinBadge };
  }

  async function getUserRows() {
    await page.waitForSelector('.list-row-content .access-summary-badge');
    let UserRows = await page.$$('.list-row-content .access-summary-badge');
    return UserRows;
  }
}

/*
|-----------------------------------------------------------------------
|
| NOTIFICATIONS MODULE
|
|-----------------------------------------------------------------------
| */

/** @param {puppeteer.Page} page */
async function getNotifications(page) {
  await openNotificationsPage();

  const frame = await getNotificationsFrame();

  if (!frame) {
    throw 'NO FRAME FOUND';
  }

  const length = await getNotificationsLength();

  for (let index = 0; index < length; index++) {
    substepMessage('openNotificationItem ' + (index + 1) + '/' + length);

    let Notification = await openNotificationItem(frame, index);
    if (Notification) {
      await writeNotificationContacts(Notification, index);

      await page.goBack();
    }
  }
  stepMessage('NOTIFICATIONS MODULE DONE');

  async function writeNotificationContacts(Notification, index) {
    await frame.waitForSelector('#addRecipientBtnWrap');
    await frame.waitForSelector('.recipientsPanel');

    let rows = await frame.$$('.recipientsPanel .contact.highlight-row');
    console.log('writeNotificationContacts -> length', rows.length);

    const contacts = [];

    if (rows.length) {
      for (const r of rows) {
        contacts.push({
          NotificationName: Notification.name,
          NotificationStatus: Notification.status,
          Name: await getText(frame, r, '.contact-name'),
          Address: await getText(frame, r, '.contact-address'),
        });
      }
    } else {
      contacts.push({
        NotificationName: Notification.name,
        NotificationStatus: Notification.status,
      });
    }

    appendJson('Notifications.' + index, contacts);
  }

  async function openNotificationItem(frame, itemNumber) {
    await frame.waitForSelector('.notifications-div');

    const notification = await frame.evaluate(itemNumber => {
      const rows = document.querySelectorAll(
        '.notifications-div .notification.highlight-row',
      );

      const row = rows[itemNumber];
      const edit = row.querySelector('.edit-notification');
      const name = row.querySelector('.name').textContent;

      const status =
        row.querySelector('.notification-status').textContent.trim() ||
        (row.querySelector('.notification-status .switch-on') && 'On') ||
        (row.querySelector('.notification-status .switch-off') && 'Off') ||
        'N/A';

      if (status === 'Create') {
        return { name, error: 'status=create' };
      } else if (edit) {
        edit.click();
        return { name, status };
      } else {
        return { name, error: 'not editable' };
      }
    }, itemNumber);

    if (_.has(notification, 'error')) {
      errorMsg(`${notification.name} ${notification.error}`);
      return null;
    }

    await frame.waitForNavigation();

    console.log('writeNotificationContacts -> NotificationName', notification);

    return notification;
  }

  async function getNotificationsLength() {
    return await frame.evaluate(() => {
      return document.querySelectorAll('.notifications-div>div').length;
    });
  }

  async function getNotificationsFrame() {
    const frameSrc = '/web/Notifications/NotificationsNew.aspx';
    return await getIframe(page, frameSrc);
  }

  async function openNotificationsPage() {
    // WE NEED NETWORK IDLE 0 BECAUSE OF IFRAME

    console.log('openNotificationsPage -> openNotificationsPage');
    await page.goto(
      'https://www.alarm.com/web/Notifications/NotificationsNew.aspx',
      {
        waitUntil: 'networkidle0',
      },
    );
  }
}

/*
|-----------------------------------------------------------------------
|
| ALARM HELPERS
|
|-----------------------------------------------------------------------
| */

/** @param {puppeteer.Page} page */
async function getAllSaps(page) {
  await openSapDropdown(page);

  const all_saps = await page.$$(selectors.dropdown_saps_list);
  const sap_count = all_saps.length;
  console.log('selectSapNum -> sap_count', sap_count);
  return sap_count;
}

async function getSapByName({ page, sap_name }) {
  const all_saps = await page.$$(selectors.dropdown_saps_list);

  for (row of all_saps) {
    const text = await page.evaluate(el => el.textContent, row);

    if (String(text).toLowerCase().includes(String(sap_name).toLowerCase())) {
      row.click();
      return text;
    }
  }

  errorDie('NO SUCH SAP FOUND');
}

async function getSapByIndex({ page, sap_index }) {
  // SELECT AND GET SAP
  const params = { sap_index };
  params['selector'] = selectors.dropdown_saps_list;

  return await page.evaluate(p => {
    const sap_item = document.querySelectorAll(p.selector)[p.sap_index];
    sap_item.click();
    return sap_item.innerText;
  }, params);
}

async function selectSap({ page, sap_index, sap_name }) {
  console.log('selectSap ', { sap_index, sap_name });

  if (!sap_index && sap_index !== 0 && !sap_name)
    errorDie('INVALID ARGUMENTS IN selectSapNum');

  await openSapDropdown(page);

  const sap = sap_name
    ? await getSapByName({ page, sap_name })
    : await getSapByIndex({ page, sap_index });

  env.G_SAP = sap.trim().replace('.', ' ').trim();
  stepMessage(env.G_SAP);
  await page.waitForNavigation();
}

/** @param {puppeteer.Page} page */
async function openSapDropdown(page) {
  // OPEN DROPDOWN
  await click(page, selectors.sap_dropdown);

  // WAIT FOR DROPDOWN UI UPDATE
  await page.waitForSelector(selectors.dropdown_saps_list);
}

/** @param {puppeteer.Page} page */
async function openNavigationLink(page, module, timeout = 120000) {
  console.log('openNavigationLink -> openNavigationLink', module);

  try {
    await page.waitForSelector('[route-id="' + module + '"] a', { timeout });
  } catch (error) {
    errorDie('Cannot find navigation id: ' + module);
  }

  const a = await page.$('[route-id="' + module + '"] a');
  a.click();
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout });
}

/** @param {puppeteer.Page} page */
async function getIframe(page, frameSrc) {
  const elementHandle = await page.$('[src="' + frameSrc + '"]');
  const frame = await elementHandle.contentFrame();
  return frame;
}

/** @param {puppeteer.Page} page */
async function openAlarm(page) {
  stepMessage('openAlarm');

  // await loginAlram(page);
  await handle2FA();

  await page.goto('https://www.alarm.com/web/system/automation/scenes', {
    waitUntil: 'networkidle0',
  });
}

/** @param {puppeteer.Page} page */
async function loginAlram(page) {
  stepMessage('loginAlram');
  // await screenshot(page);

  await page.goto('https://www.alarm.com/login.aspx', {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForSelector(selectors.loginSubmit);
  await setValue(page, selectors.username, env.username);
  await setValue(page, selectors.password, env.password);
  await click(page, selectors.loginSubmit);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await handle2FA(page);
}

/** @param {puppeteer.Page} page */
async function handle2FA(page) {
  try {
    console.log(`🚀 > handle2FA`);
    await page.waitForSelector(selectors.twoFactorConfirm);
  } catch (error) {
    console.log(`🚀 > NOOOOO handle2FA`, error);
  }
  try {
    await click(page, selectors.twoFactorSkip);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
  } catch (error) {
    console.log(`🚀 > CANNOT THWART handle2FA`, error);
  }
}

/** @param {puppeteer.Page} page */
async function getIframe(page, frameSrc) {
  const elementHandle = await page.$('[src="' + frameSrc + '"]');
  const frame = await elementHandle.contentFrame();
  return frame;
}

/** @param {puppeteer.Page} page */
async function screenshot(page) {
  await page.screenshot({ path: 'example.png' });
}

/** @param {puppeteer.Page} page */
async function setValue(page, selector_name, value_name) {
  await page.waitForSelector(selector_name);

  const params = { selector_name, value_name };

  await page.evaluate(p => {
    document.querySelector(p.selector_name).value = p.value_name;
  }, params);
}

/** @param {puppeteer.Page} page */
async function type(page, selector_name, value_name) {
  await page.waitForSelector(selector_name);

  await page.focus(selector_name);
  await click(page, selector_name);
  await page.keyboard.type(value_name, { delay: 1 });
  // await page.type(selector_name, value_name, { delay: 1 });
}

/** @param {puppeteer.Page} page */
async function getText(page, parentEl, selector, attr = 'innerText') {
  await page.waitForSelector(selector);

  let element = await parentEl.$(selector);
  const text = await page.evaluate(
    (element, attr) => element[attr],
    element,
    attr,
  );
  return text.trim();
}

/** @param {puppeteer.Page} page */
async function click(page, selector_name) {
  await page.waitForSelector(selector_name);

  const a = await page.$(selector_name);
  a.click();
}

/*
|-----------------------------------------------------------------------
|
| RUN
|
|-----------------------------------------------------------------------
| */

run();
