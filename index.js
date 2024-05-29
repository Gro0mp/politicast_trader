const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

const app = new express();

// Create a write stream to output the results to a file
const writeStream = fs.createWriteStream('output.txt', { flags: 'a' }); // 'a' means appending to the file

// Function to fetch politician URLs
function fetchPoliticianUrls(politicianUrl) {
    return axios(politicianUrl)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);
            const urlMap = new Map();

            $('.index-card-link', html).each(function () {
                const url = $(this).attr('href');
                const name = $(this).find('.q-cell.cell--name').text();
                urlMap.set("https://www.capitoltrades.com" + url.toString(), name.toString());
            });

            return urlMap;
        });
}

// Function to process a single URL
function processUrl(url, name) {
    return axios.get(url)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);
            const trades = [];
            const buyorsell = [];
            const companyName = [];
            const dateTraded = [];
            $('.q-field.issuer-ticker', html).each(function () {
                let stock = $(this).text().trim();
                const colonIndex = stock.indexOf(":");
                if (colonIndex !== -1) {
                    stock = stock.substring(0, colonIndex);
                }
                trades.push({ stock });
            });
            $('.q-field.tx-type', html).each(function () {
                const type = $(this).text();
                buyorsell.push({ type });
            });
            $('.q-fieldset.issuer-name', html).each(function () {
                const company = $(this).text();
                companyName.push({ company });
            });
            $('.q-td.q-column--txDate', html).each(function () {
                const date = $(this).text();
                dateTraded.push({ date });
            });
            // Check if there is a latest trade before logging
            if (trades.length > 0) {
                writeStream.write(`Latest trade for ${name} at time: ${JSON.stringify(trades[0])}, ${JSON.stringify(buyorsell[0])}, ${JSON.stringify(companyName[0])}, ${JSON.stringify(dateTraded[0])}\n`);
            } else {
                writeStream.write(`There is no latest trade for ${name} (${url}).\n`);
            }
        })
        .catch(err => {
            writeStream.write(`Error processing ${name} (${url}): ${err}\n`);
        });
}

// Fetch politician URLs and process them
fetchPoliticianUrls('https://www.capitoltrades.com/politicians?page=1')
    .then(urlMap => {
        // Process each URL using Promise.all
        const promises = Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name));

        // Use Promise.all to wait for all promises to be resolved
        return Promise.all(promises);
    })
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
    })
    .catch(err => {
        console.error('Error processing URLs:', err);
    });