const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const app = new express();

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
            // Check if there is a latest trade before logging
            if (trades.length > 0) {
                console.log(`Latest trade for${name}:`, trades[0], buyorsell[0], companyName[0]);
            } else {
                console.log(`There is no latest trade for ${name} (${url}).`);
            }
        })
        .catch(err => {
            console.error(`Error processing ${name} (${url}):`, err);
        });
}

// Fetch politician URLs and process them
fetchPoliticianUrls('https://www.capitoltrades.com/politicians')
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
