const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs').promises;

const app = express();

async function clearFile(filePath) {
    await fs.writeFile(filePath, '', 'utf8');
}

async function fetchPoliticianUrls(politicianUrl) {
    const response = await axios(politicianUrl);
    const html = response.data;
    const $ = cheerio.load(html);
    const urlMap = new Map();

    $('.index-card-link').each(function () {
        const url = $(this).attr('href');
        const name = $(this).find('.q-cell.cell--name').text();
        urlMap.set(`https://www.capitoltrades.com${url}`, name.trim());
    });

    return urlMap;
}

async function processUrl(url, name) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const trades = $('.q-field.issuer-ticker').map((i, el) => {
            let stock = $(el).text().trim().split(':')[0];
            return { stock };
        }).get();

        const buyorsell = $('.q-field.tx-type').map((i, el) => ({ type: $(el).text().trim() })).get();
        const companyName = $('.q-fieldset.issuer-name').map((i, el) => ({ company: $(el).text().trim() })).get();
        const dateTraded = $('.q-td.q-column--txDate').map((i, el) => ({ date: $(el).text().trim() })).get();

        if (trades.length > 0) {
            await fs.appendFile('output.txt', `Latest trade for ${name} at time: ${JSON.stringify(trades[0])}, ${JSON.stringify(buyorsell[0])}, ${JSON.stringify(companyName[0])}, ${JSON.stringify(dateTraded[0])}\n`);
        } else {
            await fs.appendFile('output.txt', `There is no latest trade for ${name} (${url}).\n`);
        }
    } catch (err) {
        await fs.appendFile('output.txt', `Error processing ${name} (${url}): ${err}\n`);
    }
}

async function main() {
    await clearFile('output.txt');
    try {
        const urlMap = await fetchPoliticianUrls('https://www.capitoltrades.com/politicians?page=1');
        await Promise.all(Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name)));
        app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
    } catch (err) {
        console.error('Error processing URLs:', err);
    }
}

main();