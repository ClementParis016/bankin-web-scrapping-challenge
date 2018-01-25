'use strict';

const { URL } = require('url');
const util = require('util');
const fs = require('fs');
const puppeteer = require('puppeteer');
const writeFile = util.promisify(fs.writeFile);

const IS_DEBUG = process.argv.includes('--debug');
const OUTPUT_FILE = 'operations.json';

/**
 * Get operations from an HTML table element.
 * @param {element} $table The HTML table element to process.
 * @return {array} An array containing the extracted operations objects.
 */
function getTableOperations($table) {
  const AMOUNT_REGEX = /(\d+)(.+)/;
  const LINE_LENGTH = 3;
  // Get all table cells except those on first line which are columns titles.
  const $tds = $table.querySelectorAll('tbody tr:not(:first-child) td');

  // Convert the $tds NodeList to an Array and loop through all cells to extract their contents.
  return Array.from($tds).reduce((operations, $td, index) => {
    // Get index of last processed operation.
    const lastIndex = operations.length - 1;
    const value = $td.textContent;

    // Process current $td as part of a line, based on LINE_LENGTH.
    switch (index % LINE_LENGTH) {
      case 0:
        // New line starts, push a new operation.
        operations.push({
          account: value
        });
        return operations;
      case 1:
        // Update last operation.
        operations[lastIndex].transaction = value;
        return operations;
      case 2:
        // Parse amount & currency from cell content.
        const [, amount, currency] = value.match(AMOUNT_REGEX);
        // Update last operation.
        operations[lastIndex].amount = parseInt(amount, 10);
        operations[lastIndex].currency = currency;
        return operations;
      default:
        return operations;
    }
  }, []);
}

async function processPage(page, startIndex, store) {
  let lastFrame;
  const pageUrl = new URL('https://web.bankin.com/challenge/index.html');
  pageUrl.search = `start=${startIndex}`;

  page.on('dialog', async dialog => {
    console.log(
      `%s dialog opened with message: %s`,
      dialog.type(),
      dialog.message()
    );
    try {
      // Try dismissing the dialog
      console.log('Dismissing dialog...');
      await dialog.dismiss();
    } catch (e) {
      // If we cannot dismiss it we reload the page (it happens at random, probably a bug with Puppeteer)
      console.log('Could not dismiss dialog, reloading page...');
      await page.reload();
      return;
    }
    console.log('Reloading transactions...');
    await page.click('#btnGenerate');
  });

  page.on('frameattached', frame => {
    // Hold a reference to the last frame attached to the page.
    lastFrame = frame;
  });

  await page.goto(pageUrl.toString());
  console.log('Page loaded', pageUrl.toString());

  // Finds table or iframe, whichever comes first
  const $target = await Promise.race([
    page.waitForSelector('table'),
    page.waitForSelector('iframe')
  ]);

  // Determine if it was a table or an iframe
  const targetType = await page.evaluate(target => target.tagName, $target);

  // Execute extraction on the according page or frame and element
  const operations =
    targetType === 'IFRAME'
      ? await lastFrame.$eval('table', getTableOperations)
      : await page.evaluate(getTableOperations, $target);

  // Store the operations if any
  if (operations && operations.length > 0) {
    store.push(...operations);
  } else {
    throw new Error('No data');
  }
}

puppeteer
  .launch({ devtools: IS_DEBUG })
  .then(async browser => {
    const PAGE_LENGTH = 50;
    let store = [];
    let startIndex = 0;

    // Create browser tabs for parallel processing
    async function createPages(count) {
      let pages = [];

      for (let i = 0; i < 10; i++) {
        const page = await browser.newPage();
        pages.push(page);
      }

      return pages;
    }

    // Create a processing promise for a given page
    function createPageProcessingPromises(pages) {
      let promises = [];

      for (let page of pages) {
        const promise = processPage(page, startIndex, store);
        promises.push(promise);
        // Increase startIndex so we don't process the same page multiple times
        startIndex += PAGE_LENGTH;
      }

      return promises;
    }

    // Close all given pages
    async function closePages(pages) {
      for (let page of pages) {
        await page.close();
      }
    }

    while (true) {
      console.time('Run');
      const pages = await createPages(10);
      const promises = createPageProcessingPromises(pages);
      try {
        await Promise.all(promises);
        await closePages(pages);
      } catch (error) {
        await writeFile(OUTPUT_FILE, JSON.stringify(store, null, 2));
        browser.close();
        console.timeEnd('Run');
        process.exit(0);
      }
    }
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
