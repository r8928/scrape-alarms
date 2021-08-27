const puppeteer = require('puppeteer');
const _ = require('lodash');
const { env } = require('./env');
const { appendJson } = require('./jsonfile');
const { msg } = require('./msgs');
const { getBrowser, getIframe, screenshot, setValue, type, getText, click, goto, } = require('./ppt'); // prettier-ignore

const selectors = {
  username: '[id="ctl00_ContentPlaceHolder1_loginform_txtUserName"]',
  password: '[name="txtPassword"]',
  loginSubmit: '[name="ctl00$ContentPlaceHolder1$loginform$signInButton"]',
  twoFactorConfirm: '.two-factor-intro',
  twoFactorSkip: 'button[type="cancel"]',
  sap_dropdown: '.system-select .dropdown-toggle',
  dropdown_saps_list: '.popper-container .content ul li a',
};

const navigationIds = {
  Settings: 1169,
  Settings_MonitoringStation: 22,
  Users: 'users',
  SettingsURL: 'https://www.alarm.com/web/system/settings',
  Settings_MonitoringStationURL:
    'https://www.alarm.com/web/Profile/MonitoringStation/MonitoringStation.aspx',
  UsersURL: 'https://www.alarm.com/web/system/users',
};

async function run() {
  if (![2, 3].includes(process.argv.length)) {
    return die.say('INVALID NUMBER OF ARGUMENTS');
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
    await doStore({ page, sap_name: process.argv.pop(2), sap_count: 1 });
  }

  msg.step('ALL DONE!!!');

  await page.close();
  // await browser.close();
  return process.exit();
}

/** @param {puppeteer.Page} page */
async function doAllSaps(page) {
  const sap_count = await getAllSaps(page);

  for (let sap_index = 0; sap_index < sap_count; sap_index++) {
    await doStore({ page, sap_index, sap_count });
  }
}

async function doStore({ page, sap_index, sap_name, sap_count }) {
  await selectSap({ page, sap_index, sap_name });

  msg.step(env.G_SAP + ': ' + Number(sap_index) + 1 + '/' + sap_count);

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
  msg.step('SETTINGS MODULE');

  await openNavigationLink(page, navigationIds.Settings);
  // await goto(page, navigationIds.SettingsURL);

  try {
    await openNavigationLink(page, navigationIds.Settings_MonitoringStation);
    // await goto(page, navigationIds.Settings_MonitoringStationURL);
  } catch (error) {
    screenshot(page);
    msg.error('MONITORING STATION NOT FOUND - PROTECTION 1?');
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
      msg.info('getSettings -> FirstName', data.FirstName);
    }
  }

  appendJson('Monitoring', Contacts);

  async function getContactRows() {
    try {
      await frame.waitForSelector(
        '.emergency-contact-rows>.emergency-contact-row',
        { timeout: 10000 },
      );
      let ContactRows = await frame.$$(
        '.emergency-contact-rows>.emergency-contact-row',
      );
      msg.substep('getContactRows -> ContactRows ' + ContactRows.length);
      return ContactRows;
    } catch (error) {
      msg.error('No users found in Settings->Monitoring --- Brinks???');
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
  msg.step('USERS MODULE');

  await openNavigationLink(page, navigationIds.Users);
  // await goto(page, navigationIds.UsersURL);

  let users = await getUserRows(page);

  for (let index = 0; index < users.length; index++) {
    let users = await getUserRows(page);
    msg.substep('getUsers ' + (index + 1) + '/' + users.length);

    await selectPage(users, index);

    if (await userDetailsExists()) {
      await saveThisPage(index);
    }

    await page.goBack();
  }

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

    return ContactRows;
  }

  async function getUserInfo() {
    const UserName = await getText(page, page, '.display-name');
    msg.info('getUsers -> UserName', UserName);

    let UserPinBadge = '';
    const UserPinBadgeSelector = await page.$('.user-pin-badge span');
    if (UserPinBadgeSelector) {
      UserPinBadge = await getText(page, page, '.user-pin-badge span');
      msg.info('getUsers -> UserPinBadge', UserPinBadge);
    } else {
      console.error('no UserPinBadge');
    }
    return { UserName, UserPinBadge };
  }

  async function getUserRows(page) {
    try {
      await page.waitForSelector('.list-row-content .access-summary-badge');
    } catch (error) {
      msg.die('Cannot get userRow', await page.url());
    }
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
  msg.step('NOTIFICATIONS MODULE');

  await openNotificationsPage(page);

  const frame = await getNotificationsFrame();

  if (!frame) {
    throw 'NO FRAME FOUND';
  }

  const length = await getNotificationsLength();

  for (let index = 0; index < length; index++) {
    msg.substep('openNotificationItem ' + (index + 1) + '/' + length);

    let Notification = await openNotificationItem(frame, index);
    if (Notification) {
      await writeNotificationContacts(Notification, index);

      await page.goBack();
    }
  }

  async function writeNotificationContacts(Notification, index) {
    await frame.waitForSelector('#addRecipientBtnWrap');
    await frame.waitForSelector('.recipientsPanel');

    let rows = await frame.$$('.recipientsPanel .contact.highlight-row');
    msg.info('writeNotificationContacts -> length', rows.length);

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
      msg.error(`${notification.name} ${notification.error}`);
      return null;
    }

    await frame.waitForNavigation();

    msg.info('writeNotificationContacts -> NotificationName', notification);
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

  async function openNotificationsPage(page) {
    // WE NEED NETWORK IDLE 0 BECAUSE OF IFRAME

    await goto(
      page,
      'https://www.alarm.com/web/Notifications/NotificationsNew.aspx',
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
  return sap_count;
}

async function selectSap({ page, sap_index, sap_name }) {
  if (!sap_index && sap_index !== 0 && !sap_name)
    msg.die('INVALID ARGUMENTS IN selectSapNum');

  await openSapDropdown(page);

  const sap = sap_name
    ? await getSapByName({ page, sap_name })
    : await getSapByIndex({ page, sap_index });

  env.G_SAP = sap.trim().replace('.', ' ').trim();
  await page.waitForNavigation();

  async function getSapByName({ page, sap_name }) {
    const all_saps = await page.$$(selectors.dropdown_saps_list);

    for (row of all_saps) {
      const text = await page.evaluate(el => el.textContent, row);

      if (String(text).toLowerCase().includes(String(sap_name).toLowerCase())) {
        row.click();
        return text;
      }
    }

    msg.die('NO SUCH SAP FOUND');
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
}

/** @param {puppeteer.Page} page */
async function openSapDropdown(page) {
  // OPEN DROPDOWN
  await click(page, selectors.sap_dropdown);

  // WAIT FOR DROPDOWN UI UPDATE
  await page.waitForSelector(selectors.dropdown_saps_list);
}

/** @param {puppeteer.Page} page */
async function openNavigationLink(page, module, timeout = 60000) {
  msg.substep('openNavigationLink', module);

  try {
    const selector = navigationLinkSelector(module);
    await page.waitForSelector(selector);
    await page.click(selector);
  } catch (error) {
    screenshot(page);
    msg.die('Cannot openNavigationLink ', module);
  }
}

function navigationLinkSelector(module) {
  return `[route-id="${module}"] a`;
}

/** @param {puppeteer.Page} page */
async function openAlarm(page) {
  msg.step('openAlarm');

  // await loginAlram(page);
  await handle2FA(page);
}

/** @param {puppeteer.Page} page */
async function loginAlram(page) {
  msg.step('loginAlram');
  // await screenshot(page);

  await goto(page, 'https://www.alarm.com/login.aspx');

  await page.waitForSelector(selectors.loginSubmit);
  await setValue(page, selectors.username, env.username);
  await setValue(page, selectors.password, env.password);
  await click(page, selectors.loginSubmit);
  await handle2FA(page);
}

/** @param {puppeteer.Page} page */
async function handle2FA(page) {
  try {
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 10 * 1000,
    });
  } catch (error) {
    console.log(`🚀 > networkidle0`);
  }

  try {
    await page.waitForSelector(selectors.twoFactorSkip);
    msg.substep(`handle2FA`);
  } catch (error) {
    msg.info(`🚀 > NOOOOO 2FA`, await page.url());
    // await writeHtmlAndDie(page);

    return openHome(page);
  }

  try {
    await click(page, selectors.twoFactorSkip);
  } catch (error) {
    console.log(`🚀 > error`, typeof error, error);
    msg.die(`🚀 > COULD NOT THWART 2FA: LAYOUT CHANGED???`, await page.url());
  }

  await openHome(page);
}

async function openHome(page) {
  try {
    await page.waitForSelector(selectors.sap_dropdown);
  } catch (error) {
    await goto(page, 'https://www.alarm.com/web/system/home');
  }

  try {
    await page.waitForSelector(selectors.sap_dropdown);
  } catch (error) {
    msg.die(`🚀 > COULD NOT THWART 2FA: NOT LOGGED IN`, await page.url());
  }
}

async function writeHtmlAndDie(page) {
  screenshot(page);

  const html = await page.evaluate(
    'new XMLSerializer().serializeToString(document.doctype) + document.documentElement.outerHTML',
  );
  console.log(html.replace(/\s+/gm, ' '));

  const fs = require('fs');
  fs.writeFileSync('html', html);
  process.exit();
}

/*
|-----------------------------------------------------------------------
|
| RUN
|
|-----------------------------------------------------------------------
| */

run();
